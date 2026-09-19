import type {
  DanmakuComment,
  DanmakuEpisode,
  DanmakuAnimeSource,
} from '@/lib/types/danmaku';

/**
 * 工业级片名去噪与候选关键词生成器 (彻底杜绝因清晰度/后缀/压制组导致搜空)
 */
export function extractCleanKeywords(rawTitle: string): string[] {
  if (!rawTitle) return [];
  const results: string[] = [];
  const trimmed = rawTitle.trim();
  if (!trimmed) return [];
  results.push(trimmed);

  // 1. 去除常见的清晰度、编码、格式、括号备注与集数标识
  let cleaned = trimmed
    .replace(/\[(?:4k|1080p|720p|2160p|web-dl|hevc|h265|h264|x264|x265|aac|ddp).*?\]/gi, '')
    .replace(/【(?:4k|1080p|720p|2160p|web-dl|hevc|h265|h264|x264|x265|aac|ddp).*?】/gi, '')
    .replace(/\b(?:4k|1080p|720p|2160p|web-dl|hevc|h265|h264|x264|x265)\b/gi, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/(?:第\s*)?\d+\s*[集话話期]/g, '')
    .replace(/\bS\d+E\d+\b/gi, '')
    .replace(/\bEP?\d+\b/gi, '')
    .trim();

  if (cleaned && !results.includes(cleaned)) {
    results.push(cleaned);
  }

  // 2. 核心容错：去除中文末尾称谓后缀 (如 "挣扎吧，亚当君" -> "挣扎吧，亚当")
  const suffixRemoved = cleaned.replace(/[君酱桑氏]|先生|小姐|特别篇|重制版|无修版|先行版$/g, '').trim();
  if (suffixRemoved && !results.includes(suffixRemoved)) {
    results.push(suffixRemoved);
  }

  // 3. 去除逗号与标点 (如 "挣扎吧，亚当" -> "挣扎吧 亚当" 和 "挣扎吧亚当")
  const noPunctuation = cleaned.replace(/[，,。、！？?!:：;；~～\-_+]/g, ' ').replace(/\s+/g, ' ').trim();
  if (noPunctuation && !results.includes(noPunctuation)) {
    results.push(noPunctuation);
  }
  const noSpacePunct = cleaned.replace(/[，,。、！？?!:：;；~～\-_+\s]/g, '').trim();
  if (noSpacePunct && !results.includes(noSpacePunct)) {
    results.push(noSpacePunct);
  }
  const suffixNoPunct = suffixRemoved.replace(/[，,。、！？?!:：;；~～\-_+\s]/g, '').trim();
  if (suffixNoPunct && !results.includes(suffixNoPunct)) {
    results.push(suffixNoPunct);
  }

  // 严格杜绝任何随意截断！坚决不截取前两三个字的短词，确保绝不搜入不相干内容！
  return results;
}

/**
 * 纯通用弹幕源质量评分器 (杜绝复杂的硬编码判断，完全基于标题契合度与集数精准匹配打分)
 */
export function scoreSourceMatch(
  anime: DanmakuAnimeSource,
  videoTitle: string,
  targetEpisodeNum: number | null
): number {
  let score = 0;
  const titleA = (anime.animeTitle || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();
  const titleB = (videoTitle || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();

  // 1. 标题完全相等或主干高度包含: 基础 50 分
  if (titleA.includes(titleB) || titleB.includes(titleA)) {
    score += 50;
  }
  if (titleA.startsWith(titleB)) {
    score += 30; // 核心词前置加 30 分
  }

  // 2. 当前观看集数精准对应: 关键加分 40 分
  if (targetEpisodeNum !== null && anime.episodes && anime.episodes.length > 0) {
    const hasExactEpisode = anime.episodes.some(
      (ep) => extractNumber(ep.episodeTitle) === targetEpisodeNum
    );
    if (hasExactEpisode) {
      score += 40;
    }
  }

  // 3. 弹弹play全量弹幕网络加权 (包含全网聚合与无风控弹幕池，优先呈现)
  if (anime.animeTitle.includes('dandan')) {
    score += 25;
  } else if (anime.animeTitle.includes('bilibili') || anime.animeTitle.includes('tencent')) {
    score += 10;
  }
  return score;
}

/**
 * 格式化秒数为 mm:ss 或 hh:mm:ss
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * 从动漫标题或剧集标题中提取平台标识
 * 比如 "凡人修仙传(2025)【国产剧】from youku" -> "youku"
 * 比如 "【bilibili1】 第22话" -> "bilibili"
 */
export function extractPlatform(title: string): string {
  if (!title) return 'other';
  const lower = title.toLowerCase();
  if (lower.includes('bilibili') || lower.includes('b站') || lower.includes('bili')) return 'bilibili';
  if (lower.includes('youku') || lower.includes('优酷')) return 'youku';
  if (lower.includes('qiyi') || lower.includes('iqiyi') || lower.includes('爱奇艺')) return 'iqiyi';
  if (lower.includes('qq') || lower.includes('tencent') || lower.includes('腾讯')) return 'tencent';
  if (lower.includes('imgo') || lower.includes('mgtv') || lower.includes('芒果')) return 'mgtv';
  if (lower.includes('bahamut') || lower.includes('巴哈姆特') || lower.includes('动画疯')) return 'bahamut';
  if (lower.includes('dandan') || lower.includes('弹弹')) return 'dandan';
  if (lower.includes('renren') || lower.includes('人人')) return 'renren';
  if (lower.includes('hanjutv') || lower.includes('韩剧')) return 'hanjutv';
  if (lower.includes('animeko')) return 'animeko';
  if (lower.includes('aiyifan') || lower.includes('壹帆')) return 'aiyifan';
  if (lower.includes('hongguo') || lower.includes('红果')) return 'hongguo';
  if (lower.includes('sohu') || lower.includes('搜狐')) return 'sohu';
  if (lower.includes('leshi') || lower.includes('乐视')) return 'leshi';
  if (lower.includes('xigua') || lower.includes('西瓜')) return 'xigua';
  if (lower.includes('migu') || lower.includes('咪咕')) return 'migu';
  if (lower.includes('360')) return '360';
  if (lower.includes('douban') || lower.includes('豆瓣')) return 'douban';
  return 'other';
}

/**
 * 平台友好中文名
 */
export function getPlatformLabel(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'bilibili': return '哔哩哔哩 (B站)';
    case 'youku': return '优酷视频';
    case 'iqiyi': return '爱奇艺';
    case 'tencent': return '腾讯视频';
    case 'mgtv': return '芒果TV';
    case 'bahamut': return '巴哈姆特 (动画疯)';
    case 'dandan': return '弹弹play官方';
    case 'renren': return '人人影视';
    case 'hanjutv': return '韩剧TV';
    case 'animeko': return 'Animeko动漫源';
    case 'aiyifan': return '爱壹帆';
    case 'hongguo': return '红果影视';
    case 'sohu': return '搜狐视频';
    case 'leshi': return '乐视视频';
    case 'xigua': return '西瓜视频';
    case 'migu': return '咪咕视频';
    case '360': return '360影视';
    case 'douban': return '豆瓣聚合';
    default: return '第三方源';
  }
}

/**
 * Parse danmu_api response into normalized DanmakuComment[]
 * Handles both /api/v2/comment/{id} format and raw arrays
 */
export function parseDanmakuResponse(data: any): {
  comments: DanmakuComment[];
  videoDuration: number;
  count: number;
} {
  const rawComments = data?.comments || data?.data || (Array.isArray(data) ? data : []);
  const videoDuration = typeof data?.videoDuration === 'number' ? data.videoDuration : 0;
  const count = typeof data?.count === 'number' ? data.count : rawComments.length;

  const comments = rawComments
    .map((c: any) => {
      // danmu_api format: { p: "time,type,color,[source]", m: "text" }
      // or normalized: { time, type, color, text }
      if (c.p && c.m) {
        const parts = c.p.split(',');
        const time = parseFloat(parts[0]) || 0;
        const typeNum = parseInt(parts[1]) || 1;
        const colorNum = parseInt(parts[2]);
        const source = parts[3] ? parts[3].replace(/[\[\]]/g, '') : undefined;
        return {
          text: c.m,
          time,
          type: typeNum === 5 ? 'top' : typeNum === 4 ? 'bottom' : 'scroll',
          color: colorNum ? `#${colorNum.toString(16).padStart(6, '0')}` : undefined,
          source,
        } as DanmakuComment;
      }

      if (typeof c.text === 'string' && typeof c.time === 'number') {
        return {
          text: c.text,
          time: c.time,
          type: c.type || 'scroll',
          color: c.color,
          source: c.source,
        } as DanmakuComment;
      }

      return null;
    })
    .filter((c: DanmakuComment | null): c is DanmakuComment => c !== null)
    .sort((a: DanmakuComment, b: DanmakuComment) => a.time - b.time);

  return {
    comments,
    videoDuration,
    count,
  };
}

/**
 * Parse danmu_api search results into DanmakuAnimeSource[]
 */
export function parseSearchResults(data: any): DanmakuAnimeSource[] {
  const animes = data?.animes || data?.data || (Array.isArray(data) ? data : []);

  return animes.map((a: any) => ({
    animeId: a.animeId ?? a.id ?? '',
    animeTitle: a.animeTitle ?? a.title ?? '',
    type: a.type ?? '',
    typeDescription: a.typeDescription ?? '',
    episodes: (a.episodes || []).map((ep: any) => ({
      episodeId: ep.episodeId ?? ep.id ?? '',
      episodeTitle: ep.episodeTitle ?? ep.title ?? '',
      url: ep.url ?? '',
    })),
  }));
}

// Chinese numeral map
const CHINESE_NUMS: Record<string, number> = {
  '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
  '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
};

export function extractNumber(str: string): number | null {
  const numMatch = str.match(/(?:第\s*)?(\d+)(?:\s*[集话話期])?/);
  if (numMatch) return parseInt(numMatch[1], 10);

  for (const [cn, val] of Object.entries(CHINESE_NUMS)) {
    if (str.includes(`第${cn}集`) || str.includes(`第${cn}话`) || str.includes(`第${cn}話`)) {
      return val;
    }
  }

  const bareNum = str.match(/\b(\d+)\b/);
  if (bareNum) return parseInt(bareNum[1], 10);

  return null;
}

/**
 * Match a local episode name to a danmaku episode list
 */
export function matchEpisode(
  episodes: DanmakuEpisode[],
  episodeName: string,
  episodeIndex?: number
): DanmakuEpisode | null {
  if (!episodes || !episodes.length) return null;

  const targetNum = extractNumber(episodeName);

  if (targetNum !== null) {
    const found = episodes.find((ep) => {
      const epNum = extractNumber(ep.episodeTitle);
      return epNum === targetNum;
    });
    if (found) return found;
  }

  if (episodeIndex !== undefined && episodeIndex >= 0 && episodeIndex < episodes.length) {
    return episodes[episodeIndex];
  }

  return episodes[0] || null;
}

/**
 * Find best title match from search results using string similarity
 */
export function fuzzyMatchTitle(
  results: DanmakuAnimeSource[],
  title: string
): DanmakuAnimeSource | null {
  if (!results || !results.length) return null;

  const cleanTitle = title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();

  let bestMatch: DanmakuAnimeSource | null = null;
  let bestScore = 0;

  for (const item of results) {
    const cleanItem = item.animeTitle.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();

    if (cleanItem === cleanTitle) return item;

    if (cleanItem.includes(cleanTitle) || cleanTitle.includes(cleanItem)) {
      const score = Math.min(cleanItem.length, cleanTitle.length) / Math.max(cleanItem.length, cleanTitle.length);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }
  }

  return bestMatch || results[0];
}
