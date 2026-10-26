import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveMap, MapMarker } from '../components/LiveMap';

// Mock react-leaflet components to render predictable DOM in jsdom
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="mock-tile-layer" />,
  Marker: ({
    children,
    eventHandlers,
  }: {
    children: React.ReactNode;
    eventHandlers?: { click?: () => void };
  }) => (
    <div data-testid="mock-marker" onClick={eventHandlers?.click}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-popup">{children}</div>
  ),
  Polyline: () => <div data-testid="mock-polyline" />,
}));

describe('LiveMap Component', () => {
  it('renders empty state when no valid markers or center provided', () => {
    render(<LiveMap markers={[]} />);
    expect(screen.getByTestId('live-map-empty')).toBeInTheDocument();
    expect(screen.getByText(/no location data available/i)).toBeInTheDocument();
  });

  it('renders map container with marker elements when valid coordinates are given', () => {
    const markers: MapMarker[] = [
      {
        id: 'v1',
        lat: 19.076,
        lng: 72.8777,
        kind: 'vehicle',
        label: 'Truck KA01',
        status: 'in_use',
      },
    ];

    render(<LiveMap markers={markers} />);
    expect(screen.getByTestId('live-map-container')).toBeInTheDocument();
    expect(screen.getByTestId('mock-map-container')).toBeInTheDocument();
    expect(screen.getByTestId('mock-marker')).toBeInTheDocument();
    expect(screen.getByText('Truck KA01')).toBeInTheDocument();
  });

  it('renders simulated badge when a marker has isSimulated=true', () => {
    const markers: MapMarker[] = [
      {
        id: 'v-sim',
        lat: 19.076,
        lng: 72.8777,
        kind: 'vehicle',
        label: 'Simulated Van',
        status: 'in_use',
        isSimulated: true,
      },
    ];

    render(<LiveMap markers={markers} />);
    const badge = screen.getByTestId('simulated-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/simulated/i);
  });
});
