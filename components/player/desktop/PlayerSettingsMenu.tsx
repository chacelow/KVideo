'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Settings, ShieldAlert, SkipForward, FastForward, Rewind, MessageSquare, Link as LinkIcon, Check } from 'lucide-react';
import { usePlayerSettings } from '../hooks/usePlayerSettings';
import { AdFilterMode } from '@/lib/store/settings-store';

interface PlayerSettingsMenuProps {
  isPremium?: boolean;
  isProxied?: boolean;
  onCopyLink?: (type?: 'original' | 'proxy') => void;
}

export function PlayerSettingsMenu({
  isPremium = false,
  isProxied = false,
  onCopyLink,
}: PlayerSettingsMenuProps) {
  const {
    autoNextEpisode,
    setAutoNextEpisode,
    autoSkipIntro,
    setAutoSkipIntro,
    skipIntroSeconds,
    setSkipIntroSeconds,
    autoSkipOutro,
    setAutoSkipOutro,
    skipOutroSeconds,
    setSkipOutroSeconds,
    adFilter,
    setAdFilter,
    adFilterMode,
    setAdFilterMode,
    danmakuEnabled,
    setDanmakuEnabled,
    danmakuOpacity,
    setDanmakuOpacity,
    danmakuDisplayArea,
    setDanmakuDisplayArea,
  } = usePlayerSettings(isPremium);

  const [activeTab, setActiveTab] = useState<'playback' | 'danmaku' | 'tools'>('playback');
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = (type?: 'original' | 'proxy') => {
    onCopyLink?.(type);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="btn-icon shrink-0 text-white/90 hover:text-pink-400 transition-colors cursor-pointer outline-none select-none"
          title="播放设置"
          aria-label="播放设置"
        >
          <Settings size={18} />
        </button>
      </Popover.Trigger>

      <Popover.Portal container={typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) || undefined : undefined}>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={12}
          className="z-[9999] w-80 max-h-96 overflow-y-auto bg-[#1a1b1e]/95 backdrop-blur-2xl border border-white/10 rounded-xl p-3.5 shadow-2xl animate-in fade-in-0 zoom-in-95 text-xs text-white select-none space-y-3"
        >
          {/* 顶栏 Tab：播放控制 | 弹幕设置 | 辅助工具 */}
          <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg text-[11px] font-semibold">
            {[
              { id: 'playback', label: '播放控制' },
              { id: 'danmaku', label: '弹幕偏好' },
              { id: 'tools', label: '快捷工具' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveTab(t.id as any);
                }}
                className={`flex-1 py-1 rounded text-center transition-all cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-pink-500 text-white font-bold shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 1. 播放控制面板 */}
          {activeTab === 'playback' && (
            <div className="space-y-3 animate-fade-in">
              {/* 自动连播下一集 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SkipForward size={14} className="text-pink-400" />
                  <div>
                    <span className="font-medium block">自动连播下一集</span>
                    <span className="text-[10px] text-white/40">当前集播放结束时自动跳转</span>
                  </div>
                </div>
                <ToggleSwitch checked={autoNextEpisode} onChange={setAutoNextEpisode} />
              </div>

              {/* 自动跳过片头 */}
              <div className="space-y-1.5 pt-1 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FastForward size={14} className="text-amber-400" />
                    <div>
                      <span className="font-medium block">自动跳过片头</span>
                      <span className="text-[10px] text-white/40">跳过 OP 直达正片</span>
                    </div>
                  </div>
                  <ToggleSwitch checked={autoSkipIntro} onChange={setAutoSkipIntro} />
                </div>
                {autoSkipIntro && (
                  <div className="flex items-center justify-between pl-6 text-[11px] text-white/70 bg-white/[0.03] p-1.5 rounded-md">
                    <span>片头跳过时长:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={skipIntroSeconds}
                        onChange={(e) => setSkipIntroSeconds(parseInt(e.target.value) || 0)}
                        className="w-12 h-6 px-1 text-center bg-black/50 border border-white/10 rounded text-xs text-white outline-none focus:border-pink-500"
                      />
                      <span>秒</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 自动跳过片尾 */}
              <div className="space-y-1.5 pt-1 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Rewind size={14} className="text-amber-400" />
                    <div>
                      <span className="font-medium block">自动跳过片尾</span>
                      <span className="text-[10px] text-white/40">正片结束自动切集</span>
                    </div>
                  </div>
                  <ToggleSwitch checked={autoSkipOutro} onChange={setAutoSkipOutro} />
                </div>
                {autoSkipOutro && (
                  <div className="flex items-center justify-between pl-6 text-[11px] text-white/70 bg-white/[0.03] p-1.5 rounded-md">
                    <span>片尾跳过时长:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={skipOutroSeconds}
                        onChange={(e) => setSkipOutroSeconds(parseInt(e.target.value) || 0)}
                        className="w-12 h-6 px-1 text-center bg-black/50 border border-white/10 rounded text-xs text-white outline-none focus:border-pink-500"
                      />
                      <span>秒</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 智能去广告模式 */}
              <div className="pt-1 border-t border-white/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={14} className="text-emerald-400" />
                    <span className="font-medium">去切片广告拦截</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold">
                    {adFilter ? (adFilterMode === 'heuristic' ? '智能' : adFilterMode === 'aggressive' ? '激进' : '开启') : '已关闭'}
                  </span>
                </div>
                <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg text-[10px]">
                  {[
                    { id: 'off', label: '关闭' },
                    { id: 'keyword', label: '关键词' },
                    { id: 'heuristic', label: '智能启发' },
                    { id: 'aggressive', label: '激进过滤' },
                  ].map((mode) => {
                    const active = adFilter && adFilterMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (mode.id === 'off') {
                            setAdFilter(false);
                          } else {
                            setAdFilter(true);
                            setAdFilterMode(mode.id as AdFilterMode);
                          }
                        }}
                        className={`flex-1 py-1 rounded transition-all cursor-pointer ${
                          active
                            ? 'bg-pink-500 text-white font-bold'
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2. 弹幕偏好面板 */}
          {activeTab === 'danmaku' && (
            <div className="space-y-3.5 animate-fade-in">
              {/* 弹幕总开关 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-pink-400" />
                  <div>
                    <span className="font-medium block">全网弹幕聚合</span>
                    <span className="text-[10px] text-white/40">爱优腾芒B站弹幕实时匹配</span>
                  </div>
                </div>
                <ToggleSwitch checked={danmakuEnabled} onChange={setDanmakuEnabled} />
              </div>

              {danmakuEnabled && (
                <>
                  {/* 弹幕透明度调节 */}
                  <div className="space-y-1 pt-1 border-t border-white/5">
                    <div className="flex items-center justify-between text-[11px] text-white/70">
                      <span>不透明度:</span>
                      <span className="font-bold text-pink-400">{Math.round(danmakuOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={Math.round(danmakuOpacity * 100)}
                      onChange={(e) => setDanmakuOpacity(parseInt(e.target.value) / 100)}
                      className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                  </div>

                  {/* 弹幕显示区域 */}
                  <div className="space-y-1.5 pt-1 border-t border-white/5">
                    <span className="text-[11px] text-white/70 block">显示区域:</span>
                    <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg text-[10px]">
                      {[
                        { val: 0.25, label: '顶部1/4' },
                        { val: 0.5, label: '半屏' },
                        { val: 0.75, label: '大半屏' },
                        { val: 1.0, label: '全屏' },
                      ].map((item) => {
                        const isCur = danmakuDisplayArea === item.val;
                        return (
                          <button
                            key={item.val}
                            onClick={() => setDanmakuDisplayArea(item.val)}
                            className={`flex-1 py-1 rounded transition-all cursor-pointer ${
                              isCur
                                ? 'bg-pink-500 text-white font-bold'
                                : 'text-white/60 hover:text-white'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 3. 快捷工具 */}
          {activeTab === 'tools' && (
            <div className="space-y-2.5 animate-fade-in">
              <span className="text-[11px] text-white/40 block">视频流链接:</span>
              <button
                onClick={() => handleCopy('original')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <LinkIcon size={14} className="text-pink-400" />
                  <span>复制当前视频播放直链</span>
                </div>
                {copySuccess && <Check size={12} className="text-emerald-400" />}
              </button>
              {isProxied && (
                <button
                  onClick={() => handleCopy('proxy')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2">
                    <LinkIcon size={14} className="text-pink-400" />
                    <span>复制代理加速直链</span>
                  </div>
                  {copySuccess && <Check size={12} className="text-emerald-400" />}
                </button>
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`w-8 h-4.5 rounded-full transition-colors cursor-pointer relative p-0.5 ${
        checked ? 'bg-pink-500' : 'bg-white/20'
      }`}
    >
      <div
        className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-3.5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
