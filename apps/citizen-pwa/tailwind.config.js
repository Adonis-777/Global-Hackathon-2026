/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../shared/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        quantum: {
          ink: "#000000",
          inkSoft: "#2e2e2e",
          muted: "#b8b8b8",
          nav: "#000000",
          card: "#f2f2f2",
          panel: "#ffffff",
          border: "#ededed",
          accent: "#38c6ec",
          band: "#0db5ed",
          danger: "#ff3131",
          warning: "#f6a825",
        },
      },
      fontFamily: {
        sans: ["'Figtree'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
}
