// FocusShield Options Script
// Manages blocklist and settings

const PRESET_DOMAINS = [
  'instagram.com',
  'youtube.com',
  'netflix.com',
  'facebook.com',
  'twitter.com',
  'tiktok.com',
  'reddit.com',
  'pinterest.com'
];

// Initialize options page
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadBlocklist();
  await loadSettings();
});

// Setup event listeners
function setupEventListeners() {
  const addDomainBtn = document.getElementById('addDomainBtn');
  const newDomainInput = document.getElementById('newDomainInput');
  const enableNotifications = document.getElementById('enableNotifications');
  const resetDataBtn = document.getElementById('resetDataBtn');
  const backToPopup = document.getElementById('backToPopup');

  // Add domain
  addDomainBtn.addEventListener('click', async () => {
    const domain = newDomainInput.value.trim().toLowerCase();
    if (domain) {
      await addCustomDomain(domain);
      newDomainInput.value = '';
    }
  });

  // Enter key to add domain
  newDomainInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const domain = newDomainInput.value.trim().toLowerCase();
      if (domain) {
        await addCustomDomain(domain);
        newDomainInput.value = '';
      }
    }
  });

  // Enable notifications
  enableNotifications.addEventListener('change', async () => {
    await saveNotificationSetting(enableNotifications.checked);
  });

  // Reset data
  resetDataBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
      await resetAllData();
      alert('All data has been reset.');
      await loadBlocklist();
    }
  });

  // Back to popup
  backToPopup.addEventListener('click', () => {
    window.close();
  });
}

// Load blocklist from settings
async function loadBlocklist() {
  try {
    const settings = await getSettings();
    const blocklist = settings.blocklist || [];
    
    // Load preset domains
    const presetList = document.getElementById('presetList');
    presetList.innerHTML = PRESET_DOMAINS.map(domain => {
      const isInBlocklist = blocklist.includes(domain);
      return `
        <div class="blocklist-item">
          <label class="checkbox-label">
            <input type="checkbox" data-domain="${domain}" ${isInBlocklist ? 'checked' : ''} class="preset-checkbox">
            <span>${domain}</span>
          </label>
        </div>
      `;
    }).join('');

    // Add event listeners to preset checkboxes
    document.querySelectorAll('.preset-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const domain = e.target.dataset.domain;
        if (e.target.checked) {
          await addToBlocklist(domain);
        } else {
          await removeFromBlocklist(domain);
        }
      });
    });

    // Load custom domains
    const customDomains = blocklist.filter(d => !PRESET_DOMAINS.includes(d));
    const customList = document.getElementById('customList');
    
    if (customDomains.length === 0) {
      customList.innerHTML = '<p class="empty-state">No custom domains added</p>';
    } else {
      customList.innerHTML = customDomains.map(domain => `
        <div class="blocklist-item">
          <span>${domain}</span>
          <button class="btn btn-small btn-danger" data-domain="${domain}">Remove</button>
        </div>
      `).join('');

      // Add event listeners to remove buttons
      customList.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const domain = e.target.dataset.domain;
          await removeFromBlocklist(domain);
          await loadBlocklist();
        });
      });
    }
  } catch (error) {
    console.error('Error loading blocklist:', error);
  }
}

// Add custom domain to blocklist
async function addCustomDomain(domain) {
  // Validate domain format (basic)
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(domain)) {
    alert('Please enter a valid domain name (e.g., reddit.com)');
    return;
  }

  try {
    await addToBlocklist(domain);
    await loadBlocklist();
  } catch (error) {
    console.error('Error adding custom domain:', error);
    alert('Failed to add domain');
  }
}

// Add domain to blocklist
async function addToBlocklist(domain) {
  try {
    const settings = await getSettings();
    const blocklist = settings.blocklist || [];
    
    if (!blocklist.includes(domain)) {
      blocklist.push(domain);
      settings.blocklist = blocklist;
      await saveSettings(settings);
    }
  } catch (error) {
    console.error('Error adding to blocklist:', error);
    throw error;
  }
}

// Remove domain from blocklist
async function removeFromBlocklist(domain) {
  try {
    const settings = await getSettings();
    const blocklist = settings.blocklist || [];
    
    const index = blocklist.indexOf(domain);
    if (index > -1) {
      blocklist.splice(index, 1);
      settings.blocklist = blocklist;
      await saveSettings(settings);
    }
  } catch (error) {
    console.error('Error removing from blocklist:', error);
    throw error;
  }
}

// Load settings
async function loadSettings() {
  try {
    const settings = await getSettings();
    const enableNotifications = document.getElementById('enableNotifications');
    enableNotifications.checked = settings.enableNotifications !== false; // Default to true
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save notification setting
async function saveNotificationSetting(enabled) {
  try {
    const settings = await getSettings();
    settings.enableNotifications = enabled;
    await saveSettings(settings);
  } catch (error) {
    console.error('Error saving notification setting:', error);
  }
}

// Reset all data
async function resetAllData() {
  try {
    const db = await openDB();
    
    // Clear all object stores
    const stores = ['domainStats', 'focusSessions', 'achievements', 'settings'];
    
    for (const storeName of stores) {
      const transaction = db.transaction([storeName], 'readwrite');
      const objectStore = transaction.objectStore(storeName);
      await objectStore.clear();
    }

    // Reset settings to defaults
    const defaultSettings = {
      blocklist: [],
      enableNotifications: true
    };
    await saveSettings(defaultSettings);
  } catch (error) {
    console.error('Error resetting data:', error);
    throw error;
  }
}

