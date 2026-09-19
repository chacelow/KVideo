'use client';

import React, { useState, useSyncExternalStore } from 'react';
import {
  MessageSquare,
  Radio,
  Clock,
  RotateCcw,
  Search,
  Check,
  Layers,
  Sparkles,
  Info,
  Shield,
  SlidersHorizontal,
  X,
  Plus,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { UseDanmakuReturn } from '@/components/player/hooks/useDanmaku';
import {
  danmakuPreferenceStore,
  type DanmakuGlobalConfig,
} from '@/lib/store/danmaku-preference-store';
import { formatDuration, getPlatformLabel, extractPlatform } from '@/lib/utils/danmaku-utils';

interface DanmakuControlHubProps {
  danmaku: UseDanmakuReturn;
  currentVideoDuration?: number; // 播放器当前视频实际长度（秒）
  onClose?: () => void; // 侧边栏收起回调
  className?: string;
}

type TabType = 'sources' | 'filter' | 'appearance';

export function DanmakuControlHub({
  danmaku,
  currentVideoDuration = 0,
  onClose,
  className = '',
}: DanmakuControlHubProps) {
  const {
    danmakuEnabled,
    setDanmakuEnabled,
    comments,
    isLoading,
    detectedSources,
    activeSourcesMap,
    toggleSourceEnabled,
    setSourceOffset,
    activeSource,
    selectSource,
    danmakuOffset,
    setDanmakuOffset,
    followOffset,
    setFollowOffset,
    searchKeyword,
    searchDanmakuSources,
  } = danmaku;

  const [activeTab, setActiveTab] = useState<TabType>('sources');
  const [kwInput, setKwInput] = useState(searchKeyword || '');
  const [customOffsetInput, setCustomOffsetInput] = useState(String(danmakuOffset));
  const [newBlockedWord, setNewBlockedWord] = useState('');
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  // 监听全局配置
  const config = useSyncExternalStore(
    danmakuPreferenceStore.subscribe,
    danmakuPreferenceStore.getGlobalConfig,
    danmakuPreferenceStore.getGlobalConfig
  );

  const updateConfig = (patch: Partial<DanmakuGlobalConfig>) => {
    danmakuPreferenceStore.saveGlobalConfig(patch);
  };

  // 计算全局时长差
  const sourceDuration = activeSource?.videoDuration || 0;
  const hasDurationComparison = sourceDuration > 0 && currentVideoDuration > 0;
  const durationDiff = sourceDuration - currentVideoDuration;

  // 启用的源数量
  const enabledSourcesCount = Object.values(activeSourcesMap).filter((s) => s.enabled).length;

  const handleApplyCustomOffset = () => {
    const val = parseFloat(customOffsetInput);
    if (!isNaN(val)) {
      setDanmakuOffset(val);
    }
  };

  const handleAlignDurationDiff = () => {
    if (durationDiff !== 0) {
      setDanmakuOffset(Math.round(durationDiff));
      setCustomOffsetInput(String(Math.round(durationDiff)));
    }
  };

  const handleStepGlobalOffset = (step: number) => {
    const next = Math.round((danmakuOffset + step) * 10) / 10;
    setDanmakuOffset(next);
    setCustomOffsetInput(String(next));
  };

  const handleResetGlobalOffset = () => {
    setDanmakuOffset(0);
    setCustomOffsetInput('0');
  };

  const handleAddBlockedWord = () => {
    if (!newBlockedWord.trim()) return;
    danmakuPreferenceStore.addBlockedWord(newBlockedWord.trim());
    setNewBlockedWord('');
  };

  return (
    <div
      className={`h-full flex flex-col text-xs text-[#e3e5e7] bg-[#141517]/98 border-l border-white/10 select-none overflow-hidden ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 顶部标题栏 + 收起按钮 */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
            <MessageSquare size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">弹幕控制侧边栏</span>
              <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-mono text-[10px] font-bold">
                {enabledSourcesCount > 1 ? `${enabledSourcesCount}源合并中` : activeSource ? getPlatformLabel(activeSource.platform || 'web') : '全网'}
              </span>
            </div>
            <span className="text-[11px] text-white/40">
              多源独立控制 · 弹幕合并 · 智能过滤 · 速度与时差校准
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              title="收起侧边栏"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 弹幕总开关与 Tab 导航 */}
      <div className="p-3 border-b border-white/5 space-y-2.5 shrink-0 bg-black/20">
        <div className="flex items-center justify-between">
          <span className="text-white/70 font-medium">弹幕总开关</span>
          <button
            onClick={() => setDanmakuEnabled(!danmakuEnabled)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              danmakuEnabled
                ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
                : 'bg-white/10 text-white/50 hover:bg-white/20'
            }`}
          >
            {danmakuEnabled ? '已开启' : '已关闭'}
          </button>
        </div>

        {danmakuEnabled && (
          <div className="flex bg-white/5 p-1 rounded-xl gap-1 text-[11px] font-medium border border-white/5">
            {[
              { id: 'sources', label: '来源与时差', icon: Layers },
              { id: 'filter', label: '屏蔽与过滤', icon: Shield },
              { id: 'appearance', label: '速度与外观', icon: SlidersHorizontal },
            ].map((tab) => {
              const IconComp = tab.icon;
              const isCur = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isCur
                      ? 'bg-pink-500 text-white font-bold shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <IconComp size={12} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 侧边栏内容滚动区 */}
      {danmakuEnabled && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* TAB 1: 来源与时差 (多源控制、多选合并、各源独立Offset) */}
          {activeTab === 'sources' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* 状态概览卡片 */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio size={13} className={isLoading ? 'animate-pulse text-amber-400' : 'text-emerald-400'} />
                    <span className="font-medium text-white">
                      {isLoading ? '正在并发加载弹幕...' : enabledSourcesCount > 0 ? `当前激活 ${enabledSourcesCount} 个弹幕源` : '未激活任何源'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-pink-400 font-bold text-sm">{comments.length.toLocaleString()}</span>
                    <span className="text-white/50 text-[10px] ml-1">条弹幕</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-white/50 pt-1 border-t border-white/5">
                  <span>支持勾选多个来源自动合并弹幕</span>
                  <div className="flex items-center gap-1 text-emerald-400 text-[10px]">
                    <Sparkles size={11} />
                    <span>剧集配置已记忆</span>
                  </div>
                </div>
              </div>

              {/* 全局时间轴偏移控制 */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-white/80 font-semibold">
                    <RotateCcw size={13} className="text-pink-400" />
                    <span>全局时间轴主偏移 (Global Offset)</span>
                  </div>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                      danmakuOffset === 0
                        ? 'bg-white/10 text-white'
                        : danmakuOffset > 0
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {danmakuOffset > 0 ? `+${danmakuOffset}s` : `${danmakuOffset}s`}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1">
                  {[
                    { label: '-5s', val: -5 },
                    { label: '-1s', val: -1 },
                    { label: '-0.5s', val: -0.5 },
                    { label: '0s', val: 0, reset: true },
                    { label: '+0.5s', val: 0.5 },
                    { label: '+1s', val: 1 },
                    { label: '+5s', val: 5 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={() => (btn.reset ? handleResetGlobalOffset() : handleStepGlobalOffset(btn.val))}
                      className={`flex-1 py-1.5 rounded-lg font-mono text-[10px] transition-colors cursor-pointer text-center ${
                        btn.reset
                          ? 'bg-white/10 hover:bg-white/20 text-white/70'
                          : 'bg-white/5 hover:bg-white/15 text-white/90'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1 gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-white/60 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={followOffset}
                      onChange={(e) => setFollowOffset(e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-pink-500 focus:ring-0 cursor-pointer"
                    />
                    <span>切集继续继承此偏移</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.5"
                      value={customOffsetInput}
                      onChange={(e) => setCustomOffsetInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyCustomOffset()}
                      placeholder="秒"
                      className="w-16 px-2 py-1 bg-black/30 border border-white/10 rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-pink-500"
                    />
                    <button
                      onClick={handleApplyCustomOffset}
                      className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] text-white transition-colors cursor-pointer"
                    >
                      应用
                    </button>
                  </div>
                </div>
              </div>

              {/* 源时长 vs 视频时长比对雷达 */}
              <div className="p-3 bg-gradient-to-br from-white/[0.04] to-transparent rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-white/80 font-semibold">
                    <Clock size={13} className="text-cyan-400" />
                    <span>源视频时长雷达 (主源)</span>
                  </div>
                  {hasDurationComparison && Math.abs(durationDiff) > 3 && (
                    <button
                      onClick={handleAlignDurationDiff}
                      className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors cursor-pointer text-[10px] flex items-center gap-1"
                    >
                      <span>对齐主源差 ({durationDiff > 0 ? `+${Math.round(durationDiff)}s` : `${Math.round(durationDiff)}s`})</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="bg-black/20 p-2 rounded-lg">
                    <div className="text-white/40 text-[10px] mb-0.5">主源官方时长</div>
                    <div className="font-mono font-bold text-white">
                      {sourceDuration > 0 ? formatDuration(sourceDuration) : '未提供'}
                    </div>
                  </div>
                  <div className="bg-black/20 p-2 rounded-lg">
                    <div className="text-white/40 text-[10px] mb-0.5">播放切片时长</div>
                    <div className="font-mono font-bold text-white">
                      {currentVideoDuration > 0 ? formatDuration(currentVideoDuration) : '加载中'}
                    </div>
                  </div>
                  <div className="bg-black/20 p-2 rounded-lg">
                    <div className="text-white/40 text-[10px] mb-0.5">时长偏差</div>
                    <div
                      className={`font-mono font-bold ${
                        !hasDurationComparison || Math.abs(durationDiff) < 3
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {hasDurationComparison
                        ? `${durationDiff > 0 ? `+${Math.round(durationDiff)}` : Math.round(durationDiff)}s`
                        : '无'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 多来源细粒度控制列表 (勾选多选合并、单独开关、各源独立Offset) */}
              <div className="space-y-2.5 pt-1 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-white/80">
                    <Layers size={13} className="text-indigo-400" />
                    <span>多来源细粒度控制 ({detectedSources.length})</span>
                  </div>
                  <span className="text-[10px] text-white/40">复选框合并 · 齿轮调各源偏移</span>
                </div>

                {/* 搜索/添加野生源 */}
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Search size={12} className="absolute left-2.5 top-2.5 text-white/40" />
                    <input
                      type="text"
                      value={kwInput}
                      onChange={(e) => setKwInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchDanmakuSources(kwInput)}
                      placeholder="搜索全网或野生弹幕源..."
                      className="w-full pl-7 pr-2 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <button
                    onClick={() => searchDanmakuSources(kwInput)}
                    className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    检索
                  </button>
                </div>

                {/* 来源卡片列表 */}
                <div className="space-y-2">
                  {detectedSources.length === 0 ? (
                    <div className="text-center py-6 text-white/40 text-xs">
                      暂无匹配的弹幕源，可在上方搜索框手动输入关键词检索
                    </div>
                  ) : (
                    detectedSources.map((source) => {
                      const animeIdStr = String(source.animeId);
                      const activeItem = activeSourcesMap[animeIdStr];
                      const isEnabled = Boolean(activeItem?.enabled);
                      const platform = extractPlatform(source.animeTitle);
                      const epCount = source.episodes ? source.episodes.length : 0;
                      const isExpanded = expandedSourceId === animeIdStr;
                      const sourceOffset = activeItem?.offset || 0;

                      return (
                        <div
                          key={source.animeId}
                          className={`rounded-xl border transition-all overflow-hidden ${
                            isEnabled
                              ? 'bg-pink-500/10 border-pink-500/40 shadow-sm'
                              : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                          }`}
                        >
                          {/* 主卡片行 */}
                          <div className="p-3 flex items-center justify-between gap-2.5">
                            {/* 复选框：开启/合并该源 */}
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() => toggleSourceEnabled(source)}
                              className="rounded border-white/20 bg-white/5 text-pink-500 focus:ring-0 cursor-pointer w-4 h-4 shrink-0"
                              title={isEnabled ? '取消该来源弹幕' : '勾选合并此来源弹幕'}
                            />

                            {/* 平台徽章与标题 */}
                            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => selectSource(source)}>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold shrink-0 ${
                                    platform === 'bilibili'
                                      ? 'bg-sky-500/20 text-sky-400'
                                      : platform === 'youku'
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : platform === 'iqiyi'
                                      ? 'bg-green-500/20 text-green-400'
                                      : platform === 'tencent'
                                      ? 'bg-orange-500/20 text-orange-400'
                                      : 'bg-purple-500/20 text-purple-400'
                                  }`}
                                >
                                  {getPlatformLabel(platform)}
                                </span>
                                <span className="font-medium text-white truncate text-[11px]">
                                  {source.animeTitle}
                                </span>
                              </div>
                              <div className="text-white/40 text-[10px] flex items-center gap-2">
                                <span>共 {epCount} 集</span>
                                {activeItem?.commentCount !== undefined && activeItem.commentCount > 0 && (
                                  <span className="text-pink-400/80">{activeItem.commentCount}条弹幕</span>
                                )}
                                {sourceOffset !== 0 && (
                                  <span className="text-cyan-300 font-mono">单独偏移 {sourceOffset > 0 ? `+${sourceOffset}s` : `${sourceOffset}s`}</span>
                                )}
                              </div>
                            </div>

                            {/* 展开各源独立偏移调整 */}
                            <button
                              onClick={() => setExpandedSourceId(isExpanded ? null : animeIdStr)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer shrink-0"
                              title="单独调节此源偏移"
                            >
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </div>

                          {/* 展开部分：该来源独立时间轴偏移控制 */}
                          {isExpanded && (
                            <div className="p-3 bg-black/30 border-t border-white/5 space-y-2 text-[11px] animate-in fade-in-50 duration-150">
                              <div className="flex items-center justify-between">
                                <span className="text-white/70">该源专属时间轴偏移:</span>
                                <span className="font-mono font-bold text-pink-400">
                                  {sourceOffset > 0 ? `+${sourceOffset}s` : `${sourceOffset}s`}
                                </span>
                              </div>

                              <div className="flex gap-1">
                                {[-5, -1, 0, 1, 5].map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => setSourceOffset(source.animeId, s === 0 ? 0 : sourceOffset + s)}
                                    className="flex-1 py-1 bg-white/5 hover:bg-white/10 rounded font-mono text-[10px] text-white/80"
                                  >
                                    {s === 0 ? '归零' : s > 0 ? `+${s}s` : `${s}s`}
                                  </button>
                                ))}
                              </div>

                              {activeItem?.videoDuration ? (
                                <div className="text-[10px] text-white/40">
                                  源站官方视频时长：{formatDuration(activeItem.videoDuration)}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 屏蔽与过滤 (智能拦截、自定义词库、类型开关) */}
          {activeTab === 'filter' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* 智能过滤分类 */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2.5">
                <div className="text-white/80 font-semibold flex items-center gap-1.5">
                  <Shield size={13} className="text-emerald-400" />
                  <span>智能拦截分类</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="flex items-center gap-2 p-2 bg-black/20 rounded-lg cursor-pointer hover:bg-black/30">
                    <input
                      type="checkbox"
                      checked={config.blockRepetitive}
                      onChange={(e) => updateConfig({ blockRepetitive: e.target.checked })}
                      className="rounded border-white/20 bg-white/5 text-pink-500 focus:ring-0"
                    />
                    <span>屏蔽刷屏重复字符</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-black/20 rounded-lg cursor-pointer hover:bg-black/30">
                    <input
                      type="checkbox"
                      checked={config.blockSpamPhrases}
                      onChange={(e) => updateConfig({ blockSpamPhrases: e.target.checked })}
                      className="rounded border-white/20 bg-white/5 text-pink-500 focus:ring-0"
                    />
                    <span>屏蔽无意义打卡</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-black/20 rounded-lg cursor-pointer hover:bg-black/30">
                    <input
                      type="checkbox"
                      checked={config.showColor}
                      onChange={(e) => updateConfig({ showColor: e.target.checked })}
                      className="rounded border-white/20 bg-white/5 text-pink-500 focus:ring-0"
                    />
                    <span>允许彩色弹幕</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-black/20 rounded-lg cursor-pointer hover:bg-black/30">
                    <input
                      type="checkbox"
                      checked={config.mergeDuplicatesToTop}
                      onChange={(e) => updateConfig({ mergeDuplicatesToTop: e.target.checked })}
                      className="rounded border-white/20 bg-white/5 text-pink-500 focus:ring-0"
                    />
                    <span className="text-pink-300 font-semibold">重复弹幕聚为顶部(×N)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-black/20 rounded-lg cursor-pointer hover:bg-black/30">
                    <input
                      type="checkbox"
                      checked={config.cleanLikeBadges}
                      onChange={(e) => updateConfig({ cleanLikeBadges: e.target.checked })}
                      className="rounded border-white/20 bg-white/5 text-pink-500 focus:ring-0"
                    />
                    <span>过滤隐藏♡/Like点赞杂质</span>
                  </label>
                  <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                    <span className="text-white/70">最大字数:</span>
                    <select
                      value={config.blockMaxLength}
                      onChange={(e) => updateConfig({ blockMaxLength: parseInt(e.target.value) })}
                      className="bg-white/10 text-white rounded px-1.5 py-0.5 text-[10px] outline-none"
                    >
                      <option value={0}>不限制</option>
                      <option value={20}>20字以内</option>
                      <option value={30}>30字以内</option>
                      <option value={40}>40字以内</option>
                    </select>
                  </div>
                </div>

                {/* 弹幕类型开关 */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                  <span className="text-white/60">显示类型:</span>
                  <div className="flex gap-1.5">
                    {[
                      { key: 'showScroll', label: '滚动' },
                      { key: 'showTop', label: '顶部' },
                      { key: 'showBottom', label: '底部' },
                    ].map((item) => {
                      const enabled = (config as any)[item.key];
                      return (
                        <button
                          key={item.key}
                          onClick={() => updateConfig({ [item.key]: !enabled })}
                          className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                            enabled
                              ? 'bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30'
                              : 'bg-white/5 text-white/40 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 用户自定义屏蔽词管理 */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-white/80 font-semibold flex items-center gap-1.5">
                    <Shield size={13} className="text-rose-400" />
                    <span>自定义屏蔽词库 ({config.blockedWords.length})</span>
                  </div>
                  {config.blockedWords.length > 0 && (
                    <button
                      onClick={() => danmakuPreferenceStore.clearBlockedWords()}
                      className="text-[10px] text-white/40 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      清空全部
                    </button>
                  )}
                </div>

                {/* 添加屏蔽词 */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newBlockedWord}
                    onChange={(e) => setNewBlockedWord(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddBlockedWord()}
                    placeholder="输入词语或正则 (如 剧透 或 /^微信/)"
                    className="flex-1 px-3 py-1.5 bg-black/30 border border-white/10 rounded-xl text-white text-[11px] placeholder:text-white/30 focus:outline-none focus:border-pink-500"
                  />
                  <button
                    onClick={handleAddBlockedWord}
                    className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus size={13} />
                    <span>添加</span>
                  </button>
                </div>

                {/* 屏蔽词胶囊列表 */}
                <div className="max-h-36 overflow-y-auto flex flex-wrap gap-1.5 pt-1 pr-1 custom-scrollbar">
                  {config.blockedWords.length === 0 ? (
                    <div className="w-full text-center py-4 text-white/30 text-[11px]">
                      暂无屏蔽词，支持添加文字或正则表达式
                    </div>
                  ) : (
                    config.blockedWords.map((word) => (
                      <span
                        key={word}
                        className="px-2 py-0.5 rounded-lg bg-white/10 text-white/90 text-[10px] font-mono flex items-center gap-1 border border-white/5"
                      >
                        <span>{word}</span>
                        <button
                          onClick={() => danmakuPreferenceStore.removeBlockedWord(word)}
                          className="hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 速度与外观 (飞行速度、字号、透明度、区域) */}
          {activeTab === 'appearance' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* 弹幕飞行速度 */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-white/80 font-semibold flex items-center gap-1.5">
                    <Zap size={13} className="text-amber-400" />
                    <span>弹幕飞行速度 (耗时秒数)</span>
                  </div>
                  <span className="font-mono text-pink-400 font-bold">{config.speed}秒</span>
                </div>

                <div className="flex gap-1 bg-black/20 p-1 rounded-xl text-[11px]">
                  {[
                    { speed: 4, label: '极速 (4s)' },
                    { speed: 6, label: '快速 (6s)' },
                    { speed: 8, label: '标准 (8s)' },
                    { speed: 10, label: '平缓 (10s)' },
                    { speed: 12, label: '慢速 (12s)' },
                  ].map((item) => {
                    const isCur = config.speed === item.speed;
                    return (
                      <button
                        key={item.speed}
                        onClick={() => updateConfig({ speed: item.speed })}
                        className={`flex-1 py-1 rounded-lg transition-colors cursor-pointer text-center ${
                          isCur
                            ? 'bg-pink-500 text-white font-bold shadow-sm'
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 屏幕显示区域 */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white/80 font-semibold">屏幕显示区域</span>
                  <span className="text-white/50 text-[10px]">
                    {config.displayArea === 0.25
                      ? '顶部1/4'
                      : config.displayArea === 0.5
                      ? '半屏'
                      : config.displayArea === 0.75
                      ? '3/4屏'
                      : '全屏'}
                  </span>
                </div>

                <div className="flex gap-1 bg-black/20 p-1 rounded-xl text-[11px]">
                  {[
                    { val: 0.25, label: '顶部1/4' },
                    { val: 0.5, label: '半屏' },
                    { val: 0.75, label: '3/4屏' },
                    { val: 1.0, label: '全屏' },
                  ].map((item) => {
                    const isCur = config.displayArea === item.val;
                    return (
                      <button
                        key={item.val}
                        onClick={() => updateConfig({ displayArea: item.val })}
                        className={`flex-1 py-1 rounded-lg transition-colors cursor-pointer text-center ${
                          isCur
                            ? 'bg-pink-500 text-white font-bold shadow-sm'
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 不透明度调节 */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/80 font-semibold">弹幕不透明度</span>
                  <span className="font-mono text-pink-400 font-bold">
                    {Math.round(config.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={Math.round(config.opacity * 100)}
                  onChange={(e) => updateConfig({ opacity: parseInt(e.target.value) / 100 })}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
              </div>

              {/* 弹幕字号大小 */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/80 font-semibold">弹幕字体大小</span>
                  <span className="font-mono text-pink-400 font-bold">{config.fontSize}px</span>
                </div>
                <div className="flex gap-1.5">
                  {[
                    { size: 16, label: '小 (16px)' },
                    { size: 20, label: '标准 (20px)' },
                    { size: 24, label: '大 (24px)' },
                    { size: 28, label: '特大 (28px)' },
                  ].map((item) => {
                    const isCur = config.fontSize === item.size;
                    return (
                      <button
                        key={item.size}
                        onClick={() => updateConfig({ fontSize: item.size })}
                        className={`flex-1 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer text-center ${
                          isCur
                            ? 'bg-pink-500 border-pink-500 text-white font-bold'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
