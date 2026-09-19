'use client';

import React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Icons } from '@/components/ui/Icon';
import { SourceResolutionMenu, type SourceItem } from './SourceResolutionMenu';
import { Check, MessageSquare } from 'lucide-react';
import { PlayerSettingsMenu } from './PlayerSettingsMenu';
import type { VideoResolutionInfo } from '../hooks/useVideoResolution';
import type { UseDanmakuReturn } from '../hooks/useDanmaku';
import { getPlatformLabel } from '@/lib/utils/danmaku-utils';
interface DesktopRightControlsProps {
  isNativeFullscreen: boolean;
  isWebFullscreen: boolean;
  isPiPSupported: boolean;
  isAirPlaySupported: boolean;
  isCastAvailable: boolean;
  onToggleNativeFullscreen: () => void;
  onToggleWebFullscreen: () => void;
  onTogglePictureInPicture: () => void;
  onShowAirPlayMenu: () => void;
  onShowCastMenu: () => void;
  // 独立的画质与源
  videoResolution?: VideoResolutionInfo | null;
  currentSource?: string;
  sources?: SourceItem[];
  latencies?: Record<string, number>;
  onSelectSource?: (source: SourceItem) => void;
  // 独立的选集
  totalEpisodes?: number;
  currentEpisode?: number;
  onEpisodeClick?: (index: number) => void;
  // 独立的倍速
  playbackRate?: number;
  onSpeedChange?: (speed: number) => void;
  isPremium?: boolean;
  isProxied?: boolean;
  onCopyLink?: (type?: 'original' | 'proxy') => void;
  // 弹幕系统控制
  danmaku?: UseDanmakuReturn;
  duration?: number;
  onToggleDanmakuSidebar?: () => void;
  isDanmakuSidebarOpen?: boolean;
}

export function DesktopRightControls({
  isNativeFullscreen,
  isWebFullscreen,
  isPiPSupported,
  isAirPlaySupported,
  isCastAvailable,
  onToggleNativeFullscreen,
  onToggleWebFullscreen,
  onTogglePictureInPicture,
  onShowAirPlayMenu,
  onShowCastMenu,
  videoResolution,
  currentSource,
  sources = [],
  latencies = {},
  onSelectSource,
  totalEpisodes = 0,
  currentEpisode = 0,
  onEpisodeClick,
  playbackRate = 1.0,
  onSpeedChange = () => {},
  isPremium = false,
  isProxied = false,
  onCopyLink,
  danmaku,
  duration = 0,
  onToggleDanmakuSidebar,
  isDanmakuSidebarOpen = false,
}: DesktopRightControlsProps) {
  return (
    <div className="player-controls-right relative z-50 flex shrink-0 items-center gap-2 sm:gap-3 text-xs select-none">
      {/* 0. 弹幕系统侧边栏控制入口 */}
      {/* 0. 弹幕系统控制入口 */}
      {danmaku && (
        <button
          type="button"
          onClick={onToggleDanmakuSidebar}
          className={`btn-icon shrink-0 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap transition-all cursor-pointer outline-none flex items-center gap-1 ${
            isDanmakuSidebarOpen
              ? 'text-pink-400 font-bold'
              : danmaku.danmakuEnabled
              ? 'text-pink-400/90 hover:text-pink-300'
              : 'text-white/60 hover:text-white'
          }`}
          title="弹幕设置与列表"
        >
          <MessageSquare size={14} className={isDanmakuSidebarOpen || danmaku.danmakuEnabled ? 'text-pink-400' : 'text-white/60'} />
          <span className="whitespace-nowrap">弹幕</span>
        </button>
      )}
      {/* 1. 独立组件：清晰度与源切换 (选清晰度 -> 自动应用最佳源 -> 支持手动切换) */}
      <SourceResolutionMenu
        currentSource={currentSource}
        videoResolution={videoResolution}
        sources={sources}
        latencies={latencies}
        onSelectSource={onSelectSource}
      />

      {/* 2. 独立组件：播放器内置选集面板 (纯粹的内容选集，不与画质混杂) */}
      {totalEpisodes > 1 && (
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="btn-icon shrink-0 px-1.5 py-0.5 text-xs font-semibold text-white/90 hover:text-pink-400 transition-colors cursor-pointer outline-none whitespace-nowrap"
              title="选集"
            >
              <span className="whitespace-nowrap">选集</span>
            </button>
          </Popover.Trigger>

          <Popover.Portal container={typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) || undefined : undefined}>
            <Popover.Content
              side="top"
              align="end"
              sideOffset={12}
              className="z-[9999] w-80 max-h-80 overflow-y-auto bg-[#1a1b1e]/95 backdrop-blur-2xl border border-white/10 rounded-xl p-3.5 shadow-2xl animate-in fade-in-0 zoom-in-95 text-xs text-white"
            >
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10 font-bold">
                <span>选集播放 (共 {totalEpisodes} 话)</span>
                <span className="text-[11px] text-pink-400">当前第 {currentEpisode + 1} 话</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                {Array.from({ length: totalEpisodes }).map((_, idx) => {
                  const isCur = currentEpisode === idx;
                  return (
                    <Popover.Close asChild key={idx}>
                      <button
                        onClick={() => onEpisodeClick?.(idx)}
                        className={`py-2 rounded-md text-xs font-semibold transition-all cursor-pointer text-center ${
                          isCur
                            ? 'bg-pink-500 text-white font-bold shadow-md shadow-pink-500/25'
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

      {/* 3. 独立组件：播放倍速 */}
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

        <Popover.Portal container={typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) || undefined : undefined}>
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

      {/* 4. 独立组件：完整真实的播放器设置 (智能去广告/跳片头片尾秒数/弹幕透明度/复制直链) */}
      <PlayerSettingsMenu
        isPremium={isPremium}
        isProxied={isProxied}
        onCopyLink={onCopyLink}
      />

      {/* 5. 画中画 */}
      {isPiPSupported && (
        <button
          onClick={onTogglePictureInPicture}
          className="btn-icon shrink-0"
          aria-label="画中画"
          title="画中画"
        >
          <Icons.PictureInPicture size={18} />
        </button>
      )}

      {/* 6. 隔空播放 */}
      {isAirPlaySupported && (
        <button
          onClick={onShowAirPlayMenu}
          className="btn-icon shrink-0"
          aria-label="隔空播放"
          title="隔空播放"
        >
          <Icons.Airplay size={18} />
        </button>
      )}

      {/* 7. 投屏 */}
      {isCastAvailable && (
        <button
          onClick={onShowCastMenu}
          className="btn-icon shrink-0"
          aria-label="投屏"
          title="投屏"
        >
          <Icons.Cast size={18} />
        </button>
      )}

      {/* 8. 网页全屏 */}
      <button
        onClick={onToggleWebFullscreen}
        className="btn-icon shrink-0"
        aria-label={isWebFullscreen ? '退出网页全屏' : '网页全屏'}
        title={isWebFullscreen ? '退出网页全屏 (W)' : '网页全屏 (W)'}
      >
        {isWebFullscreen ? (
          <Icons.WebFullscreenExit size={18} className="text-pink-400" />
        ) : (
          <Icons.WebFullscreen size={18} />
        )}
      </button>

      {/* 9. 系统全屏 */}
      <button
        onClick={onToggleNativeFullscreen}
        className="btn-icon shrink-0"
        aria-label={isNativeFullscreen ? '退出系统全屏' : '系统全屏'}
        title={isNativeFullscreen ? '退出系统全屏 (F)' : '系统全屏 (F)'}
      >
        {isNativeFullscreen ? <Icons.Minimize size={18} /> : <Icons.Maximize size={18} />}
      </button>
    </div>
  );
}
