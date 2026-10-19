import React from "react";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/features/auth/store";

export const AdminOnlyPage: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
      <div className="inline-flex h-16 w-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 items-center justify-center text-purple-400 mb-2">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold text-white">Administrator Restricted Area</h1>
      <p className="text-sm text-text-secondary">
        Authenticated as <span className="font-mono text-purple-400">{user?.email}</span> with role{" "}
        <span className="font-semibold text-purple-400">[{user?.role}]</span>.
      </p>
    </div>
  );
};
