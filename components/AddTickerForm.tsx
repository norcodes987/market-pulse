'use client';

import { useState, FormEvent } from 'react';

interface Props {
  onAdd: (ticker: string) => void;
}

export function AddTickerForm({ onAdd }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ticker = value.trim().toUpperCase();
    if (ticker) {
      onAdd(ticker);
      setValue('');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add ticker…"
        maxLength={10}
        className="flex-1 sm:flex-none sm:w-36 bg-[#1a1a1a] border border-[#1f1f1f] rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C8FF00]"
        suppressHydrationWarning
      />
      <button
        type="submit"
        className="bg-[#C8FF00] text-black text-sm font-semibold px-3 py-1.5 rounded hover:brightness-90 transition-all"
        suppressHydrationWarning
      >
        Add
      </button>
    </form>
  );
}
