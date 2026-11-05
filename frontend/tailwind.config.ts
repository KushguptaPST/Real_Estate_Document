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
        // Unified Editorial Real Estate Palette: Obsidian + Statutory Emerald + Alabaster
        brand: {
          black: '#0A0A0A',
          emerald: '#059669',
          emeraldDark: '#047857',
          emeraldLight: '#10B981',
          emeraldMuted: '#ECFDF5',
          alabaster: '#FAFAF8',
          card: '#FFFFFF',
          border: '#E4E4E7',
          muted: '#71717A',
        },
        // Backwards compatibility tokens aligned to unified system
        flow: {
          bg: '#FAFAF8',
          canvas: '#FAFAF8',
          surface: '#FFFFFF',
          surfaceElevated: '#FFFFFF',
          border: '#E4E4E7',
          borderHover: '#059669',
          borderActive: '#047857',
          emerald: '#059669',
          mint: '#10B981',
          sage: '#6EE7B7',
          forest: '#047857',
          cream: '#FAFAF8',
          parchment: '#F4F4F1',
          amber: '#D97706',
          text: '#0A0A0A',
          textMuted: '#71717A',
          textSubtle: '#A1A1AA',
        },
        luxury: {
          canvas: '#FAFAF8',
          surface: '#FFFFFF',
          card: '#FFFFFF',
          cardElevated: '#FFFFFF',
          border: '#E4E4E7',
          borderHover: '#D4D4D8',
          cobalt: '#0A0A0A',
          cobaltLight: '#27272A',
          cobaltDark: '#09090B',
          cobaltMuted: 'rgba(10, 10, 10, 0.05)',
          emerald: '#059669',
          emeraldLight: '#10B981',
          emeraldMuted: '#ECFDF5',
          text: '#0A0A0A',
          textMuted: '#71717A',
          textSubtle: '#A1A1AA',
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
        serif: ['"EB Garamond"', 'Newsreader', 'Georgia', 'serif'],
        editorial: ['"EB Garamond"', 'Newsreader', 'Georgia', 'serif'],
        sans: ['Figtree', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'subtle-xs': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'subtle-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)',
        'subtle-md': '0 4px 12px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.03)',
        'subtle-lg': '0 10px 25px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
        'cobalt-glow': '0 0 20px rgba(37, 99, 235, 0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
