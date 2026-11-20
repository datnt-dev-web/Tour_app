'use client';

import { useQuery } from '@tanstack/react-query';
import { latLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Navigation, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { STATUS_LABELS, STATUS_TONES, TAB_STATUSES, type TripTab } from '../constants';
import type { TripMapPoint } from '../services/trip-locations-service';
import { tripLocationsQuery } from './trip-queries';
import { formatDistance, nearestPoints, distanceMeters, type LatLng } from './geo';
import { directionsUrl, placeDetailHref } from './trip-view';
import { useMyLocation, type MyLocation } from './use-my-location';

const SINGLE_POINT_ZOOM = 16;
const MY_LOCATION_ZOOM = 15;
const NEAREST_LIMIT = 3;
// Vòng sai số quá rộng (định vị bằng mạng) chỉ gây rối mắt, chỉ vẽ khi đủ nhỏ.
const MAX_ACCURACY_CIRCLE_M = 300;
// Màu chấm "bạn ở đây" khớp --color-ai (xanh dương) để tách khỏi màu ghim quán.
const ME_COLOR = '#1e40af';

const LOCATION_MESSAGES: Partial<Record<MyLocation['status'], string>> = {
  locating: 'Đang lấy vị trí của bạn…',
  denied: 'Bạn đã chặn quyền vị trí. Bật lại trong cài đặt trình duyệt rồi thử lại.',
  unavailable: 'Không lấy được vị trí của bạn, thử lại sau.',
};
const FIT_PADDING: [number, number] = [56, 56];
const DEFAULT_CENTER: [number, number] = [20.8449, 106.6881];
const MAP_HEIGHT = 'h-[max(420px,calc(100dvh-24rem))]';
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

// Path options của Leaflet cần chuỗi màu nên không dùng được class token: khớp --color-accent và màu hổ phách của nhóm warn.
const MARKER_COLORS = { accent: '#047857', warn: '#d97706' } as const;
const markerColor = (p: TripMapPoint) => (p.status === 'wanted' ? MARKER_COLORS.warn : MARKER_COLORS.accent);

/** Căn khung nhìn theo các điểm đang hiện; một điểm thì phóng gần thay vì fitBounds (sẽ zoom tối đa). */
function FitBounds({ points }: { points: TripMapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], SINGLE_POINT_ZOOM);
      return;
    }
    map.fitBounds(latLngBounds(points.map((p): [number, number] => [p.lat, p.lng])), { padding: FIT_PADDING });
  }, [map, points]);
  return null;
}

function ClearOnMapClick({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear });
  return null;
}

/** Chấm vị trí của tôi; lần đầu có vị trí thì bay tới đó, sau đó để người dùng tự kéo bản đồ. */
function MyLocationLayer({ coords, accuracy }: { coords: LatLng; accuracy: number }) {
  const map = useMap();
  const centered = useRef(false);
  useEffect(() => {
    if (centered.current) return;
    centered.current = true;
    map.flyTo([coords.lat, coords.lng], Math.max(map.getZoom(), MY_LOCATION_ZOOM), { duration: 0.6 });
  }, [map, coords]);
  return (
    <>
      {accuracy <= MAX_ACCURACY_CIRCLE_M && (
        <Circle center={[coords.lat, coords.lng]} radius={accuracy} pathOptions={{ color: ME_COLOR, weight: 1, fillColor: ME_COLOR, fillOpacity: 0.12 }} interactive={false} />
      )}
      <CircleMarker center={[coords.lat, coords.lng]} radius={8} pathOptions={{ color: '#ffffff', weight: 3, fillColor: ME_COLOR, fillOpacity: 1 }} interactive={false} />
    </>
  );
}

function PointCard({ point, tripId, distance, onClose }: { point: TripMapPoint; tripId: string; distance: number | null; onClose: () => void }) {
  return (
    <div className="animate-sheet-up absolute inset-x-3 bottom-3 z-[1000] flex flex-col gap-3 rounded border border-line bg-white p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{point.name}</p>
          {point.address && <p className="text-sm text-muted">{point.address}</p>}
        </div>
        <button
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded pressable text-muted hover:bg-surface"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={STATUS_TONES[point.status]}>{STATUS_LABELS[point.status]}</Badge>
        {distance !== null && <span className="text-sm font-medium text-ai">Cách bạn {formatDistance(distance)}</span>}
      </div>
      <div className="flex gap-2">
        <a
          href={directionsUrl(point)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded bg-accent px-4 text-sm font-semibold text-white pressable hover:bg-accent-strong"
        >
          <Navigation size={18} aria-hidden />
          Chỉ đường
        </a>
        <Link
          href={placeDetailHref(point, tripId)}
          className="inline-flex min-h-11 items-center justify-center rounded border border-line bg-white px-4 text-sm font-semibold pressable hover:bg-surface"
        >
          Xem chi tiết
        </Link>
      </div>
    </div>
  );
}

const Notice = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded border border-line bg-white p-6 text-center text-sm text-muted">{children}</p>
);

export default function TripMap({ tripId, tab }: { tripId: string; tab: TripTab }) {
  const { data, isPending, error, refetch, isRefetching } = useQuery(tripLocationsQuery(tripId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { location, start } = useMyLocation();
  const me = location.status === 'ok' ? location.coords : null;
  // Tham chiếu ổn định để FitBounds không căn lại khung nhìn mỗi lần chọn marker.
  const points = useMemo(() => (data ? data.points.filter((p) => TAB_STATUSES[tab].includes(p.status)) : []), [data, tab]);

  if (isPending) {
    return (
      <div className={`relative ${MAP_HEIGHT}`}>
        <Skeleton className="size-full" />
        <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">Đang tìm vị trí các quán…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded border border-line bg-white p-6 text-center text-sm">
        <p className="text-bad">{error.message}</p>
        <Button variant="secondary" disabled={isRefetching} onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }

  const selected = points.find((p) => p.tripPlaceId === selectedId) ?? null;
  const nearest = me ? nearestPoints(points, me, NEAREST_LIMIT) : [];
  const locationMessage = LOCATION_MESSAGES[location.status];

  return (
    <div className="flex flex-col gap-2">
      {points.length === 0 ? (
        <Notice>Chưa có chỗ nào có địa chỉ để hiện trên bản đồ.</Notice>
      ) : (
        <div className={`animate-fade-in relative isolate overflow-hidden rounded border border-line ${MAP_HEIGHT}`}>
          <MapContainer center={DEFAULT_CENTER} zoom={12} zoomControl attributionControl className="size-full">
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
            <FitBounds points={points} />
            <ClearOnMapClick onClear={() => setSelectedId(null)} />
            {points.map((p) => {
              const isSelected = p.tripPlaceId === selectedId;
              return (
                <CircleMarker
                  key={p.tripPlaceId}
                  center={[p.lat, p.lng]}
                  radius={isSelected ? 13 : 10}
                  pathOptions={{ color: '#ffffff', weight: 3, fillColor: markerColor(p), fillOpacity: 1 }}
                  bubblingMouseEvents={false}
                  eventHandlers={{ click: () => setSelectedId(p.tripPlaceId) }}
                />
              );
            })}
            {location.status === 'ok' && <MyLocationLayer coords={location.coords} accuracy={location.accuracy} />}
          </MapContainer>
          <button
            type="button"
            onClick={start}
            disabled={location.status === 'locating'}
            aria-label="Hiện vị trí của tôi"
            aria-pressed={location.status === 'ok'}
            className={`absolute right-3 top-3 z-[1000] inline-flex size-11 items-center justify-center rounded border border-line bg-white shadow-card pressable hover:bg-surface disabled:opacity-60 ${
              location.status === 'ok' ? 'text-ai' : 'text-ink'
            }`}
          >
            <LocateFixed size={20} aria-hidden className={location.status === 'locating' ? 'animate-pulse' : undefined} />
          </button>
          {selected && (
            <PointCard
              key={selected.tripPlaceId}
              point={selected}
              tripId={tripId}
              distance={me ? distanceMeters(me, selected) : null}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      )}
      {locationMessage && (
        <p role="status" className={`text-sm ${location.status === 'locating' ? 'text-muted' : 'text-bad'}`}>
          {locationMessage}
        </p>
      )}
      {nearest.length > 0 && (
        <section aria-label="Quán gần bạn nhất" className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Gần bạn nhất</h2>
          <ul className="flex flex-col gap-1">
            {nearest.map(({ point, meters }) => (
              <li key={point.tripPlaceId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(point.tripPlaceId)}
                  className="pressable flex min-h-11 w-full items-center justify-between gap-3 rounded border border-line bg-white px-3 text-left text-sm hover:bg-surface"
                >
                  <span className="min-w-0 truncate font-medium">{point.name}</span>
                  <span className="shrink-0 font-semibold text-ai">{formatDistance(meters)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.missing > 0 && <p className="text-sm text-muted">{data.missing} chỗ chưa có trên bản đồ (thiếu địa chỉ).</p>}
    </div>
  );
}
