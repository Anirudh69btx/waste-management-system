import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Terminal, Github } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950/90 py-8 text-xs text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
            <span className="font-semibold text-slate-200">
              Circular Waste Marketplace &copy; 2026
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="text-slate-400">
              Verified Industrial Feedstock & Renewable Material Platform
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-3 w-3" />
              v1.0.0
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
              DEMO
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-900 text-[11px] text-slate-500">
          <div className="flex items-center gap-1 text-slate-400">
            <span>Built with FastAPI · React · ONNX Runtime</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-400">
            <Link to="/terms" className="hover:text-brand-400 transition-colors">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-brand-400 transition-colors">
              Privacy
            </Link>
            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-brand-400 transition-colors"
            >
              <Terminal className="h-3 w-3" />
              <span>API Docs</span>
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-brand-400 transition-colors"
            >
              <Github className="h-3 w-3" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
