'use client';

import { useQuery } from '@tanstack/react-query';
import { latLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { STATUS_LABELS, STATUS_TONES, TAB_STATUSES, type TripTab } from '../constants';
import type { TripMapPoint } from '../services/trip-locations-service';
import { tripLocationsQuery } from './trip-queries';
import { directionsUrl, placeDetailHref } from './trip-view';

const SINGLE_POINT_ZOOM = 16;
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

function PointCard({ point, tripId, onClose }: { point: TripMapPoint; tripId: string; onClose: () => void }) {
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
      <Badge tone={STATUS_TONES[point.status]} className="self-start">
        {STATUS_LABELS[point.status]}
      </Badge>
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
          </MapContainer>
          {selected && <PointCard key={selected.tripPlaceId} point={selected} tripId={tripId} onClose={() => setSelectedId(null)} />}
        </div>
      )}
      {data.missing > 0 && <p className="text-sm text-muted">{data.missing} chỗ chưa có trên bản đồ (thiếu địa chỉ).</p>}
    </div>
  );
}
