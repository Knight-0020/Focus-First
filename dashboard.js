// Focus First Dashboard Script
// Enhanced with dark mode, expandable sections, and download functionality

let focusTimeChart = null;

// Animated Number Counter
function animateNumber(element, start, end, duration = 1000, suffix = '') {
  if (!element) return;

  const range = end - start;
  const increment = range / (duration / 16); // 60fps
  let current = start;

  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      current = end;
      clearInterval(timer);
    }
    element.textContent = Math.round(current) + suffix;
  }, 16);
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  setupEventListeners();
  setupWhiteNoisePlayer();
  await loadDashboardData();

  // Add staggered entrance animation to stat cards
  document.querySelectorAll('.stat-card').forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
    card.classList.add('expanded');
  });
});

// Load theme preference
async function loadTheme() {
  try {
    const settings = await getSettings();
    const isDark = settings.darkMode || false;
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
    updateChartTheme(isDark);
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
  updateChartTheme(newTheme === 'dark');

  // Save preference
  try {
    const settings = await getSettings();
    settings.darkMode = newTheme === 'dark';
    await saveSettings(settings);
  } catch (error) {
    console.error('Error saving theme:', error);
  }
}

// Update chart theme
function updateChartTheme(isDark) {
  if (focusTimeChart) {
    const textColor = isDark ? '#eaeaea' : '#333';
    const gridColor = isDark ? '#3a3a5c' : '#e0e0e0';

    focusTimeChart.options.scales.x.ticks.color = textColor;
    focusTimeChart.options.scales.y.ticks.color = textColor;
    focusTimeChart.options.scales.x.grid.color = gridColor;
    focusTimeChart.options.scales.y.grid.color = gridColor;
    focusTimeChart.update();
  }
}

// Setup event listeners
function setupEventListeners() {
  const refreshBtn = document.getElementById('refreshBtn');
  const themeToggle = document.getElementById('themeToggle');

  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.querySelector('.btn-icon').textContent = '⏳';
    await loadDashboardData();
    refreshBtn.disabled = false;
    refreshBtn.querySelector('.btn-icon').textContent = '🔄';
  });

  themeToggle.addEventListener('click', toggleTheme);

  const pdfBtn = document.getElementById('pdfBtn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', downloadDashboardAsPDF_Safe);
  }

  const emailBtn = document.getElementById('emailBtn');
  if (emailBtn) {
    emailBtn.addEventListener('click', sendEmailReport);
  }

  // Expandable stat cards
  document.querySelectorAll('.stat-card.expandable').forEach(card => {
    const expandBtn = card.querySelector('.expand-btn');
    expandBtn.addEventListener('click', () => {
      const isExpanded = card.getAttribute('data-expanded') === 'true';
      card.setAttribute('data-expanded', !isExpanded);
      const details = card.querySelector('.stat-details');
      const icon = expandBtn.querySelector('.expand-icon');

      if (!isExpanded) {
        details.classList.remove('hidden');
        icon.textContent = '▲';
        expandBtn.classList.add('active');
      } else {
        details.classList.add('hidden');
        icon.textContent = '▼';
        expandBtn.classList.remove('active');
      }
    });
  });

  // Expandable sections
  document.querySelectorAll('.expandable-section').forEach(section => {
    const expandBtn = section.querySelector('.expand-btn');
    expandBtn.addEventListener('click', () => {
      const isExpanded = section.getAttribute('data-expanded') === 'true';
      section.setAttribute('data-expanded', !isExpanded);
      const content = section.querySelector('.section-content');
      const icon = expandBtn.querySelector('.expand-icon');

      if (!isExpanded) {
        content.style.display = 'block';
        icon.textContent = '▲';
        expandBtn.classList.add('active');
      } else {
        content.style.display = 'none';
        icon.textContent = '▼';
        expandBtn.classList.remove('active');
      }
    });
  });
}

// Download dashboard as PDF
// Download dashboard as PDF
// Download dashboard as PDF
async function downloadDashboardAsPDF() {
  const pdfBtn = document.getElementById('pdfBtn');
  const originalLabel = pdfBtn.innerHTML;
  const originalTheme = document.body.getAttribute('data-theme');

  try {
    pdfBtn.disabled = true;
    pdfBtn.textContent = '⏳ Generating High-Contrast PDF...';

    // 1. Force Print Mode (Guarantees White BG + Black Text)
    document.body.classList.add('print-mode');
    document.body.setAttribute('data-theme', 'light');
    updateThemeIcon(false);
    updateChartTheme(false);

    // Wait for animations/transitions to settle
    await new Promise(resolve => setTimeout(resolve, 800));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    const dashboardElement = document.getElementById('dashboardContent');
    const insightsElement = document.getElementById('insightsSection');

    // --- PAGE 1: Main Dashboard (excluding Insights) ---
    // Capture dashboard but ignore the insights section
    const canvasMain = await html2canvas(dashboardElement, {
      backgroundColor: '#ffffff', // Force white background
      scale: 2,
      logging: false,
      useCORS: true,
      ignoreElements: (element) => element.id === 'insightsSection'
    });

    const imgDataMain = canvasMain.toDataURL('image/jpeg', 0.95);
    const imgHeightMain = (canvasMain.height * contentWidth) / canvasMain.width;

    doc.addImage(imgDataMain, 'JPEG', margin, margin, contentWidth, imgHeightMain);

    // --- PAGE 2: Productivity Insights ---
    if (insightsElement) {
      // Ensure it's visible for capture
      const canvasInsights = await html2canvas(insightsElement, {
        backgroundColor: '#ffffff', // Force white background
        scale: 2,
        logging: false,
        useCORS: true
      });

      const imgDataInsights = canvasInsights.toDataURL('image/jpeg', 0.95);
      const imgHeightInsights = (canvasInsights.height * contentWidth) / canvasInsights.width;

      doc.addPage();
      doc.setFontSize(16);
      doc.text("Productivity Insights", margin, margin + 10);

      doc.addImage(imgDataInsights, 'JPEG', margin, margin + 20, contentWidth, imgHeightInsights);
    }

    doc.save(`focus-first-report-${new Date().toISOString().split('T')[0]}.pdf`);

  } catch (error) {
    console.error('Error saving PDF:', error);
    alert('Failed to save PDF. Please try again.');
  } finally {
    // Restore Theme & Remove Print Mode
    document.body.classList.remove('print-mode');
    document.body.setAttribute('data-theme', originalTheme);
    const isDark = originalTheme === 'dark';
    updateThemeIcon(isDark);
    updateChartTheme(isDark);

    pdfBtn.disabled = false;
    pdfBtn.innerHTML = originalLabel;
  }
}

// Send Email Report (via Gmail)
async function sendEmailReport() {
  const emailInput = document.getElementById('emailInput');
  const email = emailInput.value.trim();

  // 1. Trigger PDF Download
  if (confirm('Generating PDF report to attach. Please attach the downloaded PDF to the email manually.\n\nContinue?')) {
    await downloadDashboardAsPDF_Safe();
  }

  // Gather stats
  const totalFocus = document.getElementById('todayFocusTime').textContent || '0 min';
  const sessions = document.getElementById('todaySessions').textContent || '0';
  const topDistraction = document.getElementById('topDistraction').textContent || '-';
  const streak = document.getElementById('streakDays').textContent || '0 days';

  const subject = encodeURIComponent('Focus First Productivity Report');
  const body = encodeURIComponent(`Here is your latest Focus First report:

📅 Date: ${new Date().toLocaleDateString()}

✅ Today's Focus: ${totalFocus}
🔄 Sessions Completed: ${sessions}
🔥 Current Streak: ${streak}
⚠️ Top Distraction: ${topDistraction}

📎 PLEASE ATTACH THE DOWNLOADED PDF REPORT TO THIS EMAIL

Keep up the great work!
- Focus First Extension`);

  // Gmail Compose URL
  const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;

  // Open in new tab after a brief delay to allow PDF to start
  setTimeout(() => {
    window.open(gmailLink, '_blank');
  }, 1500);
}

// Load all dashboard data
async function loadDashboardData() {
  try {
    await Promise.all([
      loadTodayStats(),
      loadStreak(),
      loadTopSites(),
      loadAchievements(),
      loadFocusTimeChart(),
      loadProductivityInsights()
    ]);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

// Load today's statistics with expanded details
async function loadTodayStats() {
  try {
    const sessions = await getTodaySessions();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate total focus time today
    let totalMinutes = 0;
    let distractionCount = 0;
    let longestSession = 0;

    sessions.forEach(session => {
      if (session.totalFocusMinutes) {
        totalMinutes += session.totalFocusMinutes;
        longestSession = Math.max(longestSession, session.totalFocusMinutes);
      }
      distractionCount += session.distractionCount || 0;
    });

    const avgSession = sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0;
    const focusScore = sessions.length > 0
      ? Math.max(0, Math.min(100, Math.round(100 - (distractionCount / sessions.length) * 10)))
      : 0;

    document.getElementById('todayFocusTime').textContent = `${totalMinutes} min`;
    document.getElementById('todaySessions').textContent = `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`;
    document.getElementById('distractionCount').textContent = distractionCount;
    document.getElementById('avgSessionTime').textContent = `${avgSession} min`;
    document.getElementById('longestSession').textContent = `${longestSession} min`;
    document.getElementById('focusScore').textContent = `${focusScore}%`;

    // Total sessions
    const allSessions = await getAllFocusSessions();
    const completedSessions = allSessions.filter(s => s.status === 'completed');
    document.getElementById('totalSessions').textContent = completedSessions.length;

    // Calculate total focus time
    let totalFocusMinutes = 0;
    completedSessions.forEach(s => {
      totalFocusMinutes += s.totalFocusMinutes || 0;
    });
    const totalHours = Math.floor(totalFocusMinutes / 60);
    const remainingMinutes = totalFocusMinutes % 60;
    document.getElementById('totalFocusTime').textContent = `${totalHours}h ${remainingMinutes}m`;

    // Completion rate (sessions that completed vs started)
    const startedSessions = allSessions.length;
    const completionRate = startedSessions > 0
      ? Math.round((completedSessions.length / startedSessions) * 100)
      : 0;
    document.getElementById('completionRate').textContent = `${completionRate}%`;

    // Average distractions
    const avgDistractions = sessions.length > 0
      ? (distractionCount / sessions.length).toFixed(1)
      : 0;
    document.getElementById('avgDistractions').textContent = avgDistractions;

    // Top distraction
    const distractionMap = {};
    completedSessions.forEach(session => {
      if (session.distractions) {
        session.distractions.forEach(d => {
          distractionMap[d.domain] = (distractionMap[d.domain] || 0) + 1;
        });
      }
    });
    const topDistraction = Object.keys(distractionMap).length > 0
      ? Object.entries(distractionMap).sort((a, b) => b[1] - a[1])[0][0]
      : '-';
    document.getElementById('topDistraction').textContent = topDistraction;
  } catch (error) {
    console.error('Error loading today stats:', error);
  }
}

// Load streak information with expanded details
async function loadStreak() {
  try {
    const sessions = await getAllFocusSessions();
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const streak = await calculateStreak(completedSessions);

    document.getElementById('streakDays').textContent = `${streak} day${streak !== 1 ? 's' : ''}`;

    // Calculate best streak
    const bestStreak = await calculateBestStreak(completedSessions);
    document.getElementById('bestStreak').textContent = `${bestStreak} day${bestStreak !== 1 ? 's' : ''}`;

    // Total focus days
    const daysWithSessions = new Set();
    completedSessions.forEach(session => {
      const date = new Date(session.endTime);
      date.setHours(0, 0, 0, 0);
      daysWithSessions.add(date.getTime());
    });
    document.getElementById('totalFocusDays').textContent = daysWithSessions.size;
  } catch (error) {
    console.error('Error loading streak:', error);
  }
}

// Calculate best streak
async function calculateBestStreak(sessions) {
  if (sessions.length === 0) return 0;

  sessions.sort((a, b) => b.endTime - a.endTime);

  const daysWithSessions = new Set();
  sessions.forEach(session => {
    const date = new Date(session.endTime);
    date.setHours(0, 0, 0, 0);
    daysWithSessions.add(date.getTime());
  });

  const sortedDays = Array.from(daysWithSessions).sort((a, b) => b - a);

  let bestStreak = 0;
  let currentStreak = 0;
  let expectedDate = sortedDays[0];

  for (const day of sortedDays) {
    if (day === expectedDate) {
      currentStreak++;
      expectedDate -= 24 * 60 * 60 * 1000;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 1;
      expectedDate = day - 24 * 60 * 60 * 1000;
    }
  }

  return bestStreak;
}

// Calculate streak (same logic as background.js)
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

// Load top sites
async function loadTopSites() {
  try {
    const stats = await getAllDomainStats();

    // Sort by totalTimeMs descending
    stats.sort((a, b) => b.totalTimeMs - a.totalTimeMs);

    const topSites = stats.slice(0, 5);
    const topSitesList = document.getElementById('topSitesList');

    if (topSites.length === 0) {
      topSitesList.innerHTML = '<p class="empty-state">No data yet</p>';
      return;
    }

    topSitesList.innerHTML = topSites.map(stat => {
      const hours = Math.floor(stat.totalTimeMs / (60 * 60 * 1000));
      const minutes = Math.floor((stat.totalTimeMs % (60 * 60 * 1000)) / (60 * 1000));
      const timeDisplay = hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`;

      return `
        <div class="site-item">
          <div class="site-domain">${stat.domain}</div>
          <div class="site-stats">
            <span class="site-time">${timeDisplay}</span>
            <span class="site-visits">${stat.visitCount} visit${stat.visitCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading top sites:', error);
  }
}

// Load achievements
async function loadAchievements() {
  try {
    const achievements = await getAllAchievements();
    const achievementsList = document.getElementById('achievementsList');

    const achievementDefinitions = {
      'FIRST_SESSION': { name: 'First Steps', description: 'Complete your first focus session', icon: '🎯' },
      'THREE_SESSIONS_DAY': { name: 'Triple Focus', description: 'Complete 3 focus sessions in one day', icon: '🔥' },
      'TWO_DAY_STREAK': { name: 'On a Roll', description: 'Maintain a 2-day focus streak', icon: '⚡' },
      'WEEK_STREAK': { name: 'Week Warrior', description: 'Maintain a 7-day focus streak', icon: '🏆' }
    };

    const unlockedAchievements = achievements.filter(a => a.unlocked);

    // Optional: personalize achievement blurbs with Groq API if key provided via localStorage.groq_api_key
    try {
      const personalized = await personalizeAchievements(unlockedAchievements, achievementDefinitions);
      if (personalized) {
        achievementDefinitions = personalized;
      }
    } catch (err) {
      console.warn('Personalization skipped:', err?.message);
    }

    if (unlockedAchievements.length === 0) {
      achievementsList.innerHTML = '<p class="empty-state">No achievements unlocked yet</p>';
      return;
    }

    achievementsList.innerHTML = unlockedAchievements.map(achievement => {
      const def = achievementDefinitions[achievement.id] || { name: achievement.id, description: '', icon: '🏆' };
      const date = new Date(achievement.unlockedAt);
      return `
        <div class="achievement-item unlocked">
          <div class="achievement-icon">${def.icon}</div>
          <div class="achievement-info">
            <div class="achievement-name">${def.name}</div>
            <div class="achievement-description">${def.description}</div>
            <div class="achievement-date">Unlocked: ${date.toLocaleDateString()}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading achievements:', error);
  }
}

// Personalize achievements using Groq (optional)
async function personalizeAchievements(unlockedAchievements, baseDefs) {
  const groqKey = window.localStorage.getItem('groq_api_key');
  if (!groqKey) return null;
  if (unlockedAchievements.length === 0) return null;

  const prompt = `
You are Focus First. Given unlocked achievements, return improved friendly descriptions under 60 chars.
Unlocked IDs: ${unlockedAchievements.map(a => a.id).join(', ')}
Base descriptions: ${JSON.stringify(baseDefs)}
Return JSON object keyed by id with description strings.
`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`
    },
    body: JSON.stringify({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
  });

  if (!res.ok) throw new Error('Groq API error');
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) return null;

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    console.warn('Failed to parse Groq response; using base definitions');
    return null;
  }

  const merged = { ...baseDefs };
  Object.entries(parsed).forEach(([id, desc]) => {
    if (merged[id]) {
      merged[id].description = desc;
    }
  });
  return merged;
}

// Load productivity insights
async function loadProductivityInsights() {
  try {
    const sessions = await getAllFocusSessions();
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const insightsList = document.getElementById('insightsList');

    if (completedSessions.length === 0) {
      insightsList.innerHTML = '<p class="empty-state">Complete more sessions to unlock insights</p>';
      return;
    }

    const insights = [];

    // Best day of week
    const dayStats = {};
    completedSessions.forEach(session => {
      const day = new Date(session.endTime).toLocaleDateString('en-US', { weekday: 'long' });
      dayStats[day] = (dayStats[day] || 0) + (session.totalFocusMinutes || 0);
    });
    const bestDay = Object.entries(dayStats).sort((a, b) => b[1] - a[1])[0];
    if (bestDay) {
      insights.push({
        icon: '📅',
        title: 'Most Productive Day',
        text: `${bestDay[0]} with ${bestDay[1]} minutes of focus time`
      });
    }

    // Average session length
    const avgLength = completedSessions.reduce((sum, s) => sum + (s.totalFocusMinutes || 0), 0) / completedSessions.length;
    insights.push({
      icon: '⏱️',
      title: 'Average Session',
      text: `${Math.round(avgLength)} minutes per session`
    });

    // Total focus time
    const totalMinutes = completedSessions.reduce((sum, s) => sum + (s.totalFocusMinutes || 0), 0);
    const totalHours = Math.floor(totalMinutes / 60);
    insights.push({
      icon: '🎯',
      title: 'Total Focus Time',
      text: `${totalHours} hours and ${totalMinutes % 60} minutes`
    });

    insightsList.innerHTML = insights.map(insight => `
      <div class="insight-item">
        <div class="insight-icon">${insight.icon}</div>
        <div class="insight-content">
          <div class="insight-title">${insight.title}</div>
          <div class="insight-text">${insight.text}</div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading insights:', error);
  }
}

// Load focus time chart (last 7 days)
async function loadFocusTimeChart() {
  try {
    const sessions = await getAllFocusSessions();
    const completedSessions = sessions.filter(s => s.status === 'completed');

    // Get last 7 days
    const days = [];
    const focusMinutes = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const daySessions = completedSessions.filter(s => {
        const sessionDate = new Date(s.endTime);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === date.getTime();
      });

      const totalMinutes = daySessions.reduce((sum, s) => sum + (s.totalFocusMinutes || 0), 0);

      days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      focusMinutes.push(totalMinutes);
    }

    const canvas = document.getElementById('focusTimeChart');
    if (!canvas) {
      console.error('Chart canvas not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#eaeaea' : '#333';
    const gridColor = isDark ? '#3a3a5c' : '#e0e0e0';
    const primaryColor = isDark ? '#00f2fe' : '#4facfe';

    if (focusTimeChart) {
      focusTimeChart.destroy();
    }

    // Ensure minimum height for y-axis when all values are 0
    const maxValue = Math.max(...focusMinutes, 30);

    focusTimeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Focus Time (minutes)',
          data: focusMinutes,
          backgroundColor: isDark ? 'rgba(0, 242, 254, 0.6)' : 'rgba(79, 172, 254, 0.6)',
          borderColor: primaryColor,
          borderWidth: 2,
          borderRadius: 8,
          barThickness: 'flex',
          maxBarThickness: 50
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: isDark ? '#16213e' : '#fff',
            titleColor: textColor,
            bodyColor: textColor,
            borderColor: primaryColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function (context) {
                return context.parsed.y + ' minutes';
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: textColor,
              font: {
                size: 12,
                weight: '500'
              }
            },
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            max: maxValue,
            ticks: {
              color: textColor,
              font: {
                size: 12
              },
              stepSize: Math.ceil(maxValue / 5)
            },
            grid: {
              color: gridColor,
              drawBorder: false
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading focus time chart:', error);
  }
}

// ==================== WHITE NOISE PLAYER ====================

let whiteNoiseAudio = null;
let whiteNoiseVolume = 1.0;

function setupWhiteNoisePlayer() {
  const noiseSelect = document.getElementById('whiteNoiseSelect');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeDisplay = document.getElementById('volumeDisplay');

  if (noiseSelect) {
    noiseSelect.addEventListener('change', (e) => {
      handleWhiteNoise(e.target.value);
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      const volume = parseInt(e.target.value) / 100;
      setWhiteNoiseVolume(volume);
      if (volumeDisplay) {
        volumeDisplay.textContent = e.target.value + '%';
      }
    });
  }
}

function handleWhiteNoise(value) {
  const noiseStatus = document.getElementById('noiseStatus');

  if (whiteNoiseAudio) {
    whiteNoiseAudio.pause();
    whiteNoiseAudio = null;
  }

  if (value === 'off') {
    updateNoiseStatus('🔇', 'No sound playing');
    return;
  }

  const src = chrome.runtime.getURL(`sounds/${value}.mp3`);
  whiteNoiseAudio = new Audio(src);
  whiteNoiseAudio.loop = true;
  whiteNoiseAudio.volume = whiteNoiseVolume;

  whiteNoiseAudio.play()
    .then(() => {
      const soundNames = {
        'rain': '🌧️ Rain',
        'waves': '🌊 Ocean Waves',
        'fan': '💨 Fan'
      };
      updateNoiseStatus('🔊', `Playing: ${soundNames[value] || value}`);
    })
    .catch(() => {
      updateNoiseStatus('⚠️', 'File not found - add to /sounds folder');
      alert('Add your white noise file to /sounds and reload the extension.');
    });
}

function updateNoiseStatus(icon, text) {
  const statusIcon = document.querySelector('.noise-status .status-icon');
  const statusText = document.querySelector('.noise-status .status-text');
  if (statusIcon) statusIcon.textContent = icon;
  if (statusText) statusText.textContent = text;
}

function setWhiteNoiseVolume(volume) {
  whiteNoiseVolume = volume;
  if (whiteNoiseAudio) {
    whiteNoiseAudio.volume = volume;
  }
}

// Cleanup on page close
window.addEventListener('beforeunload', () => {
  if (whiteNoiseAudio) {
    whiteNoiseAudio.pause();
    whiteNoiseAudio = null;
  }
});

// --- ROBUST PDF GENERATION (v2) ---
async function downloadDashboardAsPDF_Safe() {
  const pdfBtn = document.getElementById('pdfBtn');
  const originalLabel = pdfBtn.textContent;

  try {
    pdfBtn.disabled = true;
    pdfBtn.textContent = '? Preparing PDF...';

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    const dashboardElement = document.getElementById('dashboardContent');
    const insightsElement = document.getElementById('insightsSection');

    // Helper to sanitize cloned document for print
    const sanitizeForPrint = (clonedDoc) => {
      const body = clonedDoc.body;

      // Force global styles
      body.style.setProperty('backgroundColor', '#ffffff', 'important');
      body.style.setProperty('color', '#000000', 'important');
      body.style.setProperty('background', '#ffffff', 'important');

      // Force ALL elements to have black text - be extremely aggressive
      const allElements = clonedDoc.querySelectorAll('*');
      allElements.forEach(el => {
        // Force black text on EVERYTHING
        el.style.setProperty('color', '#000000', 'important');
        el.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
        el.style.setProperty('text-shadow', 'none', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('visibility', 'visible', 'important');

        // Remove ALL backgrounds that might interfere
        const tagName = el.tagName.toLowerCase();
        if (tagName !== 'header' && tagName !== 'body') {
          el.style.setProperty('background', 'none', 'important');
          el.style.setProperty('background-image', 'none', 'important');
          el.style.setProperty('background-clip', 'border-box', 'important');
        }

        // Specific fixes for stat values
        if (el.classList.contains('stat-value')) {
          el.style.color = '#003d82';
          el.style.setProperty('color', '#0066cc', 'important');
          el.style.setProperty('-webkit-text-fill-color', '#0066cc', 'important');
        }

        // Fix headers to have white text on blue background
        if (tagName === 'header') {
          el.style.setProperty('background', '#0ea5e9', 'important');
          el.style.setProperty('color', '#000000', 'important');
        }

        // Force white text for header children
        if (el.closest('header')) {
          el.style.color = '#ffffff';
          el.style.setProperty('color', '#ffffff', 'important');
          el.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
        }

        // Ensure card backgrounds are white
        if (el.classList.contains('stat-card') || el.classList.contains('section')) {
          el.style.setProperty('backgroundColor', '#ffffff', 'important');
          el.style.setProperty('border', '1px solid #ddd', 'important');
          el.style.setProperty('box-shadow', 'none', 'important');
        }
      });
    };

    // --- PAGE 1: Main Dashboard (excluding Insights) ---
    const canvasMain = await html2canvas(dashboardElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      ignoreElements: (element) => element.id === 'insightsSection' || element.classList.contains('white-noise-section'),
      onclone: sanitizeForPrint
    });

    const imgDataMain = canvasMain.toDataURL('image/jpeg', 0.95);
    const imgHeightMain = (canvasMain.height * contentWidth) / canvasMain.width;
    doc.addImage(imgDataMain, 'JPEG', margin, margin, contentWidth, imgHeightMain);

    // --- PAGE 2: Productivity Insights ---
    if (insightsElement) {
      const canvasInsights = await html2canvas(insightsElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        onclone: sanitizeForPrint
      });

      const imgDataInsights = canvasInsights.toDataURL('image/jpeg', 0.95);
      const imgHeightInsights = (canvasInsights.height * contentWidth) / canvasInsights.width;

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Productivity Insights', margin, margin + 10);
      doc.addImage(imgDataInsights, 'JPEG', margin, margin + 20, contentWidth, imgHeightInsights);
    }

    doc.save('focus-first-report.pdf');

  } catch (error) {
    console.error('Error saving PDF:', error);
    alert('Failed to save PDF.');
  } finally {
    pdfBtn.disabled = false;
    pdfBtn.textContent = originalLabel;
  }
}

