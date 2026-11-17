# X Downloader Media (v5.0 - In-Memory Single-Batch Media Archiver & Backup)

A fast, ultra-premium Manifest V3 browser extension for Chrome & Brave that downloads original photos, highest-bitrate MP4 videos, and reposts from any Twitter/X profile, and provides independent personal account backup for **Bookmarks** and **Likes** using Twitter's internal GraphQL API entirely in the background, packaging everything into **ONE single `.zip` file** in memory.

---

## Key Features

1. **Dual Mode Operation**:
   - **Profile Media Mode**: Download all original photos, highest-bitrate MP4 videos, and reposts from any target user profile (e.g. `x.com/NASA`), packaged as `${handle}_Media.zip`.
   - **Backup Data (My Account) Mode**: Independently archive your personal saved **Bookmarks** and **Liked Tweets** from your authenticated session into a single archive (`My_Account_Backup.zip` or `${handle}_Backup.zip`).

2. **Dynamic Filename Naming**:
   - Resulting ZIP archives are dynamically named after the target profile (e.g., `NASA_Media.zip`) or your account backup (`My_Account_Backup.zip`).
   - Reinforced with `chrome.downloads.onDeterminingFilename` to strictly override generic `download.zip` defaults in Chromium browsers.

3. **Dynamic High-Resolution Profile Avatar**:
   - Automatically extracts the live profile picture of the target Twitter/X user currently viewed (via OpenGraph meta tags, profile DOM header, and JSON-LD structured data).
   - Upgrades resolution to 400x400 and presents it in a rounded avatar frame with a glow aura right next to their `@handle`.

4. **Optional Max Media Limit**:
   - Includes a sleek iOS-style toggle and numeric input (e.g., 100 items).
   - When enabled, halts GraphQL pagination as soon as the cap is reached, immediately proceeding to package and download the collected media.
   - When disabled, scans and archives all media until the profile or collection history ends.

5. **Ultra-Premium Glassmorphism UI/UX**:
   - Deep obsidian void dark theme (`#090a0f`) with smoked glassmorphism (`backdrop-filter: blur(18px)`).
   - Mode switcher tabs for seamless switching between Profile Media and Account Backup.
   - Premium X-blue to electric cyan gradient accents for Profile Downloader and emerald-cyan accents for Account Backup.
   - Smooth, tactile iOS-style toggle switches for instant media filtering.

6. **Single ZIP Archive Batch (In-Memory)**:
   - Collects all selected media across the timeline or backup collections, buffers them concurrently into RAM, and generates a single archive.
   - Triggers **exactly ONE download prompt** using Blob URLs and Offscreen Documents, completely eliminating repetitive save prompts.

7. **Full Video & Reposts (Retweets) Support**:
   - **Videos**: Parses `video_info.variants`, filters for `video/mp4`, and automatically selects the variant with the **highest bitrate** (1080p/720p).
   - **Reposts / Retweets**: Fetches media from Reposts made by the target user when enabled.

8. **Creator Attribution & Developer Support**:
   - `Created with ❤️ By n10s_exe` attribution.
   - One-click social button with the official X logo opening `https://x.com/n10s_exe`.
   - One-click **GitHub** button opening `https://github.com/im-n10s`.
   - Click-to-copy **USDT (TRC20)** donation badge (`TEQFQ3yZejzivZ8u2rVUp1QKQCzAgrEtjk`) with instant visual feedback.

9. **Active Session Mirroring**:
   - Authenticates using active `ct0` CSRF, `auth_token`, and `twid` cookies.
   - Handles `next_cursor` recursive pagination until the end or limit is reached.

---

## File Structure

```
twitter-image-downloader/
├── manifest.json       # Manifest V3 configuration with offscreen & cookies
├── background.js       # Background service worker: GraphQL pagination, Bookmarks/Likes backup & single-ZIP archiver
├── offscreen.html      # Offscreen context for Blob URL generation
├── offscreen.js        # Offscreen handler triggering the single ZIP download with dynamic naming
├── inject.js           # MAIN world content script: API & Webpack query interceptor
├── content.js          # ISOLATED world content script: profile handle, avatar & user ID extractor
├── popup.html          # Redesigned glassmorphism UI with mode tabs, backup controls & creator footer
├── popup.css           # Ultra-premium dark-theme stylesheet
├── popup.js            # UI controller, mode tabs, dynamic avatar, backup triggers & click-to-copy
├── lib/
│   └── jszip.js        # Zero-dependency PKZIP builder
├── icons/              # Modern icons (SVG, 16px, 48px, 128px)
│   ├── icon.svg
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## How to Install and Test in Chrome / Brave

1. Open **Chrome** or **Brave** and navigate to `chrome://extensions` or `brave://extensions`.
2. Toggle on **Developer mode** in the upper-right corner.
3. Click **Load unpacked** and select the extension folder:
   `C:\Users\NasEEm\.gemini\antigravity\scratch\twitter-image-downloader`
   *(If already loaded, simply click the Reload icon on the extension card).*
4. Navigate to any Twitter/X tab (e.g. `https://x.com/NASA` or `https://x.com/home`).
5. Click the extension icon in your browser toolbar:
   - **Profile Media Tab**: Extract all photos, videos, and reposts from the active profile into `${handle}_Media.zip`.
   - **Backup (My Account) Tab**: Switch to the Backup tab to archive your personal Bookmarks and Likes into `My_Account_Backup.zip`.
   - In the footer, click the **Follow** or **GitHub** buttons to open social profiles, or click **Support Dev (USDT TRC20)** to copy the wallet address.
