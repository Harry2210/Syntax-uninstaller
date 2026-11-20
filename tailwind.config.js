/** @type {import('tailwindcss').Config} */

/*
 * Colours are resolved from CSS variables (defined in src/styles/index.css) so
 * the exact same utility classes work in both themes:
 *
 *   bg-card            → rgb(var(--c-card))
 *   bg-primary/20      → rgb(var(--c-primary) / 0.2)
 *   text-text-muted    → rgb(var(--c-text-muted))
 *
 * Swapping `html.dark` / `html.light` therefore re-themes the whole app with no
 * per-component changes.
 */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: token('background'),
        sidebar: token('sidebar'),
        card: token('card'),
        surface: token('surface'),
        'surface-elevated': token('surface-elevated'),
        primary: {
          DEFAULT: token('primary'),
          hover: token('primary-hover'),
          muted: 'rgb(var(--c-primary) / 0.13)',
        },
        secondary: {
          DEFAULT: token('secondary'),
          hover: token('secondary-hover'),
          muted: 'rgb(var(--c-secondary) / 0.13)',
        },
        /**
         * Alias kept for historical class usages (`text-accent-secondary`
         * appears 59 times across 8 pages).
         */
        'accent-secondary': token('secondary'),
        info: token('info'),
        warning: token('warning'),
        danger: token('danger'),
        success: token('secondary'),
        text: {
          primary: token('text-primary'),
          secondary: token('text-secondary'),
          muted: token('text-muted'),
        },
        border: {
          DEFAULT: token('border'),
          subtle: token('border-subtle'),
          active: token('primary'),
        }
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'Segoe UI Variable', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow-primary': '0 0 24px -4px rgb(var(--c-primary) / 0.45)',
        'glow-secondary': '0 0 24px -4px rgb(var(--c-secondary) / 0.4)',
        card: '0 1px 2px rgb(var(--c-shadow) / 0.35), 0 8px 24px -12px rgb(var(--c-shadow) / 0.5)',
        'card-hover': '0 2px 4px rgb(var(--c-shadow) / 0.35), 0 16px 36px -16px rgb(var(--c-shadow) / 0.65)',
      },
      /**
       * NOTE: `animate-fade-in` and friends were referenced across ~30 pages but
       * were never declared, so those elements rendered with no animation at all.
       * They are defined here so the whole app animates consistently.
       */
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        floatY: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        borderWarningPulse: {
          '0%, 100%': {
            borderColor: 'rgb(var(--c-danger) / 0.25)',
            boxShadow: '0 0 0 0 rgb(var(--c-danger) / 0)',
          },
          '50%': {
            borderColor: 'rgb(var(--c-danger) / 0.65)',
            boxShadow: '0 0 15px -1px rgb(var(--c-danger) / 0.25)',
          },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in-up': 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in-down': 'fadeInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slideInRight 0.32s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left': 'slideInLeft 0.32s cubic-bezier(0.16, 1, 0.3, 1) both',
        'float-y': 'floatY 4s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        'warning-pulse': 'borderWarningPulse 2.8s ease-in-out infinite',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(rgb(var(--c-border) / 0.35) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-border) / 0.35) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
    },
  },
  plugins: [],
}
