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

// Performance optimizations for low-end devices
config.transformer = {
  ...config.transformer,
  // Enable minification in production only
  minifierEnabled: process.env.NODE_ENV === 'production',
  minifierPath: 'metro-minify-terser',
  // Optimize image assets
  assetPlugins: ['expo-asset/tools/hashAssetFiles'],
  // Enable tree shaking
  unstable_allowRequireContext: true,
};

// Optimize bundle size
config.serializer = {
  ...config.serializer,
  createModuleIdFactory: () => {
    // Use shorter module IDs to reduce bundle size
    const moduleIdMap = new Map();
    let nextId = 0;
    return (path) => {
      if (!moduleIdMap.has(path)) {
        moduleIdMap.set(path, nextId++);
      }
      return moduleIdMap.get(path);
    };
  },
};

// Asset optimization
config.resolver.assetExts = [
  ...config.resolver.assetExts.filter(ext => ext !== 'svg'),
  'webp', // Prefer WebP images
];

module.exports = config; 