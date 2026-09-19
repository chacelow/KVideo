import React from 'react';
import { DesktopProgressBar } from './DesktopProgressBar';
import { DesktopLeftControls } from './DesktopLeftControls';
import { DesktopRightControls } from './DesktopRightControls';
import type { VideoResolutionInfo } from '../hooks/useVideoResolution';
import type { SourceItem } from './SourceResolutionMenu';
import type { UseDanmakuReturn } from '../hooks/useDanmaku';
interface DesktopControlsProps {
    showControls: boolean;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    bufferedTime: number;
    volume: number;
    isMuted: boolean;
    isFullscreen: boolean;
    isNativeFullscreen: boolean;
    isWebFullscreen: boolean;


    showVolumeBar: boolean;
    isPiPSupported: boolean;
    isAirPlaySupported: boolean;
    isCastAvailable: boolean;
    isProxied?: boolean;
    progressBarRef: React.RefObject<HTMLDivElement | null>;
    volumeBarRef: React.RefObject<HTMLDivElement | null>;
    onTogglePlay: () => void;
    onToggleMute: () => void;
    onVolumeChange: (e: React.MouseEvent<HTMLDivElement>) => void;
    onVolumeMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    onToggleFullscreen: () => void;
    onToggleNativeFullscreen: () => void;
    onToggleWebFullscreen: () => void;
    onTogglePictureInPicture: () => void;
    onShowAirPlayMenu: () => void;
    onShowCastMenu: () => void;
    onProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    onProgressMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    onProgressTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
    formatTime: (seconds: number) => string;
    videoResolution?: VideoResolutionInfo | null;
    currentSource?: string;
    sources?: SourceItem[];
    latencies?: Record<string, number>;
    totalEpisodes?: number;
    currentEpisode?: number;
    onSelectSource?: (source: SourceItem) => void;
    onEpisodeClick?: (index: number) => void;
    isPremium?: boolean;
    isProxied?: boolean;
    onCopyLink?: (type?: 'original' | 'proxy') => void;
    danmaku?: UseDanmakuReturn;
    onToggleDanmakuSidebar?: () => void;
    isDanmakuSidebarOpen?: boolean;
}

export function DesktopControls(props: DesktopControlsProps) {
    const {
        showControls,
        currentTime,
        duration,
        bufferedTime,
        progressBarRef,
        onProgressClick,
        onProgressMouseDown,
        onProgressTouchStart,
        formatTime = (s: number) => {
            if (!s || isNaN(s)) return '00:00';
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        },
    } = props;

    return (
        <div
            className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                }`}
            style={{
                pointerEvents: showControls ? 'auto' : 'none',
                visibility: showControls ? 'visible' : 'hidden',
            }}
        >
            {/* Progress Bar */}
            <DesktopProgressBar
                progressBarRef={progressBarRef}
                currentTime={currentTime}
                duration={duration}
                bufferedTime={bufferedTime}
                onProgressClick={onProgressClick}
                onProgressMouseDown={onProgressMouseDown}
                onProgressTouchStart={onProgressTouchStart}
            />

            {/* Controls Bar */}
            <div className="player-controls-bar bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pb-4 pt-2">
                <div className="player-controls-row flex min-w-0 items-center justify-between gap-4">
                    <DesktopLeftControls {...props} formatTime={formatTime} />
                    <DesktopRightControls {...props} />
                </div>
            </div>
        </div>
    );
}
