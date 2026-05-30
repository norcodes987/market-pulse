import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeSelector } from '../ThemeSelector';

const noop = () => {};

describe('ThemeSelector', () => {
  it('renders all 8 preset pills', () => {
    render(<ThemeSelector value="" onChange={noop} onSubmit={noop} loading={false} />);
    expect(screen.getByText('AI Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('Semiconductors')).toBeInTheDocument();
    expect(screen.getByText('Cybersecurity')).toBeInTheDocument();
    expect(screen.getByText('GLP-1 / Obesity')).toBeInTheDocument();
    expect(screen.getByText('Defense Primes')).toBeInTheDocument();
    expect(screen.getByText('Credit-Card Networks')).toBeInTheDocument();
    expect(screen.getByText('SaaS at a Discount')).toBeInTheDocument();
    expect(screen.getByText('Re-shoring Industries')).toBeInTheDocument();
  });

  it('calls onChange with preset value when a pill is clicked', () => {
    const onChange = jest.fn();
    render(<ThemeSelector value="" onChange={onChange} onSubmit={noop} loading={false} />);
    fireEvent.click(screen.getByText('AI Infrastructure'));
    expect(onChange).toHaveBeenCalledWith('AI Infrastructure');
  });

  it('calls onChange when text input changes', () => {
    const onChange = jest.fn();
    render(<ThemeSelector value="" onChange={onChange} onSubmit={noop} loading={false} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Clean energy' } });
    expect(onChange).toHaveBeenCalledWith('Clean energy');
  });

  it('disables the button when value is empty', () => {
    render(<ThemeSelector value="" onChange={noop} onSubmit={noop} loading={false} />);
    expect(screen.getByRole('button', { name: /find stocks/i })).toBeDisabled();
  });

  it('disables the button when loading', () => {
    render(<ThemeSelector value="AI Infrastructure" onChange={noop} onSubmit={noop} loading={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onSubmit when button is clicked with a non-empty value', () => {
    const onSubmit = jest.fn();
    render(<ThemeSelector value="AI Infrastructure" onChange={noop} onSubmit={onSubmit} loading={false} />);
    fireEvent.click(screen.getByRole('button', { name: /find stocks/i }));
    expect(onSubmit).toHaveBeenCalled();
  });
});
