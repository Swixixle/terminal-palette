/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-rounded', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#f5f5f7',
          raised: '#ffffff',
          inset: '#e8e8ed',
        },
        ink: {
          DEFAULT: '#1d1d1f',
          muted: '#6e6e73',
        },
        accent: {
          DEFAULT: '#007aff',
          soft: '#e5f1ff',
        },
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
};
