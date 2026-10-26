import React from "react";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  ariaLabel?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  size = 188,
  centerLabel,
  centerValue,
  ariaLabel = "Donut chart",
}) => {
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const positiveSegments = (segments || []).filter((s) => s.value > 0);
  const total = positiveSegments.reduce((acc, s) => acc + s.value, 0);

  let cumulativeFraction = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          role="img"
          aria-label={ariaLabel}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
          />

          {total > 0 &&
            positiveSegments.map((seg, idx) => {
              const fraction = seg.value / total;
              const dashLength = fraction * circumference;
              const gapLength = Math.max(0, circumference - dashLength);
              const rotation = cumulativeFraction * 360 - 90;
              cumulativeFraction += fraction;

              return (
                <circle
                  key={`${seg.label}-${idx}`}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${gapLength}`}
                  transform={`rotate(${rotation} ${center} ${center})`}
                  strokeLinecap="butt"
                  className="transition-all duration-300"
                >
                  <title>{`${seg.label}: ${seg.value.toLocaleString("en-IN")} (${(fraction * 100).toFixed(1)}%)`}</title>
                </circle>
              );
            })}
        </svg>

        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
            {centerValue && (
              <span className="text-2xl font-bold text-slate-50 leading-tight">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend below with color dots */}
      <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {(segments || []).map((seg, idx) => (
          <div
            key={`legend-${seg.label}-${idx}`}
            className="flex items-center justify-between gap-2 text-slate-300"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="truncate">{seg.label}</span>
            </div>
            <span className="font-semibold text-slate-100 shrink-0">
              {seg.value.toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
