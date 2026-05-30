import { render, screen } from '@testing-library/react';
import { ThesisCards } from '../ThesisCards';

const thesis = [
  {
    ticker: 'NVDA', rank: 1,
    moat: 'CUDA software lock-in',
    drawdown: 'Export controls hit revenue',
    catalyst: 'Blackwell ramp in H2',
    exit: 'AMD captures 20% GPU share',
    sources: ['NVDA Q1 2025 earnings', 'Reuters'],
  },
];

describe('ThesisCards', () => {
  it('renders ticker name', () => {
    render(<ThesisCards thesis={thesis} />);
    expect(screen.getByText('#1 NVDA')).toBeInTheDocument();
  });

  it('renders all four thesis sections', () => {
    render(<ThesisCards thesis={thesis} />);
    expect(screen.getByText('CUDA software lock-in')).toBeInTheDocument();
    expect(screen.getByText('Export controls hit revenue')).toBeInTheDocument();
    expect(screen.getByText('Blackwell ramp in H2')).toBeInTheDocument();
    expect(screen.getByText('AMD captures 20% GPU share')).toBeInTheDocument();
  });

  it('renders sources', () => {
    render(<ThesisCards thesis={thesis} />);
    expect(screen.getByText('NVDA Q1 2025 earnings')).toBeInTheDocument();
    expect(screen.getByText('Reuters')).toBeInTheDocument();
  });
});
