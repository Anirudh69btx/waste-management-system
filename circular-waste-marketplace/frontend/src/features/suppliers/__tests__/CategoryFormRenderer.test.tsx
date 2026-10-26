import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  CATEGORY_SPECIFIC_FIELDS,
  buildNotesFromCategory,
  type CategoryFieldDef,
} from "@/constants/wasteCategories";

interface CategoryFormRendererProps {
  categoryId: number;
  values: Record<string, string | number>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}

export const CategoryFormRenderer: React.FC<CategoryFormRendererProps> = ({
  categoryId,
  values,
  onChange,
  disabled = false,
}) => {
  const defs: CategoryFieldDef[] = CATEGORY_SPECIFIC_FIELDS[categoryId] ?? [];
  if (defs.length === 0) return null;

  return (
    <div data-testid="category-fields-container" className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {defs.map((def) => (
          <div key={def.key}>
            <label className="block text-xs text-slate-400 mb-1">
              {def.label}
              {def.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {def.type === "select" && def.options ? (
              <select
                aria-label={def.label}
                value={String(values[def.key] ?? "")}
                onChange={(e) => onChange(def.key, e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm"
              >
                <option value="">Select {def.label}…</option>
                {def.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : def.type === "number" ? (
              <input
                aria-label={def.label}
                type="number"
                min={0}
                step={0.1}
                value={String(values[def.key] ?? "")}
                onChange={(e) => onChange(def.key, e.target.value)}
                disabled={disabled}
                placeholder={def.label}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm"
              />
            ) : (
              <input
                aria-label={def.label}
                type="text"
                value={String(values[def.key] ?? "")}
                onChange={(e) => onChange(def.key, e.target.value)}
                disabled={disabled}
                placeholder={def.label}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

describe("CategoryFormRenderer", () => {
  it("renders correct fields for ORGANIC_BIOMASS (category 33)", () => {
    const handleChange = vi.fn();
    render(<CategoryFormRenderer categoryId={33} values={{}} onChange={handleChange} />);

    expect(screen.getByLabelText("Moisture")).toBeInTheDocument();
    expect(screen.getByLabelText("Source")).toBeInTheDocument();
    expect(screen.getByLabelText("Contamination")).toBeInTheDocument();
  });

  it("renders number and select inputs for PLASTIC_PET (category 34)", () => {
    const handleChange = vi.fn();
    render(<CategoryFormRenderer categoryId={34} values={{}} onChange={handleChange} />);

    expect(screen.getByLabelText("Form")).toBeInTheDocument();
    expect(screen.getByLabelText("Color")).toBeInTheDocument();
    const contaminationInput = screen.getByLabelText("Contamination %");
    expect(contaminationInput).toBeInTheDocument();
    expect(contaminationInput).toHaveAttribute("type", "number");
  });

  it("renders null/empty container when category has no specific fields", () => {
    const handleChange = vi.fn();
    const { container } = render(
      <CategoryFormRenderer categoryId={999} values={{}} onChange={handleChange} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("calls onChange when a field value is modified", () => {
    const handleChange = vi.fn();
    render(<CategoryFormRenderer categoryId={33} values={{}} onChange={handleChange} />);

    const moistureSelect = screen.getByLabelText("Moisture");
    fireEvent.change(moistureSelect, { target: { value: "Dry" } });

    expect(handleChange).toHaveBeenCalledWith("Moisture", "Dry");
  });

  it("displays required asterisk for required fields", () => {
    const handleChange = vi.fn();
    render(<CategoryFormRenderer categoryId={33} values={{}} onChange={handleChange} />);

    const asterisks = screen.getAllByText("*");
    expect(asterisks.length).toBeGreaterThanOrEqual(3);
  });

  it("buildNotesFromCategory encodes key-value pairs and freeform notes properly", () => {
    const fields = {
      Moisture: "Dry",
      Source: "Household",
      Contamination: "Low",
    };
    const freeform = "Sorted meticulously at source";
    const encoded = buildNotesFromCategory(33, fields, freeform);

    expect(encoded).toBe(
      "Moisture: Dry | Source: Household | Contamination: Low | Freeform: Sorted meticulously at source"
    );

    const emptyFieldsEncoded = buildNotesFromCategory(33, {}, "Just notes");
    expect(emptyFieldsEncoded).toBe("Freeform: Just notes");
  });
});
