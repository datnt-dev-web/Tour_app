/** Khóa cache TanStack Query — định nghĩa một chỗ để client và invalidate dùng chung. */
export const queryKeys = {
  trips: (groupId: string) => ['trips', groupId] as const,
  trip: (tripId: string) => ['trip', tripId] as const,
  book: (groupId: string, filter: unknown) => ['book', groupId, filter] as const,
  explore: (params: unknown) => ['explore', params] as const,
  place: (placeId: string) => ['place', placeId] as const,
  aiSummary: (placeId: string) => ['aiSummary', placeId] as const,
};
