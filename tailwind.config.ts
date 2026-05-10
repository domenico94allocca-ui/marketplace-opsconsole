import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand BacoliOnLife (cfr. memory project_brand)
        brand: {
          DEFAULT: "#0E5C9C",
          light: "#1E78C4",
          dark: "#063C6A",
          accent: "#F2A422",
        },
        ok: "#16A34A",
        warn: "#EAB308",
        err: "#DC2626",
        neutral: {
          950: "#0A0F1A",
          900: "#0F1622",
          800: "#1A2433",
          700: "#2A3648",
          500: "#6B7A93",
          200: "#D7DEE9",
          100: "#EDF1F7",
        },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "monospace"] },
    },
  },
  plugins: [],
};
export default config;
