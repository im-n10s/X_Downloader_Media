/**
 * background.js - Full-Featured Twitter/X Media Downloader Service Worker.
 * "X Downloader Media" - Single JSZip In-Memory Archiver.
 * Supports Profile Media Archiving and Independent Account Backup (Bookmarks & Likes).
 * Fetches original images, highest-bitrate MP4 videos, and reposts.
 * Bundles all selected media into a single JSZip instance and triggers ONE download.
 */

import JSZip from './lib/jszip.js';

// Standard Twitter Web Client Bearer token
const TWITTER_BEARER_TOKEN =
  'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// Fallback GraphQL query IDs for UserMedia
const USER_MEDIA_QUERY_IDS = [
  '7_ZP_xN3Bcq1I2QkK5yc2w',
  '2ICDjqPd81cCtonQEV2O0Q',
  'WzHNnGMd5zeekmfl9sZ-dQ',
  'k9oN9Zqj9u0J2O-o6eZ5fQ',
  'TXSp1xS1M_14-zX3Qy7B7Q',
  'A3TgGAPcr58mmBcu7ppcwA',
  'e-2pAeeG-m1vVfU2k_yq8w',
  'XicnWRbyQ3WgVYKYgsHN1Q'
];

// Fallback GraphQL query IDs for UserByScreenName
const USER_BY_SCREEN_NAME_QUERY_IDS = [
  'G3KGOASz96M-Qu0nwmGXNg',
  'sLVLhk0bGj3MVFEKTdax1w',
  'CgrrOldPft4MOIWoMlHW8w',
  'oUZZZ8nludyvTrFtFtGncQ',
  'k5vtQF5VJYZBQJDqlqICwA'
];

// Fallback GraphQL query IDs for Bookmarks
const BOOKMARKS_QUERY_IDS = [
  't2_mK2_8i32P_rM9_yQ9vQ',
  'q_b7hQ2H27o5dG6mKsm3gA',
  'nhadxY2V6K8cE9Zg0b171Q',
  't2gA720P55B1v171Q12345',
  'X8vB_Y9Z4QvE_39wKqVj2g',
  'rvvf9z0vU5m4p0t3H-K_tw',
  'q9h4sU23eP0b_5aB2vC_zw',
  '2p_EKnY8cW5u-pT3e9Q7gA',
  'W4_79jZq9u0J2O-o6eZ5fQ'
];

// Fallback GraphQL query IDs for Likes / UserLikedTweets
const LIKES_QUERY_IDS = [
  'aeI4G1i9h_5_cQ-4uH4z_A',
  'aM_H9r0v5P2u_89_Kz1234',
  'v19y8Y6i-q0z_B5n7aB8g',
  'lIdX741F-VjP81Zk3e8K-g',
  'TXSp1xS1M_14-zX3Qy7B7Q',
  'q_b7hQ2H27o5dG6mKsm3gA',
  '2ICDjqPd81cCtonQEV2O0Q'
];

// Required Twitter GraphQL UserMedia feature flags
const GRAPHQL_FEATURES = {
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_media_download_video_enabled: false,
  responsive_web_enhance_cards_enabled: false
};

// Global Job State
let jobState = {
  jobType: 'profile', // 'profile' | 'backup'
  status: 'idle', // 'idle' | 'resolving' | 'fetching' | 'buffering' | 'zipping' | 'completed' | 'paused' | 'error'
  handle: '',
  twitterHandle: '',
  backupFilename: 'My_Account_Backup.zip',
  userId: '',
  avatarUrl: '',
  totalFound: 0,
  totalImages: 0,
  totalVideos: 0,
  totalBuffered: 0,
  zipProgress: 0,
  pagesFetched: 0,
  currentCursor: null,
  recentThumbnails: [],
  errorMessage: null,
  logMessage: 'Ready to download'
};

let abortRequested = false;
let dynamicConfig = { queryIds: {}, features: null };

function saveState() {
  chrome.storage.local.set({ savedJobState: jobState });
}

function broadcastState(logOverride) {
  if (logOverride) jobState.logMessage = logOverride;
  saveState();
  chrome.runtime.sendMessage({ action: 'JOB_STATE_UPDATE', state: jobState }).catch(() => {});
}

let currentDownloadFilename = null;
let currentDownloadId = null;

/**
 * Enforces dynamic filename on all extension downloads, preventing Chromium
 * from falling back to generic "download.zip" or "download (1).zip".
 */
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  const isOurDownload =
    item.byExtensionId === chrome.runtime.id ||
    (currentDownloadId && item.id === currentDownloadId) ||
    (item.url && (item.url.startsWith('blob:') || item.url.startsWith('data:application/zip')));

  if (isOurDownload) {
    let desiredFilename;
    if (jobState.jobType === 'backup') {
      desiredFilename = currentDownloadFilename || jobState.backupFilename || 'My_Account_Backup.zip';
    } else {
      const handle = String(jobState.handle || jobState.twitterHandle || 'Twitter')
        .replace(/^@+/, '')
        .replace(/[^a-zA-Z0-9_]/g, '') || 'Twitter';
      desiredFilename = currentDownloadFilename || `${handle}_Media.zip`;
    }

    suggest({ filename: desiredFilename, conflictAction: 'uniquify' });
    currentDownloadFilename = null;
    return; // Synchronous return
  }

  suggest();
});

/**
 * Upgrades avatar URLs to high resolution (_400x400)
 */
function upgradeAvatarUrl(url) {
  if (!url || typeof url !== 'string') return null;
  return url.replace(/_(normal|bigger|mini|200x200)(\.[a-z0-9]+)(\?.*)?$/i, '_400x400$2$3');
}

/**
 * Extracts active session cookies (ct0, auth_token, twid) using chrome.cookies.get.
 */
async function extractSessionCookies() {
  let ct0 = null;
  let authToken = null;
  let twid = null;
  let baseUrl = 'https://x.com';

  // 1. Try x.com
  try {
    const c1 = await chrome.cookies.get({ url: 'https://x.com', name: 'ct0' });
    const c2 = await chrome.cookies.get({ url: 'https://x.com', name: 'auth_token' });
    const c3 = await chrome.cookies.get({ url: 'https://x.com', name: 'twid' });
    if (c1 && c1.value) ct0 = c1.value;
    if (c2 && c2.value) {
      authToken = c2.value;
      baseUrl = 'https://x.com';
    }
    if (c3 && c3.value) twid = c3.value;
  } catch (e) {}

  // 2. Try twitter.com
  if (!ct0 || !authToken || !twid) {
    try {
      const c1 = await chrome.cookies.get({ url: 'https://twitter.com', name: 'ct0' });
      const c2 = await chrome.cookies.get({ url: 'https://twitter.com', name: 'auth_token' });
      const c3 = await chrome.cookies.get({ url: 'https://twitter.com', name: 'twid' });
      if (c1 && c1.value && !ct0) ct0 = c1.value;
      if (c2 && c2.value && !authToken) {
        authToken = c2.value;
        baseUrl = 'https://twitter.com';
      }
      if (c3 && c3.value && !twid) twid = c3.value;
    } catch (e) {}
  }

  // 3. Fallback: domain search with chrome.cookies.getAll
  if (!ct0 || !authToken || !twid) {
    for (const domain of ['x.com', 'twitter.com']) {
      try {
        const all = await chrome.cookies.getAll({ domain });
        for (const c of all) {
          if (c.name === 'ct0' && !ct0) ct0 = c.value;
          if (c.name === 'auth_token' && !authToken) {
            authToken = c.value;
            baseUrl = `https://${domain}`;
          }
          if (c.name === 'twid' && !twid) twid = c.value;
        }
      } catch (e) {}
    }
  }

  return { ct0, authToken, twid, baseUrl };
}

function buildApiHeaders(ct0) {
  return {
    'authorization': TWITTER_BEARER_TOKEN,
    'x-csrf-token': ct0,
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-active-user': 'yes',
    'content-type': 'application/json'
  };
}

/**
 * Resolves current authenticated user credentials (ID, handle, avatar).
 */
async function getAuthenticatedUser(session) {
  let userId = null;
  let screenName = null;
  let avatarUrl = null;

  // 1. Extract userId from twid cookie if present
  if (session.twid) {
    try {
      const decoded = decodeURIComponent(session.twid);
      const match = decoded.match(/u[=:]\s*(\d+)/i) || decoded.match(/\d{5,25}/);
      if (match) {
        userId = match[1] || match[0];
      }
    } catch (e) {}
  }

  // 2. Verify Credentials endpoint
  try {
    const headers = buildApiHeaders(session.ct0);
    const resp = await fetch(`${session.baseUrl}/1.1/account/verify_credentials.json`, {
      method: 'GET',
      headers: headers,
      credentials: 'include'
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.id_str) userId = data.id_str;
      if (data.screen_name) screenName = data.screen_name;
      if (data.profile_image_url_https) {
        avatarUrl = upgradeAvatarUrl(data.profile_image_url_https);
      }
    }
  } catch (e) {}

  return { userId, screenName, avatarUrl };
}

/**
 * Resolves Twitter numeric user ID from screen name (handle).
 */
async function resolveUserId(handle, session) {
  const headers = buildApiHeaders(session.ct0);

  // Method 1: REST 1.1 users/show.json
  try {
    const url = `${session.baseUrl}/1.1/users/show.json?screen_name=${encodeURIComponent(handle)}`;
    const resp = await fetch(url, { method: 'GET', headers, credentials: 'include' });
    if (resp.ok) {
      const data = await resp.json();
      if (data.id_str) {
        if (data.profile_image_url_https && !jobState.avatarUrl) {
          jobState.avatarUrl = upgradeAvatarUrl(data.profile_image_url_https);
        }
        return data.id_str;
      }
    }
  } catch (err) {}

  // Method 2: GraphQL UserByScreenName
  const queryIds = [dynamicConfig.queryIds['UserByScreenName'], ...USER_BY_SCREEN_NAME_QUERY_IDS].filter(Boolean);
  const variables = { screen_name: handle, withSafetyModeUserFields: true };
  const features = dynamicConfig.features || GRAPHQL_FEATURES;

  for (const qId of queryIds) {
    try {
      const gqlUrl = `${session.baseUrl}/i/api/graphql/${qId}/UserByScreenName?variables=${encodeURIComponent(
        JSON.stringify(variables)
      )}&features=${encodeURIComponent(JSON.stringify(features))}`;
      const resp = await fetch(gqlUrl, { method: 'GET', headers, credentials: 'include' });
      if (resp.ok) {
        const json = await resp.json();
        const userResult = json?.data?.user?.result;
        const userId = userResult?.rest_id;
        const rawAvatar = userResult?.legacy?.profile_image_url_https || userResult?.avatar?.imageURL;
        if (rawAvatar && !jobState.avatarUrl) {
          jobState.avatarUrl = upgradeAvatarUrl(rawAvatar);
        }
        if (userId) return userId;
      }
    } catch (e) {}
  }

  throw new Error(`Unable to resolve user ID for @${handle}. Refresh the profile tab to reload.`);
}

/**
 * Rewrites image URLs to original highest resolution.
 */
function toOriginalQualityUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    let format = 'jpg';
    let baseId = url.pathname.split('/').pop();

    if (url.searchParams.has('format')) {
      format = url.searchParams.get('format') || 'jpg';
      url.searchParams.set('name', 'orig');
      return { url: url.toString(), format, baseId };
    }

    const match = url.pathname.match(/\.(jpg|jpeg|png|webp)$/i);
    if (match) {
      format = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
      baseId = url.pathname.replace(/\.(jpg|jpeg|png|webp)$/i, '').split('/').pop();
      url.pathname = url.pathname.replace(/\.(jpg|jpeg|png|webp)$/i, '');
      url.searchParams.set('format', format);
      url.searchParams.set('name', 'orig');
      return { url: url.toString(), format, baseId };
    }

    url.searchParams.set('name', 'orig');
    return { url: url.toString(), format: 'jpg', baseId };
  } catch (err) {
    return { url: rawUrl, format: 'jpg', baseId: 'img_' + Date.now() };
  }
}

/**
 * Parses video_info.variants and selects the .mp4 URL with the highest bitrate.
 */
function getBestVideoVariant(videoInfo) {
  if (!videoInfo || !Array.isArray(videoInfo.variants)) return null;

  const mp4Variants = videoInfo.variants.filter(
    (v) => v.content_type === 'video/mp4' && typeof v.url === 'string'
  );

  if (mp4Variants.length === 0) return null;

  mp4Variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  return mp4Variants[0].url;
}

/**
 * Extracts media items from a single Tweet object.
 */
function extractMediaFromTweet(tweet, isRepost = false, options = {}) {
  const mediaList = [];
  if (!tweet || !tweet.legacy) return mediaList;

  const rawMedia =
    tweet.legacy.extended_entities?.media ||
    tweet.legacy.entities?.media ||
    [];

  const tweetId = tweet.rest_id || tweet.legacy.id_str || 'tweet';
  const prefix = isRepost ? `RT_${tweetId}` : `${tweetId}`;

  for (let i = 0; i < rawMedia.length; i++) {
    const item = rawMedia[i];

    // CASE 1: Static Image / Photo
    if (item.type === 'photo') {
      if (options.includeImages === false) continue;

      const rawUrl = item.media_url_https || item.media_url;
      if (!rawUrl) continue;

      const orig = toOriginalQualityUrl(rawUrl);
      const filename = `${prefix}_img_${orig.baseId}.${orig.format}`;

      mediaList.push({
        id: `${tweetId}_img_${i}`,
        type: 'image',
        originalUrl: orig.url,
        thumbnailUrl: orig.url,
        filename: filename,
        tweetId: tweetId,
        isRepost: isRepost
      });
    }

    // CASE 2: Video or Animated GIF
    else if (item.type === 'video' || item.type === 'animated_gif') {
      if (options.includeVideos === false) continue;

      const bestVideoUrl = getBestVideoVariant(item.video_info);
      if (!bestVideoUrl) continue;

      const posterUrl = item.media_url_https || item.media_url;
      const mediaId = item.id_str || `vid_${i + 1}`;
      const filename = `${prefix}_video_${mediaId}.mp4`;

      mediaList.push({
        id: `${tweetId}_vid_${i}`,
        type: 'video',
        originalUrl: bestVideoUrl,
        thumbnailUrl: posterUrl,
        filename: filename,
        tweetId: tweetId,
        isRepost: isRepost
      });
    }
  }

  return mediaList;
}

/**
 * Deep recursive walker to extract media from tweets AND reposted tweets.
 */
function parseUserMediaResponse(json, options) {
  const mediaItems = [];
  let nextCursor = null;

  if (!json || typeof json !== 'object') return { mediaItems, nextCursor };

  function walk(node) {
    if (!node || typeof node !== 'object') return;

    // Check for Bottom cursor
    if (
      (node.cursorType === 'Bottom' ||
        (typeof node.entryId === 'string' && node.entryId.startsWith('cursor-bottom'))) &&
      (node.value || node.itemContent?.value)
    ) {
      nextCursor = node.value || node.itemContent?.value;
    }

    // Check for TimelineTweet
    if (node.itemType === 'TimelineTweet' || node.__typename === 'TimelineTweet') {
      const tweetResult = node.tweet_results?.result || node.tweetResult?.result;
      if (tweetResult) {
        const tweet = tweetResult.__typename === 'TweetWithVisibilityResults'
          ? tweetResult.tweet
          : tweetResult;

        if (tweet && tweet.legacy) {
          if (tweet.legacy.retweeted_status_result) {
            if (options.includeReposts !== false) {
              const rtResult = tweet.legacy.retweeted_status_result.result;
              const originalTweet = rtResult?.__typename === 'TweetWithVisibilityResults'
                ? rtResult.tweet
                : rtResult;

              if (originalTweet) {
                const rtMedia = extractMediaFromTweet(originalTweet, true, options);
                for (const m of rtMedia) mediaItems.push(m);
              }
            }
          } else {
            const directMedia = extractMediaFromTweet(tweet, false, options);
            for (const m of directMedia) mediaItems.push(m);
          }
        }
      }
    }

    // Direct Tweet node
    if (node.__typename === 'Tweet' && node.legacy) {
      if (node.legacy.retweeted_status_result) {
        if (options.includeReposts !== false) {
          const rtResult = node.legacy.retweeted_status_result.result;
          const originalTweet = rtResult?.__typename === 'TweetWithVisibilityResults'
            ? rtResult.tweet
            : rtResult;

          if (originalTweet) {
            const rtMedia = extractMediaFromTweet(originalTweet, true, options);
            for (const m of rtMedia) mediaItems.push(m);
          }
        }
      } else {
        const directMedia = extractMediaFromTweet(node, false, options);
        for (const m of directMedia) mediaItems.push(m);
      }
    }

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else {
      for (const key of Object.keys(node)) walk(node[key]);
    }
  }

  walk(json.data || json);
  return { mediaItems, nextCursor };
}

/**
 * Fetches a single page of profile UserMedia via GraphQL.
 */
async function fetchUserMediaPage(userId, cursor, session, options) {
  const headers = buildApiHeaders(session.ct0);
  const queryIds = [dynamicConfig.queryIds['UserMedia'], ...USER_MEDIA_QUERY_IDS].filter(Boolean);

  const variables = {
    userId: userId,
    count: 40,
    includePromotedContent: false,
    withClientEventToken: false,
    withBirdwatchNotes: false,
    withVoice: false,
    withV2Timeline: true
  };
  if (cursor) variables.cursor = cursor;

  const features = dynamicConfig.features || GRAPHQL_FEATURES;
  let lastError = null;

  for (const qId of queryIds) {
    try {
      const url = `${session.baseUrl}/i/api/graphql/${qId}/UserMedia?variables=${encodeURIComponent(
        JSON.stringify(variables)
      )}&features=${encodeURIComponent(JSON.stringify(features))}`;

      const resp = await fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      });

      if (resp.status === 401) throw new Error('Authentication expired (401). Please re-login.');
      if (resp.status === 429) throw new Error('Rate limit reached (429). Reset in 15 minutes.');
      if (resp.status === 404 || resp.status === 400) continue;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

      const json = await resp.json();
      if (json.errors && json.errors.length > 0 && !json.data) {
        const msg = json.errors[0].message || '';
        if (msg.includes('Cannot find query') || msg.includes('not provided')) continue;
        throw new Error(msg);
      }

      return parseUserMediaResponse(json, options);
    } catch (err) {
      lastError = err;
      if (err.message.includes('401') || err.message.includes('429')) throw err;
    }
  }

  throw lastError || new Error('Could not query UserMedia with available GraphQL query IDs.');
}

/**
 * Fetches a single page of personal Bookmarks via GraphQL.
 */
async function fetchBookmarksPage(cursor, session, options) {
  const headers = buildApiHeaders(session.ct0);
  const queryIds = [dynamicConfig.queryIds['Bookmarks'], ...BOOKMARKS_QUERY_IDS].filter(Boolean);

  const variables = {
    count: 40,
    includePromotedContent: false
  };
  if (cursor) variables.cursor = cursor;

  const features = dynamicConfig.features || GRAPHQL_FEATURES;
  let lastError = null;

  for (const qId of queryIds) {
    try {
      const url = `${session.baseUrl}/i/api/graphql/${qId}/Bookmarks?variables=${encodeURIComponent(
        JSON.stringify(variables)
      )}&features=${encodeURIComponent(JSON.stringify(features))}`;

      const resp = await fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      });

      if (resp.status === 401) throw new Error('Authentication expired (401). Please re-login.');
      if (resp.status === 429) throw new Error('Rate limit reached (429). Reset in 15 minutes.');
      if (resp.status === 404 || resp.status === 400) continue;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

      const json = await resp.json();
      if (json.errors && json.errors.length > 0 && !json.data) {
        const msg = json.errors[0].message || '';
        if (msg.includes('Cannot find query') || msg.includes('not provided')) continue;
        throw new Error(msg);
      }

      return parseUserMediaResponse(json, options);
    } catch (err) {
      lastError = err;
      if (err.message.includes('401') || err.message.includes('429')) throw err;
    }
  }

  throw lastError || new Error('Could not query Bookmarks with available GraphQL query IDs.');
}

/**
 * Fetches a single page of personal Likes via GraphQL.
 */
async function fetchLikesPage(userId, cursor, session, options) {
  const headers = buildApiHeaders(session.ct0);
  const queryIds = [
    dynamicConfig.queryIds['Likes'],
    dynamicConfig.queryIds['UserLikedTweets'],
    ...LIKES_QUERY_IDS
  ].filter(Boolean);

  const variables = {
    userId: userId,
    count: 40,
    includePromotedContent: false
  };
  if (cursor) variables.cursor = cursor;

  const features = dynamicConfig.features || GRAPHQL_FEATURES;
  let lastError = null;

  for (const qId of queryIds) {
    for (const opName of ['Likes', 'UserLikedTweets']) {
      try {
        const url = `${session.baseUrl}/i/api/graphql/${qId}/${opName}?variables=${encodeURIComponent(
          JSON.stringify(variables)
        )}&features=${encodeURIComponent(JSON.stringify(features))}`;

        const resp = await fetch(url, {
          method: 'GET',
          headers: headers,
          credentials: 'include'
        });

        if (resp.status === 401) throw new Error('Authentication expired (401). Please re-login.');
        if (resp.status === 429) throw new Error('Rate limit reached (429). Reset in 15 minutes.');
        if (resp.status === 404 || resp.status === 400) continue;
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

        const json = await resp.json();
        if (json.errors && json.errors.length > 0 && !json.data) {
          const msg = json.errors[0].message || '';
          if (msg.includes('Cannot find query') || msg.includes('not provided')) continue;
          throw new Error(msg);
        }

        return parseUserMediaResponse(json, options);
      } catch (err) {
        lastError = err;
        if (err.message.includes('401') || err.message.includes('429')) throw err;
      }
    }
  }

  throw lastError || new Error('Could not query Likes with available GraphQL query IDs.');
}

/**
 * Triggers ZIP download using dynamic file naming.
 */
async function triggerZipDownload(zipUint8Array, zipFilename, twitterHandle) {
  const cleanTwitterHandle = String(
    twitterHandle || jobState.handle || jobState.twitterHandle || 'Twitter'
  )
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9_]/g, '') || 'Twitter';

  const finalFilename = zipFilename || `${cleanTwitterHandle}_Media.zip`;
  currentDownloadFilename = finalFilename;

  // METHOD 1: Direct Service Worker Blob URL (Chrome 116+)
  let directBlobSuccess = false;
  try {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const zipBlob = new Blob([zipUint8Array], { type: 'application/zip' });
      const zipBlobUrl = URL.createObjectURL(zipBlob);

      await new Promise((resolve, reject) => {
        chrome.downloads.download(
          {
            url: zipBlobUrl,
            filename: finalFilename,
            conflictAction: 'uniquify',
            saveAs: true
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              currentDownloadId = downloadId;
              directBlobSuccess = true;
              setTimeout(() => {
                try { URL.revokeObjectURL(zipBlobUrl); } catch (e) {}
              }, 120000);
              resolve(downloadId);
            }
          }
        );
      });
    }
  } catch (err) {
    console.debug('[TwitterDownloader] Service worker direct blob URL not available, trying offscreen:', err);
  }

  if (directBlobSuccess) return;

  // METHOD 2: Offscreen Document with Transferable ArrayBuffer
  let offscreenSuccess = false;
  if (chrome.offscreen) {
    try {
      const existing = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      }).catch(() => []);

      if (existing.length === 0) {
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: ['BLOBS'],
          justification: 'Create Blob URL for single ZIP archive download'
        }).catch(() => {});
      }

      // Transfer raw ArrayBuffer efficiently (avoids Array.from RAM exhaustion)
      const res = await chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'DOWNLOAD_ZIP',
        zipBuffer: zipUint8Array.buffer,
        twitterHandle: cleanTwitterHandle,
        filename: finalFilename
      });

      if (res && res.ok) {
        offscreenSuccess = true;
        if (res.downloadId) currentDownloadId = res.downloadId;
      }
    } catch (e) {
      console.warn('[TwitterDownloader] Offscreen download failed, using Data URL fallback:', e);
    }
  }

  if (offscreenSuccess) return;

  // METHOD 3: Fallback Base64 Data URL with explicit filename
  let binary = '';
  const len = zipUint8Array.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      zipUint8Array.subarray(i, Math.min(i + chunkSize, len))
    );
  }
  const dataUrl = `data:application/zip;base64,${btoa(binary)}`;

  await new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: dataUrl,
        filename: finalFilename,
        conflictAction: 'uniquify',
        saveAs: true
      },
      (id) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          currentDownloadId = id;
          resolve(id);
        }
      }
    );
  });
}

/**
 * Concurrently buffers ALL selected media files into a single JSZip instance.
 */
async function bufferAllMediaIntoZip(mediaList, zip) {
  const CONCURRENT_FETCH = 5;
  let fetchIdx = 0;

  async function fetchWorker() {
    while (fetchIdx < mediaList.length && !abortRequested) {
      const item = mediaList[fetchIdx++];
      try {
        const resp = await fetch(item.originalUrl);
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          zip.file(item.filename, buffer);
          jobState.totalBuffered++;

          if (item.thumbnailUrl && !jobState.recentThumbnails.some((t) => t.id === item.id)) {
            jobState.recentThumbnails.unshift({
              id: item.id,
              url: item.thumbnailUrl,
              filename: item.filename,
              type: item.type
            });
            if (jobState.recentThumbnails.length > 8) jobState.recentThumbnails.pop();
          }

          const pct = Math.round((jobState.totalBuffered / mediaList.length) * 100);
          broadcastState(
            `Buffering media: ${jobState.totalBuffered}/${mediaList.length} (${pct}% in RAM)...`
          );
        }
      } catch (e) {
        console.warn(`Failed to buffer ${item.filename}:`, e);
      }
    }
  }

  const workers = [];
  for (let i = 0; i < CONCURRENT_FETCH; i++) workers.push(fetchWorker());
  await Promise.all(workers);
}

/**
 * MODE 1: Profile Downloader (Single ZIP Batching):
 * 1. Paginates through all pages in background, collecting all media items.
 * 2. Buffers ALL items into a single JSZip instance in memory.
 * 3. Generates one final [twitterHandle]_Media.zip archive.
 * 4. Triggers ONE single download prompt with dynamic file naming.
 */
async function startExtractionJob(twitterHandle, existingUserId, userOptions, avatarUrl = '') {
  abortRequested = false;

  const cleanTwitterHandle = String(twitterHandle || jobState.handle || 'Twitter')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^a-zA-Z0-9_]/g, '') || 'Twitter';

  const options = Object.assign(
    {
      includeImages: true,
      includeVideos: true,
      includeReposts: true,
      maxLimitEnabled: false,
      maxLimitCount: 100
    },
    userOptions
  );

  jobState = {
    jobType: 'profile',
    status: 'resolving',
    handle: cleanTwitterHandle,
    twitterHandle: cleanTwitterHandle,
    backupFilename: `${cleanTwitterHandle}_Media.zip`,
    userId: existingUserId || '',
    avatarUrl: avatarUrl || jobState.avatarUrl || '',
    totalFound: 0,
    totalImages: 0,
    totalVideos: 0,
    totalBuffered: 0,
    zipProgress: 0,
    pagesFetched: 0,
    currentCursor: null,
    recentThumbnails: [],
    errorMessage: null,
    logMessage: 'Extracting active session credentials...'
  };
  broadcastState();

  try {
    const session = await extractSessionCookies();
    if (!session.ct0) throw new Error("Missing 'ct0' CSRF cookie. Please log into Twitter/X.");
    if (!session.authToken) throw new Error("Missing 'auth_token' cookie. Please log into Twitter/X.");

    if (!jobState.userId) {
      jobState.userId = await resolveUserId(cleanTwitterHandle, session);
    }

    jobState.status = 'fetching';
    broadcastState(`Authenticated as active session. Scanning media for @${cleanTwitterHandle}...`);

    let cursor = null;
    let previousCursor = null;
    const seenMediaUrls = new Set();
    const allMedia = [];
    let hasMorePages = true;

    // STEP 1: Scan all pages using GraphQL pagination
    while (hasMorePages && !abortRequested) {
      if (jobState.status === 'paused') {
        broadcastState('Job paused by user.');
        return;
      }

      jobState.pagesFetched++;
      broadcastState(`Scanning page ${jobState.pagesFetched}... (${allMedia.length} media found)`);

      const pageResult = await fetchUserMediaPage(jobState.userId, cursor, session, options);

      let newOnPage = 0;
      for (const item of pageResult.mediaItems) {
        if (!seenMediaUrls.has(item.originalUrl)) {
          seenMediaUrls.add(item.originalUrl);
          allMedia.push(item);
          newOnPage++;

          if (item.type === 'image') jobState.totalImages++;
          else if (item.type === 'video') jobState.totalVideos++;

          if (options.maxLimitEnabled && allMedia.length >= options.maxLimitCount) {
            break;
          }
        }
      }

      jobState.totalFound = allMedia.length;
      cursor = pageResult.nextCursor;
      jobState.currentCursor = cursor;

      broadcastState(
        `Page ${jobState.pagesFetched}: Found ${newOnPage} media (Total: ${allMedia.length} | Images: ${jobState.totalImages}, Videos: ${jobState.totalVideos})`
      );

      // Early break if max limit reached
      if (options.maxLimitEnabled && allMedia.length >= options.maxLimitCount) {
        broadcastState(
          `Reached max limit of ${options.maxLimitCount} items. Preparing download...`
        );
        hasMorePages = false;
        break;
      }

      if (!cursor || cursor === previousCursor || cursor.startsWith('0|')) {
        hasMorePages = false;
        break;
      }
      if (newOnPage === 0 && pageResult.mediaItems.length === 0) {
        hasMorePages = false;
        break;
      }

      previousCursor = cursor;
      await new Promise((r) => setTimeout(r, 650));
    }

    if (options.maxLimitEnabled && allMedia.length > options.maxLimitCount) {
      allMedia.length = options.maxLimitCount;
      jobState.totalFound = allMedia.length;
      jobState.totalImages = allMedia.filter((m) => m.type === 'image').length;
      jobState.totalVideos = allMedia.filter((m) => m.type === 'video').length;
    }

    if (abortRequested) {
      jobState.status = 'idle';
      broadcastState('Job cancelled.');
      return;
    }

    if (allMedia.length === 0) {
      jobState.status = 'completed';
      broadcastState(`Scan complete: No matching media found for @${cleanTwitterHandle} with current filters.`);
      return;
    }

    // STEP 2: Buffer ALL media files into single JSZip instance
    const zip = new JSZip();
    jobState.status = 'buffering';
    broadcastState(`Buffering all ${allMedia.length} media files into RAM...`);

    await bufferAllMediaIntoZip(allMedia, zip);

    if (abortRequested) {
      zip.clear();
      jobState.status = 'idle';
      broadcastState('Job cancelled.');
      return;
    }

    // STEP 3: Generate single final ZIP file
    jobState.status = 'zipping';
    broadcastState('Zipping all media into final archive...');

    const zipBytes = await zip.generateAsync({ type: 'uint8array' }, (progress) => {
      jobState.zipProgress = progress.percent;
      broadcastState(
        `Compressing ZIP: ${progress.percent}% (${progress.currentIndex}/${progress.total})`
      );
    });

    zip.clear(); // Free memory

    // STEP 4: Trigger ONE single download dynamically named [twitterHandle]_Media.zip
    const zipFilename = `${cleanTwitterHandle}_Media.zip`;

    broadcastState(`Downloading ${zipFilename}...`);
    await triggerZipDownload(zipBytes, zipFilename, cleanTwitterHandle);

    jobState.status = 'completed';
    broadcastState(
      `Done! Downloaded ${jobState.totalBuffered} files in single '${zipFilename}' (Images: ${jobState.totalImages}, Videos: ${jobState.totalVideos})`
    );
  } catch (err) {
    console.error('[TwitterDownloader] Job failed:', err);
    jobState.status = 'error';
    jobState.errorMessage = err.message;
    broadcastState(`Error: ${err.message}`);
  }
}

/**
 * MODE 2: Independent Account Backup (Bookmarks & Likes):
 * 1. Fetches personal media from Bookmarks and/or Likes GraphQL endpoints.
 * 2. Buffers ALL items into a single JSZip instance in memory.
 * 3. Generates one final My_Account_Backup.zip (or [handle]_Backup.zip) archive.
 * 4. Triggers ONE single download prompt with dynamic file naming.
 */
async function startBackupJob(userOptions) {
  abortRequested = false;

  const options = Object.assign(
    {
      backupBookmarks: true,
      backupLikes: true,
      includeImages: true,
      includeVideos: true,
      maxLimitEnabled: false,
      maxLimitCount: 100
    },
    userOptions
  );

  jobState = {
    jobType: 'backup',
    status: 'resolving',
    handle: 'My_Account',
    twitterHandle: 'My_Account',
    backupFilename: 'My_Account_Backup.zip',
    userId: '',
    avatarUrl: jobState.avatarUrl || '',
    totalFound: 0,
    totalImages: 0,
    totalVideos: 0,
    totalBuffered: 0,
    zipProgress: 0,
    pagesFetched: 0,
    currentCursor: null,
    recentThumbnails: [],
    errorMessage: null,
    logMessage: 'Authenticating private session for account backup...'
  };
  broadcastState();

  try {
    const session = await extractSessionCookies();
    if (!session.ct0) throw new Error("Missing 'ct0' CSRF cookie. Please log into Twitter/X.");
    if (!session.authToken) throw new Error("Missing 'auth_token' cookie. Please log into Twitter/X.");

    // Resolve authenticated account user profile
    const authUser = await getAuthenticatedUser(session);
    if (authUser.userId) jobState.userId = authUser.userId;
    if (authUser.screenName) {
      jobState.handle = authUser.screenName;
      jobState.twitterHandle = authUser.screenName;
    }
    if (authUser.avatarUrl && !jobState.avatarUrl) {
      jobState.avatarUrl = authUser.avatarUrl;
    }

    const seenMediaUrls = new Set();
    const allMedia = [];

    // STEP 1: BACKUP BOOKMARKS
    if (options.backupBookmarks && !abortRequested) {
      jobState.status = 'fetching';
      broadcastState('Fetching Bookmarks media...');

      let cursor = null;
      let prevCursor = null;
      let hasMore = true;
      let bmPages = 0;

      while (hasMore && !abortRequested) {
        bmPages++;
        jobState.pagesFetched++;
        broadcastState(`Scanning Bookmarks page ${bmPages}... (${allMedia.length} media found)`);

        const pageResult = await fetchBookmarksPage(cursor, session, options);
        let newCount = 0;
        for (const item of pageResult.mediaItems) {
          if (!seenMediaUrls.has(item.originalUrl)) {
            seenMediaUrls.add(item.originalUrl);
            item.filename = `Bookmarks_${item.filename}`;
            allMedia.push(item);
            newCount++;

            if (item.type === 'image') jobState.totalImages++;
            else if (item.type === 'video') jobState.totalVideos++;

            if (options.maxLimitEnabled && allMedia.length >= options.maxLimitCount) {
              break;
            }
          }
        }

        jobState.totalFound = allMedia.length;
        cursor = pageResult.nextCursor;
        jobState.currentCursor = cursor;

        broadcastState(
          `Bookmarks Page ${bmPages}: Found ${newCount} media (Total: ${allMedia.length})`
        );

        if (options.maxLimitEnabled && allMedia.length >= options.maxLimitCount) {
          hasMore = false;
          break;
        }

        if (!cursor || cursor === prevCursor || cursor.startsWith('0|')) {
          hasMore = false;
          break;
        }
        if (newCount === 0 && pageResult.mediaItems.length === 0) {
          hasMore = false;
          break;
        }

        prevCursor = cursor;
        await new Promise((r) => setTimeout(r, 650));
      }
    }

    // STEP 2: BACKUP LIKES
    if (
      options.backupLikes &&
      !abortRequested &&
      (!options.maxLimitEnabled || allMedia.length < options.maxLimitCount)
    ) {
      if (!jobState.userId) {
        broadcastState('Resolving authenticated user ID for Likes backup...');
        const user = await getAuthenticatedUser(session);
        if (user.userId) jobState.userId = user.userId;
      }

      if (!jobState.userId) {
        throw new Error('Unable to resolve user ID for Liked tweets. Please refresh Twitter/X tab.');
      }

      jobState.status = 'fetching';
      broadcastState(`Fetching Liked tweets media for user ID ${jobState.userId}...`);

      let cursor = null;
      let prevCursor = null;
      let hasMore = true;
      let likePages = 0;

      while (hasMore && !abortRequested) {
        likePages++;
        jobState.pagesFetched++;
        broadcastState(`Scanning Likes page ${likePages}... (${allMedia.length} media found)`);

        const pageResult = await fetchLikesPage(jobState.userId, cursor, session, options);
        let newCount = 0;
        for (const item of pageResult.mediaItems) {
          if (!seenMediaUrls.has(item.originalUrl)) {
            seenMediaUrls.add(item.originalUrl);
            item.filename = `Likes_${item.filename}`;
            allMedia.push(item);
            newCount++;

            if (item.type === 'image') jobState.totalImages++;
            else if (item.type === 'video') jobState.totalVideos++;

            if (options.maxLimitEnabled && allMedia.length >= options.maxLimitCount) {
              break;
            }
          }
        }

        jobState.totalFound = allMedia.length;
        cursor = pageResult.nextCursor;
        jobState.currentCursor = cursor;

        broadcastState(
          `Likes Page ${likePages}: Found ${newCount} media (Total: ${allMedia.length})`
        );

        if (options.maxLimitEnabled && allMedia.length >= options.maxLimitCount) {
          hasMore = false;
          break;
        }

        if (!cursor || cursor === prevCursor || cursor.startsWith('0|')) {
          hasMore = false;
          break;
        }
        if (newCount === 0 && pageResult.mediaItems.length === 0) {
          hasMore = false;
          break;
        }

        prevCursor = cursor;
        await new Promise((r) => setTimeout(r, 650));
      }
    }

    if (options.maxLimitEnabled && allMedia.length > options.maxLimitCount) {
      allMedia.length = options.maxLimitCount;
      jobState.totalFound = allMedia.length;
      jobState.totalImages = allMedia.filter((m) => m.type === 'image').length;
      jobState.totalVideos = allMedia.filter((m) => m.type === 'video').length;
    }

    if (abortRequested) {
      jobState.status = 'idle';
      broadcastState('Backup cancelled.');
      return;
    }

    if (allMedia.length === 0) {
      jobState.status = 'completed';
      broadcastState('Backup complete: No media found in selected collections (Bookmarks / Likes).');
      return;
    }

    // STEP 3: Buffer ALL media into single JSZip
    const zip = new JSZip();
    jobState.status = 'buffering';
    broadcastState(`Buffering all ${allMedia.length} backup media files into RAM...`);

    await bufferAllMediaIntoZip(allMedia, zip);

    if (abortRequested) {
      zip.clear();
      jobState.status = 'idle';
      broadcastState('Backup cancelled.');
      return;
    }

    // STEP 4: Generate single final ZIP file
    jobState.status = 'zipping';
    broadcastState('Zipping all backup media into final archive...');

    const zipBytes = await zip.generateAsync({ type: 'uint8array' }, (progress) => {
      jobState.zipProgress = progress.percent;
      broadcastState(
        `Compressing Backup ZIP: ${progress.percent}% (${progress.currentIndex}/${progress.total})`
      );
    });

    zip.clear();

    // STEP 5: Trigger ONE single download dynamically named My_Account_Backup.zip
    const cleanHandle = String(jobState.handle || 'My_Account')
      .replace(/^@+/, '')
      .replace(/[^a-zA-Z0-9_]/g, '');
    const backupFilename = cleanHandle && cleanHandle !== 'My_Account'
      ? `${cleanHandle}_Backup.zip`
      : 'My_Account_Backup.zip';
    jobState.backupFilename = backupFilename;

    broadcastState(`Downloading ${backupFilename}...`);
    await triggerZipDownload(zipBytes, backupFilename, cleanHandle);

    jobState.status = 'completed';
    broadcastState(
      `Done! Backed up ${jobState.totalBuffered} files in single '${backupFilename}' (Images: ${jobState.totalImages}, Videos: ${jobState.totalVideos})`
    );
  } catch (err) {
    console.error('[TwitterDownloader] Backup failed:', err);
    jobState.status = 'error';
    jobState.errorMessage = err.message;
    broadcastState(`Backup Error: ${err.message}`);
  }
}

// Runtime message handler for popup commands
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_JOB') {
    const targetHandle = message.twitterHandle || message.handle || 'Twitter';
    startExtractionJob(targetHandle, message.userId, message.options, message.avatarUrl);
    sendResponse({ ok: true });
    return true;
  }
  if (message.action === 'START_BACKUP_JOB') {
    startBackupJob(message.options);
    sendResponse({ ok: true });
    return true;
  }
  if (message.action === 'CANCEL_JOB') {
    abortRequested = true;
    jobState.status = 'idle';
    broadcastState('Job cancelled');
    sendResponse({ ok: true });
    return true;
  }
  if (message.action === 'GET_STATE') {
    sendResponse({ state: jobState });
    return true;
  }
  if (message.action === 'STORE_INTERCEPTED_CREDENTIALS') {
    if (message.payload?.queryIds) {
      dynamicConfig.queryIds = { ...dynamicConfig.queryIds, ...message.payload.queryIds };
    }
    if (message.payload?.features) {
      dynamicConfig.features = message.payload.features;
    }
    sendResponse({ ok: true });
    return true;
  }
});
