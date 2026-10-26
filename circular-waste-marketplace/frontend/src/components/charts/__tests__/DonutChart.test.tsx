import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DonutChart } from "../DonutChart";

describe("DonutChart", () => {
  const segments = [
    { label: "sorted", value: 42, color: "#10b981" },
    { label: "weighed", value: 18, color: "#f59e0b" },
    { label: "submitted", value: 10, color: "#64748b" },
  ];

  it("renders donut circle segments and center label", () => {
    const { container } = render(
      <DonutChart
        segments={segments}
        centerValue="70"
        centerLabel="Batches"
        ariaLabel="Status donut"
      />
    );

    expect(screen.getByRole("img", { name: "Status donut" })).toBeInTheDocument();
    expect(screen.getByText("70")).toBeInTheDocument();
    expect(screen.getByText("Batches")).toBeInTheDocument();

    // 1 track circle + 3 segment circles = 4 circles
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(4);
  });

  it("renders legend matching segment labels and values", () => {
    render(<DonutChart segments={segments} />);
    expect(screen.getByText("sorted")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("weighed")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("submitted")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });
});
