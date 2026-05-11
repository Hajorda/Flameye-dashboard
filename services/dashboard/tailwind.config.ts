import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#f47b25",
        "background-dark": "#1A1A24",
        "background-light": "#f8f7f5",
        "ui-dark": "#252836",
        "ui-light": "#FFFFFF",
        "text-dark": "#E0E0E0",
        "text-light": "#1A1A24",
        "border-dark": "#493222",
        "border-light": "#E0E0E0",
        "severity-high": "#FF4500",
        "severity-medium": "#FFC107",
        "severity-low": "#03A9F4",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
    },
  },
  plugins: [],
} satisfies Config;
