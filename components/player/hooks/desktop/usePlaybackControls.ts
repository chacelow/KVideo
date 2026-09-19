import { useCallback, useEffect, useMemo, useRef } from 'react';
import { formatTime } from '@/lib/utils/format-utils';
import { usePlaybackPolling } from '../usePlaybackPolling';

interface UsePlaybackControlsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    setIsLoading: (loading: boolean) => void;
    initialTime: number;
    src: string;
    shouldAutoPlay: boolean;
    setDuration: (duration: number) => void;
    setBufferedTime: (time: number) => void;
    setCurrentTime: (time: number) => void;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onError?: (error: string) => void;
    isDraggingProgressRef: React.MutableRefObject<boolean>;
    speedMenuTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
    playbackRate: number;
    setPlaybackRate: (rate: number) => void;
    setShowSpeedMenu: (show: boolean) => void;
    volume: number;
    isMuted: boolean;
}

export function usePlaybackControls({
    videoRef,
    isPlaying,
    setIsPlaying,
    setIsLoading,
    src,
    initialTime,
    shouldAutoPlay,
    setDuration,
    setBufferedTime,
    setCurrentTime,
    onTimeUpdate,
    onError,
    isDraggingProgressRef,
    speedMenuTimeoutRef,
    playbackRate,
    setPlaybackRate,
    setShowSpeedMenu,
    volume,
    isMuted
}: UsePlaybackControlsProps) {
    const pendingInitialSeekSrcRef = useRef(src);

    useEffect(() => {
        pendingInitialSeekSrcRef.current = src;
    }, [src]);
    const updateBufferedTime = useCallback(() => {
        if (!videoRef.current) return;

        const video = videoRef.current;
        const { buffered, currentTime } = video;
        let bufferedEnd = 0;

        for (let index = 0; index < buffered.length; index += 1) {
            const rangeStart = buffered.start(index);
            const rangeEnd = buffered.end(index);

            if (currentTime >= rangeStart && currentTime <= rangeEnd + 0.25) {
                bufferedEnd = rangeEnd;
                break;
            }

            bufferedEnd = Math.max(bufferedEnd, rangeEnd);
        }

        setBufferedTime(bufferedEnd);
    }, [setBufferedTime, videoRef]);

    const togglePlay = useCallback(() => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    // Ignore AbortError: The play() request was interrupted by a call to pause().
                    if (error.name !== 'AbortError') {
                        console.error('Playback failed:', error);
                    }
                });
            }
        }
    }, [isPlaying, videoRef]);

    const handlePlay = useCallback(() => setIsPlaying(true), [setIsPlaying]);
    const handlePause = useCallback(() => setIsPlaying(false), [setIsPlaying]);

    const handleTimeUpdateEvent = useCallback(() => {
        if (!videoRef.current || isDraggingProgressRef.current) return;
        const current = videoRef.current.currentTime;
        const total = videoRef.current.duration;
        setCurrentTime(current);
        setDuration(total);
        updateBufferedTime();
        if (onTimeUpdate) {
            onTimeUpdate(current, total);
        }
    }, [videoRef, isDraggingProgressRef, setCurrentTime, setDuration, updateBufferedTime, onTimeUpdate]);

    const handleLoadedMetadata = useCallback(() => {
        if (!videoRef.current) return;
        setDuration(videoRef.current.duration);
        updateBufferedTime();
        // Removed setIsLoading(false) because metadata loading is too early.
        // We wait for onCanPlay to set isLoading to false.

        if (pendingInitialSeekSrcRef.current === src) {
            videoRef.current.currentTime = initialTime > 0 ? initialTime : 0.1;
            pendingInitialSeekSrcRef.current = '';
        }

        // Apply saved playback rate when new source loads (for episode changes)
        if (playbackRate !== 1 && videoRef.current.playbackRate !== playbackRate) {
            videoRef.current.playbackRate = playbackRate;
        }

        // Apply saved volume and mute state when new source loads
        videoRef.current.volume = isMuted ? 0 : volume;
        videoRef.current.muted = isMuted;

        videoRef.current.play().catch((err: Error) => {
            console.warn('Autoplay was prevented:', err);
        });
    }, [videoRef, setDuration, updateBufferedTime, src, initialTime, playbackRate, volume, isMuted]);

    useEffect(() => {
        if (initialTime <= 0 || !videoRef.current || pendingInitialSeekSrcRef.current !== src) return;
        if (videoRef.current.readyState >= HTMLMediaElement.HAVE_METADATA) {
            videoRef.current.currentTime = initialTime;
            pendingInitialSeekSrcRef.current = '';
        }
    }, [initialTime, src, videoRef]);

    // Force autoplay when shouldAutoPlay is true (for proxy retry)
    useEffect(() => {
        if (shouldAutoPlay && videoRef.current) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch((err: Error) => {
                    console.warn('Force autoplay was prevented:', err);
                });
            }
        }
    }, [shouldAutoPlay, videoRef]);

    const handleVideoError = useCallback(() => {
        setIsLoading(false);
        if (onError) {
            onError('Video failed to load');
        }
    }, [setIsLoading, onError]);

    const handleProgressEvent = useCallback(() => {
        updateBufferedTime();
    }, [updateBufferedTime]);

    const changePlaybackSpeed = useCallback((speed: number) => {
        if (!videoRef.current) return;
        videoRef.current.playbackRate = speed;
        setPlaybackRate(speed);
        // Persist playback rate to localStorage
        localStorage.setItem('kvideo-playback-rate', speed.toString());
        setShowSpeedMenu(false);
        if (speedMenuTimeoutRef.current) {
            clearTimeout(speedMenuTimeoutRef.current);
        }
    }, [videoRef, setPlaybackRate, setShowSpeedMenu, speedMenuTimeoutRef]);

    // Polling fallback for AirPlay and throttled events
    usePlaybackPolling({
        isPlaying,
        videoRef,
        isDraggingProgressRef,
        setCurrentTime,
        setDuration,
        setIsPlaying
    });

    const playbackActions = useMemo(() => ({
        togglePlay,
        handlePlay,
        handlePause,
        handleTimeUpdateEvent,
        handleLoadedMetadata,
        handleProgressEvent,
        handleVideoError,
        changePlaybackSpeed,
        formatTime
    }), [
        togglePlay,
        handlePlay,
        handlePause,
        handleTimeUpdateEvent,
        handleLoadedMetadata,
        handleProgressEvent,
        handleVideoError,
        changePlaybackSpeed
    ]);

    return playbackActions;
}
