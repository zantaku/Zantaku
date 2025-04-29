const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Determine if we're in production mode
const isProduction = process.env.NODE_ENV === 'production';

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolver for module aliases
config.resolver.extraNodeModules = {
  '@': path.resolve(__dirname),
  '@hooks': path.resolve(__dirname, 'hooks'),
  '@components': path.resolve(__dirname, 'components'),
  '@utils': path.resolve(__dirname, 'utils'),
  '@constants': path.resolve(__dirname, 'constants'),
  '@services': path.resolve(__dirname, 'services'),
};

// Enable inline requires for faster startup
config.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: true,
  },
});

// No obfuscation for now to get a successful build
if (isProduction) {
  console.log('Production build: Obfuscation disabled for now');
} else {
  console.log('Development build: No obfuscation');
}

module.exports = config; 