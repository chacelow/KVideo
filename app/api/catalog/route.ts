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

// 主力权威番剧库 (量子极速源，拥有4281部日韩动漫，2048部国产动漫，标准绝对时序)
const MASTER_PROVIDER = {
  api: 'https://cj.lziapi.com/api.php/provide/vod/at/json/',
  typeMap: {
    japan: 30, // 日韩动漫 (4281部, 215页)
    china: 29, // 国产动漫 (2048部, 103页)
    us: 31,    // 欧美动漫 (1000+部)
  } as Record<string, number>,
};

// 题材标签同义词词典
const TAG_SYNONYMS: Record<string, string[]> = {
  '热血': ['热血', '动作', '战斗', '武侠', '竞技'],
  '奇幻': ['奇幻', '魔幻', '玄幻', '神魔', '修真'],
  '冒险': ['冒险', '异世界', '探索'],
  '科幻': ['科幻', '机战', '机甲', '末世', '未来'],
  '战斗': ['战斗', '动作', '格斗', '武侠'],
  '搞笑': ['搞笑', '喜剧', '幽默'],
  '恋爱': ['恋爱', '爱情', '少女', '校园'],
  '悬疑': ['悬疑', '推理', '恐怖', '惊悚', '犯罪'],
  '日常': ['日常', '治愈', '生活', '萌系'],
  '穿越': ['穿越', '转生', '异世界'],
};

function matchesTag(vodClass: string, tag: string): boolean {
  if (!tag || tag === 'all') return true;
  if (!vodClass) return false;
  const synonyms = TAG_SYNONYMS[tag] || [tag];
  return synonyms.some((syn) => vodClass.includes(syn));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const area = searchParams.get('area') || 'all'; // all | japan | china | us
  const tag = searchParams.get('tag') || 'all';   // 热血 | 奇幻 | 冒险 | 科幻...
  const year = searchParams.get('year') || 'all'; // 2026 | 2025...
  const status = searchParams.get('status') || 'all'; // ongoing | finished
  const sort = searchParams.get('sort') || 'score'; // score | time
  const page = parseInt(searchParams.get('page') || '1', 10);

  const typeId =
    area === 'china'
      ? MASTER_PROVIDER.typeMap.china
      : area === 'us'
      ? MASTER_PROVIDER.typeMap.us
      : MASTER_PROVIDER.typeMap.japan;

  try {
    // 严格按当前页单向请求，绝不跨页预取，彻底杜绝换页重复！
    const targetUrl = `${MASTER_PROVIDER.api}?ac=detail&t=${typeId}&pg=${page}`;
    const res = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error(`Provider returned ${res.status}`);
    const data = await res.json();

    const rawList = data.list || [];
    const total = data.total || 0;
    const pagecount = data.pagecount || 1;

    // 格式化输出为纯净动漫条目
    let items = rawList
      .filter((item: any) => {
        // 安全锁：排除非动漫内容
        const tName = item.type_name || '';
        const vClass = item.vod_class || '';
        return tName.includes('动') || tName.includes('漫') || vClass.includes('动画');
      })
      .map((item: any) => ({
        id: item.vod_id,
        title: item.vod_name?.trim(),
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
        area: item.vod_area,
        remarks: item.vod_remarks,
        rate: item.vod_score || '8.8',
        source: 'lzi',
        sourceName: '量子极速',
      }));

    // 题材筛选
    if (tag !== 'all') {
      items = items.filter((it: any) => matchesTag(it.vod_class, tag));
    }

    // 年份过滤
    if (year !== 'all') {
      items = items.filter((it: any) => it.year === year);
    }

    // 状态过滤
    if (status === 'ongoing') {
      items = items.filter((it: any) => it.remarks && !it.remarks.includes('完结') && !it.remarks.includes('全'));
    } else if (status === 'finished') {
      items = items.filter((it: any) => it.remarks && (it.remarks.includes('完结') || it.remarks.includes('全')));
    }

    // 排序逻辑 (评分优先 vs 更新时间优先)
    if (sort === 'score') {
      items.sort((a: any, b: any) => (parseFloat(b.rate) || 0) - (parseFloat(a.rate) || 0));
    } else {
      items.sort((a: any, b: any) => (parseInt(b.year || '0') || 0) - (parseInt(a.year || '0') || 0));
    }

    return NextResponse.json({
      success: true,
      page,
      total,
      pagecount,
      items,
    }, { headers: CORS_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { success: false, items: [], total: 0, pagecount: 1 },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
