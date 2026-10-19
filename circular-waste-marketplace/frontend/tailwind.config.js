/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Semantic background tokens
        "bg-base": "var(--bg-base, #030712)",
        "bg-surface": "var(--bg-surface, #0f172a)",
        "bg-elevated": "var(--bg-elevated, #1e293b)",
        // Semantic border tokens
        "border-subtle": "var(--border-subtle, #1e293b)",
        "border-strong": "var(--border-strong, #334155)",
        // Semantic text tokens
        "text-primary": "var(--text-primary, #f8fafc)",
        "text-secondary": "var(--text-secondary, #94a3b8)",
        "text-muted": "var(--text-muted, #64748b)",
        // Brand ramp (Emerald family)
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        // State feedback colors
        danger: {
          500: "#ef4444",
          600: "#dc2626",
        },
        success: {
          500: "#10b981",
        },
        warning: {
          500: "#f59e0b",
        },
        slate: {
          850: "#151e2e",
          950: "#030712",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "0.25rem",   // 4px
        md: "0.5rem",    // 8px
        lg: "0.75rem",   // 12px
        xl: "1rem",      // 16px
        "2xl": "1.5rem", // 24px
      },
      boxShadow: {
        "glow-brand": "0 0 20px -3px rgba(16, 185, 129, 0.25), 0 0 8px -2px rgba(16, 185, 129, 0.2)",
        "glow-brand-lg": "0 0 35px -5px rgba(16, 185, 129, 0.35)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
        "brand-gradient-hover": "linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)",
      },
    },
  },
  plugins: [],
};
