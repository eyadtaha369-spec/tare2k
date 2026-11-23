import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#fef2f2", 100: "#fde3e3", 500: "#c81e1e", 600: "#a31515", 700: "#8a1010", 900: "#4c0808" },
        ink: "#111111",
      },
      fontFamily: { sans: ["Cairo", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
