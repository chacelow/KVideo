'use client';

import { Search, Loader2 } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  label: string;
  placeholder?: string;
  loading?: boolean;
}

export function SearchField({ value, onChange, onSearch, label, placeholder, loading = false }: SearchFieldProps) {
  return (
    <form role="search" aria-label={label} onSubmit={event => { event.preventDefault(); onSearch(); }} className="flex min-w-0 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden size={14} className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 text-[var(--text-color-secondary)]" />
        <Input type="search" aria-label={label} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} className="!h-9 !rounded-md !py-1 !pl-7 !pr-2 !text-xs !backdrop-blur-none !shadow-none" />
      </div>
      <Button type="submit" variant="ghost" disabled={loading || !value.trim()} className="!min-h-9 !px-2 !py-1 !text-xs !text-[var(--accent-color)]">
        {loading ? <Loader2 size={14} className="animate-spin" aria-label="搜索中" /> : '搜索'}
      </Button>
    </form>
  );
}
