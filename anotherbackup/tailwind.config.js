/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./about-us.html",
    "./components/**/*.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#1E7976',
      }
    },
  },
  plugins: [],
}