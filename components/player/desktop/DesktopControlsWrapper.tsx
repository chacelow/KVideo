import React from 'react';
import { DesktopControls } from './DesktopControls';
import { useDesktopPlayerState } from '../hooks/useDesktopPlayerState';
import { useDesktopPlayerLogic } from '../hooks/useDesktopPlayerLogic';
import type { VideoResolutionInfo } from '../hooks/useVideoResolution';
import type { SourceItem } from './SourceResolutionMenu';

interface DesktopControlsWrapperProps {
    src: string;
    data: ReturnType<typeof useDesktopPlayerState>['data'];
    logic: ReturnType<typeof useDesktopPlayerLogic>;
    refs: ReturnType<typeof useDesktopPlayerState>['refs'];
    videoResolution?: VideoResolutionInfo | null;
    totalEpisodes?: number;
    currentEpisode?: number;
    currentSource?: string;
    sources?: SourceItem[];
    onSelectSource?: (source: SourceItem) => void;
    onEpisodeClick?: (index: number) => void;
}

export function DesktopControlsWrapper({
    src,
    data,
    logic,
    refs,
    videoResolution,
    totalEpisodes,
    currentEpisode,
    currentSource,
    sources,
    onSelectSource,
    onEpisodeClick
}: DesktopControlsWrapperProps) {

    const {
        isPlaying,
        currentTime,
        duration,
        bufferedTime,
        volume,
        isMuted,
        isFullscreen,
        fullscreenMode,
        showControls,
        showVolumeBar,
        isPiPSupported,
        isAirPlaySupported,
        isCastAvailable,
    } = data;

    const {
        togglePlay,
        toggleMute,
        handleVolumeChange,
        handleVolumeMouseDown,
        toggleFullscreen,
        toggleNativeFullscreen,
        toggleWindowFullscreen,
        togglePictureInPicture,
        showAirPlayMenu,
        showCastMenu,
        handleProgressClick,
        handleProgressMouseDown,
        handleProgressTouchStart,
        formatTime,
    } = logic;

    const {
        progressBarRef,
        volumeBarRef,
    } = refs;

    const isProxied = src.includes('/api/proxy');

    return (
        <DesktopControls
            showControls={showControls}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            bufferedTime={bufferedTime}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            isNativeFullscreen={fullscreenMode === 'native'}
            isWebFullscreen={fullscreenMode === 'window'}
            showVolumeBar={showVolumeBar}
            isPiPSupported={isPiPSupported}
            isAirPlaySupported={isAirPlaySupported}
            isCastAvailable={isCastAvailable}
            isProxied={isProxied}
            progressBarRef={progressBarRef}
            volumeBarRef={volumeBarRef}
            onTogglePlay={togglePlay}
            onToggleMute={toggleMute}
            onVolumeChange={handleVolumeChange}
            onVolumeMouseDown={handleVolumeMouseDown}
            onToggleFullscreen={toggleFullscreen}
            onToggleNativeFullscreen={toggleNativeFullscreen}
            onToggleWebFullscreen={toggleWindowFullscreen}
            onTogglePictureInPicture={togglePictureInPicture}
            onShowAirPlayMenu={showAirPlayMenu}
            onShowCastMenu={showCastMenu}
            videoResolution={videoResolution}
            totalEpisodes={totalEpisodes}
            currentEpisode={currentEpisode}
            currentSource={currentSource}
            sources={sources}
            onSelectSource={onSelectSource}
            onEpisodeClick={onEpisodeClick}
            playbackRate={data.playbackRate}
            onSpeedChange={logic.changePlaybackSpeed}
            onProgressClick={handleProgressClick}
            onProgressMouseDown={handleProgressMouseDown}
            onProgressTouchStart={handleProgressTouchStart}
            onCopyLink={logic.handleCopyLink}
            formatTime={formatTime}
        />
    );
}
