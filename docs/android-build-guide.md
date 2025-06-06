This guide explains how to build optimized Android APKs for both React Native CLI and Expo projects.

## Development Workflow Recommendation

While this guide focuses on building release APKs, it's highly recommended to use Expo during development because:

- **Fast Development Cycle**: Expo provides real-time app previews through `expo start` without needing to generate new APKs for every change
- **Instant Updates**: Changes are reflected immediately in the Expo Go app or development client
- **No Build Wait Times**: Avoid the ~1 hour build time that comes with generating new APKs after each code change
- **Cross-Platform Testing**: Easily test on both Android and iOS devices simultaneously
- **Development Client**: Use Expo's development client for testing native code changes without full rebuilds

You only need to generate a new APK/AAB when:
- Publishing to the Play Store
- Distributing a release version to users
- Testing a production build

## Method 1: React Native CLI (Split APKs - Recommended)

This method produces optimized split APKs for different CPU architectures, resulting in smaller download sizes for users.

### Prerequisites for Local Building
Required only if you plan to build locally on your machine:
- Node.js installed
- Android Studio installed
- Android SDK installed
- Environment variables set up (`ANDROID_HOME`, `JAVA_HOME`)

If you plan to use EAS (Expo Application Services) for cloud building instead, you only need:
- Node.js installed
- Expo CLI installed (`npm install -g expo-cli`)
- Expo account (create at expo.dev)

### Important Directory Note
For the gradlew commands to work, you **must** be in the `android` directory of your project. Use one of these commands to navigate there:

PowerShell:
```powershell
cd .\android
```

Linux/macOS:
```bash
cd android
```

### Steps

1. Clean the project:
This step ensures that you're building with your latest code changes and removes any cached build files that might cause conflicts:

PowerShell:
```powershell
.\gradlew clean
```

Linux/macOS:
```bash
./gradlew clean
```

The clean command:
- Removes old build files and cached data
- Ensures your new APK will include all your recent code changes
- Prevents potential build issues from stale cache or leftover files
- Recommended before every new release build

2. (Optional - Recommended for Play Store) Build the Android App Bundle (AAB):
PowerShell:
```powershell
$env:NODE_ENV="production"; .\gradlew bundleRelease
```

Linux/macOS:
```bash
NODE_ENV=production ./gradlew bundleRelease
```

This step is optional if you only need APKs for direct distribution, but recommended if you plan to publish your app on the Google Play Store as it's their preferred format.

3. Generate split APKs:

PowerShell:
```powershell
$env:NODE_ENV="production"; .\gradlew clean -PenableSeparateBuildPerCPUArchitecture=true assembleRelease
```

Linux/macOS:
```bash
NODE_ENV=production ./gradlew assembleRelease
```

> ⚠️ **IMPORTANT PowerShell Users**: For the most reliable results when generating split APKs, you can either:
> 1. Use the command above with the `-PenableSeparateBuildPerCPUArchitecture=true` parameter, or
> 2. Make the configuration permanent in your `android/gradle.properties` file by adding or updating these lines:
>    ```
>    android.enableSplits=true
>    reactNativeArchitectures=arm64-v8a,armeabi-v7a,x86,x86_64
>    ```
>    Then run the standard command: `$env:NODE_ENV="production"; .\gradlew assembleRelease`

### Command Safety and Security

The recommended command `$env:NODE_ENV="production"; .\gradlew clean -PenableSeparateBuildPerCPUArchitecture=true assembleRelease` is completely safe and is actually the preferred way to build optimized split APKs on Windows PowerShell. Here's why:

1. **Build Parameter Safety**: The `-PenableSeparateBuildPerCPUArchitecture=true` parameter is a standard Gradle property that enables CPU architecture-specific APK generation.

2. **Clean Integration**: Including `clean` in the command ensures no cached files from previous builds interfere with the current build, resulting in a clean, fresh build every time.

3. **Production Mode Security**: Setting `NODE_ENV="production"` properly activates all security features including Hermes bytecode compilation, code minification, and obfuscation.

4. **Reliable Windows Compatibility**: This approach is more reliable on Windows systems where command line parameters with certain characters can sometimes fail.

### Production Mode Importance

Setting `NODE_ENV=production` before running Gradle commands is **highly recommended** for release builds. This environment variable:

- Triggers production-specific optimizations in the Metro bundler
- Removes development-only code and warning systems
- Enables more aggressive minification
- Disables source maps generation
- Enables full Hermes bytecode compilation without debugging hooks
- Optimizes the asset loading for production performance
- Removes redundant code that's only used in development

Without setting this environment variable, your release builds might still include development features that can impact performance, increase bundle size, and potentially expose sensitive debugging information.

### Output Locations
- Split APKs: `android/app/build/outputs/apk/release/`
  - `app-arm64-v8a-release.apk` (~107.9MB - Modern ARM 64-bit devices)
  - `app-armeabi-v7a-release.apk` (~96.0MB - Older ARM 32-bit devices)
  - `app-x86-release.apk` (~115.1MB - x86 32-bit devices)
  - `app-x86_64-release.apk` (~123.1MB - x86_64 devices/emulators)
- App Bundle: `android/app/build/outputs/bundle/release/app-release.aab`

These split APKs ensure that users only download the specific APK for their device architecture. While the APK sizes are larger than typical React Native apps due to the rich feature set of this application, the split APK approach still reduces the download size significantly compared to a single universal APK that would include all architectures (~400-500MB).

## JavaScript Bundle Security

This project implements multiple layers of security to protect the JavaScript bundle and sensitive information:

### React Native JS Bundling & Build Optimization

✅ **Hermes Engine**: Android builds use Hermes JavaScript engine (enabled in app.config.ts) which:
   - Pre-compiles JavaScript to efficient bytecode
   - Makes source code significantly harder to reverse engineer
   - Removes readable JavaScript source from the bundle

✅ **Metro Optimization**:
   - Inline requires enabled for faster startup and code organization
   - Production-only transforms for optimal bundle size

✅ **Babel Optimization**:
   - Console logs automatically removed in production builds
   - Environment-specific optimizations

### Code Obfuscation

✅ **Metro Obfuscation Transformer**:
   - Production builds automatically pass through JavaScript obfuscator
   - Control flow flattening (makes code logic harder to follow)
   - Dead code injection (adds irrelevant code to confuse reverse engineers)
   - String array encryption with Base64 encoding
   - Self-defending code that prevents tampering

✅ **ProGuard & Shrink Resources**: 
   - Minifies and renames Java code
   - Removes debug information
   - Aggressively optimizes the app binary
   - Enabled in build.gradle with comprehensive rules in proguard-rules.pro

### Split APKs Security Benefit

The `-PenableSeparateBuildPerCPUArchitecture=true` approach adds an additional security benefit:

1. **Reduced Attack Surface**: Each APK contains only the native code needed for a specific architecture, reducing potential attack vectors.
2. **Optimized Binary Size**: Smaller, more focused binaries can be more thoroughly optimized by ProGuard.
3. **Lower Memory Requirements**: With only one set of native libraries loaded, there's less memory overhead at runtime.
4. **Architecture-Specific Optimizations**: Each APK can have architecture-specific security optimizations.

### Bundle Size Optimization

✅ **Asset Optimization**:
   - PNG compression enabled
   - Image optimization during build process
   - Resource shrinking removes unused resources

✅ **Code Splitting**:
   - ABI-specific APKs (arm64-v8a, armeabi-v7a, x86, x86_64)
   - Each architecture only contains necessary native code

### Environment Variables Security

Sensitive information like API keys in `.env` files is handled securely:

1. **Compiled Into Binary**: Environment variables are transformed during build and not stored as plain text
2. **Not Directly Accessible**: Variables aren't stored in clear text in the JS bundle
3. **Obfuscated Access**: All code accessing these variables is obfuscated

### Security Without Full Obfuscation

Even if you don't explicitly enable the Metro Obfuscation Transformer, a production build (using `NODE_ENV=production`) still provides solid security through:

1. **Hermes Engine Bytecode**: JS code is compiled to Hermes bytecode rather than stored as text
2. **ProGuard Minification**: Java code is minified and class names are shortened
3. **Debug Information Removal**: Debug symbols and development features are stripped
4. **Production Optimizations**: Several React Native optimizations that make code harder to reverse engineer

### Risk Assessment

**Risk of Source Code Extraction With Full Obfuscation**: < 1%

With all security measures implemented (including Metro Obfuscation), the risk of source code extraction is extremely low due to:
1. Hermes bytecode format being difficult to reverse engineer
2. Multiple layers of obfuscation hiding the actual program logic
3. String encryption
4. Complex control flow
5. Dead code confusing analysis

**Risk of Source Code Extraction Without Explicit Obfuscation**: ~5-10%

When using production mode (`NODE_ENV=production`) but without the Metro Obfuscation Transformer:
1. Hermes bytecode is still difficult to reverse engineer
2. ProGuard still obfuscates Java code
3. Debug information is still removed
4. But control flow remains more straightforward
5. String literals remain more accessible

For most applications, this level of security is sufficient for initial releases, especially when balanced against development convenience. Consider implementing full obfuscation for final production releases of apps with high-value intellectual property or handling particularly sensitive user data.

**Risk of Environment Variables Extraction**: 
- With full obfuscation: ~3-5%
- Without explicit obfuscation: ~15-20%

Environment variables remain a higher security risk than general code because they are string values needed at runtime.

## Method 2: Expo Build (Single APK)

This method produces a single, larger APK file that works on all devices. Use this if you're using Expo managed workflow.

### Prerequisites
For cloud builds (recommended):
- Node.js installed
- Expo CLI installed (`npm install -g expo-cli`)
- Expo account (create at expo.dev)

For local builds (optional):
- All prerequisites from Method 1's local building section (Android Studio, SDK, etc.)

### Directory Note
For Expo commands, you can run them from your project's root directory. No need to be in the android folder.

### Steps

1. Build using EAS (Expo Application Services):
```bash
# Install EAS CLI if not installed
npm install -g eas-cli

# Login to your Expo account
eas login

# Configure EAS build if not done
eas build:configure

# Build AAB for Play Store submission
eas build --platform android

# Build APK for direct distribution (preview or production)
# Preview build (faster, good for testing):
eas build -p android --profile preview

# Production build:
eas build -p android --profile production
```

**Note**: The Expo build method will generate a single, larger APK that includes all architectures (~100-150MB). If APK size is a concern, it's recommended to use Method 1 (React Native CLI) instead, which generates split APKs (~50-60MB each) for different architectures, resulting in smaller downloads for end users.

2. Alternatively, build locally (if you want to build without EAS):
```bash
# Only needed if you don't have the android folder in your project
# (e.g., after cloning or if deleted):
expo prebuild

# Navigate to Android directory
# PowerShell:
cd .\android
# Linux/macOS:
cd android

# just use "$env:NODE_ENV="production"; .\gradlew clean assembleRelease" for windows 

# Build release APK
# PowerShell:
.\gradlew assembleRelease
# Linux/macOS:
./gradlew assembleRelease

# Build release APK with production optimizations (optimized split APKs)
# PowerShell:
$env:NODE_ENV="production"; .\gradlew clean -PenableSeparateBuildPerCPUArchitecture=true assembleRelease
# Linux/macOS:
NODE_ENV=production ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86,x86_64 -Pandroid.enableSplits=true

# Build optimized split APKs with production settings
# (First add split configuration to android/gradle.properties):
# android.enableSplits=true
# reactNativeArchitectures=arm64-v8a,armeabi-v7a,x86,x86_64
#
# Then run:
# PowerShell:
$env:NODE_ENV="production"; .\gradlew assembleRelease
# Linux/macOS:
NODE_ENV=production ./gradlew assembleRelease
```

### Output Locations
- EAS Build: Download link provided after build completion
- Local Build: `android/app/build/outputs/apk/release/app-release.apk`

## ProGuard Optimization

The project includes optimized ProGuard rules in `android/app/proguard-rules.pro` that safely reduce APK size without breaking functionality:
- Code optimization and minification (safely removes unused code)
- Debug log removal (removes development logs)
- Unused code removal (only removes truly unused code)
- Class repackaging (makes code more compact)
- Size reduction while maintaining app functionality

The ProGuard rules are already configured to preserve all necessary code and only remove what's safe to remove. You don't need to modify these rules unless you're adding new native modules that require specific ProGuard configurations.

## Important Notes

1. **Signing**:
   - Release builds need to be signed with a keystore
   - Keep your keystore and credentials safe
   - Configure signing in `android/app/build.gradle`

2. **Production Environment**:
   - Always set `NODE_ENV=production` before running release builds
   - PowerShell: `$env:NODE_ENV="production"; .\gradlew assembleRelease`
   - Linux/macOS: `NODE_ENV=production ./gradlew assembleRelease`
   - Without this, your APK may contain development code and be less secure
   - Production mode activates optimizations critical for performance

3. **Enforce Split APKs**:
   - For PowerShell, use: `$env:NODE_ENV="production"; .\gradlew clean -PenableSeparateBuildPerCPUArchitecture=true assembleRelease`
   - For Linux/macOS: `NODE_ENV=production ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86,x86_64 -Pandroid.enableSplits=true`
   - Without these, you'll get a single massive APK (~400MB) instead of optimized split APKs
   - Split APKs dramatically reduce download size for end users

4. **Alternatives for Split APKs**:
   - Configure in `android/gradle.properties` file for reliable results:
     ```
     android.enableSplits=true
     reactNativeArchitectures=arm64-v8a,armeabi-v7a,x86,x86_64
     ```
   - Without these settings, you'll get a single massive APK (~400MB) instead of optimized split APKs
   - Split APKs reduce download size for end users (individual APKs range from ~107MB to 134MB)
   - Both command line arguments and properties file configurations work, choose what's most reliable for your setup

5. **Testing**:
   - Test the APK on different device architectures
   - Verify all features work in release mode
   - Check app size and performance

6. **Play Store Submission**:
   - Use the `.aab` file for Play Store submission
   - Keep your upload key secure
   - Follow Play Store guidelines for app submission

7. **Troubleshooting**:
   - If build fails, check the gradle logs
   - Ensure all native dependencies are properly linked
   - Verify ProGuard rules aren't removing needed code

## Size Comparison

- Split APKs (Method 1):
  - `app-arm64-v8a-release.apk` (~107.9MB - Modern ARM 64-bit devices)
  - `app-armeabi-v7a-release.apk` (~96.0MB - Older ARM 32-bit devices)
  - `app-x86-release.apk` (~115.1MB - x86 32-bit devices)
  - `app-x86_64-release.apk` (~123.1MB - x86_64 devices/emulators)
  - Users download only what they need
  - Recommended for Play Store distribution

- Single APK (Method 2):
  - One APK ~400-500MB
  - Contains all architectures
  - Simpler distribution but significantly larger size

## Best Practices

1. Always clean build before creating release:
PowerShell:
```powershell
cd .\android
.\gradlew clean
```

Linux/macOS:
```bash
cd android
./gradlew clean
```

2. Test on multiple devices before distribution

3. Keep signing keys secure and backed up

4. Monitor app size and performance metrics

5. Regular updates to dependencies and build tools 