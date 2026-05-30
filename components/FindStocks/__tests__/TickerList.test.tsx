import { render, screen } from '@testing-library/react';
import { TickerList } from '../TickerList';

const candidates = [
  { rank: 1, ticker: 'NVDA', description: 'Dominant GPU maker' },
  { rank: 2, ticker: 'MSFT', description: 'Azure cloud powerhouse' },
];

describe('TickerList', () => {
  it('renders rank, ticker, and description for each candidate', () => {
    render(<TickerList candidates={candidates} />);
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.getByText('Dominant GPU maker')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('Azure cloud powerhouse')).toBeInTheDocument();
  });

  it('renders rank numbers', () => {
    render(<TickerList candidates={candidates} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
