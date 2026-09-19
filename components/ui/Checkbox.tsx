import type { InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';

/** Native keyboard and form behavior with the shared theme's selection colors. */
export function Checkbox({ className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <span className={`relative inline-flex h-5 w-5 shrink-0 items-center justify-center ${className}`}>
      <input {...props} type="checkbox" className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-[3px] border border-[var(--glass-border)] bg-transparent checked:border-[var(--accent-color)] checked:bg-[var(--accent-color)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-color)] disabled:cursor-not-allowed disabled:opacity-40" />
      <Check aria-hidden size={14} className="pointer-events-none relative text-white opacity-0 peer-checked:opacity-100" />
    </span>
  );
}
