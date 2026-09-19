'use client';

import React, { useRef, useEffect, useCallback, useSyncExternalStore } from 'react';
import type { DanmakuComment } from '@/lib/types/danmaku';
import {
  danmakuPreferenceStore,
  type DanmakuGlobalConfig,
} from '@/lib/store/danmaku-preference-store';
import {
  clampDanmakuY,
  haveDanmakuCanvasMetricsChanged,
  resolveDanmakuCanvasMetrics,
  scaleDanmakuCoordinate,
  type DanmakuCanvasMetrics,
} from '@/lib/player/danmaku-canvas-utils';

interface DanmakuCanvasProps {
  comments: DanmakuComment[];
  currentTime: number;
  isPlaying: boolean;
  duration: number;
}

interface ActiveDanmaku {
  comment: DanmakuComment & { _expiry?: number };
  x: number;
  y: number;
  speed: number;
  width: number;
  lane: number;
  rawBaseText?: string; // 原始纯净文本（用于聚合比对）
  repeatCount?: number; // 重复出现的次数 (x N)
  isTopMerged?: boolean; // 是否已聚合成顶部弹幕
}

const LANE_HEIGHT_FACTOR = 1.35;
const TOP_BOTTOM_DURATION = 4;
const MAX_LANES = 24;

function readCssPixelValue(value: string): number | undefined {
  if (!value.endsWith('px')) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readCanvasMetrics(canvas: HTMLCanvasElement): DanmakuCanvasMetrics | null {
  const style = window.getComputedStyle(canvas);
  const rect = canvas.getBoundingClientRect();

  return resolveDanmakuCanvasMetrics({
    computedWidth: readCssPixelValue(style.width),
    computedHeight: readCssPixelValue(style.height),
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight,
    offsetWidth: canvas.offsetWidth,
    offsetHeight: canvas.offsetHeight,
    boundingWidth: rect.width,
    boundingHeight: rect.height,
    devicePixelRatio: window.devicePixelRatio,
  });
}

/**
 * 净化弹幕文本：过滤 ♡、点赞数、Like 等互动尾缀
 */
function cleanCommentText(rawText: string, cleanLike: boolean): string {
  if (!rawText) return '';
  let text = rawText.trim();
  if (cleanLike) {
    text = text
      .replace(/[\u200a-\u200f]*[♡❤️👍♥️like]+[\d\s]*$/gi, '')
      .replace(/\s*like:\s*\d+/gi, '')
      .replace(/\s*unlike:\s*\d+/gi, '')
      .trim();
  }
  return text;
}

/**
 * 智能拦截过滤器 (屏蔽词、正则、刷屏重复字符、无意义打卡、超长弹幕)
 */
function shouldFilterComment(text: string, c: DanmakuComment, config: DanmakuGlobalConfig): boolean {
  const type = c.type || 'scroll';
  if (type === 'scroll' && !config.showScroll) return true;
  if (type === 'top' && !config.showTop) return true;
  if (type === 'bottom' && !config.showBottom) return true;

  if (!text) return true;

  // 1. 超长弹幕拦截 (防小作文挡视线)
  if (config.blockMaxLength > 0 && text.length > config.blockMaxLength) return true;

  // 2. 连续重复字符刷屏拦截 (如 哈哈哈哈哈哈, 6666666, ？？？？)
  if (config.blockRepetitive && /(.)\1{3,}/.test(text)) return true;

  // 3. 无意义打卡签到拦截
  if (config.blockSpamPhrases) {
    if (
      /(打卡|签到|前排|第一|来啦|来了|留念|考古|周目|二刷|三刷|四刷|五刷|全剧终|大结局|弹幕护体|护眼)/i.test(
        text
      )
    ) {
      return true;
    }
  }

  // 4. 用户自定义屏蔽词与正则表达式
  if (config.blockedWords && config.blockedWords.length > 0) {
    const lowerText = text.toLowerCase();
    for (const word of config.blockedWords) {
      if (!word) continue;
      if (word.startsWith('/') && word.lastIndexOf('/') > 0) {
        const lastSlash = word.lastIndexOf('/');
        const pattern = word.slice(1, lastSlash);
        const flags = word.slice(lastSlash + 1);
        try {
          const reg = new RegExp(pattern, flags);
          if (reg.test(text)) return true;
        } catch {}
      } else {
        if (lowerText.includes(word.toLowerCase())) return true;
      }
    }
  }

  return false;
}

export function DanmakuCanvas({ comments, currentTime, isPlaying }: DanmakuCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<ActiveDanmaku[]>([]);
  const lastTimeRef = useRef(currentTime);
  const lastRafTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef(-1);
  const laneSlotsRef = useRef<number[]>(new Array(MAX_LANES).fill(0));
  const metricsRef = useRef<DanmakuCanvasMetrics | null>(null);

  // 监听全局弹幕配置变更 (速度、字号、透明度、区域、过滤规则、重复聚合)
  const config = useSyncExternalStore(
    danmakuPreferenceStore.subscribe,
    danmakuPreferenceStore.getGlobalConfig,
    danmakuPreferenceStore.getGlobalConfig
  );

  const {
    opacity = 0.8,
    fontSize = 20,
    displayArea = 0.5,
    speed = 8,
    showColor = true,
    mergeDuplicatesToTop = true,
    cleanLikeBadges = true,
  } = config;

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const next = readCanvasMetrics(canvas);
    if (!next) return null;

    const previous = metricsRef.current;
    if (!haveDanmakuCanvasMetricsChanged(previous, next)) {
      metricsRef.current = next;
      return next;
    }

    canvas.width = next.bitmapWidth;
    canvas.height = next.bitmapHeight;

    const dimensionsChanged = Boolean(
      previous &&
        (Math.abs(previous.width - next.width) > 0.5 || Math.abs(previous.height - next.height) > 0.5)
    );

    if (previous && dimensionsChanged) {
      const effectiveHeight = next.height * displayArea;

      activeRef.current = activeRef.current.map((danmaku) => {
        const type = danmaku.comment.type || 'scroll';
        const y = clampDanmakuY(
          scaleDanmakuCoordinate(danmaku.y, previous.height, next.height),
          fontSize,
          effectiveHeight
        );

        if (type === 'scroll') {
          return {
            ...danmaku,
            x: scaleDanmakuCoordinate(danmaku.x, previous.width, next.width),
            y,
            speed: (next.width + danmaku.width) / speed,
          };
        }

        return {
          ...danmaku,
          x: (next.width - danmaku.width) / 2,
          y,
        };
      });

      laneSlotsRef.current = new Array(MAX_LANES).fill(0);
    }

    metricsRef.current = next;
    return next;
  }, [displayArea, fontSize, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId: number | null = null;
    let timeoutIds: number[] = [];

    const clearScheduledResize = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      for (const id of timeoutIds) {
        window.clearTimeout(id);
      }
      timeoutIds = [];
    };

    const scheduleResize = () => {
      syncCanvasSize();
      clearScheduledResize();

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        syncCanvasSize();
      });
      timeoutIds = [window.setTimeout(syncCanvasSize, 120), window.setTimeout(syncCanvasSize, 360)];
    };

    scheduleResize();

    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(canvas);

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', scheduleResize);
    visualViewport?.addEventListener('resize', scheduleResize);
    visualViewport?.addEventListener('scroll', scheduleResize);

    return () => {
      clearScheduledResize();
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleResize);
      window.removeEventListener('orientationchange', scheduleResize);
      visualViewport?.removeEventListener('resize', scheduleResize);
      visualViewport?.removeEventListener('scroll', scheduleResize);
    };
  }, [syncCanvasSize]);

  // B站同款：跳转时间点时倒推回填正在屏幕上飞行的弹幕，绝不留白，严密按物理时间排布！
  const backfillSeekComments = useCallback(
    (targetTime: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !comments.length) return;

      const metrics = metricsRef.current ?? syncCanvasSize();
      if (!metrics) return;

      const canvasWidth = metrics.width;
      const effectiveHeight = metrics.height * displayArea;
      const laneHeight = fontSize * LANE_HEIGHT_FACTOR;

      // 倒推窗口：前 speed 秒至当前秒
      const windowStart = Math.max(0, targetTime - speed);
      const windowEnd = targetTime;

      activeRef.current = [];
      laneSlotsRef.current = new Array(MAX_LANES).fill(0);
      lastSpawnTimeRef.current = targetTime;

      let lo = 0,
        hi = comments.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (comments[mid].time < windowStart) lo = mid + 1;
        else hi = mid;
      }

      for (let i = lo; i < comments.length && comments[i].time <= windowEnd; i++) {
        const c = comments[i];
        const cleanedText = cleanCommentText(c.text, cleanLikeBadges);
        if (!cleanedText) continue;
        if (shouldFilterComment(cleanedText, c, config)) continue;

        const type = c.type || 'scroll';
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.font = `bold ${fontSize}px sans-serif`;
        const textWidth = ctx.measureText(cleanedText).width;
        const finalColor = showColor ? c.color : '#ffffff';

        const elapsed = targetTime - c.time;

        if (type === 'scroll') {
          const scrollSpeed = (canvasWidth + textWidth) / speed;
          const currentX = canvasWidth - elapsed * scrollSpeed;

          if (currentX + textWidth > 0 && currentX < canvasWidth) {
            let bestLane = -1;
            for (let lane = 0; lane < MAX_LANES; lane++) {
              const yPos = lane * laneHeight + fontSize;
              if (yPos > effectiveHeight - fontSize) break;
              if (laneSlotsRef.current[lane] <= c.time) {
                bestLane = lane;
                break;
              }
            }
            if (bestLane === -1) bestLane = (i % Math.floor(effectiveHeight / laneHeight)) || 0;

            const timeToPassStartPoint = textWidth / scrollSpeed + 0.6;
            laneSlotsRef.current[bestLane] = c.time + timeToPassStartPoint;

            activeRef.current.push({
              comment: { ...c, text: cleanedText, color: finalColor },
              x: currentX,
              y: bestLane * laneHeight + fontSize,
              speed: scrollSpeed,
              width: textWidth,
              lane: bestLane,
              rawBaseText: cleanedText,
              repeatCount: 1,
              isTopMerged: false,
            });
          }
        } else if (type === 'top') {
          if (elapsed < TOP_BOTTOM_DURATION) {
            const lane = (i % 3) || 0;
            activeRef.current.push({
              comment: {
                ...c,
                text: cleanedText,
                color: finalColor,
                _expiry: c.time + TOP_BOTTOM_DURATION,
              },
              x: (canvasWidth - textWidth) / 2,
              y: lane * laneHeight + fontSize,
              speed: 0,
              width: textWidth,
              lane,
              rawBaseText: cleanedText,
              repeatCount: 1,
              isTopMerged: true,
            });
          }
        }
      }
    },
    [cleanLikeBadges, comments, config, displayArea, fontSize, showColor, speed, syncCanvasSize]
  );

  // 仅在发生真实大幅度跳转 (Seek > 1.5s) 时才触发回填算法
  useEffect(() => {
    const timeDiff = Math.abs(currentTime - lastTimeRef.current);
    if (timeDiff > 1.5) {
      backfillSeekComments(currentTime);
    }
    lastTimeRef.current = currentTime;
  }, [currentTime, backfillSeekComments]);

  // 仅当 comments 发生实体变化 (换源/切集) 时，重置画布并发射新弹幕
  const commentsVersionRef = useRef(comments);
  useEffect(() => {
    if (commentsVersionRef.current !== comments) {
      commentsVersionRef.current = comments;
      activeRef.current = [];
      laneSlotsRef.current = new Array(MAX_LANES).fill(0);
      lastSpawnTimeRef.current = lastTimeRef.current;
    }
  }, [comments]);
  const spawnComments = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !comments.length) return;

      const metrics = metricsRef.current ?? syncCanvasSize();
      if (!metrics) return;

      const canvasWidth = metrics.width;
      const effectiveHeight = metrics.height * displayArea;
      const laneHeight = fontSize * LANE_HEIGHT_FACTOR;

      const windowStart = lastSpawnTimeRef.current;
      const windowEnd = time;

      if (windowEnd <= windowStart) return;

      let lo = 0,
        hi = comments.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (comments[mid].time < windowStart) lo = mid + 1;
        else hi = mid;
      }

      for (let i = lo; i < comments.length && comments[i].time <= windowEnd; i++) {
        const c = comments[i];

        // 1. 过滤清洗点赞与互动后缀 (如 ♡13, Like)
        const cleanedText = cleanCommentText(c.text, cleanLikeBadges);
        if (!cleanedText) continue;

        // 2. 智能屏蔽过滤
        if (shouldFilterComment(cleanedText, c, config)) continue;

        // 3. 【核心优化】重复弹幕聚合为顶部带 ×N 计数的固定弹幕
        if (mergeDuplicatesToTop) {
          // 检查当前同屏是否已经有相同的活跃弹幕
          const existing = activeRef.current.find(
            (item) => item.rawBaseText && item.rawBaseText === cleanedText
          );

          if (existing) {
            existing.repeatCount = (existing.repeatCount || 1) + 1;
            // 延长它的显示寿命（重置到当前时间 + 4秒）
            existing.comment._expiry = time + 4.2;

            // 如果此前是滚动弹幕，立刻提升转换为顶部居中固定弹幕
            if (!existing.isTopMerged) {
              existing.isTopMerged = true;
              existing.comment.type = 'top';
              existing.speed = 0;
              // 寻找一条顶部轨道
              for (let lane = 0; lane < 4; lane++) {
                if (laneSlotsRef.current[lane] <= time + 4.2) {
                  existing.lane = lane;
                  existing.y = lane * laneHeight + fontSize;
                  laneSlotsRef.current[lane] = time + 4.2;
                  break;
                }
              }
            }

            // 更新文本为 "xxx  × N"
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.font = `bold ${fontSize}px sans-serif`;
              const updatedText = `${cleanedText}  × ${existing.repeatCount}`;
              existing.comment.text = updatedText;
              existing.width = ctx.measureText(updatedText).width;
              existing.x = (canvasWidth - existing.width) / 2;
            }

            // 已成功聚合，本次不再生成新的重复弹幕！
            continue;
          }
        }

        const type = c.type || 'scroll';
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.font = `bold ${fontSize}px sans-serif`;
        const textWidth = ctx.measureText(cleanedText).width;

        // 彩色转换
        const finalColor = showColor ? c.color : '#ffffff';

        if (type === 'scroll') {
          const scrollSpeed = (canvasWidth + textWidth) / speed;
          let bestLane = -1;

          for (let lane = 0; lane < MAX_LANES; lane++) {
            const yPos = lane * laneHeight + fontSize;
            if (yPos > effectiveHeight - fontSize) break;
            if (laneSlotsRef.current[lane] <= time) {
              bestLane = lane;
              break;
            }
          }
          if (bestLane === -1) continue; // 轨道已满防重叠

          const timeToPassStartPoint = textWidth / scrollSpeed + 0.6;
          laneSlotsRef.current[bestLane] = time + timeToPassStartPoint;

          activeRef.current.push({
            comment: {
              ...c,
              text: cleanedText,
              color: finalColor,
            },
            x: canvasWidth,
            y: bestLane * laneHeight + fontSize,
            speed: scrollSpeed,
            width: textWidth,
            lane: bestLane,
            rawBaseText: cleanedText,
            repeatCount: 1,
            isTopMerged: false,
          });
        } else {
          // 顶部或底部固定弹幕
          const maxLanes = Math.floor(effectiveHeight / laneHeight / 2);
          let bestLane = -1;
          for (let lane = 0; lane < Math.min(maxLanes, MAX_LANES); lane++) {
            const laneKey = type === 'top' ? lane : MAX_LANES - 1 - lane;
            if (laneSlotsRef.current[laneKey] <= time) {
              bestLane = lane;
              laneSlotsRef.current[laneKey] = time + TOP_BOTTOM_DURATION;
              break;
            }
          }
          if (bestLane === -1) continue;

          const y =
            type === 'top'
              ? bestLane * laneHeight + fontSize
              : effectiveHeight - bestLane * laneHeight - fontSize * 0.4;

          activeRef.current.push({
            comment: {
              ...c,
              text: cleanedText,
              color: finalColor,
              _expiry: time + TOP_BOTTOM_DURATION,
            },
            x: (canvasWidth - textWidth) / 2,
            y,
            speed: 0,
            width: textWidth,
            lane: bestLane,
            rawBaseText: cleanedText,
            repeatCount: 1,
            isTopMerged: type === 'top',
          });
        }
      }

      lastSpawnTimeRef.current = windowEnd;
    },
    [
      cleanLikeBadges,
      comments,
      config,
      displayArea,
      fontSize,
      mergeDuplicatesToTop,
      showColor,
      speed,
      syncCanvasSize,
    ]
  );

  // 渲染循环 (支持高能重复聚合 ×N 金色徽章高亮)
  const render = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const metrics = metricsRef.current ?? syncCanvasSize();
      if (!metrics) return;

      const delta = lastRafTimeRef.current ? (timestamp - lastRafTimeRef.current) / 1000 : 0;
      lastRafTimeRef.current = timestamp;

      ctx.save();
      ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
      ctx.clearRect(0, 0, metrics.width, metrics.height);

      ctx.globalAlpha = opacity;
      ctx.font = `bold ${fontSize}px "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 2.8;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'; // 高对比度黑边

      const currentTimeVal = lastTimeRef.current;

      activeRef.current = activeRef.current.filter((danmaku) => {
        const type = danmaku.comment.type || 'scroll';

        if (type === 'scroll') {
          if (isPlaying) {
            danmaku.x -= danmaku.speed * delta;
          }
          if (danmaku.x + danmaku.width < 0) return false;
        } else {
          if (danmaku.comment._expiry && currentTimeVal >= danmaku.comment._expiry) {
            return false;
          }
        }

        // 如果是聚合为顶部的重复高能弹幕，文字主体正常渲染，且带有高能光泽
        if (danmaku.isTopMerged && danmaku.repeatCount && danmaku.repeatCount > 1) {
          ctx.fillStyle = '#ffdf6d'; // 顶部聚合高能金色
        } else {
          ctx.fillStyle = danmaku.comment.color || '#ffffff';
        }

        ctx.strokeText(danmaku.comment.text, danmaku.x, danmaku.y);
        ctx.fillText(danmaku.comment.text, danmaku.x, danmaku.y);

        return true;
      });

      ctx.restore();

      rafRef.current = requestAnimationFrame(render);
    },
    [fontSize, isPlaying, opacity, syncCanvasSize]
  );

  useEffect(() => {
    if (isPlaying) {
      spawnComments(currentTime);
    }
  }, [currentTime, isPlaying, spawnComments]);

  useEffect(() => {
    lastRafTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
      }}
    />
  );
}
