'use client';

import { useState, useMemo } from 'react';
import { VideoGrid } from '@/components/search/VideoGrid';
import { useSourceBadges } from '@/lib/hooks/useSourceBadges';
import { useTypeBadges } from '@/lib/hooks/useTypeBadges';
import { useLanguageBadges } from '@/lib/hooks/useLanguageBadges';
import { Video, SourceBadge } from '@/lib/types';
import { Zap, Target, Calendar } from 'lucide-react';

interface SearchResultsProps {
  results: Video[];
  availableSources: SourceBadge[];
  loading: boolean;
  isPremium?: boolean;
  latencies?: Record<string, number>;
}

type SortMode = 'latency' | 'relevance' | 'date';

export function SearchResults({
  results,
  availableSources,
  loading,
  isPremium = false,
  latencies = {},
}: SearchResultsProps) {
  // 1. 过滤：真实来源 (量子/暴风/光速等)
  const {
    selectedSources,
    filteredVideos: sourceFilteredVideos,
    toggleSource,
  } = useSourceBadges(results, availableSources);

  // 2. 过滤：真实类型 (日本动漫/国产动漫/国产剧/动作片等)
  const {
    typeBadges,
    selectedTypes,
    filteredVideos: typeFilteredVideos,
    toggleType,
  } = useTypeBadges(sourceFilteredVideos);

  // 3. 过滤：真实配音语言 (国语/日语/英语等)
  const {
    languageBadges,
    selectedLangs,
    filteredVideos: langFilteredVideos,
    toggleLang,
  } = useLanguageBadges(typeFilteredVideos);

  // 4. 过滤：真实上映年份 (2026/2025/2024...)
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // 提取本次搜索结果中真实存在的年份
  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    for (const v of typeFilteredVideos) {
      if (v.vod_year && /^\d{4}$/.test(v.vod_year.trim())) {
        yearSet.add(v.vod_year.trim());
      }
    }
    return Array.from(yearSet).sort((a, b) => parseInt(b) - parseInt(a));
  }, [typeFilteredVideos]);

  // 5. 过滤：真实地区 (日本/大陆/美国/香港等)
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const availableAreas = useMemo(() => {
    const areaSet = new Set<string>();
    for (const v of typeFilteredVideos) {
      if (v.vod_area) {
        const area = v.vod_area.trim();
        if (area.length > 0 && area.length <= 10) areaSet.add(area);
      }
    }
    return Array.from(areaSet);
  }, [typeFilteredVideos]);

  // 6. 排序模式 (默认客观物理网络延迟优先)
  const [sortMode, setSortMode] = useState<SortMode>('latency');

  // 应用全部真实维度的过滤与排序
  const finalVideos = useMemo(() => {
    let list = [...langFilteredVideos];

    // 年份过滤
    if (selectedYear !== 'all') {
      list = list.filter((v) => v.vod_year?.trim() === selectedYear);
    }

    // 地区过滤
    if (selectedArea !== 'all') {
      list = list.filter((v) => v.vod_area?.trim().includes(selectedArea));
    }

    // 排序
    list.sort((a, b) => {
      if (sortMode === 'latency') {
        const latA = latencies[a.source] ?? a.latency ?? 99999;
        const latB = latencies[b.source] ?? b.latency ?? 99999;
        if (latA !== latB) return latA - latB;
        return (b.relevanceScore || 0) - (a.relevanceScore || 0);
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
  }, [langFilteredVideos, selectedYear, selectedArea, sortMode, latencies]);

  const handleResetAll = () => {
    selectedSources.clear();
    selectedTypes.clear();
    selectedLangs.clear();
    setSelectedYear('all');
    setSelectedArea('all');
    setSortMode('latency');
  };

  const hasActiveFilters = selectedSources.size > 0 || selectedTypes.size > 0 || selectedLangs.size > 0 || selectedYear !== 'all' || selectedArea !== 'all';

  if (results.length === 0 && !loading) return null;

  return (
    <div className="animate-fade-in w-full text-[#e3e5e7]">
      {/* 搜索结果双栏布局 (B站番剧索引：左海报，右侧纯文字真实筛选) */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* 左侧主体：大图海报网格 (5列) */}
        <main className="flex-1 min-w-0 w-full">
          {/* 顶部纯文字极简排序栏：客观物理指标 */}
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5 text-xs font-semibold">
            <div className="flex items-center gap-7">
              {[
                { id: 'latency', label: '流畅度 (网络延迟最优)', icon: Zap },
                { id: 'relevance', label: '相关度', icon: Target },
                { id: 'date', label: '首播时间', icon: Calendar },
              ].map((s) => {
                const isSelected = sortMode === s.id;
                const IconComp = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSortMode(s.id as SortMode)}
                    className={`flex items-center gap-1.5 cursor-pointer transition-colors ${
                      isSelected ? 'text-[#00aeec] font-bold' : 'text-[#9499a0] hover:text-[#e3e5e7]'
                    }`}
                  >
                    <IconComp size={13} className={isSelected ? 'text-[#00aeec]' : 'text-[#9499a0]'} />
                    <span>{s.label}</span>
                    {isSelected && <span>↓</span>}
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-[#9499a0]">
              共找到 <span className="text-[#00aeec] font-bold">{finalVideos.length}</span> 个匹配结果
            </div>
          </div>

          {/* 视频网格：B站同款5列大图排布 */}
          <VideoGrid
            videos={finalVideos}
            isPremium={isPremium}
            latencies={latencies}
            className="!grid-cols-2 sm:!grid-cols-3 md:!grid-cols-4 lg:!grid-cols-5 xl:!grid-cols-5 2xl:!grid-cols-5 !gap-4"
          />
        </main>

        {/* 右侧：100%基于真实返回字段的多维无边框筛选器 (来源、类型、年份、地区、语言) */}
        <aside className="w-full lg:w-64 shrink-0 space-y-4 text-xs lg:sticky lg:top-24 select-none">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 text-sm font-bold text-[#e3e5e7]">
            <span>多维条件筛选</span>
            {hasActiveFilters && (
              <button
                onClick={handleResetAll}
                className="text-xs text-[#00aeec] hover:underline cursor-pointer"
              >
                重置全部
              </button>
            )}
          </div>

          {/* 1. 真实分类类型 (如 日本动漫/国产剧/动作片) */}
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

          {/* 2. 真实上映年份 */}
          {availableYears.length > 0 && (
            <div className="flex gap-3 items-start">
              <span className="text-[#9499a0] shrink-0 mt-0.5 w-7 text-right">年份</span>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 flex-1">
                <button
                  onClick={() => setSelectedYear('all')}
                  className={`cursor-pointer transition-colors ${
                    selectedYear === 'all' ? 'text-[#00aeec] font-bold' : 'text-[#9499a0] hover:text-[#e3e5e7]'
                  }`}
                >
                  全部
                </button>
                {availableYears.slice(0, 8).map((y) => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    className={`cursor-pointer transition-colors ${
                      selectedYear === y ? 'text-[#00aeec] font-bold' : 'text-[#9499a0] hover:text-[#e3e5e7]'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. 真实产地地区 */}
          {availableAreas.length > 0 && (
            <div className="flex gap-3 items-start">
              <span className="text-[#9499a0] shrink-0 mt-0.5 w-7 text-right">地区</span>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 flex-1">
                <button
                  onClick={() => setSelectedArea('all')}
                  className={`cursor-pointer transition-colors ${
                    selectedArea === 'all' ? 'text-[#00aeec] font-bold' : 'text-[#9499a0] hover:text-[#e3e5e7]'
                  }`}
                >
                  全部
                </button>
                {availableAreas.map((a) => (
                  <button
                    key={a}
                    onClick={() => setSelectedArea(a)}
                    className={`cursor-pointer transition-colors ${
                      selectedArea === a ? 'text-[#00aeec] font-bold' : 'text-[#9499a0] hover:text-[#e3e5e7]'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. 真实配音语言 */}
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

          {/* 5. 真实视频来源 (量子/暴风等) */}
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
        </aside>
      </div>
    </div>
  );
}
