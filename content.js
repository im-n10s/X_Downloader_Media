/**
 * content.js - Runs in the ISOLATED extension context on twitter.com and x.com.
 * Extracts profile metadata (handle, user ID, high-resolution avatar URL)
 * and bridges communication between inject.js (MAIN world) and the background service worker.
 */

(function () {
  'use strict';

  // Excluded system paths on Twitter/X that are not user profiles
  const EXCLUDED_PATHS = new Set([
    'home',
    'explore',
    'notifications',
    'messages',
    'settings',
    'i',
    'compose',
    'search',
    'login',
    'signup',
    'tos',
    'privacy',
    'logout',
    'hashtag',
    'lists',
    'bookmarks',
    'verified-choose'
  ]);

  /**
   * Extracts the screen name (handle) from the current URL path.
   */
  function extractProfileHandle() {
    const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (!pathname) return null;

    const parts = pathname.split('/');
    const firstSegment = parts[0];

    if (!firstSegment || EXCLUDED_PATHS.has(firstSegment.toLowerCase())) {
      return null;
    }

    if (/^[a-zA-Z0-9_]{1,15}$/.test(firstSegment)) {
      return firstSegment;
    }

    return null;
  }

  /**
   * Upgrades avatar URLs from _normal, _bigger, _mini, _200x200 to _400x400 high resolution.
   */
  function upgradeAvatarUrl(url) {
    if (!url || typeof url !== 'string') return null;
    // Replace size indicator with _400x400 for crisp high-res quality
    return url.replace(/_(normal|bigger|mini|200x200)(\.[a-z0-9]+)(\?.*)?$/i, '_400x400$2$3');
  }

  /**
   * Dynamic High-Resolution Profile Picture Extractor from DOM:
   * 1. meta[property="og:image"]
   * 2. Header avatar link (a[href$="/photo"] img)
   * 3. data-testid="UserAvatar-Container" or data-testid*="UserAvatar" img
   * 4. JSON-LD structured data
   * 5. Fallback: Any pbs.twimg.com/profile_images image in primaryColumn or document
   */
  function extractAvatarUrlFromDOM() {
    // Strategy 1: OpenGraph meta tag (usually points to high-res profile photo on user pages)
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) {
      const content = ogImage.getAttribute('content');
      if (content && content.includes('profile_images')) {
        return upgradeAvatarUrl(content);
      }
    }

    // Strategy 2: Profile photo link element on user profile header
    const profileLinkImg = document.querySelector('a[href$="/photo"] img[src*="profile_images"]');
    if (profileLinkImg && profileLinkImg.src) {
      return upgradeAvatarUrl(profileLinkImg.src);
    }

    // Strategy 3: UserAvatar testid container
    const avatarTestIdImg = document.querySelector('[data-testid*="UserAvatar"] img[src*="profile_images"]');
    if (avatarTestIdImg && avatarTestIdImg.src) {
      return upgradeAvatarUrl(avatarTestIdImg.src);
    }

    // Strategy 4: Profile header image inside primary column
    const primaryImg = document.querySelector('div[data-testid="primaryColumn"] img[src*="profile_images"]');
    if (primaryImg && primaryImg.src) {
      return upgradeAvatarUrl(primaryImg.src);
    }

    // Strategy 5: JSON-LD Structured Data
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        if (!script.textContent) continue;
        const data = JSON.parse(script.textContent);
        const cand =
          data.image?.contentUrl ||
          data.image?.thumbnailUrl ||
          (typeof data.image === 'string' ? data.image : null);

        if (cand && cand.includes('profile_images')) {
          return upgradeAvatarUrl(cand);
        }
      }
    } catch (e) {}

    // Strategy 6: Fallback OpenGraph even if it doesn't contain 'profile_images'
    if (ogImage) {
      const content = ogImage.getAttribute('content');
      if (content && content.startsWith('http') && !content.includes('abs.twimg.com/responsive-web')) {
        return content;
      }
    }

    // Strategy 7: Any profile image on page
    const anyAvatar = document.querySelector('img[src*="pbs.twimg.com/profile_images"]');
    if (anyAvatar && anyAvatar.src) {
      return upgradeAvatarUrl(anyAvatar.src);
    }

    return null;
  }

  /**
   * Primary Method: Instant DOM Extraction of Logged-in User's Avatar.
   * Extracts avatar from the sidebar account switcher or navigation on x.com / twitter.com.
   */
  function extractLoggedInUserAvatarFromDOM() {
    const selectors = [
      '[data-testid="SideNav_AccountSwitcher_Button"] img[src*="pbs.twimg.com/profile_images"]',
      '[data-testid="SideNav_AccountSwitcher_Button"] img',
      '[data-testid*="AccountSwitcher"] img[src*="pbs.twimg.com/profile_images"]',
      '[data-testid*="AccountSwitcher"] img',
      '[aria-label*="Account menu" i] img[src*="pbs.twimg.com/profile_images"]',
      'header nav a[href*="/"] img[src*="pbs.twimg.com/profile_images"]',
      'nav[role="navigation"] [role="button"] img[src*="pbs.twimg.com/profile_images"]'
    ];

    for (const sel of selectors) {
      const img = document.querySelector(sel);
      if (img && img.src && !img.src.includes('default_profile')) {
        return upgradeAvatarUrl(img.src);
      }
    }

    return null;
  }

  /**
   * User ID (rest_id) extraction from DOM:
   * 1. Follow/Unfollow button testid: data-testid="<userId>-follow"
   * 2. UserActions button testid: data-testid="<userId>-userActions"
   * 3. JSON-LD structured data schema
   * 4. Meta tags (al:android:url, al:ios:url, twitter:user_id)
   * 5. Intent links (/intent/user?user_id=...)
   */
  function extractUserIdFromDOM() {
    // 1. Follow / Unfollow buttons
    const followBtn = document.querySelector('[data-testid$="-follow"], [data-testid$="-unfollow"]');
    if (followBtn) {
      const testId = followBtn.getAttribute('data-testid');
      const match = testId.match(/^(\d+)-(un)?follow$/);
      if (match && match[1]) return match[1];
    }

    // 2. User Actions menu button
    const userActionBtn = document.querySelector('[data-testid$="-userActions"]');
    if (userActionBtn) {
      const match = userActionBtn.getAttribute('data-testid').match(/^(\d+)-userActions$/);
      if (match && match[1]) return match[1];
    }

    // 3. JSON-LD schema
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        if (!script.textContent) continue;
        const data = JSON.parse(script.textContent);
        const cand =
          data.identifier ||
          data.author?.identifier ||
          data.mainEntity?.identifier ||
          data.user_id;

        if (cand && /^\d+$/.test(String(cand))) return String(cand);
      }
    } catch (e) {}

    // 4. Meta tags
    const metaTags = document.querySelectorAll(
      'meta[content*="twitter://user?id="], meta[content*="&id="], meta[name="twitter:user_id"], meta[property="twitter:user_id"]'
    );
    for (const meta of metaTags) {
      const content = meta.getAttribute('content') || '';
      const match = content.match(/id=(\d+)/) || content.match(/^(\d+)$/);
      if (match && match[1]) return match[1];
    }

    // 5. Intent links
    const intentLink = document.querySelector('a[href*="/intent/user?user_id="]');
    if (intentLink) {
      const match = intentLink.href.match(/user_id=(\d+)/);
      if (match && match[1]) return match[1];
    }

    return null;
  }

  function getProfileContext() {
    const handle = extractProfileHandle();
    const userId = extractUserIdFromDOM();
    const avatarUrl = extractAvatarUrlFromDOM();
    const loggedInAvatarUrl = extractLoggedInUserAvatarFromDOM();

    // Cache logged-in avatar if found
    if (loggedInAvatarUrl) {
      try {
        chrome.storage.local.set({ cachedMyAvatar: loggedInAvatarUrl });
      } catch (e) {}
    }

    return {
      isProfile: Boolean(handle),
      handle: handle,
      userId: userId,
      avatarUrl: avatarUrl,
      loggedInAvatarUrl: loggedInAvatarUrl,
      url: window.location.href
    };
  }

  // Forward intercepted queries from inject.js to background
  window.addEventListener('message', (event) => {
    if (
      event.source === window &&
      event.data &&
      event.data.source === 'TWITTER_IMAGE_DOWNLOADER_INJECT'
    ) {
      const payload = event.data.data;
      if (payload) {
        try {
          chrome.runtime.sendMessage({
            action: 'STORE_INTERCEPTED_CREDENTIALS',
            payload: {
              queryIds: payload.queryIds,
              features: payload.features
            }
          });
        } catch (e) {}
      }
    }
  });

  // Handle messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GET_PAGE_INFO') {
      sendResponse(getProfileContext());
      return true;
    }
    if (message.action === 'GET_LOGGED_IN_USER_DOM') {
      const loggedInAvatarUrl = extractLoggedInUserAvatarFromDOM();
      if (loggedInAvatarUrl) {
        try {
          chrome.storage.local.set({ cachedMyAvatar: loggedInAvatarUrl });
        } catch (e) {}
      }
      sendResponse({ loggedInAvatarUrl: loggedInAvatarUrl });
      return true;
    }
  });

  // Try caching logged-in avatar on content script initial load
  try {
    const initialAvatar = extractLoggedInUserAvatarFromDOM();
    if (initialAvatar) {
      chrome.storage.local.set({ cachedMyAvatar: initialAvatar });
    }
  } catch (e) {}

  // Request credentials from inject.js
  window.postMessage(
    {
      source: 'TWITTER_IMAGE_DOWNLOADER_CONTENT',
      action: 'REQUEST_CREDENTIALS_AND_QUERIES'
    },
    '*'
  );
})();
