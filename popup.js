// FocusShield Popup Script
// Handles UI interactions for starting/stopping Focus Mode

let focusStatusInterval = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadFocusStatus();
  setupEventListeners();
  startStatusPolling();
});

// Setup event listeners
function setupEventListeners() {
  const durationSelect = document.getElementById('durationSelect');
  const customDurationInput = document.getElementById('customDurationInput');
  const startBtn = document.getElementById('startFocusBtn');
  const stopBtn = document.getElementById('stopFocusBtn');
  const openDashboard = document.getElementById('openDashboard');
  const openOptions = document.getElementById('openOptions');

  // Duration selector
  durationSelect.addEventListener('change', () => {
    if (durationSelect.value === 'custom') {
      customDurationInput.classList.remove('hidden');
    } else {
      customDurationInput.classList.add('hidden');
    }
  });

  // Start Focus Mode
  startBtn.addEventListener('click', async () => {
    const durationSelect = document.getElementById('durationSelect');
    const customMinutes = document.getElementById('customMinutes');
    
    let duration;
    if (durationSelect.value === 'custom') {
      duration = parseInt(customMinutes.value);
      if (isNaN(duration) || duration < 1 || duration > 120) {
        alert('Please enter a valid duration between 1 and 120 minutes.');
        return;
      }
    } else {
      duration = parseInt(durationSelect.value);
    }

    const response = await chrome.runtime.sendMessage({
      action: 'startFocusMode',
      duration: duration
    });

    if (response.success) {
      await loadFocusStatus();
    } else {
      alert('Failed to start Focus Mode: ' + (response.error || 'Unknown error'));
    }
  });

  // Stop Focus Mode
  stopBtn.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'stopFocusMode'
    });

    if (response.success) {
      await loadFocusStatus();
    } else {
      alert('Failed to stop Focus Mode: ' + (response.error || 'Unknown error'));
    }
  });

  // Open Dashboard
  openDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    window.close();
  });

  // Open Options
  openOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
}

// Load current Focus Mode status
async function loadFocusStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getFocusStatus' });
    
    if (response.active) {
      // Focus Mode is active
      document.getElementById('statusText').textContent = 'Focus Mode: Active';
      document.getElementById('statusText').classList.add('active');
      document.getElementById('timerDisplay').classList.remove('hidden');
      document.getElementById('startFocusBtn').classList.add('hidden');
      document.getElementById('stopFocusBtn').classList.remove('hidden');
      document.getElementById('durationSelect').disabled = true;
      
      updateTimerDisplay(response.remainingMinutes, response.remainingSeconds);
    } else {
      // Focus Mode is inactive
      document.getElementById('statusText').textContent = 'Focus Mode: Off';
      document.getElementById('statusText').classList.remove('active');
      document.getElementById('timerDisplay').classList.add('hidden');
      document.getElementById('startFocusBtn').classList.remove('hidden');
      document.getElementById('stopFocusBtn').classList.add('hidden');
      document.getElementById('durationSelect').disabled = false;
    }
  } catch (error) {
    console.error('Error loading focus status:', error);
  }
}

// Update timer display
function updateTimerDisplay(minutes, seconds) {
  const timeRemaining = document.getElementById('timeRemaining');
  const mins = String(minutes).padStart(2, '0');
  const secs = String(seconds).padStart(2, '0');
  timeRemaining.textContent = `${mins}:${secs}`;
}

// Start polling for status updates
function startStatusPolling() {
  focusStatusInterval = setInterval(async () => {
    await loadFocusStatus();
  }, 1000); // Update every second
}

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
  if (focusStatusInterval) {
    clearInterval(focusStatusInterval);
  }
});

