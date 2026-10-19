import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-6 text-text-primary">
      <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-brand-400 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>
      <h1 className="text-3xl font-extrabold text-white">Privacy Policy</h1>
      <p className="text-sm text-text-secondary leading-relaxed">
        Your data is processed solely for industrial batch verification, transport telemetry, and marketplace settlement under strict role-based access controls.
      </p>
    </div>
  );
};
