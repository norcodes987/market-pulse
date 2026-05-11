'use client';

import { AddTickerForm } from './AddTickerForm';

interface Props {
  onAdd: (ticker: string) => void;
}

export function TopBar({ onAdd }: Props) {
  return (
    <header className="flex flex-col gap-3 px-4 py-4 border-b border-[#1f1f1f] sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6">
      <h1 className="font-heading text-2xl font-bold tracking-wide text-[#C8FF00]">
        Stock Buzz
      </h1>
      <AddTickerForm onAdd={onAdd} />
    </header>
  );
}
