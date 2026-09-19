'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { VideoResolutionInfo } from '../hooks/useVideoResolution';

interface ResolutionDropdownProps {
  videoResolution?: VideoResolutionInfo | null;
  onSelectResolution?: (res: string) => void;
}

export function ResolutionDropdown({
  videoResolution,
  onSelectResolution,
}: ResolutionDropdownProps) {
  const currentLabel = videoResolution?.label || '1080P';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="btn-icon shrink-0 px-1 text-xs font-bold text-white/90 hover:text-pink-400 transition-colors cursor-pointer outline-none select-none"
          title="切换清晰度"
          aria-label={`当前清晰度: ${currentLabel}`}
        >
          <span>{currentLabel}</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="end"
          sideOffset={8}
          className="z-[9999] min-w-[96px] bg-[#1a1b1e]/95 backdrop-blur-xl border border-white/10 rounded-lg p-1 shadow-2xl animate-in fade-in-0 zoom-in-95 text-xs select-none"
        >
          {[
            { label: '4K', desc: '超高清' },
            { label: '1080P', desc: '全高清' },
            { label: '720P', desc: '高清' },
            { label: '自动', desc: '自适应' },
          ].map((item) => {
            const isCur = currentLabel === item.label || (item.label === '自动' && !videoResolution);
            return (
              <DropdownMenu.Item
                key={item.label}
                onSelect={() => onSelectResolution?.(item.label)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer outline-none transition-colors ${
                  isCur
                    ? 'text-pink-400 font-bold bg-white/10'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{item.label}</span>
                <span className="text-[10px] opacity-40 ml-2">{item.desc}</span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
