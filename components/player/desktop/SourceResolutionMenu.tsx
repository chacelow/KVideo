'use client';

import { useState, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Sparkles, Check, Zap } from 'lucide-react';
import type { VideoResolutionInfo } from '../hooks/useVideoResolution';

export interface SourceItem {
  id: string | number;
  source: string;
  sourceName?: string;
  latency?: number;
  remarks?: string;
}

interface SourceResolutionMenuProps {
  currentSource?: string;
  videoResolution?: VideoResolutionInfo | null;
  sources?: SourceItem[];
  latencies?: Record<string, number>;
  onSelectSource?: (source: SourceItem) => void;
}

export function SourceResolutionMenu({
  currentSource,
  videoResolution,
  sources = [],
  latencies = {},
  onSelectSource,
}: SourceResolutionMenuProps) {
  // 解析某个源的分辨率 (4k / 1080p / 720p)
  const getSourceResolution = (s: SourceItem): '4k' | '1080p' | '720p' => {
    const text = `${s.remarks || ''} ${s.sourceName || ''}`.toLowerCase();
    if (/(2160|4k|uhd)/i.test(text)) return '4k';
    if (/(1080|fhd|蓝光)/i.test(text)) return '1080p';
    return '720p';
  };

  // 根据当前播放的源确定当前选中的分辨率分类
  const initialRes = useMemo<'4k' | '1080p' | '720p'>(() => {
    if (videoResolution?.label === '4K') return '4k';
    if (videoResolution?.label === '1080P') return '1080p';
    const cur = sources.find((s) => s.source === currentSource);
    return cur ? getSourceResolution(cur) : '1080p';
  }, [videoResolution, sources, currentSource]);

  const [activeRes, setActiveRes] = useState<'4k' | '1080p' | '720p'>(initialRes);

  // 当前清晰度标签 (展示在底栏按钮上)
  const currentLabel = videoResolution?.label || (activeRes === '4k' ? '4K' : activeRes === '1080p' ? '1080P' : '720P');

  // 当前分辨率分类下的所有可用源
  const availableSourcesInRes = useMemo(() => {
    const matched = sources.filter((s) => getSourceResolution(s) === activeRes);
    // 默认按 Ping 延迟从低到高排序
    return matched.sort((a, b) => {
      const latA = latencies[a.source] ?? a.latency ?? 99999;
      const latB = latencies[b.source] ?? b.latency ?? 99999;
      return latA - latB;
    });
  }, [sources, activeRes, latencies]);

  // 点击清晰度仅用于在面板内筛选查看对应线路，绝不擅自自动切源打断播放
  const handleResolutionClick = (res: '4k' | '1080p' | '720p') => {
    setActiveRes(res);
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        {/* 底部按钮：纯文字清晰度显示，无边框外轮廓 */}
        <button
          type="button"
          className="btn-icon shrink-0 px-1 text-xs font-bold text-white/90 hover:text-pink-400 transition-colors cursor-pointer outline-none select-none flex items-center gap-1"
          title="切换画质与选择播放源"
        >
          <span className="text-pink-400 font-extrabold">{currentLabel}</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal container={typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) || undefined : undefined}>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={12}
          className="z-[9999] w-72 max-h-84 overflow-y-auto bg-[#1a1b1e]/95 backdrop-blur-2xl border border-white/10 rounded-xl p-3 shadow-2xl animate-in fade-in-0 zoom-in-95 text-xs text-white select-none space-y-3"
        >
          {/* 1. 分辨率选择：点击不仅过滤，更自动秒切该分辨率下 Ping 最优的源！ */}
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10">
              <span className="flex items-center gap-1.5 font-bold text-xs">
                <Sparkles size={13} className="text-pink-400" />
                <span>清晰度 (点击自动优选最佳源)</span>
              </span>
            </div>

            <div className="flex gap-1.5 bg-white/5 p-1 rounded-lg">
              {[
                { id: '4k', label: '4K 超清' },
                { id: '1080p', label: '1080P 蓝光' },
                { id: '720p', label: '720P 高清' },
              ].map((tab) => {
                const isActive = activeRes === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleResolutionClick(tab.id as any)}
                    className={`flex-1 py-1.5 rounded-md text-center text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-pink-500 text-white font-bold shadow-md shadow-pink-500/30'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 手动选源区域：在当前分辨率下，列出所有可用线路，想换哪个随心点 */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] text-white/50">
              <span>备选线路 (按延迟排序)</span>
              <span>点击手动切换</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
              {availableSourcesInRes.length > 0 ? (
                availableSourcesInRes.map((item, idx) => {
                  const isSelected = item.source === currentSource;
                  const ping = latencies[item.source] ?? item.latency;

                  return (
                    <Popover.Close asChild key={`${item.source}-${item.id}`}>
                      <button
                        onClick={() => onSelectSource?.(item)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all cursor-pointer text-left ${
                          isSelected
                            ? 'bg-pink-500 text-white font-bold shadow-sm'
                            : 'bg-white/[0.05] hover:bg-white/[0.1] text-white/80 hover:text-white'
                        }`}
                        title={item.sourceName || item.source}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {idx === 0 && !isSelected && (
                            <span className="text-[9px] font-black px-1 rounded bg-emerald-500/30 text-emerald-300">
                              优选
                            </span>
                          )}
                          <span className="text-xs truncate">{item.sourceName || item.source}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 text-[10px]">
                          {ping !== undefined && (
                            <span
                              className={`flex items-center gap-0.5 font-bold ${
                                isSelected
                                  ? 'text-white/90'
                                  : ping < 500
                                  ? 'text-emerald-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              <Zap size={9} />
                              <span>{ping}ms</span>
                            </span>
                          )}
                          {isSelected && <Check size={11} className="text-white shrink-0" />}
                        </div>
                      </button>
                    </Popover.Close>
                  );
                })
              ) : (
                <div className="col-span-2 text-center py-3 text-white/40 text-[11px]">
                  该清晰度下暂无其他线路
                </div>
              )}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
