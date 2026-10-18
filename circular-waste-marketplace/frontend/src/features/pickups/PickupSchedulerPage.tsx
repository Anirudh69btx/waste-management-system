import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Truck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

interface PickupOrder {
  id: string;
  batchCode: string;
  category: string;
  weightKg: number;
  scheduledDate: string;
  timeSlot: string;
  status: "REQUESTED" | "ASSIGNED" | "EN_ROUTE" | "ARRIVED" | "COMPLETED";
  driverName?: string;
  driverPhone?: string;
  vehicleNo?: string;
}

export const PickupSchedulerPage: React.FC = () => {
  const [scheduledPickups, setScheduledPickups] = useState<PickupOrder[]>([
    {
      id: "pk-101",
      batchCode: "CWM-LOT-882194",
      category: "Organic Biomass",
      weightKg: 450,
      scheduledDate: "Today, 18 Oct 2026",
      timeSlot: "14:00 - 16:00",
      status: "EN_ROUTE",
      driverName: "Ramesh Kumar",
      driverPhone: "+91 98765 43214",
      vehicleNo: "MH-04-AZ-2918 (Electric Van)",
    },
    {
      id: "pk-102",
      batchCode: "CWM-LOT-441029",
      category: "PET Plastics",
      weightKg: 280,
      scheduledDate: "Tomorrow, 19 Oct 2026",
      timeSlot: "10:00 - 12:00",
      status: "REQUESTED",
    },
  ]);

  const [date, setDate] = useState("2026-10-20");
  const [slot, setSlot] = useState("10:00 - 12:00");
  const [address, setAddress] = useState("Plot 42, Agro Industrial Estate, Sector 18, Navi Mumbai");

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    const newOrder: PickupOrder = {
      id: "pk-" + Date.now(),
      batchCode: "CWM-LOT-" + Math.floor(100000 + Math.random() * 900000),
      category: "Segregated Feedstock",
      weightKg: 350,
      scheduledDate: date,
      timeSlot: slot,
      status: "REQUESTED",
    };
    setScheduledPickups([newOrder, ...scheduledPickups]);
  };

  const getStatusBadge = (status: PickupOrder["status"]) => {
    switch (status) {
      case "REQUESTED":
        return <Badge variant="warning">Requested</Badge>;
      case "ASSIGNED":
        return <Badge variant="info">Driver Assigned</Badge>;
      case "EN_ROUTE":
        return <Badge variant="success">Driver En Route</Badge>;
      case "ARRIVED":
        return <Badge variant="purple">Arrived at Weighbridge</Badge>;
      case "COMPLETED":
        return <Badge variant="neutral">Settled</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Truck className="h-6 w-6 text-brand-400" />
          <span>Logistics Dispatch & Pickup Scheduler</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Coordinate zero-emission electric fleet pickups, schedule collection slots, and track driver custody.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Book Pickup Slot Form */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <Calendar className="h-4 w-4 text-brand-400" />
            <span>Book New Collection Slot</span>
          </div>

          <form onSubmit={handleBook} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Pickup Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Time Slot Window</label>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100"
              >
                <option value="08:00 - 10:00">08:00 - 10:00 AM (Morning Shift)</option>
                <option value="10:00 - 12:00">10:00 - 12:00 PM</option>
                <option value="14:00 - 16:00">14:00 - 16:00 PM (Afternoon Shift)</option>
                <option value="16:00 - 18:00">16:00 - 18:00 PM</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Pickup Facility Address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100"
              />
            </div>

            <Button type="submit" className="w-full mt-2">
              <span>Confirm Pickup Slot</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Live Pickups List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Active Pickup Manifests & Transit FSM
          </div>

          <div className="space-y-3">
            {scheduledPickups.map((p) => (
              <div key={p.id} className="glass-card glass-card-hover rounded-2xl p-5 border border-white/10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{p.batchCode}</span>
                        <span className="text-xs text-slate-400">({p.category})</span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>{p.scheduledDate} &bull; {p.timeSlot}</span>
                      </div>
                    </div>
                  </div>
                  <div>{getStatusBadge(p.status)}</div>
                </div>

                {p.driverName && (
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{p.driverName}</span>
                      <span className="text-slate-500">&bull;</span>
                      <span className="text-slate-400 font-mono">{p.vehicleNo}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-brand-400 font-mono">{p.driverPhone}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => (window.location.href = "/tracking")}
                      >
                        Live GPS Trail
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
