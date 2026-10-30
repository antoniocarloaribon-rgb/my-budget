/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      colors: { ink: '#0a0a0a', paper: '#ffffff', mute: '#6b6b6b', line: '#e6e6e6', soft: '#f5f5f5' },
    },
  },
  plugins: [],
};
