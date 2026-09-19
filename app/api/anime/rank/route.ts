import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'all';
  const year = searchParams.get('year') || '';
  const page = searchParams.get('page') || '1';

  // 映射细分标签到豆瓣与动漫检索关键词
  let tag = '动漫';
  if (category === 'japan') tag = '日本动画';
  else if (category === 'china') tag = '国产动画';
  else if (category === 'us') tag = '欧美动画';
  else if (category === 'movie') tag = '动画';

  const type = category === 'movie' ? 'movie' : 'tv';
  const pageLimit = 20;
  const pageStart = (parseInt(page) - 1) * pageLimit;

  try {
    const url = `https://movie.douban.com/j/search_subjects?type=${type}&tag=${encodeURIComponent(tag)}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://movie.douban.com/',
      },
      next: { revalidate: 3600 },
    });

    if (resp.ok) {
      const data = await resp.json();
      let subjects = data.subjects || [];

      // 若指定了年份，进行年份过滤
      if (year && year !== 'all') {
        subjects = subjects.filter((s: { title?: string }) => s.title?.includes(year));
      }

      const formatted = subjects.map((s: { id: string; title: string; cover: string; rate: string }) => ({
        id: s.id,
        title: s.title,
        cover: s.cover ? `/api/douban/image?url=${encodeURIComponent(s.cover)}` : '/placeholder-poster.svg',
        rate: s.rate || '8.5',
      }));

      return NextResponse.json({ subjects: formatted });
    }

    return NextResponse.json({ subjects: [] });
  } catch (err) {
    return NextResponse.json({ subjects: [], error: String(err) }, { status: 500 });
  }
}
