'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { VideoMetadata } from '@/components/player/VideoMetadata';
import { RelatedRecommendations } from '@/components/player/RelatedRecommendations';
import { DanmakuSidebar } from '@/components/player/desktop/DanmakuSidebar';
import { useDanmaku } from '@/components/player/hooks/useDanmaku';
import { useVideoPlayer } from '@/lib/hooks/useVideoPlayer';
import type { VideoResolutionInfo } from '@/components/player/hooks/useVideoResolution';
import { useHistory } from '@/lib/store/history-store';
import { FavoritesSidebar } from '@/components/favorites/FavoritesSidebar';
import { WatchHistorySidebar } from '@/components/history/WatchHistorySidebar';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { Navbar } from '@/components/layout/Navbar';
import { settingsStore } from '@/lib/store/settings-store';
import { premiumModeSettingsStore } from '@/lib/store/premium-mode-settings';
import { getSourceName } from '@/lib/utils/source-names';
import { ShieldCheck } from 'lucide-react';
import type { SourceItem } from '@/components/player/desktop/SourceResolutionMenu';

interface AvailableSourceItem {
  id: string | number;
  source: string;
  sourceName: string;
  vod_name: string;
  vod_remarks?: string;
  latency?: number;
}

function PlayerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isPremium = searchParams.get('premium') === '1';
  const { addToHistory } = useHistory(isPremium);

  const videoId = searchParams.get('id');
  const source = searchParams.get('source');
  const title = searchParams.get('title') || '';
  const episodeParam = searchParams.get('episode');

  const missingRequiredParams = !videoId || !source;

  const modeStore = isPremium ? premiumModeSettingsStore : settingsStore;
  const [isReversed] = useState(() =>
    typeof window !== 'undefined' ? modeStore.getSettings().episodeReverseOrder : false
  );

  // 硬件解码器真实物理分辨率
  const [hardwareResolution, setHardwareResolution] = useState<VideoResolutionInfo | null>(null);

  // 播放器内部多源列表：并发检索全网所有源并直接喂给播放器内部
  const [allSearchedSources, setAllSearchedSources] = useState<AvailableSourceItem[]>([]);

  const playerTimeRef = useRef(0);

  const [isDanmakuSidebarOpen, setIsDanmakuSidebarOpen] = useState(true);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [playerHeight, setPlayerHeight] = useState<number>(0);

  // 动态锁定侧边栏高度与左侧播放器严格等高，绝不被弹幕列表撑高页面
  useEffect(() => {
    const el = playerContainerRef.current;
    if (!el) return;
    const updateHeight = () => {
      const h = el.offsetHeight || el.clientHeight;
      if (h > 150) setPlayerHeight(h);
    };
    updateHeight();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 150) setPlayerHeight(h);
      }
    });
    ro.observe(el);
    const handleFsChange = () => {
      updateHeight();
      requestAnimationFrame(updateHeight);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      ro.disconnect();
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);
  const {
    videoData,
    loading,
    videoError,
    currentEpisode,
    playUrl,
    setCurrentEpisode,
    setPlayUrl,
    activeVideoId,
    activeSource,
    resumePosition,
    switchSource,
  } = useVideoPlayer(videoId, source, episodeParam, isReversed);

  // 进页面立即以 title 检索全网所有源，直接喂给播放器内部控件
  useEffect(() => {
    if (!title) return;

    const controller = new AbortController();

    (async () => {
      try {
        let targets = settingsStore.getSettings().sources?.filter((s) => s.enabled !== false) || [];
        if (targets.length < 3) {
          const sRes = await fetch('/api/sources');
          if (sRes.ok) targets = await sRes.json();
        }

        const response = await fetch('/api/search-parallel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: title, sources: targets, page: 1 }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const found: AvailableSourceItem[] = [];
        const cleanTarget = title.toLowerCase().replace(/[\s\p{P}]/gu, '');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'videos' && Array.isArray(data.videos)) {
                for (const v of data.videos) {
                  const cleanName = (v.vod_name || '').toLowerCase().replace(/[\s\p{P}]/gu, '');
                  if (cleanName === cleanTarget || cleanName.includes(cleanTarget) || cleanTarget.includes(cleanName)) {
                    if (!found.some((item) => item.source === v.source)) {
                      found.push({
                        id: v.vod_id,
                        source: v.source,
                        sourceName: v.sourceDisplayName || getSourceName(v.source),
                        vod_name: v.vod_name,
                        vod_remarks: v.vod_remarks,
                        latency: v.latency,
                      });
                      setAllSearchedSources([...found]);
                    }
                  }
                }
              }
            } catch {}
          }
        }
      } catch {}
    })();

    return () => controller.abort();
  }, [title]);

  // 切集处理
  // 全屏无感切集：内存直接切流，完全不触发Next.js路由刷新，不打断全屏，零弹框
  const handleEpisodeClick = useCallback((episode: { name?: string; url: string }, index: number) => {
    setCurrentEpisode(index);
    setPlayUrl(episode.url);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('episode', index.toString());
      params.delete('t');
      window.history.replaceState(null, '', `/player?${params.toString()}`);
    }
  }, [setCurrentEpisode, setPlayUrl]);

  // 切源处理
  const handleSourceSelect = (target: SourceItem) => {
    void switchSource(String(target.id), target.source, playerTimeRef.current);
  };

  // 硬件真实物理分辨率回调
  const handleResolutionDetected = useCallback((info: VideoResolutionInfo) => {
    setHardwareResolution(info);
  }, []);


  // 格式化传入播放器内部的全部源列表
  const playerSources: SourceItem[] = allSearchedSources.map((s) => ({
    id: s.id,
    source: s.source,
    sourceName: s.sourceName,
    latency: s.latency,
    remarks: s.vod_remarks,
  }));

  // 如果当前源还没在列表里，补充进去
  if (activeSource && activeVideoId && !playerSources.some((s) => s.source === activeSource)) {
    playerSources.unshift({
      id: activeVideoId,
      source: activeSource,
      sourceName: getSourceName(activeSource),
      remarks: (videoData as Record<string, unknown> | null)?.vod_remarks as string | undefined,
    });
  }

  // 全网弹幕聚合与时间轴管理
  const danmaku = useDanmaku({
    videoTitle: videoData?.vod_name || title || '',
    episodeName: videoData?.episodes?.[currentEpisode]?.name || '',
    episodeIndex: currentEpisode,
  });
  if (missingRequiredParams) return null;
  return (
    <div className="min-h-screen bg-[#121212] text-[#e3e5e7]">
      {/* 52px 极简通用 Header */}
      <Navbar isPremiumMode={isPremium} onReset={() => router.push(isPremium ? '/premium' : '/')} />

      <main className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 pb-24 pt-6 space-y-6">

        {/* 1. 播放器主体与右侧并排弹幕列表侧边栏 (B站同款 Web 左右并排布局) */}
        <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
          {/* 左侧：播放器主体 (独立自适应，保持标准物理高度) */}
          <div ref={playerContainerRef} className="flex-1 min-w-0 w-full overflow-hidden relative bg-black">
            <VideoPlayer
              playUrl={playUrl}
              videoId={activeVideoId || undefined}
              initialTime={resumePosition}
              currentEpisode={currentEpisode}
              onBack={() => router.back()}
              totalEpisodes={videoData?.episodes?.length || 0}
              onNextEpisode={() => {
                if (videoData?.episodes && currentEpisode < videoData.episodes.length - 1) {
                  handleEpisodeClick(videoData.episodes[currentEpisode + 1], currentEpisode + 1);
                }
              }}
              isReversed={isReversed}
              isPremium={isPremium}
              videoTitle={videoData?.vod_name || title}
              episodeName={videoData?.episodes?.[currentEpisode]?.name || ''}
              externalTimeRef={playerTimeRef}
              onResolutionDetected={handleResolutionDetected}
              sources={playerSources}
              currentSource={activeSource || undefined}
              onSelectSource={handleSourceSelect}
              onEpisodeClick={(idx) => {
                if (videoData?.episodes?.[idx]) {
                  handleEpisodeClick(videoData.episodes[idx], idx);
                }
              }}
              onTimeUpdate={(currentTime, duration) => {
                setPlaybackDuration(duration);
              }}
              danmaku={danmaku}
              isDanmakuSidebarOpen={isDanmakuSidebarOpen}
              onToggleDanmakuSidebar={() => setIsDanmakuSidebarOpen((prev) => !prev)}
            />
          </div>

          {/* 右侧：位于播放器右侧的并排弹幕列表与控制侧边栏 (高度严格对齐左侧播放器，绝不撑爆) */}
          <DanmakuSidebar
            danmaku={danmaku}
            currentVideoDuration={playbackDuration}
            onSeek={(t) => {
              const video = document.querySelector('video');
              if (video) video.currentTime = t;
            }}
            isOpen={true}
            style={{
              height: playerHeight > 0 ? `${playerHeight}px` : '60vh',
              maxHeight: 'calc(100dvh - 100px)',
            }}
            className="w-full shrink-0 lg:w-80 xl:w-88"
          />
        </div>
        {/* 2. 播放器正下方：自然流式展开的作品详情与收藏 (完全不遮挡，自适应呈现) */}
        <div className="w-full space-y-3 pb-2 border-b border-white/5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-white">作品详情与介绍</h3>
            {videoData && videoId && (
              <FavoriteButton
                videoId={videoId}
                source={source}
                title={videoData.vod_name || title}
                poster={videoData.vod_pic}
                type={videoData.type_name}
                year={videoData.vod_year}
                size={18}
                isPremium={isPremium}
              />
            )}
          </div>

          <VideoMetadata
            videoData={videoData}
            source={source}
            title={title}
          />
        </div>

        {/* 3. 播放器最下方：相关精彩剧目推荐 (基于同类型与同题材推荐) */}
        <RelatedRecommendations
          currentTitle={videoData?.vod_name || title}
          typeName={videoData?.type_name || '动漫'}
          vodClass={(videoData as Record<string, unknown> | null)?.vod_class as string || ''}
          isPremium={isPremium}
        />
      </main>

      <FavoritesSidebar isPremium={isPremium} />
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#121212]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
      </div>
    }>
      <PlayerContent />
    </Suspense>
  );
}
