'use client';

import { AddTickerForm } from './AddTickerForm';

interface Props {
  onAdd: (ticker: string) => void;
}

export function TopBar({ onAdd }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
      <h1 className="font-heading text-2xl font-bold tracking-wide text-[#C8FF00]">
        Stock Buzz
      </h1>
      <AddTickerForm onAdd={onAdd} />
    </header>
  );
}
