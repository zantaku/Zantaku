import 'dotenv/config';

export default {
  expo: {
    name: "Zantaku",
    slug: "kamilist",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "kamilist",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/transparent_Splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "assets/images/*",
      "assets/fonts/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.vie4e.zantaku"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/android/res/mipmap-xxxhdpi/Zantaku_foreground.png",
        backgroundImage: "./assets/images/android/res/mipmap-xxxhdpi/Zantaku_background.png",
        monochromeImage: "./assets/images/android/res/mipmap-xxxhdpi/Zantaku_monochrome.png",
        backgroundColor: "#ffffff"
      },
      icon: "./assets/images/android/play_store_512.png",
      package: "com.kamilist.app",
      enableProguardInReleaseBuilds: true,
      jsEngine: "hermes",
      enableShrinkResources: true,
      androidGradlePlugin: "7.1.1",
      minSdkVersion: 21
    },
    web: {
      favicon: "./assets/images/Favicon.png"
    },
    extra: {
      // AniList credentials
      ANILIST_CLIENT_ID: process.env.ANILIST_CLIENT_ID,
      ANILIST_CLIENT_SECRET: process.env.ANILIST_CLIENT_SECRET,
      ANILIST_REDIRECT_URI: process.env.ANILIST_REDIRECT_URI,
      DEV_ANILIST_CLIENT_ID: process.env.DEV_ANILIST_CLIENT_ID,
      DEV_ANILIST_CLIENT_SECRET: process.env.DEV_ANILIST_CLIENT_SECRET,
      DEV_ANILIST_REDIRECT_URI: process.env.DEV_ANILIST_REDIRECT_URI,
      // Supabase configuration
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      // API URLs
      consumentapi: process.env.consumentapi,
      jelleeapi: process.env.jelleeapi,
      anilistapi: process.env.anilistapi,
      jikianapi: process.env.jikianapi,
      enokiapi: process.env.enokiapi,
      eas: {
        projectId: "6e9bc65b-f841-4d04-80d8-2fb3ca903bd8"
      }
    },
    plugins: [
      "expo-router", 
      "expo-video",
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#ffffff",
          "image": "./assets/images/transparent_Splash.png",
          "resizeMode": "contain"
        }
      ],
      "./translucent-default-splash-screen-config"
    ],
    "build": {
      "production": {
        "android": {
          "buildType": "apk",
          "gradleCommand": ":app:assembleRelease",
          "splitsAPK": true
        }
      }
    }
  }
}; 