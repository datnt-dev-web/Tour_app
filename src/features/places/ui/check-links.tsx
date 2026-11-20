import { ExternalLink } from 'lucide-react';
import { buildCheckLinks } from '@/features/explore/services/check-links';

/** "Tự kiểm tra": 4 đường dẫn tìm review ngoài app, mở tab mới. */
export function CheckLinks({ name, city }: { name: string; city: string }) {
  const links = buildCheckLinks(name, city);
  const items = [
    { label: 'Threads', href: links.threads },
    { label: 'TikTok', href: links.tiktok },
    { label: 'Google Maps', href: links.maps },
    { label: 'Google', href: links.google },
  ];
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-bold">Tự kiểm tra</h2>
      <div className="grid grid-cols-2 gap-2">
        {items.map((i) => (
          <a
            key={i.label}
            href={i.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-between gap-2 rounded border border-line bg-white px-3 text-sm font-semibold hover:bg-surface"
          >
            {i.label}
            <ExternalLink size={16} className="text-muted" aria-hidden />
          </a>
        ))}
      </div>
    </section>
  );
}
