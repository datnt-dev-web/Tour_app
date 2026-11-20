import { Skeleton } from '@/shared/ui/skeleton';

export default function Loading() {
  return (
    <main aria-busy className="animate-enter flex flex-col gap-4 p-4">
      <Skeleton className="h-11" />
      <Skeleton className="h-40 rounded-sm" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-sm" />
        ))}
      </div>
    </main>
  );
}
