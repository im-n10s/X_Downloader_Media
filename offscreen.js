/**
 * offscreen.js - Creates Blob URLs in offscreen DOM context
 * to download generated ZIP archive with dynamic file naming.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen' && message.action === 'DOWNLOAD_ZIP') {
    try {
      const rawBuffer = message.zipBuffer || message.zipData;
      const uint8Array = rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer);
      const blob = new Blob([uint8Array], { type: 'application/zip' });
      const blobUrl = URL.createObjectURL(blob);

      const downloadFilename =
        message.filename ||
        `${String(message.twitterHandle || 'Twitter').replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '') || 'Twitter'}_Media.zip`;

      chrome.downloads.download(
        {
          url: blobUrl,
          filename: downloadFilename,
          conflictAction: 'uniquify',
          saveAs: true
        },
        (downloadId) => {
          setTimeout(() => {
            try {
              URL.revokeObjectURL(blobUrl);
            } catch (e) {}
          }, 120000);

          if (chrome.runtime.lastError) {
            // Secondary DOM fallback: create an anchor element with the download attribute
            try {
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = downloadFilename;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => {
                try {
                  document.body.removeChild(a);
                } catch (e) {}
              }, 30000);
              sendResponse({ ok: true });
            } catch (anchorErr) {
              sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            }
          } else {
            sendResponse({ ok: true, downloadId });
          }
        }
      );
      return true;
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
      return true;
    }
  }
});
