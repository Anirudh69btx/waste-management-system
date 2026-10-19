import React from "react";
import { Recycle } from "lucide-react";

interface PageLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  message = "Loading platform session...",
  fullScreen = true,
}) => {
  const containerClasses = fullScreen
    ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg-base/95 backdrop-blur-sm"
    : "flex flex-col items-center justify-center p-8";

  return (
    <div className={containerClasses} role="status" aria-live="polite">
      <div className="relative flex items-center justify-center">
        {/* Outer glowing pulsing ring */}
        <div className="h-16 w-16 rounded-full border-2 border-brand-500/30 animate-ping absolute" />
        
        {/* Spinning gradient ring */}
        <div className="h-14 w-14 rounded-full border-2 border-transparent border-t-brand-400 border-r-brand-500 animate-spin" />
        
        {/* Center brand icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Recycle className="h-6 w-6 text-brand-400 animate-pulse" />
        </div>
      </div>
      
      <p className="mt-4 text-xs font-medium text-text-secondary tracking-wide uppercase">
        {message}
      </p>
    </div>
  );
};
