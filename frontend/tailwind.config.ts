import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Luxury Real Estate Palette (Mizumi Dark Luxury)
        luxury: {
          black: '#0A0A0B',
          dark: '#0D0D11',
          card: '#141418',
          cardElevated: '#1A1A22',
          border: 'rgba(255, 255, 255, 0.08)',
          borderHover: 'rgba(201, 169, 97, 0.35)',
          gold: '#C9A961',
          goldLight: '#DFBF77',
          goldDark: '#A68742',
          goldMuted: 'rgba(201, 169, 97, 0.15)',
          text: '#F5F5F7',
          textMuted: '#9A9AA5',
          textSubtle: '#686873',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'luxury-sm': '0 2px 8px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.6)',
        'luxury-md': '0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.6)',
        'luxury-lg': '0 20px 40px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.7)',
        'gold-glow': '0 0 25px rgba(201, 169, 97, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
