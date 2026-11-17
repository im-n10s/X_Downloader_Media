/**
 * inject.js - Runs in the MAIN world context on twitter.com and x.com.
 * Intercepts network calls and accesses Webpack module cache to extract
 * active session credentials, Bearer tokens, CSRF tokens, and GraphQL query IDs.
 */

(function () {
  'use strict';

  // Prevent double injection
  if (window.__TWITTER_MEDIA_DOWNLOADER_INJECTED__) return;
  window.__TWITTER_MEDIA_DOWNLOADER_INJECTED__ = true;

  const sessionStore = {
    bearerToken: null,
    csrfToken: null,
    clientTransactionId: null,
    activeUser: null,
    queryIds: {},
    features: null
  };

  function notifyContentScript(type, data) {
    try {
      window.postMessage(
        {
          source: 'TWITTER_IMAGE_DOWNLOADER_INJECT',
          type: type || 'CREDENTIALS_INTERCEPTED',
          data: data || sessionStore
        },
        '*'
      );
    } catch (err) {
      // Ignore cross-origin posting issues
    }
  }

  // 1. Webpack Module Cache Scanner
  // Scans Twitter's responsive web Webpack chunk cache to discover current GraphQL query IDs
  function scanWebpackCache() {
    try {
      if (!window.webpackChunk_twitter_responsive_web) return;

      window.webpackChunk_twitter_responsive_web.push([
        [['__twitter_image_downloader_probe_' + Date.now()]],
        {},
        function (webpackRequire) {
          if (!webpackRequire || !webpackRequire.c) return;
          const cache = webpackRequire.c;
          for (const key in cache) {
            const mod = cache[key];
            if (!mod || !mod.exports) continue;

            const candidates = [mod.exports, mod.exports?.default].filter(
              (o) => o && typeof o === 'object'
            );

            for (const item of candidates) {
              if (item.operationName && item.queryId) {
                sessionStore.queryIds[item.operationName] = item.queryId;
                if (item.metadata?.featureSwitches && !sessionStore.features) {
                  // Captured feature switch list if available
                  sessionStore.featuresMetadata = item.metadata.featureSwitches;
                }
              }
            }
          }
        }
      ]);

      if (Object.keys(sessionStore.queryIds).length > 0) {
        notifyContentScript('WEBPACK_QUERIES_DISCOVERED', sessionStore);
      }
    } catch (err) {
      console.debug('[TwitterDownloader] Webpack cache scan error:', err);
    }
  }

  // 2. Fetch Interceptor
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    try {
      const resource = args[0];
      const config = args[1] || {};
      const url = typeof resource === 'string' ? resource : resource?.url;

      if (url && (url.includes('/i/api/') || url.includes('/graphql/'))) {
        inspectHeadersAndUrl(url, config.headers);
      }
    } catch (e) {
      // Pass-through
    }
    return originalFetch.apply(this, args);
  };

  // 3. XMLHttpRequest Interceptor
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__reqUrl = url;
    this.__reqHeaders = {};
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
    if (this.__reqHeaders) {
      this.__reqHeaders[header.toLowerCase()] = value;
      if (
        this.__reqUrl &&
        (this.__reqUrl.includes('/i/api/') || this.__reqUrl.includes('/graphql/'))
      ) {
        inspectHeadersAndUrl(this.__reqUrl, this.__reqHeaders);
      }
    }
    return originalSetRequestHeader.call(this, header, value);
  };

  // Helper to extract credentials, query IDs, and features from requests
  function inspectHeadersAndUrl(urlStr, headers) {
    let updated = false;

    // Normalize headers
    let headerObj = {};
    if (headers) {
      if (headers instanceof Headers) {
        headers.forEach((val, key) => {
          headerObj[key.toLowerCase()] = val;
        });
      } else if (typeof headers === 'object') {
        for (const k in headers) {
          headerObj[k.toLowerCase()] = headers[k];
        }
      }
    }

    if (headerObj['authorization'] && headerObj['authorization'].startsWith('Bearer ')) {
      if (sessionStore.bearerToken !== headerObj['authorization']) {
        sessionStore.bearerToken = headerObj['authorization'];
        updated = true;
      }
    }

    if (headerObj['x-csrf-token']) {
      if (sessionStore.csrfToken !== headerObj['x-csrf-token']) {
        sessionStore.csrfToken = headerObj['x-csrf-token'];
        updated = true;
      }
    }

    if (headerObj['x-client-transaction-id']) {
      sessionStore.clientTransactionId = headerObj['x-client-transaction-id'];
    }

    if (headerObj['x-twitter-active-user']) {
      sessionStore.activeUser = headerObj['x-twitter-active-user'];
    }

    // Parse URL for GraphQL query info
    try {
      const match = urlStr.match(/\/i\/api\/graphql\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/);
      if (match) {
        const queryId = match[1];
        const operationName = match[2];
        if (sessionStore.queryIds[operationName] !== queryId) {
          sessionStore.queryIds[operationName] = queryId;
          updated = true;
        }

        const urlObj = new URL(urlStr, window.location.origin);
        const featuresParam = urlObj.searchParams.get('features');
        if (featuresParam && !sessionStore.features) {
          try {
            sessionStore.features = JSON.parse(featuresParam);
            updated = true;
          } catch (e) {}
        }
      }
    } catch (e) {}

    if (updated) {
      notifyContentScript('CREDENTIALS_INTERCEPTED', sessionStore);
    }
  }

  // Listen for manual requests from isolated content script
  window.addEventListener('message', (event) => {
    if (
      event.data &&
      event.data.source === 'TWITTER_IMAGE_DOWNLOADER_CONTENT' &&
      event.data.action === 'REQUEST_CREDENTIALS_AND_QUERIES'
    ) {
      scanWebpackCache();
      notifyContentScript('CREDENTIALS_INTERCEPTED', sessionStore);
    }
  });

  // Attempt initial cache scan after document loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(scanWebpackCache, 1500);
    });
  } else {
    setTimeout(scanWebpackCache, 1000);
  }
})();
