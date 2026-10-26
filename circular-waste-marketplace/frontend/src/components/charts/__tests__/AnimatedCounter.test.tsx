import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AnimatedCounter } from "../AnimatedCounter";

describe("AnimatedCounter", () => {
  it("renders formatted counter value", () => {
    render(
      <AnimatedCounter
        value={14250}
        duration={0}
        format={(n) => `₹${Math.round(n).toLocaleString("en-IN")}`}
      />
    );

    expect(screen.getByText("₹14,250")).toBeInTheDocument();
  });
});
