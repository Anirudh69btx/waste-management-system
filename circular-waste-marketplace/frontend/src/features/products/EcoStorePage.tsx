import React, { useState } from "react";
import {
  PackageOpen,
  Sparkles,
  Check,
  ShoppingBag,
  Flame,
  Leaf,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  category: "AGRICULTURE" | "MANUFACTURING" | "ENERGY";
  unit: string;
  weightKg: number;
}

export const EcoStorePage: React.FC = () => {
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);
  const [pointsRedeemed, setPointsRedeemed] = useState(0);

  const products: Product[] = [
    {
      id: "prod-01",
      title: "Fortified Organic Humus Compost (25kg)",
      description: "Enriched circular microbial compost made from segregated wholesale vegetable & fruit waste.",
      price: 280,
      stock: 450,
      category: "AGRICULTURE",
      unit: "bag",
      weightKg: 25,
    },
    {
      id: "prod-02",
      title: "High-Density Recycled Plastic Pellets (50kg)",
      description: "Extruded rPET pellets suitable for injection moulding, packaging sheets, and consumer goods.",
      price: 1150,
      stock: 120,
      category: "MANUFACTURING",
      unit: "sack",
      weightKg: 50,
    },
    {
      id: "prod-03",
      title: "Compressed Bio-Methane Cylinder (14kg)",
      description: "96% CH4 purified compressed biomethane generated from municipal anaerobic digester facilities.",
      price: 850,
      stock: 80,
      category: "ENERGY",
      unit: "cylinder",
      weightKg: 14,
    },
    {
      id: "prod-04",
      title: "Refuse-Derived Fuel (RDF) Pellets (1 Ton)",
      description: "High-calorific alternative fuel pellets (4,200 kcal/kg) for industrial cement kilns and boilers.",
      price: 3200,
      stock: 30,
      category: "ENERGY",
      unit: "ton",
      weightKg: 1000,
    },
  ];

  const addToCart = (p: Product) => {
    const existing = cart.find((i) => i.product.id === p.id);
    if (existing) {
      setCart(cart.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i)));
    } else {
      setCart([...cart, { product: p, qty: 1 }]);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((i) => i.product.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.qty, 0);
  const discountFromPoints = pointsRedeemed * 0.01; // 100 pts = ₹1.00
  const finalTotal = Math.max(0, subtotal - discountFromPoints);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <PackageOpen className="h-6 w-6 text-brand-400" />
            <span>Circular Eco-Store & Upcycled Products</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Finished secondary products manufactured from verified circular feedstock. Redeem eco-loyalty points for instant discounts.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
          <Sparkles className="h-4 w-4" />
          <span>Available Wallet: 1,250 Eco-Points (₹12.50 discount value)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="glass-card glass-card-hover rounded-2xl p-5 border border-white/10 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="purple">{p.category}</Badge>
                  <span className="text-[11px] text-slate-400 font-mono">Stock: {p.stock}</span>
                </div>
                <h3 className="text-sm font-bold text-white">{p.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{p.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-base font-extrabold text-white">₹{p.price}</span>
                  <span className="text-xs text-slate-400"> / {p.unit}</span>
                </div>
                <Button size="sm" onClick={() => addToCart(p)}>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Live Cart & Points Redemption */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5 h-fit">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <ShoppingBag className="h-4 w-4 text-brand-400" />
            <span>Order Summary & Points Redemption</span>
          </div>

          {cart.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">Your cart is empty. Add products to order.</div>
          ) : (
            <div className="space-y-3">
              <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.product.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="truncate pr-2">
                      <div className="font-medium text-slate-200 truncate">{item.product.title}</div>
                      <div className="text-slate-400 text-[10px]">
                        Qty: {item.qty} &bull; ₹{item.product.price} each
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">₹{item.product.price * item.qty}</span>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Eco Points Slider */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Use Eco-Points
                  </span>
                  <span className="font-mono text-emerald-400">{pointsRedeemed} pts (-₹{discountFromPoints.toFixed(2)})</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1250"
                  step="50"
                  value={pointsRedeemed}
                  onChange={(e) => setPointsRedeemed(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Price Math */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-200">₹{subtotal.toFixed(2)}</span>
                </div>
                {discountFromPoints > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Green Points Discount:</span>
                    <span className="font-mono">-₹{discountFromPoints.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-800 text-white">
                  <span>Total Amount:</span>
                  <span className="text-emerald-400 font-mono">₹{finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <Button
                className="w-full mt-2"
                onClick={() => {
                  alert("Order created with escrow settlement! Product dispatch ticket issued.");
                  setCart([]);
                  setPointsRedeemed(0);
                }}
              >
                Checkout & Dispatch
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
