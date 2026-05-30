import { render, screen } from '@testing-library/react';
import { ConvictionTable } from '../ConvictionTable';

const scores = [
  { rank: 1, ticker: 'NVDA', score: 91, tier: 'Best' as const, thesis: 'Dominant AI compute' },
  { rank: 2, ticker: 'MSFT', score: 68, tier: 'Strong' as const, thesis: 'Enterprise AI play' },
  { rank: 3, ticker: 'XYZ', score: 55, tier: 'Watch' as const, thesis: 'Speculative exposure' },
  { rank: 4, ticker: 'ABC', score: 40, tier: 'Avoid' as const, thesis: 'Weak fundamentals' },
];

describe('ConvictionTable', () => {
  it('renders ticker, score, tier, and thesis for each row', () => {
    render(<ConvictionTable scores={scores} />);
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.getByText('91')).toBeInTheDocument();
    expect(screen.getByText('Best')).toBeInTheDocument();
    expect(screen.getByText('Dominant AI compute')).toBeInTheDocument();
  });

  it('renders all four tiers', () => {
    render(<ConvictionTable scores={scores} />);
    expect(screen.getByText('Best')).toBeInTheDocument();
    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(screen.getByText('Watch')).toBeInTheDocument();
    expect(screen.getByText('Avoid')).toBeInTheDocument();
  });

  it('renders the disclaimer footer', () => {
    render(<ConvictionTable scores={scores} />);
    expect(screen.getByText(/ai-estimated/i)).toBeInTheDocument();
  });
});
