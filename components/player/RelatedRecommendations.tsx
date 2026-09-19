'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Play } from 'lucide-react';

interface RecommendedVideo {
  id: string | number;
  title: string;
  cover: string;
  type_name: string;
  vod_class: string;
  tags: string[];
  year: string;
  remarks: string;
  rate: string;
  source: string;
}

interface RelatedRecommendationsProps {
  currentTitle: string;
  typeName?: string;
  vodClass?: string;
  isPremium?: boolean;
}

export function RelatedRecommendations({
  currentTitle,
  typeName = '动漫',
  vodClass = '',
  isPremium = false,
}: RelatedRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentTitle) return;
    setIsLoading(true);

    const url = `/api/recommend?title=${encodeURIComponent(currentTitle)}&type=${encodeURIComponent(
      typeName
    )}&class=${encodeURIComponent(vodClass)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.recommendations)) {
          setRecommendations(data.recommendations);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [currentTitle, typeName, vodClass]);

  if (!isLoading && recommendations.length === 0) return null;

  return (
    <section className="w-full space-y-3 pt-2 select-none">
      {/* 标题栏 */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#00aeec]" />
          <h3 className="font-bold text-sm text-white">相关精彩剧目推荐</h3>
          <span className="text-[11px] text-[#9499a0]">
            基于同类型【{typeName}】与题材偏好智能推荐
          </span>
        </div>
      </div>

      {/* 推荐卡片网格流 (5列紧凑大图排布) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-white/5 rounded-lg animate-pulse" />
            ))
          : recommendations.map((item) => (
              <Link
                key={item.id}
                href={`/player?id=${item.id}&source=${item.source || 'lzi'}&title=${encodeURIComponent(item.title)}${isPremium ? '&premium=1' : ''}`}
                className="group cursor-pointer space-y-1.5 transition-transform hover:-translate-y-1 block"
              >
                {/* 海报封面 */}
                <div className="aspect-[3/4] rounded-lg overflow-hidden relative bg-black/40 border border-white/5">
                  <img
                    src={item.cover}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      // 兜底图
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';
                    }}
                  />
                  {/* 最新集数徽章 */}
                  {item.remarks && (
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] text-white/90 font-medium">
                      {item.remarks}
                    </span>
                  )}
                  {/* 年份/评分徽章 */}
                  {item.rate && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#00aeec]/80 backdrop-blur-sm text-[10px] text-white font-bold font-mono">
                      {item.rate}
                    </span>
                  )}
                  {/* Hover 遮罩 */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-[#00aeec] text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                      <Play size={18} fill="currentColor" className="ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* 片名与题材标签 */}
                <div>
                  <div className="font-semibold text-xs text-white truncate group-hover:text-[#00aeec] transition-colors">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-[#9499a0] truncate mt-0.5">
                    {item.tags.length > 0 ? item.tags.join(' · ') : `${item.type_name} · ${item.year || '2025'}`}
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
