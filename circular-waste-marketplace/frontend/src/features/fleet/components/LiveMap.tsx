import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default icon URL resolution bug in bundled environments
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: 'vehicle' | 'pickup' | 'hub';
  label: string;
  status?: string;
  isSimulated?: boolean;
}

export interface MapPolyline {
  points: [number, number][];
  color?: string;
  dashed?: boolean;
}

export interface LiveMapProps {
  markers: MapMarker[];
  polylines?: MapPolyline[];
  center?: [number, number];
  zoom?: number;
  onMarkerClick?: (id: string) => void;
  height?: string;
}

const createCustomIcon = (kind: MapMarker['kind'], isSimulated?: boolean) => {
  let bgClass = 'bg-emerald-500 text-white';
  let iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
      <path d="M15 18H9"/>
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
      <circle cx="17" cy="18" r="2"/>
      <circle cx="7" cy="18" r="2"/>
    </svg>`;

  if (kind === 'vehicle') {
    if (isSimulated) {
      bgClass = 'bg-slate-500 text-slate-100 border-2 border-dashed border-amber-400';
    } else {
      bgClass = 'bg-emerald-600 text-white border-2 border-emerald-300';
    }
  } else if (kind === 'pickup') {
    bgClass = 'bg-amber-500 text-white border-2 border-amber-200';
    iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>`;
  } else if (kind === 'hub') {
    bgClass = 'bg-blue-600 text-white border-2 border-blue-300';
    iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>`;
  }

  const html = `
    <div class="relative flex items-center justify-center w-8 h-8 rounded-full shadow-lg ${bgClass} transform transition-transform hover:scale-110">
      ${iconSvg}
      ${
        isSimulated
          ? '<span class="absolute -top-1 -right-1 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span></span>'
          : ''
      }
    </div>`;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
};

export const LiveMap: React.FC<LiveMapProps> = ({
  markers,
  polylines = [],
  center,
  zoom = 12,
  onMarkerClick,
  height = '500px',
}) => {
  const validMarkers = useMemo(
    () =>
      markers.filter(
        (m) =>
          typeof m.lat === 'number' &&
          typeof m.lng === 'number' &&
          !isNaN(m.lat) &&
          !isNaN(m.lng)
      ),
    [markers]
  );

  const mapCenter: [number, number] = useMemo(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      return center;
    }
    if (validMarkers.length > 0) {
      return [validMarkers[0].lat, validMarkers[0].lng];
    }
    const envLat = parseFloat(import.meta.env.VITE_MAP_DEFAULT_CENTER_LAT || '19.0760');
    const envLng = parseFloat(import.meta.env.VITE_MAP_DEFAULT_CENTER_LNG || '72.8777');
    return [isNaN(envLat) ? 19.076 : envLat, isNaN(envLng) ? 72.8777 : envLng];
  }, [center, validMarkers]);

  const tileUrl =
    import.meta.env.VITE_MAP_TILES_URL_OSM ||
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  if (validMarkers.length === 0 && !center) {
    return (
      <div
        data-testid="live-map-empty"
        className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 p-8"
        style={{ height }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-12 h-12 text-slate-600 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        <p className="text-sm font-medium">No location data available</p>
        <p className="text-xs text-slate-500 mt-1">
          Active trips or vehicle GPS coordinates will appear here
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="live-map-container"
      className="relative w-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl"
      style={{ height }}
    >
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={tileUrl}
        />

        {polylines.map((line, idx) => (
          <Polyline
            key={`poly-${idx}`}
            positions={line.points}
            pathOptions={{
              color: line.color || (line.dashed ? '#94a3b8' : '#10b981'),
              weight: line.dashed ? 3 : 4,
              dashArray: line.dashed ? '6, 8' : undefined,
              opacity: 0.85,
            }}
          />
        ))}

        {validMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={createCustomIcon(marker.kind, marker.isSimulated)}
            eventHandlers={{
              click: () => onMarkerClick?.(marker.id),
            }}
          >
            <Popup className="custom-leaflet-popup">
              <div className="p-1 min-w-[160px]">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-slate-900 text-sm">{marker.label}</span>
                  {marker.isSimulated && (
                    <span
                      data-testid="simulated-badge"
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wider"
                    >
                      Simulated
                    </span>
                  )}
                </div>
                {marker.status && (
                  <p className="text-xs text-slate-600 capitalize">
                    Status: <span className="font-medium text-slate-800">{marker.status}</span>
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default LiveMap;
