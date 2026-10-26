import React, { useId } from "react";
import type { TimeSeriesPoint } from "@/api/types";

export interface LineChartProps {
  data: TimeSeriesPoint[];
  height?: number;
  color?: string;
  yLabel?: string;
  showArea?: boolean;
  ariaLabel?: string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  height = 280,
  color = "#10b981",
  yLabel,
  showArea = true,
  ariaLabel = "Time series line chart",
}) => {
  const gradientId = useId().replace(/:/g, "");
  const viewWidth = 640;
  const viewHeight = height;
  const padLeft = 52;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 36;

  const plotWidth = viewWidth - padLeft - padRight;
  const plotHeight = viewHeight - padTop - padBottom;

  if (!data || data.length === 0) {
    return (
      <div className="w-full" style={{ height }}>
        <svg
          role="img"
          aria-label={ariaLabel}
          width="100%"
          height={height}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          className="overflow-visible"
        >
          <rect
            x={padLeft}
            y={padTop}
            width={plotWidth}
            height={plotHeight}
            rx={8}
            fill="rgba(15, 23, 42, 0.4)"
            stroke="rgba(51, 65, 85, 0.4)"
            strokeDasharray="4 4"
          />
          <text
            x={viewWidth / 2}
            y={viewHeight / 2}
            textAnchor="middle"
            fill="#64748b"
            fontSize="13"
          >
            No data available for selected period
          </text>
        </svg>
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values, 0);
  const rawMax = Math.max(...values, 1);
  const minY = rawMin < 0 ? rawMin : 0;
  const maxY = rawMax <= minY ? minY + 10 : rawMax * 1.1;

  const getX = (index: number): number => {
    if (data.length === 1) return padLeft + plotWidth / 2;
    return padLeft + (index / (data.length - 1)) * plotWidth;
  };

  const getY = (val: number): number => {
    const ratio = (val - minY) / (maxY - minY || 1);
    return padTop + plotHeight - ratio * plotHeight;
  };

  const points = data.map((d, i) => ({
    x: Number(getX(i).toFixed(2)),
    y: Number(getY(d.value).toFixed(2)),
    date: d.date,
    value: d.value,
  }));

  const linePath = points
    .map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
    .join(" ");

  const baselineY = Number((padTop + plotHeight).toFixed(2));
  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
      : "";

  // 4 Y-axis ticks
  const yTicks = [0, 0.33, 0.67, 1].map((t) => {
    const val = minY + (maxY - minY) * t;
    return {
      value: val,
      y: getY(val),
      label:
        val >= 1000
          ? `${(val / 1000).toFixed(1)}k`
          : val >= 10
          ? Math.round(val).toString()
          : val.toFixed(1),
    };
  });

  // Up to 5 X-axis date labels evenly spaced
  const maxXLabels = Math.min(5, data.length);
  const xIndices = Array.from({ length: maxXLabels }, (_, idx) =>
    maxXLabels === 1
      ? 0
      : Math.round((idx / (maxXLabels - 1)) * (data.length - 1))
  );
  const uniqueXIndices = Array.from(new Set(xIndices));

  return (
    <div className="w-full" style={{ height }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width="100%"
        height={height}
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={`area-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines + Y-axis labels */}
        {yTicks.map((tick, idx) => (
          <g key={idx}>
            <line
              x1={padLeft}
              y1={tick.y}
              x2={viewWidth - padRight}
              y2={tick.y}
              stroke="#1e293b"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <text
              x={padLeft - 8}
              y={tick.y + 4}
              textAnchor="end"
              fill="#64748b"
              fontSize="11"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {yLabel && (
          <text
            x={14}
            y={padTop + plotHeight / 2}
            fill="#64748b"
            fontSize="10"
            textAnchor="middle"
            transform={`rotate(-90, 14, ${padTop + plotHeight / 2})`}
          >
            {yLabel}
          </text>
        )}

        {/* Area under line */}
        {showArea && areaPath && (
          <path d={areaPath} fill={`url(#area-${gradientId})`} />
        )}

        {/* Main line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive data points */}
        {points.map((pt, idx) => (
          <circle
            key={`${pt.date}-${idx}`}
            cx={pt.x}
            cy={pt.y}
            r="3.5"
            fill={color}
            stroke="#0f172a"
            strokeWidth="1.5"
            className="transition-transform duration-150 hover:scale-150 cursor-pointer"
          >
            <title>{`${pt.date}: ${pt.value.toLocaleString("en-IN")}${yLabel ? ` ${yLabel}` : ""}`}</title>
          </circle>
        ))}

        {/* X-axis date labels */}
        {uniqueXIndices.map((dataIdx) => {
          const pt = points[dataIdx];
          if (!pt) return null;
          const shortDate = pt.date.slice(5); // MM-DD
          return (
            <text
              key={`x-${dataIdx}`}
              x={pt.x}
              y={viewHeight - 10}
              textAnchor="middle"
              fill="#64748b"
              fontSize="11"
            >
              {shortDate}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default LineChart;
