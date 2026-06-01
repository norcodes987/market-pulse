'use client';

import Link from 'next/link';
import { AddTickerForm } from './AddTickerForm';

interface Props {
  onAdd: (ticker: string) => void;
}

export function TopBar({ onAdd }: Props) {
  return (
    <header className='flex flex-col gap-3 px-4 py-4 border-b border-[#1f1f1f] sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6'>
      <h1 className='font-heading text-2xl font-bold tracking-wide text-[#C8FF00]'>
        Market Pulse
      </h1>
      <div className='flex items-center gap-3'>
        <Link
          href='/find'
          className='rounded border border-[#1f1f1f] px-3 py-1.5 text-xs text-[#888] transition-colors hover:border-[#C8FF00] hover:text-[#C8FF00]'
        >
          Find Stocks
        </Link>
        <AddTickerForm onAdd={onAdd} />
      </div>
    </header>
  );
}
