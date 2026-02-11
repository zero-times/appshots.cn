/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff4ea',
          100: '#ffe7d2',
          200: '#ffcfac',
          300: '#ffb17d',
          400: '#ff9248',
          500: '#ff7a18',
          600: '#f25c05',
          700: '#cf4700',
          800: '#9a3200',
          900: '#6b2200',
        },
        accent: {
          500: '#56ccf2',
          600: '#2f80ed',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255, 122, 24, 0.18), 0 10px 30px rgba(242, 92, 5, 0.25)',
      },
      backgroundImage: {
        grid: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '44px 44px',
      },
    },
  },
  plugins: [],
};
