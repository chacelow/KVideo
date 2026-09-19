'use client';

import { getSourceName } from '@/lib/utils/source-names';
import { htmlToText } from '@/lib/utils/html';
import { Calendar, Globe, Check, Tag } from 'lucide-react';

function splitPersonNames(str: string): string[] {
  return str.split(/[,，/]/).map((s) => s.trim()).filter(Boolean);
}

interface VideoMetadataProps {
  videoData: any;
  source: string | null;
  title?: string | null;
}

export function VideoMetadata({ videoData, source, title }: VideoMetadataProps) {
  const description = htmlToText(videoData?.vod_content);

  return (
    <div className="w-full text-xs text-[#e3e5e7] select-text py-1">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* 海报封面 (无厚卡片外壳，极简轻量圆角) */}
        <div className="w-20 h-28 sm:w-24 sm:h-34 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 border border-white/5">
          {videoData?.vod_pic ? (
            <img
              src={videoData.vod_pic}
              alt={videoData.vod_name || title || ''}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.dataset.fallback === '1') {
                  target.style.display = 'none';
                  return;
                }
                target.dataset.fallback = '1';
                target.src = '/placeholder-poster.svg';
              }}
            />
          ) : (
            <img src="/placeholder-poster.svg" alt="" className="w-full h-full object-cover" />
          )}
        </div>

        {/* 核心信息与简介 (纯文字流排版，极简清晰) */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-white truncate">
              {videoData?.vod_name || title}
            </h1>
            {source && (
              <span className="px-2 py-0.5 rounded bg-[#00aeec]/15 text-[#00aeec] text-[11px] font-semibold flex items-center gap-1">
                <Check size={12} />
                <span>{getSourceName(source)}</span>
              </span>
            )}
            {videoData?.type_name && (
              <span className="px-2 py-0.5 rounded bg-white/5 text-[#9499a0] text-[11px]">
                {videoData.type_name}
              </span>
            )}
            {videoData?.vod_year && (
              <span className="px-2 py-0.5 rounded bg-white/5 text-[#9499a0] text-[11px] flex items-center gap-1 font-mono">
                <Calendar size={11} />
                <span>{videoData.vod_year}</span>
              </span>
            )}
            {videoData?.vod_area && (
              <span className="px-2 py-0.5 rounded bg-white/5 text-[#9499a0] text-[11px] flex items-center gap-1">
                <Globe size={11} />
                <span>{videoData.vod_area}</span>
              </span>
            )}
          </div>

          {/* 演职员表 (紧凑纯文本) */}
          {(videoData?.vod_director || videoData?.vod_actor) && (
            <div className="space-y-1 text-[11px] text-[#9499a0]">
              {videoData?.vod_director && (
                <div className="flex gap-2">
                  <span className="text-white/40 shrink-0">导演:</span>
                  <span className="text-white/80">{splitPersonNames(videoData.vod_director).join(' / ')}</span>
                </div>
              )}
              {videoData?.vod_actor && (
                <div className="flex gap-2">
                  <span className="text-white/40 shrink-0">主演:</span>
                  <span className="text-white/80 line-clamp-1">{splitPersonNames(videoData.vod_actor).join(' / ')}</span>
                </div>
              )}
            </div>
          )}

          {/* 剧情简介 (纯文本自然展开) */}
          {description && (
            <p className="text-[11px] text-[#9499a0] leading-relaxed line-clamp-3 pt-1 border-t border-white/5">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
