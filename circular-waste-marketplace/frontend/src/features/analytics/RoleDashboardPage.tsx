import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  Scale,
  Leaf,
  DollarSign,
  ShieldCheck,
  Award,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useAuthStore } from "@/features/auth/authStore";

export const RoleDashboardPage: React.FC = () => {
  const { user } = useAuthStore();

  const diversionMonthlyData = [
    { month: "May", organic: 3200, plastic: 1800, metal: 950 },
    { month: "Jun", organic: 4100, plastic: 2100, metal: 1200 },
    { month: "Jul", organic: 4800, plastic: 2600, metal: 1450 },
    { month: "Aug", organic: 5400, plastic: 2900, metal: 1700 },
    { month: "Sep", organic: 6200, plastic: 3400, metal: 2100 },
    { month: "Oct", organic: 7100, plastic: 3900, metal: 2450 },
  ];

  const co2AvoidanceData = [
    { month: "May", co2e: 2100 },
    { month: "Jun", co2e: 2750 },
    { month: "Jul", co2e: 3400 },
    { month: "Aug", co2e: 4100 },
    { month: "Sep", co2e: 5200 },
    { month: "Oct", co2e: 6450 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-brand-400" />
            <span>Circular Economy Impact & ESG Intelligence</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time telemetry on landfill diversion, material recovery rates, and carbon offset accounting.
          </p>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Diverted Feedstock"
          value="42,850 kg"
          subtitle="diverted from municipal landfills"
          icon={Scale}
          trend="+18.4% MoM"
          trendPositive={true}
        />
        <StatCard
          title="Avoided GHG Emissions"
          value="34.8 tCO₂e"
          subtitle="verified emission reductions"
          icon={Leaf}
          trend="+22.1% MoM"
          trendPositive={true}
        />
        <StatCard
          title="Escrow Trade Volume"
          value="₹1,248,500"
          subtitle="100% on-chain audit custody"
          icon={DollarSign}
          trend="+15.3% MoM"
          trendPositive={true}
        />
        <StatCard
          title="Custody Pass Rate"
          value="99.4%"
          subtitle="0 disputes across 1,842 lots"
          icon={ShieldCheck}
          trend="Grade A Target"
          trendPositive={true}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Landfill Diversion Bar Chart */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Landfill Diversion by Material (kg)
            </span>
            <span className="text-xs text-brand-400 font-medium">Monthly Aggregation</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diversionMonthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#090d16",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="organic" fill="#22c55e" name="Organic Biomass" radius={[4, 4, 0, 0]} />
                <Bar dataKey="plastic" fill="#3b82f6" name="PET Plastics" radius={[4, 4, 0, 0]} />
                <Bar dataKey="metal" fill="#8b5cf6" name="Scrap Metal" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CO2e Offset Area Chart */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Cumulative Avoided Carbon (kg CO₂e)
            </span>
            <span className="text-xs text-emerald-400 font-medium">Grid Factor: 0.82 kg/kWh</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={co2AvoidanceData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="co2Gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#090d16",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="co2e"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#co2Gradient)"
                  name="Avoided CO₂e (kg)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
