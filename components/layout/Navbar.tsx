'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useSiteIcon } from '@/components/SiteIconProvider';
import { siteConfig } from '@/lib/config/site-config';
import { getSession, clearSession, hasPermission, type AuthSession } from '@/lib/store/auth-store';
import { useRuntimeFeatures } from '@/components/RuntimeFeaturesProvider';
import { LogOut, Heart, Settings, Tv, Search, X, Loader2 } from 'lucide-react';

export type ContentCategory = 'anime' | 'tv' | 'movie';

interface NavbarProps {
  onReset?: () => void;
  isPremiumMode?: boolean;
  onSearch?: (query: string) => void;
  initialQuery?: string;
  isLoading?: boolean;
  contentType?: ContentCategory;
  onContentTypeChange?: (type: ContentCategory) => void;
}

export function Navbar({
  onReset,
  isPremiumMode = false,
  onSearch,
  initialQuery = '',
  isLoading = false,
  contentType = 'anime',
  onContentTypeChange,
}: NavbarProps) {
  const router = useRouter();
  const settingsHref = isPremiumMode ? '/premium/settings' : '/settings';
  const favoritesHref = isPremiumMode ? '/premium/favorites' : '/favorites';
  const [session] = useState<AuthSession | null>(() => getSession());
  const { iptvEnabled } = useRuntimeFeatures();
  const siteIconSrc = useSiteIcon();

  const [searchVal, setSearchVal] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchVal(initialQuery);
  }, [initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = searchVal.trim();
    if (!trimmed) return;

    if (onSearch) {
      onSearch(trimmed);
    } else {
      router.push(`/?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleClear = () => {
    setSearchVal('');
    if (onReset) onReset();
    inputRef.current?.focus();
  };

  const handleLogout = () => {
    fetch('/api/auth/session', { method: 'DELETE' })
      .catch(() => {})
      .finally(() => {
        clearSession();
        window.location.href = '/';
      });
  };

  const handleCategoryClick = (cat: ContentCategory) => {
    if (onContentTypeChange) {
      onContentTypeChange(cat);
      if (onReset) onReset(); // 切换分类时清除搜索态，展现分类首页
    } else {
      router.push(`/?type=${cat}`);
    }
  };

  return (
    // B站同款：超紧凑(52px)、扁平无厚框、sticky吸顶不占面积
    <header className="sticky top-0 z-50 w-full h-[52px] bg-[#18191c]/95 backdrop-blur-md border-b border-white/5 select-none">
      <div className="max-w-[1920px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* 1. 左侧：Logo + B站同款纯文字分类导航 (动漫 / 电视剧 / 电影) */}
        <div className="flex items-center gap-6 shrink-0">
          <Link
            href={isPremiumMode ? '/premium' : '/'}
            className="flex items-center gap-2 hover:opacity-85 transition-opacity cursor-pointer"
            onClick={onReset}
          >
            <div className="w-6 h-6 relative flex items-center justify-center shrink-0">
              <Image
                src={siteIconSrc}
                alt={siteConfig.name}
                width={24}
                height={24}
                unoptimized
                className="object-contain"
              />
            </div>
            <span className="text-sm font-bold text-[#e3e5e7] tracking-wide mr-2">
              {siteConfig.name}
            </span>
          </Link>

          {/* B站同款顶部分类导航：动漫 | 电视剧 | 电影 */}
          <nav className="flex items-center gap-6 text-xs sm:text-sm">
            {[
              { id: 'anime', label: '动漫' },
              { id: 'tv', label: '电视剧' },
              { id: 'movie', label: '电影' },
            ].map((tab) => {
              const isActive = contentType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleCategoryClick(tab.id as ContentCategory)}
                  className={`cursor-pointer transition-colors relative py-1 ${
                    isActive
                      ? 'text-pink-400 font-bold'
                      : 'text-[#9499a0] hover:text-[#e3e5e7]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-0 h-0.5 bg-pink-500 rounded-full" />
                  )}
                </button>
              );
            })}

            {iptvEnabled && hasPermission('iptv_access') && (
              <Link
                href="/iptv"
                className="hover:text-pink-400 text-[#9499a0] transition-colors cursor-pointer flex items-center gap-1"
              >
                <Tv size={12} />
                <span className="hidden sm:inline">直播</span>
              </Link>
            )}
          </nav>
        </div>

        {/* 2. 中间：B站同款紧凑搜索框 (高度32px，灰底扁平胶囊，直接内嵌在Header内) */}
        <div className="flex-1 max-w-lg mx-2 sm:mx-auto">
          <form onSubmit={handleSearchSubmit} className="relative w-full flex items-center group">
            <input
              ref={inputRef}
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="搜索番剧、动漫、电影、电视剧..."
              className="w-full h-[32px] pl-8 pr-12 rounded-md bg-[#2a2b30] hover:bg-[#323338] focus:bg-[#323338] border border-transparent focus:border-pink-500/50 text-xs text-[#e3e5e7] placeholder-[#9499a0] transition-all outline-none"
            />
            <Search
              size={13}
              className="absolute left-2.5 text-[#9499a0] group-hover:text-white pointer-events-none transition-colors"
            />

            <div className="absolute right-1.5 flex items-center gap-1">
              {searchVal && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 text-[#9499a0] hover:text-white transition-colors cursor-pointer"
                >
                  <X size={11} />
                </button>
              )}
              {isLoading ? (
                <Loader2 size={12} className="text-pink-400 animate-spin mr-1" />
              ) : (
                <button
                  type="submit"
                  className="px-2 py-0.5 text-[11px] font-bold text-pink-400 hover:text-pink-300 transition-colors cursor-pointer"
                >
                  搜索
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 3. 右侧：B站同款极简图标区 (追番收藏、设置、主题、用户) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-[#9499a0]">
          <Link
            href={favoritesHref}
            className="flex items-center gap-1 p-1.5 hover:text-pink-400 hover:bg-white/5 rounded transition-colors text-xs"
            title="追番与收藏"
          >
            <Heart size={15} />
            <span className="hidden lg:inline text-[11px]">追番</span>
          </Link>

          <Link
            href={settingsHref}
            className="p-1.5 hover:text-[#e3e5e7] hover:bg-white/5 rounded transition-colors"
            title="设置"
          >
            <Settings size={15} />
          </Link>

          {/* 用户账号状态 */}
          {session && (
            <div className="flex items-center gap-1 text-xs text-[#9499a0] ml-1">
              <span className="truncate max-w-[70px] text-[11px]">{session.name}</span>
              <button
                onClick={handleLogout}
                className="p-1 hover:text-rose-400 transition-colors cursor-pointer"
                title="退出登录"
              >
                <LogOut size={12} />
              </button>
            </div>
          )}

          <div className="pl-1 border-l border-white/10">
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
