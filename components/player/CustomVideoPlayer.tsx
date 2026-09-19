'use client';

import { DesktopVideoPlayer } from './DesktopVideoPlayer';
import type { SourceItem } from './desktop/SourceResolutionMenu';
import type { VideoResolutionInfo } from './hooks/useVideoResolution';
import type { UseDanmakuReturn } from './hooks/useDanmaku';

interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  onError?: (error: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  initialTime?: number;
  shouldAutoPlay?: boolean;
  totalEpisodes?: number;
  currentEpisodeIndex?: number;
  onNextEpisode?: () => void;
  isReversed?: boolean;
  videoTitle?: string;
  episodeName?: string;
  isPremium?: boolean;
  onResolutionDetected?: (info: VideoResolutionInfo) => void;
  // 内置选源与选集
  sources?: SourceItem[];
  currentSource?: string;
  onSelectSource?: (source: SourceItem) => void;
  onEpisodeClick?: (index: number) => void;
  // 外部侧边栏弹幕控制器
  danmaku?: UseDanmakuReturn;
  isDanmakuSidebarOpen?: boolean;
  onToggleDanmakuSidebar?: () => void;
}

export function CustomVideoPlayer(props: CustomVideoPlayerProps) {
  return <DesktopVideoPlayer {...props} />;
}
