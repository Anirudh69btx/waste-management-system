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
