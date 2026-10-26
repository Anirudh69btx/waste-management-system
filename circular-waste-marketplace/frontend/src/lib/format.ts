/**
 * Formats values consistently across the Circular Waste Marketplace frontend.
 * Uses Indian numbering format ('en-IN') where applicable.
 */

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "₹0";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatWeight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined || isNaN(kg)) {
    return "0 kg";
  }
  if (Math.abs(kg) >= 1000) {
    const tonnes = kg / 1000;
    return `${tonnes.toLocaleString("en-IN", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })} t`;
  }
  return `${kg.toLocaleString("en-IN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kg`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) {
    return "0";
  }
  return n.toLocaleString("en-IN");
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHours = Math.round(diffMin / 60);
  const diffDays = Math.round(diffHours / 24);

  if (diffSec < 60) {
    return "just now";
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return "yesterday";
  } else if (diffDays < 30) {
    return `${diffDays}d ago`;
  }
  return formatDate(d);
}

export function formatPercent(p: number | null | undefined): string {
  if (p === null || p === undefined || isNaN(p)) {
    return "0%";
  }
  return `${p.toFixed(1)}%`;
}

export function formatConfidence(c: number | null | undefined): string {
  if (c === null || c === undefined || isNaN(c)) {
    return "0%";
  }
  // If c <= 1, it's a 0.0-1.0 float
  const val = c <= 1 ? c * 100 : c;
  return `${Math.round(val)}%`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
