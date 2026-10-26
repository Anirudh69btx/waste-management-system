import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingBag,
  Filter,
  ArrowUpDown,
  Search,
  Package,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Tag,
  Scale,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { listListings } from "@/api/marketplace";
import type { MarketplaceListingRead } from "@/api/types";
import { WASTE_CATEGORY_MAP } from "@/constants/wasteCategories";

export const MarketplacePage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedGrade, setSelectedGrade] = useState<string>("ALL");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  // TanStack Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "marketplaceListings",
      selectedCategory,
      minPrice,
      maxPrice,
      page,
    ],
    queryFn: () =>
      listListings({
        category_id: selectedCategory !== "ALL" ? Number(selectedCategory) : undefined,
        status: "active",
        price_min: minPrice ? parseFloat(minPrice) : undefined,
        price_max: maxPrice ? parseFloat(maxPrice) : undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
  });

  const rawListings = data?.items ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Client-side grade filtering and sorting
  const processedListings = useMemo(() => {
    let result = [...rawListings];

    if (selectedGrade !== "ALL") {
      result = result.filter((item) => item.purity_grade === selectedGrade);
    }

    if (sortBy === "price_asc") {
      result.sort((a, b) => a.price_per_kg - b.price_per_kg);
    } else if (sortBy === "price_desc") {
      result.sort((a, b) => b.price_per_kg - a.price_per_kg);
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [rawListings, selectedGrade, sortBy]);

  const getCategoryName = (categoryId: number) => {
    const entry = Object.values(WASTE_CATEGORY_MAP).find((c) => c.id === categoryId);
    return entry?.name ?? `Category #${categoryId}`;
  };

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case "GRADE_A":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "GRADE_B":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "GRADE_C":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      default:
        return "bg-slate-700/50 text-slate-300 border-slate-600/30";
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Marketplace — Recycled feedstock
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Verified industrial feedstock, recycled materials, and secondary commodities
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{totalItems} active lots live</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm backdrop-blur-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Filter className="h-3.5 w-3.5 text-brand-400" />
          <span>Filters & Search</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Category Dropdown */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Waste Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {Object.values(WASTE_CATEGORY_MAP).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Purity Grade
            </label>
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
            >
              <option value="ALL">All Grades</option>
              <option value="GRADE_A">Grade A (High Purity)</option>
              <option value="GRADE_B">Grade B (Standard)</option>
              <option value="GRADE_C">Grade C (Mixed/Crude)</option>
            </select>
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Price (₹/kg)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPage(1);
                }}
                className="w-1/2 rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
              <span className="text-slate-600">-</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
                className="w-1/2 rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "newest" | "price_asc" | "price_desc")
              }
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Clear Filters Button if any filter applied */}
        {(selectedCategory !== "ALL" || selectedGrade !== "ALL" || minPrice !== "" || maxPrice !== "") && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("ALL");
                setSelectedGrade("ALL");
                setMinPrice("");
                setMaxPrice("");
                setPage(1);
              }}
              className="text-xs text-brand-400 hover:text-brand-300 underline font-medium"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Grid Content */}
      {isLoading ? (
        /* Loading Skeletons */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4 animate-pulse"
            >
              <div className="flex justify-between items-start">
                <div className="h-6 w-24 bg-slate-800 rounded-lg" />
                <div className="h-5 w-16 bg-slate-800 rounded-md" />
              </div>
              <div className="h-5 w-48 bg-slate-800 rounded" />
              <div className="h-8 w-28 bg-slate-800 rounded" />
              <div className="pt-4 border-t border-slate-800/80 flex justify-between items-center">
                <div className="h-8 w-8 bg-slate-800 rounded-full" />
                <div className="h-8 w-24 bg-slate-800 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-8 text-center text-rose-300">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-rose-400" />
          <p className="font-medium text-sm">Failed to load marketplace listings</p>
          <p className="text-xs text-rose-400/80 mt-1">Please try refreshing</p>
        </div>
      ) : processedListings.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Package className="h-7 w-7 text-brand-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">No listings available</h3>
          <p className="mt-2 text-xs text-slate-400 max-w-sm mx-auto">
            Check back soon or adjust your category and price filters.
          </p>
        </div>
      ) : (
        /* 3-Column Card Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {processedListings.map((listing) => {
            const sellerInitial = listing.seller_id ? listing.seller_id.slice(0, 2).toUpperCase() : "SL";
            const percentAvailable =
              listing.quantity_kg > 0 ? (listing.available_kg / listing.quantity_kg) * 100 : 0;
            return (
              <div
                key={listing.id}
                className="group rounded-2xl border border-slate-800/90 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 transition-all duration-200 hover:-translate-y-1 p-5 flex flex-col justify-between shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-brand-500/5"
              >
                <div className="space-y-4">
                  {/* Category + Grade Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 truncate">
                      <Tag className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                      <span className="truncate">{getCategoryName(listing.category_id)}</span>
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${getGradeBadge(
                        listing.purity_grade
                      )}`}
                    >
                      {listing.purity_grade.replace("_", " ")}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors line-clamp-1">
                      {listing.title}
                    </h3>
                    {listing.description && (
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {listing.description}
                      </p>
                    )}
                  </div>

                  {/* Quantity Breakdown with thin progress bar */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Scale className="h-3.5 w-3.5 text-slate-500" />
                        Available / Total:
                      </span>
                      <span className="font-mono font-semibold text-white">
                        <span className="text-emerald-400">{listing.available_kg.toFixed(1)}</span> /{" "}
                        {listing.quantity_kg.toFixed(1)} kg
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                      <div
                        className="bg-emerald-400 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, percentAvailable))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Min Bid Lot:</span>
                      <span className="font-mono text-slate-300">
                        {listing.min_bid_kg.toFixed(1)} kg
                      </span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 pt-1">
                    <span className="text-2xl font-bold tracking-tight text-brand-400 font-mono">
                      ₹{listing.price_per_kg}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">/ kg</span>
                  </div>
                </div>

                {/* Seller Info & Action */}
                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                      {sellerInitial}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-500 truncate">
                        {new Date(listing.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/marketplace/${listing.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-brand-500 text-slate-950 hover:bg-brand-400 transition-colors shadow-sm shrink-0"
                  >
                    <span>View details</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>
          <span className="text-xs font-mono text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default MarketplacePage;
