import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle,
  CheckCircle2,
  Circle,
  FilePlus,
  Gavel,
  Layers,
  Lock,
  PackageCheck,
  RefreshCw,
  Scale,
  ShoppingCart,
  Tag,
  Truck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { getActivityFeed } from "@/api/admin";
import { mapEventToDisplay } from "@/api/traceability";
import type { ActivityEvent, TraceabilityEventRead } from "@/api/types";

const PAGE_SIZE = 50;

const EVENT_TYPE_OPTIONS = [
  "batch.submitted",
  "pickup.created",
  "pickup.assigned",
  "pickup.status_changed",
  "pickup.completed",
  "weight.recorded",
  "weight.acknowledged",
  "sorting.completed",
  "listing.created",
  "listing.cancelled",
  "bid.placed",
  "order.created_from_bid",
  "order.created_buy_now",
  "order.escrow_held",
  "order.completed",
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FilePlus,
  Truck,
  UserCheck,
  Scale,
  CheckCircle,
  CheckCircle2,
  Layers,
  Tag,
  Gavel,
  ShoppingCart,
  Lock,
  PackageCheck,
  XCircle,
  Circle,
};

function getDayHeader(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const targetStr = date.toDateString();
  if (targetStr === todayStr) return "Today";
  if (targetStr === yesterdayStr) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(isoString: string): string {
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  );
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export const AdminActivityPage: React.FC = () => {
  const [eventType, setEventType] = useState<string>("");
  const [offset, setOffset] = useState<number>(0);
  const [accumulatedEvents, setAccumulatedEvents] = useState<ActivityEvent[]>(
    []
  );
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      "admin-activity",
      { event_type: eventType || undefined, limit: PAGE_SIZE, offset },
    ],
    queryFn: () =>
      getActivityFeed({
        event_type: eventType || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!data?.items) return;
    if (offset === 0) {
      setAccumulatedEvents(data.items);
    } else {
      setAccumulatedEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const nextItems = data.items.filter((e) => !existingIds.has(e.id));
        return [...prev, ...nextItems];
      });
    }
  }, [data, offset]);

  const total = data?.total ?? 0;
  const hasMore = accumulatedEvents.length < total;

  // Group events by day header
  const grouped: Array<{ day: string; events: ActivityEvent[] }> = [];
  for (const ev of accumulatedEvents) {
    const dayLabel = getDayHeader(ev.created_at);
    const lastGroup = grouped[grouped.length - 1];
    if (!lastGroup || lastGroup.day !== dayLabel) {
      grouped.push({ day: dayLabel, events: [ev] });
    } else {
      lastGroup.events.push(ev);
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-emerald-400" />
            <h1 className="text-2xl font-bold text-slate-100">
              Platform Activity
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Live traceability event stream
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center gap-3">
          <select
            aria-label="Filter by event type"
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setOffset(0);
              setAccumulatedEvents([]);
            }}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="">All event types</option>
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Feed */}
      {isLoading && accumulatedEvents.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
          Loading activity stream...
        </div>
      ) : accumulatedEvents.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-sm text-slate-400">
          No activity yet
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.day} className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                {group.day}
              </div>
              <div className="space-y-2.5">
                {group.events.map((ev) => {
                  const display = mapEventToDisplay({
                    ...ev,
                    request_id: null,
                  } as TraceabilityEventRead);
                  const IconComponent =
                    ICON_MAP[display.icon_name] ?? Circle;
                  const metaKeys = Object.keys(ev.metadata_json || {});
                  const isExpanded = Boolean(expandedIds[ev.id]);

                  return (
                    <div
                      key={ev.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-slate-700"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800/90 border border-slate-700">
                            <IconComponent
                              className={`h-4 w-4 ${display.color}`}
                            />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-100">
                                {display.human_label}
                              </span>
                              {ev.batch_code && (
                                <Link
                                  to={`/dashboard/batches/${ev.batch_id}`}
                                  className="font-mono text-xs font-bold text-emerald-400 hover:underline"
                                >
                                  {ev.batch_code}
                                </Link>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span>{ev.actor_name || "System"}</span>
                              {ev.actor_role && (
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
                                  {ev.actor_role}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{formatRelativeTime(ev.created_at)}</span>
                          {metaKeys.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(ev.id)}
                              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-700"
                            >
                              {isExpanded ? "Hide metadata" : "Metadata"}
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && metaKeys.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800/80 pt-3">
                          {Object.entries(ev.metadata_json).map(([k, v]) => (
                            <span
                              key={k}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1 text-xs font-mono text-slate-300"
                            >
                              <span className="text-slate-500">{k}:</span>
                              <span>{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                disabled={isFetching}
                className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-slate-800 disabled:opacity-50"
              >
                {isFetching ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminActivityPage;
