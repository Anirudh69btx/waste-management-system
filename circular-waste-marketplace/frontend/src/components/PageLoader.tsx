import React from "react";

export interface PageLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  message = "Loading...",
  fullScreen = true,
}) => {
  const containerClasses = fullScreen
    ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm p-6"
    : "flex flex-col items-center justify-center p-8 w-full";

  return (
    <div
      className={containerClasses}
      role="status"
      aria-live="polite"
      aria-label="Loading content"
    >
      <div className="w-full max-w-md space-y-4">
        {/* 4 pulsing skeleton blocks respecting prefers-reduced-motion */}
        <div className="h-8 w-1/3 rounded-xl bg-slate-800/80 animate-pulse motion-reduce:animate-none" />
        <div className="h-24 w-full rounded-2xl bg-slate-800/60 animate-pulse motion-reduce:animate-none" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-20 rounded-2xl bg-slate-800/50 animate-pulse motion-reduce:animate-none" />
          <div className="h-20 rounded-2xl bg-slate-800/50 animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="h-16 w-full rounded-2xl bg-slate-800/40 animate-pulse motion-reduce:animate-none" />
      </div>
      <p className="mt-4 text-xs font-medium text-slate-400 tracking-wide">
        {message}
      </p>
    </div>
  );
};

export default PageLoader;
