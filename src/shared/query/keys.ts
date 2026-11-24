/** Khóa cache TanStack Query — định nghĩa một chỗ để client và invalidate dùng chung. */
export const queryKeys = {
  trips: (groupId: string) => ['trips', groupId] as const,
  /** Tiền tố chung của mọi danh sách chuyến, để invalidate khi chưa biết groupId. */
  tripsAll: ['trips'] as const,
  trip: (tripId: string) => ['trip', tripId] as const,
  /** Một trang chỗ của chuyến theo bộ lọc; tiền tố `tripStopsAll` để sửa/làm mới mọi trang cùng lúc. */
  tripStops: (tripId: string, query: unknown) => ['tripStops', tripId, query] as const,
  tripStopsAll: (tripId: string) => ['tripStops', tripId] as const,
  tripStats: (tripId: string) => ['tripStats', tripId] as const,
  tripLocations: (tripId: string) => ['tripLocations', tripId] as const,
  /** Quãng đường tab Hôm nay: theo ô lưới vị trí và danh sách chỗ chưa đi. */
  tripDistances: (tripId: string, origin: string, ids: string[]) => ['tripDistances', tripId, origin, ids] as const,
  tripInfos: (tripId: string) => ['tripInfos', tripId] as const,
  tripPhotos: (tripId: string) => ['tripPhotos', tripId] as const,
  groupTracks: ['groupTracks'] as const,
  /** Người tham gia, các khoản có người trả và các lần chuyển của chuyến (phần chia tiền). */
  tripSplit: (tripId: string) => ['tripSplit', tripId] as const,
  tripWeather: (tripId: string) => ['tripWeather', tripId] as const,
  placePhotos: (placeId: string) => ['placePhotos', placeId] as const,
  photoCovers: ['photoCovers'] as const,
  book: (groupId: string, filter: unknown) => ['book', groupId, filter] as const,
  explore: (params: unknown) => ['explore', params] as const,
  /** Tiền tố chung của mọi màn chỗ / sổ quán, để invalidate khi chưa biết khóa cụ thể. */
  placeAll: ['place'] as const,
  bookAll: ['book'] as const,
  place: (placeId: string) => ['place', placeId] as const,
  aiSummary: (placeId: string) => ['aiSummary', placeId] as const,
  aiStatus: ['aiStatus'] as const,
  geoSuggest: (kind: string, q: string, city: string | undefined) => ['geoSuggest', kind, q, city ?? ''] as const,
};
