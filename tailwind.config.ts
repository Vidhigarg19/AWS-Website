import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      transitionDuration: {
        "160": "160ms",
        "250": "250ms",
        "400": "400ms",
      },
      transitionTimingFunction: {
        "ease-out": "cubic-bezier(0.23, 1, 0.32, 1)",
        "ease-in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
        "ease-drawer": "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      colors: {
        primary: {
          DEFAULT: "#7C3AED",
          hover: "#6D28D9",
          light: "#A78BFA",
          soft: "#EDE9FE",
        },
        accent: "#C084FC",
        secondary: "#8B5CF6",
        bg: {
          DEFAULT: "#09090B",
          surface: "#111827",
          elevated: "#1F2937",
          card: "#18181B",
        },
        border: {
          DEFAULT: "#27272A",
        },
        muted: "#71717A",
        text: {
          primary: "#FAFAFA",
          secondary: "#D4D4D8",
        },
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "sans-serif"],
        display: ["var(--font-poppins)", "sans-serif"],
        body: ["var(--font-poppins)", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        "pixel-square": ["var(--font-geist-pixel-square)", "sans-serif"],
        "pixel-grid": ["var(--font-geist-pixel-grid)", "sans-serif"],
        "pixel-circle": ["var(--font-geist-pixel-circle)", "sans-serif"],
        "pixel-triangle": ["var(--font-geist-pixel-triangle)", "sans-serif"],
        "pixel-line": ["var(--font-geist-pixel-line)", "sans-serif"],
      },
      maxWidth: {
        content: "1280px",
      },
      animation: {
        "float-slow": "float 9s ease-in-out infinite",
        "float-slower": "float 13s ease-in-out infinite",
        "spin-slow": "spin 40s linear infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "shimmer": "shimmer 2.5s infinite linear",
        spotlight: "spotlight 2s ease .75s 1 normal forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px) translateX(0px)" },
          "50%": { transform: "translateY(-18px) translateX(8px)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.85)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        spotlight: {
          "0%": {
            opacity: "0",
            transform: "translate(-72%, -62%) scale(0.5)",
          },
          "100%": {
            opacity: "1",
            transform: "translate(-70%,-40%) scale(1)",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
