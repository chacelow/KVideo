'use client';

import { useState, useMemo } from 'react';
import { VideoGrid } from '@/components/search/VideoGrid';
import { useSourceBadges } from '@/lib/hooks/useSourceBadges';
import { useTypeBadges } from '@/lib/hooks/useTypeBadges';
import { useLanguageBadges } from '@/lib/hooks/useLanguageBadges';
import { Video, SourceBadge } from '@/lib/types';

interface SearchResultsProps {
  results: Video[];
  availableSources: SourceBadge[];
  loading: boolean;
  isPremium?: boolean;
  latencies?: Record<string, number>;
}

type ResolutionFilter = 'all' | '4k' | '1080p' | '720p';
type SortMode = 'latency' | 'quality' | 'relevance' | 'date';

function getVideoResolution(v: Video): '4k' | '1080p' | '720p' | 'other' {
  const text = `${v.vod_name || ''} ${v.vod_remarks || ''}`.toLowerCase();
  if (/(2160|4k|uhd|8k)/i.test(text)) return '4k';
  if (/(1080|fhd|蓝光|bd|remux)/i.test(text)) return '1080p';
  if (/(720|hd)/i.test(text)) return '720p';
  return 'other';
}

function getQualityScore(v: Video): number {
  const res = getVideoResolution(v);
  if (res === '4k') return 4000;
  if (res === '1080p') return 1080;
  if (res === '720p') return 720;
  return 480;
}

export function SearchResults({
  results,
  availableSources,
  loading,
  isPremium = false,
  latencies = {},
}: SearchResultsProps) {
  // 1. 过滤：视频源
  const {
    selectedSources,
    filteredVideos: sourceFilteredVideos,
    toggleSource,
  } = useSourceBadges(results, availableSources);

  // 2. 过滤：分类类型
  const {
    typeBadges,
    selectedTypes,
    filteredVideos: typeFilteredVideos,
    toggleType,
  } = useTypeBadges(sourceFilteredVideos);

  // 3. 过滤：配音语言
  const {
    languageBadges,
    selectedLangs,
    filteredVideos: langFilteredVideos,
    toggleLang,
  } = useLanguageBadges(typeFilteredVideos);

  // 4. 清晰度过滤
  const [selectedResolution, setSelectedResolution] = useState<ResolutionFilter>('all');

  // 5. 排序模式 (默认流畅度/Ping优先)
  const [sortMode, setSortMode] = useState<SortMode>('latency');

  // 统计各清晰度数量
  const resolutionCounts = useMemo(() => {
    const counts = { all: langFilteredVideos.length, '4k': 0, '1080p': 0, '720p': 0 };
    for (const v of langFilteredVideos) {
      const res = getVideoResolution(v);
      if (res === '4k') counts['4k'] += 1;
      else if (res === '1080p') counts['1080p'] += 1;
      else if (res === '720p') counts['720p'] += 1;
    }
    return counts;
  }, [langFilteredVideos]);

  // 最终排序与过滤
  const finalVideos = useMemo(() => {
    let list = [...langFilteredVideos];

    if (selectedResolution !== 'all') {
      list = list.filter((v) => getVideoResolution(v) === selectedResolution);
    }

    list.sort((a, b) => {
      if (sortMode === 'latency') {
        const latA = latencies[a.source] ?? a.latency ?? 99999;
        const latB = latencies[b.source] ?? b.latency ?? 99999;
        if (latA !== latB) return latA - latB;
        return getQualityScore(b) - getQualityScore(a);
      }
      if (sortMode === 'quality') {
        const qA = getQualityScore(a);
        const qB = getQualityScore(b);
        if (qA !== qB) return qB - qA;
        const latA = latencies[a.source] ?? a.latency ?? 99999;
        const latB = latencies[b.source] ?? b.latency ?? 99999;
        return latA - latB;
      }
      if (sortMode === 'date') {
        const yearA = parseInt(a.vod_year || '0');
        const yearB = parseInt(b.vod_year || '0');
        return yearB - yearA;
      }
      const sA = a.relevanceScore || 0;
      const sB = b.relevanceScore || 0;
      if (sA !== sB) return sB - sA;
      return (latencies[a.source] ?? a.latency ?? 99999) - (latencies[b.source] ?? b.latency ?? 99999);
    });

    return list;
  }, [langFilteredVideos, selectedResolution, sortMode, latencies]);

  if (results.length === 0 && !loading) return null;

  return (
    <div className="animate-fade-in w-full text-[#e3e5e7]">
      {/* 搜索结果双栏布局 (完全复刻 B 站番剧索引：左海报，右侧纯文字无框紧凑筛选) */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* 左侧主体：排序导航 + 大尺寸海报网格 (5列，大图饱满，横向铺展) */}
        <main className="flex-1 min-w-0 w-full">
          {/* 顶部纯文字极简排序栏 (参考 B站：追番人数 | 更新时间 | 最高评分 ... 无border) */}
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5 text-xs font-semibold">
            <div className="flex items-center gap-7">
              {[
                { id: 'latency', label: '流畅度' },
                { id: 'quality', label: '最高画质' },
                { id: 'relevance', label: '相关度' },
                { id: 'date', label: '开播时间' },
              ].map((s) => {
                const isSelected = sortMode === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSortMode(s.id as SortMode)}
                    className={`flex items-center gap-1 cursor-pointer transition-colors ${
                      isSelected ? 'text-[#00aeec] font-bold' : 'text-[#9499a0] hover:text-[#e3e5e7]'
                    }`}
                  >
                    <span>{s.label}</span>
                    {isSelected && <span>↓</span>}
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-[#9499a0]">
              共找到 <span className="text-[#00aeec] font-bold">{finalVideos.length}</span> 个结果
            </div>
          </div>

          {/* 视频网格：5列排布，海报更大，间距适中 */}
          <VideoGrid
            videos={finalVideos}
            isPremium={isPremium}
            latencies={latencies}
            className="!grid-cols-2 sm:!grid-cols-3 md:!grid-cols-4 lg:!grid-cols-5 xl:!grid-cols-5 2xl:!grid-cols-5 !gap-4"
          />
        </main>

        {/* 右侧：B站完全同款「无边框、纯文字密集筛选器」 */}
        <aside className="w-full lg:w-64 shrink-0 space-y-3.5 text-xs lg:sticky lg:top-24 select-none">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 text-sm font-bold text-[#e3e5e7]">
            <span>筛选</span>
            {(selectedResolution !== 'all' || selectedSources.size > 0 || selectedTypes.size > 0 || selectedLangs.size > 0) && (
              <button
                onClick={() => {
                  setSelectedResolution('all');
                  // reset all
                }}
                className="text-xs text-[#00aeec] hover:underline cursor-pointer"
              >
                重置
              </button>
            )}
          </div>

          {/* 1. 清晰度 */}
          <BiliFilterRow
            label="画质"
            options={[
              { id: 'all', label: `全部 (${resolutionCounts.all})` },
              { id: '4k', label: `4K (${resolutionCounts['4k']})` },
              { id: '1080p', label: `1080P (${resolutionCounts['1080p']})` },
              { id: '720p', label: `720P (${resolutionCounts['720p']})` },
            ]}
            current={selectedResolution}
            onChange={(id) => setSelectedResolution(id as ResolutionFilter)}
          />

          {/* 2. 视频来源 */}
          {availableSources.length > 0 && (
            <div className="flex gap-3 items-start">
              <span className="text-[#9499a0] shrink-0 mt-0.5 w-7 text-right">来源</span>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 flex-1">
                {availableSources.map((source) => {
                  const isSelected = selectedSources.has(source.id);
                  return (
                    <button
                      key={source.id}
                      onClick={() => toggleSource(source.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'text-[#00aeec] font-bold'
                          : 'text-[#9499a0] hover:text-[#e3e5e7]'
                      }`}
                    >
                      {source.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. 分类标签 */}
          {typeBadges.length > 0 && (
            <div className="flex gap-3 items-start">
              <span className="text-[#9499a0] shrink-0 mt-0.5 w-7 text-right">分类</span>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 flex-1">
                {typeBadges.map((badge) => {
                  const isSelected = selectedTypes.has(badge.type);
                  return (
                    <button
                      key={badge.type}
                      onClick={() => toggleType(badge.type)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'text-[#00aeec] font-bold'
                          : 'text-[#9499a0] hover:text-[#e3e5e7]'
                      }`}
                    >
                      {badge.type}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. 配音语言 */}
          {languageBadges.length > 0 && (
            <div className="flex gap-3 items-start">
              <span className="text-[#9499a0] shrink-0 mt-0.5 w-7 text-right">语言</span>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 flex-1">
                {languageBadges.map((badge) => {
                  const isSelected = selectedLangs.has(badge.lang);
                  return (
                    <button
                      key={badge.lang}
                      onClick={() => toggleLang(badge.lang)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'text-[#00aeec] font-bold'
                          : 'text-[#9499a0] hover:text-[#e3e5e7]'
                      }`}
                    >
                      {badge.lang}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * 完全复刻 B 站筛选单行：无边框，纯文本水平流，选中纯高亮蓝色
 */
function BiliFilterRow({
  label,
  options,
  current,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  current: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-3 items-start">
      <span className="text-[#9499a0] shrink-0 mt-0.5 w-7 text-right">{label}</span>
      <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 flex-1">
        {options.map((opt) => {
          const active = current === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={`cursor-pointer transition-colors ${
                active
                  ? 'text-[#00aeec] font-bold'
                  : 'text-[#9499a0] hover:text-[#e3e5e7]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
