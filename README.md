# FocusShield Browser Extension

A student-focused digital wellbeing browser extension that helps track focus time, manage distractions, and build productive habits.

## Features

- **Website Time Tracking**: Automatically tracks time spent on websites at the domain level
- **Focus Mode**: Start Pomodoro-style focus sessions with customizable durations
- **Distraction Nudges**: Gentle notifications when visiting distracting sites during Focus Mode (no hard blocking)
- **Statistics Dashboard**: View your focus time, sessions, streaks, and top sites
- **Achievements System**: Unlock achievements for milestones like first session, streaks, etc.
- **Local Storage**: All data stored locally using IndexedDB (no cloud sync)

## Installation

1. Clone or download this repository
2. Open Chrome/Edge and navigate to `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your browser toolbar

## Project Structure

```
DTL_EL/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker (tab tracking, Focus Mode, notifications)
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── dashboard.html         # Statistics dashboard
├── dashboard.js           # Dashboard logic
├── options.html           # Settings page
├── options.js             # Settings logic
├── db.js                  # IndexedDB helper module
├── css/
│   ├── popup.css          # Popup styles
│   ├── dashboard.css      # Dashboard styles
│   └── options.css        # Options styles
└── icons/
    ├── icon16.png         # 16x16 icon (required)
    ├── icon48.png         # 48x48 icon (required)
    └── icon128.png        # 128x128 icon (required)
```

## Icons

**Important**: You need to add icon files to the `icons/` folder:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

See `icons/README.md` for more details on creating icons.

## How It Works

### Time Tracking

- Tracks tabs when they're created or updated
- Records domain and timestamp in memory
- When a tab closes or navigates to a new domain, calculates time spent
- Stores statistics in IndexedDB (`domainStats` object store)

### Focus Mode

1. User selects a duration (25/40/50 minutes or custom) in the popup
2. Background script creates a focus session record in IndexedDB
3. Sets a Chrome alarm for session end time
4. While active, monitors tab navigation
5. If a distracting domain (from blocklist) is visited:
   - Shows notification with "Stay Focused" or "Continue" options
   - If "Continue" is clicked, logs as a distraction
6. When session ends (or is stopped), marks as completed and shows notification

### IndexedDB Structure

The extension uses a single IndexedDB database `focusshieldDB` with the following object stores:

- **domainStats**: Website visit statistics
  - Key: `domain` (string)
  - Value: `{ domain, totalTimeMs, visitCount, firstVisited, lastVisited }`

- **focusSessions**: Focus session records
  - Key: `id` (string)
  - Value: `{ id, startTime, endTime, plannedDuration, status, distractionCount, distractions[], totalFocusMinutes }`
  - Indexes: `status`, `startTime`, `endTime`

- **achievements**: Unlocked achievements
  - Key: `id` (string)
  - Value: `{ id, unlocked, unlockedAt }`

- **settings**: Extension settings
  - Key: `'settings'` (string)
  - Value: `{ blocklist: [], enableNotifications: true, ... }`

### Blocklist

- Preset distracting sites (Instagram, YouTube, Netflix, etc.)
- Custom domains can be added in the options page
- Blocklist is stored in IndexedDB settings

## Usage

1. **Start a Focus Session**: Click the extension icon, select duration, click "Start Focus Mode"
2. **View Dashboard**: Click "View Dashboard" in popup or navigate to `dashboard.html`
3. **Manage Blocklist**: Click "Settings" in popup or navigate to `options.html`
4. **Stop Focus Mode**: Click "Stop Focus Mode" in popup (or wait for timer to complete)

## Permissions

- `tabs`: Track tab creation, updates, and navigation
- `notifications`: Show focus nudges and session completion notifications
- `alarms`: Handle Pomodoro timer / Focus Mode end
- `storage`: Minimal use for temporary notification state (main data in IndexedDB)
- `<all_urls>`: Access to all URLs for domain extraction

## Development

The extension is built with:
- Vanilla JavaScript (no frameworks)
- Manifest V3
- IndexedDB for data storage
- Chrome Extensions API

## Notes

- Time tracking is approximate (based on tab open/close times)
- Focus Mode uses gentle nudges, not hard blocking
- All data is stored locally (no cloud sync)
- The extension persists Focus Mode state across browser restarts

## License

This project is provided as-is for educational purposes.

