/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#132B43',
        brand: {
          50: '#ecfdff', 100: '#cff7fe', 200: '#a5eefd', 300: '#67e0fa', 400: '#22ccef',
          500: '#1AACDA', 600: '#0e90ba', 700: '#0e7490', 800: '#155e75', 900: '#132B43',
        },
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(19,43,67,0.18)',
      },
    },
  },
  plugins: [],
};
