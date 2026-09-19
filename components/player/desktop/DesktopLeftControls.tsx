import React from 'react';
import { Icons } from '@/components/ui/Icon';
import { DesktopVolumeControl } from './DesktopVolumeControl';

interface DesktopLeftControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  showVolumeBar: boolean;
  volumeBarRef: React.RefObject<HTMLDivElement | null>;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (e: React.MouseEvent<HTMLDivElement>) => void;
  onVolumeMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  formatTime: (seconds: number) => string;
  // 快捷上一集与下一集控制
  totalEpisodes?: number;
  currentEpisode?: number;
  onEpisodeClick?: (index: number) => void;
}

export function DesktopLeftControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  showVolumeBar,
  volumeBarRef,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onVolumeMouseDown,
  formatTime,
  totalEpisodes = 0,
  currentEpisode = 0,
  onEpisodeClick,
}: DesktopLeftControlsProps) {
  const hasMultipleEpisodes = totalEpisodes > 1 && onEpisodeClick;
  const canPrev = hasMultipleEpisodes && currentEpisode > 0;
  const canNext = hasMultipleEpisodes && currentEpisode < totalEpisodes - 1;

  return (
    <div className="player-controls-left flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 text-xs select-none">
      {/* 快捷：上一集按钮 */}
      {hasMultipleEpisodes && (
        <button
          type="button"
          onClick={() => canPrev && onEpisodeClick?.(currentEpisode - 1)}
          disabled={!canPrev}
          className={`btn-icon shrink-0 p-1 text-white/80 hover:text-white transition-colors cursor-pointer outline-none ${
            !canPrev ? 'opacity-30 !cursor-not-allowed' : 'hover:text-pink-400'
          }`}
          aria-label="上一集"
          title={canPrev ? `上一集 (第 ${currentEpisode} 话)` : '已是第一集'}
        >
          <Icons.SkipBack size={17} />
        </button>
      )}

      {/* 核心：播放 / 暂停 */}
      <button
        type="button"
        onClick={onTogglePlay}
        className="btn-icon shrink-0 p-1 text-white hover:text-pink-400 transition-colors cursor-pointer outline-none"
        aria-label={isPlaying ? '暂停' : '播放'}
        title={isPlaying ? '暂停 (空格)' : '播放 (空格)'}
      >
        {isPlaying ? <Icons.Pause size={20} /> : <Icons.Play size={20} />}
      </button>

      {/* 快捷：下一集按钮 */}
      {hasMultipleEpisodes && (
        <button
          type="button"
          onClick={() => canNext && onEpisodeClick?.(currentEpisode + 1)}
          disabled={!canNext}
          className={`btn-icon shrink-0 p-1 text-white/80 hover:text-white transition-colors cursor-pointer outline-none ${
            !canNext ? 'opacity-30 !cursor-not-allowed' : 'hover:text-pink-400'
          }`}
          aria-label="下一集"
          title={canNext ? `下一集 (第 ${currentEpisode + 2} 话)` : '已是最后一集'}
        >
          <Icons.SkipForward size={17} />
        </button>
      )}

      {/* 音量控制 */}
      <div className="player-volume-control shrink-0 ml-1">
        <DesktopVolumeControl
          volumeBarRef={volumeBarRef}
          volume={volume}
          isMuted={isMuted}
          showVolumeBar={showVolumeBar}
          onToggleMute={onToggleMute}
          onVolumeChange={onVolumeChange}
          onVolumeMouseDown={onVolumeMouseDown}
        />
      </div>

      {/* 播放时间与总时长 */}
      <span className="player-time-display min-w-0 truncate text-xs font-medium text-white/90 tabular-nums ml-1">
        <span>{formatTime(currentTime)}</span>
        <span className="player-duration-display opacity-60"> / {formatTime(duration)}</span>
      </span>
    </div>
  );
}
