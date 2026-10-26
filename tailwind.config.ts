import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const v = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        // background layers
        bg: v('bg'),
        surface: v('surface'),
        raised: v('raised'),
        border: v('border'),
        ring: v('ring'),
        fg: v('fg'),
        muted: v('muted'),
        subtle: v('subtle'),
        brand: { DEFAULT: v('brand'), fg: v('brand-fg'), soft: v('brand-soft') },
        // decision / stage semantics (see lib/tokens.ts)
        st: {
          approved: v('st-approved'),
          hold: v('st-hold'),
          rejected: v('st-rejected'),
          waitlisted: v('st-waitlisted'),
          onboarding: v('st-onboarding'),
          open: v('st-open'),
          needs: v('st-needs'),
        },
        pr: { high: v('pr-high'), medium: v('pr-medium'), low: v('pr-low') },
        pin: {
          open: v('pin-open'),
          interest: v('pin-interest'),
          allocated: v('pin-allocated'),
          store: v('pin-store'),
          conflict: v('pin-conflict'),
          outside: v('pin-outside'),
        },
      },
      borderRadius: { lg: '16px', md: '12px', sm: '8px' },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        lift: '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.05)',
        pop: '0 16px 40px -8px rgb(15 23 42 / 0.22), 0 4px 12px -4px rgb(15 23 42 / 0.1)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { shimmer: 'shimmer 1.4s infinite' },
    },
  },
  plugins: [animate],
} satisfies Config;
