import { Suspense } from 'react';
import { ExploreScreen } from '@/features/explore/ui/explore-screen';

export default function ExplorePage() {
  // useSearchParams trong ExploreScreen cần Suspense để build tĩnh không vỡ.
  return (
    <Suspense>
      <ExploreScreen />
    </Suspense>
  );
}
