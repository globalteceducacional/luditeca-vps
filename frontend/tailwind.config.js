/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'bar-indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(350%)' },
        },
      },
      animation: {
        'bar-indeterminate': 'bar-indeterminate 1.35s ease-in-out infinite',
      },
      fontFamily: {
        'poppins': ['Poppins', 'sans-serif'],
        'dosis': ['Dosis', 'sans-serif'],
        'nunito': ['Nunito', 'sans-serif'],
        'raleway': ['Raleway', 'sans-serif'],
        'merriweather': ['Merriweather', 'serif'],
        'roboto': ['Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
} 