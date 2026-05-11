'use client';

import { useWatchlist } from '@/hooks/useWatchlist';
import { useQuotes } from '@/hooks/useQuotes';
import { TopBar } from '@/components/TopBar';
import { WatchlistBar } from '@/components/WatchlistBar';
import { StockCard } from '@/components/StockCard';

export default function Home() {
  const { tickers, addTicker, removeTicker } = useWatchlist();
  const quotes = useQuotes(tickers);

  return (
    <div className='min-h-screen bg-[#080808]'>
      <TopBar onAdd={addTicker} />

      <main className='px-4 sm:px-6 py-6 max-w-7xl mx-auto'>
        <WatchlistBar tickers={tickers} onRemove={removeTicker} />

        {tickers.length > 0 && (
          <div className='mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {tickers.map((ticker) => {
              const state = quotes[ticker] ?? { status: 'loading' };
              console.log(state);
              return <StockCard key={ticker} ticker={ticker} state={state} />;
            })}
          </div>
        )}

        {tickers.length === 0 && (
          <div className='mt-16 text-center'>
            <p className='text-gray-500 text-sm'>
              Add a ticker symbol above to get started.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
