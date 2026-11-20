// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';
import { useAddToTrip } from '@/features/trips/ui/use-trip-mutations';

vi.mock('@/features/trips/actions/trip-actions', () => ({
  addToTripAction: vi.fn(async () => ({ ok: true, data: {} })),
  removeAction: vi.fn(),
  setStatusAction: vi.fn(),
}));

test('thêm chỗ vào chuyến làm mới màn chỗ, sổ quán, chuyến', async () => {
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useAddToTrip({ onMutate: () => {}, onError: () => {} }), { wrapper });
  await act(async () => {
    result.current.mutate({ googlePlaceId: 'g1', input: { tripId: 't1', placeId: 'p1', category: 'food', city: 'x' } });
  });
  await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['place'] }));
  expect(spy).toHaveBeenCalledWith({ queryKey: ['book'] });
  expect(spy).toHaveBeenCalledWith({ queryKey: ['trips'] });
});
