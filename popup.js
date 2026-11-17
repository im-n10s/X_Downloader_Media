/**
 * popup.js - Manages user interactions in "X Downloader Media",
 * supports Profile Media archiver and Backup Data (My Account) features,
 * connects to active tab, renders dynamic user avatar, manages media filters & max limit,
 * and tracks in-memory single-ZIP batch progress.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - Mode Switching
  const tabProfile = document.getElementById('tabProfile');
  const tabBackup = document.getElementById('tabBackup');
  const profileSection = document.getElementById('profileSection');
  const backupSection = document.getElementById('backupSection');

  // DOM Elements - Profile Section
  const targetHandleEl = document.getElementById('targetHandle');
  const targetUserIdEl = document.getElementById('targetUserId');
  const statusBadgeEl = document.getElementById('statusBadge');
  const profileAvatarImg = document.getElementById('profileAvatarImg');
  const profileAvatarFallback = document.getElementById('profileAvatarFallback');
  const notOnTwitterBanner = document.getElementById('notOnTwitterBanner');

  // DOM Elements - Backup Section
  const toggleBackupBookmarks = document.getElementById('toggleBackupBookmarks');
  const toggleBackupLikes = document.getElementById('toggleBackupLikes');

  // DOM Elements - Progress & Stats (Shared)
  const statusMessageEl = document.getElementById('statusMessage');
  const progressPercentageEl = document.getElementById('progressPercentage');
  const progressBarEl = document.getElementById('progressBar');
  const spinnerIcon = document.getElementById('spinnerIcon');
  const statTotalEl = document.getElementById('statTotal');
  const statImagesEl = document.getElementById('statImages');
  const statVideosEl = document.getElementById('statVideos');

  // DOM Elements - Media Selection & Limit (Shared)
  const toggleImages = document.getElementById('toggleImages');
  const toggleVideos = document.getElementById('toggleVideos');
  const toggleReposts = document.getElementById('toggleReposts');
  const toggleLimit = document.getElementById('toggleLimit');
  const limitInput = document.getElementById('limitInput');

  // DOM Elements - Previews & Actions
  const previewSection = document.getElementById('previewSection');
  const previewCountEl = document.getElementById('previewCount');
  const thumbnailGrid = document.getElementById('thumbnailGrid');
  const btnDownload = document.getElementById('btnDownload');
  const btnStartBackup = document.getElementById('btnStartBackup');
  const btnCancel = document.getElementById('btnCancel');
  const destFolderText = document.getElementById('destFolderText');

  // DOM Elements - Creator & Footer Actions
  const linkFollowX = document.getElementById('linkFollowX');
  const linkGithub = document.getElementById('linkGithub');
  const btnDonateUsdt = document.getElementById('btnDonateUsdt');
  const supportBtnText = document.getElementById('supportBtnText');
  const copyBadgeText = document.getElementById('copyBadgeText');

  let activeHandle = null;
  let activeUserId = null;
  let activeAvatarUrl = null;
  let isJobRunning = false;
  let currentMode = 'profile'; // 'profile' | 'backup'

  /**
   * Renders the dynamic avatar with fallback handling.
   */
  function renderAvatar(avatarUrl) {
    if (avatarUrl) {
      activeAvatarUrl = avatarUrl;
      profileAvatarImg.src = avatarUrl;
      profileAvatarImg.onload = () => {
        profileAvatarImg.classList.remove('hidden');
        profileAvatarFallback.classList.add('hidden');
      };
      profileAvatarImg.onerror = () => {
        profileAvatarImg.classList.add('hidden');
        profileAvatarFallback.classList.remove('hidden');
      };
    } else {
      profileAvatarImg.classList.add('hidden');
      profileAvatarFallback.classList.remove('hidden');
    }
  }

  /**
   * Tab Switching: Profile Media vs Account Backup
   */
  function switchMode(mode) {
    currentMode = mode;
    chrome.storage.local.set({ activeMode: mode });

    if (mode === 'profile') {
      tabProfile.classList.add('active');
      tabBackup.classList.remove('active');
      profileSection.classList.remove('hidden');
      backupSection.classList.add('hidden');

      if (!isJobRunning) {
        btnDownload.classList.remove('hidden');
        btnStartBackup.classList.add('hidden');
        destFolderText.textContent = activeHandle
          ? `Target: ${activeHandle}_Media.zip (1 Prompt)`
          : 'Target: [Handle]_Media.zip (1 Prompt)';
        validateFilterSelection();
      }
    } else {
      tabBackup.classList.add('active');
      tabProfile.classList.remove('active');
      backupSection.classList.remove('hidden');
      profileSection.classList.add('hidden');

      if (!isJobRunning) {
        btnStartBackup.classList.remove('hidden');
        btnDownload.classList.add('hidden');
        destFolderText.textContent = 'Target: My_Account_Backup.zip (1 Prompt)';
        validateBackupSelection();
      }
    }
  }

  tabProfile.addEventListener('click', () => switchMode('profile'));
  tabBackup.addEventListener('click', () => switchMode('backup'));

  // Restore saved options
  chrome.storage.local.get(['userFilters', 'backupOptions', 'activeMode'], (res) => {
    if (res.userFilters) {
      if (typeof res.userFilters.includeImages === 'boolean') {
        toggleImages.checked = res.userFilters.includeImages;
      }
      if (typeof res.userFilters.includeVideos === 'boolean') {
        toggleVideos.checked = res.userFilters.includeVideos;
      }
      if (typeof res.userFilters.includeReposts === 'boolean') {
        toggleReposts.checked = res.userFilters.includeReposts;
      }
      if (typeof res.userFilters.maxLimitEnabled === 'boolean') {
        toggleLimit.checked = res.userFilters.maxLimitEnabled;
        limitInput.disabled = !toggleLimit.checked;
      }
      if (res.userFilters.maxLimitCount) {
        limitInput.value = res.userFilters.maxLimitCount;
      }
    }
    if (res.backupOptions) {
      if (typeof res.backupOptions.backupBookmarks === 'boolean') {
        toggleBackupBookmarks.checked = res.backupOptions.backupBookmarks;
      }
      if (typeof res.backupOptions.backupLikes === 'boolean') {
        toggleBackupLikes.checked = res.backupOptions.backupLikes;
      }
    }
    if (res.activeMode === 'backup') {
      switchMode('backup');
    } else {
      switchMode('profile');
    }
  });

  function saveFilters() {
    const parsedLimit = parseInt(limitInput.value, 10);
    chrome.storage.local.set({
      userFilters: {
        includeImages: toggleImages.checked,
        includeVideos: toggleVideos.checked,
        includeReposts: toggleReposts.checked,
        maxLimitEnabled: toggleLimit.checked,
        maxLimitCount: isNaN(parsedLimit) || parsedLimit <= 0 ? 100 : parsedLimit
      }
    });
    if (currentMode === 'profile') validateFilterSelection();
  }

  function saveBackupOptions() {
    chrome.storage.local.set({
      backupOptions: {
        backupBookmarks: toggleBackupBookmarks.checked,
        backupLikes: toggleBackupLikes.checked
      }
    });
    if (currentMode === 'backup') validateBackupSelection();
  }

  toggleImages.addEventListener('change', saveFilters);
  toggleVideos.addEventListener('change', saveFilters);
  toggleReposts.addEventListener('change', saveFilters);
  toggleLimit.addEventListener('change', () => {
    limitInput.disabled = !toggleLimit.checked;
    saveFilters();
  });
  limitInput.addEventListener('input', () => {
    saveFilters();
  });

  toggleBackupBookmarks.addEventListener('change', saveBackupOptions);
  toggleBackupLikes.addEventListener('change', saveBackupOptions);

  function validateFilterSelection() {
    if (!toggleImages.checked && !toggleVideos.checked) {
      btnDownload.disabled = true;
      statusMessageEl.textContent = 'Select at least Images or Videos to download.';
    } else if (activeHandle && !isJobRunning) {
      btnDownload.disabled = false;
      statusMessageEl.textContent = 'Ready to archive';
    }
  }

  function validateBackupSelection() {
    if (!toggleBackupBookmarks.checked && !toggleBackupLikes.checked) {
      btnStartBackup.disabled = true;
      statusMessageEl.textContent = 'Select at least Bookmarks or Likes to back up.';
    } else if (!isJobRunning) {
      btnStartBackup.disabled = false;
      statusMessageEl.textContent = 'Ready to archive account backup';
    }
  }

  // "Follow me on X" handler (securely opens new tab in MV3)
  if (linkFollowX) {
    linkFollowX.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://x.com/n10s_exe' });
    });
  }

  // GitHub profile link handler (securely opens new tab in MV3)
  if (linkGithub) {
    linkGithub.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://github.com/im-n10s' });
    });
  }

  // Developer Support: Click-to-copy USDT (TRC20) wallet address
  const USDT_TRC20_WALLET = 'TEQFQ3yZejzivZ8u2rVUp1QKQCzAgrEtjk';
  if (btnDonateUsdt && supportBtnText) {
    let copyTimeout = null;
    btnDonateUsdt.addEventListener('click', async (e) => {
      e.preventDefault();

      // 1. Copy to clipboard via standard API or fallback
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(USDT_TRC20_WALLET);
        } else {
          throw new Error('Clipboard API not available');
        }
      } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = USDT_TRC20_WALLET;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      // 2. Visual feedback state
      btnDonateUsdt.classList.add('copied');
      supportBtnText.textContent = 'Address Copied! (TRC20)';
      if (copyBadgeText) copyBadgeText.textContent = '✓ Copied';

      // 3. Revert after 2 seconds
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        btnDonateUsdt.classList.remove('copied');
        supportBtnText.textContent = 'Support Dev (USDT TRC20)';
        if (copyBadgeText) copyBadgeText.textContent = 'Copy';
      }, 2000);
    });
  }

  // 1. Initial State Sync with Service Worker
  try {
    const bgResponse = await chrome.runtime.sendMessage({ action: 'GET_STATE' });
    if (bgResponse && bgResponse.state) {
      applyJobState(bgResponse.state);
    }
  } catch (err) {
    console.debug('[Popup] Error syncing with background state:', err);
  }

  // 2. Query Active Tab for Profile Context
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      setNotOnTwitterState();
      return;
    }

    const isTwitterUrl = tab.url.includes('twitter.com') || tab.url.includes('x.com');
    if (!isTwitterUrl) {
      setNotOnTwitterState();
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_INFO' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        targetHandleEl.textContent = 'Please refresh tab';
        targetUserIdEl.textContent = 'Extension reloaded; refresh tab to connect';
        statusBadgeEl.textContent = 'Reload Tab';
        statusBadgeEl.className = 'status-badge badge-idle';
        btnDownload.disabled = true;
        return;
      }

      if (response.isProfile && response.handle) {
        activeHandle = String(response.handle).replace(/^@+/, '').trim();
        activeUserId = response.userId;

        targetHandleEl.textContent = `@${activeHandle}`;
        targetUserIdEl.textContent = activeUserId ? `ID: ${activeUserId}` : 'Resolving ID via API...';
        if (currentMode === 'profile') {
          destFolderText.textContent = `Target: ${activeHandle}_Media.zip (1 Prompt)`;
        }

        // Dynamic High-Resolution Avatar
        if (response.avatarUrl) {
          renderAvatar(response.avatarUrl);
        }

        if (!isJobRunning && currentMode === 'profile') {
          statusBadgeEl.textContent = 'Profile Ready';
          statusBadgeEl.className = 'status-badge badge-ready';
          validateFilterSelection();
        }
      } else {
        setNotOnProfileState();
      }
    });
  } catch (err) {
    console.error('[Popup] Error inspecting active tab:', err);
  }

  function setNotOnTwitterState() {
    notOnTwitterBanner.classList.remove('hidden');
    targetHandleEl.textContent = 'No Profile Detected';
    targetUserIdEl.textContent = 'Open x.com or twitter.com';
    statusBadgeEl.textContent = 'Inactive';
    statusBadgeEl.className = 'status-badge badge-idle';
    btnDownload.disabled = true;
    renderAvatar(null);
  }

  function setNotOnProfileState() {
    notOnTwitterBanner.classList.remove('hidden');
    targetHandleEl.textContent = 'Timeline / Feed';
    targetUserIdEl.textContent = 'Open an individual profile (e.g. x.com/NASA)';
    statusBadgeEl.textContent = 'Not a Profile';
    statusBadgeEl.className = 'status-badge badge-idle';
    btnDownload.disabled = true;
    renderAvatar(null);
  }

  // 3. UI State Renderer
  function applyJobState(state) {
    if (!state) return;

    // Handle job type awareness
    const isBackupJob = state.jobType === 'backup';
    if (isBackupJob && isJobRunning && currentMode !== 'backup') {
      switchMode('backup');
    }

    if (state.handle && !activeHandle && !isBackupJob) {
      activeHandle = state.handle;
      targetHandleEl.textContent = `@${activeHandle}`;
      if (currentMode === 'profile') {
        destFolderText.textContent = `Target: ${activeHandle}_Media.zip (1 Prompt)`;
      }
    }

    if (state.userId && !activeUserId && !isBackupJob) {
      activeUserId = state.userId;
      targetUserIdEl.textContent = `ID: ${activeUserId}`;
    }

    if (isBackupJob) {
      destFolderText.textContent = `Target: ${state.backupFilename || 'My_Account_Backup.zip'} (1 Prompt)`;
    } else if (activeHandle && currentMode === 'profile') {
      destFolderText.textContent = `Target: ${activeHandle}_Media.zip (1 Prompt)`;
    }

    // Dynamic Avatar from State
    if (state.avatarUrl && (!activeAvatarUrl || profileAvatarImg.classList.contains('hidden'))) {
      renderAvatar(state.avatarUrl);
    }

    statTotalEl.textContent = state.totalFound || 0;
    statImagesEl.textContent = state.totalImages || 0;
    statVideosEl.textContent = state.totalVideos || 0;

    statusMessageEl.textContent = state.logMessage || 'Ready to archive';

    // Disable filter toggles & limit input while job is actively running
    toggleImages.disabled = isJobRunning;
    toggleVideos.disabled = isJobRunning;
    toggleReposts.disabled = isJobRunning;
    toggleLimit.disabled = isJobRunning;
    limitInput.disabled = isJobRunning || !toggleLimit.checked;
    toggleBackupBookmarks.disabled = isJobRunning;
    toggleBackupLikes.disabled = isJobRunning;

    switch (state.status) {
      case 'resolving':
      case 'fetching':
        isJobRunning = true;
        spinnerIcon.classList.remove('hidden');
        btnDownload.classList.add('hidden');
        btnStartBackup.classList.add('hidden');
        btnCancel.classList.remove('hidden');
        statusBadgeEl.textContent = isBackupJob ? 'Scanning Backup' : 'Scanning API';
        statusBadgeEl.className = 'status-badge badge-active';
        progressBarEl.classList.add('animated-stripes');
        progressBarEl.style.width = '25%';
        progressPercentageEl.textContent = 'Scanning...';
        break;

      case 'buffering':
        isJobRunning = true;
        spinnerIcon.classList.remove('hidden');
        btnDownload.classList.add('hidden');
        btnStartBackup.classList.add('hidden');
        btnCancel.classList.remove('hidden');
        statusBadgeEl.textContent = 'Buffering';
        statusBadgeEl.className = 'status-badge badge-active';
        progressBarEl.classList.add('animated-stripes');

        if (state.totalFound > 0) {
          const bufPct = Math.min(
            90,
            Math.round((state.totalBuffered / Math.max(state.totalFound, 1)) * 90)
          );
          progressBarEl.style.width = `${Math.max(15, bufPct)}%`;
          progressPercentageEl.textContent = `${bufPct}%`;
        }
        break;

      case 'zipping':
        isJobRunning = true;
        spinnerIcon.classList.remove('hidden');
        btnDownload.classList.add('hidden');
        btnStartBackup.classList.add('hidden');
        btnCancel.classList.remove('hidden');
        statusBadgeEl.textContent = 'Zipping Media';
        statusBadgeEl.className = 'status-badge badge-active';

        const zipPct = state.zipProgress || 50;
        progressBarEl.classList.add('animated-stripes');
        progressBarEl.style.width = `${Math.min(100, Math.max(30, zipPct))}%`;
        progressPercentageEl.textContent = `${zipPct}%`;
        break;

      case 'completed':
        isJobRunning = false;
        spinnerIcon.classList.add('hidden');
        btnCancel.classList.add('hidden');
        if (currentMode === 'backup') {
          btnStartBackup.classList.remove('hidden');
          btnDownload.classList.add('hidden');
          validateBackupSelection();
        } else {
          btnDownload.classList.remove('hidden');
          btnStartBackup.classList.add('hidden');
          validateFilterSelection();
        }
        statusBadgeEl.textContent = 'Complete';
        statusBadgeEl.className = 'status-badge badge-complete';
        progressBarEl.classList.remove('animated-stripes');
        progressBarEl.style.width = '100%';
        progressPercentageEl.textContent = '100%';
        break;

      case 'error':
        isJobRunning = false;
        spinnerIcon.classList.add('hidden');
        btnCancel.classList.add('hidden');
        if (currentMode === 'backup') {
          btnStartBackup.classList.remove('hidden');
          btnDownload.classList.add('hidden');
          validateBackupSelection();
        } else {
          btnDownload.classList.remove('hidden');
          btnStartBackup.classList.add('hidden');
          validateFilterSelection();
        }
        statusBadgeEl.textContent = 'Error';
        statusBadgeEl.className = 'status-badge badge-error';
        progressBarEl.classList.remove('animated-stripes');
        break;

      case 'idle':
      default:
        isJobRunning = false;
        spinnerIcon.classList.add('hidden');
        btnCancel.classList.add('hidden');
        if (currentMode === 'backup') {
          btnStartBackup.classList.remove('hidden');
          btnDownload.classList.add('hidden');
          validateBackupSelection();
        } else {
          btnDownload.classList.remove('hidden');
          btnStartBackup.classList.add('hidden');
          if (activeHandle) {
            statusBadgeEl.textContent = 'Profile Ready';
            statusBadgeEl.className = 'status-badge badge-ready';
            validateFilterSelection();
          }
        }
        progressBarEl.classList.remove('animated-stripes');
        progressBarEl.style.width = '0%';
        progressPercentageEl.textContent = '0%';
        break;
    }

    // Render Recent Thumbnails
    if (state.recentThumbnails && state.recentThumbnails.length > 0) {
      previewSection.classList.remove('hidden');
      previewCountEl.textContent = `${state.recentThumbnails.length} buffered`;

      const currentIds = Array.from(thumbnailGrid.querySelectorAll('.thumb-item')).map(
        (el) => el.dataset.id
      );
      const newIds = state.recentThumbnails.map((t) => t.id);

      if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
        thumbnailGrid.innerHTML = '';
        state.recentThumbnails.forEach((item) => {
          const thumbDiv = document.createElement('div');
          thumbDiv.className = 'thumb-item';
          thumbDiv.dataset.id = item.id;
          thumbDiv.title = item.filename;

          const img = document.createElement('img');
          img.src = item.url;
          img.alt = item.filename;
          img.loading = 'lazy';

          thumbDiv.appendChild(img);

          if (item.type === 'video') {
            const badge = document.createElement('span');
            badge.className = 'thumb-badge-video';
            badge.textContent = 'MP4';
            thumbDiv.appendChild(badge);
          }

          thumbnailGrid.appendChild(thumbDiv);
        });
      }
    }
  }

  // 4. Live Message Listener
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'JOB_STATE_UPDATE' && message.state) {
      applyJobState(message.state);
    }
  });

  // 5. Action Click Handlers
  btnDownload.addEventListener('click', () => {
    if (!activeHandle) return;

    btnDownload.disabled = true;
    const cleanTwitterHandle = String(activeHandle).replace(/^@+/, '').trim();
    const parsedLimit = parseInt(limitInput.value, 10);
    const userOptions = {
      includeImages: toggleImages.checked,
      includeVideos: toggleVideos.checked,
      includeReposts: toggleReposts.checked,
      maxLimitEnabled: toggleLimit.checked,
      maxLimitCount: isNaN(parsedLimit) || parsedLimit <= 0 ? 100 : parsedLimit
    };

    chrome.runtime.sendMessage(
      {
        action: 'START_JOB',
        twitterHandle: cleanTwitterHandle,
        handle: cleanTwitterHandle,
        userId: activeUserId,
        avatarUrl: activeAvatarUrl,
        options: userOptions
      },
      () => {
        btnDownload.disabled = false;
      }
    );
  });

  btnStartBackup.addEventListener('click', () => {
    if (!toggleBackupBookmarks.checked && !toggleBackupLikes.checked) return;

    btnStartBackup.disabled = true;
    const parsedLimit = parseInt(limitInput.value, 10);
    const backupOptions = {
      backupBookmarks: toggleBackupBookmarks.checked,
      backupLikes: toggleBackupLikes.checked,
      includeImages: toggleImages.checked,
      includeVideos: toggleVideos.checked,
      maxLimitEnabled: toggleLimit.checked,
      maxLimitCount: isNaN(parsedLimit) || parsedLimit <= 0 ? 100 : parsedLimit
    };

    chrome.runtime.sendMessage(
      {
        action: 'START_BACKUP_JOB',
        options: backupOptions
      },
      () => {
        btnStartBackup.disabled = false;
      }
    );
  });

  btnCancel.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'CANCEL_JOB' });
  });
});
