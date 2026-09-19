'use client';

import type { UseDanmakuReturn } from '../hooks/useDanmaku';
import { DanmakuSidebar } from './DanmakuSidebar';

export function DanmakuControlHub({ danmaku, currentVideoDuration = 0, onClose, className = '' }: {
  danmaku: UseDanmakuReturn;
  currentVideoDuration?: number;
  onClose?: () => void;
  className?: string;
}) {
  return <DanmakuSidebar danmaku={danmaku} currentVideoDuration={currentVideoDuration} onClose={onClose} isOpen className={className} />;
}
