const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Basic resolver configuration
config.resolver.platforms = ['ios', 'android', 'native', 'web'];
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

// Add resolver for module aliases
config.resolver.alias = {
  '@': path.resolve(__dirname),
  '@hooks': path.resolve(__dirname, 'hooks'),
  '@components': path.resolve(__dirname, 'components'),
  '@utils': path.resolve(__dirname, 'utils'),
  '@constants': path.resolve(__dirname, 'constants'),
  '@services': path.resolve(__dirname, 'services'),
};

module.exports = config; 