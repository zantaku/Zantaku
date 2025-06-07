# Discord Rich Presence Setup for Zantaku

## 🎮 Overview

Zantaku now supports Discord Rich Presence integration! When users connect their Discord account, the app will automatically show their activity status on Discord.

## 📋 Features

- **🏠 Browsing Status**: Shows "Browsing Zantaku" when idle in the app
- **📺 Watching Status**: Shows "Watching [Anime Title] - Episode X" when watching anime
- **📖 Reading Status**: Shows "Reading [Manga Title] - Chapter X" when reading manga
- **🔄 Auto-Connect**: Automatically connects when Discord account is linked
- **✨ Visual Indicator**: Shows "🎮 Rich Presence Active" in account settings

## 🛠️ Setup Requirements

### 1. Discord Application Setup

You need to configure your Discord application at https://discord.com/developers/applications:

1. **Application Images**: Upload these images to your Discord app:
   - `zantaku_logo` - Main app logo (512x512 recommended)
   - `idle` - Idle status icon
   - `watching` - Watching status icon  
   - `reading` - Reading status icon

2. **Application ID**: Currently using `1376029920219893930`

### 2. Platform Support

- ✅ **Desktop/Web**: Full RPC support
- ❌ **Mobile**: Discord RPC is not supported on mobile platforms
- ⚠️ **Expo Go**: Limited support, works better in production builds

## 🔧 Technical Implementation

### Components

1. **`useDiscordRPC` Hook** (`hooks/useDiscordRPC.ts`)
   - Manages RPC connection and activities
   - Handles reconnection logic
   - Provides activity setting functions

2. **`DiscordRPCContext` Provider** (`contexts/DiscordRPCContext.tsx`)
   - Global RPC state management
   - Auto-connects when Discord user is available
   - Provides app-wide RPC functions

3. **Account Settings Integration** (`app/appsettings/accountsetting.tsx`)
   - Shows RPC connection status
   - Visual indicator when active

### Usage Examples

```typescript
// In any component, use the context
import { useDiscordRPCContext } from '../contexts/DiscordRPCContext';

const MyComponent = () => {
  const { setWatchingAnime, setReadingManga, setBrowsingZantaku } = useDiscordRPCContext();
  
  // When user starts watching anime
  await setWatchingAnime("Attack on Titan", 1);
  
  // When user starts reading manga  
  await setReadingManga("One Piece", 1000);
  
  // When user returns to browsing
  await setBrowsingZantaku();
};
```

## 🎯 Activity Types

### Browsing Zantaku
```
Details: "Browsing Zantaku"
State: "Discovering anime & manga"
Large Image: zantaku_logo
Small Image: idle
```

### Watching Anime
```
Details: "Watching [Anime Title]"
State: "Episode [X]" or "Enjoying the show"
Large Image: zantaku_logo
Small Image: watching
```

### Reading Manga
```
Details: "Reading [Manga Title]"
State: "Chapter [X]" or "Enjoying the story"
Large Image: zantaku_logo
Small Image: reading
```

## 🔍 Troubleshooting

### Common Issues

1. **RPC Not Connecting**
   - Ensure Discord desktop app is running
   - Check if user has Discord account linked in Zantaku
   - Verify platform support (desktop/web only)

2. **Images Not Showing**
   - Upload images to Discord Developer Portal
   - Use exact key names: `zantaku_logo`, `idle`, `watching`, `reading`
   - Images must be approved (can take time)

3. **Mobile Not Working**
   - This is expected - Discord RPC doesn't support mobile
   - Feature only works on desktop/web platforms

### Debug Logs

The app logs RPC activity with `🎮` prefix:
```
🎮 [RPC Context] Discord user detected, connecting RPC...
🎮 Discord RPC connected successfully
🎮 Discord RPC activity set: Browsing Zantaku
```

## 🚀 Future Enhancements

- [ ] Custom activity messages based on user preferences
- [ ] Integration with video player for real-time episode tracking
- [ ] Manga reader integration for chapter progress
- [ ] Party/group watching features
- [ ] Custom status messages

## 📝 Notes

- RPC connection is automatic when Discord account is linked
- Activity updates in real-time as user navigates the app
- Gracefully handles disconnections and reconnections
- No user intervention required once Discord is connected 