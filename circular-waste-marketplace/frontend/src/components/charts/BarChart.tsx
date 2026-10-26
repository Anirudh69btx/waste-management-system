import React from "react";

export interface BarChartItem {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarChartItem[];
  height?: number;
  color?: string;
  horizontal?: boolean;
  ariaLabel?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 260,
  color = "#10b981",
  horizontal = false,
  ariaLabel = "Bar chart",
}) => {
  const nonZero = (data || []).filter((d) => d.value > 0);
  const viewWidth = 600;
  const viewHeight = height;

  if (nonZero.length === 0) {
    return (
      <div className="w-full" style={{ height }}>
        <svg
          role="img"
          aria-label={ariaLabel}
          width="100%"
          height={height}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        >
          <text
            x={viewWidth / 2}
            y={viewHeight / 2}
            textAnchor="middle"
            fill="#64748b"
            fontSize="13"
          >
            No category activity in selected period
          </text>
        </svg>
      </div>
    );
  }

  const maxValue = Math.max(...nonZero.map((d) => d.value), 1);

  if (horizontal) {
    const padLeft = 140;
    const padRight = 64;
    const padTop = 16;
    const padBottom = 16;
    const plotWidth = viewWidth - padLeft - padRight;
    const plotHeight = viewHeight - padTop - padBottom;
    const rowHeight = plotHeight / nonZero.length;
    const barHeight = Math.min(26, Math.max(10, rowHeight * 0.62));

    return (
      <div className="w-full" style={{ height }}>
        <svg
          role="img"
          aria-label={ariaLabel}
          width="100%"
          height={height}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="none"
        >
          {nonZero.map((item, idx) => {
            const w = Math.max(4, (item.value / maxValue) * plotWidth);
            const y = padTop + idx * rowHeight + (rowHeight - barHeight) / 2;
            const shortLabel =
              item.label.length > 18 ? `${item.label.slice(0, 17)}…` : item.label;
            return (
              <g key={`${item.label}-${idx}`}>
                <text
                  x={padLeft - 10}
                  y={y + barHeight / 2 + 4}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="11"
                >
                  {shortLabel}
                </text>
                <rect
                  x={padLeft}
                  y={y}
                  width={w}
                  height={barHeight}
                  rx={5}
                  fill={color}
                  fillOpacity="0.88"
                >
                  <title>{`${item.label}: ${item.value.toLocaleString("en-IN")}`}</title>
                </rect>
                <text
                  x={padLeft + w + 8}
                  y={y + barHeight / 2 + 4}
                  textAnchor="start"
                  fill="#e2e8f0"
                  fontSize="11"
                  fontWeight="600"
                >
                  {item.value.toLocaleString("en-IN")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // Vertical bars
  const padLeft = 36;
  const padRight = 20;
  const padTop = 26;
  const padBottom = 42;
  const plotWidth = viewWidth - padLeft - padRight;
  const plotHeight = viewHeight - padTop - padBottom;
  const slotWidth = plotWidth / nonZero.length;
  const barWidth = Math.min(48, Math.max(14, slotWidth * 0.6));

  return (
    <div className="w-full" style={{ height }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width="100%"
        height={height}
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="none"
      >
        <line
          x1={padLeft}
          y1={padTop + plotHeight}
          x2={viewWidth - padRight}
          y2={padTop + plotHeight}
          stroke="#1e293b"
          strokeWidth="1"
        />

        {nonZero.map((item, idx) => {
          const barH = Math.max(4, (item.value / maxValue) * plotHeight);
          const x = padLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
          const y = padTop + plotHeight - barH;
          const shortLabel =
            item.label.length > 11 ? `${item.label.slice(0, 10)}…` : item.label;

          return (
            <g key={`${item.label}-${idx}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={5}
                fill={color}
                fillOpacity="0.88"
                className="transition-opacity hover:opacity-100"
              >
                <title>{`${item.label}: ${item.value.toLocaleString("en-IN")}`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="11"
                fontWeight="600"
              >
                {item.value >= 1000
                  ? `${(item.value / 1000).toFixed(1)}k`
                  : Math.round(item.value)}
              </text>
              <text
                x={x + barWidth / 2}
                y={viewHeight - 14}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="10"
              >
                {shortLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default BarChart;
