import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShoppingBag, Gift, Info } from "lucide-react";

interface SellDonateToggleProps {
  mode: "sell" | "donate";
  onChange: (mode: "sell" | "donate") => void;
  disabled?: boolean;
}

export const SellDonateToggle: React.FC<SellDonateToggleProps> = ({
  mode,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-700 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => onChange("sell")}
          disabled={disabled}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "sell"
              ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Sell
        </button>
        <button
          type="button"
          onClick={() => onChange("donate")}
          disabled={disabled}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "donate"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Gift className="h-4 w-4" />
          Donate
        </button>
      </div>

      {mode === "donate" && (
        <div className="flex items-start gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Donate mode:</strong> No payout will be issued. Your waste will be matched to a
            certified recycling partner at no cost. This earns you Green Rewards points.
          </span>
        </div>
      )}
    </div>
  );
};

describe("SellDonateToggle", () => {
  it("renders Sell and Donate buttons with Sell active by default", () => {
    const handleChange = vi.fn();
    render(<SellDonateToggle mode="sell" onChange={handleChange} />);

    const sellBtn = screen.getByRole("button", { name: /sell/i });
    const donateBtn = screen.getByRole("button", { name: /donate/i });

    expect(sellBtn).toBeInTheDocument();
    expect(donateBtn).toBeInTheDocument();
    expect(sellBtn).toHaveClass("bg-brand-500");
    expect(donateBtn).not.toHaveClass("bg-emerald-600");
    expect(screen.queryByText(/donate mode:/i)).not.toBeInTheDocument();
  });

  it("switches to Donate mode and triggers onChange callback", () => {
    const handleChange = vi.fn();
    render(<SellDonateToggle mode="sell" onChange={handleChange} />);

    const donateBtn = screen.getByRole("button", { name: /donate/i });
    fireEvent.click(donateBtn);

    expect(handleChange).toHaveBeenCalledWith("donate");
  });

  it("renders donate informational banner when mode is donate", () => {
    const handleChange = vi.fn();
    render(<SellDonateToggle mode="donate" onChange={handleChange} />);

    const donateBtn = screen.getByRole("button", { name: /donate/i });
    expect(donateBtn).toHaveClass("bg-emerald-600");
    expect(screen.getByText(/donate mode:/i)).toBeInTheDocument();
    expect(screen.getByText(/no payout will be issued/i)).toBeInTheDocument();
  });
});
