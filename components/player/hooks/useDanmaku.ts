'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { settingsStore } from '@/lib/store/settings-store';
import { userSourcesStore } from '@/lib/store/user-sources-store';
import { danmakuPreferenceStore } from '@/lib/store/danmaku-preference-store';
import {
  parseDanmakuResponse,
  parseSearchResults,
  matchEpisode,
  extractPlatform,
  extractCleanKeywords,
  isLegitimateSource,
  sortSourcesBySeason,
} from '@/lib/utils/danmaku-utils';
import type {
  DanmakuComment,
  DanmakuAnimeSource,
  DanmakuEpisode,
  DanmakuSourceInfo,
} from '@/lib/types/danmaku';

export interface ActiveSourceItem extends DanmakuSourceInfo {
  enabled: boolean;
  offset: number; // 针对该源单独的时间轴偏移
}

interface UseDanmakuOptions {
  videoTitle: string;
  episodeName: string;
  episodeIndex?: number;
}

export interface UseDanmakuReturn {
  danmakuEnabled: boolean;
  setDanmakuEnabled: (v: boolean) => void;
  comments: DanmakuComment[];
  isLoading: boolean;
  error: string | null;
  // 多源检测与细粒度控制
  detectedSources: DanmakuAnimeSource[];
  activeSourcesMap: Record<string, ActiveSourceItem>;
  toggleSourceEnabled: (anime: DanmakuAnimeSource, enabled?: boolean) => Promise<void>;
  setSourceOffset: (animeId: string | number, offset: number) => void;
  bindSourceEpisode: (anime: DanmakuAnimeSource, episode: DanmakuEpisode) => Promise<void>;
  activeSource: DanmakuSourceInfo | null; // 主选源（方便兼容单选视图）
  selectSource: (anime: DanmakuAnimeSource, ep?: DanmakuEpisode) => Promise<void>;
  // 全局时间轴偏移
  danmakuOffset: number;
  setDanmakuOffset: (offsetOrUpdater: number | ((prev: number) => number)) => void;
  followOffset: boolean;
  setFollowOffset: (follow: boolean) => void;
  // 搜索与添加野生源
  searchKeyword: string;
  setSearchKeyword: (kw: string) => void;
  searchDanmakuSources: (keyword: string) => Promise<void>;
  selectAllSources: () => Promise<void>;
  unselectAllSources: () => void;
}

export function useDanmaku({ videoTitle, episodeName, episodeIndex }: UseDanmakuOptions): UseDanmakuReturn {
  const [danmakuEnabled, setDanmakuEnabledState] = useState(true);
  const [apiUrl, setApiUrl] = useState('');
  const [comments, setComments] = useState<DanmakuComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 全网检索到的全部候选源
  const [detectedSources, setDetectedSources] = useState<DanmakuAnimeSource[]>([]);

  // 多源独立控制状态表 (key: animeId)
  const [activeSourcesMap, setActiveSourcesMap] = useState<Record<string, ActiveSourceItem>>({});

  // 缓存各源各集获取到的原始弹幕数据 (key: `${animeId}_${episodeId}` -> comments)
  const sourceCommentsCacheRef = useRef<Record<string, DanmakuComment[]>>({});
  // 全局时间轴微调与跟随
  const [danmakuOffset, setDanmakuOffsetState] = useState<number>(0);
  const [followOffset, setFollowOffsetState] = useState<boolean>(true);

  // 自定义搜索词
  const [searchKeyword, setSearchKeyword] = useState<string>(videoTitle || '');
  const fetchedKeyRef = useRef('');

  // 1. 同步剧集历史记忆
  useEffect(() => {
    if (!videoTitle) return;
    const pref = danmakuPreferenceStore.getPreference(videoTitle);
    setDanmakuOffsetState(pref.globalOffset || 0);
    setFollowOffsetState(pref.followOffset !== false);
  }, [videoTitle]);

  // 2. 同步系统 API
  useEffect(() => {
    const updateApi = () => {
      const s = settingsStore.getSettings();
      // 默认开启弹幕显示
      setDanmakuEnabledState(s.danmakuEnabled !== false);

      const userApi = userSourcesStore.getActiveDanmakuApi();
      const fallbackUrl = process.env.NEXT_PUBLIC_DANMAKU_API_URL || 'http://127.0.0.1:9321';
      setApiUrl(userApi ? userApi.url : (s.danmakuApiUrl || fallbackUrl));
    };

    updateApi();

    const unsub1 = settingsStore.subscribe(updateApi);
    const unsub2 = userSourcesStore.subscribe(updateApi);
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const setDanmakuEnabled = useCallback((v: boolean) => {
    setDanmakuEnabledState(v);
    const s = settingsStore.getSettings();
    settingsStore.saveSettings({ ...s, danmakuEnabled: v });
  }, []);

  // 更新全局时间轴偏移
  const setDanmakuOffset = useCallback(
    (offsetOrUpdater: number | ((prev: number) => number)) => {
      setDanmakuOffsetState((prev) => {
        const next = typeof offsetOrUpdater === 'function' ? offsetOrUpdater(prev) : offsetOrUpdater;
        if (videoTitle) {
          danmakuPreferenceStore.savePreference(videoTitle, { globalOffset: next });
        }
        return next;
      });
    },
    [videoTitle]
  );

  const setFollowOffset = useCallback(
    (follow: boolean) => {
      setFollowOffsetState(follow);
      if (videoTitle) {
        danmakuPreferenceStore.savePreference(videoTitle, { followOffset: follow });
      }
    },
    [videoTitle]
  );

  // 重新合并所有已启用的来源弹幕
  const remergeComments = useCallback((sourcesMap: Record<string, ActiveSourceItem>) => {
    const merged: DanmakuComment[] = [];

    for (const [animeId, item] of Object.entries(sourcesMap)) {
      if (!item.enabled) continue;
      const cacheKey = `${animeId}_${item.episodeId}`;
      const cached = sourceCommentsCacheRef.current[cacheKey] || [];
      const itemOffset = item.offset || 0;
      for (const c of cached) {
        merged.push({
          ...c,
          time: Math.max(0, c.time + itemOffset),
        });
      }
    }

    merged.sort((a, b) => a.time - b.time);
    setComments(merged);
  }, []);

  // 3. 拉取单个来源的单集弹幕
  const fetchSourceEpisodeComments = useCallback(
    async (anime: DanmakuAnimeSource, ep: DanmakuEpisode, currentApi: string) => {
      try {
        const commentsUrl = `/api/danmaku?action=comments&episodeId=${encodeURIComponent(
          String(ep.episodeId)
        )}&apiUrl=${encodeURIComponent(currentApi)}`;
        const commentsRes = await fetch(commentsUrl);
        if (!commentsRes.ok) throw new Error(`拉取弹幕失败: HTTP ${commentsRes.status}`);
        const commentsData = await commentsRes.json();

        const { comments: parsedComments, videoDuration, count } = parseDanmakuResponse(commentsData);

        const cacheKey = `${anime.animeId}_${ep.episodeId}`;
        sourceCommentsCacheRef.current[cacheKey] = parsedComments;

        return {
          animeId: anime.animeId,
          animeTitle: anime.animeTitle,
          platform: extractPlatform(anime.animeTitle + ' ' + ep.episodeTitle),
          episodeId: ep.episodeId,
          episodeTitle: ep.episodeTitle,
          videoDuration,
          commentCount: count || parsedComments.length,
        };
      } catch (err) {
        return null;
      }
    },
    []
  );

  // 4. 多源控制：单独切换某个来源开启/关闭
  const toggleSourceEnabled = useCallback(
    async (anime: DanmakuAnimeSource, forceEnabled?: boolean) => {
      if (!apiUrl) return;
      const animeIdStr = String(anime.animeId);
      const currentItem = activeSourcesMap[animeIdStr];
      const willEnable = forceEnabled !== undefined ? forceEnabled : !currentItem?.enabled;

      if (willEnable) {
        const ep = matchEpisode(anime.episodes, episodeName, episodeIndex) || anime.episodes[0];
        const cacheKey = ep ? `${animeIdStr}_${ep.episodeId}` : '';
        if (ep && !sourceCommentsCacheRef.current[cacheKey]) {
          setIsLoading(true);
          const info = await fetchSourceEpisodeComments(anime, ep, apiUrl);
          if (info) {
            const updated = {
              ...activeSourcesMap,
              [animeIdStr]: {
                ...info,
                enabled: true,
                offset: currentItem?.offset || 0,
              },
            };
            setActiveSourcesMap(updated);
            remergeComments(updated);
            setIsLoading(false);
            return;
          }
          setIsLoading(false);
        }
      }
      const updated = {
        ...activeSourcesMap,
        [animeIdStr]: {
          ...(currentItem || {
            animeId: anime.animeId,
            animeTitle: anime.animeTitle,
            platform: extractPlatform(anime.animeTitle),
            videoDuration: 0,
            commentCount: 0,
          }),
          enabled: willEnable,
          offset: currentItem?.offset || 0,
        },
      };
      setActiveSourcesMap(updated);
      remergeComments(updated);

      if (videoTitle) {
        const pref = danmakuPreferenceStore.getPreference(videoTitle);
        danmakuPreferenceStore.savePreference(videoTitle, {
          sourcesConfig: {
            ...pref.sourcesConfig,
            [animeIdStr]: {
              animeId: anime.animeId,
              enabled: willEnable,
              offset: currentItem?.offset || 0,
            },
          },
        });
      }
    },
    [activeSourcesMap, apiUrl, episodeIndex, episodeName, fetchSourceEpisodeComments, remergeComments, videoTitle]
  );

  // 5. 多源控制：单独为某个源微调偏移
  const setSourceOffset = useCallback(
    (animeId: string | number, offset: number) => {
      const animeIdStr = String(animeId);
      const currentItem = activeSourcesMap[animeIdStr];
      if (!currentItem) return;

      const updated = {
        ...activeSourcesMap,
        [animeIdStr]: {
          ...currentItem,
          offset,
        },
      };
      setActiveSourcesMap(updated);
      remergeComments(updated);

      if (videoTitle) {
        const pref = danmakuPreferenceStore.getPreference(videoTitle);
        danmakuPreferenceStore.savePreference(videoTitle, {
          sourcesConfig: {
            ...pref.sourcesConfig,
            [animeIdStr]: {
              animeId,
              enabled: currentItem.enabled,
              offset,
            },
          },
        });
      }
    },
    [activeSourcesMap, remergeComments, videoTitle]
  );
  const bindSourceEpisode = useCallback(
    async (anime: DanmakuAnimeSource, ep: DanmakuEpisode) => {
      if (!apiUrl) return;
      setIsLoading(true);
      const animeIdStr = String(anime.animeId);
      const currentItem = activeSourcesMap[animeIdStr];

      const info = await fetchSourceEpisodeComments(anime, ep, apiUrl);
      if (info) {
        const updated = {
          ...activeSourcesMap,
          [animeIdStr]: {
            ...info,
            enabled: true,
            offset: currentItem?.offset || 0,
          },
        };
        setActiveSourcesMap(updated);
        remergeComments(updated);
      }
      setIsLoading(false);
    },
    [activeSourcesMap, apiUrl, fetchSourceEpisodeComments, remergeComments]
  );

  // 7. 单选模式：一键只看该源
  const selectSource = useCallback(
    async (anime: DanmakuAnimeSource, ep?: DanmakuEpisode) => {
      if (!apiUrl) return;
      setIsLoading(true);
      setError(null);

      const targetEp = ep || matchEpisode(anime.episodes, episodeName, episodeIndex) || anime.episodes[0];
      if (!targetEp) {
        setIsLoading(false);
        return;
      }

      const info = await fetchSourceEpisodeComments(anime, targetEp, apiUrl);
      if (info) {
        const animeIdStr = String(anime.animeId);
        const newMap: Record<string, ActiveSourceItem> = {
          [animeIdStr]: {
            ...info,
            enabled: true,
            offset: activeSourcesMap[animeIdStr]?.offset || 0,
          },
        };
        setActiveSourcesMap(newMap);
        remergeComments(newMap);

        if (videoTitle) {
          danmakuPreferenceStore.savePreference(videoTitle, {
            preferredAnimeId: anime.animeId,
            preferredPlatform: extractPlatform(anime.animeTitle),
          });
        }
      }
      setIsLoading(false);
    },
    [activeSourcesMap, apiUrl, episodeIndex, episodeName, fetchSourceEpisodeComments, remergeComments, videoTitle]
  );

  // 8. 全选与全不选
  const selectAllSources = useCallback(async () => {
    if (!apiUrl || !detectedSources.length) return;
    setIsLoading(true);
    const newMap = { ...activeSourcesMap };

    for (const anime of detectedSources) {
      const animeIdStr = String(anime.animeId);
      if (!sourceCommentsCacheRef.current[animeIdStr]) {
        const ep = matchEpisode(anime.episodes, episodeName, episodeIndex) || anime.episodes[0];
        if (ep) {
          const info = await fetchSourceEpisodeComments(anime, ep, apiUrl);
          if (info) {
            newMap[animeIdStr] = {
              ...info,
              enabled: true,
              offset: newMap[animeIdStr]?.offset || 0,
            };
          }
        }
      } else if (newMap[animeIdStr]) {
        newMap[animeIdStr].enabled = true;
      }
    }

    setActiveSourcesMap(newMap);
    remergeComments(newMap);
    setIsLoading(false);
  }, [activeSourcesMap, apiUrl, detectedSources, episodeIndex, episodeName, fetchSourceEpisodeComments, remergeComments]);

  const unselectAllSources = useCallback(() => {
    const newMap: Record<string, ActiveSourceItem> = {};
    for (const [k, v] of Object.entries(activeSourcesMap)) {
      newMap[k] = { ...v, enabled: false };
    }
    setActiveSourcesMap(newMap);
    setComments([]);
  }, [activeSourcesMap]);

  // 9. 手动按关键词重搜
  const searchDanmakuSources = useCallback(
    async (kw: string) => {
      if (!apiUrl || !kw.trim()) return;
      setIsLoading(true);
      setError(null);
      try {
        const trimmed = kw.trim();
        // 如果是 URL 链接，直接走 action=url 提取该网页的原生弹幕！
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          const urlTarget = `/api/danmaku?action=url&url=${encodeURIComponent(trimmed)}&apiUrl=${encodeURIComponent(apiUrl)}`;
          const urlRes = await fetch(urlTarget);
          if (urlRes.ok) {
            const urlData = await urlRes.json();
            const { comments: parsedComments, videoDuration, count } = parseDanmakuResponse(urlData);
            const virtualId = 'url_' + Date.now();
            sourceCommentsCacheRef.current[virtualId] = parsedComments;
            const newMap: Record<string, ActiveSourceItem> = {
              ...activeSourcesMap,
              [virtualId]: {
                animeId: virtualId,
                animeTitle: '外部视频直链弹幕 (' + trimmed.slice(0, 30) + '...)',
                platform: extractPlatform(trimmed),
                episodeId: virtualId,
                episodeTitle: '当前直链',
                videoDuration,
                commentCount: count || parsedComments.length,
                enabled: true,
                offset: 0,
              },
            };
            setActiveSourcesMap(newMap);
            remergeComments(newMap);
            setIsLoading(false);
            return;
          }
        }

        // 否则走普通片名多轮检索
        const searchUrl = `/api/danmaku?action=search&keyword=${encodeURIComponent(
          trimmed
        )}&apiUrl=${encodeURIComponent(apiUrl)}`;
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) throw new Error(`搜索弹幕源失败: HTTP ${searchRes.status}`);
        const searchData = await searchRes.json();
        const results = parseSearchResults(searchData);
        setDetectedSources(results);
        // 默认自动将搜出的全部源自动加载合并！
        if (results.length > 0) {
          const newMap: Record<string, ActiveSourceItem> = {};
          for (const anime of results) {
            const ep = matchEpisode(anime.episodes, episodeName, episodeIndex) || anime.episodes[0];
            if (ep) {
              const info = await fetchSourceEpisodeComments(anime, ep, apiUrl);
              if (info) {
                newMap[String(anime.animeId)] = {
                  ...info,
                  enabled: true,
                  offset: 0,
                };
              }
            }
          }
          setActiveSourcesMap(newMap);
          remergeComments(newMap);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '检索弹幕失败');
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl, episodeIndex, episodeName, fetchSourceEpisodeComments, remergeComments]
  );

  // 10. 首次播放或换集时：默认自动加载所有检测到的有效来源并合并！
  useEffect(() => {
    if (!apiUrl || !videoTitle) {
      setComments([]);
      setDetectedSources([]);
      setActiveSourcesMap({});
      return;
    }

    let cancelled = false;

    async function autoDetectAllSources() {
      setIsLoading(true);
      setError(null);

      try {
        const pref = danmakuPreferenceStore.getPreference(videoTitle);
        if (pref.followOffset && typeof pref.globalOffset === 'number') {
          setDanmakuOffsetState(pref.globalOffset);
        }
        // 多轮去噪与主干词候选检索 (彻底解决标题带4K/第01集/压制组导致搜空的问题)
        const candidateKeywords = extractCleanKeywords(videoTitle);
        const mergedResults: DanmakuAnimeSource[] = [];

        for (const kw of candidateKeywords) {
          try {
            const searchUrl = `/api/danmaku?action=search&keyword=${encodeURIComponent(
              kw
            )}&apiUrl=${encodeURIComponent(apiUrl)}`;
            const searchRes = await fetch(searchUrl);
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              const res = parseSearchResults(searchData);
              for (const r of res) {
                if (!mergedResults.some((m) => String(m.animeId) === String(r.animeId))) {
                  mergedResults.push(r);
                }
              }
            }
          } catch {}
          if (mergedResults.length >= 2) break; // 已命中充分的源，停止后续降级
        }

        if (cancelled) return;
        // 严格正统过滤 (彻底剔除蹭热度的无关短剧) + 季度精准对齐 (第1季优先对齐第1季)
        const legitimate = mergedResults.filter((r) => isLegitimateSource(r.animeTitle, videoTitle));
        const finalResults = sortSourcesBySeason(
          legitimate.length > 0 ? legitimate : mergedResults,
          videoTitle
        );

        setDetectedSources(finalResults);
        const results = finalResults;
        if (!results.length) {
          setComments([]);
          setActiveSourcesMap({});
          setIsLoading(false);
          return;
        }

        const savedSources = pref.sourcesConfig || {};
        const hasCustomConfig = Object.keys(savedSources).length > 0;

        const newMap: Record<string, ActiveSourceItem> = {};

        // 【核心改进】：如果用户以前自定义过开启哪些，按记忆开启；
        // 如果是新视频，默认将搜索出的全部来源全选加载并合并！
        for (const anime of results) {
          const animeIdStr = String(anime.animeId);
          const shouldEnable = hasCustomConfig ? Boolean(savedSources[animeIdStr]?.enabled) : true;

          if (shouldEnable) {
            const ep = matchEpisode(anime.episodes, episodeName, episodeIndex) || anime.episodes[0];
            if (ep) {
              const info = await fetchSourceEpisodeComments(anime, ep, apiUrl);
              if (info) {
                newMap[animeIdStr] = {
                  ...info,
                  enabled: true,
                  offset: savedSources[animeIdStr]?.offset || 0,
                };
              }
            }
          }
        }

        // 如果用户以前全关了导致为空，但有结果，兜底激活第一个
        if (Object.keys(newMap).length === 0 && results.length > 0) {
          const first = results[0];
          const ep = matchEpisode(first.episodes, episodeName, episodeIndex) || first.episodes[0];
          if (ep) {
            const info = await fetchSourceEpisodeComments(first, ep, apiUrl);
            if (info) {
              newMap[String(first.animeId)] = { ...info, enabled: true, offset: 0 };
            }
          }
        }

        if (cancelled) return;

        setActiveSourcesMap(newMap);
        remergeComments(newMap);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载弹幕失败');
          setComments([]);
          setActiveSourcesMap({});
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    autoDetectAllSources();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, videoTitle, episodeName, episodeIndex, fetchSourceEpisodeComments, remergeComments]);

  // 计算一个当前活跃的主选源 (用于简单展示)
  const activeSource = Object.values(activeSourcesMap).find((s) => s.enabled) || Object.values(activeSourcesMap)[0] || null;

  return {
    danmakuEnabled,
    setDanmakuEnabled,
    comments,
    isLoading,
    error,
    detectedSources,
    activeSourcesMap,
    toggleSourceEnabled,
    setSourceOffset,
    bindSourceEpisode,
    activeSource,
    selectSource,
    danmakuOffset,
    setDanmakuOffset,
    followOffset,
    setFollowOffset,
    searchKeyword,
    setSearchKeyword,
    searchDanmakuSources,
    selectAllSources,
    unselectAllSources,
  };
}
