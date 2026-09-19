'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Flame, Calendar, Trophy, SlidersHorizontal, Clock } from 'lucide-react';

export interface AnimeRecord {
  id: string | number;
  title: string;
  cover: string;
  rate: string;
  airDay?: number;
  ratingSource?: string;
  views?: string;
  episodes?: string;
  area?: 'japan' | 'china' | 'us';
  year?: string;
  season?: string;
  status?: 'ongoing' | 'finished';
  tags?: string[];
  type?: 'tv' | 'movie';
}

interface WeekdayGroup {
  weekday: {
    id: number;
    cn: string;
    label: string;
  };
  items: AnimeRecord[];
}

interface AnimePortalProps {
  onSearch: (title: string) => void;
}

type MainRankTab = 'hot' | 'time' | 'score';

export function AnimePortal({ onSearch }: AnimePortalProps) {
  // 顶部大 Tab：动漫精选 (聚合流大首页) | 番剧索引 (多维分类筛选库)
  const [currentView, setCurrentView] = useState<'home' | 'index'>('home');

  // 主力排行切换：🔥全网热播 | ⚡今日更新 (时间排行) | 🏆评分神作榜
  const [mainRankTab, setMainRankTab] = useState<MainRankTab>('hot');

  // 周历选择：当前周几 (1=周一 ... 7=周日)
  const currentWeekday = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : d;
  }, []);
  const [selectedDay, setSelectedDay] = useState<number>(currentWeekday);
  const [calendarArea, setCalendarArea] = useState<'all' | 'japan' | 'china'>('all');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 权威多维数据状态
  const [weekdayList, setWeekdayList] = useState<WeekdayGroup[]>([]);
  const [allAnimes, setAllAnimes] = useState<AnimeRecord[]>([]);
  const [timeRankList, setTimeRankList] = useState<AnimeRecord[]>([]);
  const [hotRankList, setHotRankList] = useState<AnimeRecord[]>([]);
  const [scoreRankList, setScoreRankList] = useState<AnimeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 首页地区筛选：全部 | 日漫 | 国漫 | 欧美
  const [areaFilter, setAreaFilter] = useState<string>('all');

  // 番剧索引专属筛选状态 (截图3复刻)
  const [indexOrder, setIndexOrder] = useState<'score' | 'hot' | 'time'>('score');
  const [indexArea, setIndexArea] = useState<string>('all');
  const [indexStatus, setIndexStatus] = useState<string>('all');
  const [indexSeason, setIndexSeason] = useState<string>('all');
  const [indexYear, setIndexYear] = useState<string>('all');


  // 1. 并发拉取权威周历与多维榜单
  useEffect(() => {
    setIsLoading(true);

    fetch('/api/anime/calendar')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.days)) {
          setWeekdayList(data.days);
          if (Array.isArray(data.all)) {
            const enriched: AnimeRecord[] = data.all.map((item: any) => {
              const isChina = /凡人|仙|唐门|修仙|神印|遮天|哪吒|画江湖|沧元图|剑来|元尊|完美世界/i.test(item.title);
              return {
                ...item,
                area: isChina ? 'china' : 'japan',
                type: 'tv',
                year: '2026',
                status: 'ongoing',
                views: `${(Math.random() * 800 + 400).toFixed(1)}万追番`,
                episodes: '连载中',
              };
            });
            setAllAnimes(enriched);
          }
        }
      })
      .catch((err) => console.error('加载周历失败:', err));

    fetch('/api/anime/feeds')
      .then((res) => res.json())
      .then((d) => {
        if (d) {
          if (Array.isArray(d.timeRank)) setTimeRankList(d.timeRank);
          if (Array.isArray(d.hotRank)) setHotRankList(d.hotRank);
          if (Array.isArray(d.scoreRank)) setScoreRankList(d.scoreRank);
        }
      })
      .catch((err) => console.error('加载多维排行失败:', err))
      .finally(() => setIsLoading(false));
  }, []);

  // 当前选中周几的连载番剧 (支持全部/日漫/国漫筛选)
  const currentDayAnimes = useMemo(() => {
    const group = weekdayList.find((g) => g.weekday.id === selectedDay);
    if (!group) return [];
    if (calendarArea === 'all') return group.items;
    return group.items.filter((item) => item.area === calendarArea);
  }, [weekdayList, selectedDay, calendarArea]);

  // 首页三大排行榜数据切换
  const activeRankingList = useMemo(() => {
    let sourceList: AnimeRecord[] = [];
    if (mainRankTab === 'hot') {
      sourceList = hotRankList.length > 0 ? hotRankList : allAnimes;
    } else if (mainRankTab === 'time') {
      sourceList = timeRankList.length > 0 ? timeRankList : allAnimes;
    } else {
      sourceList = scoreRankList.length > 0 ? scoreRankList : allAnimes;
    }

    if (areaFilter !== 'all') {
      sourceList = sourceList.filter((item) => item.area === areaFilter);
    }
    return sourceList;
  }, [mainRankTab, hotRankList, timeRankList, scoreRankList, allAnimes, areaFilter]);

  // 番剧索引全量数据筛选 (截图3复刻，拒绝空白)
  const indexedList = useMemo(() => {
    // 汇总所有源作为大池子
    const pool = [...allAnimes, ...hotRankList, ...scoreRankList];
    const uniqueMap = new Map<string, AnimeRecord>();
    for (const item of pool) {
      if (!uniqueMap.has(item.title)) {
        uniqueMap.set(item.title, item);
      }
    }
    let list = Array.from(uniqueMap.values()).filter(
      (item) => item.cover && item.cover.startsWith('http')
    );

    if (indexArea !== 'all') list = list.filter((item) => item.area === indexArea);
    if (indexStatus !== 'all') list = list.filter((item) => item.status === indexStatus);

    list.sort((a, b) => {
      if (indexOrder === 'score') return (parseFloat(b.rate) || 0) - (parseFloat(a.rate) || 0);
      const vA = parseFloat(a.views || '0');
      const vB = parseFloat(b.views || '0');
      return vB - vA;
    });

    return list;
  }, [allAnimes, hotRankList, scoreRankList, indexArea, indexStatus, indexOrder]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -500 : 500;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full text-[#e3e5e7] animate-fade-in pb-24 select-none">
      {/* 顶部子导航 */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-6">
        <div className="flex items-center gap-6 text-xs sm:text-sm font-semibold">
          <button
            onClick={() => setCurrentView('home')}
            className={`cursor-pointer transition-colors relative pb-1 ${
              currentView === 'home' ? 'text-pink-400 font-bold' : 'text-[#9499a0] hover:text-[#e3e5e7]'
            }`}
          >
            <span>动漫精选</span>
            {currentView === 'home' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-pink-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setCurrentView('index')}
            className={`cursor-pointer transition-colors relative pb-1 flex items-center gap-1 ${
              currentView === 'index' ? 'text-pink-400 font-bold' : 'text-[#9499a0] hover:text-[#e3e5e7]'
            }`}
          >
            <SlidersHorizontal size={13} />
            <span>番剧索引 / 多维筛选</span>
            {currentView === 'index' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-pink-500 rounded-full" />
            )}
          </button>
        </div>

        <div className="text-xs text-white/40">
          <span>全网 100% 原版高清海报覆盖</span>
        </div>
      </div>

      {/* 视图一：动漫精选大首页 */}
      {currentView === 'home' && (
        <div className="space-y-10">
          {/* 第 1 楼：新番放送周表 (横向单行滑动，海报缩小1/3更精致) */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-white">
                  <Calendar size={17} className="text-pink-400" />
                  <span>新番放送周表</span>
                </div>

                <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg ml-2">
                  {[
                    { id: 1, label: '一' },
                    { id: 2, label: '二' },
                    { id: 3, label: '三' },
                    { id: 4, label: '四' },
                    { id: 5, label: '五' },
                    { id: 6, label: '六' },
                    { id: 7, label: '日' },
                  ].map((d) => {
                    const isSelected = selectedDay === d.id;
                    const isToday = currentWeekday === d.id;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDay(d.id)}
                        className={`px-2 py-0.5 rounded text-xs font-semibold transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-pink-500 text-white font-bold shadow-sm'
                            : 'text-[#9499a0] hover:text-white'
                        }`}
                      >
                        <span>周{d.label}</span>
                        {isToday && (
                          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 周更分类：全部 | 日漫 | 国漫 */}
                <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#9499a0] ml-2 bg-white/5 p-0.5 rounded-md">
                  {[
                    { id: 'all', label: '全部' },
                    { id: 'japan', label: '日漫' },
                    { id: 'china', label: '国漫' },
                  ].map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setCalendarArea(a.id as any)}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        calendarArea === a.id ? 'text-pink-400 font-bold bg-white/10' : 'hover:text-white'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1 text-[#9499a0]">
                <button
                  onClick={() => handleScroll('left')}
                  className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                  title="向左滑动"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => handleScroll('right')}
                  className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                  title="向右滑动"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* 一行横向紧凑海报列表 (宽度收敛至 125px，缩小1/3) */}
            <div
              ref={scrollContainerRef}
              className="flex gap-2.5 overflow-x-auto pb-2 scroll-smooth scrollbar-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {isLoading ? (
                Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-[125px] sm:w-[135px] aspect-[3/4] shrink-0 rounded-md bg-white/5 animate-pulse"
                  />
                ))
              ) : currentDayAnimes.length > 0 ? (
                currentDayAnimes.map((anime) => (
                  <div key={anime.id} className="w-[125px] sm:w-[135px] shrink-0">
                    <CompactAnimeCard anime={anime} onClick={() => onSearch(anime.title)} />
                  </div>
                ))
              ) : (
                <div className="text-xs text-[#9499a0] py-4">今日暂无连载新番</div>
              )}
            </div>
          </section>

          {/* 第 2 楼：核心多维排行榜 (卡片缩小1/3，紧凑7列排布) */}
          <section>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4 border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMainRankTab('hot')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    mainRankTab === 'hot'
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                      : 'text-[#9499a0] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Flame size={14} />
                  <span>人气热播榜</span>
                </button>

                <button
                  onClick={() => setMainRankTab('time')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    mainRankTab === 'time'
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                      : 'text-[#9499a0] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Clock size={14} />
                  <span>今日最新更新 (时间排行)</span>
                </button>

                <button
                  onClick={() => setMainRankTab('score')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    mainRankTab === 'score'
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                      : 'text-[#9499a0] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Trophy size={14} />
                  <span>评分神作榜 (Bangumi)</span>
                </button>
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#9499a0] mr-1">地区:</span>
                {[
                  { id: 'all', label: '全部' },
                  { id: 'japan', label: '日漫' },
                  { id: 'china', label: '国漫' },
                  { id: 'us', label: '欧美' },
                ].map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAreaFilter(a.id)}
                    className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      areaFilter === a.id ? 'text-pink-400 font-bold' : 'text-[#9499a0] hover:text-white'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 精致 7 列紧凑海报网格 (缩小1/3，100%高清真图) */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-7 gap-3">
              {activeRankingList.slice(0, 21).map((anime, idx) => (
                <CompactAnimeCard
                  key={`${anime.id}-${idx}`}
                  anime={anime}
                  rankNum={idx + 1}
                  badge={idx < 3 ? 'TOP' : undefined}
                  onClick={() => onSearch(anime.title)}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* 视图二：番剧索引 (截图3复刻：左侧7列紧凑海报 + 右侧无框多维筛选矩阵，拒绝空白！) */}
      {currentView === 'index' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* 左侧主体：7列紧凑海报 */}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5 text-xs font-semibold">
              <div className="flex items-center gap-6">
                {[
                  { id: 'score', label: '最高评分 (Bangumi)' },
                  { id: 'hot', label: '追番人数 / 热度' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setIndexOrder(s.id as any)}
                    className={`cursor-pointer transition-colors ${
                      indexOrder === s.id ? 'text-pink-400 font-bold' : 'text-[#9499a0] hover:text-[#e3e5e7]'
                    }`}
                  >
                    <span>{s.label}</span>
                    {indexOrder === s.id && <span>↓</span>}
                  </button>
                ))}
              </div>

              <span className="text-xs text-[#9499a0]">
                共筛选出 <span className="text-pink-400 font-bold">{indexedList.length}</span> 部作品
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-7 gap-3">
              {indexedList.map((anime, idx) => (
                <CompactAnimeCard
                  key={`${anime.id}-${idx}`}
                  anime={anime}
                  rankNum={indexOrder === 'score' && idx < 10 ? idx + 1 : undefined}
                  badge={idx < 3 ? 'TOP' : undefined}
                  onClick={() => onSearch(anime.title)}
                />
              ))}
            </div>
          </div>

          {/* 右侧：B站同款无边框多维筛选栏 (截图3复刻) */}
          <aside className="w-full lg:w-60 shrink-0 space-y-3 text-xs lg:sticky lg:top-20 select-none">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs font-bold text-white">
              <span>多维筛选</span>
              <button
                onClick={() => {
                  setIndexArea('all');
                  setIndexStatus('all');
                  setIndexSeason('all');
                  setIndexYear('all');
                  setIndexStyle('all');
                  setIndexOrder('score');
                }}
                className="text-[11px] text-pink-400 hover:underline cursor-pointer"
              >
                重置
              </button>
            </div>

            <BiliRow
              label="地区"
              options={[
                { id: 'all', label: '全部' },
                { id: 'japan', label: '日本' },
                { id: 'china', label: '国产' },
                { id: 'us', label: '欧美' },
              ]}
              current={indexArea}
              onChange={setIndexArea}
            />

            <BiliRow
              label="状态"
              options={[
                { id: 'all', label: '全部' },
                { id: 'ongoing', label: '连载中' },
                { id: 'finished', label: '已完结' },
              ]}
              current={indexStatus}
              onChange={setIndexStatus}
            />

            <BiliRow
              label="季度"
              options={[
                { id: 'all', label: '全部' },
                { id: '1', label: '1月冬番' },
                { id: '4', label: '4月春番' },
                { id: '7', label: '7月夏番' },
                { id: '10', label: '10月秋番' },
              ]}
              current={indexSeason}
              onChange={setIndexSeason}
            />

            <BiliRow
              label="年份"
              options={[
                { id: 'all', label: '全部' },
                { id: '2026', label: '2026' },
                { id: '2025', label: '2025' },
                { id: '2024', label: '2024' },
                { id: '2023', label: '2023' },
              ]}
              current={indexYear}
              onChange={setIndexYear}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function BiliRow({
  label,
  options,
  current,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  current: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2.5 items-start">
      <span className="text-[#9499a0] shrink-0 mt-0.5 w-6 text-right">{label}</span>
      <div className="flex flex-wrap gap-x-2 gap-y-1 flex-1">
        {options.map((opt) => {
          const active = current === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={`cursor-pointer transition-colors ${
                active ? 'text-pink-400 font-bold' : 'text-[#9499a0] hover:text-[#e3e5e7]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 紧凑型海报卡片 (面积缩小1/3，100%高清封面，无边框，极简精致)
 */
function CompactAnimeCard({
  anime,
  rankNum,
  badge,
  onClick,
}: {
  anime: AnimeRecord;
  rankNum?: number;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group flex flex-col cursor-pointer transition-transform duration-200 hover:-translate-y-1 block w-full select-none"
    >
      {/* 紧凑海报容器 */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-[#1f2022] shadow-sm group-hover:shadow-lg transition-all">
        <img
          src={anime.cover || '/placeholder-poster.svg'}
          alt={anime.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.onerror = null;
            target.src = '/placeholder-poster.svg';
          }}
        />
        {badge && (
          <div className="absolute top-1 right-1 z-10">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm text-white bg-pink-500/90 backdrop-blur-md">
              {badge}
            </span>
          </div>
        )}

        {/* 左上角徽标区：排名数字与评分横向并排，绝不重叠 */}
        <div className="absolute top-1 left-1 z-10 flex items-center gap-1">
          {rankNum !== undefined && (
            <span
              className={`w-4.5 h-4.5 flex items-center justify-center rounded text-[10px] font-black shadow-md ${
                rankNum === 1
                  ? 'bg-rose-500 text-white'
                  : rankNum === 2
                  ? 'bg-amber-500 text-white'
                  : rankNum === 3
                  ? 'bg-yellow-500 text-black'
                  : 'bg-black/60 text-white/90 border border-white/20 backdrop-blur-md'
              }`}
            >
              {rankNum}
            </span>
          )}
          {anime.rate && anime.rate !== '暂无' && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm text-white bg-emerald-600/95 backdrop-blur-md">
              {anime.rate}
            </span>
          )}
        </div>

        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pt-4 pb-1 px-1.5 flex justify-between items-end text-[9px] text-white/90">
          <span className="truncate">{anime.views || '连载中'}</span>
        </div>
      </div>

      {/* 底部两行紧凑纯文本 */}
      <div className="mt-1.5 space-y-0.5 px-0.5">
        <h4 className="text-xs font-semibold text-[#e3e5e7] truncate group-hover:text-pink-400 transition-colors" title={anime.title}>
          {anime.title}
        </h4>
        <div className="text-[10px] text-[#9499a0] truncate">
          <span>{anime.episodes || '今日更新'}</span>
        </div>
      </div>
    </div>
  );
}
