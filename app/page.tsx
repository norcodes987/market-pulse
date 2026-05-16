'use client';

import { useState } from 'react';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useQuotes } from '@/hooks/useQuotes';
import { TopBar } from '@/components/TopBar';
import { MarketBar } from '@/components/MarketBar';
import { TabBar } from '@/components/TabBar';
import { StockCard } from '@/components/StockCard';

type Tab = 'all' | 'owned' | 'watching';

export default function Home() {
  const { entries, addTicker, removeTicker, setTag } = useWatchlist();
  const [activeTab, setActiveTab] = useState<Tab>('all');

  const allTickers = entries.map((e) => e.ticker);
  const quotes = useQuotes(allTickers);

  const visibleEntries =
    activeTab === 'all' ? entries : entries.filter((e) => e.tag === activeTab);

  const counts = {
    all: entries.length,
    owned: entries.filter((e) => e.tag === 'owned').length,
    watching: entries.filter((e) => e.tag === 'watching').length,
  };

  return (
    <div className='min-h-screen bg-[#080808]'>
      <TopBar onAdd={addTicker} />
      <MarketBar />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

      <main className='px-4 sm:px-6 py-6 max-w-7xl mx-auto'>
        {visibleEntries.length > 0 && (
          <div className='mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {visibleEntries.map(({ ticker, tag }) => {
              const state = quotes[ticker] ?? { status: 'loading' };
              return (
                <StockCard
                  key={ticker}
                  ticker={ticker}
                  state={state}
                  tag={tag}
                  onTagToggle={() => setTag(ticker, tag === 'owned' ? 'watching' : 'owned')}
                  onRemove={() => removeTicker(ticker)}
                />
              );
            })}
          </div>
        )}

        {entries.length === 0 && (
          <div className='mt-16 text-center'>
            <p className='text-gray-500 text-sm'>
              Add a ticker symbol above to get started.
            </p>
          </div>
        )}

        {entries.length > 0 && visibleEntries.length === 0 && (
          <div className='mt-16 text-center'>
            <p className='text-gray-500 text-sm'>
              No {activeTab} stocks yet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
