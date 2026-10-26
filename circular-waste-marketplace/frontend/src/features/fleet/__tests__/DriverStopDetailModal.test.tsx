import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DriverStopDetailModal } from '../components/DriverStopDetailModal';
import * as weightTicketsApi from '../../../api/weightTickets';
import * as fleetApi from '../../../api/fleet';

vi.mock('../../../api/weightTickets', () => ({
  createWeightTicket: vi.fn(),
  scanIntakeByCode: vi.fn(),
}));

vi.mock('../../../api/fleet', () => ({
  completeStop: vi.fn(),
}));

describe('DriverStopDetailModal Component', () => {
  const mockStop = {
    id: 'stop-abc',
    trip_id: 'trip-123',
    pickup_request_id: 'pickup-xyz',
    sequence: 1,
    status: 'arrived',
    arrived_at: new Date().toISOString(),
    completed_at: null,
    failure_reason: null,
    notes: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with verify tab and expected batch code', () => {
    render(
      <DriverStopDetailModal
        isOpen={true}
        onClose={vi.fn()}
        tripId="trip-123"
        stop={mockStop}
        expectedBatchCode="INT-BATCH-01"
        intakeId="intake-01"
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByTestId('driver-stop-detail-modal')).toBeInTheDocument();
    expect(screen.getByText(/Stop #1 Workflow/i)).toBeInTheDocument();
    expect(screen.getByText('INT-BATCH-01')).toBeInTheDocument();
  });

  it('validates batch code and advances to Weigh tab upon verification', async () => {
    vi.mocked(weightTicketsApi.scanIntakeByCode).mockResolvedValue({
      id: 'intake-01',
      batch_code: 'INT-BATCH-01',
    });

    render(
      <DriverStopDetailModal
        isOpen={true}
        onClose={vi.fn()}
        tripId="trip-123"
        stop={mockStop}
        expectedBatchCode="INT-BATCH-01"
        intakeId="intake-01"
        onSuccess={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/e.g. INT-A1B2C3/i);
    fireEvent.change(input, { target: { value: 'INT-BATCH-01' } });

    const verifyBtn = screen.getByRole('button', { name: /^Verify$/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Gross Weight \(kg\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Tare Weight \(kg\)/i)).toBeInTheDocument();
    });
  });

  it('calculates net weight accurately from gross and tare weights', async () => {
    render(
      <DriverStopDetailModal
        isOpen={true}
        onClose={vi.fn()}
        tripId="trip-123"
        stop={mockStop}
        expectedBatchCode="INT-BATCH-01"
        intakeId="intake-01"
        onSuccess={vi.fn()}
      />
    );

    // Switch to weigh tab directly
    fireEvent.click(screen.getByText(/2. Weigh/i));

    const inputs = screen.getAllByRole('spinbutton');
    const grossInput = inputs[0];
    const tareInput = inputs[1];

    fireEvent.change(grossInput, { target: { value: '350.5' } });
    fireEvent.change(tareInput, { target: { value: '50.5' } });

    expect(screen.getByText('300.00 kg')).toBeInTheDocument();
  });

  it('creates weight ticket and moves to complete tab', async () => {
    vi.mocked(weightTicketsApi.createWeightTicket).mockResolvedValue({
      id: 'ticket-1',
      intake_id: 'intake-01',
      pickup_request_id: 'pickup-xyz',
      weight_method: 'digital_scale',
      gross_weight_kg: 300,
      tare_weight_kg: 50,
      net_weight_kg: 250,
      scale_id: 'SCALE-01',
      scale_calibration_date: '2026-01-01',
      photo_urls: [],
      recorded_by_user_id: 'driver-1',
      recorded_at: '',
      discrepancy_flag: false,
      discrepancy_notes: null,
      notes: null,
      supplier_confirmed_at: null,
      supplier_dispute_notes: null,
      created_at: '',
      updated_at: '',
    });

    render(
      <DriverStopDetailModal
        isOpen={true}
        onClose={vi.fn()}
        tripId="trip-123"
        stop={mockStop}
        expectedBatchCode="INT-BATCH-01"
        intakeId="intake-01"
        onSuccess={vi.fn()}
      />
    );

    // Switch to weigh tab
    fireEvent.click(screen.getByText(/2. Weigh/i));

    const inputs = screen.getAllByRole('spinbutton');
    const grossInput = inputs[0];
    const tareInput = inputs[1];

    fireEvent.change(grossInput, { target: { value: '300' } });
    fireEvent.change(tareInput, { target: { value: '50' } });

    const saveBtn = screen.getByRole('button', { name: /save weight ticket/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(weightTicketsApi.createWeightTicket).toHaveBeenCalledWith('intake-01', {
        gross_weight_kg: 300,
        tare_weight_kg: 50,
        weight_method: 'digital_scale',
        scale_id: 'SCALE-01',
        scale_calibration_date: expect.any(String),
        photo_urls: ['https://example.com/scale-ticket.jpg'],
      });
      expect(screen.getByText(/Complete Pickup & Next Stop/i)).toBeInTheDocument();
    });
  });

  it('completes the stop and notifies parent when complete button is clicked', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    vi.mocked(fleetApi.completeStop).mockResolvedValue({
      id: 'trip-123',
      vehicle_id: 'v-1',
      driver_user_id: 'd-1',
      status: 'in_progress',
      planned_distance_km: 10,
      actual_distance_km: null,
      started_at: null,
      ended_at: null,
      total_weight_kg: 250,
      stops: [],
      created_at: '',
      updated_at: '',
    });

    render(
      <DriverStopDetailModal
        isOpen={true}
        onClose={onClose}
        tripId="trip-123"
        stop={mockStop}
        expectedBatchCode="INT-BATCH-01"
        intakeId="intake-01"
        onSuccess={onSuccess}
      />
    );

    // Switch directly to complete tab
    fireEvent.click(screen.getByText(/3. Complete/i));

    const completeBtn = screen.getByRole('button', { name: /complete pickup/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(fleetApi.completeStop).toHaveBeenCalledWith('trip-123', 'stop-abc', {
        notes: '',
      });
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
