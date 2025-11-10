/** @type {import('tailwindcss').Config} */
import animate from "tailwindcss-animate"

export default {
    darkMode: ["class"],
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
      extend: {
        colors: {
          'primary': "#009DA5", //Xanh lá 
          'secondary': "#0D6CE8", //Xanh dương
        }
      }
    },
    plugins: [animate]
  }
  