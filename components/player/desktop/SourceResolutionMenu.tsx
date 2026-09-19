'use client';

import { useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Zap, Check, Radio } from 'lucide-react';
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
  // 底部按钮：有真实解码尺寸就显示真实尺寸（如 1080P / 720P），否则显示真实线路名，绝不提前虚标 4K
  const displayLabel = videoResolution?.label || '换源';

  // 线路源按真实物理 Ping 延迟从低到高严格排序
  const sortedSources = useMemo(() => {
    return [...sources].sort((a, b) => {
      const latA = latencies[a.source] ?? a.latency ?? 99999;
      const latB = latencies[b.source] ?? b.latency ?? 99999;
      return latA - latB;
    });
  }, [sources, latencies]);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        {/* 触发器：纯粹、真实、不虚标 */}
        <button
          type="button"
          className="btn-icon shrink-0 px-1.5 py-0.5 text-xs font-bold text-white/90 hover:text-pink-400 transition-colors cursor-pointer outline-none select-none flex items-center gap-1 whitespace-nowrap"
          title="点击切换播放线路 (实测延迟排序)"
        >
          <span className="text-pink-400 font-extrabold">{displayLabel}</span>
          {sources.length > 1 && (
            <span className="text-[10px] text-white/40 hidden sm:inline">
              ({sources.length}线)
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal container={typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) || undefined : undefined}>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={12}
          className="z-[9999] w-72 max-h-80 overflow-y-auto bg-[#1a1b1e]/95 backdrop-blur-2xl border border-white/10 rounded-xl p-3 shadow-2xl animate-in fade-in-0 zoom-in-95 text-xs text-white select-none space-y-2.5"
        >
          {/* 面板头部：实事求是 */}
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-xs">
            <span className="flex items-center gap-1.5 font-bold">
              <Radio size={13} className="text-pink-400" />
              <span>可用播放线路 ({sortedSources.length})</span>
            </span>
            <span className="text-[10px] text-white/40">按网络延迟排序</span>
          </div>

          {/* 真实物理像素检测提示 */}
          {videoResolution && (
            <div className="px-2 py-1 rounded bg-white/5 text-[11px] text-white/70 flex items-center justify-between">
              <span>当前物理画面解码:</span>
              <span className="text-emerald-400 font-bold">
                {videoResolution.width}x{videoResolution.height} ({videoResolution.label})
              </span>
            </div>
          )}

          {/* 真实线路列表：横向双列平铺，标明客观真实的 Ping 毫秒 */}
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
            {sortedSources.length > 0 ? (
              sortedSources.map((item, idx) => {
                const isSelected = item.source === currentSource;
                const ping = latencies[item.source] ?? item.latency;

                return (
                  <Popover.Close asChild key={`${item.source}-${item.id}`}>
                    <button
                      onClick={() => onSelectSource?.(item)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-md transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-pink-500 text-white font-bold shadow-sm'
                          : 'bg-white/[0.05] hover:bg-white/[0.1] text-white/80 hover:text-white'
                      }`}
                      title={item.sourceName || item.source}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {idx === 0 && !isSelected && (
                          <span className="text-[9px] font-black px-1 rounded bg-emerald-500/30 text-emerald-300">
                            最快
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
              <div className="col-span-2 text-center py-4 text-white/40 text-[11px]">
                暂无其他备选线路
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
