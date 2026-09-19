'use client';

import { useState, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Sparkles, Check, Settings, Sliders } from 'lucide-react';
import type { VideoResolutionInfo } from '../hooks/useVideoResolution';

export interface SourceItem {
  id: string | number;
  source: string;
  sourceName?: string;
  latency?: number;
  remarks?: string;
}

interface PlayerControlHubProps {
  // 画质与源相关
  currentSource?: string;
  videoResolution?: VideoResolutionInfo | null;
  sources?: SourceItem[];
  latencies?: Record<string, number>;
  onSelectSource?: (source: SourceItem) => void;

  // 选集相关
  totalEpisodes?: number;
  currentEpisode?: number;
  onEpisodeClick?: (index: number) => void;

  // 倍速相关
  playbackRate: number;
  onSpeedChange: (speed: number) => void;

  // 播放设置相关
  adFilter?: boolean;
  onToggleAdFilter?: (enabled: boolean) => void;
  autoSkipIntro?: boolean;
  onToggleSkipIntro?: (enabled: boolean) => void;
}

export function PlayerControlHub({
  currentSource,
  videoResolution,
  sources = [],
  latencies = {},
  onSelectSource,
  totalEpisodes = 0,
  currentEpisode = 0,
  onEpisodeClick,
  playbackRate = 1.0,
  onSpeedChange,
  adFilter = true,
  onToggleAdFilter,
  autoSkipIntro = false,
  onToggleSkipIntro,
}: PlayerControlHubProps) {
  // 模式：auto = 自动优选 (默认), manual = 手动锁定
  const [routeMode, setRouteMode] = useState<'auto' | 'manual'>('auto');

  // 分辨率筛选：all | 4k | 1080p | 720p
  const [resFilter, setResFilter] = useState<'all' | '4k' | '1080p' | '720p'>('all');

  const currentLabel = videoResolution?.label || '1080P';
  const currentSourceItem = sources.find((s) => s.source === currentSource);
  const currentSourceName = currentSourceItem?.sourceName || currentSource || '优选线路';

  // 解析某个源的分辨率
  const getSourceResolution = (s: SourceItem): '4k' | '1080p' | '720p' => {
    const text = `${s.remarks || ''} ${s.sourceName || ''}`.toLowerCase();
    if (/(2160|4k|uhd)/i.test(text)) return '4k';
    if (/(1080|fhd|蓝光)/i.test(text)) return '1080p';
    return '720p';
  };

  // 过滤后的源列表
  const filteredSources = useMemo(() => {
    if (resFilter === 'all') return sources;
    return sources.filter((s) => getSourceResolution(s) === resFilter);
  }, [sources, resFilter]);

  // 最佳优选源（延迟最低的高清源）
  const bestAutoSource = useMemo(() => {
    if (!sources.length) return null;
    const sorted = [...sources].sort((a, b) => {
      const latA = latencies[a.source] ?? a.latency ?? 99999;
      const latB = latencies[b.source] ?? b.latency ?? 99999;
      return latA - latB;
    });
    return sorted[0];
  }, [sources, latencies]);

  const handleSetAutoMode = () => {
    setRouteMode('auto');
    if (bestAutoSource && bestAutoSource.source !== currentSource && onSelectSource) {
      onSelectSource(bestAutoSource);
    }
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs select-none">
      {/* 1. 复合画质与线路中枢 (默认自动优选，支持手动自选与分辨率过滤) */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="btn-icon shrink-0 px-2 text-xs font-bold text-white/90 hover:text-pink-400 transition-colors cursor-pointer outline-none flex items-center gap-1"
            title="点击切换画质与播放源 (默认自动优选)"
          >
            <span className="text-pink-400 font-extrabold">{currentLabel}</span>
            <span className="text-[10px] font-normal opacity-60">
              {routeMode === 'auto' ? '优选' : currentSourceName}
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="top"
            align="end"
            sideOffset={12}
            className="z-[9999] w-80 max-h-84 overflow-y-auto bg-[#1a1b1e]/95 backdrop-blur-2xl border border-white/10 rounded-xl p-3.5 shadow-2xl animate-in fade-in-0 zoom-in-95 text-xs text-white"
          >
            {/* 顶栏：自动优选 vs 手动选源 */}
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <Sparkles size={14} className="text-pink-400" />
                <span>画质与线路</span>
              </div>

              <div className="flex bg-white/5 p-0.5 rounded-md text-[11px]">
                <button
                  onClick={handleSetAutoMode}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    routeMode === 'auto'
                      ? 'bg-pink-500 text-white font-bold shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  ⚡ 智能优选
                </button>
                <button
                  onClick={() => setRouteMode('manual')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    routeMode === 'manual'
                      ? 'bg-pink-500 text-white font-bold shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  🛠️ 手动选源
                </button>
              </div>
            </div>

            {/* 自动优选状态说明 */}
            {routeMode === 'auto' && (
              <div className="mb-3 p-2 rounded-lg bg-pink-500/10 border border-pink-500/20 text-[11px] flex items-center justify-between">
                <span className="text-pink-400 font-medium">当前已锁定最低延迟优质线路</span>
                <span className="text-white/60">{currentSourceName}</span>
              </div>
            )}

            {/* 清晰度过滤横向药丸 */}
            <div className="flex gap-1 mb-2.5 bg-white/5 p-0.5 rounded-lg text-[11px]">
              {[
                { id: 'all', label: '全部' },
                { id: '4k', label: '4K' },
                { id: '1080p', label: '1080P' },
                { id: '720p', label: '720P' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setResFilter(tab.id as any)}
                  className={`flex-1 py-1 rounded text-center transition-all cursor-pointer ${
                    resFilter === tab.id
                      ? 'bg-pink-500 text-white font-bold shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 线路列表：横向双列平铺 */}
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
              {filteredSources.map((item) => {
                const isSelected = item.source === currentSource;
                const ping = latencies[item.source] ?? item.latency;
                const res = getSourceResolution(item);

                return (
                  <Popover.Close asChild key={`${item.source}-${item.id}`}>
                    <button
                      onClick={() => {
                        setRouteMode('manual');
                        onSelectSource?.(item);
                      }}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-md transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-pink-500 text-white font-bold shadow-sm'
                          : 'bg-white/[0.05] hover:bg-white/[0.1] text-white/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-[9px] font-black px-1 rounded shrink-0 ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : res === '4k'
                              ? 'bg-amber-500/90 text-white'
                              : 'bg-emerald-600/90 text-white'
                          }`}
                        >
                          {res.toUpperCase()}
                        </span>
                        <span className="text-xs truncate">{item.sourceName || item.source}</span>
                      </div>

                      {ping !== undefined && (
                        <span
                          className={`text-[10px] font-bold shrink-0 ml-1 ${
                            isSelected
                              ? 'text-white/90'
                              : ping < 500
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {ping}ms
                        </span>
                      )}
                    </button>
                  </Popover.Close>
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* 2. 播放器内置选集面板 (直接在播放器内部操作) */}
      {totalEpisodes > 1 && (
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="btn-icon shrink-0 px-1 text-xs font-semibold text-white/90 hover:text-pink-400 transition-colors cursor-pointer outline-none"
              title="播放器内置选集"
            >
              <span>选集</span>
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              side="top"
              align="end"
              sideOffset={12}
              className="z-[9999] w-80 max-h-80 overflow-y-auto bg-[#1a1b1e]/95 backdrop-blur-2xl border border-white/10 rounded-xl p-3.5 shadow-2xl animate-in fade-in-0 zoom-in-95 text-xs text-white"
            >
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10 font-bold">
                <span>选集 (共 {totalEpisodes} 话)</span>
                <span className="text-[11px] text-pink-400">正在播放第 {currentEpisode + 1} 话</span>
              </div>

              {/* 集数网格：4列无边框紧凑方块 */}
              <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                {Array.from({ length: totalEpisodes }).map((_, idx) => {
                  const isCur = currentEpisode === idx;
                  return (
                    <Popover.Close asChild key={idx}>
                      <button
                        onClick={() => onEpisodeClick?.(idx)}
                        className={`py-2 rounded-md text-xs font-semibold transition-all cursor-pointer text-center ${
                          isCur
                            ? 'bg-pink-500 text-white font-bold shadow-sm'
                            : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white'
                        }`}
                        title={`第 ${idx + 1} 话`}
                      >
                        {idx + 1}
                      </button>
                    </Popover.Close>
                  );
                })}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}

      {/* 3. 播放器内置倍速选择器 */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="btn-icon shrink-0 px-1 text-xs font-semibold text-white/90 hover:text-pink-400 transition-colors cursor-pointer outline-none"
            title="播放倍速"
          >
            <span>{playbackRate === 1 ? '倍速' : `${playbackRate}x`}</span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="top"
            align="end"
            sideOffset={12}
            className="z-[9999] w-24 bg-[#1a1b1e]/95 backdrop-blur-2xl border border-white/10 rounded-xl p-1 shadow-2xl animate-in fade-in-0 zoom-in-95 text-xs text-white"
          >
            {[2.0, 1.5, 1.25, 1.0, 0.75, 0.5].map((speed) => {
              const isSelected = playbackRate === speed;
              return (
                <Popover.Close asChild key={speed}>
                  <button
                    onClick={() => onSpeedChange(speed)}
                    className={`w-full py-1.5 px-3 rounded-md text-left transition-colors cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-pink-500 text-white font-bold shadow-sm'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>{speed}x</span>
                    {isSelected && <Check size={12} className="text-white" />}
                  </button>
                </Popover.Close>
              );
            })}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* 4. 播放器内置设置 (智能去广告、跳片头片尾等) */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="btn-icon shrink-0 px-1 text-white/90 hover:text-pink-400 transition-colors cursor-pointer outline-none"
            title="播放设置"
          >
            <Settings size={17} />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="top"
            align="end"
            sideOffset={12}
            className="z-[9999] w-64 bg-[#1a1b1e]/95 backdrop-blur-2xl border border-white/10 rounded-xl p-3 shadow-2xl animate-in fade-in-0 zoom-in-95 text-xs text-white space-y-3"
          >
            <div className="flex items-center gap-1.5 font-bold pb-2 border-b border-white/10">
              <Sliders size={13} className="text-pink-400" />
              <span>播放器设置</span>
            </div>

            {/* 智能去广告开关 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium block">智能去切片广告</span>
                <span className="text-[10px] text-white/40">自动跳过视频内插播广告</span>
              </div>
              <button
                onClick={() => onToggleAdFilter?.(!adFilter)}
                className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                  adFilter ? 'bg-pink-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    adFilter ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 自动跳过片头片尾开关 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium block">跳过片头片尾</span>
                <span className="text-[10px] text-white/40">快速直达正片</span>
              </div>
              <button
                onClick={() => onToggleSkipIntro?.(!autoSkipIntro)}
                className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                  autoSkipIntro ? 'bg-pink-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    autoSkipIntro ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
