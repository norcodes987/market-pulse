'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFindStocks } from '@/hooks/useFindStocks';
import { ThemeSelector } from '@/components/FindStocks/ThemeSelector';
import { TickerList } from '@/components/FindStocks/TickerList';
import { ConvictionTable } from '@/components/FindStocks/ConvictionTable';
import { ThesisCards } from '@/components/FindStocks/ThesisCards';
import type { FindStocksPhase } from '@/hooks/useFindStocks';
import type { TickerCandidate, ConvictionScore, ThesisCard } from '@/types';

function getCandidates(state: FindStocksPhase): TickerCandidate[] | undefined {
  if (
    state.phase === 'scores-loading' ||
    state.phase === 'thesis-loading' ||
    state.phase === 'complete'
  ) return state.candidates;
  if (state.phase === 'error') return state.candidates;
  return undefined;
}

function getScores(state: FindStocksPhase): ConvictionScore[] | undefined {
  if (state.phase === 'thesis-loading' || state.phase === 'complete') return state.scores;
  if (state.phase === 'error') return state.scores;
  return undefined;
}

function getThesis(state: FindStocksPhase): ThesisCard[] | undefined {
  if (state.phase === 'complete') return state.thesis;
  return undefined;
}

export default function FindPage() {
  const [theme, setTheme] = useState('');
  const { state, run, reset } = useFindStocks();

  const isLoading = ['tickers-loading', 'scores-loading', 'thesis-loading'].includes(state.phase);
  const hasStarted = state.phase !== 'idle';

  const candidates = getCandidates(state);
  const scores = getScores(state);
  const thesis = getThesis(state);

  return (
    <div className="min-h-screen bg-[#080808]">
      <header className="flex items-center justify-between border-b border-[#1f1f1f] px-4 py-4 sm:px-6">
        <h1 className="font-heading text-2xl font-bold tracking-wide text-[#C8FF00]">
          Stock Buzz
        </h1>
        <Link href="/" className="text-sm text-[#888] hover:text-[#C8FF00]">
          ← Back to watchlist
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h2 className="font-heading text-3xl font-bold text-[#C8FF00]">Find Stocks</h2>
          <p className="mt-1 text-sm text-[#555]">
            AI-powered theme scanner · 3 steps · ~30 seconds
          </p>
        </div>

        {!hasStarted ? (
          <ThemeSelector
            value={theme}
            onChange={setTheme}
            onSubmit={() => { if (theme.trim()) run(theme.trim()); }}
            loading={isLoading}
          />
        ) : (
          <div className="mb-6 flex items-center gap-3">
            <span className="text-sm text-[#888]">
              Theme: <span className="text-[#C8FF00]">{theme}</span>
            </span>
            <button
              onClick={reset}
              className="text-xs text-[#555] hover:text-[#888]"
            >
              Start over
            </button>
          </div>
        )}

        {/* Step 1 */}
        {state.phase === 'tickers-loading' && (
          <StepSection step={1} title="Ticker Universe" loading />
        )}
        {candidates && (
          <StepSection step={1} title="Ticker Universe">
            <TickerList candidates={candidates} />
          </StepSection>
        )}

        {/* Step 2 */}
        {state.phase === 'scores-loading' && (
          <StepSection step={2} title="Conviction Scores" loading />
        )}
        {scores && (
          <StepSection step={2} title="Conviction Scores">
            <ConvictionTable scores={scores} />
          </StepSection>
        )}

        {/* Step 3 */}
        {state.phase === 'thesis-loading' && (
          <StepSection step={3} title="Deep Thesis" loading />
        )}
        {thesis && (
          <StepSection step={3} title="Deep Thesis">
            <ThesisCards thesis={thesis} />
          </StepSection>
        )}

        {/* Error */}
        {state.phase === 'error' && (
          <div className="mt-6 rounded-lg border border-red-900/50 bg-red-950/20 p-4">
            <p className="text-sm text-red-400">
              Step {state.step} failed: {state.message}
            </p>
            <button
              onClick={() => run(theme)}
              className="mt-2 text-xs text-[#C8FF00] hover:underline"
            >
              Try again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function StepSection({
  step,
  title,
  loading = false,
  children,
}: {
  step: number;
  title: string;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-[#C8FF00] px-2 py-0.5 text-[10px] font-bold text-[#080808]">
          STEP {step}
        </span>
        <span className="text-sm font-semibold text-[#aaa]">{title}</span>
        {loading && (
          <span className="animate-pulse text-xs text-[#555]">Loading...</span>
        )}
      </div>
      {children}
    </div>
  );
}
