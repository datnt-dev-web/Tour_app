/** Khóa cache TanStack Query — định nghĩa một chỗ để client và invalidate dùng chung. */
export const queryKeys = {
  trips: (groupId: string) => ['trips', groupId] as const,
  /** Tiền tố chung của mọi danh sách chuyến, để invalidate khi chưa biết groupId. */
  tripsAll: ['trips'] as const,
  trip: (tripId: string) => ['trip', tripId] as const,
  tripLocations: (tripId: string) => ['tripLocations', tripId] as const,
  book: (groupId: string, filter: unknown) => ['book', groupId, filter] as const,
  explore: (params: unknown) => ['explore', params] as const,
  /** Tiền tố chung của mọi màn chỗ / sổ quán, để invalidate khi chưa biết khóa cụ thể. */
  placeAll: ['place'] as const,
  bookAll: ['book'] as const,
  place: (placeId: string) => ['place', placeId] as const,
  aiSummary: (placeId: string) => ['aiSummary', placeId] as const,
  aiStatus: ['aiStatus'] as const,
};
