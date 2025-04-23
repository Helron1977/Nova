// Utilisation de la syntaxe ES Module
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default {
  plugins: [
    tailwindcss({ config: './tailwind.config.js' }),
    autoprefixer,
  ],
}; 