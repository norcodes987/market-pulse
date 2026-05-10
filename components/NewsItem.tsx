import type { NewsArticle } from '@/types';

interface Props {
  article: NewsArticle;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NewsItem({ article }: Props) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-4 py-2.5 hover:bg-[#1a1a1a] transition-colors group"
    >
      <p className="text-sm text-white group-hover:text-[#C8FF00] transition-colors line-clamp-2 leading-snug">
        {article.title}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">
        {article.publisher} · {relativeTime(article.publishedAt)}
      </p>
    </a>
  );
}
