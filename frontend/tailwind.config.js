/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans SC"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        surface: {
          0: "#FAFAFA",
          1: "#FFFFFF",
          2: "#F1F5F9",
          3: "#E2E8F0",
        },
        border: {
          DEFAULT: "#E2E8F0",
          subtle: "#F1F5F9",
          hover: "#CBD5E1",
        },
        text: {
          primary: "#0F172A",
          secondary: "#475569",
          tertiary: "#64748B",
          muted: "#94A3B8",
        },
        accent: {
          DEFAULT: "#0052FF",
          hover: "#3373FF",
          muted: "#4D7CFF",
          subtle: "rgba(0, 82, 255, 0.06)",
        },
        role: {
          investor: "#D97706",
          cto: "#0891B2",
          user: "#059669",
          competitor: "#E11D48",
          orchestrator: "#7C3AED",
        },
        success: "#059669",
        warning: "#D97706",
        danger: "#DC2626",
        info: "#0052FF",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-subtle": "pulseSubtle 2.5s ease-in-out infinite",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        pulseDot: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.4)", opacity: "0.6" },
        },
      },
      boxShadow: {
        "card": "0 1px 3px 0 rgba(0,0,0,0.04), 0 6px 16px -4px rgba(0,0,0,0.06)",
        "card-hover": "0 2px 8px 0 rgba(0,0,0,0.06), 0 12px 28px -6px rgba(0,0,0,0.1)",
        "btn-glow": "0 4px 14px -2px rgba(0, 82, 255, 0.35)",
        "btn-glow-hover": "0 6px 20px -2px rgba(0, 82, 255, 0.45)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
