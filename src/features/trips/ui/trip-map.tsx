'use client';

import { AdvancedMarker, APIProvider, Map, Pin, useMap } from '@vis.gl/react-google-maps';
import { useQuery } from '@tanstack/react-query';
import { Navigation, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { STATUS_LABELS, STATUS_TONES, TAB_STATUSES, type TripTab } from '../constants';
import type { TripMapPoint } from '../services/trip-locations-service';
import { tripLocationsQuery } from './trip-queries';
import { directionsUrl, placeDetailHref } from './trip-view';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
// AdvancedMarker bắt buộc có map id; DEMO_MAP_ID dùng được khi chưa tạo map id riêng.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
const SINGLE_POINT_ZOOM = 16;
const FIT_PADDING = 56;
const DEFAULT_CENTER = { lat: 20.8449, lng: 106.6881 };
const MAP_HEIGHT = 'h-[max(420px,calc(100dvh-24rem))]';

// Pin cần chuỗi màu nên không dùng được class token: khớp --color-accent và màu hổ phách của nhóm warn.
const PIN_COLORS = { accent: '#047857', warn: '#d97706' } as const;
const pinColor = (p: TripMapPoint) => (p.status === 'wanted' ? PIN_COLORS.warn : PIN_COLORS.accent);

/** Căn khung nhìn theo các điểm đang hiện; một điểm thì phóng gần thay vì fitBounds (sẽ zoom tối đa). */
function FitBounds({ points }: { points: TripMapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng });
      map.setZoom(SINGLE_POINT_ZOOM);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const p of points) bounds.extend({ lat: p.lat, lng: p.lng });
    map.fitBounds(bounds, FIT_PADDING);
  }, [map, points]);
  return null;
}

function PointCard({ point, tripId, onClose }: { point: TripMapPoint; tripId: string; onClose: () => void }) {
  return (
    <div className="animate-sheet-up absolute inset-x-3 bottom-3 flex flex-col gap-3 rounded border border-line bg-white p-3 shadow-card">
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
  const { data, isPending, error, refetch, isRefetching } = useQuery({ ...tripLocationsQuery(tripId), enabled: !!MAPS_KEY });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!MAPS_KEY) return <Notice>Chưa cấu hình Google Maps.</Notice>;
  if (isPending) return <Skeleton className={MAP_HEIGHT} />;
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

  const points = data.points.filter((p) => TAB_STATUSES[tab].includes(p.status));
  const selected = points.find((p) => p.tripPlaceId === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      {points.length === 0 ? (
        <Notice>Chưa có chỗ nào có địa chỉ để hiện trên bản đồ.</Notice>
      ) : (
        <div className={`animate-fade-in relative overflow-hidden rounded border border-line ${MAP_HEIGHT}`}>
          <APIProvider apiKey={MAPS_KEY} language="vi" region="VN">
            <Map
              mapId={MAP_ID}
              defaultCenter={DEFAULT_CENTER}
              defaultZoom={12}
              gestureHandling="greedy"
              disableDefaultUI
              zoomControl
              onClick={() => setSelectedId(null)}
              className="size-full"
            >
              <FitBounds points={points} />
              {points.map((p) => (
                <AdvancedMarker
                  key={p.tripPlaceId}
                  position={{ lat: p.lat, lng: p.lng }}
                  title={p.name}
                  zIndex={p.tripPlaceId === selectedId ? 1 : 0}
                  onClick={() => setSelectedId(p.tripPlaceId)}
                >
                  <Pin background={pinColor(p)} borderColor="#0b3b2a" glyphColor="#ffffff" scale={p.tripPlaceId === selectedId ? 1.3 : 1} />
                </AdvancedMarker>
              ))}
            </Map>
          </APIProvider>
          {selected && <PointCard key={selected.tripPlaceId} point={selected} tripId={tripId} onClose={() => setSelectedId(null)} />}
        </div>
      )}
      {data.missing > 0 && <p className="text-sm text-muted">{data.missing} chỗ chưa có trên bản đồ (thiếu địa chỉ).</p>}
    </div>
  );
}
