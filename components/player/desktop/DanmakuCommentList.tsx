'use client';
import { useMemo, useState } from 'react';
import type { UseDanmakuReturn } from '../hooks/useDanmaku';
import { formatDuration } from '@/lib/utils/danmaku-utils';
export function DanmakuCommentList({ danmaku, onSeek }: { danmaku: UseDanmakuReturn; onSeek?: (seconds: number) => void }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return text ? danmaku.comments.filter(c => c.text.toLocaleLowerCase().includes(text)) : danmaku.comments;
  }, [danmaku.comments, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 100));
  const visiblePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(visiblePage * 100, (visiblePage + 1) * 100);
  return <>

        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--glass-border)] px-2 py-1"><input aria-label="搜索弹幕内容" placeholder="搜索弹幕内容" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></div>
        <div className="grid shrink-0 grid-cols-[3.5rem_minmax(0,1fr)_4rem] gap-2 px-3 py-2 text-[var(--text-color-secondary)]"><span>时间</span><span>弹幕内容</span><span>来源</span></div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {rows.map((comment, index) => <div className="grid h-8 grid-cols-[3.5rem_minmax(0,1fr)_4rem] items-center gap-2 px-3 hover:bg-[var(--glass-bg)]" key={`${visiblePage}-${index}`}>
            <button type="button" disabled={!onSeek} title="跳转到此弹幕" onClick={() => onSeek?.(comment.time)}>{formatDuration(comment.time)}</button>
            <span className="min-w-0 truncate" title={comment.text}>{comment.text}</span>
            <span className="text-[var(--text-color-secondary)] min-w-0 truncate" title={comment.source}>{comment.source || '未标注'}</span>
          </div>)}
          {!rows.length && <p className="px-3 py-6 text-center text-[var(--text-color-secondary)]">{danmaku.isLoading ? '正在获取弹幕…' : '暂无符合条件的弹幕'}</p>}
        </div>
        <footer className="flex shrink-0 items-center justify-between border-t border-[var(--glass-border)] px-3 py-1 tabular-nums"><button type="button" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>上一页</button><span>{visiblePage + 1} / {pageCount}</span><button type="button" disabled={visiblePage + 1 >= pageCount} onClick={() => setPage(visiblePage + 1)}>下一页</button></footer>
      </>;
}
