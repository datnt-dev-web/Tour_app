import { Suspense } from 'react';
import { ExploreScreen } from '@/features/explore/ui/explore-screen';
import { getRequestGroup } from '@/features/groups/server/get-request-group';

export default async function ExplorePage() {
  const ctx = await getRequestGroup();
  // useSearchParams trong ExploreScreen cần Suspense để build tĩnh không vỡ.
  return (
    <Suspense>
      <ExploreScreen groupId={ctx?.group?.id ?? null} />
    </Suspense>
  );
}
