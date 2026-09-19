import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

// 严格过滤解说、预告、花絮杂音，只推荐完整正片
function isFullFeatureVideo(name: string): boolean {
  if (!name) return false;
  return !/(?:\[电影解说\]|\[解说\]|解说版|预告片?|花絮|特辑|采访|短片)/i.test(name);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const currentTitle = searchParams.get('title') || '';
  const typeName = searchParams.get('type') || '动漫';
  const rawClass = searchParams.get('class') || '';

  if (!currentTitle) {
    return NextResponse.json({ success: true, recommendations: [] }, { headers: CORS_HEADERS });
  }

  // 1. 提取主标题（例如 "凡人修仙传 慕兰之战" -> "凡人修仙传", "我独自升级 第二季" -> "我独自升级"）
  const cleanTitle = currentTitle.replace(/\[.*?\]|【.*?】|\(.*?\)|（.*?）/g, '').trim();
  const mainTitle = cleanTitle.split(/[ :：\-—_]+/)[0].trim();

  // 2. 提取当前剧的核心题材标签
  const currentTags = new Set(
    rawClass
      .replace(/，/g, ',')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
  );

  const api = 'https://cj.lziapi.com/api.php/provide/vod/at/json/';
  const tid = typeName.includes('国漫') || typeName.includes('国产动') ? 29 : typeName.includes('剧') ? 13 : 30;

  try {
    // 并发发起两路召回：
    // 召回路 A: 同系列 / 同IP 续作与前传 (权重 100 分)
    // 召回路 B: 同分类高契合题材库 (权重 50 + overlap * 10 分)
    const [seriesRes, categoryRes] = await Promise.all([
      fetch(`${api}?ac=detail&wd=${encodeURIComponent(mainTitle)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4500),
        next: { revalidate: 300 },
      }).then((r) => (r.ok ? r.json() : { list: [] })).catch(() => ({ list: [] })),
      fetch(`${api}?ac=detail&t=${tid}&pg=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4500),
        next: { revalidate: 600 },
      }).then((r) => (r.ok ? r.json() : { list: [] })).catch(() => ({ list: [] })),
    ]);

    const seriesList = (seriesRes.list || []).filter((it: any) => isFullFeatureVideo(it.vod_name));
    const categoryList = (categoryRes.list || []).filter((it: any) => isFullFeatureVideo(it.vod_name));

    const scoredMap = new Map<string, { item: any; score: number; reason: string }>();

    // 处理系列续作
    for (const it of seriesList) {
      if (it.vod_name === currentTitle) continue;
      scoredMap.set(it.vod_name, {
        item: it,
        score: 100,
        reason: '同系列/衍生续作',
      });
    }

    // 处理同题材推荐
    for (const it of categoryList) {
      if (it.vod_name === currentTitle || scoredMap.has(it.vod_name)) continue;
      const itTags = (it.vod_class || '')
        .replace(/，/g, ',')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      
      let overlap = 0;
      for (const t of itTags) {
        if (currentTags.has(t)) overlap++;
      }

      scoredMap.set(it.vod_name, {
        item: it,
        score: 50 + overlap * 12,
        reason: overlap > 0 ? `同类高契合题材 (${overlap}标签重叠)` : '热门推荐',
      });
    }

    // 按最终得分排序并取前 10 部
    const recommendations = Array.from(scoredMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ item, reason }) => ({
        id: item.vod_id,
        title: item.vod_name,
        cover: item.vod_pic,
        type_name: item.type_name,
        vod_class: item.vod_class || '',
        tags: (item.vod_class || '')
          .replace(/，/g, ',')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
          .slice(0, 3),
        year: item.vod_year,
        remarks: item.vod_remarks,
        rate: item.vod_score || '8.8',
        reason,
        source: 'lzi',
      }));

    return NextResponse.json({
      success: true,
      recommendations,
    }, { headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { success: false, recommendations: [] },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
