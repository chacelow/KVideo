'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { VideoMetadata } from '@/components/player/VideoMetadata';
import type { VideoResolutionInfo } from '@/components/player/hooks/useVideoResolution';
import { useVideoPlayer } from '@/lib/hooks/useVideoPlayer';
import { useHistory } from '@/lib/store/history-store';
import { FavoritesSidebar } from '@/components/favorites/FavoritesSidebar';
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

  // 播放器状态机
  const {
    videoData,
    currentEpisode,
    playUrl,
    setCurrentEpisode,
    setPlayUrl,
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
  const handleEpisodeClick = useCallback((episode: { name?: string; url: string }, index: number) => {
    setCurrentEpisode(index);
    setPlayUrl(episode.url);
    const params = new URLSearchParams(window.location.search);
    params.set('episode', index.toString());
    params.delete('t'); // 清除旧进度，从头播放新集
    router.replace(`/player?${params.toString()}`, { scroll: false });
  }, [router, setCurrentEpisode, setPlayUrl]);

  // 切源处理
  const handleSourceSelect = (target: SourceItem) => {
    const params = new URLSearchParams(window.location.search);
    params.set('id', String(target.id));
    params.set('source', target.source);
    params.set('title', title);
    params.set('episode', currentEpisode.toString());
    if (playerTimeRef.current > 1) {
      params.set('t', Math.floor(playerTimeRef.current).toString());
    }
    router.replace(`/player?${params.toString()}`, { scroll: false });
  };

  // 硬件真实物理分辨率回调
  const handleResolutionDetected = useCallback((info: VideoResolutionInfo) => {
    setHardwareResolution(info);
  }, []);

  if (missingRequiredParams) return null;

  // 格式化传入播放器内部的全部源列表
  const playerSources: SourceItem[] = allSearchedSources.map((s) => ({
    id: s.id,
    source: s.source,
    sourceName: s.sourceName,
    latency: s.latency,
    remarks: s.vod_remarks,
  }));

  // 如果当前源还没在列表里，补充进去
  if (source && !playerSources.some((s) => s.source === source)) {
    playerSources.unshift({
      id: videoId,
      source: source,
      sourceName: getSourceName(source),
      remarks: (videoData as Record<string, unknown> | null)?.vod_remarks as string | undefined,
    });
  }

  return (
    <div className="min-h-screen bg-[#121212] text-[#e3e5e7]">
      {/* 52px 极简通用 Header */}
      <Navbar isPremiumMode={isPremium} onReset={() => router.push(isPremium ? '/premium' : '/')} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 pt-3 space-y-4">
        {/* 顶部标题栏与真实物理解码尺寸提示 */}
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/5 flex-wrap">
          <div className="flex items-baseline gap-3 min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-white truncate">
              {videoData?.vod_name || title}
            </h1>
            {videoData?.episodes?.[currentEpisode]?.name && (
              <span className="text-xs sm:text-sm text-pink-400 font-semibold shrink-0">
                {videoData.episodes[currentEpisode].name}
              </span>
            )}
            {source && (
              <span className="text-xs text-white/40 hidden sm:inline shrink-0">
                ({getSourceName(source)})
              </span>
            )}
          </div>

          {/* 真实硬件解码物理像素 */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="text-white/60">真实硬件解码:</span>
            <span className="font-bold text-white">
              {hardwareResolution
                ? `${hardwareResolution.width}x${hardwareResolution.height} (${hardwareResolution.label})`
                : '检测物理分辨率中...'}
            </span>
          </div>
        </div>

        {/* 1. 播放器主体：B站同款1280px宽屏自适应，完全充满无多余黑框 */}
        <div className="w-full rounded-xl overflow-hidden shadow-2xl relative">
          <VideoPlayer
            playUrl={playUrl}
            videoId={videoId || undefined}
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
            // 关键：把全网多源与选集直接注入播放器内部底栏！
            sources={playerSources}
            currentSource={source}
            onSelectSource={handleSourceSelect}
            onEpisodeClick={(idx) => {
              if (videoData?.episodes?.[idx]) {
                handleEpisodeClick(videoData.episodes[idx], idx);
              }
            }}
          />
        </div>

        {/* 2. 播放器正下方：自然流式展开的作品详情与收藏 (完全不遮挡，自适应呈现) */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-4">
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
