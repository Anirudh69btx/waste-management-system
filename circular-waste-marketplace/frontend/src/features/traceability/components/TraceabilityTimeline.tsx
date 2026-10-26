import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  FilePlus,
  Truck,
  UserCheck,
  Scale,
  CheckCircle,
  Layers,
  Tag,
  Gavel,
  ShoppingCart,
  Lock,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Circle,
  ChevronDown,
  ChevronRight,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { getBatchTimeline, mapEventToDisplay } from "@/api/traceability";
import { Badge } from "@/components/Badge";
import type { TraceabilityEventRead } from "@/api/types";

interface TraceabilityTimelineProps {
  batchId: string;
  compact?: boolean;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FilePlus,
  Truck,
  UserCheck,
  Scale,
  CheckCircle,
  Layers,
  Tag,
  Gavel,
  ShoppingCart,
  Lock,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Circle,
};

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatAbsoluteTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return dateStr;
  }
}

function getRoleBadgeVariant(role: string | null): "success" | "warning" | "danger" | "info" | "neutral" | "purple" {
  switch (role?.toUpperCase()) {
    case "ADMIN":
      return "purple";
    case "RECYCLER":
      return "success";
    case "LOGISTICS":
      return "info";
    case "GENERATOR":
      return "warning";
    default:
      return "neutral";
  }
}

export const TraceabilityTimeline: React.FC<TraceabilityTimelineProps> = ({
  batchId,
  compact = false,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ["traceability", batchId],
    queryFn: () => getBatchTimeline(batchId),
    enabled: Boolean(batchId),
  });

  const toggleExpand = (id: string) => {
    if (compact) return;
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) {
    return (
      <div className={clsx("animate-pulse space-y-3", compact ? "py-2" : "py-4")}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-3 bg-slate-800/60 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">
        Failed to load traceability timeline.
      </div>
    );
  }

  const events: TraceabilityEventRead[] = [...(data?.events ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-800 text-slate-400">
        <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-600" />
        <p className="text-sm font-medium">No events recorded yet</p>
        <p className="text-xs text-slate-500 mt-1">Audit log will populate as consignment progresses.</p>
      </div>
    );
  }

  return (
    <div className={clsx("relative", compact ? "pl-2" : "pl-4")}>
      {/* Vertical timeline connecting line */}
      <div className="absolute left-6 top-3 bottom-3 w-px bg-slate-800" />

      <div className="space-y-4">
        {events.map((event, idx) => {
          const display = mapEventToDisplay(event);
          const IconComponent = ICON_MAP[display.icon_name] ?? Circle;
          const isExpanded = Boolean(expandedNodes[event.id]);
          const hasMetadata =
            event.metadata_json && Object.keys(event.metadata_json).length > 0;
          const isLatest = idx === 0;

          return (
            <div key={event.id} className="relative flex items-start gap-3">
              {/* Node Icon */}
              <div
                className={clsx(
                  "relative z-10 flex items-center justify-center rounded-full border shrink-0 transition-transform",
                  compact ? "w-8 h-8" : "w-9 h-9",
                  isLatest
                    ? "bg-slate-900 border-emerald-500/50 shadow-sm shadow-emerald-500/20 ring-2 ring-emerald-500/20"
                    : "bg-slate-900 border-slate-800"
                )}
              >
                <IconComponent className={clsx("w-4 h-4", display.color)} />
              </div>

              {/* Node Content */}
              <div
                className={clsx(
                  "flex-1 rounded-xl border transition-colors",
                  compact
                    ? "bg-slate-900/40 border-slate-800/60 p-2.5"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700/80 p-3.5",
                  !compact && hasMetadata && "cursor-pointer"
                )}
                onClick={() => hasMetadata && toggleExpand(event.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      {display.human_label}
                    </span>
                    {isLatest && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Latest
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {event.actor_role && (
                      <Badge variant={getRoleBadgeVariant(event.actor_role)} size="sm">
                        {event.actor_role}
                      </Badge>
                    )}
                    <span
                      title={formatAbsoluteTime(event.created_at)}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 cursor-help"
                    >
                      <Clock className="w-3 h-3 text-slate-500" />
                      {formatRelativeTime(event.created_at)}
                    </span>
                    {!compact && hasMetadata && (
                      <span className="text-slate-500 ml-1">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status transition hint */}
                {(event.from_status || event.to_status) && (
                  <p className="text-xs text-slate-400 mt-1">
                    Status:{" "}
                    {event.from_status ? (
                      <span className="text-slate-400 line-through mr-1">
                        {event.from_status}
                      </span>
                    ) : null}
                    <span className="text-emerald-400 font-medium">
                      {event.to_status ?? "updated"}
                    </span>
                  </p>
                )}

                {/* Expandable metadata table */}
                {!compact && isExpanded && hasMetadata && (
                  <div
                    className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 overflow-x-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <table className="w-full text-left font-mono">
                      <tbody>
                        {Object.entries(event.metadata_json).map(([key, val]) => (
                          <tr key={key} className="border-b border-slate-800/50 last:border-0">
                            <td className="py-1 pr-3 font-semibold text-slate-400">{key}</td>
                            <td className="py-1 text-slate-200">
                              {typeof val === "object" && val !== null
                                ? JSON.stringify(val)
                                : String(val ?? "—")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TraceabilityTimeline;
