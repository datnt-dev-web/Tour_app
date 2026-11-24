export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Khoảng cách đường chim bay (haversine), đủ chính xác để so quán nào gần hơn trong một thành phố. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Dưới 1 km làm tròn 10 m, từ 1 km hiện một chữ số thập phân kiểu Việt Nam ("1,2 km"). */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export function nearestPoints<T extends LatLng>(points: T[], me: LatLng, limit: number): { point: T; meters: number }[] {
  return points
    .map((point) => ({ point, meters: distanceMeters(me, point) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit);
}

/**
 * Làm tròn vị trí về ô lưới (độ). Đi trong cùng một ô thì vị trí "không đổi": không phải tính lại quãng đường
 * mỗi bước chân, và máy chủ định tuyến chỉ thấy vị trí thô.
 */
export function snapToGrid(p: LatLng, gridDeg: number): LatLng {
  const snap = (v: number) => Number((Math.round(v / gridDeg) * gridDeg).toFixed(6));
  return { lat: snap(p.lat), lng: snap(p.lng) };
}
