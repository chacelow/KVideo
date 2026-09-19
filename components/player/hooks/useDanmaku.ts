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
  extractNumber,
} from '@/lib/utils/danmaku-utils';
import type {
  DanmakuComment,
  DanmakuAnimeSource,
  DanmakuEpisode,
  DanmakuSourceInfo,
} from '@/lib/types/danmaku';

export type DanmakuSourceStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface ActiveSourceItem extends DanmakuSourceInfo {
  enabled: boolean;
  offset: number;
  status: DanmakuSourceStatus;
  error?: string;
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
  detectedSources: DanmakuAnimeSource[];
  activeSourcesMap: Record<string, ActiveSourceItem>;
  toggleSourceEnabled: (anime: DanmakuAnimeSource, enabled?: boolean) => Promise<void>;
  setSourceOffset: (animeId: string | number, offset: number) => void;
  bindSourceEpisode: (anime: DanmakuAnimeSource, episode: DanmakuEpisode) => Promise<void>;
  activeSource: DanmakuSourceInfo | null;
  selectSource: (anime: DanmakuAnimeSource, ep?: DanmakuEpisode) => Promise<void>;
  danmakuOffset: number;
  setDanmakuOffset: (offsetOrUpdater: number | ((prev: number) => number)) => void;
  followOffset: boolean;
  setFollowOffset: (follow: boolean) => void;
  searchKeyword: string;
  setSearchKeyword: (kw: string) => void;
  searchDanmakuSources: (keyword: string) => Promise<void>;
  selectAllSources: () => Promise<void>;
  unselectAllSources: () => void;
  refreshSource: (anime: DanmakuAnimeSource) => Promise<void>;
  refreshSources: () => Promise<void>;
}

type LoadedSource = Omit<ActiveSourceItem, 'enabled' | 'offset'>;
const MIN_SOURCE_MATCH_SCORE = 50;

function sourceMatchScore(anime: DanmakuAnimeSource, title: string, episodeNumber: number | null): number {
  const sourceTitle = anime.animeTitle.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();
  const requestedTitle = title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase();
  if (requestedTitle.length < 2 || (!sourceTitle.includes(requestedTitle) && !requestedTitle.includes(sourceTitle))) return 0;
  const hasEpisode = episodeNumber !== null
    && anime.episodes.some((episode) => extractNumber(episode.episodeTitle) === episodeNumber);
  return 80 + (hasEpisode ? 20 : 0);
}

function isRelevantSource(anime: DanmakuAnimeSource, title: string, episodeNumber: number | null): boolean {
  return sourceMatchScore(anime, title, episodeNumber) >= MIN_SOURCE_MATCH_SCORE;
}


export function useDanmaku({ videoTitle, episodeName, episodeIndex }: UseDanmakuOptions): UseDanmakuReturn {
  const [danmakuEnabled, setDanmakuEnabledState] = useState(true);
  const [apiUrl, setApiUrl] = useState('');
  const [comments, setComments] = useState<DanmakuComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedSources, setDetectedSources] = useState<DanmakuAnimeSource[]>([]);
  const [activeSourcesMap, setActiveSourcesMap] = useState<Record<string, ActiveSourceItem>>({});
  const [danmakuOffset, setDanmakuOffsetState] = useState(0);
  const [followOffset, setFollowOffsetState] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState(videoTitle || '');

  const activeSourcesRef = useRef<Record<string, ActiveSourceItem>>({});
  const detectedSourcesRef = useRef<DanmakuAnimeSource[]>([]);
  const sourceCommentsCacheRef = useRef<Record<string, DanmakuComment[]>>({});
  const loadGenerationRef = useRef(0);
  const sourceRequestRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!videoTitle) return;
    const pref = danmakuPreferenceStore.getPreference(videoTitle);
    setDanmakuOffsetState(pref.globalOffset || 0);
    setFollowOffsetState(pref.followOffset !== false);
  }, [videoTitle]);

  useEffect(() => {
    const updateApi = () => {
      const settings = settingsStore.getSettings();
      setDanmakuEnabledState(settings.danmakuEnabled !== false);
      const userApi = userSourcesStore.getActiveDanmakuApi();
      const fallbackUrl = process.env.NEXT_PUBLIC_DANMAKU_API_URL || 'http://127.0.0.1:9321';
      setApiUrl(userApi ? userApi.url : (settings.danmakuApiUrl || fallbackUrl));
    };
    updateApi();
    const unsubscribeSettings = settingsStore.subscribe(updateApi);
    const unsubscribeSources = userSourcesStore.subscribe(updateApi);
    return () => {
      unsubscribeSettings();
      unsubscribeSources();
    };
  }, []);

  const setDanmakuEnabled = useCallback((enabled: boolean) => {
    setDanmakuEnabledState(enabled);
    settingsStore.saveSettings({ ...settingsStore.getSettings(), danmakuEnabled: enabled });
  }, []);

  const setDanmakuOffset = useCallback((value: number | ((prev: number) => number)) => {
    setDanmakuOffsetState((previous) => {
      const next = typeof value === 'function' ? value(previous) : value;
      if (videoTitle) danmakuPreferenceStore.savePreference(videoTitle, { globalOffset: next });
      return next;
    });
  }, [videoTitle]);

  const setFollowOffset = useCallback((follow: boolean) => {
    setFollowOffsetState(follow);
    if (videoTitle) danmakuPreferenceStore.savePreference(videoTitle, { followOffset: follow });
  }, [videoTitle]);

  const cacheKey = useCallback((currentApi: string, animeId: string | number, episodeId: string | number) =>
    `${currentApi}\u0000${animeId}\u0000${episodeId}`, []);

  const remergeComments = useCallback((sourcesMap: Record<string, ActiveSourceItem>) => {
    const merged: DanmakuComment[] = [];
    for (const item of Object.values(sourcesMap)) {
      if (!item.enabled || item.episodeId === undefined) continue;
      const cached = sourceCommentsCacheRef.current[cacheKey(apiUrl, item.animeId, item.episodeId)] || [];
      for (const comment of cached) {
        merged.push({ ...comment, time: Math.max(0, comment.time + (item.offset || 0)) });
      }
    }
    merged.sort((a, b) => a.time - b.time);
    setComments(merged);
  }, [apiUrl, cacheKey]);

  const persistMap = useCallback((sourcesMap: Record<string, ActiveSourceItem>, preferred?: DanmakuAnimeSource) => {
    if (!videoTitle) return;
    const sourcesConfig = Object.fromEntries(Object.entries(sourcesMap).map(([id, item]) => [id, {
      animeId: item.animeId,
      platform: item.platform,
      enabled: item.enabled,
      offset: item.offset,
    }]));
    danmakuPreferenceStore.savePreference(videoTitle, {
      sourcesConfig,
      ...(preferred ? {
        preferredAnimeId: preferred.animeId,
        preferredPlatform: extractPlatform(preferred.animeTitle),
      } : {}),
    });
  }, [videoTitle]);

  const commitMap = useCallback((next: Record<string, ActiveSourceItem>, persist = false, preferred?: DanmakuAnimeSource) => {
    activeSourcesRef.current = next;
    setActiveSourcesMap(next);
    remergeComments(next);
    if (persist) persistMap(next, preferred);
  }, [persistMap, remergeComments]);

  const sourceShell = useCallback((anime: DanmakuAnimeSource, enabled: boolean, offset: number, status: DanmakuSourceStatus = 'loading'): ActiveSourceItem => ({
    animeId: anime.animeId,
    animeTitle: anime.animeTitle,
    platform: extractPlatform(anime.animeTitle),
    enabled,
    offset,
    status,
  }), []);

  const fetchSourceEpisodeComments = useCallback(async (
    anime: DanmakuAnimeSource,
    episode: DanmakuEpisode,
    currentApi: string,
    force = false
  ): Promise<LoadedSource> => {
    const key = cacheKey(currentApi, anime.animeId, episode.episodeId);
    if (!force && Object.prototype.hasOwnProperty.call(sourceCommentsCacheRef.current, key)) {
      const cached = sourceCommentsCacheRef.current[key];
      return {
        animeId: anime.animeId,
        animeTitle: anime.animeTitle,
        platform: extractPlatform(`${anime.animeTitle} ${episode.episodeTitle}`),
        episodeId: episode.episodeId,
        episodeTitle: episode.episodeTitle,
        commentCount: cached.length,
        status: cached.length ? 'ready' : 'empty',
      };
    }
    try {
      const url = `/api/danmaku?action=comments&episodeId=${encodeURIComponent(String(episode.episodeId))}&apiUrl=${encodeURIComponent(currentApi)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`拉取弹幕失败: HTTP ${response.status}`);
      const data = await response.json();
      const parsed = parseDanmakuResponse(data);
      sourceCommentsCacheRef.current[key] = parsed.comments;
      return {
        animeId: anime.animeId,
        animeTitle: anime.animeTitle,
        platform: extractPlatform(`${anime.animeTitle} ${episode.episodeTitle}`),
        episodeId: episode.episodeId,
        episodeTitle: episode.episodeTitle,
        videoDuration: parsed.videoDuration,
        commentCount: parsed.count || parsed.comments.length,
        status: parsed.comments.length ? 'ready' : 'empty',
      };
    } catch (reason) {
      return {
        animeId: anime.animeId,
        animeTitle: anime.animeTitle,
        platform: extractPlatform(`${anime.animeTitle} ${episode.episodeTitle}`),
        episodeId: episode.episodeId,
        episodeTitle: episode.episodeTitle,
        status: 'error',
        error: reason instanceof Error ? reason.message : '加载弹幕失败',
      };
    }
  }, [cacheKey]);

  const loadSource = useCallback(async (anime: DanmakuAnimeSource, episode: DanmakuEpisode, force = false) => {
    if (!apiUrl) return;
    const id = String(anime.animeId);
    const generation = loadGenerationRef.current;
    const request = (sourceRequestRef.current[id] || 0) + 1;
    sourceRequestRef.current[id] = request;
    const before = activeSourcesRef.current[id] || sourceShell(anime, false, 0);
    commitMap({ ...activeSourcesRef.current, [id]: { ...before, episodeId: episode.episodeId, episodeTitle: episode.episodeTitle, status: 'loading', error: undefined } });
    const loaded = await fetchSourceEpisodeComments(anime, episode, apiUrl, force);
    if (sourceRequestRef.current[id] !== request || loadGenerationRef.current !== generation) return;
    const current = activeSourcesRef.current[id] || before;
    commitMap({ ...activeSourcesRef.current, [id]: { ...loaded, enabled: current.enabled, offset: current.offset } });
  }, [apiUrl, commitMap, fetchSourceEpisodeComments, sourceShell]);

  const toggleSourceEnabled = useCallback(async (anime: DanmakuAnimeSource, forced?: boolean) => {
    const id = String(anime.animeId);
    const current = activeSourcesRef.current[id];
    const enabled = forced ?? !current?.enabled;
    const next = { ...activeSourcesRef.current, [id]: { ...(current || sourceShell(anime, enabled, 0)), enabled } };
    commitMap(next, true, enabled ? anime : undefined);
    if (!enabled || !apiUrl) return;
    const episode = matchEpisode(anime.episodes, episodeName, episodeIndex);
    if (!episode) return;
    const key = cacheKey(apiUrl, anime.animeId, episode.episodeId);
    if (!Object.prototype.hasOwnProperty.call(sourceCommentsCacheRef.current, key)) await loadSource(anime, episode);
  }, [apiUrl, cacheKey, commitMap, episodeIndex, episodeName, loadSource, sourceShell]);

  const setSourceOffset = useCallback((animeId: string | number, offset: number) => {
    const id = String(animeId);
    const current = activeSourcesRef.current[id];
    if (!current) return;
    commitMap({ ...activeSourcesRef.current, [id]: { ...current, offset } }, true);
  }, [commitMap]);

  const bindSourceEpisode = useCallback(async (anime: DanmakuAnimeSource, episode: DanmakuEpisode) => {
    const id = String(anime.animeId);
    const current = activeSourcesRef.current[id] || sourceShell(anime, true, 0);
    commitMap({ ...activeSourcesRef.current, [id]: { ...current, enabled: true, episodeId: episode.episodeId, episodeTitle: episode.episodeTitle } }, true, anime);
    await loadSource(anime, episode);
  }, [commitMap, loadSource, sourceShell]);

  const selectSource = useCallback(async (anime: DanmakuAnimeSource, episode?: DanmakuEpisode) => {
    const selectedEpisode = episode || matchEpisode(anime.episodes, episodeName, episodeIndex);
    const id = String(anime.animeId);
    const previous = activeSourcesRef.current[id];
    const next = Object.fromEntries(Object.entries(activeSourcesRef.current).map(([key, item]) => [key, { ...item, enabled: key === id }]));
    next[id] = { ...(previous || sourceShell(anime, true, 0)), enabled: true };
    commitMap(next, true, anime);
    if (selectedEpisode) await loadSource(anime, selectedEpisode);
  }, [commitMap, episodeIndex, episodeName, loadSource, sourceShell]);

  const selectAllSources = useCallback(async () => {
    const next = { ...activeSourcesRef.current };
    for (const anime of detectedSourcesRef.current) {
      const id = String(anime.animeId);
      next[id] = { ...(next[id] || sourceShell(anime, true, 0)), enabled: true };
    }
    commitMap(next, true);
    await Promise.all(detectedSourcesRef.current.map(async (anime) => {
      const episode = matchEpisode(anime.episodes, episodeName, episodeIndex);
      if (episode) await loadSource(anime, episode);
    }));
  }, [commitMap, episodeIndex, episodeName, loadSource, sourceShell]);

  const unselectAllSources = useCallback(() => {
    const next = Object.fromEntries(Object.entries(activeSourcesRef.current).map(([id, item]) => [id, { ...item, enabled: false }]));
    commitMap(next, true);
  }, [commitMap]);

  const refreshSource = useCallback(async (anime: DanmakuAnimeSource) => {
    const current = activeSourcesRef.current[String(anime.animeId)];
    const episode = anime.episodes.find((candidate) => String(candidate.episodeId) === String(current?.episodeId))
      || matchEpisode(anime.episodes, episodeName, episodeIndex);
    if (episode) await loadSource(anime, episode, true);
  }, [episodeIndex, episodeName, loadSource]);

  const refreshSources = useCallback(async () => {
    await Promise.all(detectedSourcesRef.current.map(refreshSource));
  }, [refreshSource]);

  const applyDetectedSources = useCallback(async (sources: DanmakuAnimeSource[], generation: number) => {
    if (generation !== loadGenerationRef.current) return;
    detectedSourcesRef.current = sources;
    setDetectedSources(sources);
    const preference = danmakuPreferenceStore.getPreference(videoTitle);
    const saved = preference.sourcesConfig || {};
    const hasExplicitSelection = Object.keys(saved).length > 0;
    const trustedPlatforms = new Set(
      Object.values(saved)
        .filter((item) => item.enabled && item.platform)
        .map((item) => item.platform as string)
    );
    if (!hasExplicitSelection && preference.preferredPlatform) trustedPlatforms.add(preference.preferredPlatform);
    const next: Record<string, ActiveSourceItem> = {};
    for (const anime of sources) {
      const id = String(anime.animeId);
      const config = saved[id];
      const platform = extractPlatform(anime.animeTitle);
      const explicitlyDisabledPlatform = Object.values(saved).some((item) => item.platform === platform && !item.enabled);
      const trustsPlatform = !explicitlyDisabledPlatform && trustedPlatforms.has(platform);
      const enabled = config ? config.enabled : (!hasExplicitSelection || trustsPlatform);
      const matchedEpisode = matchEpisode(anime.episodes, episodeName, episodeIndex);
      next[id] = sourceShell(anime, enabled, config?.offset || 0, matchedEpisode ? 'loading' : 'empty');
    }
    commitMap(next);

    await Promise.all(sources.map(async (anime) => {
      const episode = matchEpisode(anime.episodes, episodeName, episodeIndex);
      if (episode) await loadSource(anime, episode);
    }));
  }, [commitMap, episodeIndex, episodeName, loadSource, sourceShell, videoTitle]);

  const searchDanmakuSources = useCallback(async (keyword: string) => {
    if (!apiUrl || !keyword.trim()) return;
    const generation = ++loadGenerationRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const trimmed = keyword.trim();
      if (/^https?:\/\//.test(trimmed)) {
        const response = await fetch(`/api/danmaku?action=url&url=${encodeURIComponent(trimmed)}&apiUrl=${encodeURIComponent(apiUrl)}`);
        if (!response.ok) throw new Error(`加载直链弹幕失败: HTTP ${response.status}`);
        const parsed = parseDanmakuResponse(await response.json());
        if (generation !== loadGenerationRef.current) return;
        const id = `url_${Date.now()}`;
        sourceCommentsCacheRef.current[cacheKey(apiUrl, id, id)] = parsed.comments;
        const item: ActiveSourceItem = {
          animeId: id,
          animeTitle: `外部视频直链弹幕 (${trimmed.slice(0, 30)}...)`,
          platform: extractPlatform(trimmed),
          episodeId: id,
          episodeTitle: '当前直链',
          videoDuration: parsed.videoDuration,
          commentCount: parsed.count || parsed.comments.length,
          enabled: true,
          offset: 0,
          status: parsed.comments.length ? 'ready' : 'empty',
        };
        commitMap({ ...activeSourcesRef.current, [id]: item }, true);
        return;
      }
      const response = await fetch(`/api/danmaku?action=search&keyword=${encodeURIComponent(trimmed)}&apiUrl=${encodeURIComponent(apiUrl)}`);
      if (!response.ok) throw new Error(`搜索弹幕源失败: HTTP ${response.status}`);
      const targetEpisode = extractNumber(episodeName) || (episodeIndex !== undefined ? episodeIndex + 1 : null);
      const results = parseSearchResults(await response.json())
        .filter((source) => isRelevantSource(source, trimmed, targetEpisode))
        .sort((a, b) => sourceMatchScore(b, trimmed, targetEpisode) - sourceMatchScore(a, trimmed, targetEpisode));
      await applyDetectedSources(results, generation);
    } catch (reason) {
      if (generation === loadGenerationRef.current) setError(reason instanceof Error ? reason.message : '检索弹幕失败');
    } finally {
      if (generation === loadGenerationRef.current) setIsLoading(false);
    }
  }, [apiUrl, applyDetectedSources, cacheKey, commitMap, episodeIndex, episodeName]);

  useEffect(() => {
    if (!apiUrl || !videoTitle) {
      loadGenerationRef.current += 1;
      detectedSourcesRef.current = [];
      activeSourcesRef.current = {};
      setDetectedSources([]);
      setActiveSourcesMap({});
      setComments([]);
      return;
    }
    const generation = ++loadGenerationRef.current;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const detect = async () => {
      try {
        const merged = new Map<string, DanmakuAnimeSource>();
        for (const keyword of extractCleanKeywords(videoTitle)) {
          const response = await fetch(`/api/danmaku?action=search&keyword=${encodeURIComponent(keyword)}&apiUrl=${encodeURIComponent(apiUrl)}`);
          if (!response.ok) continue;
          for (const source of parseSearchResults(await response.json())) merged.set(String(source.animeId), source);
        }
        if (cancelled || generation !== loadGenerationRef.current) return;
        const candidateTitles = extractCleanKeywords(videoTitle);
        const targetEpisode = extractNumber(episodeName) || (episodeIndex !== undefined ? episodeIndex + 1 : null);
        const savedSources = danmakuPreferenceStore.getPreference(videoTitle).sourcesConfig || {};
        const matchScore = (source: DanmakuAnimeSource) => Math.max(
          0,
          ...candidateTitles.map((candidate) => sourceMatchScore(source, candidate, targetEpisode))
        );
        const sorted = [...merged.values()]
          .filter((source) => savedSources[String(source.animeId)] || matchScore(source) >= MIN_SOURCE_MATCH_SCORE)
          .sort((a, b) => matchScore(b) - matchScore(a));
        await applyDetectedSources(sorted, generation);
      } catch (reason) {
        if (!cancelled && generation === loadGenerationRef.current) setError(reason instanceof Error ? reason.message : '加载弹幕失败');
      } finally {
        if (!cancelled && generation === loadGenerationRef.current) setIsLoading(false);
      }
    };
    void detect();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, videoTitle, episodeName, episodeIndex, applyDetectedSources]);

  const activeSource = Object.values(activeSourcesMap).find((source) => source.enabled)
    || Object.values(activeSourcesMap)[0]
    || null;

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
    refreshSource,
    refreshSources,
  };
}
