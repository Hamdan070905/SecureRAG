/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      transitionTimingFunction: { smooth: 'cubic-bezier(0.4, 0, 0.2, 1)' },
      spacing: { '4.5': '1.125rem' },
      colors: {
        brand: { 50:'#ecfeff', 100:'#cffafe', 500:'#06b6d4', 600:'#0891b2', 700:'#0e7490', 900:'#164e63' },
        surface: { 50:'#f8fafc', 100:'#f1f5f9', 800:'#161616', 850:'#161616', 900:'#111111', 950:'#090909' },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#2a2a2a',
          800: '#2a2a2a',
          900: '#111111',
          950: '#090909',
        }
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      animation: { 'fade-in': 'fadeIn .2s ease', 'slide-up': 'slideUp .25s ease', pulse2: 'pulse 1.5s infinite' },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
      },
    },
  },
  plugins: [],
}
