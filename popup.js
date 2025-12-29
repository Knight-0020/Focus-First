// FocusShield Popup Script
// Enhanced Pomodoro Timer with Dark Mode Support

let focusStatusInterval = null;
let pomodoroState = {
  isRunning: false,
  isPaused: false,
  currentSession: 1,
  totalSessions: 4,
  sessionType: 'focus', // 'focus', 'shortBreak', 'longBreak'
  remainingSeconds: 25 * 60,
  totalSeconds: 25 * 60
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
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
  const startBtn = document.getElementById('startFocusBtn');
  const pauseBtn = document.getElementById('pauseFocusBtn');
  const stopBtn = document.getElementById('stopFocusBtn');
  const skipBtn = document.getElementById('skipBtn');
  const openDashboard = document.getElementById('openDashboard');
  const openOptions = document.getElementById('openOptions');
  const themeToggle = document.getElementById('themeToggle');

  // Theme toggle
  themeToggle.addEventListener('click', toggleTheme);

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
    if (confirm('Are you sure you want to stop the current session?')) {
      await stopFocusMode();
    }
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
      updateUIState();
      await loadFocusStatus();
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
  updateUIState();
  
  try {
    await chrome.runtime.sendMessage({ action: 'pauseFocusMode' });
  } catch (error) {
    console.error('Error pausing:', error);
  }
}

// Resume Focus Mode
async function resumeFocusMode() {
  pomodoroState.isPaused = false;
  pomodoroState.isRunning = true;
  updateUIState();
  
  try {
    await chrome.runtime.sendMessage({ action: 'resumeFocusMode' });
  } catch (error) {
    console.error('Error resuming:', error);
  }
}

// Stop Focus Mode
async function stopFocusMode() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'stopFocusMode' });
    
    if (response.success) {
      pomodoroState.isRunning = false;
      pomodoroState.isPaused = false;
      pomodoroState.sessionType = 'focus';
      pomodoroState.remainingSeconds = getDurationMinutes() * 60;
      pomodoroState.totalSeconds = pomodoroState.remainingSeconds;
      updateUIState();
      await loadFocusStatus();
    }
  } catch (error) {
    console.error('Error stopping:', error);
  }
}

// Skip to next session
async function skipSession() {
  const breaks = getBreakDurations();
  
  if (pomodoroState.sessionType === 'focus') {
    // Move to break
    if (pomodoroState.currentSession >= pomodoroState.totalSessions) {
      pomodoroState.sessionType = 'longBreak';
      pomodoroState.remainingSeconds = breaks.longBreak * 60;
    } else {
      pomodoroState.sessionType = 'shortBreak';
      pomodoroState.remainingSeconds = breaks.shortBreak * 60;
    }
  } else {
    // Move to next focus session
    if (pomodoroState.sessionType === 'longBreak') {
      pomodoroState.currentSession = 1;
    } else {
      pomodoroState.currentSession++;
    }
    pomodoroState.sessionType = 'focus';
    pomodoroState.remainingSeconds = getDurationMinutes() * 60;
  }
  
  pomodoroState.totalSeconds = pomodoroState.remainingSeconds;
  updateUIState();
  updateSessionIndicators();
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
    pauseBtn.classList.remove('hidden');
    stopBtn.classList.remove('hidden');
    skipBtn.classList.remove('hidden');
    statusText.textContent = 'Running';
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
    const response = await chrome.runtime.sendMessage({ action: 'getFocusStatus' });
    
    if (response.active) {
      pomodoroState.isRunning = true;
      pomodoroState.isPaused = false;
      pomodoroState.sessionType = 'focus';
      
      const totalSeconds = response.remainingMinutes * 60 + response.remainingSeconds;
      pomodoroState.remainingSeconds = totalSeconds;
      
      updateTimerDisplay(response.remainingMinutes, response.remainingSeconds);
      updateProgressRing();
      updateUIState();
      updateSessionIndicators();
    } else {
      if (!pomodoroState.isPaused) {
        pomodoroState.isRunning = false;
        updateUIState();
      }
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
  const mins = String(minutes).padStart(2, '0');
  const secs = String(seconds).padStart(2, '0');
  timeRemaining.textContent = `${mins}:${secs}`;
  
  // Add pulse animation when time is running low (less than 5 minutes)
  if (pomodoroState.isRunning && minutes < 5 && minutes > 0) {
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
  const progress = pomodoroState.remainingSeconds / pomodoroState.totalSeconds;
  const offset = circumference * (1 - progress);
  const percentage = Math.round(progress * 100);
  
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

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
  if (focusStatusInterval) {
    clearInterval(focusStatusInterval);
  }
});

