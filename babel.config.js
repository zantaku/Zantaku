module.exports = function (api) {
  api.cache(true);
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  const plugins = [
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          '@': '.',
          '@hooks': './hooks',
          '@components': './components',
          '@utils': './utils',
          '@constants': './constants',
          '@services': './services',
        },
      },
    ],
  ];
  
  // Add production-only plugins for obfuscation and console removal
  if (isProduction) {
    // Remove console statements in production
    plugins.push('transform-remove-console');
  }
  
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
}; 