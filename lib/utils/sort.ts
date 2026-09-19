/**
 * Sort utility functions for search results
 */

import type { SortOption } from '@/lib/store/settings-store';
import type { Video } from '@/lib/types';

function getQualityWeight(video: Video): number {
  const quality = 'quality' in video && typeof (video as Record<string, unknown>).quality === 'string'
    ? String((video as Record<string, unknown>).quality)
    : '';
  const text = `${video.vod_name || ''} ${video.vod_remarks || ''} ${quality}`.toLowerCase();
  if (/(4320p|8k)/i.test(text)) return 8000;
  if (/(2160p|4k|uhd)/i.test(text)) return 4000;
  if (/(1440p|2k|qhd)/i.test(text)) return 2000;
  if (/(1080p|1080i|fhd|蓝光|bd|remux)/i.test(text)) return 1080;
  if (/(720p|hd)/i.test(text)) return 720;
  if (/(tc|ts|抢先|枪版|预告)/i.test(text)) return -500;
  return 480;
}

export function sortVideos(videos: Video[], sortBy: SortOption): Video[] {
  const sorted = [...videos];

  switch (sortBy) {
    case 'relevance':
      // Sort by relevance score (highest first)
      return sorted.sort((a, b) => {
        const scoreA = (a as any).relevanceScore || 0;
        const scoreB = (b as any).relevanceScore || 0;
        return scoreB - scoreA;
      });

    case 'latency-asc':
      // Sort by latency (lowest first)
      return sorted.sort((a, b) => {
        const latencyA = a.latency || 99999;
        const latencyB = b.latency || 99999;
        return latencyA - latencyB;
      });

    case 'date-desc':
      // Sort by year (newest first)
      return sorted.sort((a, b) => {
        const yearA = parseInt(a.vod_year || '0');
        const yearB = parseInt(b.vod_year || '0');
        return yearB - yearA;
      });

    case 'date-asc':
      // Sort by year (oldest first)
      return sorted.sort((a, b) => {
        const yearA = parseInt(a.vod_year || '0');
        const yearB = parseInt(b.vod_year || '0');
        return yearA - yearB;
      });

    case 'rating-desc':
      // Sort by rating if available (placeholder for future implementation)
      return sorted.sort((a, b) => {
        const ratingA = (a as any).vod_score || 0;
        const ratingB = (b as any).vod_score || 0;
        return ratingB - ratingA;
      });

    case 'name-asc':
      // Sort by name A-Z
      return sorted.sort((a, b) => {
        return a.vod_name.localeCompare(b.vod_name, 'zh-CN');
      });

    case 'name-desc':
      // Sort by name Z-A
      return sorted.sort((a, b) => {
        return b.vod_name.localeCompare(a.vod_name, 'zh-CN');
      });

    case 'default':
    default:
      // Default: 1. 相关度优先 -> 2. 清晰度(4K/1080P/蓝光)优先 -> 3. 网络延迟Ping优先
      return sorted.sort((a, b) => {
        const scoreA = (a as any).relevanceScore || 0;
        const scoreB = (b as any).relevanceScore || 0;

        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }

        const qualA = getQualityWeight(a);
        const qualB = getQualityWeight(b);
        if (qualA !== qualB) {
          return qualB - qualA;
        }

        const latencyA = a.latency || 99999;
        const latencyB = b.latency || 99999;
        return latencyA - latencyB;
      });
  }
}
