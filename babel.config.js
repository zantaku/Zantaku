module.exports = function (api) {
  api.cache(true);
  
  const isProduction = process.env.NODE_ENV === 'production';
  
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
      
      // React Native Reanimated (must be last)
      'react-native-reanimated/plugin'
    ]
  };
}; 