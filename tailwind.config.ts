import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#22c55e",
          dark: "#15803d"
        }
      },
      borderRadius: {
        "4xl": "2rem"
      }
    }
  },
  plugins: []
};

export default config;
