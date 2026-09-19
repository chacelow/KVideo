'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Checkbox } from '@/components/ui/Checkbox';
import { SearchField } from '@/components/ui/SearchField';
import { Button } from '@/components/ui/Button';
import type { UseDanmakuReturn } from '../hooks/useDanmaku';
import { extractPlatform, formatDuration, getPlatformLabel } from '@/lib/utils/danmaku-utils';
export function DanmakuSourcesPanel({ danmaku, currentVideoDuration }: { danmaku: UseDanmakuReturn; currentVideoDuration: number }) {
  const [keyword, setKeyword] = useState(danmaku.searchKeyword);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => setKeyword(danmaku.searchKeyword), [danmaku.searchKeyword]);
  const selected = Object.values(danmaku.activeSourcesMap).filter(s => s.enabled).length;
  return (
<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
        <h3 className="mb-2 font-medium">搜索当前作品</h3>
        <SearchField label="搜索弹幕来源" value={keyword} onChange={setKeyword} onSearch={() => void danmaku.searchDanmakuSources(keyword)} placeholder="输入片名或视频链接" loading={danmaku.isLoading} />
        <h3 className="mt-4 font-medium">来源与当前集</h3>
        <div className="flex flex-wrap items-center gap-2 py-2">
          <span className="mr-auto text-[var(--text-color-secondary)]">已勾选 {selected} / {danmaku.detectedSources.length}</span>
          <Button variant="secondary" className="!min-h-8 !rounded-md !px-2 !py-1 !text-xs !shadow-none !backdrop-blur-none" disabled={!danmaku.detectedSources.length || selected === danmaku.detectedSources.length} onClick={() => void danmaku.selectAllSources()}>全选</Button>
          <Button variant="secondary" className="!min-h-8 !rounded-md !px-2 !py-1 !text-xs !shadow-none !backdrop-blur-none" disabled={selected === 0} onClick={danmaku.unselectAllSources}>取消全选</Button>
          <Button variant="secondary" className="!min-h-8 !rounded-md !px-2 !py-1 !text-xs !shadow-none !backdrop-blur-none" aria-label="刷新弹幕来源" disabled={danmaku.isLoading} onClick={() => void danmaku.refreshSources()}><RefreshCw size={14} className={danmaku.isLoading ? 'animate-spin' : ''} /><span className="ml-1">刷新</span></Button>
        </div>
        {danmaku.detectedSources.map(source => {
          const id = String(source.animeId);
          const item = danmaku.activeSourcesMap[id];
          const status = item?.status;
          const statusText = status === 'loading' ? '获取中…' : status === 'error' ? '获取失败' : status === 'empty' ? '已获取，本集暂无弹幕' : status === 'ready' ? `已加载 ${item.commentCount ?? 0} 条` : '尚未获取';
          return <section className="space-y-1 border-b border-[var(--glass-border)] py-2 last:border-0" key={id}>
            <div className="flex min-h-8 items-center justify-between gap-2">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"><Checkbox aria-label={`使用 ${source.animeTitle}`} checked={Boolean(item?.enabled)} onChange={e => void danmaku.toggleSourceEnabled(source, e.target.checked)} /><span className="min-w-0 truncate" title={source.animeTitle}>{source.animeTitle}</span></label>
              <button type="button" aria-label={`刷新 ${source.animeTitle}`} title="重新获取本集弹幕" disabled={status === 'loading'} onClick={() => void danmaku.refreshSource(source)}><RefreshCw size={13} className={status === 'loading' ? 'animate-spin' : ''} /></button>
            </div>
            <div className="flex items-center justify-between gap-2 pl-7 text-[var(--text-color-secondary)]"><span>{getPlatformLabel(extractPlatform(source.animeTitle))}</span><span role="status">{statusText}</span></div>
            {item?.error && <p role="alert" className="px-2 py-1 text-[var(--text-color-secondary)]">{item.error}</p>}
            <div className="flex min-h-8 items-center justify-between gap-2 pl-7"><span className="min-w-0 truncate text-[var(--text-color-secondary)]" title={item?.episodeTitle}>{item?.episodeTitle || '未关联集数'}</span><button type="button" aria-expanded={expanded === id} onClick={() => setExpanded(expanded === id ? null : id)}>{expanded === id ? '收起' : '调整'}</button></div>
            {expanded === id && <div className="ml-7 space-y-2 border-l border-[var(--glass-border)] pl-2">
              <div className="max-h-40 overflow-y-auto overscroll-contain" aria-label="弹幕对应集数">
                {source.episodes.map(ep => <button className="block h-8 w-full shrink-0 truncate rounded-sm text-left leading-5 hover:bg-[var(--glass-bg)] aria-pressed:bg-[var(--glass-bg)]" type="button" key={ep.episodeId} aria-pressed={String(item?.episodeId) === String(ep.episodeId)} title={ep.episodeTitle} onClick={() => void danmaku.bindSourceEpisode(source, ep)}>{ep.episodeTitle}</button>)}
              </div>
            <label className="flex min-h-8 items-center justify-between gap-2"><span className="text-[var(--text-color-secondary)]">此源偏移（秒）</span><input type="number" step="0.5" aria-label={`${source.animeTitle} 偏移`} value={item?.offset ?? 0} disabled={!item} onChange={e => { if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber)) danmaku.setSourceOffset(source.animeId, e.target.valueAsNumber); }} /></label>
            <p className="text-[var(--text-color-secondary)] tabular-nums">源时长 {item?.videoDuration ? formatDuration(item.videoDuration) : '未提供'} · 当前视频 {currentVideoDuration > 0 ? formatDuration(currentVideoDuration) : '未就绪'}</p>
            </div>}
          </section>;
        })}
        {!danmaku.detectedSources.length && <p className="px-3 py-6 text-center text-[var(--text-color-secondary)]">{danmaku.isLoading ? '正在搜索…' : '未找到来源，可以修改片名后重新搜索。'}</p>}
        <section className="mt-4 space-y-2 border-t border-[var(--glass-border)] pt-3">
          <h3 className="font-medium">时间轴</h3>
          <label className="flex min-h-8 items-center justify-between gap-2"><span>整体偏移（秒）</span><input aria-label="整体弹幕偏移" type="number" step="0.5" value={danmaku.danmakuOffset} onChange={e => { if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber)) danmaku.setDanmakuOffset(e.target.valueAsNumber); }} /></label>
          <label className="flex min-h-8 items-center justify-between gap-2"><span>下一集沿用偏移</span><Checkbox checked={danmaku.followOffset} onChange={e => danmaku.setFollowOffset(e.target.checked)} /></label>
          <p className="text-[var(--text-color-secondary)]">正数延后，负数提前。时长差不等于偏移。</p>
        </section>
      </div>);
}
