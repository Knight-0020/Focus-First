// Focus First Background Service Worker
// Handles: tab tracking, Focus Mode, notifications, alarms
// Refactored for Manifest V3 stability and persistence

// Import IndexedDB helper functions
importScripts('db.js');

// Constants for storage keys
const KEY_FOCUS_SESSION = 'currentFocusSession';
const KEY_STOPWATCH = 'stopwatchState';
const KEY_TAB_PREFIX = 'tab_timestamp_';

// Initialize on extension install/startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Focus First installed');
  initializeDB();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Focus First browser startup');
  initializeDB();
  // We don't need loadFocusSessionState logic here anymore because we load it on-demand
  // or via alarm triggers, but we can do a sanity check if needed.
  verifySessionIntegrity();
});

// Initialize IndexedDB
async function initializeDB() {
  try {
    await openDB();
    console.log('IndexedDB initialized');
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
  }
}

// --- STATE MANAGEMENT HELPERS ---

// Helper to get current focus session from local storage
async function getStoredFocusSession() {
  const result = await chrome.storage.local.get([KEY_FOCUS_SESSION]);
  return result[KEY_FOCUS_SESSION] || null;
}

// Helper to set current focus session
async function setStoredFocusSession(session) {
  if (session) {
    await chrome.storage.local.set({ [KEY_FOCUS_SESSION]: session });
  } else {
    await chrome.storage.local.remove([KEY_FOCUS_SESSION]);
  }
}

// Helper to get tab start time from session storage
async function getTabStartTime(tabId) {
  try {
    const key = KEY_TAB_PREFIX + tabId;
    const result = await chrome.storage.session.get([key]);
    return result[key] || null;
  } catch (e) {
    // Session storage might not be available in some contexts, fallback gracefully
    return null;
  }
}

// Helper to set tab start time
async function setTabStartTime(tabId, data) {
  try {
    const key = KEY_TAB_PREFIX + tabId;
    await chrome.storage.session.set({ [key]: data });
  } catch (e) {
    console.error("Storage session error", e);
  }
}

// Helper to remove tab start time
async function removeTabStartTime(tabId) {
  try {
    const key = KEY_TAB_PREFIX + tabId;
    await chrome.storage.session.remove([key]);
  } catch (e) {
    // ignore
  }
}

// Helper: Verify session and complete if time passed (handles missed alarms)
async function verifySessionIntegrity() {
  const session = await getStoredFocusSession();
  if (session && session.status === 'active') {
    const now = Date.now();
    const endTime = session.startTime + (session.plannedDuration * 60 * 1000);
    if (now >= endTime) {
      console.log('Session found expired during integrity check, completing...');
      await completeFocusSession(session.id);
    }
  }
}

// --- TAB TRACKING ---

// Tab tracking: Record when a tab is created or updated
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url) {
    trackTabOpen(tab.id, tab.url);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Tab finished loading, track it
    trackTabOpen(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  trackTabClose(tabId);
});

// Track tab open: record domain and timestamp in STORAGE
async function trackTabOpen(tabId, url) {
  try {
    const domain = extractDomain(url);
    if (!domain) return;

    const now = Date.now();

    // If tab was already tracked, close the previous entry first
    const existing = await getTabStartTime(tabId);
    if (existing) {
      await trackTabClose(tabId);
    }

    // Record new tab in session storage
    await setTabStartTime(tabId, {
      domain: domain,
      openedAt: now
    });

    // Check if in Focus Mode and domain is in blocklist
    const session = await getStoredFocusSession();
    if (session && session.status === 'active') {
      await checkDistraction(domain, tabId);
    }
  } catch (error) {
    console.error('Error tracking tab open:', error);
  }
}

// Track tab close: calculate time spent and save to IndexedDB
async function trackTabClose(tabId) {
  try {
    const tabData = await getTabStartTime(tabId);
    if (!tabData) return;

    const now = Date.now();
    const timeSpent = now - tabData.openedAt;
    const domain = tabData.domain;

    // Remove from storage
    await removeTabStartTime(tabId);

    // Save to IndexedDB
    await saveDomainStat(domain, timeSpent);

  } catch (error) {
    console.error('Error tracking tab close:', error);
  }
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    return null;
  }
}

// --- FOCUS MODE LOGIC ---

// Check if domain is distracting during Focus Mode
async function checkDistraction(domain, tabId) {
  try {
    const settings = await getSettings();
    const blocklist = settings.blocklist || [];

    if (blocklist.includes(domain)) {
      // Show notification
      showDistractionNotification(domain, tabId);
    }
  } catch (error) {
    console.error('Error checking distraction:', error);
  }
}

// Show distraction notification
function showDistractionNotification(domain, tabId) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Focus Mode Active',
    message: `You're in Focus Mode and opened ${domain}. Stay focused!`,
    buttons: [
      { title: 'Stay Focused (Close Tab)' },
      { title: 'Continue' }
    ],
    requireInteraction: true
  }, (notificationId) => {
    // Store notification ID with domain AND tabId for button click handling
    // Using local storage to persist this mapping if needed
    chrome.storage.local.set({
      [`notification_${notificationId}`]: { domain, tabId }
    });
  });
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  chrome.notifications.clear(notificationId);

  const key = `notification_${notificationId}`;
  const result = await chrome.storage.local.get([key]);
  const data = result[key];
  if (!data) return; // Notification data lost or expired

  const { domain, tabId } = data;
  await chrome.storage.local.remove([key]);

  if (buttonIndex === 0) {
    // User clicked "Stay Focused" - CLOSE THE TAB
    if (tabId) {
      chrome.tabs.remove(tabId).catch(err => console.log("Tab already closed or invalid", err));
    }
  } else if (buttonIndex === 1) {
    // User clicked "Continue" - log as distraction
    await logDistraction(domain);

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Distraction Logged',
      message: `Okay, continuing. This will be logged as a distraction.`
    });
  }
});

// Log distraction to current focus session
async function logDistraction(domain) {
  try {
    const currentFocusSession = await getStoredFocusSession();
    if (!currentFocusSession) return;

    const db = await openDB();
    const transaction = db.transaction(['focusSessions'], 'readwrite');
    const store = transaction.objectStore('focusSessions');

    const request = store.get(currentFocusSession.id);
    request.onsuccess = () => {
      const session = request.result;
      if (session) {
        session.distractionCount = (session.distractionCount || 0) + 1;
        if (!session.distractions) {
          session.distractions = [];
        }
        session.distractions.push({
          domain: domain,
          timestamp: Date.now()
        });
        store.put(session);
        // Update stored session as well to keep counts in sync (optional but good)
        setStoredFocusSession(session);
      }
    };
  } catch (error) {
    console.error('Error logging distraction:', error);
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startFocusMode') {
    startFocusMode(request.duration).then(sendResponse);
    return true;
  } else if (request.action === 'stopFocusMode') {
    stopFocusMode().then(sendResponse);
    return true;
  } else if (request.action === 'getFocusStatus') {
    getFocusStatus().then(sendResponse);
    return true;
  } else if (request.action === 'pauseFocusMode') {
    // We can implement pause logic if needed, 
    // for now we might rely on client side or implement basic pause state in session
    // This refactor focuses on stability first. 
    // If original code supported pause, we should likely support it.
    pauseFocusMode().then(sendResponse);
    return true;
  } else if (request.action === 'resumeFocusMode') {
    resumeFocusMode().then(sendResponse);
    return true;
  } else if (request.action === 'startStopwatch') {
    startStopwatch().then(sendResponse);
    return true;
  } else if (request.action === 'stopStopwatch') {
    stopStopwatch().then(sendResponse);
    return true;
  } else if (request.action === 'getStopwatchStatus') {
    getStopwatchStatus().then(sendResponse);
    return true;
  }
});

// Start Focus Mode
async function startFocusMode(durationMinutes) {
  try {
    // Stop any existing session
    const existing = await getStoredFocusSession();
    if (existing) {
      await stopFocusMode();
    }

    // Also stop stopwatch if running
    await stopStopwatch();

    const id = Date.now().toString();
    const session = {
      id: id,
      startTime: Date.now(),
      plannedDuration: durationMinutes,
      status: 'active',
      distractionCount: 0,
      distractions: []
    };

    // Save to IndexedDB
    await createFocusSession(session);

    // Save to Local Storage (Persistence)
    await setStoredFocusSession(session);

    // Set alarm for session end
    const endTime = session.startTime + (durationMinutes * 60 * 1000);
    chrome.alarms.create('focusSessionEnd', { when: endTime });

    // Check achievements
    await checkAchievements();

    return { success: true, sessionId: session.id };
  } catch (error) {
    console.error('Error starting Focus Mode:', error);
    return { success: false, error: error.message };
  }
}

// Pause Logic
async function pauseFocusMode() {
  const session = await getStoredFocusSession();
  if (session && session.status === 'active') {
    session.status = 'paused';
    session.pauseStartTime = Date.now();
    chrome.alarms.clear('focusSessionEnd'); // Clear alarm while paused
    await setStoredFocusSession(session);
    return { success: true };
  }
  return { success: false };
}

async function resumeFocusMode() {
  const session = await getStoredFocusSession();
  if (session && session.status === 'paused') {
    const now = Date.now();
    const pausedDuration = now - (session.pauseStartTime || now);

    // Adjust start time to account for pause so duration remains correct relative to now
    session.startTime += pausedDuration;
    delete session.pauseStartTime;
    session.status = 'active';

    const endTime = session.startTime + (session.plannedDuration * 60 * 1000);
    chrome.alarms.create('focusSessionEnd', { when: endTime });

    await setStoredFocusSession(session);
    return { success: true };
  }
  return { success: false };
}

// Stop Focus Mode
async function stopFocusMode() {
  try {
    const currentFocusSession = await getStoredFocusSession();
    if (!currentFocusSession) {
      return { success: false, error: 'No active session' };
    }
    await completeFocusSession(currentFocusSession.id);
    return { success: true };
  } catch (error) {
    console.error('Error stopping Focus Mode:', error);
    return { success: false, error: error.message };
  }
}

// Complete a focus session
async function completeFocusSession(sessionId) {
  try {
    const db = await openDB();
    const transaction = db.transaction(['focusSessions'], 'readwrite');
    const store = transaction.objectStore('focusSessions');

    const request = store.get(sessionId);

    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        const session = request.result;
        if (session) {
          // Calculate actual focus time (accounting for pauses if we implemented complex pause logic in IDB, 
          // but for now simple duration)
          // If we adjusted startTime during resume, this simple diff works for NET time.
          const actualDuration = Math.floor((Date.now() - session.startTime) / (60 * 1000));

          session.status = 'completed';
          session.endTime = Date.now();
          // limit stored minute count to reasonable bounds (e.g. not negative)
          session.totalFocusMinutes = Math.max(0, actualDuration);

          const putRequest = store.put(session);
          putRequest.onsuccess = async () => {
            // Clear alarm & Storage
            chrome.alarms.clear('focusSessionEnd');
            await setStoredFocusSession(null);

            // Show completion notification
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon48.png',
              title: '🎉 Focus Session Complete!',
              message: `Great job! You focused for ${session.totalFocusMinutes} minutes.`
            });

            // Check achievements
            await checkAchievements();
            resolve();
          };
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          // Session not in DB but was in storage? Clean up storage.
          await setStoredFocusSession(null);
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error completing focus session:', error);
  }
}

// Get current Focus Mode status
async function getFocusStatus() {
  try {
    const currentFocusSession = await getStoredFocusSession();
    if (!currentFocusSession) {
      return { active: false };
    }

    if (currentFocusSession.status === 'paused') {
      // Paused state
      const now = Date.now();
      // Effectively "frozen" time remaining
      // We need to calculate what WAS remaining when we paused
      // But simpler: we know planned duration. 
      // Logic: EndTime would be startTime + duration.
      // Since we shift startTime on resume, we can calculate "theoretical" end time now.
      const effectiveEndTime = currentFocusSession.startTime + (currentFocusSession.plannedDuration * 60 * 1000);
      // Pause logic is tricky. Let's just return what we have.
      // The popup handles "Paused" display mostly.
      return {
        active: true,
        status: 'paused',
        sessionId: currentFocusSession.id,
        distractionCount: currentFocusSession.distractionCount || 0
      };
    }

    const now = Date.now();
    const endTime = currentFocusSession.startTime + (currentFocusSession.plannedDuration * 60 * 1000);
    const remainingMs = Math.max(0, endTime - now);
    const remainingMinutes = Math.floor(remainingMs / (60 * 1000));
    const remainingSeconds = Math.floor((remainingMs % (60 * 1000)) / 1000);

    return {
      active: true,
      status: 'active',
      sessionId: currentFocusSession.id,
      remainingMs: remainingMs,
      remainingMinutes: remainingMinutes,
      remainingSeconds: remainingSeconds,
      distractionCount: currentFocusSession.distractionCount || 0
    };
  } catch (error) {
    console.error('Error getting focus status:', error);
    return { active: false };
  }
}

// --- STOPWATCH LOGIC ---

async function startStopwatch() {
  // Clear focus session if any
  const existing = await getStoredFocusSession();
  if (existing) {
    await stopFocusMode();
  }

  const state = {
    isRunning: true,
    startTime: Date.now(),
    accumulatedMs: 0
  };
  await chrome.storage.local.set({ [KEY_STOPWATCH]: state });
  return { success: true };
}

async function stopStopwatch() {
  await chrome.storage.local.remove([KEY_STOPWATCH]);
  return { success: true };
}

async function getStopwatchStatus() {
  const result = await chrome.storage.local.get([KEY_STOPWATCH]);
  const state = result[KEY_STOPWATCH];
  if (state && state.isRunning) {
    const now = Date.now();
    const totalMs = (now - state.startTime) + (state.accumulatedMs || 0);
    const totalSeconds = Math.floor(totalMs / 1000);
    return {
      active: true,
      totalSeconds: totalSeconds
    };
  }
  return { active: false };
}

// Handle alarm for session end
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'focusSessionEnd') {
    const currentFocusSession = await getStoredFocusSession();
    if (currentFocusSession) {
      await completeFocusSession(currentFocusSession.id);
    }
  }
});

// Check and unlock achievements
async function checkAchievements() {
  try {
    const allSessions = await getAllFocusSessions();
    const sessions = allSessions.filter(s => s.status === 'completed');

    // Check FIRST_SESSION
    if (sessions.length >= 1) {
      await unlockAchievement('FIRST_SESSION');
    }

    // Check sessions today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySessions = sessions.filter(s => {
      const sessionDate = new Date(s.endTime);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate.getTime() === today.getTime();
    });

    if (todaySessions.length >= 3) {
      await unlockAchievement('THREE_SESSIONS_DAY');
    }

    // Check streak
    const streak = await calculateStreak(sessions);
    if (streak >= 2) {
      await unlockAchievement('TWO_DAY_STREAK');
    }
    if (streak >= 7) {
      await unlockAchievement('WEEK_STREAK');
    }
  } catch (error) {
    console.error('Error checking achievements:', error);
  }
}

// Calculate current streak
async function calculateStreak(sessions) {
  if (sessions.length === 0) return 0;

  // Sort by endTime descending
  sessions.sort((a, b) => b.endTime - a.endTime);

  // Group by day
  const daysWithSessions = new Set();
  sessions.forEach(session => {
    const date = new Date(session.endTime);
    date.setHours(0, 0, 0, 0);
    daysWithSessions.add(date.getTime());
  });

  const sortedDays = Array.from(daysWithSessions).sort((a, b) => b - a);

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let expectedDate = today.getTime();

  for (const day of sortedDays) {
    if (day === expectedDate) {
      streak++;
      expectedDate -= 24 * 60 * 60 * 1000; // Previous day
    } else if (day < expectedDate) {
      break; // Streak broken
    }
  }

  return streak;
}
