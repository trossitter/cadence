const flowbite = require('flowbite/plugin');

module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../node_modules/flowbite-react/**/*.{js,mjs,cjs}',
  ],
  theme: {
    extend: {},
  },
  plugins: [flowbite],
};
