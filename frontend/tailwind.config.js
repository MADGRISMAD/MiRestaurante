/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mirestaurante: {
          primary: "#1A4A38",
          accent: "#B8956C",
          surface: "#F6F3EE",
          ink: "#121816",
        },
      },
      fontFamily: {
        display: ['"Figtree"', "Segoe UI", "system-ui", "sans-serif"],
        sans: ['"Figtree"', "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
