'use client';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

const PRESETS = [
  'AI Infrastructure',
  'Semiconductors',
  'Cybersecurity',
  'GLP-1 / Obesity',
  'Defense Primes',
  'Credit-Card Networks',
  'SaaS at a Discount',
  'Re-shoring Industries',
];

export function ThemeSelector({ value, onChange, onSubmit, loading }: Props) {
  const disabled = !value.trim() || loading;

  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#111] p-5">
      <p className="mb-3 text-xs uppercase tracking-widest text-[#555]">Choose a theme</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <span
            key={preset}
            role="none"
            onClick={() => onChange(preset)}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              value === preset
                ? 'bg-[#C8FF00] text-[#080808]'
                : 'bg-[#1f1f1f] text-[#999] hover:text-[#C8FF00]'
            }`}
          >
            {preset}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Or type a custom theme..."
          disabled={loading}
          className="flex-1 rounded-md border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-[#ccc] placeholder:text-[#444] focus:border-[#C8FF00] focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="rounded-md bg-[#C8FF00] px-5 py-2 text-sm font-bold text-[#080808] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Running...' : 'Find Stocks →'}
        </button>
      </div>
    </div>
  );
}
