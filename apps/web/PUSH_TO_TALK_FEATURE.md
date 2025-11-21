# Push-to-Talk Feature Documentation

## Overview
The Push-to-Talk (PTT) feature allows users to activate voice input by holding down a configurable keyboard shortcut. This provides a hands-free alternative to clicking the microphone button.

## Feature Files

### Core Logic
- **`src/lib/pushToTalkStorage.ts`** - LocalStorage management for PTT settings
  - Stores enabled/disabled state
  - Stores custom key bindings
  - Provides key matching and formatting utilities

- **`src/hooks/usePushToTalk.ts`** - React hook for PTT functionality
  - Global keyboard event listeners
  - Push state management
  - Callbacks for push start/end events
  - Automatic cleanup on unmount

### UI Components
- **`src/components/settings/PushToTalkSettings.tsx`** - Settings panel UI
  - Toggle to enable/disable PTT
  - Key binding recorder
  - Visual feedback for active state

- **`src/components/dashboard/MicrophoneButton.tsx`** - Updated microphone button
  - Shows PTT mode indicator when enabled
  - Animates when key is being held
  - Different colors for different states

### Integration
- **`src/components/dashboard/MessageComposer.tsx`** - Main integration point
  - Uses `usePushToTalk` hook
  - Connects PTT to voice input system
  - Disables PTT when auto-voice detection is active

- **`src/app/settings/page.tsx`** - Settings page
  - Includes PushToTalkSettings component

## How It Works

### 1. Settings Configuration
Users can configure PTT in Settings:
- **Enable/Disable Toggle**: Turn the feature on or off
- **Key Binding Recorder**: Press any key combination to set as PTT trigger
  - Supports modifier keys (Ctrl, Alt, Shift, Meta)
  - Default: Space bar
  - Shows visual feedback during recording

### 2. Push-to-Talk Usage
When enabled:
1. User holds down the configured key
2. Voice input automatically starts
3. Speech is transcribed while key is held
4. User releases the key
5. Voice input stops

### 3. Visual Indicators

#### Microphone Button States
- **Idle (PTT Disabled)**: Gray background, "Voice input" text
- **PTT Ready**: Blue background, "🎙️ Push-to-Talk" text
- **PTT Active (Key Held)**: Green background with pulse animation, "🎙️ Recording..." text
- **Auto-Voice Mode**: Purple background, "🔊 Auto-voice" text
- **Manual Listening**: Red background with pulse animation, "Listening..." text

#### Settings Panel
- **Recording Key**: Blue highlight with live preview
- **Current Binding**: Shows formatted key combination (e.g., "Ctrl + Alt + R")

## Feature Interactions

### Compatibility
- **✅ Works with**: Manual microphone button, Step-by-step mode, File uploads
- **❌ Disabled when**: Auto-voice detection is enabled (they conflict)
- **❌ Disabled when**: Voice input feature is disabled in toggles

### Priority Order
1. Auto-voice detection (if enabled, PTT is disabled)
2. Push-to-Talk (if enabled and auto-voice is off)
3. Manual microphone button (always available)

## Technical Details

### Storage Keys
- `ptt_enabled`: Boolean for feature state
- `ptt_keybind`: JSON object with key binding details

### Key Binding Format
```typescript
{
  key: string,        // Main key (e.g., " " for space, "r" for R key)
  ctrl?: boolean,     // Ctrl modifier
  alt?: boolean,      // Alt modifier
  shift?: boolean,    // Shift modifier
  meta?: boolean      // Meta/Command modifier
}
```

### Event Flow
1. User presses key → `keydown` event
2. `usePushToTalk` matches against configured binding
3. If match: Call `onPushStart()` → Start voice input
4. User releases key → `keyup` event
5. If match: Call `onPushEnd()` → Stop voice input

### Safety Features
- Ignores key events when user is typing in input fields (except textarea for composer)
- Prevents repeat events from key holding
- Cleans up properly on component unmount
- Respects feature toggles and disabled states

## Testing Checklist

### Settings Page
- [ ] Toggle switch enables/disables PTT
- [ ] Click "Change" to start key recording
- [ ] Press any key combination to record
- [ ] Display shows formatted key combination
- [ ] Click "Save" to persist the binding
- [ ] Click "Cancel" to abort recording
- [ ] Settings persist across page reloads

### Dashboard Usage
- [ ] Microphone button shows "🎙️ Push-to-Talk" when enabled
- [ ] Hold configured key → Button turns green and shows "🎙️ Recording..."
- [ ] Voice input starts automatically
- [ ] Speech is transcribed to composer
- [ ] Release key → Voice input stops
- [ ] Button returns to blue "🎙️ Push-to-Talk" state

### Edge Cases
- [ ] PTT doesn't activate when typing in other input fields
- [ ] PTT works when typing in the message composer textarea
- [ ] Enabling auto-voice detection disables PTT
- [ ] Disabling voice input feature disables PTT
- [ ] PTT state clears properly when navigating away
- [ ] Multiple rapid key presses don't cause issues

## Debugging

### Console Logs
The feature includes console logs for debugging:
- `[Push-to-Talk] Key pressed - starting voice input`
- `[Push-to-Talk] Key released - stopping voice input`

### Common Issues

**PTT not working?**
- Check if PTT is enabled in Settings
- Verify key binding is configured
- Ensure voice input feature is enabled
- Make sure auto-voice detection is disabled
- Check browser console for errors

**Voice input not starting?**
- Verify microphone permissions in browser
- Check that speech recognition is supported
- Look for error messages in microphone button tooltip

**Key binding not saving?**
- Check browser localStorage is enabled
- Verify you clicked "Save" after recording
- Try a different key combination

## Future Enhancements

Potential improvements:
- Visual overlay showing PTT status (floating indicator)
- Haptic feedback on mobile devices
- Multiple key bindings for different actions
- Integration with gamepad/controller buttons
- Voice activity detection during PTT
- Automatic send after PTT release (optional)
