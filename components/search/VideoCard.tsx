'use client';

import { memo } from 'react';
import Link from 'next/link';
import { Video } from '@/lib/types';
import { htmlToText } from '@/lib/utils/html';
import { parseVideoTitle } from '@/lib/utils/video';
import type { ResolutionInfo } from '@/lib/hooks/useResolutionProbe';

interface VideoCardProps {
  video: Video;
  videoUrl: string;
  cardId: string;
  isActive: boolean;
  onCardClick: (e: React.MouseEvent, cardId: string, videoUrl: string) => void;
  isPremium?: boolean;
  latencies?: Record<string, number>;
  resolution?: ResolutionInfo | null;
  isProbing?: boolean;
}

export const VideoCard = memo<VideoCardProps>(({
  video,
  videoUrl,
  cardId,
  onCardClick,
  latencies = {},
  resolution,
}) => {
  const displayLatency = latencies[video.source] ?? video.latency;
  const displayRemarks = htmlToText(video.vod_remarks);
  const { cleanTitle } = parseVideoTitle(video.vod_name);

  // 解析清晰度标签
  const resText = resolution?.label || (
    /(2160|4k|uhd|8k)/i.test(`${video.vod_name} ${video.vod_remarks}`) ? '4K' :
    /(1080|fhd|蓝光|bd)/i.test(`${video.vod_name} ${video.vod_remarks}`) ? '1080P' :
    /(720|hd)/i.test(`${video.vod_name} ${video.vod_remarks}`) ? '720P' : ''
  );

  return (
    <Link
      key={cardId}
      href={videoUrl}
      onClick={(e) => onCardClick(e, cardId, videoUrl)}
      className="group flex flex-col cursor-pointer transition-transform duration-200 hover:-translate-y-1 block w-full"
    >
      {/* 纯净海报区域 (完全无外框Card，无白边，纯粹无框B站海报风格) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-[#1f2022] shadow-sm group-hover:shadow-lg transition-all">
        <img
          src={video.vod_pic || '/placeholder-poster.svg'}
          alt={video.vod_name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/placeholder-poster.svg';
          }}
        />

        {/* 右上角来源/清晰度角标 (如 B站大会员风格角标) */}

        {/* 底部渐变半透明文字条 (显示 话数/备注 + Ping速度) */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-6 pb-1.5 px-2 flex items-center justify-between text-[11px] text-white/90">
          <span className="truncate font-medium">{displayRemarks || '正片'}</span>
          {displayLatency !== undefined && (
            <span className={`text-[10px] font-bold shrink-0 ml-1 ${
              displayLatency < 500 ? 'text-emerald-400' : displayLatency < 1000 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {displayLatency}ms
            </span>
          )}
        </div>
      </div>

      {/* 海报下方文字：B站两行极简排版，无框留白 */}
      <div className="mt-2 space-y-0.5 px-0.5">
        <h4 className="text-xs sm:text-sm font-medium text-[#e3e5e7] truncate group-hover:text-pink-400 transition-colors" title={cleanTitle}>
          {cleanTitle}
        </h4>
        <div className="flex items-center gap-1.5 text-[11px] text-[#9499a0] truncate">
          <span>{video.sourceName || video.source}</span>
          {video.vod_year && <span>· {video.vod_year}</span>}
          {video.type_name && <span>· {video.type_name}</span>}
        </div>
      </div>
    </Link>
  );
});

VideoCard.displayName = 'VideoCard';
