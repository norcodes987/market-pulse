type Tab = 'all' | 'owned' | 'watching';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  counts: { all: number; owned: number; watching: number };
}

export function TabBar({ activeTab, onTabChange, counts }: Props) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'owned', label: `Owned (${counts.owned})` },
    { id: 'watching', label: `Watching (${counts.watching})` },
  ];

  return (
    <div className='border-b border-[#1f1f1f]'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 flex'>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`px-4 py-3 text-xs font-semibold tracking-wide border-b-2 transition-colors ${
              activeTab === id
                ? 'border-[#C8FF00] text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
