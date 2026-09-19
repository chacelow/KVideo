import React from 'react';
import { Icons } from '@/components/ui/Icon';

import { DesktopMoreMenu } from './DesktopMoreMenu';
import { DesktopSpeedMenu } from './DesktopSpeedMenu';

interface DesktopOverlayProps {
    isLoading: boolean;
    isTransitioningToNextEpisode?: boolean;
    isPlaying: boolean;
    showSkipForwardIndicator: boolean;
    showSkipBackwardIndicator: boolean;
    skipForwardAmount: number;
    skipBackwardAmount: number;
    isSkipForwardAnimatingOut: boolean;
    isSkipBackwardAnimatingOut: boolean;
    showToast: boolean;
    toastMessage: string | null;
    showControls: boolean;
    isFullscreen: boolean;
    fullscreenClock: string;
    onTogglePlay: () => void;
    onSkipForward: () => void;
    onSkipBackward: () => void;
    showMoreMenu: boolean;
    isPremium?: boolean;
    isProxied: boolean;
    onToggleMoreMenu: () => void;
    onMoreMenuMouseEnter: () => void;
    onMoreMenuMouseLeave: () => void;
    onCopyLink: (type?: 'original' | 'proxy') => void;
    seekStepSeconds: number;
    // Speed Menu Props
    playbackRate: number;
    showSpeedMenu: boolean;
    speeds: number[];
    onToggleSpeedMenu: () => void;
    onSpeedChange: (speed: number) => void;
    onSpeedMenuMouseEnter: () => void;
    onSpeedMenuMouseLeave: () => void;
    webFullscreenSize: 'full' | 'large' | 'focused';
    onCycleWebFullscreenSize: () => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
    isRotated?: boolean;
    videoTitle?: string;
    episodeName?: string;
}

export function DesktopOverlay({
    isLoading,
    isTransitioningToNextEpisode = false,
    isPlaying,
    showSkipForwardIndicator,
    showSkipBackwardIndicator,
    skipForwardAmount,
    skipBackwardAmount,
    isSkipForwardAnimatingOut,
    isSkipBackwardAnimatingOut,
    showToast,
    toastMessage,
    isFullscreen,
    fullscreenClock,
    onTogglePlay,
    onSkipForward,
    onSkipBackward,
    showControls,
    showMoreMenu,
    isPremium = false,
    isProxied,
    onToggleMoreMenu,
    onMoreMenuMouseEnter,
    onMoreMenuMouseLeave,
    onCopyLink,
    seekStepSeconds,
    playbackRate,
    showSpeedMenu,
    speeds,
    onToggleSpeedMenu,
    onSpeedChange,
    onSpeedMenuMouseEnter,
    onSpeedMenuMouseLeave,
    webFullscreenSize,
    onCycleWebFullscreenSize,
    containerRef,
    isRotated = false,
    videoTitle = '',
    episodeName = '',
}: DesktopOverlayProps) {
    // Show navigation buttons when controls are visible or when paused (controls usually show when paused anyway)
    const showNavButtons = showControls || !isPlaying;
    const showFullscreenClock = showControls || !isPlaying;

    return (
        <>
            {/* 播放器内部无边框顶层Header：随鼠标移动同步浮现 */}
            <div
                className={`absolute top-0 inset-x-0 z-40 bg-gradient-to-b from-black/85 via-black/40 to-transparent pt-3.5 pb-8 px-4 sm:px-6 flex items-center justify-between pointer-events-none transition-all duration-300 ${
                    showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                }`}
            >
                <div className="flex items-center gap-3 text-white min-w-0">
                    <span className="text-sm sm:text-base font-bold truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {videoTitle || '正在播放'}
                    </span>
                    {episodeName && (
                        <span className="text-xs font-semibold text-pink-400 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 shrink-0 drop-shadow">
                            {episodeName}
                        </span>
                    )}
                </div>

                {isFullscreen && fullscreenClock && (
                    <div className="flex items-center gap-1.5 text-white/80 text-xs font-medium tabular-nums drop-shadow">
                        <Icons.Clock size={13} />
                        <span>{fullscreenClock}</span>
                    </div>
                )}
            </div>


            {/* 极轻量无感 Loading (彻底去除大黑框和'正在播放下一集'大字弹窗) */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="w-10 h-10 border-3 border-pink-500/40 border-t-pink-500 rounded-full animate-spin"></div>
                </div>
            )}

            {/* Skip Backward Indicator (Animation) */}
            {showSkipBackwardIndicator && (
                <div className="absolute top-1/2 left-24 -translate-y-1/2 pointer-events-none transition-all duration-300 z-20">
                    <div className={`text-white text-3xl font-bold drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] ${isSkipBackwardAnimatingOut ? 'animate-scale-out' : 'animate-scale-in'
                        }`}>
                        -{skipBackwardAmount}秒
                    </div>
                </div>
            )}

            {/* Skip Forward Indicator (Animation) */}
            {showSkipForwardIndicator && (
                <div className="absolute top-1/2 right-24 -translate-y-1/2 pointer-events-none transition-all duration-300 z-20">
                    <div className={`text-white text-3xl font-bold drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] ${isSkipForwardAnimatingOut ? 'animate-scale-out' : 'animate-scale-in'
                        }`}>
                        +{skipForwardAmount}秒
                    </div>
                </div>
            )}


            {/* Center Play Button (when paused) */}
            {!isPlaying && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <button
                        onClick={onTogglePlay}
                        className="pointer-events-auto w-12 h-12 md:w-20 md:h-20 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
                        aria-label="播放"
                    >
                        <Icons.Play className="w-6 h-6 md:w-10 md:h-10 text-white ml-1" />
                    </button>
                </div>
            )}

            {/* Toast Notification */}
            {showToast && toastMessage && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
                    <div className="bg-[rgba(28,28,30,0.95)] backdrop-blur-[25px] rounded-[var(--radius-2xl)] border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.6)] px-6 py-3 flex items-center gap-3 min-w-[200px]">
                        <Icons.Check size={18} className="text-[#34c759] flex-shrink-0" />
                        <span className="text-white text-sm font-medium">{toastMessage}</span>
                    </div>
                </div>
            )}
        </>
    );
}
