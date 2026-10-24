// Waste category IDs and base rates mapped to backend IDs
// These IDs were seeded into the database (33-40)
export const WASTE_CATEGORY_MAP: Record<string, { id: number; name: string; unit: string; rate: number }> = {
  ORGANIC_BIOMASS: { id: 33, name: "Organic & Food Waste", unit: "kg", rate: 3.5 },
  PLASTIC_PET: { id: 34, name: "PET Plastics (Grade 1)", unit: "kg", rate: 18.0 },
  PAPER_CARDBOARD: { id: 35, name: "Corrugated Cardboard & Paper", unit: "kg", rate: 9.5 },
  FERROUS_METAL: { id: 36, name: "Ferrous Scrap Metal", unit: "kg", rate: 28.0 },
  GLASS: { id: 37, name: "Cullet & Bottle Glass", unit: "kg", rate: 4.0 },
  E_WASTE: { id: 38, name: "Electronic Waste (Non-hazardous)", unit: "kg", rate: 65.0 },
  HAZARDOUS: { id: 39, name: "Industrial Hazardous Waste", unit: "kg", rate: 12.0 },
  TEXTILE: { id: 40, name: "Industrial Textile & Fabric Offcuts", unit: "kg", rate: 14.0 },
};

export const GRADE_MULTIPLIERS: Record<string, number> = {
  GRADE_A: 1.0,
  GRADE_B: 0.85,
  GRADE_C: 0.65,
};

export const SEGREGATION_INSTRUCTIONS: Record<number, string[]> = {
  33: ["No plastic bags", "No dairy or cooked meat", "Peel, greens, food scraps only", "Drain excess liquid"],
  34: ["Rinse bottles", "Remove caps and labels", "Flatten to save space", "No PVC or other plastics"],
  35: ["Keep dry", "Flatten boxes", "No wax-coated paper", "No food-soiled paper"],
  36: ["Remove plastic attachments", "Sort by metal type if possible", "No pressurized containers"],
  37: ["Rinse containers", "No loose broken shards", "Sort by color if possible"],
  38: ["Wipe personal data", "No leaking batteries", "Do not mix with other e-waste"],
  39: ["Manifest regulated", "Do not mix with other waste", "Certified driver only"],
  40: ["Clean and dry only", "No mold", "No chemical-soaked fabric"],
};

export interface CategoryFieldDef {
  key: string;
  label: string;
  type: "text" | "select" | "number";
  options?: string[];
  required?: boolean;
}

export const CATEGORY_SPECIFIC_FIELDS: Record<number, CategoryFieldDef[]> = {
  33: [
    { key: "Moisture", label: "Moisture", type: "select", options: ["Dry", "Wet", "Mixed"], required: true },
    { key: "Source", label: "Source", type: "select", options: ["Household", "Restaurant", "Market", "Farm"], required: true },
    { key: "Contamination", label: "Contamination", type: "select", options: ["Low", "Medium", "High"], required: true },
  ],
  34: [
    { key: "Form", label: "Form", type: "select", options: ["Bottles", "Flakes", "Mixed rigid"], required: true },
    { key: "Color", label: "Color", type: "select", options: ["Clear", "Colored", "Mixed"], required: true },
    { key: "Contamination %", label: "Contamination %", type: "number", required: true },
  ],
  35: [
    { key: "Type", label: "Type", type: "select", options: ["OCC", "ONP", "Mixed", "Shredded"], required: true },
    { key: "Moisture", label: "Moisture", type: "select", options: ["Dry", "Damp"], required: true },
    { key: "Contamination", label: "Contamination", type: "select", options: ["Low", "Medium", "High"], required: true },
  ],
  36: [
    { key: "Metal type", label: "Metal type", type: "select", options: ["Ferrous", "Non-ferrous", "Mixed"], required: true },
    { key: "Form", label: "Form", type: "select", options: ["Sheets", "Rods", "Scrap"], required: true },
    { key: "Contamination", label: "Contamination", type: "select", options: ["Low", "Medium", "High"], required: true },
  ],
  37: [
    { key: "Color", label: "Color", type: "select", options: ["Clear", "Amber", "Green", "Mixed"], required: true },
    { key: "Form", label: "Form", type: "select", options: ["Whole", "Broken"], required: true },
    { key: "Contamination", label: "Contamination", type: "select", options: ["Low", "Medium", "High"] , required: true },
  ],
  38: [
    { key: "Item type", label: "Item type", type: "select", options: ["PCBs", "Cables", "Peripherals", "Mixed"], required: true },
    { key: "Condition", label: "Condition", type: "select", options: ["Working", "Non-working", "Damaged"], required: true },
  ],
  39: [
    { key: "Hazard class", label: "Hazard class", type: "select", options: ["Battery", "Paint", "Oil", "Mixed"], required: true },
    { key: "Container condition", label: "Container condition", type: "select", options: ["Intact", "Leaking", "Unknown"], required: true },
  ],
  40: [
    { key: "Fabric type", label: "Fabric type", type: "select", options: ["Cotton", "Synthetic", "Mixed", "Wool"], required: true },
    { key: "Condition", label: "Condition", type: "select", options: ["Clean", "Worn", "Soiled"], required: true },
  ],
};

export const PURITY_GRADES_BY_CATEGORY: Record<number, string[]> = {
  33: ["GRADE_A", "GRADE_B", "GRADE_C"],
  34: ["GRADE_A", "GRADE_B", "GRADE_C"],
  35: ["GRADE_A", "GRADE_B", "GRADE_C"],
  36: ["GRADE_A", "GRADE_B", "GRADE_C"],
  37: ["GRADE_A", "GRADE_B", "GRADE_C"],
  38: ["GRADE_A", "GRADE_B", "GRADE_C"],
  39: ["GRADE_A", "GRADE_B", "GRADE_C"],
  40: ["GRADE_A", "GRADE_B", "GRADE_C"],
};

export function buildNotesFromCategory(
  categoryId: number,
  fields: Record<string, string | number>,
  freeformNotes: string
): string {
  const parts: string[] = [];
  const defs = CATEGORY_SPECIFIC_FIELDS[categoryId] ?? [];
  for (const def of defs) {
    const val = (fields as any)[def.key];
    if (val !== undefined && val !== "" && val !== null) parts.push(`${def.key}: ${val}`);
  }
  if (freeformNotes.trim()) parts.push(`Freeform: ${freeformNotes.trim()}`);
  return parts.join(" | ");
}

export function estimatePayoutFallback(
  categoryId: number,
  weightKg: number,
  purityGrade: string
): number {
  const entry = Object.values(WASTE_CATEGORY_MAP).find((c) => c.id === categoryId);
  if (!entry) return 0;
  const mult = GRADE_MULTIPLIERS[purityGrade] ?? 1;
  return Math.round(entry.rate * weightKg * mult);
}
