/** @type {import('tailwindcss').Config} */
/** Cores alinhadas a `frontend/styles/tokens.css` (Design System v1). */
const luditeca = {
  ink: '#0f172a',
  body: '#475569',
  muted: '#64748b',
  bg: '#f8fafc',
  subtle: '#f1f5f9',
  surface: '#ffffff',
  border: '#e2e8f0',
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
  },
  accent: {
    soft: '#f5f3ff',
    200: '#ddd6fe',
    300: '#c4b5fd',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
  },
};

module.exports = {
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: { luditeca },
      maxWidth: {
        app: '56rem',
        'cms-content': '1280px',
        'cms-form': '880px',
      },
      borderRadius: {
        luditeca: '8px',
        'luditeca-lg': '12px',
      },
      boxShadow: {
        'luditeca-sm': '0 1px 3px rgba(15, 23, 42, 0.08)',
        'luditeca-md': '0 4px 12px rgba(15, 23, 42, 0.08)',
      },
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
        sans: [
          'Plus Jakarta Sans',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        poppins: ['Poppins', 'sans-serif'],
        dosis: ['Dosis', 'sans-serif'],
        nunito: ['Nunito', 'sans-serif'],
        raleway: ['Raleway', 'sans-serif'],
        merriweather: ['Merriweather', 'serif'],
        roboto: ['Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
