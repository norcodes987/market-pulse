export function SkeletonCard() {
  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-5 w-16 bg-[#1f1f1f] rounded" />
        <div className="h-4 w-12 bg-[#1f1f1f] rounded" />
      </div>
      <div className="h-8 w-28 bg-[#1f1f1f] rounded mb-2" />
      <div className="h-4 w-20 bg-[#1f1f1f] rounded mb-4" />
      <div className="h-12 bg-[#1f1f1f] rounded mb-3" />
      <div className="flex justify-between">
        <div className="h-3 w-24 bg-[#1f1f1f] rounded" />
        <div className="h-3 w-16 bg-[#1f1f1f] rounded" />
      </div>
    </div>
  );
}
