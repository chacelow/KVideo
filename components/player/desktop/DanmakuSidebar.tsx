'use client';

import { useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import type { UseDanmakuReturn } from '../hooks/useDanmaku';
import { DanmakuCommentList } from './DanmakuCommentList';
import { DanmakuSourcesPanel } from './DanmakuSourcesPanel';
import { DanmakuPreferencesPanel } from './DanmakuPreferencesPanel';

interface DanmakuSidebarProps {
  danmaku: UseDanmakuReturn;
  currentVideoDuration?: number;
  onSeek?: (seconds: number) => void;
  isOpen: boolean;
  onToggleOpen?: () => void;
  onClose?: () => void;
  style?: CSSProperties;
  className?: string;
}

const tabs = ['弹幕列表', '弹幕源管理', '屏蔽过滤', '外观设置'] as const;

export function DanmakuSidebar({ danmaku, currentVideoDuration = 0, onSeek, isOpen, onClose, style, className = '' }: DanmakuSidebarProps) {
  const [tab, setTab] = useState<(typeof tabs)[number]>('弹幕列表');
  if (!isOpen) return null;
  return (
    <aside aria-label="弹幕管理" style={style} className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-transparent text-xs text-[var(--text-color)] [&_button]:cursor-pointer [&_button]:whitespace-nowrap [&_button]:px-1 [&_button]:py-1.5 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-40 [&_button:hover]:text-[var(--accent-color)] [&_button[aria-pressed=true]]:text-[var(--accent-color)] [&_input:not([type=checkbox])]:min-w-0 [&_input:not([type=checkbox])]:bg-transparent [&_input:not([type=checkbox])]:py-1 [&_input[type=text]]:flex-1 [&_input[type=number]]:w-16 [&_input[type=number]]:rounded-md [&_input[type=number]]:border [&_input[type=number]]:border-[var(--glass-border)] [&_input[type=number]]:px-2 [&_input[type=range]]:w-full [&_input]:accent-[var(--accent-color)] [&_select]:bg-[var(--bg-color)] [&_select]:text-[var(--text-color)] [&_:focus-visible]:outline-[var(--accent-color)] ${className}`}>
      <header className="flex min-h-10 shrink-0 items-center gap-2 border-b border-[var(--glass-border)] px-3">
        <strong>弹幕</strong>
        <span className="flex-1 truncate tabular-nums text-[var(--text-color-secondary)]">已加载 {danmaku.comments.length.toLocaleString()} 条</span>
        <Switch checked={danmaku.danmakuEnabled} onChange={danmaku.setDanmakuEnabled} ariaLabel="显示弹幕" />
        {onClose && <button type="button" aria-label="关闭弹幕面板" onClick={onClose}><X size={16} /></button>}
      </header>
      <nav aria-label="弹幕功能" className="flex shrink-0 border-b border-[var(--glass-border)] px-2">
        {tabs.map(name => <button type="button" key={name} aria-current={tab === name ? 'page' : undefined} className={`flex-1 border-b-2 py-2 ${tab === name ? 'border-[var(--accent-color)] text-[var(--accent-color)]' : 'border-transparent text-[var(--text-color-secondary)]'}`} onClick={() => setTab(name)}>{name}</button>)}
      </nav>
      {danmaku.error && <p role="alert" className="px-3 py-2 text-[var(--text-color-secondary)]">{danmaku.error}</p>}
      {tab === '弹幕列表' && <DanmakuCommentList danmaku={danmaku} onSeek={onSeek} />}
      {tab === '弹幕源管理' && <DanmakuSourcesPanel danmaku={danmaku} currentVideoDuration={currentVideoDuration} />}
      {(tab === '屏蔽过滤' || tab === '外观设置') && <DanmakuPreferencesPanel appearance={tab === '外观设置'} />}
    </aside>
  );
}
