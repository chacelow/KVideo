import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface WeekdayAnime {
  id: string | number;
  title: string;
  cover: string;
  rate: string;
  airDay: number; // 1=周一 ... 7=周日
  area: 'japan' | 'china' | 'us';
  episodes: string;
  views: string;
}

let cachedMasterCalendar: { timestamp: number; data: unknown } | null = null;

export async function GET() {
  const now = Date.now();
  // 内存缓存 30 分钟
  if (cachedMasterCalendar && now - cachedMasterCalendar.timestamp < 1800 * 1000) {
    return NextResponse.json(cachedMasterCalendar.data);
  }

  const weekdayMap: Record<number, { id: number; cn: string; label: string }> = {
    1: { id: 1, cn: '星期一', label: '周一' },
    2: { id: 2, cn: '星期二', label: '周二' },
    3: { id: 3, cn: '星期三', label: '周三' },
    4: { id: 4, cn: '星期四', label: '周四' },
    5: { id: 5, cn: '星期五', label: '周五' },
    6: { id: 6, cn: '星期六', label: '周六' },
    7: { id: 7, cn: '星期日', label: '周日' },
  };

  try {
    // 直接抓取樱花动漫官方追番周表 week.html，确保 100% 图文严格一对一对应
    const resp = await fetch('https://www.yinhuadm.xyz/label/week.html', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) KVideo/4.9' },
      next: { revalidate: 1800 },
    });

    if (resp.ok) {
      const html = await resp.text();
      // 切分出 7 个周几对应的容器 (module-main tab-list)
      const parts = html.split(/<div[^>]+class=["']module-main tab-list/);

      const days = [1, 2, 3, 4, 5, 6, 7].map((dayId) => {
        const cardRegex = /<div[^>]+class=["']module-item-note["']>([^<]+)<\/div>[\s\S]*?<img[^>]+(?:src|data-original)=["']([^"']+)["'][^>]+alt=["']([^"']+)["']/g;
        let m: RegExpExecArray | null;
        const items: WeekdayAnime[] = [];
        const dayHtml = parts[dayId] || '';

        while ((m = cardRegex.exec(dayHtml)) !== null) {
          const note = m[1]?.trim() || '连载中';
          const cover = m[2]?.trim();
          const title = m[3]?.trim();

          if (!cover || !title || !cover.startsWith('http')) continue;

          const isChina = /神|仙|凡人|修仙|遮天|武动|元尊|哪吒|画江湖|沧元图|剑来|斗罗|逆天|万界|独尊|炼气/i.test(title);

          items.push({
            id: `week-${dayId}-${items.length}`,
            title,
            cover,
            rate: '8.8',
            airDay: dayId,
            area: isChina ? 'china' : 'japan',
            episodes: note, // 真实精确的第几集 (例如: 更新至第10集 / 已完结)
            views: note,
          });
        }

        return {
          weekday: weekdayMap[dayId],
          items,
        };
      });

      const allItems = days.flatMap((d) => d.items);

      const result = {
        days,
        totalCount: allItems.length,
        all: allItems,
      };

      cachedMasterCalendar = { timestamp: now, data: result };
      return NextResponse.json(result);
    }
  } catch (err) {
    console.warn('抓取官方追番周表失败，执行备用方案:', err);
  }

  // 备用方案：拉取弹弹play官方绑定库
  try {
    const dRes = await fetch('https://api.dandanplay.net/api/v2/bangumi/shin');
    if (dRes.ok) {
      const json = await dRes.json();
      const list = json.bangumiList || [];
      const days = [1, 2, 3, 4, 5, 6, 7].map((dayId) => {
        const matched = list
          .filter((item: any) => {
            const itemDay = item.airDay === 0 ? 7 : item.airDay;
            return itemDay === dayId && item.imageUrl && item.imageUrl.startsWith('http');
          })
          .map((item: any) => ({
            id: item.animeId,
            title: item.animeTitle,
            cover: item.imageUrl,
            rate: item.rating ? item.rating.toFixed(1) : '8.5',
            airDay: dayId,
            area: 'japan' as const,
            episodes: '连载中',
            views: '今日更新',
          }));

        return {
          weekday: weekdayMap[dayId],
          items: matched,
        };
      });

      const all = days.flatMap((d) => d.items);
      const res = { days, totalCount: all.length, all };
      return NextResponse.json(res);
    }
  } catch {}

  return NextResponse.json({ days: [], totalCount: 0, all: [] });
}
