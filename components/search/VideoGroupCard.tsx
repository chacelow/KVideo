'use client';

import { memo, useMemo } from 'react';
import Link from 'next/link';
import { Video } from '@/lib/types';
import { htmlToText } from '@/lib/utils/html';
import { parseVideoTitle } from '@/lib/utils/video';
import { storeGroupedSources } from '@/lib/utils/grouped-sources-cache';
import type { ResolutionInfo } from '@/lib/hooks/useResolutionProbe';

export interface GroupedVideo {
  representative: Video;
  videos: Video[];
  name: string;
}

interface VideoGroupCardProps {
  group: GroupedVideo;
  cardId: string;
  isActive: boolean;
  onCardClick: (e: React.MouseEvent, cardId: string, videoUrl: string) => void;
  isPremium?: boolean;
  latencies?: Record<string, number>;
  resolution?: ResolutionInfo | null;
  isProbing?: boolean;
}

export const VideoGroupCard = memo<VideoGroupCardProps>(({
  group,
  cardId,
  onCardClick,
  isPremium = false,
  latencies = {},
  resolution,
}) => {
  const { representative, videos } = group;

  const displayRemarks = useMemo(() => {
    const preferred = videos.find((v) => v === representative && v.vod_remarks)
      ?? videos.find((v) => v.vod_remarks);
    return htmlToText(preferred?.vod_remarks);
  }, [representative, videos]);

  // 最低延迟
  const bestLatency = useMemo(() => {
    const currentLatencies = videos
      .map((v) => latencies[v.source] ?? v.latency)
      .filter((l) => l !== undefined) as number[];
    return currentLatencies.length > 0 ? Math.min(...currentLatencies) : undefined;
  }, [videos, latencies]);

  // 生成跳转 URL，将所有聚合源打包入库
  const videoUrl = useMemo(() => {
    const params = new URLSearchParams({
      id: String(representative.vod_id),
      source: representative.source,
      title: representative.vod_name,
    });

    if (videos.length > 1) {
      const groupData = videos.map((v) => ({
        id: v.vod_id,
        source: v.source,
        sourceName: v.sourceName,
        latency: latencies[v.source] ?? v.latency,
        pic: v.vod_pic,
        typeName: v.type_name,
        remarks: v.vod_remarks,
      }));
      const cacheKey = storeGroupedSources(groupData);
      if (cacheKey) {
        params.set('gs', cacheKey);
      }
    }

    if (isPremium) {
      params.set('premium', '1');
    }

    return `/player?${params.toString()}`;
  }, [representative, videos, latencies, isPremium]);

  const { cleanTitle } = parseVideoTitle(representative.vod_name);

  // 聚合画质标签
  const resText = resolution?.label || (
    videos.some((v) => /(2160|4k|uhd)/i.test(`${v.vod_name} ${v.vod_remarks}`)) ? '4K' :
    videos.some((v) => /(1080|fhd|蓝光)/i.test(`${v.vod_name} ${v.vod_remarks}`)) ? '1080P' : '720P'
  );

  return (
    <Link
      key={cardId}
      href={videoUrl}
      onClick={(e) => onCardClick(e, cardId, videoUrl)}
      className="group flex flex-col cursor-pointer transition-transform duration-200 hover:-translate-y-1 block w-full select-none"
    >
      {/* 纯净海报区域 (完全无卡片外框，B站同款紧凑海报) */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-[#1f2022] shadow-sm group-hover:shadow-lg transition-all">
        <img
          src={representative.vod_pic || '/placeholder-poster.svg'}
          alt={representative.vod_name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/placeholder-poster.svg';
          }}
        />

        {/* 右上角：聚合线路与画质双角标 */}
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
          {videos.length > 1 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm text-white bg-blue-600/90 backdrop-blur-md">
              {videos.length}线聚合
            </span>
          )}
          {resText && (
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm text-white ${
              resText === '4K' ? 'bg-amber-500/90' : 'bg-pink-500/90'
            }`}>
              {resText}
            </span>
          )}
        </div>

        {/* 底部半透明阴影条：展示更新集数与最佳延迟 */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pt-6 pb-1.5 px-2 flex items-center justify-between text-[11px] text-white/90">
          <span className="truncate font-medium">{displayRemarks || '正片'}</span>
          {bestLatency !== undefined && (
            <span className={`text-[10px] font-bold shrink-0 ml-1 ${
              bestLatency < 500 ? 'text-emerald-400' : bestLatency < 1000 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {bestLatency}ms
            </span>
          )}
        </div>
      </div>

      {/* 底部两行纯文本信息 */}
      <div className="mt-2 space-y-0.5 px-0.5">
        <h4 className="text-xs sm:text-sm font-medium text-[#e3e5e7] truncate group-hover:text-pink-400 transition-colors" title={cleanTitle}>
          {cleanTitle}
        </h4>
        <div className="flex items-center gap-1.5 text-[11px] text-[#9499a0] truncate">
          <span>{representative.type_name || '动漫'}</span>
          {representative.vod_year && <span>· {representative.vod_year}</span>}
          <span className="text-pink-400 font-semibold">· {videos.length}个源秒切</span>
        </div>
      </div>
    </Link>
  );
});

VideoGroupCard.displayName = 'VideoGroupCard';
