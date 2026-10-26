import React from "react";

export interface StatusBadgeProps {
  status: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
  showDot?: boolean;
}

const STATUS_CONFIGS: Record<
  string,
  { label?: string; tone: "emerald" | "amber" | "blue" | "rose" | "purple" | "slate" | "teal" }
> = {
  // Batch/Intake statuses
  SUBMITTED: { tone: "blue", label: "Submitted" },
  ASSIGNED: { tone: "purple", label: "Assigned" },
  PICKED_UP: { tone: "amber", label: "Picked Up" },
  WEIGHED: { tone: "teal", label: "Weighed" },
  SORTED: { tone: "emerald", label: "Sorted" },
  IN_TRANSIT: { tone: "amber", label: "In Transit" },

  // Listing statuses
  ACTIVE: { tone: "emerald", label: "Active" },
  PENDING: { tone: "amber", label: "Pending" },
  COMPLETED: { tone: "emerald", label: "Completed" },
  CANCELLED: { tone: "rose", label: "Cancelled" },
  REJECTED: { tone: "rose", label: "Rejected" },
  EXPIRED: { tone: "slate", label: "Expired" },
  SOLD: { tone: "blue", label: "Sold" },

  // Order statuses
  PENDING_PAYMENT: { tone: "amber", label: "Pending Payment" },
  ESCROW_LOCKED: { tone: "purple", label: "In Escrow" },
  DISPATCHED: { tone: "blue", label: "Dispatched" },
  DELIVERED: { tone: "teal", label: "Delivered" },
  REFUNDED: { tone: "slate", label: "Refunded" },

  // Trip statuses
  SCHEDULED: { tone: "blue", label: "Scheduled" },
  IN_PROGRESS: { tone: "amber", label: "In Progress" },

  // User statuses
  SUSPENDED: { tone: "rose", label: "Suspended" },
  PENDING_VERIFICATION: { tone: "amber", label: "Pending Verification" },

  // Bid statuses
  ACCEPTED: { tone: "emerald", label: "Accepted" },
  COUNTERED: { tone: "purple", label: "Countered" },
  WITHDRAWN: { tone: "slate", label: "Withdrawn" },

  // Dispute statuses
  OPEN: { tone: "rose", label: "Open" },
  UNDER_REVIEW: { tone: "amber", label: "Under Review" },
  RESOLVED: { tone: "emerald", label: "Resolved" },
  DISMISSED: { tone: "slate", label: "Dismissed" },

  // Purity grades
  GRADE_A: { tone: "emerald", label: "Grade A" },
  GRADE_B: { tone: "amber", label: "Grade B" },
  GRADE_C: { tone: "rose", label: "Grade C" },

  // Roles
  GENERATOR: { tone: "emerald", label: "Generator" },
  RECYCLER: { tone: "blue", label: "Recycler" },
  LOGISTICS: { tone: "purple", label: "Logistics" },
  ADMIN: { tone: "amber", label: "Admin" },
};

const TONE_CLASSES = {
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  amber: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    dot: "bg-amber-400",
  },
  blue: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
    dot: "bg-blue-400",
  },
  purple: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
    dot: "bg-purple-400",
  },
  rose: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    dot: "bg-rose-400",
  },
  teal: {
    bg: "bg-teal-500/10",
    text: "text-teal-400",
    border: "border-teal-500/20",
    dot: "bg-teal-400",
  },
  slate: {
    bg: "bg-slate-700/30",
    text: "text-slate-400",
    border: "border-slate-700/50",
    dot: "bg-slate-400",
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = "sm",
  className = "",
  showDot = true,
}) => {
  if (!status) return null;

  const upperStatus = status.trim().toUpperCase();
  const config = STATUS_CONFIGS[upperStatus];
  const tone = config?.tone ?? "slate";
  const styles = TONE_CLASSES[tone];
  const label =
    config?.label ??
    status
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const sizeClasses =
    size === "md"
      ? "px-2.5 py-1 text-xs gap-1.5 font-medium"
      : "px-2 py-0.5 text-[11px] gap-1 font-medium";

  return (
    <span
      className={`inline-flex items-center rounded-full border ${styles.bg} ${styles.text} ${styles.border} ${sizeClasses} ${className}`}
    >
      {showDot && <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />}
      <span>{label}</span>
    </span>
  );
};

export default StatusBadge;
