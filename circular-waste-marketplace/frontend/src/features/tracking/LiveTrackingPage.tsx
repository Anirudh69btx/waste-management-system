import React, { useState, useEffect } from "react";
import {
  Navigation,
  BatteryCharging,
  Gauge,
  Compass,
  MapPin,
  Clock,
  Radio,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/Badge";

export const LiveTrackingPage: React.FC = () => {
  const [transitId] = useState("TR-89241");
  const [speed, setSpeed] = useState(38);
  const [batteryPct, setBatteryPct] = useState(82);
  const [etaMinutes, setEtaMinutes] = useState(14);
  const [gpsPingCount, setGpsPingCount] = useState(48);

  // Live telemetry pulse simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setSpeed((s) => Math.max(20, Math.min(55, s + Math.floor(Math.random() * 5 - 2))));
      setGpsPingCount((c) => c + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Navigation className="h-6 w-6 text-brand-400" />
            <span>Live Custody Tracking & GPS Telemetry</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time WebSocket /ws/v1/pickups/:id/track stream with hardware telemetry and anti-tamper breadcrumbs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success" className="animate-pulse">
            <Radio className="h-3 w-3" /> Live GPS Stream
          </Badge>
          <span className="text-xs font-mono text-slate-400">Pings: {gpsPingCount}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: High-Fidelity SVG Route Map */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 border border-white/10 relative overflow-hidden flex flex-col justify-between min-h-[440px]">
          {/* Map Header Overlay */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-3.5 py-2 rounded-xl text-xs backdrop-blur-md">
              <Truck className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-white">Transit ID:</span>
              <span className="font-mono text-brand-400">{transitId}</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-700/80 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300">
              ETA: <span className="font-bold text-emerald-400">{etaMinutes} mins</span> (4.2 km remaining)
            </div>
          </div>

          {/* Interactive Vector Route Canvas */}
          <div className="my-6 relative w-full h-64 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 600 240">
              {/* Background Map Grid */}
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                </pattern>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="70%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Waypoint Route Line */}
              <path
                d="M 60,180 Q 180,60 300,140 T 520,70"
                fill="none"
                stroke="url(#routeGradient)"
                strokeWidth="4"
                strokeDasharray="6,4"
              />

              {/* Origin Marker */}
              <circle cx="60" cy="180" r="8" fill="#16a34a" />
              <text x="50" y="210" fill="#94a3b8" fontSize="11" fontWeight="600">
                Supplier Depot
              </text>

              {/* Vehicle Current Position Pulse */}
              <circle cx="340" cy="120" r="14" fill="#3b82f6" fillOpacity="0.25" className="animate-ping" />
              <circle cx="340" cy="120" r="8" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
              <text x="310" y="100" fill="#60a5fa" fontSize="11" fontWeight="bold">
                🚚 EV Van MH-04 (38 km/h)
              </text>

              {/* Destination Marker */}
              <circle cx="520" cy="70" r="8" fill="#8b5cf6" />
              <text x="470" y="50" fill="#c084fc" fontSize="11" fontWeight="600">
                Apex Sorting Hub
              </text>
            </svg>
          </div>

          {/* Telemetry Status Bar */}
          <div className="grid grid-cols-3 gap-3 z-10 pt-2 border-t border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-emerald-400" />
              <div>
                <span className="text-slate-400 block text-[10px]">Speed</span>
                <span className="font-bold text-white font-mono">{speed} km/h</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BatteryCharging className="h-4 w-4 text-cyan-400" />
              <div>
                <span className="text-slate-400 block text-[10px]">EV Battery</span>
                <span className="font-bold text-white font-mono">{batteryPct}%</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-indigo-400" />
              <div>
                <span className="text-slate-400 block text-[10px]">Heading</span>
                <span className="font-bold text-white font-mono">042° NE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Custody Chain Milestones */}
        <div className="glass-card rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Custody Handover Trail
          </div>

          <div className="space-y-4 text-xs">
            {[
              {
                title: "Consignment Handover Confirmed",
                time: "14:12 PM",
                desc: "Driver scanned supplier QR manifest at farm gate.",
                done: true,
              },
              {
                title: "En Route to Central Sorting Hub",
                time: "14:15 PM",
                desc: "Live GPS breadcrumbs broadcast via Redis Pub/Sub.",
                done: true,
              },
              {
                title: "Sorter Facility Geofence Entry",
                time: "Est. 14:32 PM",
                desc: "Weighbridge operator alerted for gross weight measurement.",
                done: false,
              },
              {
                title: "Purity & Contamination Assay",
                time: "Est. 14:45 PM",
                desc: "Automated optical inspection and tare subtraction.",
                done: false,
              },
            ].map((step, idx) => (
              <div key={idx} className="flex gap-3 relative">
                {idx < 3 && (
                  <div
                    className={`absolute left-3 top-6 bottom-0 w-0.5 ${
                      step.done ? "bg-emerald-500" : "bg-slate-800"
                    }`}
                  />
                )}
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 z-10 ${
                    step.done
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-slate-800 border border-slate-700 text-slate-500"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${step.done ? "text-white" : "text-slate-400"}`}>
                      {step.title}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{step.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
