// Focus First Popup Script
// Enhanced Pomodoro Timer with Dark Mode Support

let focusStatusInterval = null;
let pomodoroState = {
  isRunning: false,
  isPaused: false,
  currentSession: 1,
  totalSessions: 4,
  sessionType: 'focus', // 'focus', 'shortBreak', 'longBreak'
  remainingSeconds: 25 * 60,
  totalSeconds: 25 * 60,
  mode: 'timer', // 'timer' | 'stopwatch'
  timerInterval: null,
  stopwatchSeconds: 0,
  isBreak: false
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();

  // Restore mode selection if possible, or default
  // For now we check status first to see if something is running
  await loadFocusStatus();

  await loadQuickStats();
  setupEventListeners();
  startStatusPolling();
  updateProgressRing();
});

// Load theme preference
async function loadTheme() {
  try {
    const settings = await getSettings();
    const isDark = settings.darkMode || false;
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
  } catch (error) {
    console.error('Error loading theme:', error);
  }
}

// Update theme icon
function updateThemeIcon(isDark) {
  const themeIcon = document.querySelector('.theme-icon');
  if (themeIcon) {
    themeIcon.textContent = isDark ? '☀️' : '🌙';
  }
}

// Toggle theme
async function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', newTheme);
  updateThemeIcon(newTheme === 'dark');
  updateProgressRing(); // Update ring colors for new theme

  // Save preference
  try {
    const settings = await getSettings();
    settings.darkMode = newTheme === 'dark';
    await saveSettings(settings);
  } catch (error) {
    console.error('Error saving theme:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  const durationSelect = document.getElementById('durationSelect');
  const customDurationInput = document.getElementById('customDurationInput');
  const modeSelect = document.getElementById('modeSelect');
  const startBtn = document.getElementById('startFocusBtn');
  const pauseBtn = document.getElementById('pauseFocusBtn');
  const stopBtn = document.getElementById('stopFocusBtn');
  const skipBtn = document.getElementById('skipBtn');
  const openDashboard = document.getElementById('openDashboard');
  const openOptions = document.getElementById('openOptions');
  const themeToggle = document.getElementById('themeToggle');

  // Theme toggle
  themeToggle.addEventListener('click', toggleTheme);

  // Mode selector
  modeSelect.addEventListener('change', () => {
    pomodoroState.mode = modeSelect.value;
    resetTimerState();
    updateUIState();
  });

  // Duration selector
  durationSelect.addEventListener('change', () => {
    if (durationSelect.value === 'custom') {
      customDurationInput.classList.remove('hidden');
    } else {
      customDurationInput.classList.add('hidden');
      updateTimerFromSelection();
    }
  });

  // Start Focus Mode
  startBtn.addEventListener('click', async () => {
    if (pomodoroState.isPaused) {
      // Resume
      await resumeFocusMode();
    } else {
      // Start new session
      await startFocusMode();
    }
  });

  // Pause Focus Mode
  pauseBtn.addEventListener('click', async () => {
    await pauseFocusMode();
  });

  // Stop Focus Mode
  stopBtn.addEventListener('click', async () => {
    await stopFocusMode(true);
  });

  // Skip to next session
  skipBtn.addEventListener('click', async () => {
    await skipSession();
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

// Get duration from selection
function getDurationMinutes() {
  const durationSelect = document.getElementById('durationSelect');
  const customMinutes = document.getElementById('customMinutes');

  if (durationSelect.value === 'custom') {
    const duration = parseInt(customMinutes.value);
    return (isNaN(duration) || duration < 1 || duration > 120) ? 25 : duration;
  }
  return parseInt(durationSelect.value);
}

// Get break durations
function getBreakDurations() {
  const shortBreak = parseInt(document.getElementById('shortBreak').value) || 5;
  const longBreak = parseInt(document.getElementById('longBreak').value) || 15;
  return { shortBreak, longBreak };
}

// Update timer display from selection
function updateTimerFromSelection() {
  if (!pomodoroState.isRunning) {
    const minutes = getDurationMinutes();
    pomodoroState.totalSeconds = minutes * 60;
    pomodoroState.remainingSeconds = minutes * 60;
    updateTimerDisplay(minutes, 0);
    updateProgressRing();
  }
}

// Start Focus Mode
async function startFocusMode() {
  const duration = getDurationMinutes();

  try {
    if (pomodoroState.mode === 'stopwatch') {
      await startStopwatch();
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'startFocusMode',
      duration: duration
    });

    if (response.success) {
      pomodoroState.isRunning = true;
      pomodoroState.isPaused = false;
      pomodoroState.sessionType = 'focus';
      pomodoroState.totalSeconds = duration * 60;
      pomodoroState.remainingSeconds = duration * 60;
      startLocalCountdown();
      updateUIState();
    } else {
      alert('Failed to start Focus Mode: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error starting focus mode:', error);
  }
}

// Pause Focus Mode
async function pauseFocusMode() {
  pomodoroState.isPaused = true;
  pomodoroState.isRunning = false;
  clearInterval(pomodoroState.timerInterval);
  updateUIState();

  try {
    if (pomodoroState.mode === 'timer') {
      await chrome.runtime.sendMessage({ action: 'pauseFocusMode' });
    }
  } catch (error) {
    console.error('Error pausing:', error);
  }
}

// Resume Focus Mode
async function resumeFocusMode() {
  pomodoroState.isPaused = false;
  pomodoroState.isRunning = true;

  try {
    if (pomodoroState.mode === 'stopwatch') {
      // Stopwatch resume logic if needed, but for now our simple stopwatch might just restart or continue
      // If we supported pause in stopwatch, we'd send a message.
      // Current background implementation keeps it running.
      // If we implement pause, we need a resume message.
      // For now, assume stopwatch runs continuously unless stopped.
      startStopwatchLocal();
    } else {
      await chrome.runtime.sendMessage({ action: 'resumeFocusMode' });
      startLocalCountdown();
    }
  } catch (error) {
    console.error('Error resuming:', error);
  }
  updateUIState();
}

// Stop Focus Mode
async function stopFocusMode(confirmStop = false) {
  if (confirmStop) {
    const ok = confirm('Stop the session and reset to 00:00?');
    if (!ok) return;
  }
  try {
    if (pomodoroState.mode === 'stopwatch') {
      await chrome.runtime.sendMessage({ action: 'stopStopwatch' });
    } else {
      await chrome.runtime.sendMessage({ action: 'stopFocusMode' });
    }

    resetTimerState(true);
    updateUIState();
    // Refresh status to confirm cleanliness
    await loadFocusStatus();
  } catch (error) {
    console.error('Error stopping:', error);
  }
}

// Skip to next session
async function skipSession() {
  clearInterval(pomodoroState.timerInterval);

  if (pomodoroState.sessionType === 'shortBreak' || pomodoroState.sessionType === 'longBreak') {
    // End break early and move to next focus
    pomodoroState.sessionType = 'focus';
    pomodoroState.isBreak = false;
    pomodoroState.isRunning = false;
    pomodoroState.isPaused = false;
    pomodoroState.currentSession = Math.min(pomodoroState.currentSession + 1, pomodoroState.totalSessions);
    const minutes = getDurationMinutes();
    pomodoroState.remainingSeconds = minutes * 60;
    pomodoroState.totalSeconds = pomodoroState.remainingSeconds;
    updateTimerDisplay(minutes, 0);
    updateUIState();
    updateSessionIndicators();
    return;
  }

  // Skip focus -> jump to break
  try {
    await chrome.runtime.sendMessage({ action: 'stopFocusMode' });
  } catch (error) {
    console.error('Error skipping session:', error);
  }

  startBreakCountdown();
}

// Update UI state based on pomodoro state
function updateUIState() {
  const startBtn = document.getElementById('startFocusBtn');
  const pauseBtn = document.getElementById('pauseFocusBtn');
  const stopBtn = document.getElementById('stopFocusBtn');
  const skipBtn = document.getElementById('skipBtn');
  const statusText = document.getElementById('pomodoroStatus');
  const sessionType = document.getElementById('sessionType');
  const durationSelect = document.getElementById('durationSelect');
  const pomodoroSection = document.getElementById('pomodoroSection');

  if (pomodoroState.isRunning) {
    startBtn.classList.add('hidden');
    // Stopwatch doesn't support pause in this simple version, but could be added
    if (pomodoroState.mode === 'stopwatch') {
      pauseBtn.classList.add('hidden'); // Hide pause for stopwatch for now
    } else {
      pauseBtn.classList.remove('hidden');
    }
    stopBtn.classList.remove('hidden');
    skipBtn.classList.remove('hidden');
    statusText.textContent = pomodoroState.sessionType === 'focus' ? (pomodoroState.mode === 'stopwatch' ? 'Stopwatch running' : 'Running') : 'Break';
    durationSelect.disabled = true;
    pomodoroSection.classList.add('running');
    pomodoroSection.classList.remove('paused', 'ready');
  } else if (pomodoroState.isPaused) {
    startBtn.classList.remove('hidden');
    startBtn.querySelector('.btn-icon').textContent = '▶';
    pauseBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    skipBtn.classList.remove('hidden');
    statusText.textContent = 'Paused';
    durationSelect.disabled = true;
    pomodoroSection.classList.add('paused');
    pomodoroSection.classList.remove('running', 'ready');
  } else {
    startBtn.classList.remove('hidden');
    startBtn.querySelector('.btn-icon').textContent = '▶';
    pauseBtn.classList.add('hidden');
    stopBtn.classList.add('hidden');
    skipBtn.classList.add('hidden');
    statusText.textContent = 'Ready';
    durationSelect.disabled = false;
    pomodoroSection.classList.add('ready');
    pomodoroSection.classList.remove('running', 'paused');
  }

  // Update session type display
  const typeLabels = {
    'focus': 'Focus Time',
    'shortBreak': 'Short Break',
    'longBreak': 'Long Break'
  };
  sessionType.textContent = typeLabels[pomodoroState.sessionType];

  // Update progress ring
  updateProgressRing();
}

// Update session indicators (dots)
function updateSessionIndicators() {
  const dots = document.querySelectorAll('.session-dots .dot');
  const currentSessionEl = document.getElementById('currentSession');

  dots.forEach((dot, index) => {
    dot.classList.remove('completed', 'active');
    if (index < pomodoroState.currentSession - 1) {
      dot.classList.add('completed');
    } else if (index === pomodoroState.currentSession - 1 && pomodoroState.isRunning) {
      dot.classList.add('active');
    }
  });

  currentSessionEl.textContent = pomodoroState.currentSession;
}

// Load current Focus Mode status
async function loadFocusStatus() {
  try {
    // Check Timer Status
    const response = await chrome.runtime.sendMessage({ action: 'getFocusStatus' });

    if (response && response.active) {
      // If we are in stopwatch mode locally but timer is active, switch to timer mode
      if (document.getElementById('modeSelect').value !== 'timer') {
        document.getElementById('modeSelect').value = 'timer';
        pomodoroState.mode = 'timer';
      }

      pomodoroState.isRunning = response.status === 'active';
      pomodoroState.isPaused = response.status === 'paused';
      pomodoroState.sessionType = 'focus';

      const totalSeconds = response.remainingMinutes * 60 + response.remainingSeconds;
      pomodoroState.remainingSeconds = totalSeconds;
      // Note: We might need to fetch totalDuration to set totalSeconds correctly for the ring
      // For now, assuming standard if unknown or keep existing if set
      if (pomodoroState.totalSeconds === 25 * 60 && response.remainingMinutes > 25) {
        // Heuristic adjustment if we lost state
        pomodoroState.totalSeconds = totalSeconds;
      }

      updateTimerDisplay(response.remainingMinutes, response.remainingSeconds);
      updateProgressRing();
      updateUIState();
      updateSessionIndicators();
      return;
    }

    // Check Stopwatch Status
    const stopwatchResponse = await chrome.runtime.sendMessage({ action: 'getStopwatchStatus' });
    if (stopwatchResponse && stopwatchResponse.active) {
      if (document.getElementById('modeSelect').value !== 'stopwatch') {
        document.getElementById('modeSelect').value = 'stopwatch';
        pomodoroState.mode = 'stopwatch';
      }
      pomodoroState.isRunning = true;
      pomodoroState.stopwatchSeconds = stopwatchResponse.totalSeconds;

      startStopwatchLocal();
      updateUIState();
      return;
    }

    // Nothing active
    if (!pomodoroState.isPaused && !pomodoroState.isBreak) {
      pomodoroState.isRunning = false;
      updateUIState();
    }

  } catch (error) {
    console.error('Error loading focus status:', error);
  }
}

// Load quick stats for display
async function loadQuickStats() {
  try {
    const sessions = await getTodaySessions();
    let totalMinutes = 0;
    sessions.forEach(session => {
      if (session.totalFocusMinutes) {
        totalMinutes += session.totalFocusMinutes;
      }
    });
    document.getElementById('todayMinutes').textContent = totalMinutes;

    // Calculate streak
    const allSessions = await getAllFocusSessions();
    const completedSessions = allSessions.filter(s => s.status === 'completed');
    const streak = await calculateStreak(completedSessions);
    document.getElementById('streakCount').textContent = streak;
  } catch (error) {
    console.error('Error loading quick stats:', error);
  }
}

// Calculate streak (matching dashboard logic)
async function calculateStreak(sessions) {
  if (sessions.length === 0) return 0;

  sessions.sort((a, b) => b.endTime - a.endTime);

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
      expectedDate -= 24 * 60 * 60 * 1000;
    } else if (day < expectedDate) {
      break;
    }
  }

  return streak;
}

// Update timer display
function updateTimerDisplay(minutes, seconds) {
  const timeRemaining = document.getElementById('timeRemaining');
  const mins = Math.floor(minutes);
  const minStr = String(mins).padStart(2, '0');
  const secs = Math.floor(seconds);
  const secStr = String(secs).padStart(2, '0');
  timeRemaining.textContent = `${minStr}:${secStr}`;

  // Add pulse animation when time is running low (less than 5 minutes)
  if (pomodoroState.isRunning && pomodoroState.mode === 'timer' && minutes < 5 && minutes > 0) {
    timeRemaining.classList.add('warning');
  } else {
    timeRemaining.classList.remove('warning');
  }

  // Update progress ring
  updateProgressRing();
}

// Update progress ring
function updateProgressRing() {
  const circle = document.getElementById('progressCircle');
  const progressPercentage = document.getElementById('progressPercentage');
  if (!circle) return;

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  let progress = pomodoroState.remainingSeconds / pomodoroState.totalSeconds;

  if (pomodoroState.mode === 'stopwatch') {
    // For stopwatch, show looping progress every 60 minutes
    const cycle = Math.max(1, pomodoroState.stopwatchSeconds / 60);
    progress = (pomodoroState.stopwatchSeconds % (60 * 60)) / (60 * 60);
  }

  const offset = circumference * (1 - progress);
  const percentage = pomodoroState.mode === 'stopwatch' ? Math.round(progress * 100) : Math.round(progress * 100);

  circle.style.strokeDasharray = circumference;
  circle.style.strokeDashoffset = offset;

  // Update percentage display
  if (progressPercentage) {
    progressPercentage.textContent = `${percentage}%`;
  }

  // Update gradient color based on session type
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  if (pomodoroState.sessionType === 'focus') {
    circle.style.stroke = isDark ? 'url(#progressGradient)' : '#667eea';
  } else {
    circle.style.stroke = isDark ? 'url(#breakGradient)' : '#28a745';
  }
}

// Start polling for status updates
function startStatusPolling() {
  focusStatusInterval = setInterval(async () => {
    await loadFocusStatus();
  }, 1000);
}

// Local countdown handler
function startLocalCountdown() {
  clearInterval(pomodoroState.timerInterval);

  pomodoroState.timerInterval = setInterval(async () => {
    // We rely on polling mostly, but this smooths the UI
    pomodoroState.remainingSeconds -= 1;
    if (pomodoroState.remainingSeconds <= 0) {
      clearInterval(pomodoroState.timerInterval);
      // Wait for background to complete it or poll next update
      setTimeout(() => loadFocusStatus(), 1000);
    } else {
      updateTimerDisplay(Math.floor(pomodoroState.remainingSeconds / 60), pomodoroState.remainingSeconds % 60);
    }
  }, 1000);
}

function startStopwatchLocal() {
  clearInterval(pomodoroState.timerInterval);
  pomodoroState.timerInterval = setInterval(() => {
    pomodoroState.stopwatchSeconds += 1;
    updateTimerDisplay(Math.floor(pomodoroState.stopwatchSeconds / 60), pomodoroState.stopwatchSeconds % 60);
    updateProgressRing();
  }, 1000);
}

async function startStopwatch() {
  try {
    await chrome.runtime.sendMessage({ action: 'startStopwatch' });
    pomodoroState.stopwatchSeconds = 0;
    pomodoroState.isRunning = true;
    pomodoroState.isPaused = false;
    startStopwatchLocal();
    updateUIState();
  } catch (e) {
    console.error("Error starting stopwatch", e);
  }
}

function startBreakCountdown() {
  const breaks = getBreakDurations();
  const useLong = pomodoroState.currentSession >= pomodoroState.totalSessions;
  const minutes = useLong ? breaks.longBreak : breaks.shortBreak;
  pomodoroState.sessionType = useLong ? 'longBreak' : 'shortBreak';
  pomodoroState.isBreak = true;
  pomodoroState.isRunning = true;
  pomodoroState.isPaused = false;
  pomodoroState.totalSeconds = minutes * 60;
  pomodoroState.remainingSeconds = minutes * 60;
  startLocalCountdown();
  updateUIState();
  updateSessionIndicators();
}

function promptForBreak() {
  const wantsBreak = confirm('Focus complete! Start a break?');
  if (wantsBreak) {
    startBreakCountdown();
  } else {
    resetTimerState();
    updateUIState();
  }
}

function resetTimerState(stopStopwatch = false) {
  clearInterval(pomodoroState.timerInterval);
  pomodoroState.timerInterval = null;
  pomodoroState.isRunning = false;
  pomodoroState.isPaused = false;
  pomodoroState.sessionType = 'focus';
  pomodoroState.isBreak = false;
  pomodoroState.stopwatchSeconds = 0;
  const minutes = getDurationMinutes();
  pomodoroState.totalSeconds = minutes * 60;
  pomodoroState.remainingSeconds = 0; // or reset to duration
  updateTimerFromSelection();
  updateProgressRing();
}

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
  if (focusStatusInterval) {
    clearInterval(focusStatusInterval);
  }
});

