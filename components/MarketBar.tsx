'use client';

import { useState } from 'react';
import { useMarketOverview } from '@/hooks/useMarketOverview';
import type { QuoteState } from '@/types';

const MARKET_TICKERS = ['SPY', 'QQQ', 'IWM', 'VIX'] as const;

const DESCRIPTIONS: Record<string, string> = {
  SPY: 'S&P 500 ETF — tracks the 500 largest US companies',
  QQQ: 'Nasdaq-100 ETF — heavily weighted toward tech.',
  IWM: 'Russell 2000 ETF — 2,000 small-caps.',
  VIX: 'CBOE Volatility Index. Below 15: calm. 15–25: normal. Above 25: elevated stress.',
};

interface TickerItemProps {
  ticker: string;
  state: QuoteState;
  selected: boolean;
  onClick: () => void;
}

function TickerItem({ ticker, state, selected, onClick }: TickerItemProps) {
  let price = '--';
  let changePct = '--';
  let colorClass = 'text-gray-500';

  if (state.status === 'ok') {
    const sign = state.data.changePct >= 0 ? '+' : '';
    price = state.data.price.toFixed(2);
    changePct = `${sign}${state.data.changePct.toFixed(2)}%`;
    colorClass =
      state.data.changePct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]';
  }

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start shrink-0 px-4 py-2.5 border-b-2 transition-colors hover:bg-white/5 ${
        selected ? 'border-[#C8FF00]' : 'border-transparent'
      }`}
    >
      <span className='text-xs text-gray-500 font-semibold tracking-wide'>
        {ticker}
      </span>
      <span className='text-xs font-semibold text-white'>{price}</span>
      <span className={`text-xs font-semibold ${colorClass}`}>{changePct}</span>
    </button>
  );
}

export function MarketBar() {
  const quotes = useMarketOverview();
  const [selected, setSelected] = useState<string>('SPY');

  return (
    <div className='border-b border-[#1f1f1f]'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6'>
        <div className='flex overflow-x-auto'>
          {MARKET_TICKERS.map((ticker) => (
            <TickerItem
              key={ticker}
              ticker={ticker}
              state={quotes[ticker] ?? { status: 'loading' }}
              selected={selected === ticker}
              onClick={() => setSelected(ticker)}
            />
          ))}
        </div>
        <div className='py-2.5 px-1'>
          <p className='text-xs text-gray-500'>
            <span className='text-gray-400 font-semibold'>{selected}:</span>{' '}
            {DESCRIPTIONS[selected]}
          </p>
        </div>
      </div>
    </div>
  );
}
