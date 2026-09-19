'use client';

export interface SourcePreferenceItem {
  animeId: string | number;
  platform?: string;
  enabled: boolean;
  offset: number;
}

export interface DanmakuSeriesPreference {
  preferredAnimeId?: string | number;
  preferredPlatform?: string;
  // 多源偏好记忆：记录哪些源被开启、每个源的独立偏移
  sourcesConfig?: Record<string, SourcePreferenceItem>; // key: animeId
  globalOffset: number; // 全局弹幕总偏移秒数
  followOffset: boolean; // 是否切集时沿用偏移
}

export interface DanmakuGlobalConfig {
  // 弹幕飞行速度 (耗时秒数，越大越慢越舒缓，B站原生标准约为 12~14 秒)
  speed: number; // 7 (极速), 10 (快速), 13 (B站标准默认), 16 (慢速), 19 (极慢)
  opacity: number; // 0.1 ~ 1.0 (默认 0.8)
  fontSize: number; // 14, 18, 20, 24, 28 (默认 20)
  displayArea: number; // 0.25 (1/4屏), 0.5 (半屏), 0.75 (3/4屏), 1.0 (全屏)
  preventOverlap: boolean; // 严格防重叠 (默认 true)
  // 类型过滤
  showScroll: boolean; // 是否显示滚动弹幕 (默认 true)
  showTop: boolean; // 是否显示顶部弹幕 (默认 true)
  showBottom: boolean; // 是否显示底部弹幕 (默认 true)
  showColor: boolean; // 是否显示彩色 (false 时一律转为柔和白字)
  // 智能过滤与屏蔽词
  blockedWords: string[]; // 用户自定义屏蔽词列表
  blockRepetitive: boolean; // 屏蔽连续重复字符刷屏 (如 66666, 哈哈哈哈)
  blockSpamPhrases: boolean; // 屏蔽打卡签到 (如 第一、前排、打卡、签到、周目)
  blockMaxLength: number; // 屏蔽超长弹幕字数 (0 为不限制, 默认 30 字)
  // 高级优化
  mergeDuplicatesToTop: boolean; // 重复弹幕自动聚合成顶部 ×N 计数弹幕 (默认 true)
  cleanLikeBadges: boolean; // 过滤隐藏 ♡/Like/Unlike 点赞互动杂质 (默认 true)
}
const DEFAULT_GLOBAL_CONFIG: DanmakuGlobalConfig = {
  speed: 13,
  opacity: 0.8,
  fontSize: 20,
  displayArea: 0.5,
  preventOverlap: true,
  showScroll: true,
  showTop: true,
  showBottom: true,
  showColor: true,
  blockedWords: [],
  blockRepetitive: true,
  blockSpamPhrases: false,
  blockMaxLength: 40,
  mergeDuplicatesToTop: true,
  cleanLikeBadges: true,
};
const SERIES_PREF_PREFIX = 'kvideo_danmaku_pref_';
const GLOBAL_CONFIG_KEY = 'kvideo_danmaku_global_config_v1';

function getSeriesKey(title: string): string {
  const normalized = title.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  return normalized ? encodeURIComponent(normalized) : 'default';
}

function getLegacyFullTitleKey(title: string): string {
  return title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase() || 'default';
}


type Listener = () => void;
const listeners = new Set<Listener>();
let cachedGlobalConfig: DanmakuGlobalConfig | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}
export const danmakuPreferenceStore = {
  // 1. 剧集级别记忆 (多源配置、独立偏移、全局偏移)
  getPreference(title: string): DanmakuSeriesPreference {
    if (typeof window === 'undefined') return { globalOffset: 0, followOffset: true };
    const key = `${SERIES_PREF_PREFIX}${getSeriesKey(title)}`;
    try {
      let val = localStorage.getItem(key);
      if (!val) {
        const legacyKey = `${SERIES_PREF_PREFIX}${getLegacyFullTitleKey(title)}`;
        val = localStorage.getItem(legacyKey);
        if (val && legacyKey !== key) localStorage.setItem(key, val);
      }
      if (val) {
        const parsed = JSON.parse(val);
        return {
          preferredAnimeId: parsed.preferredAnimeId,
          preferredPlatform: parsed.preferredPlatform,
          sourcesConfig: parsed.sourcesConfig || {},
          globalOffset: typeof parsed.globalOffset === 'number' ? parsed.globalOffset : (parsed.offset || 0),
          followOffset: parsed.followOffset !== undefined ? Boolean(parsed.followOffset) : true,
        };
      }
    } catch {}
    return { globalOffset: 0, followOffset: true };
  },
  savePreference(title: string, pref: Partial<DanmakuSeriesPreference>) {
    if (typeof window === 'undefined' || !title) return;
    const key = `${SERIES_PREF_PREFIX}${getSeriesKey(title)}`;
    try {
      const current = this.getPreference(title);
      const updated: DanmakuSeriesPreference = {
        ...current,
        ...pref,
      };
      localStorage.setItem(key, JSON.stringify(updated));
      notify();
    } catch {}
  },

  // 2. 全局播放器弹幕配置 (单例缓存，保证 getSnapshot 引用完全稳定)
  getGlobalConfig(): DanmakuGlobalConfig {
    if (cachedGlobalConfig) return cachedGlobalConfig;
    if (typeof window === 'undefined') return DEFAULT_GLOBAL_CONFIG;
    try {
      const val = localStorage.getItem(GLOBAL_CONFIG_KEY);
      if (val) {
        const parsed = JSON.parse(val);
        // 如果以前存储的是老版本的 8s 极快速度，自动平滑升级为 13s 舒缓速度
        const effectiveSpeed = typeof parsed.speed === 'number' && parsed.speed <= 8 ? 13 : (parsed.speed || 13);
        const loadedConfig: DanmakuGlobalConfig = {
          ...DEFAULT_GLOBAL_CONFIG,
          ...parsed,
          speed: effectiveSpeed,
        };
        cachedGlobalConfig = loadedConfig;
        return loadedConfig;
      }
    } catch {}
    cachedGlobalConfig = DEFAULT_GLOBAL_CONFIG;
    return cachedGlobalConfig;
  },

  saveGlobalConfig(config: Partial<DanmakuGlobalConfig>) {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getGlobalConfig();
      cachedGlobalConfig = {
        ...current,
        ...config,
      };
      localStorage.setItem(GLOBAL_CONFIG_KEY, JSON.stringify(cachedGlobalConfig));
      notify();
    } catch {}
  },

  // 屏蔽词快捷添加/删除
  addBlockedWord(word: string) {
    const trimmed = word.trim();
    if (!trimmed) return;
    const current = this.getGlobalConfig();
    if (current.blockedWords.includes(trimmed)) return;
    this.saveGlobalConfig({
      blockedWords: [...current.blockedWords, trimmed],
    });
  },

  removeBlockedWord(word: string) {
    const current = this.getGlobalConfig();
    this.saveGlobalConfig({
      blockedWords: current.blockedWords.filter((w) => w !== word),
    });
  },

  clearBlockedWords() {
    this.saveGlobalConfig({ blockedWords: [] });
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
