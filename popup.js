/**
 * popup.js - Manages user interactions in "X Downloader Media",
 * supports Profile Media archiver, Backup Data (My Account) features,
 * multilingual Arabic/English localization (i18n) with instant RTL switching,
 * connects to active tab, renders dynamic user avatar, manages media filters & max limit,
 * and tracks in-memory single-ZIP batch progress.
 */

const TRANSLATIONS = {
  en: {
    appSubtitle: 'High-speed in-memory media archiver',
    langSwitchText: 'AR',
    tabProfile: 'Profile Media',
    tabBackup: 'Backup (My Account)',
    detectingProfile: 'Detecting profile...',
    checking: 'Checking',
    scanningTab: 'Scanning active tab context',
    profileReady: 'Profile Ready',
    reloadTab: 'Reload Tab',
    notOnTwitter: 'Open x.com or twitter.com',
    noProfileDetected: 'No Profile Detected',
    inactive: 'Inactive',
    timelineFeed: 'Timeline / Feed',
    notAProfile: 'Not a Profile',
    openProfilePrompt: 'Open an individual profile (e.g. x.com/NASA)',
    profileRequiredTitle: 'Profile required',
    profileRequiredDesc: 'Navigate to any Twitter/X profile (e.g. <code>x.com/NASA</code>) to archive media.',
    pleaseRefreshTab: 'Please refresh tab',
    extensionReloadedNotice: 'Extension reloaded; refresh tab to connect',
    resolvingIdViaApi: 'Resolving ID via API...',
    mediaSelectionTitle: 'MEDIA SELECTION',
    mediaSelectionHint: 'Custom Extraction Filters',
    toggleImagesName: 'Images',
    toggleImagesSub: 'Original Quality',
    toggleVideosName: 'Videos',
    toggleVideosSub: 'Highest Bitrate MP4',
    toggleRepostsName: 'Include Reposts',
    toggleRepostsSub: 'Retweeted Media',
    toggleLimitName: 'Max Media Limit',
    toggleLimitSub: 'Cap items to extract',
    backupTitle: 'Backup Data (My Account)',
    badgeBackup: 'Private Session',
    backupSub: 'Archive all media from your personal Bookmarks & Likes',
    backupSourcesTitle: 'BACKUP SOURCES',
    backupSourcesHint: 'Personal Media Collections',
    toggleBookmarksName: 'Backup Bookmarks',
    toggleBookmarksSub: 'Saved Bookmarks Media',
    toggleLikesName: 'Backup Likes',
    toggleLikesSub: 'Liked Tweets Media',
    statusReady: 'Ready to archive',
    statusReadyBackup: 'Ready to archive account backup',
    statusScanningApi: 'Scanning API',
    statusScanningBackup: 'Scanning Backup',
    statusBuffering: 'Buffering',
    statusZipping: 'Zipping Media',
    statusComplete: 'Complete',
    statusError: 'Error',
    statTotal: 'Total Media',
    statImages: 'Images',
    statVideos: 'Videos',
    recentBuffered: 'Recent Media Buffered',
    itemsCountSuffix: 'buffered',
    btnDownload: 'Download Media (Single ZIP)',
    btnStartBackup: 'Start Backup (Single ZIP)',
    btnCancel: 'Cancel Operation',
    targetPrefix: 'Target:',
    onePromptSuffix: '(1 Prompt)',
    featureTag: 'Original Photos • Highest Bitrate MP4 • In-Memory Single Batch',
    creatorText: 'Created with ❤️ By n10s_exe',
    btnFollow: 'Follow',
    btnGithub: 'GitHub',
    btnSupportDev: 'Support Dev (BNB Smart Chain)',
    btnCopy: 'Copy',
    btnAddressCopied: 'Address Copied! (BEP20)',
    btnCopiedPill: '✓ Copied',
    errSelectMedia: 'Select at least Images or Videos to download.',
    errSelectBackup: 'Select at least Bookmarks or Likes to back up.'
  },
  ar: {
    appSubtitle: 'مؤرشف وسائط فائق السرعة في الذاكرة',
    langSwitchText: 'EN',
    tabProfile: 'وسائط الملف الشخصي',
    tabBackup: 'نسخ احتياطي (حسابي)',
    detectingProfile: 'جاري اكتشاف الملف الشخصي...',
    checking: 'فحص',
    scanningTab: 'جاري فحص التبويب النشط',
    profileReady: 'الملف جاهز',
    reloadTab: 'أعد تحميل التبويب',
    notOnTwitter: 'افتح x.com أو twitter.com',
    noProfileDetected: 'لم يتم العثور على ملف شخصي',
    inactive: 'غير نشط',
    timelineFeed: 'الجدول الزمني / الخلاصات',
    notAProfile: 'ليس ملفاً شخصياً',
    openProfilePrompt: 'افتح ملفاً شخصياً مستقلاً (مثل x.com/NASA)',
    profileRequiredTitle: 'الملف الشخصي مطلوب',
    profileRequiredDesc: 'انتقل إلى أي ملف شخصي على تويتر/X (مثل <code>x.com/NASA</code>) لأرشفة وسائطه.',
    pleaseRefreshTab: 'يرجى تحديث التبويب',
    extensionReloadedNotice: 'تمت إعادة تحميل الإضافة؛ حدّث التبويب للاتصال',
    resolvingIdViaApi: 'جاري جلب المعرّف من API...',
    mediaSelectionTitle: 'تحديد الوسائط',
    mediaSelectionHint: 'فلاتر الاستخراج المخصصة',
    toggleImagesName: 'الصور',
    toggleImagesSub: 'الجودة الأصلية',
    toggleVideosName: 'الفيديوهات',
    toggleVideosSub: 'أعلى معدل بت MP4',
    toggleRepostsName: 'تضمين إعادات النشر',
    toggleRepostsSub: 'وسائط التغريدات المعاد نشرها',
    toggleLimitName: 'حد الوسائط الأقصى',
    toggleLimitSub: 'تحديد أقصى عدد للاستخراج',
    backupTitle: 'نسخ احتياطي للبيانات (حسابي)',
    badgeBackup: 'جلسة خاصة',
    backupSub: 'أرشفة كافة الوسائط من الإشارات المرجعية والإعجابات الخاصة بك',
    backupSourcesTitle: 'مصادر النسخ الاحتياطي',
    backupSourcesHint: 'مجموعات الوسائط الشخصية',
    toggleBookmarksName: 'نسخ الإشارات المرجعية',
    toggleBookmarksSub: 'وسائط الإشارات المحفوظة',
    toggleLikesName: 'نسخ الإعجابات',
    toggleLikesSub: 'وسائط التغريدات المعجب بها',
    statusReady: 'جاهز للأرشفة',
    statusReadyBackup: 'جاهز لأرشفة النسخة الاحتياطية للحساب',
    statusScanningApi: 'جاري فحص API...',
    statusScanningBackup: 'جاري فحص النسخ الاحتياطي...',
    statusBuffering: 'جاري التخزين المؤقت',
    statusZipping: 'جاري ضغط الوسائط',
    statusComplete: 'اكتمل بنجاح',
    statusError: 'حدث خطأ',
    statTotal: 'إجمالي الوسائط',
    statImages: 'الصور',
    statVideos: 'الفيديوهات',
    recentBuffered: 'الوسائط المخزنة مؤخراً',
    itemsCountSuffix: 'عنصر مخزن',
    btnDownload: 'تحميل الوسائط (ملف ZIP موحد)',
    btnStartBackup: 'بدء النسخ الاحتياطي (ملف ZIP موحد)',
    btnCancel: 'إلغاء العملية',
    targetPrefix: 'الهدف:',
    onePromptSuffix: '(إشعار حفظ واحد)',
    featureTag: 'صور أصلية • أعلى جودة MP4 • حزمة موحدة في الذاكرة',
    creatorText: 'صُنع بـ ❤️ بواسطة n10s_exe',
    btnFollow: 'متابعة',
    btnGithub: 'جيت هاب',
    btnSupportDev: 'دعم المطور (BNB Smart Chain)',
    btnCopy: 'نسخ',
    btnAddressCopied: 'تم نسخ العنوان! (BEP20)',
    btnCopiedPill: '✓ تم النسخ',
    errSelectMedia: 'يرجى تحديد الصور أو الفيديوهات على الأقل للتحميل.',
    errSelectBackup: 'يرجى تحديد الإشارات المرجعية أو الإعجابات على الأقل للنسخ الاحتياطي.'
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - Theme Switcher
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const themeIconSun = document.querySelector('.theme-icon-sun');
  const themeIconMoon = document.querySelector('.theme-icon-moon');
  let currentTheme = 'dark'; // 'dark' | 'light'

  // DOM Elements - Language Switcher
  const btnLangToggle = document.getElementById('btnLangToggle');
  const langSwitchText = document.getElementById('langSwitchText');

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
  const backupAvatarImg = document.getElementById('backupAvatarImg');
  const backupAvatarFallback = document.getElementById('backupAvatarFallback');

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
  const btnDonateBnb = document.getElementById('btnDonateBnb') || document.getElementById('btnDonateUsdt');
  const supportBtnText = document.getElementById('supportBtnText');
  const copyBadgeText = document.getElementById('copyBadgeText');

  let activeHandle = null;
  let activeUserId = null;
  let activeAvatarUrl = null;
  let loggedInAvatarUrl = null;
  let isJobRunning = false;
  let currentMode = 'profile'; // 'profile' | 'backup'
  let currentLang = 'en';     // 'en' | 'ar'
  let latestJobState = null;

  /**
   * Helper to fetch translated text by key.
   */
  function t(key) {
    return TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS['en']?.[key] || key;
  }

  /**
   * Formats dynamic ZIP filename with LTR isolation in RTL modes.
   */
  function formatDestText(zipName) {
    if (currentLang === 'ar') {
      return `${t('targetPrefix')} <span dir="ltr" class="ltr-isolated">${zipName}</span> ${t('onePromptSuffix')}`;
    }
    return `${t('targetPrefix')} ${zipName} ${t('onePromptSuffix')}`;
  }

  function updateDestFolderText() {
    if (currentMode === 'backup') {
      const name = latestJobState?.backupFilename || 'My_Account_Backup.zip';
      destFolderText.innerHTML = formatDestText(name);
    } else {
      const name = activeHandle ? `${activeHandle}_Media.zip` : '[Handle]_Media.zip';
      destFolderText.innerHTML = formatDestText(name);
    }
  }

  /**
   * Sets active language, toggles RTL layout, and updates all translated elements.
   */
  function setLanguage(lang) {
    currentLang = lang === 'ar' ? 'ar' : 'en';
    chrome.storage.local.set({ userLanguage: currentLang });

    // 1. Flip DOM direction and language attribute
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;

    // 2. Update language switcher button text
    if (langSwitchText) {
      langSwitchText.textContent = t('langSwitchText');
    }

    // 3. Translate all static data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) {
        el.textContent = TRANSLATIONS[currentLang][key];
      }
    });

    // 4. Translate all HTML data-i18n-html attributes
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) {
        el.innerHTML = TRANSLATIONS[currentLang][key];
      }
    });

    // 5. Update dynamic destination text
    updateDestFolderText();

    // 6. Update dynamic state messages
    if (latestJobState) {
      applyJobState(latestJobState);
    } else {
      if (currentMode === 'backup') {
        validateBackupSelection();
      } else {
        validateFilterSelection();
      }
    }

    // 7. Update theme button tooltip
    if (btnThemeToggle) {
      btnThemeToggle.title = currentLang === 'ar'
        ? (currentTheme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي')
        : (currentTheme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode');
    }
  }

  /**
   * Sets active theme ('dark' | 'light'), persists it, and toggles icons.
   */
  function setTheme(theme) {
    currentTheme = theme === 'light' ? 'light' : 'dark';
    chrome.storage.local.set({ userTheme: currentTheme });
    document.documentElement.setAttribute('data-theme', currentTheme);

    if (themeIconSun && themeIconMoon) {
      if (currentTheme === 'dark') {
        themeIconSun.classList.remove('hidden');
        themeIconMoon.classList.add('hidden');
        if (btnThemeToggle) {
          btnThemeToggle.title = currentLang === 'ar' ? 'التبديل إلى الوضع النهاري' : 'Switch to Light mode';
        }
      } else {
        themeIconSun.classList.add('hidden');
        themeIconMoon.classList.remove('hidden');
        if (btnThemeToggle) {
          btnThemeToggle.title = currentLang === 'ar' ? 'التبديل إلى الوضع الليلي' : 'Switch to Dark mode';
        }
      }
    }
  }

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  }

  if (btnLangToggle) {
    btnLangToggle.addEventListener('click', () => {
      const nextLang = currentLang === 'en' ? 'ar' : 'en';
      setLanguage(nextLang);
    });
  }

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
   * Renders the logged-in user avatar in the Backup card with fallback handling.
   */
  function renderBackupAvatar(avatarUrl) {
    if (!backupAvatarImg || !backupAvatarFallback) return;

    if (avatarUrl) {
      loggedInAvatarUrl = avatarUrl;
      backupAvatarImg.src = avatarUrl;
      backupAvatarImg.style.display = 'block';
      backupAvatarFallback.style.display = 'none';
      backupAvatarImg.classList.remove('hidden');
      backupAvatarFallback.classList.add('hidden');

      backupAvatarImg.onload = () => {
        backupAvatarImg.style.display = 'block';
        backupAvatarFallback.style.display = 'none';
        backupAvatarImg.classList.remove('hidden');
        backupAvatarFallback.classList.add('hidden');
      };
      backupAvatarImg.onerror = () => {
        backupAvatarImg.style.display = 'none';
        backupAvatarFallback.style.display = 'flex';
        backupAvatarImg.classList.add('hidden');
        backupAvatarFallback.classList.remove('hidden');
      };
    } else {
      backupAvatarImg.style.display = 'none';
      backupAvatarFallback.style.display = 'flex';
      backupAvatarImg.classList.add('hidden');
      backupAvatarFallback.classList.remove('hidden');
    }
  }

  /**
   * Fetches logged-in user profile with 2-step approach:
   * 1. Primary: Instant DOM extraction from active tab or any open Twitter tab
   * 2. Fallback: Background REST API (/i/api/1.1/account/verify_credentials.json)
   */
  function fetchLoggedInUser() {
    // 1. Check local storage cache first
    chrome.storage.local.get(['cachedMyAvatar'], (cacheRes) => {
      if (cacheRes?.cachedMyAvatar) {
        renderBackupAvatar(cacheRes.cachedMyAvatar);
      }

      // Step 1: Query the active tab for DOM avatar
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs?.[0];
        if (activeTab && activeTab.id) {
          chrome.tabs.sendMessage(activeTab.id, { action: 'GET_PAGE_INFO' }, (info) => {
            if (!chrome.runtime.lastError && info?.loggedInAvatarUrl) {
              renderBackupAvatar(info.loggedInAvatarUrl);
              chrome.storage.local.set({ cachedMyAvatar: info.loggedInAvatarUrl });
              return;
            }

            // If active tab is not Twitter or didn't have it, query any open x.com / twitter.com tab
            chrome.tabs.query({ url: ['*://*.x.com/*', '*://*.twitter.com/*'] }, (xTabs) => {
              if (xTabs && xTabs.length > 0) {
                let domFound = false;
                for (const t of xTabs) {
                  chrome.tabs.sendMessage(t.id, { action: 'GET_LOGGED_IN_USER_DOM' }, (domRes) => {
                    if (!chrome.runtime.lastError && domRes?.loggedInAvatarUrl && !domFound) {
                      domFound = true;
                      renderBackupAvatar(domRes.loggedInAvatarUrl);
                      chrome.storage.local.set({ cachedMyAvatar: domRes.loggedInAvatarUrl });
                    }
                  });
                }
              }

              // Step 2: Fallback to background REST API
              chrome.runtime.sendMessage({ action: 'GET_LOGGED_IN_USER' }, (res) => {
                if (chrome.runtime.lastError) return;
                if (res && res.ok && res.user && res.user.avatarUrl) {
                  renderBackupAvatar(res.user.avatarUrl);
                  chrome.storage.local.set({ cachedMyAvatar: res.user.avatarUrl });
                }
              });
            });
          });
          return;
        }

        // Direct fallback to background
        chrome.runtime.sendMessage({ action: 'GET_LOGGED_IN_USER' }, (res) => {
          if (chrome.runtime.lastError) return;
          if (res && res.ok && res.user && res.user.avatarUrl) {
            renderBackupAvatar(res.user.avatarUrl);
            chrome.storage.local.set({ cachedMyAvatar: res.user.avatarUrl });
          }
        });
      });
    });
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
        updateDestFolderText();
        validateFilterSelection();
      }
    } else {
      tabBackup.classList.add('active');
      tabProfile.classList.remove('active');
      backupSection.classList.remove('hidden');
      profileSection.classList.add('hidden');

      fetchLoggedInUser();

      if (!isJobRunning) {
        btnStartBackup.classList.remove('hidden');
        btnDownload.classList.add('hidden');
        updateDestFolderText();
        validateBackupSelection();
      }
    }
  }

  tabProfile.addEventListener('click', () => switchMode('profile'));
  tabBackup.addEventListener('click', () => switchMode('backup'));

  // Restore saved options, language & theme
  chrome.storage.local.get(
    ['userTheme', 'userLanguage', 'userFilters', 'backupOptions', 'activeMode', 'cachedMyAvatar'],
    (res) => {
      // 0. Instant logged-in avatar restoration from cache
      if (res.cachedMyAvatar) {
        renderBackupAvatar(res.cachedMyAvatar);
      }

      // 1. Theme restoration
      setTheme(res.userTheme || 'dark');

      // 2. Language restoration
      if (res.userLanguage === 'ar') {
        setLanguage('ar');
      } else {
        setLanguage('en');
      }

      // 3. User filters
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

      // 3. Backup options
      if (res.backupOptions) {
        if (typeof res.backupOptions.backupBookmarks === 'boolean') {
          toggleBackupBookmarks.checked = res.backupOptions.backupBookmarks;
        }
        if (typeof res.backupOptions.backupLikes === 'boolean') {
          toggleBackupLikes.checked = res.backupOptions.backupLikes;
        }
      }

      // 4. Active mode tab
      if (res.activeMode === 'backup') {
        switchMode('backup');
      } else {
        switchMode('profile');
      }

      // 5. Fetch logged-in user profile for Backup card
      fetchLoggedInUser();
    }
  );

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
      statusMessageEl.textContent = t('errSelectMedia');
    } else if (activeHandle && !isJobRunning) {
      btnDownload.disabled = false;
      statusMessageEl.textContent = t('statusReady');
    }
  }

  function validateBackupSelection() {
    if (!toggleBackupBookmarks.checked && !toggleBackupLikes.checked) {
      btnStartBackup.disabled = true;
      statusMessageEl.textContent = t('errSelectBackup');
    } else if (!isJobRunning) {
      btnStartBackup.disabled = false;
      statusMessageEl.textContent = t('statusReadyBackup');
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

  // Developer Support: Click-to-copy BNB Smart Chain (BEP20) wallet address
  const BNB_BEP20_WALLET = '0x6D6637cbea1618AeBc626Bb3eBFa623fD55639C1';
  if (btnDonateBnb && supportBtnText) {
    let copyTimeout = null;
    btnDonateBnb.addEventListener('click', async (e) => {
      e.preventDefault();

      // 1. Copy to clipboard via standard API or fallback
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(BNB_BEP20_WALLET);
        } else {
          throw new Error('Clipboard API not available');
        }
      } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = BNB_BEP20_WALLET;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      // 2. Visual feedback state
      btnDonateBnb.classList.add('copied');
      supportBtnText.textContent = t('btnAddressCopied');
      if (copyBadgeText) copyBadgeText.textContent = t('btnCopiedPill');

      // 3. Revert after 2 seconds
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        btnDonateBnb.classList.remove('copied');
        supportBtnText.textContent = t('btnSupportDev');
        if (copyBadgeText) copyBadgeText.textContent = t('btnCopy');
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
        targetHandleEl.textContent = t('pleaseRefreshTab');
        targetUserIdEl.textContent = t('extensionReloadedNotice');
        statusBadgeEl.textContent = t('reloadTab');
        statusBadgeEl.className = 'status-badge badge-idle';
        btnDownload.disabled = true;
        return;
      }

      // Check logged-in user avatar extracted from DOM
      if (response.loggedInAvatarUrl) {
        renderBackupAvatar(response.loggedInAvatarUrl);
        chrome.storage.local.set({ cachedMyAvatar: response.loggedInAvatarUrl });
      }

      if (response.isProfile && response.handle) {
        activeHandle = String(response.handle).replace(/^@+/, '').trim();
        activeUserId = response.userId;

        targetHandleEl.textContent = `@${activeHandle}`;
        targetUserIdEl.textContent = activeUserId ? `ID: ${activeUserId}` : t('resolvingIdViaApi');
        updateDestFolderText();

        // Dynamic High-Resolution Avatar
        if (response.avatarUrl) {
          renderAvatar(response.avatarUrl);
        }

        if (!isJobRunning && currentMode === 'profile') {
          statusBadgeEl.textContent = t('profileReady');
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
    targetHandleEl.textContent = t('noProfileDetected');
    targetUserIdEl.textContent = t('notOnTwitter');
    statusBadgeEl.textContent = t('inactive');
    statusBadgeEl.className = 'status-badge badge-idle';
    btnDownload.disabled = true;
    renderAvatar(null);
  }

  function setNotOnProfileState() {
    notOnTwitterBanner.classList.remove('hidden');
    targetHandleEl.textContent = t('timelineFeed');
    targetUserIdEl.textContent = t('openProfilePrompt');
    statusBadgeEl.textContent = t('notAProfile');
    statusBadgeEl.className = 'status-badge badge-idle';
    btnDownload.disabled = true;
    renderAvatar(null);
  }

  // 3. UI State Renderer
  function applyJobState(state) {
    if (!state) return;
    latestJobState = state;

    // Handle job type awareness
    const isBackupJob = state.jobType === 'backup';
    if (isBackupJob && isJobRunning && currentMode !== 'backup') {
      switchMode('backup');
    }

    if (state.handle && !activeHandle && !isBackupJob) {
      activeHandle = state.handle;
      targetHandleEl.textContent = `@${activeHandle}`;
    }

    if (state.userId && !activeUserId && !isBackupJob) {
      activeUserId = state.userId;
      targetUserIdEl.textContent = `ID: ${activeUserId}`;
    }

    updateDestFolderText();

    // Dynamic Avatar from State
    if (state.avatarUrl && (!activeAvatarUrl || profileAvatarImg.classList.contains('hidden')) && !isBackupJob) {
      renderAvatar(state.avatarUrl);
    }
    if (isBackupJob && state.avatarUrl) {
      renderBackupAvatar(state.avatarUrl);
    }

    statTotalEl.textContent = state.totalFound || 0;
    statImagesEl.textContent = state.totalImages || 0;
    statVideosEl.textContent = state.totalVideos || 0;

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
        statusBadgeEl.textContent = isBackupJob ? t('statusScanningBackup') : t('statusScanningApi');
        statusBadgeEl.className = 'status-badge badge-active';
        progressBarEl.classList.add('animated-stripes');
        progressBarEl.style.width = '25%';
        progressPercentageEl.textContent = currentLang === 'ar' ? 'جاري الفحص...' : 'Scanning...';
        statusMessageEl.textContent =
          currentLang === 'ar'
            ? `جاري فحص الوسائط... (تم العثور على ${state.totalFound || 0})`
            : state.logMessage || 'Scanning media...';
        break;

      case 'buffering':
        isJobRunning = true;
        spinnerIcon.classList.remove('hidden');
        btnDownload.classList.add('hidden');
        btnStartBackup.classList.add('hidden');
        btnCancel.classList.remove('hidden');
        statusBadgeEl.textContent = t('statusBuffering');
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
        statusMessageEl.textContent =
          currentLang === 'ar'
            ? `جاري تخزين الوسائط في الذاكرة: ${state.totalBuffered || 0}/${state.totalFound || 0}...`
            : state.logMessage || 'Buffering media...';
        break;

      case 'zipping':
        isJobRunning = true;
        spinnerIcon.classList.remove('hidden');
        btnDownload.classList.add('hidden');
        btnStartBackup.classList.add('hidden');
        btnCancel.classList.remove('hidden');
        statusBadgeEl.textContent = t('statusZipping');
        statusBadgeEl.className = 'status-badge badge-active';

        const zipPct = state.zipProgress || 50;
        progressBarEl.classList.add('animated-stripes');
        progressBarEl.style.width = `${Math.min(100, Math.max(30, zipPct))}%`;
        progressPercentageEl.textContent = `${zipPct}%`;
        statusMessageEl.textContent =
          currentLang === 'ar'
            ? `جاري ضغط ملفات الوسائط: ${zipPct}%...`
            : state.logMessage || 'Compressing archive...';
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
        statusBadgeEl.textContent = t('statusComplete');
        statusBadgeEl.className = 'status-badge badge-complete';
        progressBarEl.classList.remove('animated-stripes');
        progressBarEl.style.width = '100%';
        progressPercentageEl.textContent = '100%';
        statusMessageEl.textContent =
          currentLang === 'ar'
            ? `اكتمل! تم تجهيز ${state.totalBuffered || state.totalFound || 0} ملف في ملف ZIP موحد`
            : state.logMessage || 'Complete!';
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
        statusBadgeEl.textContent = t('statusError');
        statusBadgeEl.className = 'status-badge badge-error';
        progressBarEl.classList.remove('animated-stripes');
        statusMessageEl.textContent =
          currentLang === 'ar'
            ? `خطأ: ${state.errorMessage || 'فشلت العملية'}`
            : state.logMessage || 'Error occurred';
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
            statusBadgeEl.textContent = t('profileReady');
            statusBadgeEl.className = 'status-badge badge-ready';
            validateFilterSelection();
          }
        }
        progressBarEl.classList.remove('animated-stripes');
        progressBarEl.style.width = '0%';
        progressPercentageEl.textContent = '0%';
        statusMessageEl.textContent = currentMode === 'backup' ? t('statusReadyBackup') : t('statusReady');
        break;
    }

    // Render Recent Thumbnails
    if (state.recentThumbnails && state.recentThumbnails.length > 0) {
      previewSection.classList.remove('hidden');
      previewCountEl.textContent = `${state.recentThumbnails.length} ${t('itemsCountSuffix')}`;

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
            badge.className = 'thumb-badge-video ltr-isolated';
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
