import React, { useContext, useRef, useState } from "react";
import {
  QueryClient,
  QueryClientContext,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { getAssessment, retryAssessment } from "@/api/ai";
import { WASTE_CATEGORY_MAP } from "@/constants/wasteCategories";

export interface AIAssessmentCardProps {
  intakeId: string;
  variant?: "full" | "compact";
  className?: string;
}

const MAX_POLLS = 10;

function formatRelativeTime(isoDate: string): string {
  try {
    const targetMs = new Date(isoDate).getTime();
    if (Number.isNaN(targetMs)) return "just now";
    const diffSec = Math.round((targetMs - Date.now()) / 1000);
    if (Math.abs(diffSec) < 45) return "just now";

    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const diffMin = Math.round(diffSec / 60);
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
    const diffHr = Math.round(diffMin / 60);
    if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
    const diffDay = Math.round(diffHr / 24);
    return rtf.format(diffDay, "day");
  } catch {
    return "just now";
  }
}

const fallbackQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const AIAssessmentCardInner: React.FC<AIAssessmentCardProps> = ({
  intakeId,
  variant = "full",
  className = "",
}) => {
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();
  const pollCountRef = useRef<number>(0);
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [expandedCompact, setExpandedCompact] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-assessment", intakeId],
    enabled: Boolean(intakeId),
    queryFn: async () => {
      const res = await getAssessment(intakeId);
      if (res === null) {
        pollCountRef.current += 1;
        if (pollCountRef.current >= MAX_POLLS) {
          setTimedOut(true);
        }
      } else {
        pollCountRef.current = 0;
        setTimedOut(false);
      }
      return res;
    },
    refetchInterval: (query) => {
      const current = query.state.data;
      if (current !== null && current !== undefined) return false;
      if (pollCountRef.current >= MAX_POLLS) return false;
      return 3000;
    },
  });

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryAssessment(intakeId);
      pollCountRef.current = 0;
      setTimedOut(false);
      await queryClient.invalidateQueries({
        queryKey: ["ai-assessment", intakeId],
      });
      toast.success("AI classification re-queued");
    } catch {
      toast.error("Could not retry AI analysis");
    } finally {
      setRetrying(false);
    }
  };

  // Timeout state
  if (timedOut && !data) {
    return (
      <div
        className={`rounded-2xl border border-amber-500/30 bg-slate-900/70 p-4 text-left ${className}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>AI analysis took too long. Retry?</span>
          </div>
          <button
            type="button"
            disabled={retrying}
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`}
            />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading / polling skeleton
  if (isLoading || !data) {
    return (
      <div
        data-testid="ai-assessment-loading"
        className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left animate-pulse ${className}`}
      >
        <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>AI analyzing...</span>
        </div>
        {variant === "full" && (
          <div className="mt-3 space-y-2">
            <div className="h-4 w-2/3 rounded bg-slate-800" />
            <div className="h-2.5 w-full rounded bg-slate-800" />
          </div>
        )}
      </div>
    );
  }

  const rawConf =
    data.confidence_score > 1
      ? data.confidence_score / 100
      : data.confidence_score;
  const confPct = Math.round(rawConf * 100);

  const knownCat = WASTE_CATEGORY_MAP[data.detected_category];
  const categoryName = knownCat ? knownCat.name : data.detected_category;
  const isUnknownCategory = !knownCat;

  const barColor =
    rawConf >= 0.85
      ? "bg-emerald-500"
      : rawConf >= 0.7
      ? "bg-amber-500"
      : "bg-red-500";

  const isLowConfidence = rawConf < 0.7;

  const gradeBadgeStyle: Record<string, string> = {
    A: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    B: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    C: "bg-red-500/20 text-red-300 border-red-500/30",
  };

  if (variant === "compact" && !expandedCompact) {
    return (
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: shouldReduceMotion ? 0 : 0.3 }}
        onClick={() => setExpandedCompact(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpandedCompact(true);
        }}
        className={`cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left transition-colors hover:border-slate-700 ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-100">{categoryName}</span>
            {isUnknownCategory && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                (unknown)
              </span>
            )}
            <span className="text-slate-500">·</span>
            <span
              className={`font-bold ${
                isLowConfidence ? "text-red-400" : "text-slate-200"
              }`}
            >
              {confPct}%
            </span>
            <span className="text-slate-500">·</span>
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                gradeBadgeStyle[data.suggested_purity_grade] ??
                gradeBadgeStyle.B
              }`}
            >
              Grade {data.suggested_purity_grade}
            </span>
            <span className="text-slate-500">·</span>
            {data.contamination_detected ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                Contamination
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                ✓ Clean
              </span>
            )}
          </div>
          {isLowConfidence && (
            <span className="rounded-md bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[11px] font-semibold text-red-400">
              Low confidence — review
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: shouldReduceMotion ? 0 : 0.3 }}
      className={`rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-5 text-left space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-bold text-slate-100">AI Analysis</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400">
            model: {data.model_version}
          </span>
          {variant === "compact" && expandedCompact && (
            <button
              type="button"
              onClick={() => setExpandedCompact(false)}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200"
            >
              Collapse
            </button>
          )}
        </div>
      </div>

      {/* Detected Category & Confidence */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-slate-400">
            Detected:{" "}
            <span className="font-bold text-slate-100 text-sm">
              {categoryName}
            </span>
            {isUnknownCategory && (
              <span className="ml-1.5 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                (unknown)
              </span>
            )}
          </div>
          {isLowConfidence && (
            <span className="rounded-lg bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-xs font-semibold text-red-400">
              Low confidence — review
            </span>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Confidence</span>
            <span
              className={`font-bold ${
                isLowConfidence ? "text-red-400" : "text-slate-100"
              }`}
            >
              {confPct}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              data-testid="ai-confidence-bar"
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(100, Math.max(0, confPct))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Purity & Grade */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs">
        <div>
          <div className="text-slate-400">Purity</div>
          <div className="mt-1 text-base font-bold text-slate-100">
            {data.estimated_purity_percentage.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-slate-400">Grade (AI suggest)</div>
          <div className="mt-1">
            <span
              className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-bold ${
                gradeBadgeStyle[data.suggested_purity_grade] ??
                gradeBadgeStyle.B
              }`}
            >
              Grade {data.suggested_purity_grade}
            </span>
          </div>
        </div>
      </div>

      {/* Contamination */}
      {data.contamination_detected ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Contamination detected</span>
          </div>
          {data.contamination_details.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.contamination_details.map((item, idx) => (
                <span
                  key={`${item}-${idx}`}
                  className="rounded-lg border border-amber-500/30 bg-slate-950/70 px-2.5 py-0.5 text-xs font-medium text-amber-200"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>✓ Clean</span>
        </div>
      )}

      {/* Footer: Latency & Timestamp */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
        <div className="flex items-center gap-1.5">
          {data.latency_ms != null && (
            <>
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>{data.latency_ms}ms</span>
              <span>·</span>
            </>
          )}
          <span>Analyzed {formatRelativeTime(data.created_at)}</span>
        </div>
      </div>
    </motion.div>
  );
};

export const AIAssessmentCard: React.FC<AIAssessmentCardProps> = (props) => {
  const existingClient = useContext(QueryClientContext);
  if (!existingClient) {
    return (
      <QueryClientProvider client={fallbackQueryClient}>
        <AIAssessmentCardInner {...props} />
      </QueryClientProvider>
    );
  }
  return <AIAssessmentCardInner {...props} />;
};

export default AIAssessmentCard;
