# X Downloader Media

A lightweight and efficient Chrome/Brave extension designed to download high-quality media (images and videos) from any X (Twitter) profile, and securely backup your personal Bookmarks and Likes. 

*This project was built through a collaborative effort of manual development, human curation, and AI assistance.*

## Core Features

* **Profile Media Downloader:** Extract original-quality photos, highest-bitrate MP4 videos, and reposts from any target X profile.
* **Personal Data Backup:** Securely archive your own saved Bookmarks and Liked Tweets directly from your authenticated session.
* **Single ZIP Archive (In-Memory):** All media is processed in RAM and bundled into a single, dynamically named `.zip` file (e.g., `TargetHandle_Media.zip` or `My_Account_Backup.zip`). This prevents your browser from spamming you with hundreds of save prompts.
* **Smart Video Extraction:** Automatically parses internal data to fetch the highest resolution `video/mp4` variants.
* **Max Media Limit:** Set a custom cap on how many items to fetch before packaging the ZIP.
* **Modern UI:** Clean, dark-themed popup interface with simple toggles for filtering media types, fetching the live avatar of the target profile.

## Installation (Developer Mode)

1. Download the ZIP of this repository and extract it, or clone it.
2. Open Chrome or Brave and navigate to `chrome://extensions` (or `brave://extensions`).
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the extracted folder.
5. Pin the extension to your toolbar, open an X/Twitter tab, and start downloading!

## Support & Attribution

If you find this tool helpful and want to support further development:
* **USDT (TRC20):** `TEQFQ3yZejzivZ8u2rVUp1QKQCzAgrEtjk`

Created by [NasEEm (n10s_exe)](https://github.com/im-n10s)
