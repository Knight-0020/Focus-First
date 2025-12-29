// FocusShield Dashboard Script
// Displays statistics, achievements, and charts

let focusTimeChart = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadDashboardData();
});

// Setup event listeners
function setupEventListeners() {
  const refreshBtn = document.getElementById('refreshBtn');
  const backToPopup = document.getElementById('backToPopup');

  refreshBtn.addEventListener('click', async () => {
    await loadDashboardData();
  });

  backToPopup.addEventListener('click', () => {
    window.close();
  });
}

// Load all dashboard data
async function loadDashboardData() {
  try {
    await Promise.all([
      loadTodayStats(),
      loadStreak(),
      loadTopSites(),
      loadAchievements(),
      loadFocusTimeChart()
    ]);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

// Load today's statistics
async function loadTodayStats() {
  try {
    const sessions = await getTodaySessions();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate total focus time today
    let totalMinutes = 0;
    let distractionCount = 0;
    
    sessions.forEach(session => {
      if (session.totalFocusMinutes) {
        totalMinutes += session.totalFocusMinutes;
      }
      distractionCount += session.distractionCount || 0;
    });

    document.getElementById('todayFocusTime').textContent = `${totalMinutes} min`;
    document.getElementById('todaySessions').textContent = `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`;
    document.getElementById('distractionCount').textContent = distractionCount;

    // Total sessions
    const allSessions = await getAllFocusSessions();
    document.getElementById('totalSessions').textContent = allSessions.filter(s => s.status === 'completed').length;
  } catch (error) {
    console.error('Error loading today stats:', error);
  }
}

// Load streak information
async function loadStreak() {
  try {
    const sessions = await getAllFocusSessions();
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const streak = await calculateStreak(completedSessions);
    
    document.getElementById('streakDays').textContent = `${streak} day${streak !== 1 ? 's' : ''}`;
  } catch (error) {
    console.error('Error loading streak:', error);
  }
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
      'FIRST_SESSION': { name: 'First Steps', description: 'Complete your first focus session' },
      'THREE_SESSIONS_DAY': { name: 'Triple Focus', description: 'Complete 3 focus sessions in one day' },
      'TWO_DAY_STREAK': { name: 'On a Roll', description: 'Maintain a 2-day focus streak' },
      'WEEK_STREAK': { name: 'Week Warrior', description: 'Maintain a 7-day focus streak' }
    };

    const unlockedAchievements = achievements.filter(a => a.unlocked);
    
    if (unlockedAchievements.length === 0) {
      achievementsList.innerHTML = '<p class="empty-state">No achievements unlocked yet</p>';
      return;
    }

    achievementsList.innerHTML = unlockedAchievements.map(achievement => {
      const def = achievementDefinitions[achievement.id] || { name: achievement.id, description: '' };
      const date = new Date(achievement.unlockedAt);
      return `
        <div class="achievement-item unlocked">
          <div class="achievement-icon">🏆</div>
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

    const ctx = document.getElementById('focusTimeChart').getContext('2d');
    
    if (focusTimeChart) {
      focusTimeChart.destroy();
    }

    focusTimeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Focus Time (minutes)',
          data: focusMinutes,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading focus time chart:', error);
  }
}

