export interface DanmakuComment {
  text: string;
  time: number; // seconds from video start
  color?: string; // hex color, default white
  type?: 'scroll' | 'top' | 'bottom'; // default 'scroll'
  source?: string; // 来源平台，例如 [youku], [bilibili1], [qiyi], [qq]
}

export interface DanmakuEpisode {
  episodeId: string | number;
  episodeTitle: string;
  url?: string;
}

export interface DanmakuAnimeSource {
  animeId: string | number;
  animeTitle: string;
  type?: string;
  typeDescription?: string;
  episodes: DanmakuEpisode[];
}

export interface DanmakuSourceInfo {
  animeId: string | number;
  animeTitle: string;
  platform?: string; // 例如 youku, bilibili, qiyi, qq 等
  episodeId?: string | number;
  episodeTitle?: string;
  videoDuration?: number; // 源站官方视频长度（秒）
  commentCount?: number; // 弹幕总条数
}
