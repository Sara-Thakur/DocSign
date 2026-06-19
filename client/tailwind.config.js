/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f1ff',
          100: '#e0e3ff',
          200: '#c7cbfe',
          300: '#a5a7fc',
          400: '#8b7df8',
          500: '#7c5cf2',
          600: '#6d3ee6',
          700: '#5e30cb',
          800: '#4d29a4',
          900: '#412782',
          950: '#27164e',
        },
        dark: {
          50: '#f6f6f9',
          100: '#ececf3',
          200: '#d5d5e4',
          300: '#b1b0cc',
          400: '#8786b0',
          500: '#696796',
          600: '#55527d',
          700: '#464466',
          800: '#3b3a56',
          900: '#1e1d2f',
          950: '#131221',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(31, 38, 135, 0.15)',
        'glass-lg': '0 16px 48px rgba(31, 38, 135, 0.2)',
        'glow': '0 0 20px rgba(124, 92, 242, 0.3)',
        'glow-lg': '0 0 40px rgba(124, 92, 242, 0.4)',
      },
    },
  },
  plugins: [],
}
