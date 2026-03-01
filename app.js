/* ===== Agent Performance Dashboard — Main Application ===== */

(() => {
  'use strict';

  // ===== CONFIG =====
  const SHEET_ID = '1rmlrMYfxqqE3tTd7NqNahI22FNecAKpgaK-UTOFVHP8';
  const CALL_LOG_GID = '0';
  const TICKET_GID = '1982537380';
  const REFRESH_INTERVAL = 60000; // 60 seconds
  const CORS_PROXY = ''; // set if needed, e.g. 'https://corsproxy.io/?'

  function getSheetURL(gid) {
    return `${CORS_PROXY}https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  }

  // ===== STATE =====
  let callData = [];
  let ticketData = [];
  let filteredCalls = [];
  let filteredTickets = [];
  let charts = {};
  let refreshTimer = null;

  // ===== DOM REFERENCES =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ===== CSV PARSER =====
  function parseCSV(text) {
    const lines = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (current.length > 0) {
          lines.push(current);
        }
        current = '';
        if (ch === '\r' && text[i + 1] === '\n') i++;
      } else {
        current += ch;
      }
    }
    if (current.length > 0) lines.push(current);

    if (lines.length === 0) return [];

    const headers = parseLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h.trim()] = (values[idx] || '').trim();
      });
      rows.push(obj);
    }
    return rows;
  }

  function parseLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  // ===== TIME HELPERS =====
  function parseTimeStr(str) {
    // formats: "0:00:05", "0:01:04"
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  function formatSeconds(secs) {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function parseDatetime(str) {
    // "02/25/2026, 11:56 PM" → Date
    if (!str) return null;
    try {
      return new Date(str);
    } catch {
      return null;
    }
  }

  function getDateStr(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function isToday(date) {
    const now = new Date();
    return date && getDateStr(date) === getDateStr(now);
  }

  function isYesterday(date) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date && getDateStr(date) === getDateStr(yesterday);
  }

  function isWithinDays(date, days) {
    if (!date) return false;
    const now = new Date();
    const diff = (now - date) / (1000 * 60 * 60 * 24);
    return diff <= days;
  }

  // ===== DATA FETCHING =====
  async function fetchCSV(gid) {
    const url = getSheetURL(gid);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch sheet (gid=${gid}): ${resp.status}`);
    return await resp.text();
  }

  async function loadAllData() {
    try {
      const [callCSV, ticketCSV] = await Promise.all([
        fetchCSV(CALL_LOG_GID),
        fetchCSV(TICKET_GID)
      ]);

      callData = parseCSV(callCSV).map(row => ({
        ...row,
        _startDate: parseDatetime(row['Call Start Time']),
        _endDate: parseDatetime(row['Call End Time']),
        _talkSecs: parseTimeStr(row['Talk Time']),
        _queueSecs: parseTimeStr(row['Queue Time']),
        _ringSecs: parseTimeStr(row['Ring Time']),
        _surveyScore: row['Survey Score'] !== '' ? Number(row['Survey Score']) : null,
        _hasSurvey: row['Transfer Survey'] === 'TRUE',
      }));

      ticketData = parseCSV(ticketCSV).map(row => ({
        ...row,
        _cat1: row['Category 1'] || '',
        _cat2: row['Category 2'] || '',
        _cat3: row[' Category 3'] || row['Category 3'] || '',
      }));

      populateFilters();
      applyFilters();
      updateDashboard();
      updateTimestamp();

      // Hide loading
      const overlay = $('#loadingOverlay');
      if (overlay) overlay.classList.add('hidden');

    } catch (err) {
      console.error('Error loading data:', err);
      showToast('⚠️ ไม่สามารถดึงข้อมูลจาก Google Sheet ได้ — กรุณา Publish to Web ก่อน', 'error');
      const overlay = $('#loadingOverlay');
      if (overlay) overlay.classList.add('hidden');
    }
  }

  // ===== FILTERS =====
  function populateFilters() {
    // Agent filter
    const agents = [...new Set(callData.map(r => r['Agent Name']).filter(Boolean))].sort();
    const agentSel = $('#agentFilter');
    const currentAgent = agentSel.value;
    agentSel.innerHTML = '<option value="all">👤 All Agents</option>';
    agents.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      agentSel.appendChild(opt);
    });
    agentSel.value = currentAgent || 'all';

    // Channel filter
    const channels = [...new Set(callData.map(r => r['Queue Name']).filter(Boolean))].sort();
    const chSel = $('#channelFilter');
    const currentCh = chSel.value;
    chSel.innerHTML = '<option value="all">📞 All Channels</option>';
    channels.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      // shorten display name
      opt.textContent = c.replace('Lottery ', '').substring(0, 40);
      chSel.appendChild(opt);
    });
    chSel.value = currentCh || 'all';
  }

  function applyFilters() {
    const agent = $('#agentFilter').value;
    const dateRange = $('#dateFilter').value;
    const channel = $('#channelFilter').value;

    filteredCalls = callData.filter(row => {
      // Agent filter
      if (agent !== 'all' && row['Agent Name'] !== agent) return false;

      // Channel filter
      if (channel !== 'all' && row['Queue Name'] !== channel) return false;

      // Date filter
      const d = row._startDate;
      if (!d) return false;
      switch (dateRange) {
        case 'today': return isToday(d);
        case 'yesterday': return isYesterday(d);
        case '7days': return isWithinDays(d, 7);
        case '30days': return isWithinDays(d, 30);
        default: return true;
      }
    });

    // For tickets, filter by date (rough match by วันที่ field)
    filteredTickets = ticketData; // tickets don't have detailed datetime, so show all
  }

  // ===== KPI CALCULATIONS =====
  function calcKPIs() {
    const total = filteredCalls.length;
    const incoming = filteredCalls.filter(r => r['Direction'] === 'Incoming').length;
    const outgoing = filteredCalls.filter(r => r['Direction'] === 'Outgoing').length;
    const answered = filteredCalls.filter(r => r['Status'] === 'Answered').length;
    const unanswered = filteredCalls.filter(r => r['Status'] === 'Unanswered').length;
    const answeredRate = total > 0 ? (answered / total * 100) : 0;

    // AHT: average of talk time for answered calls
    const answeredCalls = filteredCalls.filter(r => r['Status'] === 'Answered' && r._talkSecs > 0);
    const avgTalkSecs = answeredCalls.length > 0
      ? answeredCalls.reduce((s, r) => s + r._talkSecs, 0) / answeredCalls.length
      : 0;

    // Queue time average (incoming only)
    const incomingCalls = filteredCalls.filter(r => r['Direction'] === 'Incoming' && r._queueSecs >= 0);
    const avgQueueSecs = incomingCalls.length > 0
      ? incomingCalls.reduce((s, r) => s + r._queueSecs, 0) / incomingCalls.length
      : 0;

    // CSAT
    const surveyed = filteredCalls.filter(r => r._hasSurvey && r._surveyScore !== null);
    const csatAvg = surveyed.length > 0
      ? surveyed.reduce((s, r) => s + r._surveyScore, 0) / surveyed.length
      : 0;

    // Tickets
    const totalTickets = filteredTickets.length;
    const infoCount = filteredTickets.filter(r => r._cat1 === 'Info').length;
    const problemCount = filteredTickets.filter(r => r._cat1 === 'Problem').length;
    const requestCount = filteredTickets.filter(r => r._cat1 === 'Request').length;

    return {
      total, incoming, outgoing, answered, unanswered, answeredRate,
      avgTalkSecs, avgQueueSecs, csatAvg, surveyCount: surveyed.length,
      totalTickets, infoCount, problemCount, requestCount
    };
  }

  // ===== UPDATE KPI CARDS =====
  function updateKPIs(kpi) {
    animateValue('#valTotalCalls', kpi.total);
    $('#subTotalCalls').innerHTML = `In: <span class="up">${kpi.incoming}</span> &bull; Out: <span class="up">${kpi.outgoing}</span>`;

    $('#valAnswered').textContent = `${kpi.answeredRate.toFixed(1)}%`;
    $('#subAnswered').innerHTML = `Answered: <span class="up">${kpi.answered}</span> &bull; Missed: <span class="down">${kpi.unanswered}</span>`;

    $('#valAHT').textContent = formatSeconds(kpi.avgTalkSecs);
    $('#subAHT').textContent = `avg talk time per call`;

    $('#valCSAT').textContent = kpi.surveyCount > 0 ? kpi.csatAvg.toFixed(1) : 'N/A';
    $('#subCSAT').textContent = `from ${kpi.surveyCount} surveys`;

    $('#valAvgQueue').textContent = formatSeconds(kpi.avgQueueSecs);
    $('#subAvgQueue').textContent = `customer wait time`;

    animateValue('#valTickets', kpi.totalTickets);
    $('#subTickets').innerHTML = `Info: ${kpi.infoCount} &bull; Problem: ${kpi.problemCount} &bull; Request: ${kpi.requestCount}`;
  }

  function animateValue(selector, target) {
    const el = $(selector);
    const current = parseInt(el.textContent) || 0;
    if (current === target) { el.textContent = target; return; }

    const steps = 30;
    const inc = (target - current) / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step >= steps) {
        el.textContent = target;
        clearInterval(timer);
      } else {
        el.textContent = Math.round(current + inc * step);
      }
    }, 20);
  }

  // ===== CHARTS =====
  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { family: 'Inter', size: 11 },
          padding: 12,
          usePointStyle: true,
          pointStyleWidth: 8,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        titleFont: { family: 'Inter', weight: 600 },
        bodyFont: { family: 'Inter' },
      }
    }
  };

  function buildDailyVolumeChart() {
    // Group calls by date
    const dailyMap = {};
    filteredCalls.forEach(r => {
      const ds = r._startDate ? getDateStr(r._startDate) : null;
      if (!ds) return;
      if (!dailyMap[ds]) dailyMap[ds] = { answered: 0, unanswered: 0 };
      if (r['Status'] === 'Answered') dailyMap[ds].answered++;
      else dailyMap[ds].unanswered++;
    });

    const dates = Object.keys(dailyMap).sort();
    const answeredArr = dates.map(d => dailyMap[d].answered);
    const unansweredArr = dates.map(d => dailyMap[d].unanswered);
    const labels = dates.map(d => {
      const dt = new Date(d);
      return dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    });

    if (charts.dailyVolume) charts.dailyVolume.destroy();

    const ctx = $('#chartDailyVolume').getContext('2d');
    charts.dailyVolume = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Answered',
            data: answeredArr,
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
          },
          {
            label: 'Unanswered',
            data: unansweredArr,
            backgroundColor: 'rgba(239, 68, 68, 0.6)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
          }
        ]
      },
      options: {
        ...chartDefaults,
        scales: {
          x: {
            stacked: true,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
          }
        },
        plugins: {
          ...chartDefaults.plugins,
          legend: { ...chartDefaults.plugins.legend, position: 'top' }
        }
      }
    });
  }

  function buildCategoryChart() {
    const catMap = {};
    filteredTickets.forEach(r => {
      const cat = r._cat2 || r._cat1 || 'Other';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });

    // Sort by count desc, take top 8
    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 8);
    const otherCount = sorted.slice(8).reduce((s, e) => s + e[1], 0);
    if (otherCount > 0) top.push(['อื่นๆ', otherCount]);

    const colors = [
      '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
      '#f59e0b', '#ec4899', '#3b82f6', '#ef4444', '#64748b'
    ];

    if (charts.category) charts.category.destroy();

    const ctx = $('#chartCategory').getContext('2d');
    charts.category = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: top.map(e => e[0]),
        datasets: [{
          data: top.map(e => e[1]),
          backgroundColor: colors.slice(0, top.length),
          borderColor: 'rgba(10, 14, 26, 0.8)',
          borderWidth: 2,
          hoverOffset: 6,
        }]
      },
      options: {
        ...chartDefaults,
        cutout: '60%',
        plugins: {
          ...chartDefaults.plugins,
          legend: {
            ...chartDefaults.plugins.legend,
            position: 'right',
            labels: {
              ...chartDefaults.plugins.legend.labels,
              boxWidth: 12,
              padding: 8,
              font: { family: 'Inter', size: 10 },
            }
          }
        }
      }
    });
  }

  function buildAgentComparisonChart() {
    const agentMap = {};
    filteredCalls.forEach(r => {
      const name = r['Agent Name'];
      if (!name) return;
      if (!agentMap[name]) agentMap[name] = { total: 0, answered: 0, talkSum: 0 };
      agentMap[name].total++;
      if (r['Status'] === 'Answered') {
        agentMap[name].answered++;
        agentMap[name].talkSum += r._talkSecs;
      }
    });

    const agents = Object.entries(agentMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);

    const labels = agents.map(a => {
      // Shorten long names
      const parts = a[0].split(' ');
      return parts.length > 1 ? `${parts[0]} ${parts[1].charAt(0)}.` : parts[0];
    });

    if (charts.agentComp) charts.agentComp.destroy();

    const ctx = $('#chartAgentComparison').getContext('2d');
    charts.agentComp = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Total Calls',
            data: agents.map(a => a[1].total),
            backgroundColor: 'rgba(99, 102, 241, 0.7)',
            borderColor: 'rgba(99, 102, 241, 1)',
            borderWidth: 1,
            borderRadius: 4,
          }
        ]
      },
      options: {
        ...chartDefaults,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11, weight: 500 } }
          }
        },
        plugins: {
          ...chartDefaults.plugins,
          legend: { display: false }
        }
      }
    });
  }

  // ===== AGENT RANKING TABLE =====
  function buildRankingTable() {
    const agentMap = {};
    filteredCalls.forEach(r => {
      const name = r['Agent Name'];
      if (!name) return;
      if (!agentMap[name]) {
        agentMap[name] = { total: 0, answered: 0, talkSum: 0, talkCount: 0, csatSum: 0, csatCount: 0 };
      }
      agentMap[name].total++;
      if (r['Status'] === 'Answered') {
        agentMap[name].answered++;
        if (r._talkSecs > 0) {
          agentMap[name].talkSum += r._talkSecs;
          agentMap[name].talkCount++;
        }
      }
      if (r._hasSurvey && r._surveyScore !== null) {
        agentMap[name].csatSum += r._surveyScore;
        agentMap[name].csatCount++;
      }
    });

    // Calculate performance score: 40% answered rate + 30% call volume (normalized) + 30% CSAT
    const agents = Object.entries(agentMap).map(([name, d]) => {
      const answeredRate = d.total > 0 ? d.answered / d.total : 0;
      const avgTalk = d.talkCount > 0 ? d.talkSum / d.talkCount : 0;
      const csat = d.csatCount > 0 ? d.csatSum / d.csatCount : 0;
      return { name, ...d, answeredRate, avgTalk, csat };
    });

    const maxCalls = Math.max(...agents.map(a => a.total), 1);

    agents.forEach(a => {
      const volumeScore = a.total / maxCalls; // normalized 0-1
      const ansScore = a.answeredRate;         // 0-1
      const csatScore = a.csat / 5;           // 0-1
      a.perfScore = (ansScore * 0.4 + volumeScore * 0.3 + csatScore * 0.3) * 100;
    });

    agents.sort((a, b) => b.perfScore - a.perfScore);

    const tbody = $('#rankingBody');
    if (agents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">No data for selected filters</td></tr>';
      return;
    }

    tbody.innerHTML = agents.map((a, i) => {
      const rank = i + 1;
      const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';

      const answeredPct = (a.answeredRate * 100).toFixed(1);
      const barColor = a.answeredRate >= 0.9 ? 'var(--accent-emerald)'
        : a.answeredRate >= 0.7 ? 'var(--accent-amber)'
        : 'var(--accent-red)';

      const csatDisplay = a.csatCount > 0 ? a.csat.toFixed(1) : 'N/A';
      const scoreClass = a.csat >= 4 ? 'score-excellent'
        : a.csat >= 3 ? 'score-good'
        : a.csat >= 2 ? 'score-average'
        : a.csatCount > 0 ? 'score-poor'
        : 'score-average';

      const perfWidth = Math.min(a.perfScore, 100);
      const perfColor = a.perfScore >= 70 ? 'var(--accent-emerald)'
        : a.perfScore >= 50 ? 'var(--accent-amber)'
        : 'var(--accent-red)';

      return `<tr>
        <td><span class="rank-badge ${rankClass}">${medal || rank}</span></td>
        <td><span class="agent-name">${a.name}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;font-weight:600">${a.total}</td>
        <td>
          ${answeredPct}%
          <span class="progress-bar-wrap">
            <span class="progress-bar-fill" style="width:${answeredPct}%;background:${barColor}"></span>
          </span>
        </td>
        <td style="font-family:'JetBrains Mono',monospace">${formatSeconds(a.avgTalk)}</td>
        <td><span class="score-badge ${scoreClass}">⭐ ${csatDisplay}</span></td>
        <td>
          <span class="progress-bar-wrap" style="width:100px">
            <span class="progress-bar-fill" style="width:${perfWidth}%;background:${perfColor}"></span>
          </span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;margin-left:4px;color:var(--text-secondary)">${a.perfScore.toFixed(0)}</span>
        </td>
      </tr>`;
    }).join('');
  }

  // ===== UPDATE ALL =====
  function updateDashboard() {
    const kpi = calcKPIs();
    updateKPIs(kpi);
    buildDailyVolumeChart();
    buildCategoryChart();
    buildAgentComparisonChart();
    buildRankingTable();
  }

  function updateTimestamp() {
    const now = new Date();
    $('#lastUpdated').textContent = `Updated: ${now.toLocaleTimeString('th-TH')}`;
  }

  // ===== TOAST =====
  function showToast(msg, type = 'error') {
    const div = document.createElement('div');
    div.className = `toast ${type === 'success' ? 'success' : ''}`;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
  }

  // ===== EVENT LISTENERS =====
  function setupEventListeners() {
    $('#agentFilter').addEventListener('change', () => {
      applyFilters();
      updateDashboard();
    });
    $('#dateFilter').addEventListener('change', () => {
      applyFilters();
      updateDashboard();
    });
    $('#channelFilter').addEventListener('change', () => {
      applyFilters();
      updateDashboard();
    });
  }

  // ===== AUTO REFRESH =====
  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(async () => {
      try {
        await loadAllData();
        console.log('[Dashboard] Auto-refreshed at', new Date().toLocaleTimeString());
      } catch (err) {
        console.error('[Dashboard] Auto-refresh error:', err);
      }
    }, REFRESH_INTERVAL);
  }

  // ===== INIT =====
  async function init() {
    setupEventListeners();
    await loadAllData();
    startAutoRefresh();
  }

  // Start!
  document.addEventListener('DOMContentLoaded', init);

})();
