// Focus First Background Service Worker
// Handles: tab tracking, Focus Mode, notifications, alarms

// Import IndexedDB helper functions
importScripts('db.js');

// In-memory tracking of open tabs
const openTabs = new Map(); // tabId -> { domain, openedAt }

// Current Focus Mode state
let currentFocusSession = null;

// Initialize on extension install/startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Focus First installed');
  initializeDB();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Focus First started');
  initializeDB();
  loadFocusSessionState();
});

// Initialize IndexedDB
async function initializeDB() {
  try {
    const db = await openDB();
    console.log('IndexedDB initialized');
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
  }
}

// Load Focus Mode state on startup
async function loadFocusSessionState() {
  try {
    const db = await openDB();
    const transaction = db.transaction(['focusSessions'], 'readonly');
    const store = transaction.objectStore('focusSessions');
    const index = store.index('status');
    const request = index.getAll('active');
    
    request.onsuccess = async (event) => {
      const activeSessions = event.target.result;
      if (activeSessions.length > 0) {
        // Restore the most recent active session
        const session = activeSessions[activeSessions.length - 1];
        currentFocusSession = session;
        
        // Check if session should have ended
        const now = Date.now();
        const endTime = session.startTime + (session.plannedDuration * 60 * 1000);
        
        if (now >= endTime) {
          // Session should have ended, complete it
          await completeFocusSession(session.id);
        } else {
          // Session still active, restore alarm
          const remainingMs = endTime - now;
          chrome.alarms.create('focusSessionEnd', { when: Date.now() + remainingMs });
        }
      }
    };
  } catch (error) {
    console.error('Failed to load focus session state:', error);
  }
}

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

// Track tab open: record domain and timestamp
function trackTabOpen(tabId, url) {
  try {
    const domain = extractDomain(url);
    if (!domain) return;

    const now = Date.now();
    
    // If tab was already tracked, close the previous entry first
    if (openTabs.has(tabId)) {
      trackTabClose(tabId);
    }

    // Record new tab
    openTabs.set(tabId, {
      domain: domain,
      openedAt: now
    });

    // Check if in Focus Mode and domain is in blocklist
    if (currentFocusSession && currentFocusSession.status === 'active') {
      checkDistraction(domain);
    }
  } catch (error) {
    console.error('Error tracking tab open:', error);
  }
}

// Track tab close: calculate time spent and save to IndexedDB
async function trackTabClose(tabId) {
  try {
    const tabData = openTabs.get(tabId);
    if (!tabData) return;

    const now = Date.now();
    const timeSpent = now - tabData.openedAt;
    const domain = tabData.domain;

    // Remove from memory
    openTabs.delete(tabId);

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

// Save domain statistics to IndexedDB
// Uses the helper function from db.js (imported via importScripts)

// Check if domain is distracting during Focus Mode
async function checkDistraction(domain) {
  try {
    const settings = await getSettings();
    const blocklist = settings.blocklist || [];
    
    if (blocklist.includes(domain)) {
      // Show notification
      showDistractionNotification(domain);
    }
  } catch (error) {
    console.error('Error checking distraction:', error);
  }
}

// Show distraction notification
function showDistractionNotification(domain) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Focus Mode Active',
    message: `You're in Focus Mode and opened ${domain}. Stay focused or continue?`,
    buttons: [
      { title: 'Stay Focused' },
      { title: 'Continue' }
    ],
    requireInteraction: true
  }, (notificationId) => {
    // Store notification ID with domain for button click handling
    chrome.storage.local.set({ [`notification_${notificationId}`]: domain });
  });
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  chrome.notifications.clear(notificationId);
  
  const result = await chrome.storage.local.get([`notification_${notificationId}`]);
  const domain = result[`notification_${notificationId}`];
  chrome.storage.local.remove([`notification_${notificationId}`]);

  if (buttonIndex === 1) {
    // User clicked "Continue" - log as distraction
    await logDistraction(domain);
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Distraction Logged',
      message: `Okay, continuing. This will be logged as a distraction.`
    });
  }
  // If buttonIndex === 0 (Stay Focused), do nothing
});

// Log distraction to current focus session
async function logDistraction(domain) {
  try {
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
        currentFocusSession = session;
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
    return true; // Keep channel open for async response
  } else if (request.action === 'stopFocusMode') {
    stopFocusMode().then(sendResponse);
    return true;
  } else if (request.action === 'getFocusStatus') {
    getFocusStatus().then(sendResponse);
    return true;
  }
});

// Start Focus Mode
async function startFocusMode(durationMinutes) {
  try {
    // Stop any existing session first
    if (currentFocusSession) {
      await stopFocusMode();
    }

    const session = {
      id: Date.now().toString(),
      startTime: Date.now(),
      plannedDuration: durationMinutes,
      status: 'active',
      distractionCount: 0,
      distractions: []
    };

    // Save to IndexedDB using helper function
    await createFocusSession(session);

    currentFocusSession = session;

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

// Stop Focus Mode
async function stopFocusMode() {
  try {
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
    // Get session from IndexedDB
    const db = await openDB();
    const transaction = db.transaction(['focusSessions'], 'readwrite');
    const store = transaction.objectStore('focusSessions');
    
    const request = store.get(sessionId);
    
    await new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        const session = request.result;
        if (session) {
          const actualDuration = Math.floor((Date.now() - session.startTime) / (60 * 1000));
          session.status = 'completed';
          session.endTime = Date.now();
          session.totalFocusMinutes = actualDuration;
          
          const putRequest = store.put(session);
          putRequest.onsuccess = async () => {
            // Clear alarm
            chrome.alarms.clear('focusSessionEnd');
            
            // Clear current session
            currentFocusSession = null;

        // Show completion notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: '🎉 Focus Session Complete!',
          message: `Great job! You focused for ${actualDuration} minutes.`
        });

            // Check achievements
            await checkAchievements();
            resolve();
          };
          putRequest.onerror = () => reject(putRequest.error);
        } else {
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
    if (!currentFocusSession || currentFocusSession.status !== 'active') {
      return { active: false };
    }

    const now = Date.now();
    const endTime = currentFocusSession.startTime + (currentFocusSession.plannedDuration * 60 * 1000);
    const remainingMs = Math.max(0, endTime - now);
    const remainingMinutes = Math.floor(remainingMs / (60 * 1000));
    const remainingSeconds = Math.floor((remainingMs % (60 * 1000)) / 1000);

    return {
      active: true,
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

// Handle alarm for session end
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'focusSessionEnd') {
    if (currentFocusSession) {
      completeFocusSession(currentFocusSession.id);
    }
  }
});

// Check and unlock achievements
async function checkAchievements() {
  try {
    // Get all completed sessions using helper function
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

// Unlock an achievement
// Uses the helper function from db.js (imported via importScripts)
// The unlockAchievement function is defined in db.js

