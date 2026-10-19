import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-6 text-text-primary">
      <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-brand-400 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>
      <h1 className="text-3xl font-extrabold text-white">Terms of Service</h1>
      <p className="text-sm text-text-secondary leading-relaxed">
        By registering an account on the Circular Waste Marketplace, you agree to comply with material purity declarations, truthful batch weights, and certified chain-of-custody transfer standards.
      </p>
    </div>
  );
};
