import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        acid: {
          DEFAULT: 'var(--acid)',
          light: 'var(--acid-light)',
          dim: 'var(--acid-dim)',
          mid: 'var(--acid-mid)',
          glow: 'var(--acid-glow)',
          muted: 'var(--acid-muted)',
          nav: 'var(--acid-nav)',
        },
        'brand-blue': {
          DEFAULT: 'var(--brand-blue)',
          dim: 'var(--brand-blue-dim)',
        },
        'brand-orange': {
          DEFAULT: 'var(--brand-orange)',
          dim: 'var(--brand-orange-dim)',
        },
        'wa-green': {
          DEFAULT: 'var(--wa-green)',
          dim: 'var(--wa-green-dim)',
        },
        bg: {
          DEFAULT: 'var(--bg)',
          2: 'var(--bg-2)',
          3: 'var(--bg-3)',
          4: 'var(--bg-4)',
        },
        glass: {
          DEFAULT: 'var(--glass)',
          2: 'var(--glass-2)',
          hover: 'var(--glass-hover)',
          active: 'var(--glass-active)',
        },
        line: {
          DEFAULT: 'var(--line)',
          2: 'var(--line-2)',
          acid: 'var(--line-acid)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
        },
      },
      borderRadius: {
        sm: '9px',
        DEFAULT: '14px',
        lg: '20px',
      },
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease',
        'slide-up': 'slide-up 0.28s cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [],
} satisfies Config
