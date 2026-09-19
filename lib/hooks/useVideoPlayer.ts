'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { settingsStore } from '@/lib/store/settings-store';

interface VideoData {
  vod_id: string;
  vod_name: string;
  vod_pic?: string;
  vod_content?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_year?: string;
  vod_area?: string;
  type_name?: string;
  episodes?: Array<{ name?: string; url: string }>;
}

export interface UseVideoPlayerReturn {
  videoData: VideoData | null;
  loading: boolean;
  videoError: string;
  currentEpisode: number;
  playUrl: string;
  activeVideoId: string | null;
  activeSource: string | null;
  resumePosition: number | null;
  setCurrentEpisode: (index: number) => void;
  setPlayUrl: (url: string) => void;
  setVideoError: (error: string) => void;
  fetchVideoDetails: () => Promise<void>;
  switchSource: (targetId: string, targetSource: string, position: number) => Promise<void>;
}

export function useVideoPlayer(
  videoId: string | null,
  source: string | null,
  episodeParam: string | null,
  isReversed: boolean = false,
  onSourceUnavailable?: () => void
): UseVideoPlayerReturn {
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(!!(videoId && source));
  const [currentEpisode, setCurrentEpisodeState] = useState(0);
  const [playUrl, setPlayUrl] = useState('');
  const [videoError, setVideoError] = useState<string>('');
  const [activeVideoId, setActiveVideoId] = useState<string | null>(videoId);
  const [activeSource, setActiveSource] = useState<string | null>(source);
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  const requestSequenceRef = useRef(0);
  const activeVideoIdRef = useRef(videoId);
  const activeSourceRef = useRef(source);
  const currentEpisodeRef = useRef(0);
  const episodeParamRef = useRef(episodeParam);
  const isReversedRef = useRef(isReversed);
  const onSourceUnavailableRef = useRef(onSourceUnavailable);

  useEffect(() => {
    episodeParamRef.current = episodeParam;
  }, [episodeParam]);

  useEffect(() => {
    isReversedRef.current = isReversed;
  }, [isReversed]);

  useEffect(() => {
    onSourceUnavailableRef.current = onSourceUnavailable;
  }, [onSourceUnavailable]);

  const setCurrentEpisode = useCallback((index: number) => {
    currentEpisodeRef.current = index;
    setResumePosition(null);
    setCurrentEpisodeState(index);
  }, []);

  const loadVideoDetails = useCallback(async (
    targetVideoId: string,
    targetSource: string,
    requestedEpisode: number | null,
    position: number | null,
  ) => {
    const requestSequence = ++requestSequenceRef.current;
    setVideoError('');
    setLoading(true);

    try {
      const settings = settingsStore.getSettings();
      const allSources = [
        ...settings.sources,
        ...settings.premiumSources,
        ...settings.subscriptions,
      ];
      const sourceConfig = allSources.find((item) => item.id === targetSource);
      const response = sourceConfig
        ? await fetch('/api/detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: targetVideoId, source: sourceConfig }),
          })
        : await fetch(`/api/detail?id=${encodeURIComponent(targetVideoId)}&source=${encodeURIComponent(targetSource)}`);
      const data = await response.json();

      if (requestSequence !== requestSequenceRef.current) return;

      const sourceUnavailable =
        response.status === 404 ||
        (response.status === 400 && typeof data?.error === 'string' && data.error.toLowerCase().includes('source')) ||
        (typeof data?.error === 'string' && data.error.includes('视频源不可用'));

      if (!response.ok) {
        if (sourceUnavailable) {
          setVideoError(data.error || '该视频源不可用。请返回并尝试其他来源。');
          onSourceUnavailableRef.current?.();
          return;
        }
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!data.success || !data.data) {
        throw new Error(data.error || '来自 API 的响应无效');
      }

      const nextVideoData = data.data as VideoData;
      if (!nextVideoData.episodes?.length) {
        setVideoError('该来源没有可播放的剧集');
        return;
      }

      const defaultIndex = isReversedRef.current ? nextVideoData.episodes.length - 1 : 0;
      const validIndex = requestedEpisode !== null && requestedEpisode >= 0 && requestedEpisode < nextVideoData.episodes.length
        ? requestedEpisode
        : defaultIndex;

      activeVideoIdRef.current = targetVideoId;
      activeSourceRef.current = targetSource;
      currentEpisodeRef.current = validIndex;
      setActiveVideoId(targetVideoId);
      setActiveSource(targetSource);
      setVideoData(nextVideoData);
      setCurrentEpisodeState(validIndex);
      setResumePosition(position === null ? null : Math.max(0, Number.isFinite(position) ? position : 0));
      setPlayUrl(nextVideoData.episodes[validIndex].url);
    } catch (error) {
      if (requestSequence !== requestSequenceRef.current) return;
      console.error('Failed to fetch video details:', error);
      setVideoError(error instanceof Error ? error.message : '加载视频详情失败。');
    } finally {
      if (requestSequence === requestSequenceRef.current) setLoading(false);
    }
  }, []);

  const fetchVideoDetails = useCallback(async () => {
    const targetVideoId = activeVideoIdRef.current;
    const targetSource = activeSourceRef.current;
    if (!targetVideoId || !targetSource) return;

    const parsedEpisode = episodeParamRef.current === null ? NaN : Number.parseInt(episodeParamRef.current, 10);
    await loadVideoDetails(
      targetVideoId,
      targetSource,
      Number.isNaN(parsedEpisode) ? currentEpisodeRef.current : parsedEpisode,
      resumePosition,
    );
  }, [loadVideoDetails, resumePosition]);

  const switchSource = useCallback(async (targetId: string, targetSource: string, position: number) => {
    if (!targetId || !targetSource) return;
    await loadVideoDetails(targetId, targetSource, currentEpisodeRef.current, position);
  }, [loadVideoDetails]);



  // EFFECT: Retry logic when settings change (e.g., sources loaded from subscriptions)
  useEffect(() => {
    if (!activeVideoId || !activeSource || !videoError) return;

    const unsubscribe = settingsStore.subscribe(() => {
      const settings = settingsStore.getSettings();
      const allSources = [...settings.sources, ...settings.premiumSources, ...settings.subscriptions];
      if (allSources.some((item) => item.id === activeSource)) {
        fetchVideoDetails();
      }
    });

    return () => unsubscribe();
  }, [activeVideoId, activeSource, videoError, fetchVideoDetails]);

  useEffect(() => {
    if (!videoData?.episodes || episodeParam === null) return;
    const index = Number.parseInt(episodeParam, 10);
    if (!Number.isNaN(index) && index >= 0 && index < videoData.episodes.length && index !== currentEpisodeRef.current) {
      currentEpisodeRef.current = index;
      setCurrentEpisodeState(index);
      setResumePosition(null);
      setPlayUrl(videoData.episodes[index].url);
    }
  }, [episodeParam, videoData]);

  useEffect(() => {
    if (!videoId || !source) return;
    activeVideoIdRef.current = videoId;
    activeSourceRef.current = source;
    const parsedEpisode = episodeParam === null ? NaN : Number.parseInt(episodeParam, 10);
    loadVideoDetails(videoId, source, Number.isNaN(parsedEpisode) ? null : parsedEpisode, null);
  }, [videoId, source, loadVideoDetails]);

  return {
    videoData,
    loading,
    videoError,
    currentEpisode,
    playUrl,
    activeVideoId,
    activeSource,
    resumePosition,
    setCurrentEpisode,
    setPlayUrl,
    setVideoError,
    fetchVideoDetails,
    switchSource,
  };
}
