// FocusShield IndexedDB Helper Module
// Provides Promise-based interface for all database operations

const DB_NAME = 'focusshieldDB';
const DB_VERSION = 1;

// Object store names
const STORES = {
  DOMAIN_STATS: 'domainStats',
  FOCUS_SESSIONS: 'focusSessions',
  ACHIEVEMENTS: 'achievements',
  SETTINGS: 'settings'
};

let dbInstance = null;

/**
 * Open IndexedDB database
 * Creates object stores if they don't exist
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database: ' + request.error));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object stores if they don't exist
      
      // domainStats: stores website visit statistics
      // Key: domain (string)
      // Value: { domain, totalTimeMs, visitCount, firstVisited, lastVisited }
      if (!db.objectStoreNames.contains(STORES.DOMAIN_STATS)) {
        const domainStatsStore = db.createObjectStore(STORES.DOMAIN_STATS, { keyPath: 'domain' });
        domainStatsStore.createIndex('lastVisited', 'lastVisited', { unique: false });
      }

      // focusSessions: stores focus session records
      // Key: id (string)
      // Value: { id, startTime, endTime, plannedDuration, status, distractionCount, distractions, totalFocusMinutes }
      if (!db.objectStoreNames.contains(STORES.FOCUS_SESSIONS)) {
        const focusSessionsStore = db.createObjectStore(STORES.FOCUS_SESSIONS, { keyPath: 'id' });
        focusSessionsStore.createIndex('status', 'status', { unique: false });
        focusSessionsStore.createIndex('startTime', 'startTime', { unique: false });
        focusSessionsStore.createIndex('endTime', 'endTime', { unique: false });
      }

      // achievements: stores unlocked achievements
      // Key: id (string)
      // Value: { id, unlocked, unlockedAt }
      if (!db.objectStoreNames.contains(STORES.ACHIEVEMENTS)) {
        db.createObjectStore(STORES.ACHIEVEMENTS, { keyPath: 'id' });
      }

      // settings: stores extension settings
      // Key: 'settings' (string)
      // Value: { blocklist: [], enableNotifications: true, ... }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Save or update domain statistics
 * @param {string} domain - Domain name
 * @param {number} timeSpentMs - Time spent in milliseconds
 * @returns {Promise<void>}
 */
async function saveDomainStat(domain, timeSpentMs) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORES.DOMAIN_STATS], 'readwrite');
      const store = transaction.objectStore(STORES.DOMAIN_STATS);

      const getRequest = store.get(domain);

      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (existing) {
          // Update existing stat
          existing.totalTimeMs += timeSpentMs;
          existing.visitCount += 1;
          existing.lastVisited = Date.now();
          
          const putRequest = store.put(existing);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          // Create new stat
          const newStat = {
            domain: domain,
            totalTimeMs: timeSpentMs,
            visitCount: 1,
            firstVisited: Date.now(),
            lastVisited: Date.now()
          };
          
          const putRequest = store.put(newStat);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get all domain statistics
 * @returns {Promise<Array>}
 */
async function getAllDomainStats() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORES.DOMAIN_STATS], 'readonly');
      const store = transaction.objectStore(STORES.DOMAIN_STATS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Create a new focus session
 * @param {Object} session - Session object
 * @returns {Promise<void>}
 */
async function createFocusSession(session) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORES.FOCUS_SESSIONS], 'readwrite');
      const store = transaction.objectStore(STORES.FOCUS_SESSIONS);
      const request = store.put(session);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Update an existing focus session
 * @param {Object} session - Updated session object
 * @returns {Promise<void>}
 */
async function updateFocusSession(session) {
  return createFocusSession(session); // Same operation
}

/**
 * Get all focus sessions
 * @returns {Promise<Array>}
 */
async function getAllFocusSessions() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORES.FOCUS_SESSIONS], 'readonly');
      const store = transaction.objectStore(STORES.FOCUS_SESSIONS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get focus sessions for today
 * @returns {Promise<Array>}
 */
async function getTodaySessions() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORES.FOCUS_SESSIONS], 'readonly');
      const store = transaction.objectStore(STORES.FOCUS_SESSIONS);
      const index = store.index('endTime');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const range = IDBKeyRange.bound(today.getTime(), tomorrow.getTime(), false, true);
      const request = index.getAll(range);

      request.onsuccess = () => {
        const sessions = request.result || [];
        // Filter to only completed sessions
        const completed = sessions.filter(s => s.status === 'completed');
        resolve(completed);
      };
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get settings
 * @returns {Promise<Object>}
 */
async function getSettings() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORES.SETTINGS], 'readonly');
      const store = transaction.objectStore(STORES.SETTINGS);
      const request = store.get('settings');

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve(result.value || { blocklist: [], enableNotifications: true });
        } else {
          // Return default settings
          resolve({ blocklist: [], enableNotifications: true });
        }
      };
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Save settings
 * @param {Object} settings - Settings object
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORES.SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORES.SETTINGS);
      
      const settingsRecord = {
        key: 'settings',
        value: settings
      };
      
      const request = store.put(settingsRecord);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get all achievements
 * @returns {Promise<Array>}
 */
async function getAllAchievements() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORES.ACHIEVEMENTS], 'readonly');
      const store = transaction.objectStore(STORES.ACHIEVEMENTS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Unlock an achievement
 * @param {string} achievementId - Achievement ID
 * @returns {Promise<void>}
 */
async function unlockAchievement(achievementId) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORES.ACHIEVEMENTS], 'readwrite');
      const store = transaction.objectStore(STORES.ACHIEVEMENTS);
      
      // Check if already unlocked
      const getRequest = store.get(achievementId);
      
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing || !existing.unlocked) {
          const achievement = {
            id: achievementId,
            unlocked: true,
            unlockedAt: Date.now()
          };
          
          const putRequest = store.put(achievement);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(); // Already unlocked
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    } catch (error) {
      reject(error);
    }
  });
}

