/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f9fb",
          100: "#d0eef4",
          200: "#a3dbe8",
          300: "#6cc2d6",
          400: "#35a4be",
          500: "#1a8ea6",
          600: "#10788f",
          700: "#0d6277",
          800: "#0a4f61",
          900: "#073d4b",
        },
        gold: {
          50:  "#fdf8e1",
          100: "#faefc0",
          200: "#f5de80",
          300: "#f0cc40",
          400: "#e6b711",
          500: "#c99e0e",
          600: "#a8830b",
          700: "#876808",
        },
      },
    },
  },
  plugins: [],
};
