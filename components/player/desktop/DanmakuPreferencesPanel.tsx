'use client';
import { useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/Checkbox';
import { danmakuPreferenceStore, type DanmakuGlobalConfig } from '@/lib/store/danmaku-preference-store';
const filterOptions = [
  ['mergeDuplicatesToTop', '重复弹幕合并为顶部 ×N'],
  ['cleanLikeBadges', '隐藏点赞与互动标记'],
  ['blockRepetitive', '屏蔽连续重复字符'],
  ['blockSpamPhrases', '屏蔽签到等常见词'],
  ['showColor', '保留弹幕颜色'],
  ['showScroll', '显示滚动弹幕'],
  ['showTop', '显示顶部弹幕'],
  ['showBottom', '显示底部弹幕'],
] as const;

export function DanmakuPreferencesPanel({ appearance }: { appearance: boolean }) {
  const [word, setWord] = useState('');
  const config = useSyncExternalStore(danmakuPreferenceStore.subscribe, danmakuPreferenceStore.getGlobalConfig, danmakuPreferenceStore.getGlobalConfig);
  const update = (patch: Partial<DanmakuGlobalConfig>) => danmakuPreferenceStore.saveGlobalConfig(patch);
  const addWord = () => { if (word.trim()) { danmakuPreferenceStore.addBlockedWord(word.trim()); setWord(''); } };
  return appearance ? (
<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
        <label className="block space-y-2 border-b border-[var(--glass-border)] py-3"><span className="flex min-h-8 items-center justify-between gap-2"><span>移动速度</span><span className="text-[var(--text-color-secondary)]">穿屏 {config.speed.toFixed(1)} 秒</span></span><input aria-label="弹幕移动速度" type="range" min={7} max={21} step={0.1} value={28 - config.speed} onChange={e => update({ speed: Math.round((28 - e.target.valueAsNumber) * 10) / 10 })} /><span className="flex min-h-8 items-center justify-between gap-2 text-[var(--text-color-secondary)]"><span>慢</span><span>快</span></span></label>
        <label className="block space-y-2 border-b border-[var(--glass-border)] py-3"><span className="flex min-h-8 items-center justify-between gap-2"><span>不透明度</span><span>{Math.round(config.opacity * 100)}%</span></span><input aria-label="弹幕不透明度" type="range" min={10} max={100} value={Math.round(config.opacity * 100)} onChange={e => update({ opacity: e.target.valueAsNumber / 100 })} /></label>
        <label className="block space-y-2 border-b border-[var(--glass-border)] py-3"><span className="flex min-h-8 items-center justify-between gap-2"><span>字号</span><span>{config.fontSize}px</span></span><input aria-label="弹幕字号" type="range" min={14} max={36} value={config.fontSize} onChange={e => update({ fontSize: e.target.valueAsNumber })} /></label>
        <label className="flex min-h-8 items-center justify-between gap-2"><span>显示区域</span><select aria-label="弹幕显示区域" value={config.displayArea} onChange={e => update({ displayArea: Number(e.target.value) })}><option value={0.25}>四分之一屏</option><option value={0.5}>半屏</option><option value={0.75}>四分之三屏</option><option value={1}>全屏</option></select></label>
      </div>) : (
<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
        <div className="space-y-1 border-b border-[var(--glass-border)] pb-2 mb-2">{filterOptions.map(([key, label]) => <label key={key} className="flex min-h-8 items-center justify-between gap-2"><span>{label}</span><Checkbox checked={config[key]} onChange={e => update({ [key]: e.target.checked })} /></label>)}</div>
        <label className="flex min-h-8 items-center justify-between gap-2"><span>最大字数（0 为不限）</span><input aria-label="弹幕最大字数" type="number" min={0} value={config.blockMaxLength} onChange={e => { if (Number.isFinite(e.target.valueAsNumber)) update({ blockMaxLength: Math.max(0, e.target.valueAsNumber) }); }} /></label>
        <form className="flex shrink-0 items-center gap-2 border-b border-[var(--glass-border)] px-2 py-1" onSubmit={e => { e.preventDefault(); addWord(); }}><input aria-label="新增屏蔽词" placeholder="词语或 /正则/" value={word} onChange={e => setWord(e.target.value)} /><button type="submit">添加</button></form>
        <div className="flex min-h-8 items-center justify-between gap-2"><span className="text-[var(--text-color-secondary)]">屏蔽词 {config.blockedWords.length}</span><button type="button" disabled={!config.blockedWords.length} onClick={() => danmakuPreferenceStore.clearBlockedWords()}>清空</button></div>
        {config.blockedWords.map(value => <div className="flex min-h-8 items-center justify-between gap-2" key={value}><span className="min-w-0 truncate" title={value}>{value}</span><button type="button" aria-label={`删除屏蔽词 ${value}`} onClick={() => danmakuPreferenceStore.removeBlockedWord(value)}><X size={13} /></button></div>)}
      </div>);
}
