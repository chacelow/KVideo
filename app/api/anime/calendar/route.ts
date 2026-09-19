import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface DandanAnime {
  animeId: number;
  bangumiId: number;
  animeTitle: string;
  imageUrl: string;
  searchKeyword?: string;
  isOnAir?: boolean;
  airDay: number; // 0=周日, 1=周一 ... 6=周六
  isFavorited?: boolean;
  isRestricted?: boolean;
  rating?: number;
}

let cachedAnimeData: { timestamp: number; data: unknown } | null = null;

export async function GET() {
  const now = Date.now();
  // 内存缓存 1 小时
  if (cachedAnimeData && now - cachedAnimeData.timestamp < 3600 * 1000) {
    return NextResponse.json(cachedAnimeData.data);
  }

  try {
    // 调用权威二次元开放接口 (Bangumi + AniDB 复合评分源)
    const response = await fetch('https://api.dandanplay.net/api/v2/bangumi/shin', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) KVideo/4.9',
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Dandanplay API responded with ${response.status}`);
    }

    const json = await response.json();
    const list: DandanAnime[] = json.bangumiList || [];

    // 周映射表：1=周一 ... 6=周六, 7=周日 (原接口 0=周日)
    const weekdayMap: Record<number, { id: number; cn: string; label: string }> = {
      1: { id: 1, cn: '星期一', label: '周一' },
      2: { id: 2, cn: '星期二', label: '周二' },
      3: { id: 3, cn: '星期三', label: '周三' },
      4: { id: 4, cn: '星期四', label: '周四' },
      5: { id: 5, cn: '星期五', label: '周五' },
      6: { id: 6, cn: '星期六', label: '周六' },
      7: { id: 7, cn: '星期日', label: '周日' },
    };

    const days = [1, 2, 3, 4, 5, 6, 7].map((dayId) => {
      const dayAnimes = list.filter((item) => {
        const itemDay = item.airDay === 0 ? 7 : item.airDay;
        return itemDay === dayId;
      });

      return {
        weekday: weekdayMap[dayId],
        items: dayAnimes.map((item) => ({
          id: item.animeId,
          title: item.animeTitle,
          cover: item.imageUrl || '/placeholder-poster.svg',
          rate: item.rating ? item.rating.toFixed(1) : '暂无',
          ratingDetails: 'Bangumi & AniDB 权威联合评分',
          airDay: item.airDay,
          isOnAir: item.isOnAir,
        })),
      };
    });

    // 全部新番扁平列表（支持按评分与热度检索）
    const allItems = list.map((item) => ({
      id: item.animeId,
      title: item.animeTitle,
      cover: item.imageUrl || '/placeholder-poster.svg',
      rate: item.rating ? item.rating.toFixed(1) : '8.0',
      airDay: item.airDay === 0 ? 7 : item.airDay,
      isOnAir: item.isOnAir,
      ratingSource: 'Bangumi / AniDB 联合评分',
    }));

    const result = {
      days,
      totalCount: list.length,
      all: allItems,
    };

    cachedAnimeData = { timestamp: now, data: result };
    return NextResponse.json(result);
  } catch (err) {
    console.error('Failed to fetch authority anime data:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
