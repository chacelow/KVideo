'use client';

import { Suspense, useMemo, useState } from 'react';
import { NoResults } from '@/components/search/NoResults';
import { PopularFeatures } from '@/components/home/PopularFeatures';
import { FavoritesSidebar } from '@/components/favorites/FavoritesSidebar';
import { Navbar } from '@/components/layout/Navbar';
import { SearchResults } from '@/components/home/SearchResults';
import { useHomePage } from '@/lib/hooks/useHomePage';
import { useLatencyPing } from '@/lib/hooks/useLatencyPing';

function HomePage() {
  const {
    query,
    hasSearched,
    loading,
    results,
    availableSources,
    completedSources,
    totalSources,
    handleSearch,
    handleReset,
    handleCancelSearch,
  } = useHomePage();
  const [contentType, setContentType] = useState<'anime' | 'tv' | 'movie'>('anime');

  // Real-time latency pinging
  const sourceUrls = useMemo(() =>
    availableSources.flatMap((source) =>
      source.baseUrl ? [{ id: source.id, baseUrl: source.baseUrl }] : []
    ),
    [availableSources]
  );

  const { latencies } = useLatencyPing({
    sourceUrls,
    enabled: hasSearched && results.length > 0,
  });

  return (
    <div className="min-h-screen">
      {/* B站同款吸顶紧凑Navbar，内置搜索条 */}
      <Navbar
        onReset={handleReset}
        onSearch={handleSearch}
        initialQuery={query}
        isLoading={loading}
        contentType={contentType}
        onContentTypeChange={setContentType}
      />
      {/* Main Content */}
      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 pb-20 pt-6">
        {/* Results Section */}
        {(results.length >= 1 || (!loading && results.length > 0)) && (
          <SearchResults
            results={results}
            availableSources={availableSources}
            loading={loading}
            latencies={latencies}
          />
        )}

        {/* Popular Features - Homepage */}
        {!loading && !hasSearched && (
          <>
            <PopularFeatures onSearch={handleSearch} contentType={contentType} />
          </>
        )}

        {/* No Results */}
        {!loading && hasSearched && results.length === 0 && (
          <NoResults onReset={handleReset} />
        )}
      </main>

      {/* Favorites Sidebar - Left */}
      <FavoritesSidebar />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[var(--accent-color)] border-t-transparent"></div>
      </div>
    }>
      <HomePage />
    </Suspense>
  );
}
