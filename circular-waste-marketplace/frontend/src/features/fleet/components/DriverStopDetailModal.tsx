import React, { useState } from 'react';
import { TripStopRead } from '../../../api/types';
import { completeStop } from '../../../api/fleet';
import { createWeightTicket, scanIntakeByCode } from '../../../api/weightTickets';
import { toast } from 'react-hot-toast';

export interface DriverStopDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  stop: TripStopRead | null;
  expectedBatchCode?: string;
  intakeId?: string;
  onSuccess: () => void;
}

export const DriverStopDetailModal: React.FC<DriverStopDetailModalProps> = ({
  isOpen,
  onClose,
  tripId,
  stop,
  expectedBatchCode,
  intakeId,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'verify' | 'weight' | 'complete'>('verify');
  const [scannedCode, setScannedCode] = useState<string>('');
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Weight form states
  const [grossWeight, setGrossWeight] = useState<number>(0);
  const [tareWeight, setTareWeight] = useState<number>(0);
  const [weightMethod, setWeightMethod] = useState<'digital_scale' | 'manual' | 'demo' | 'weighbridge'>(
    'digital_scale'
  );
  const [scaleId, setScaleId] = useState<string>('SCALE-01');
  const [calibrationDate, setCalibrationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [photoUrl, setPhotoUrl] = useState<string>('https://example.com/scale-ticket.jpg');
  const [weightRecorded, setWeightRecorded] = useState<boolean>(false);
  const [isSavingWeight, setIsSavingWeight] = useState<boolean>(false);

  // Complete step states
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [isCompleting, setIsCompleting] = useState<boolean>(false);

  const netWeight = Math.max(0, grossWeight - tareWeight);

  const handleVerify = async () => {
    if (!scannedCode.trim()) {
      toast.error('Please enter or scan a batch code');
      return;
    }
    setIsScanning(true);
    try {
      const intake = await scanIntakeByCode(scannedCode.trim().toUpperCase());
      if (expectedBatchCode && intake.batch_code !== expectedBatchCode) {
        toast.error(`Scanned batch (${intake.batch_code}) does not match expected stop (${expectedBatchCode})`);
        return;
      }
      setIsVerified(true);
      toast.success('Batch verified successfully! Please record weights.');
      setActiveTab('weight');
    } catch {
      // If endpoint returns error or code doesn't exist
      if (expectedBatchCode && scannedCode.trim().toUpperCase() === expectedBatchCode) {
        setIsVerified(true);
        toast.success('Batch code matched stop! Proceed to record weight.');
        setActiveTab('weight');
      } else {
        toast.error('Invalid or unverified batch code');
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleRecordWeight = async () => {
    if (grossWeight <= 0) {
      toast.error('Gross weight must be greater than zero');
      return;
    }
    if (grossWeight <= tareWeight) {
      toast.error('Gross weight must exceed tare weight');
      return;
    }
    if (!intakeId) {
      toast.error('Intake ID not found for this stop');
      return;
    }

    setIsSavingWeight(true);
    try {
      await createWeightTicket(intakeId, {
        gross_weight_kg: grossWeight,
        tare_weight_kg: tareWeight,
        weight_method: weightMethod,
        scale_id: scaleId,
        scale_calibration_date: calibrationDate,
        photo_urls: photoUrl ? [photoUrl] : [],
      });
      setWeightRecorded(true);
      toast.success(`Weight ticket created! Net: ${netWeight.toFixed(2)} kg`);
      setActiveTab('complete');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record weight';
      toast.error(msg);
    } finally {
      setIsSavingWeight(false);
    }
  };

  const handleCompletePickup = async () => {
    if (!stop) return;
    setIsCompleting(true);
    try {
      await completeStop(tripId, stop.id, { notes: completionNotes });
      toast.success('Stop marked completed!');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete stop';
      toast.error(msg);
    } finally {
      setIsCompleting(false);
    }
  };

  if (!isOpen || !stop) return null;

  return (
    <div
      data-testid="driver-stop-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📍</span> Stop #{stop.sequence} Workflow
            </h2>
            <p className="text-xs text-slate-400">
              Pickup #{stop.pickup_request_id.slice(0, 8)} • Expected Batch: {expectedBatchCode || 'Unknown'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* 3 Steps / Tabs */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <button
            onClick={() => setActiveTab('verify')}
            className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
              activeTab === 'verify'
                ? 'bg-emerald-950 border-emerald-500 text-emerald-400'
                : isVerified
                ? 'bg-slate-800 border-emerald-800 text-emerald-500'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            1. Verify {isVerified && '✓'}
          </button>
          <button
            onClick={() => setActiveTab('weight')}
            className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
              activeTab === 'weight'
                ? 'bg-emerald-950 border-emerald-500 text-emerald-400'
                : weightRecorded
                ? 'bg-slate-800 border-emerald-800 text-emerald-500'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            2. Weigh {weightRecorded && '✓'}
          </button>
          <button
            onClick={() => setActiveTab('complete')}
            className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
              activeTab === 'complete'
                ? 'bg-emerald-950 border-emerald-500 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            3. Complete
          </button>
        </div>

        {/* Tab 1: Verify */}
        {activeTab === 'verify' && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-400 mb-1">Expected Batch Code:</p>
              <p className="font-mono text-base font-bold text-emerald-400">
                {expectedBatchCode || stop.pickup_request_id.slice(0, 8)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Scan or Enter QR / Batch Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. INT-A1B2C3"
                  value={scannedCode}
                  onChange={(e) => setScannedCode(e.target.value)}
                  className="flex-1 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={handleVerify}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isScanning ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>

            {expectedBatchCode && (
              <button
                type="button"
                onClick={() => setScannedCode(expectedBatchCode)}
                className="text-xs text-slate-400 hover:text-emerald-400 underline"
              >
                Auto-fill expected code (Demo Shortcut)
              </button>
            )}
          </div>
        )}

        {/* Tab 2: Weight */}
        {activeTab === 'weight' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Gross Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={grossWeight || ''}
                  onChange={(e) => setGrossWeight(parseFloat(e.target.value) || 0)}
                  placeholder="0.0"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tare Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tareWeight || ''}
                  onChange={(e) => setTareWeight(parseFloat(e.target.value) || 0)}
                  placeholder="0.0"
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Calculated Net Weight:</span>
              <span className="font-mono text-lg font-bold text-emerald-400">
                {netWeight.toFixed(2)} kg
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Method</label>
                <select
                  value={weightMethod}
                  onChange={(e) =>
                    setWeightMethod(
                      e.target.value as 'digital_scale' | 'manual' | 'demo' | 'weighbridge'
                    )
                  }
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="digital_scale">Digital Scale</option>
                  <option value="weighbridge">Weighbridge</option>
                  <option value="manual">Manual</option>
                  <option value="demo">Demo Scale</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Scale ID</label>
                <input
                  type="text"
                  value={scaleId}
                  onChange={(e) => setScaleId(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={isSavingWeight || grossWeight <= 0}
              onClick={handleRecordWeight}
              className="w-full mt-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
            >
              {isSavingWeight ? 'Saving Weight...' : 'Save Weight Ticket'}
            </button>
          </div>
        )}

        {/* Tab 3: Complete */}
        {activeTab === 'complete' && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Verified Batch:</span>
                <span className="font-mono text-white">{expectedBatchCode || 'Confirmed'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Net Weight Recorded:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {netWeight > 0 ? `${netWeight.toFixed(2)} kg` : 'Recorded'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Driver Completion Notes</label>
              <textarea
                rows={2}
                placeholder="Optional notes (e.g. material verified and loaded safely)"
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              disabled={isCompleting}
              onClick={handleCompletePickup}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-lg shadow-emerald-900/40 disabled:opacity-50"
            >
              {isCompleting ? 'Completing Stop...' : '✓ Complete Pickup & Next Stop'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverStopDetailModal;
