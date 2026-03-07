// =============================================
//  CRM PERFORMANCE - LOTTERY PLUS
//  Google Apps Script Backend
//  Deploy as Web App: Execute as me, Anyone can access
// =============================================

// === CONFIGURATION ===
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // Replace with your Google Sheets ID
const SHEET_NAMES = {
  USERS: 'Users',
  PHONE_CALL: 'PhoneCall',
  LINE_OA: 'LineOA',
  LINE_OPC: 'LineOPC',
  SOCIAL_MEDIA: 'SocialMedia',
  APPROVE: 'Approve',
  CATEGORY: 'Category',
  FORMAT: 'Format',
  PASSWORD_RESETS: 'PasswordResets',
  LOGIN_LOGS: 'LoginLogs'
};

// === WEB APP ENTRY POINTS ===
function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback;
  let result;
  try {
    switch (action) {
      case 'getCategories': result = getCategories(); break;
      case 'getPeriods': result = getPeriods(); break;
      case 'getCurrentPeriod': result = getCurrentPeriod(); break;
      case 'getUsers': result = getUsers(); break;
      case 'getPasswordResets': result = getPasswordResets(); break;
      default: result = { error: 'Unknown action' };
    }
  } catch (err) {
    result = { error: err.message };
  }
  const output = JSON.stringify(result);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + output + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  let result;
  try {
    const data = JSON.parse(e.postData.contents);
    switch (data.action) {
      case 'login': result = login(data.username, data.password); break;
      case 'submitEntry': result = submitEntry(data.team, data.entry); break;
      case 'getEntries': result = getEntries(data.team, data.filters); break;
      case 'getDashboardData': result = getDashboardData(data.filters); break;
      case 'createUser': result = createUser(data.user); break;
      case 'updateUser': result = updateUser(data.user); break;
      case 'deleteUser': result = deleteUser(data.userId); break;
      case 'requestPasswordReset': result = requestPasswordReset(data.username); break;
      case 'approvePasswordReset': result = approvePasswordReset(data.requestId, data.newPassword); break;
      case 'changePassword': result = changePassword(data.username, data.oldPassword, data.newPassword); break;
      default: result = { error: 'Unknown action' };
    }
  } catch (err) {
    result = { error: err.message };
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// === AUTHENTICATION ===
function login(username, password) {
  const sheet = getSheet(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const usernameCol = headers.indexOf('username');
  const passwordCol = headers.indexOf('password');
  const displayNameCol = headers.indexOf('displayName');
  const teamCol = headers.indexOf('team');
  const roleCol = headers.indexOf('role');
  const statusCol = headers.indexOf('status');

  for (let i = 1; i < data.length; i++) {
    if (data[i][usernameCol] === username && data[i][passwordCol] === password) {
      if (statusCol >= 0 && data[i][statusCol] === 'inactive') {
        return { success: false, error: 'บัญชีถูกระงับ กรุณาติดต่อแอดมิน' };
      }
      // Log login
      logLogin(username, 'success');
      return {
        success: true,
        user: {
          id: i,
          username: data[i][usernameCol],
          displayName: data[i][displayNameCol],
          team: data[i][teamCol],
          role: data[i][roleCol]
        }
      };
    }
  }
  logLogin(username, 'failed');
  return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
}

function logLogin(username, status) {
  try {
    const sheet = getOrCreateSheet(SHEET_NAMES.LOGIN_LOGS,
      ['timestamp', 'username', 'status']);
    sheet.appendRow([new Date(), username, status]);
  } catch (e) { /* ignore logging errors */ }
}

// === DATA ENTRY ===
function submitEntry(team, entry) {
  const sheetName = getTeamSheetName(team);
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => {
    if (h === 'timestamp') return new Date();
    if (h === 'period') return getCurrentPeriod().period;
    return entry[h] || '';
  });
  sheet.appendRow(row);
  return { success: true, message: 'บันทึกข้อมูลสำเร็จ' };
}

function getEntries(team, filters) {
  const sheetName = getTeamSheetName(team);
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { entries: [], headers: data[0] || [] };
  const headers = data[0];
  const tsCol = headers.indexOf('timestamp');
  const agentCol = headers.indexOf('agent');
  const periodCol = headers.indexOf('period');
  let entries = data.slice(1).map((row, i) => {
    const obj = {};
    headers.forEach((h, j) => obj[h] = row[j]);
    obj._row = i + 2;
    return obj;
  });

  // Apply filters
  if (filters) {
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      entries = entries.filter(e => new Date(e.timestamp) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      entries = entries.filter(e => new Date(e.timestamp) <= to);
    }
    if (filters.agent) {
      entries = entries.filter(e => e.agent === filters.agent);
    }
    if (filters.period) {
      entries = entries.filter(e => e.period === filters.period);
    }
  }
  return { entries, headers };
}

// === DASHBOARD ===
function getDashboardData(filters) {
  const teams = filters.team && filters.team !== 'all'
    ? [filters.team]
    : ['phonecall', 'lineoa', 'lineopc', 'socialmedia', 'approve'];

  let allEntries = [];
  teams.forEach(team => {
    const result = getEntries(team, filters);
    result.entries.forEach(e => { e._team = team; });
    allEntries = allEntries.concat(result.entries);
  });

  // Productivity per agent
  const agentStats = {};
  const hourlyData = {};
  const dailyData = {};

  allEntries.forEach(entry => {
    const agent = entry.agent || 'Unknown';
    const ts = new Date(entry.timestamp);
    const hour = ts.getHours();
    const dateStr = Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    // Per agent count
    if (!agentStats[agent]) agentStats[agent] = { total: 0, team: entry._team };
    agentStats[agent].total++;

    // Hourly breakdown
    if (!hourlyData[dateStr]) hourlyData[dateStr] = {};
    if (!hourlyData[dateStr][hour]) hourlyData[dateStr][hour] = {};
    if (!hourlyData[dateStr][hour][agent]) hourlyData[dateStr][hour][agent] = 0;
    hourlyData[dateStr][hour][agent]++;

    // Daily totals
    if (!dailyData[dateStr]) dailyData[dateStr] = {};
    if (!dailyData[dateStr][agent]) dailyData[dateStr][agent] = 0;
    dailyData[dateStr][agent]++;
  });

  // Compute date range
  const dates = Object.keys(dailyData).sort();
  const numDays = dates.length || 1;

  // Per agent productivity
  const productivity = Object.entries(agentStats).map(([name, stats]) => ({
    agent: name,
    team: stats.team,
    total: stats.total,
    perDay: Math.round(stats.total / numDays * 10) / 10
  })).sort((a, b) => b.total - a.total);

  // Comparison data (daily totals with % change)
  const comparison = dates.map((date, i) => {
    const dayTotal = Object.values(dailyData[date]).reduce((s, v) => s + v, 0);
    const prevTotal = i > 0
      ? Object.values(dailyData[dates[i - 1]]).reduce((s, v) => s + v, 0)
      : null;
    const change = prevTotal !== null
      ? Math.round((dayTotal - prevTotal) / prevTotal * 1000) / 10
      : null;
    return { date, total: dayTotal, change };
  });

  return {
    totalEntries: allEntries.length,
    totalAgents: Object.keys(agentStats).length,
    avgPerAgent: Object.keys(agentStats).length > 0
      ? Math.round(allEntries.length / Object.keys(agentStats).length * 10) / 10
      : 0,
    avgPerDay: Math.round(allEntries.length / numDays * 10) / 10,
    productivity,
    hourlyData,
    dailyData,
    comparison,
    dates,
    agents: Object.keys(agentStats).sort()
  };
}

// === USER MANAGEMENT ===
function getUsers() {
  const sheet = getSheet(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { users: [] };
  const headers = data[0];
  const users = data.slice(1).map((row, i) => {
    const user = {};
    headers.forEach((h, j) => user[h] = row[j]);
    user.id = i + 2; // row number
    delete user.password; // don't expose passwords
    return user;
  });
  return { users };
}

function createUser(user) {
  const sheet = getSheet(SHEET_NAMES.USERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  // Check for duplicate username
  const data = sheet.getDataRange().getValues();
  const usernameCol = headers.indexOf('username');
  for (let i = 1; i < data.length; i++) {
    if (data[i][usernameCol] === user.username) {
      return { success: false, error: 'ชื่อผู้ใช้ซ้ำ' };
    }
  }
  const row = headers.map(h => user[h] || '');
  sheet.appendRow(row);
  return { success: true, message: 'เพิ่มผู้ใช้สำเร็จ' };
}

function updateUser(user) {
  const sheet = getSheet(SHEET_NAMES.USERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowNum = user.id;
  headers.forEach((h, j) => {
    if (h !== 'password' && user[h] !== undefined) {
      sheet.getRange(rowNum, j + 1).setValue(user[h]);
    }
  });
  return { success: true, message: 'อัปเดตผู้ใช้สำเร็จ' };
}

function deleteUser(userId) {
  const sheet = getSheet(SHEET_NAMES.USERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('status');
  if (statusCol >= 0) {
    sheet.getRange(userId, statusCol + 1).setValue('inactive');
  } else {
    sheet.deleteRow(userId);
  }
  return { success: true, message: 'ลบผู้ใช้สำเร็จ' };
}

// === PASSWORD MANAGEMENT ===
function requestPasswordReset(username) {
  const sheet = getOrCreateSheet(SHEET_NAMES.PASSWORD_RESETS,
    ['id', 'username', 'timestamp', 'status']);
  const id = Utilities.getUuid().substring(0, 8);
  sheet.appendRow([id, username, new Date(), 'pending']);
  return { success: true, message: 'ส่งคำขอรีเซ็ตรหัสผ่านถึงแอดมินแล้ว' };
}

function approvePasswordReset(requestId, newPassword) {
  const resetSheet = getSheet(SHEET_NAMES.PASSWORD_RESETS);
  const resetData = resetSheet.getDataRange().getValues();
  const headers = resetData[0];
  const idCol = headers.indexOf('id');
  const usernameCol = headers.indexOf('username');
  const statusCol = headers.indexOf('status');

  for (let i = 1; i < resetData.length; i++) {
    if (resetData[i][idCol] === requestId) {
      const username = resetData[i][usernameCol];
      // Update password in Users sheet
      const userSheet = getSheet(SHEET_NAMES.USERS);
      const userData = userSheet.getDataRange().getValues();
      const userHeaders = userData[0];
      const uCol = userHeaders.indexOf('username');
      const pCol = userHeaders.indexOf('password');
      for (let j = 1; j < userData.length; j++) {
        if (userData[j][uCol] === username) {
          userSheet.getRange(j + 1, pCol + 1).setValue(newPassword);
          break;
        }
      }
      // Update reset request status
      resetSheet.getRange(i + 1, statusCol + 1).setValue('approved');
      return { success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบคำขอ' };
}

function getPasswordResets() {
  const sheet = getOrCreateSheet(SHEET_NAMES.PASSWORD_RESETS,
    ['id', 'username', 'timestamp', 'status']);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { requests: [] };
  const headers = data[0];
  const requests = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, j) => obj[h] = row[j]);
    return obj;
  }).filter(r => r.status === 'pending');
  return { requests };
}

function changePassword(username, oldPassword, newPassword) {
  const sheet = getSheet(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const uCol = headers.indexOf('username');
  const pCol = headers.indexOf('password');
  for (let i = 1; i < data.length; i++) {
    if (data[i][uCol] === username) {
      if (data[i][pCol] !== oldPassword) {
        return { success: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' };
      }
      sheet.getRange(i + 1, pCol + 1).setValue(newPassword);
      return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบผู้ใช้' };
}

// === CATEGORY & PERIOD DATA ===
function getCategories() {
  const sheet = getSheet(SHEET_NAMES.CATEGORY);
  const data = sheet.getDataRange().getValues();
  const categories = data.slice(1).map(row => ({
    cat1: row[0],
    cat2: row[1],
    cat3: row[2]
  })).filter(c => c.cat1 && c.cat2 && c.cat3);
  return { categories };
}

function getPeriods() {
  const sheet = getSheet(SHEET_NAMES.FORMAT);
  const data = sheet.getDataRange().getValues();
  const periods = [];
  const seen = new Set();
  data.slice(1).forEach(row => {
    const period = row[1];
    if (period && !seen.has(period)) {
      seen.add(period);
      periods.push(period);
    }
  });
  return { periods };
}

function getCurrentPeriod() {
  const sheet = getSheet(SHEET_NAMES.FORMAT);
  const data = sheet.getDataRange().getValues();
  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'd MMM yyyy');

  for (let i = 1; i < data.length; i++) {
    const dateVal = data[i][0];
    const periodVal = data[i][1];
    if (dateVal) {
      const rowDate = new Date(dateVal);
      if (rowDate.getFullYear() === today.getFullYear() &&
        rowDate.getMonth() === today.getMonth() &&
        rowDate.getDate() === today.getDate()) {
        return { period: periodVal };
      }
    }
  }
  // Fallback: compute from date pattern
  return { period: computePeriodFromDate(today) };
}

function computePeriodFromDate(date) {
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let periodNum, periodLabel;
  if (day <= 16) {
    // First half: odd period
    periodNum = month * 2 + 1;
    periodLabel = String(periodNum).padStart(2, '0') + ' - 16 ' + monthNames[month] + ' ' + date.getFullYear();
  } else {
    // Second half: even period
    periodNum = month * 2 + 2;
    const nextMonth = (month + 1) % 12;
    const nextYear = month === 11 ? date.getFullYear() + 1 : date.getFullYear();
    periodLabel = String(periodNum).padStart(2, '0') + ' - 01 ' + monthNames[nextMonth] + ' ' + nextYear;
  }
  return periodLabel;
}

// === UTILITY FUNCTIONS ===
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" not found');
  return sheet;
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers) sheet.appendRow(headers);
  }
  return sheet;
}

function getTeamSheetName(team) {
  const map = {
    phonecall: SHEET_NAMES.PHONE_CALL,
    lineoa: SHEET_NAMES.LINE_OA,
    lineopc: SHEET_NAMES.LINE_OPC,
    socialmedia: SHEET_NAMES.SOCIAL_MEDIA,
    approve: SHEET_NAMES.APPROVE
  };
  return map[team] || team;
}

// === SETUP FUNCTION ===
// Run this once to create all required sheets
function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Users sheet
  getOrCreateSheet(SHEET_NAMES.USERS,
    ['username', 'password', 'displayName', 'team', 'role', 'status']);

  // Team data sheets
  getOrCreateSheet(SHEET_NAMES.PHONE_CALL,
    ['timestamp', 'agent', 'period', 'phone_number', 'category1', 'category2', 'category3']);

  getOrCreateSheet(SHEET_NAMES.LINE_OA,
    ['timestamp', 'agent', 'period', 'category1', 'category2', 'category3']);

  getOrCreateSheet(SHEET_NAMES.LINE_OPC,
    ['timestamp', 'agent', 'period', 'room_name', 'answer', 'one_minute', 'two_five_minutes', 'send_content', 'category1', 'category2', 'category3']);

  getOrCreateSheet(SHEET_NAMES.SOCIAL_MEDIA,
    ['timestamp', 'agent', 'period', 'type', 'page', 'category1', 'category2', 'category3']);

  getOrCreateSheet(SHEET_NAMES.APPROVE,
    ['timestamp', 'agent', 'period', 'order_id', 'category1', 'category2', 'category3']);

  // Support sheets
  getOrCreateSheet(SHEET_NAMES.PASSWORD_RESETS,
    ['id', 'username', 'timestamp', 'status']);

  getOrCreateSheet(SHEET_NAMES.LOGIN_LOGS,
    ['timestamp', 'username', 'status']);

  // Add default admin user
  const userSheet = getSheet(SHEET_NAMES.USERS);
  if (userSheet.getLastRow() <= 1) {
    userSheet.appendRow(['admin', 'admin123', 'Admin', 'all', 'admin', 'active']);
  }

  Logger.log('Setup complete! All sheets created.');
}
