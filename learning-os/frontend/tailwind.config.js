/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      screens: {
        'xs': '480px',
      },
      colors: {
        'console-bg': 'var(--console-bg)',
        'console-surface': 'var(--console-surface)',
        'console-surface-2': 'var(--console-surface-2)',
        primary: 'var(--accent-primary)',
        'primary-dark': 'var(--accent-primary-dark)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
      },
    },
  },
};
