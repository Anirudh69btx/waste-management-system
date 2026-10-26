import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LineChart } from "../LineChart";

describe("LineChart", () => {
  it("renders svg and line path with data points", () => {
    const sampleData = [
      { date: "2026-10-01", value: 120 },
      { date: "2026-10-02", value: 240 },
      { date: "2026-10-03", value: 180 },
    ];
    const { container } = render(
      <LineChart data={sampleData} ariaLabel="Sample line chart" />
    );

    const svg = screen.getByRole("img", { name: "Sample line chart" });
    expect(svg).toBeInTheDocument();

    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(1);

    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(3);
  });

  it("handles empty data gracefully", () => {
    render(<LineChart data={[]} ariaLabel="Empty line chart" />);
    expect(screen.getByRole("img", { name: "Empty line chart" })).toBeInTheDocument();
    expect(
      screen.getByText(/No data available for selected period/i)
    ).toBeInTheDocument();
  });
});
