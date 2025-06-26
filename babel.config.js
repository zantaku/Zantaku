module.exports = function (api) {
  api.cache(true);
  
  const isProduction = process.env.NODE_ENV === 'production';
  const isLowEndOptimization = process.env.LOW_END_OPTIMIZATION === 'true';
  
  return {
    presets: [
      ['babel-preset-expo', { 
        jsxImportSource: 'nativewind'
      }]
    ],
    plugins: [
      // Module resolver for better tree-shaking
      ['module-resolver', {
        root: ['./'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@': './',
          '@components': './components',
          '@screens': './screens',
          '@utils': './utils',
          '@services': './services',
          '@contexts': './contexts',
          '@constants': './constants',
          '@types': './types',
          '@hooks': './hooks',
          '@lib': './lib'
        }
      }],
      
      // Production optimizations
      ...(isProduction ? [
        // Remove console statements in production
        'transform-remove-console',
        // Optimize React elements
        '@babel/plugin-transform-react-constant-elements',
        '@babel/plugin-transform-react-inline-elements',
      ] : []),

      // Low-end device specific optimizations
      ...(isLowEndOptimization ? [
        // Additional optimizations for low-end devices
        ['transform-remove-console', { exclude: ['error', 'warn'] }],
      ] : []),
      
      // React Native Reanimated (must be last)
      'react-native-reanimated/plugin'
    ]
  };
}; 