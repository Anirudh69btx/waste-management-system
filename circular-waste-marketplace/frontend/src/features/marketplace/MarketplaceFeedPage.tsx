import React, { useState } from "react";
import {
  ShoppingCart,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Scale,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

interface ListingItem {
  id: string;
  title: string;
  category: string;
  categoryCode: string;
  grade: "GRADE_A" | "GRADE_B" | "GRADE_C" | "CONTAMINATED";
  quantityKg: number;
  pricePerKg: number;
  location: string;
  sellerOrg: string;
  verified: boolean;
}

export const MarketplaceFeedPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListing, setSelectedListing] = useState<ListingItem | null>(null);

  const listings: ListingItem[] = [
    {
      id: "lst-01",
      title: "Washed & Hot-Caustic De-labeled PET Bottle Flakes",
      category: "PET Plastics",
      categoryCode: "PLASTIC_PET",
      grade: "GRADE_A",
      quantityKg: 2500,
      pricePerKg: 24.50,
      location: "Apex Aggregation Yard 3, Navi Mumbai",
      sellerOrg: "Apex Resource Recovery Hub",
      verified: true,
    },
    {
      id: "lst-02",
      title: "Shredded Compostable Food & Vegetable Biomass",
      category: "Organic Biomass",
      categoryCode: "ORGANIC_BIOMASS",
      grade: "GRADE_A",
      quantityKg: 5000,
      pricePerKg: 4.20,
      location: "Green Earth Depot, Thane Agro Park",
      sellerOrg: "Green Earth Agro Ltd",
      verified: true,
    },
    {
      id: "lst-03",
      title: "Old Corrugated Cardboard (OCC) Baled Mill Spec",
      category: "Paper & Cardboard",
      categoryCode: "PAPER_CARDBOARD",
      grade: "GRADE_A",
      quantityKg: 8000,
      pricePerKg: 11.00,
      location: "Sector 14 Logistics Yard, Panvel",
      sellerOrg: "Maharashtra Fibre Aggregate",
      verified: true,
    },
    {
      id: "lst-04",
      title: "Segregated Tinplate & Light Steel Scrap",
      category: "Ferrous Metal",
      categoryCode: "FERROUS_METAL",
      grade: "GRADE_B",
      quantityKg: 3200,
      pricePerKg: 31.00,
      location: "MIDC Taloja Industrial Cluster",
      sellerOrg: "Vardhman Metal Aggregators",
      verified: true,
    },
    {
      id: "lst-05",
      title: "Clear Flint Cullet Crushed Glass Containers",
      category: "Cullet Glass",
      categoryCode: "GLASS",
      grade: "GRADE_A",
      quantityKg: 6500,
      pricePerKg: 4.50,
      location: "Bhiwandi Depot 2, Thane",
      sellerOrg: "Silica Circular Materials",
      verified: true,
    },
    {
      id: "lst-06",
      title: "Clean Industrial Cotton Spinning Rags & Offcuts",
      category: "Textile Waste",
      categoryCode: "TEXTILE",
      grade: "GRADE_B",
      quantityKg: 1800,
      pricePerKg: 15.20,
      location: "Surat-Mumbai Green Corridor",
      sellerOrg: "EcoSpin Recycling",
      verified: true,
    },
  ];

  const filtered = listings.filter((item) => {
    if (selectedCategory !== "ALL" && item.categoryCode !== selectedCategory) return false;
    if (selectedGrade !== "ALL" && item.grade !== selectedGrade) return false;
    if (
      searchQuery &&
      !item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.location.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-brand-400" />
          <span>Industrial Recycled Feedstock Exchange</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Direct secondary raw material procurement with laboratory assay certification and escrow payment protection.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card rounded-2xl p-4 border border-white/10 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search material type, specifications, or hub location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none"
        >
          <option value="ALL">All Categories</option>
          <option value="PLASTIC_PET">PET Plastics</option>
          <option value="ORGANIC_BIOMASS">Organic Biomass</option>
          <option value="PAPER_CARDBOARD">Paper & Cardboard</option>
          <option value="FERROUS_METAL">Ferrous Scrap</option>
          <option value="GLASS">Glass Cullet</option>
          <option value="TEXTILE">Textile Rags</option>
        </select>

        <select
          value={selectedGrade}
          onChange={(e) => setSelectedGrade(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none"
        >
          <option value="ALL">All Grades</option>
          <option value="GRADE_A">Grade A (High Purity)</option>
          <option value="GRADE_B">Grade B (Standard)</option>
          <option value="GRADE_C">Grade C (Industrial)</option>
        </select>
      </div>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((item) => {
          const totalVal = item.quantityKg * item.pricePerKg;
          return (
            <div
              key={item.id}
              className="glass-card glass-card-hover rounded-2xl p-5 border border-white/10 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="info">{item.category}</Badge>
                  <Badge variant={item.grade === "GRADE_A" ? "success" : "warning"}>
                    {item.grade.replace("_", " ")}
                  </Badge>
                </div>

                <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug">{item.title}</h3>

                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{item.location}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Quantity</span>
                    <span className="text-xs font-bold text-slate-200 font-mono">
                      {item.quantityKg.toLocaleString()} kg
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Unit Price</span>
                    <span className="text-base font-extrabold text-emerald-400 font-mono">
                      ₹{item.pricePerKg.toFixed(2)}
                      <span className="text-xs font-normal text-slate-400">/kg</span>
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedListing(item)}
                >
                  <span>Purchase & Escrow Hold</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Purchase Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="glass-card rounded-3xl p-6 border border-white/20 bg-slate-900/95 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Confirm Escrow Feedstock Purchase</h3>
              <button
                onClick={() => setSelectedListing(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5 text-xs">
              <div className="font-semibold text-white">{selectedListing.title}</div>
              <div className="flex justify-between text-slate-400">
                <span>Lot Volume:</span>
                <span className="text-slate-200 font-mono">{selectedListing.quantityKg.toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Unit Rate:</span>
                <span className="text-slate-200 font-mono">₹{selectedListing.pricePerKg.toFixed(2)}/kg</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Platform Escrow Fee (2.5%):</span>
                <span className="text-slate-200 font-mono">
                  ₹{(selectedListing.quantityKg * selectedListing.pricePerKg * 0.025).toLocaleString()}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline text-sm font-bold">
                <span className="text-white">Total Escrow Deposit:</span>
                <span className="text-emerald-400 font-mono">
                  ₹{(selectedListing.quantityKg * selectedListing.pricePerKg * 1.025).toLocaleString()}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Funds are held safely in RBI/Stripe regulated escrow until goods arrive and are inspected at your destination facility.
            </p>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setSelectedListing(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  alert("Escrow hold initiated! Redirecting to payment confirmation...");
                  setSelectedListing(null);
                }}
              >
                Lock Escrow & Authorize
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
