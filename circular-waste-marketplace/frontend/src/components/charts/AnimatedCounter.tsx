import React, { useEffect, useState } from "react";

export interface AnimatedCounterProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

const defaultNumberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
});

function shouldSkipAnimation(duration: number): boolean {
  if (duration <= 0) return true;
  if (typeof window === "undefined") return true;
  if (typeof import.meta !== "undefined" && import.meta.env?.MODE === "test") {
    return true;
  }
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return true;
  }
  return false;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 800,
  format,
  className,
}) => {
  const skip = shouldSkipAnimation(duration);
  const [displayValue, setDisplayValue] = useState<number>(skip ? value : 0);

  useEffect(() => {
    if (shouldSkipAnimation(duration)) {
      setDisplayValue(value);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();
    const startValue = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (value - startValue) * eased;
      setDisplayValue(progress >= 1 ? value : current);

      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [value, duration]);

  const formatted = format
    ? format(displayValue)
    : defaultNumberFormatter.format(
        Number.isInteger(value) ? Math.round(displayValue) : Number(displayValue.toFixed(1))
      );

  return <span className={className}>{formatted}</span>;
};

export default AnimatedCounter;
