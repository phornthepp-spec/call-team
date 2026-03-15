// ============================================================
// CP Management - Google Apps Script Backend
// ============================================================

// === CONFIGURATION ===
const SPREADSHEET_ID = '1-0ynE_WKgU58yok-uISHYiXeOHzughghhJf6vA_sdrs';
const SHEET_NAMES = {
  USERS: 'Users',
  MEMBERS: 'Members',
  CP_TIERS: 'CPTiers',
  REWARD_DISTRIBUTIONS: 'RewardDistributions',
  REWARD_DETAILS: 'RewardDetails',
  LOGIN_LOGS: 'LoginLogs',
  ACTIVITY_LOGS: 'ActivityLogs',
  PASSWORD_RESETS: 'PasswordResets',
  NOTIFICATIONS: 'Notifications',
  REGISTER: 'Register',
  CP_UPDATE_SESSIONS: 'CPUpdateSessions',
  CP_UPDATE_SUBMISSIONS: 'CPUpdateSubmissions',
  MEMBER_CP_HISTORY: 'MemberCPHistory'
};

const DEFAULT_SUPERADMIN = {
  username: 'superadmin',
  password: 'admin1234',
  displayName: 'Super Admin',
  role: 'Super Admin',
  status: 'active'
};

// === UTILITIES ===
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
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
    }
  }
  return sheet;
}

function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { headers: data[0] || [], rows: [] };
  const headers = data[0];
  const rows = data.slice(1).map((row, idx) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    obj._rowIndex = idx + 2; // 1-based, skip header
    return obj;
  });
  return { headers, rows };
}

function generateId() {
  return Utilities.getUuid().split('-')[0];
}

function now() {
  return new Date();
}

function logActivity(user, action, details, oldValue, newValue) {
  try {
    const sheet = getOrCreateSheet(SHEET_NAMES.ACTIVITY_LOGS,
      ['timestamp', 'user', 'action', 'details', 'oldValue', 'newValue']);
    sheet.appendRow([now(), user, action, details || '', oldValue || '', newValue || '']);
  } catch (e) { /* ignore */ }
}

function logLogin(username, action) {
  try {
    const sheet = getOrCreateSheet(SHEET_NAMES.LOGIN_LOGS,
      ['timestamp', 'username', 'action']);
    sheet.appendRow([now(), username, action]);
  } catch (e) { /* ignore */ }
}

// === SETUP ===
function setupSheets() {
  getOrCreateSheet(SHEET_NAMES.USERS,
    ['username', 'password', 'displayName', 'role', 'status', 'profileImage', 'weaponClass', 'forceChangePassword']);
  getOrCreateSheet(SHEET_NAMES.MEMBERS,
    ['id', 'name', 'cpValue', 'tier', 'rewardPercent', 'status']);
  getOrCreateSheet(SHEET_NAMES.CP_TIERS,
    ['id', 'tierName', 'minCP', 'maxCP', 'rewardPercent', 'status']);
  getOrCreateSheet(SHEET_NAMES.REWARD_DISTRIBUTIONS,
    ['id', 'date', 'totalPrize', 'distributedBy', 'status', 'note']);
  getOrCreateSheet(SHEET_NAMES.REWARD_DETAILS,
    ['id', 'distributionId', 'memberId', 'memberName', 'cpValue', 'tier', 'percentage', 'amount']);
  getOrCreateSheet(SHEET_NAMES.LOGIN_LOGS,
    ['timestamp', 'username', 'action']);
  getOrCreateSheet(SHEET_NAMES.ACTIVITY_LOGS,
    ['timestamp', 'user', 'action', 'details', 'oldValue', 'newValue']);
  getOrCreateSheet(SHEET_NAMES.PASSWORD_RESETS,
    ['id', 'timestamp', 'username', 'reason', 'status']);
  getOrCreateSheet(SHEET_NAMES.NOTIFICATIONS,
    ['id', 'timestamp', 'type', 'title', 'message', 'read']);

  getOrCreateSheet(SHEET_NAMES.CP_UPDATE_SESSIONS,
    ['id', 'createdAt', 'createdBy', 'expiresAt', 'status', 'totalSubmissions', 'approvedCount', 'rejectedCount', 'confirmedBy', 'confirmedAt']);
  getOrCreateSheet(SHEET_NAMES.CP_UPDATE_SUBMISSIONS,
    ['id', 'sessionId', 'username', 'displayName', 'oldCP', 'newCP', 'imageData', 'submittedAt', 'status', 'reviewedBy', 'reviewedAt']);
  getOrCreateSheet(SHEET_NAMES.MEMBER_CP_HISTORY,
    ['id', 'timestamp', 'memberId', 'memberName', 'oldCP', 'newCP', 'oldTier', 'newTier', 'source', 'changedBy', 'sessionId']);

  // Create default superadmin if not exists
  const usersSheet = getSheet(SHEET_NAMES.USERS);
  const data = usersSheet.getDataRange().getValues();
  const hasAdmin = data.slice(1).some(r => r[0] === DEFAULT_SUPERADMIN.username);
  if (!hasAdmin) {
    usersSheet.appendRow([
      DEFAULT_SUPERADMIN.username,
      DEFAULT_SUPERADMIN.password,
      DEFAULT_SUPERADMIN.displayName,
      DEFAULT_SUPERADMIN.role,
      DEFAULT_SUPERADMIN.status
    ]);
  }

  // Migrate old role values: 'superadmin' → 'Super Admin'
  migrateRoleValues();

  return { success: true, message: 'Sheets setup complete' };
}

function migrateRoleValues() {
  try {
    const sheet = getSheet(SHEET_NAMES.USERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const roleCol = headers.indexOf('role');
    if (roleCol < 0) return;
    let migrated = 0;
    for (let i = 1; i < data.length; i++) {
      const role = String(data[i][roleCol]).trim().toLowerCase();
      if (role === 'superadmin') {
        sheet.getRange(i + 1, roleCol + 1).setValue('Super Admin');
        migrated++;
      }
    }
    if (migrated > 0) {
      logActivity('system', 'migrateRoles', 'Migrated ' + migrated + ' users from superadmin to Super Admin');
    }
  } catch (e) { /* ignore */ }
}

// === CP HISTORY HELPER ===
function logCPHistory(memberId, memberName, oldCP, newCP, oldTier, newTier, source, changedBy, sessionId) {
  try {
    const sheet = getOrCreateSheet(SHEET_NAMES.MEMBER_CP_HISTORY,
      ['id', 'timestamp', 'memberId', 'memberName', 'oldCP', 'newCP', 'oldTier', 'newTier', 'source', 'changedBy', 'sessionId']);
    sheet.appendRow([generateId(), now(), memberId, memberName, oldCP, newCP, oldTier, newTier, source, changedBy, sessionId || '']);
  } catch (e) { /* ignore */ }
}

// === CP UPDATE SESSION FUNCTIONS ===
function startCPUpdate(currentUser) {
  if (currentUser.role === 'member') return { success: false, error: 'ไม่มีสิทธิ์' };
  // Check for existing active session
  const { rows } = getSheetData(SHEET_NAMES.CP_UPDATE_SESSIONS);
  const active = rows.find(r => r.status === 'active');
  if (active) {
    // Check if expired
    const expiresAt = new Date(active.expiresAt);
    if (expiresAt > now()) {
      return { success: false, error: 'มี CP Update Session ที่เปิดอยู่แล้ว' };
    }
    // Mark expired
    const sheet = getSheet(SHEET_NAMES.CP_UPDATE_SESSIONS);
    const statusCol = getSheetData(SHEET_NAMES.CP_UPDATE_SESSIONS).headers.indexOf('status');
    sheet.getRange(active._rowIndex, statusCol + 1).setValue('expired');
  }
  const sessionId = generateId();
  const createdAt = now();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
  const sheet = getSheet(SHEET_NAMES.CP_UPDATE_SESSIONS);
  sheet.appendRow([sessionId, createdAt, currentUser.username, expiresAt, 'active', 0, 0, 0, '', '']);
  logActivity(currentUser.username, 'startCPUpdate', 'Session: ' + sessionId);
  return { success: true, message: 'เริ่ม CP Update Session สำเร็จ สมาชิกมีเวลา 24 ชั่วโมงในการอัพเดท CP', sessionId: sessionId };
}

function getCPUpdateSession(currentUser) {
  const { rows } = getSheetData(SHEET_NAMES.CP_UPDATE_SESSIONS);
  const active = rows.find(r => r.status === 'active');
  if (!active) return { success: true, session: null };
  // Check if expired
  const expiresAt = new Date(active.expiresAt);
  if (expiresAt <= now()) {
    const sheet = getSheet(SHEET_NAMES.CP_UPDATE_SESSIONS);
    const headers = getSheetData(SHEET_NAMES.CP_UPDATE_SESSIONS).headers;
    const statusCol = headers.indexOf('status');
    sheet.getRange(active._rowIndex, statusCol + 1).setValue('expired');
    return { success: true, session: null };
  }
  // Get submissions for this session
  const { rows: subs } = getSheetData(SHEET_NAMES.CP_UPDATE_SUBMISSIONS);
  const sessionSubs = subs.filter(s => s.sessionId === active.id).map(s => ({
    id: s.id, username: s.username, displayName: s.displayName,
    oldCP: s.oldCP, newCP: s.newCP, imageData: s.imageData,
    submittedAt: s.submittedAt, status: s.status,
    reviewedBy: s.reviewedBy, reviewedAt: s.reviewedAt
  }));
  return {
    success: true,
    session: {
      id: active.id, createdAt: active.createdAt, createdBy: active.createdBy,
      expiresAt: active.expiresAt, status: active.status,
      submissions: sessionSubs
    }
  };
}

function submitCPUpdate(sessionId, cpValue, imageData, currentUser) {
  if (!sessionId || !cpValue) return { success: false, error: 'ข้อมูลไม่ครบ' };
  const { rows: sessions } = getSheetData(SHEET_NAMES.CP_UPDATE_SESSIONS);
  const session = sessions.find(r => r.id === sessionId && r.status === 'active');
  if (!session) return { success: false, error: 'ไม่มี CP Update Session ที่เปิดอยู่' };
  const expiresAt = new Date(session.expiresAt);
  if (expiresAt <= now()) return { success: false, error: 'หมดเวลา CP Update Session แล้ว' };
  // Check duplicate
  const { rows: subs } = getSheetData(SHEET_NAMES.CP_UPDATE_SUBMISSIONS);
  if (subs.some(s => s.sessionId === sessionId && s.username === currentUser.username)) {
    return { success: false, error: 'คุณส่ง CP อัพเดทแล้ว' };
  }
  // Get old CP
  const { rows: members } = getSheetData(SHEET_NAMES.MEMBERS);
  const member = members.find(m => m.name === currentUser.displayName && m.status !== 'deleted');
  const oldCP = member ? parseFloat(member.cpValue) || 0 : 0;
  const newCP = parseFloat(String(cpValue).replace(/,/g, '')) || 0;
  const subId = generateId();
  const sheet = getSheet(SHEET_NAMES.CP_UPDATE_SUBMISSIONS);
  sheet.appendRow([subId, sessionId, currentUser.username, currentUser.displayName, oldCP, newCP, imageData || '', now(), 'pending', '', '']);
  // Update session totalSubmissions
  const sessSheet = getSheet(SHEET_NAMES.CP_UPDATE_SESSIONS);
  const sessHeaders = getSheetData(SHEET_NAMES.CP_UPDATE_SESSIONS).headers;
  const totalCol = sessHeaders.indexOf('totalSubmissions');
  sessSheet.getRange(session._rowIndex, totalCol + 1).setValue((parseInt(session.totalSubmissions) || 0) + 1);
  logActivity(currentUser.username, 'submitCPUpdate', 'Session: ' + sessionId + ', CP: ' + newCP, 'CP:' + oldCP, 'CP:' + newCP);
  return { success: true, message: 'ส่ง CP สำเร็จ! รอ Admin อนุมัติ' };
}

function reviewCPUpdate(submissionId, approve, currentUser) {
  if (currentUser.role === 'member') return { success: false, error: 'ไม่มีสิทธิ์' };
  const sheet = getSheet(SHEET_NAMES.CP_UPDATE_SUBMISSIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const statusCol = headers.indexOf('status');
  const reviewedByCol = headers.indexOf('reviewedBy');
  const reviewedAtCol = headers.indexOf('reviewedAt');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === submissionId) {
      const newStatus = approve === true || approve === 'approve' ? 'approved' : approve === 'pending' ? 'pending' : 'rejected';
      sheet.getRange(i + 1, statusCol + 1).setValue(newStatus);
      sheet.getRange(i + 1, reviewedByCol + 1).setValue(newStatus === 'pending' ? '' : currentUser.username);
      sheet.getRange(i + 1, reviewedAtCol + 1).setValue(newStatus === 'pending' ? '' : now());
      const displayName = data[i][headers.indexOf('displayName')];
      logActivity(currentUser.username, 'reviewCPUpdate', 'Submission: ' + submissionId + ' → ' + newStatus + ' (' + displayName + ')');
      return { success: true, message: newStatus === 'approved' ? 'อนุมัติ ' + displayName + ' สำเร็จ' : newStatus === 'rejected' ? 'ปฏิเสธสำเร็จ' : 'ย้อนกลับเป็นรอตรวจ' };
    }
  }
  return { success: false, error: 'ไม่พบ submission' };
}

function confirmCPUpdate(sessionId, currentUser) {
  if (currentUser.role === 'member') return { success: false, error: 'ไม่มีสิทธิ์' };
  const { rows: sessions } = getSheetData(SHEET_NAMES.CP_UPDATE_SESSIONS);
  const session = sessions.find(r => r.id === sessionId);
  if (!session) return { success: false, error: 'ไม่พบ session' };
  // Get approved submissions
  const { rows: subs } = getSheetData(SHEET_NAMES.CP_UPDATE_SUBMISSIONS);
  const approved = subs.filter(s => s.sessionId === sessionId && s.status === 'approved');
  const rejected = subs.filter(s => s.sessionId === sessionId && s.status === 'rejected');
  if (approved.length === 0) return { success: false, error: 'ไม่มีรายการที่อนุมัติ' };
  // Update members CP
  const memberSheet = getSheet(SHEET_NAMES.MEMBERS);
  const memberData = memberSheet.getDataRange().getValues();
  const mHeaders = memberData[0];
  const mIdCol = mHeaders.indexOf('id');
  const mNameCol = mHeaders.indexOf('name');
  const mCPCol = mHeaders.indexOf('cpValue');
  const mTierCol = mHeaders.indexOf('tier');
  const mPctCol = mHeaders.indexOf('rewardPercent');
  const mStatusCol = mHeaders.indexOf('status');
  let updated = 0;
  approved.forEach(sub => {
    const newCP = parseFloat(sub.newCP) || 0;
    let found = false;
    for (let i = 1; i < memberData.length; i++) {
      if (memberData[i][mNameCol] === sub.displayName && memberData[i][mStatusCol] !== 'deleted') {
        const oldCP = parseFloat(memberData[i][mCPCol]) || 0;
        const oldTier = memberData[i][mTierCol] || '-';
        const tierInfo = findTier(newCP);
        memberSheet.getRange(i + 1, mCPCol + 1).setValue(newCP);
        memberSheet.getRange(i + 1, mTierCol + 1).setValue(tierInfo.tierName);
        memberSheet.getRange(i + 1, mPctCol + 1).setValue(tierInfo.rewardPercent);
        logCPHistory(memberData[i][mIdCol], sub.displayName, oldCP, newCP, oldTier, tierInfo.tierName, 'cpUpdate', currentUser.username, sessionId);
        updated++;
        found = true;
        break;
      }
    }
    if (!found) {
      // Create new member if not found
      const tierInfo = findTier(newCP);
      const newId = generateId();
      memberSheet.appendRow([newId, sub.displayName, newCP, tierInfo.tierName, tierInfo.rewardPercent, 'active']);
      logCPHistory(newId, sub.displayName, 0, newCP, '-', tierInfo.tierName, 'cpUpdate', currentUser.username, sessionId);
      updated++;
    }
  });
  // Update session status
  const sessSheet = getSheet(SHEET_NAMES.CP_UPDATE_SESSIONS);
  const sessData = sessSheet.getDataRange().getValues();
  const sHeaders = sessData[0];
  for (let i = 1; i < sessData.length; i++) {
    if (sessData[i][sHeaders.indexOf('id')] === sessionId) {
      sessSheet.getRange(i + 1, sHeaders.indexOf('status') + 1).setValue('completed');
      sessSheet.getRange(i + 1, sHeaders.indexOf('approvedCount') + 1).setValue(approved.length);
      sessSheet.getRange(i + 1, sHeaders.indexOf('rejectedCount') + 1).setValue(rejected.length);
      sessSheet.getRange(i + 1, sHeaders.indexOf('confirmedBy') + 1).setValue(currentUser.username);
      sessSheet.getRange(i + 1, sHeaders.indexOf('confirmedAt') + 1).setValue(now());
      break;
    }
  }
  logActivity(currentUser.username, 'confirmCPUpdate', 'Session: ' + sessionId + ', Approved: ' + approved.length + ', Rejected: ' + rejected.length);
  return { success: true, message: 'อัพเดท CP สำเร็จ ' + updated + ' คน', updatedCount: updated };
}

// === HTTP HANDLERS ===
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(15000);
  let result;
  try {
    const data = JSON.parse(e.postData.contents);
    switch (data.action) {
      // Auth
      case 'login': result = login(data.username, data.password); break;
      case 'register': result = register(data.user); break;
      case 'changePassword': result = changePassword(data.username, data.oldPassword, data.newPassword); break;
      case 'updateProfile': result = updateProfile(data.displayName, data.profileImage, data.currentUser); break;
      // Users
      case 'getUsers': result = getUsers(data.currentUser); break;
      case 'getPendingUsers': result = getPendingUsers(); break;
      case 'approveUser': result = approveUser(data.username, data.approve, data.currentUser); break;
      case 'updateUser': result = updateUser(data.user, data.currentUser); break;
      case 'deleteUser': result = deleteUser(data.username, data.currentUser); break;
      case 'resetUserPassword': result = resetUserPassword(data.username, data.newPassword, data.currentUser); break;
      // Members
      case 'getMembers': result = getMembers(data.currentUser); break;
      case 'createMember': result = createMember(data.member, data.currentUser); break;
      case 'updateMember': result = updateMember(data.member, data.currentUser); break;
      case 'deleteMember': result = deleteMember(data.memberId, data.currentUser); break;
      case 'batchUpdateCP': result = batchUpdateCP(data.updates, data.currentUser); break;
      // CP Tiers
      case 'getCPTiers': result = getCPTiers(); break;
      case 'createCPTier': result = createCPTier(data.tier, data.currentUser); break;
      case 'updateCPTier': result = updateCPTier(data.tier, data.currentUser); break;
      case 'deleteCPTier': result = deleteCPTier(data.tierId, data.currentUser); break;
      // Rewards
      case 'calculateRewards': result = calculateRewards(data.totalPrize, data.currentUser); break;
      case 'confirmDistribution': result = confirmDistribution(data.distributionId, data.currentUser); break;
      case 'getDistributions': result = getDistributions(data.currentUser); break;
      case 'getDistributionDetails': result = getDistributionDetails(data.distributionId); break;
      case 'deleteDistribution': result = deleteDistribution(data.distributionId, data.currentUser); break;
      // CP Update Sessions
      case 'startCPUpdate': result = startCPUpdate(data.currentUser); break;
      case 'getCPUpdateSession': result = getCPUpdateSession(data.currentUser); break;
      case 'submitCPUpdate': result = submitCPUpdate(data.sessionId, data.cpValue, data.imageData, data.currentUser); break;
      case 'reviewCPUpdate': result = reviewCPUpdate(data.submissionId, data.approve || data.action, data.currentUser); break;
      case 'confirmCPUpdate': result = confirmCPUpdate(data.sessionId, data.currentUser); break;
      // Growth
      case 'getGrowthData': result = getGrowthData(); break;
      // Dashboard
      case 'getDashboardData': result = getDashboardData(data.currentUser); break;
      // Activity Logs
      case 'getActivityLogs': result = getActivityLogs(data.currentUser); break;
      case 'getLoginLogs': result = getLoginLogs(data.currentUser); break;
      // Password Resets & Notifications
      case 'requestPasswordReset': result = requestPasswordReset(data.username, data.reason); break;
      case 'getPasswordResets': result = getPasswordResets(data.currentUser); break;
      case 'handlePasswordReset': result = handlePasswordReset(data.resetId, data.approve, data.currentUser); break;
      case 'forceChangePassword': result = forceChangePassword(data.username, data.newPassword); break;
      case 'getNotifications': result = getNotifications(data.currentUser); break;
      case 'markNotificationRead': result = markNotificationRead(data.notifId, data.currentUser); break;
      default: result = { success: false, error: 'Unknown action: ' + data.action };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    switch (action) {
      case 'setup': result = setupSheets(); break;
      case 'ping': result = { success: true, message: 'CP Management API active' }; break;
      default: result = { success: false, error: 'Unknown GET action' };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// === AUTH ===
function login(username, password) {
  if (!username || !password) return { success: false, error: 'กรุณากรอกข้อมูลให้ครบ' };
  const { rows } = getSheetData(SHEET_NAMES.USERS);
  const user = rows.find(r => r.username === username && r.password === password);
  if (!user) {
    logLogin(username, 'failed');
    return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }
  if (user.status === 'pending') {
    return { success: false, error: 'บัญชียังไม่ได้รับการอนุมัติ กรุณารอแอดมินอนุมัติ' };
  }
  if (user.status === 'inactive') {
    return { success: false, error: 'บัญชีถูกระงับ กรุณาติดต่อแอดมิน' };
  }
  logLogin(username, 'success');
  // Normalize old role value on login
  var role = user.role;
  if (String(role).trim().toLowerCase() === 'superadmin') {
    role = 'Super Admin';
    // Also fix in sheet
    try {
      var sheet = getSheet(SHEET_NAMES.USERS);
      var d = sheet.getDataRange().getValues();
      var h = d[0];
      var uCol = h.indexOf('username');
      var rCol = h.indexOf('role');
      for (var j = 1; j < d.length; j++) {
        if (d[j][uCol] === username) {
          sheet.getRange(j + 1, rCol + 1).setValue('Super Admin');
          break;
        }
      }
    } catch (ex) { /* ignore */ }
  }
  var forceChange = user.forceChangePassword === true || user.forceChangePassword === 'TRUE' || user.forceChangePassword === 'true';
  return {
    success: true,
    forceChangePassword: forceChange,
    user: {
      username: user.username,
      displayName: user.displayName,
      role: role,
      profileImage: user.profileImage || '',
      weaponClass: user.weaponClass || ''
    }
  };
}

function register(userData) {
  if (!userData.username || !userData.password || !userData.displayName) {
    return { success: false, error: 'กรุณากรอกข้อมูลให้ครบ' };
  }
  // Check duplicate in Register sheet
  const { rows: regRows } = getSheetData(SHEET_NAMES.REGISTER);
  if (regRows.some(r => r.username === userData.username)) {
    return { success: false, error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' };
  }
  // Also check Users sheet
  const { rows: userRows } = getSheetData(SHEET_NAMES.USERS);
  if (userRows.some(r => r.username === userData.username)) {
    return { success: false, error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' };
  }
  // Write to Register sheet (columns: username, password, character_name, cp)
  const regSheet = getSheet(SHEET_NAMES.REGISTER);
  regSheet.appendRow([
    userData.username,
    userData.password,
    userData.displayName,
    parseFloat(userData.cpValue) || 0
  ]);
  // Also write to Users sheet for login
  const usersSheet = getSheet(SHEET_NAMES.USERS);
  usersSheet.appendRow([
    userData.username,
    userData.password,
    userData.displayName,
    userData.role || 'member',
    userData.status || 'pending',
    '',
    userData.weaponClass || ''
  ]);
  logActivity(userData.username, 'register', 'New user registered');
  addNotification('register', 'ผู้ใช้ใหม่ลงทะเบียน',
    userData.username + ' (' + userData.displayName + ') ลงทะเบียน CP: ' + (userData.cpValue || 0));
  return { success: true, message: 'ลงทะเบียนสำเร็จ กรุณารอแอดมินอนุมัติ' };
}

function changePassword(username, oldPassword, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร' };
  }
  const sheet = getSheet(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const uCol = headers.indexOf('username');
  const pCol = headers.indexOf('password');
  for (let i = 1; i < data.length; i++) {
    if (data[i][uCol] === username && data[i][pCol] === oldPassword) {
      sheet.getRange(i + 1, pCol + 1).setValue(newPassword);
      logActivity(username, 'changePassword', 'Password changed');
      return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
    }
  }
  return { success: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' };
}

function updateProfile(displayName, profileImage, currentUser) {
  if (!currentUser || !currentUser.username) return { success: false, error: 'ไม่ได้ล็อกอิน' };
  const sheet = getSheet(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const uCol = headers.indexOf('username');
  for (let i = 1; i < data.length; i++) {
    if (data[i][uCol] === currentUser.username) {
      if (displayName) {
        const dnCol = headers.indexOf('displayName');
        if (dnCol >= 0) sheet.getRange(i + 1, dnCol + 1).setValue(displayName);
      }
      if (profileImage !== undefined) {
        let piCol = headers.indexOf('profileImage');
        if (piCol < 0) {
          // Add profileImage column if not exists
          piCol = headers.length;
          sheet.getRange(1, piCol + 1).setValue('profileImage');
        }
        sheet.getRange(i + 1, piCol + 1).setValue(profileImage);
      }
      logActivity(currentUser.username, 'updateProfile', 'Profile updated');
      return { success: true, message: 'อัพเดทโปรไฟล์สำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบผู้ใช้' };
}

// === USER MANAGEMENT (Super Admin) ===
function getUsers(currentUser) {
  if (currentUser.role !== 'Super Admin') return { success: false, error: 'ไม่มีสิทธิ์' };
  const { rows } = getSheetData(SHEET_NAMES.USERS);
  const users = rows.map(r => ({
    username: r.username,
    displayName: r.displayName,
    role: r.role,
    status: r.status,
    profileImage: r.profileImage || '',
    weaponClass: r.weaponClass || ''
  }));
  return { success: true, users };
}

function getPendingUsers() {
  const { rows } = getSheetData(SHEET_NAMES.USERS);
  const pending = rows.filter(r => r.status === 'pending').map(r => ({
    username: r.username,
    displayName: r.displayName
  }));
  return { success: true, pending };
}

function approveUser(username, approve, currentUser) {
  if (currentUser.role !== 'Super Admin') return { success: false, error: 'ไม่มีสิทธิ์' };
  const sheet = getSheet(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const uCol = headers.indexOf('username');
  const sCol = headers.indexOf('status');
  for (let i = 1; i < data.length; i++) {
    if (data[i][uCol] === username) {
      if (approve) {
        sheet.getRange(i + 1, sCol + 1).setValue('active');
        logActivity(currentUser.username, 'approveUser', 'Approved: ' + username);
        return { success: true, message: 'อนุมัติผู้ใช้ ' + username + ' สำเร็จ' };
      } else {
        sheet.deleteRow(i + 1);
        logActivity(currentUser.username, 'rejectUser', 'Rejected: ' + username);
        return { success: true, message: 'ปฏิเสธผู้ใช้ ' + username + ' สำเร็จ' };
      }
    }
  }
  return { success: false, error: 'ไม่พบผู้ใช้' };
}

function updateUser(userData, currentUser) {
  if (currentUser.role !== 'Super Admin') return { success: false, error: 'ไม่มีสิทธิ์' };
  const sheet = getSheet(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const uCol = headers.indexOf('username');
  for (let i = 1; i < data.length; i++) {
    if (data[i][uCol] === userData.username) {
      const cols = { displayName: 'displayName', role: 'role', status: 'status', weaponClass: 'weaponClass' };
      Object.entries(cols).forEach(([key, header]) => {
        if (userData[key] !== undefined) {
          const col = headers.indexOf(header);
          if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(userData[key]);
        }
      });
      logActivity(currentUser.username, 'updateUser', 'Updated: ' + userData.username);
      return { success: true, message: 'อัพเดทผู้ใช้สำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบผู้ใช้' };
}

function deleteUser(username, currentUser) {
  if (currentUser.role !== 'Super Admin') return { success: false, error: 'ไม่มีสิทธิ์' };
  if (username === 'superadmin') return { success: false, error: 'ไม่สามารถลบ Super Admin ได้' };
  const sheet = getSheet(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const uCol = data[0].indexOf('username');
  for (let i = 1; i < data.length; i++) {
    if (data[i][uCol] === username) {
      sheet.deleteRow(i + 1);
      logActivity(currentUser.username, 'deleteUser', 'Deleted: ' + username);
      return { success: true, message: 'ลบผู้ใช้สำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบผู้ใช้' };
}

function resetUserPassword(username, newPassword, currentUser) {
  if (currentUser.role !== 'Super Admin') return { success: false, error: 'ไม่มีสิทธิ์' };
  const sheet = getSheet(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const uCol = headers.indexOf('username');
  const pCol = headers.indexOf('password');
  for (let i = 1; i < data.length; i++) {
    if (data[i][uCol] === username) {
      sheet.getRange(i + 1, pCol + 1).setValue(newPassword || '1234');
      logActivity(currentUser.username, 'resetPassword', 'Reset password: ' + username);
      return { success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบผู้ใช้' };
}

// === MEMBERS CRUD ===
function getMembers(currentUser) {
  const { rows } = getSheetData(SHEET_NAMES.MEMBERS);
  let members = rows.filter(r => r.status !== 'deleted');
  if (currentUser.role === 'member') {
    members = members.filter(m => m.name === currentUser.displayName);
  }
  // Lookup profileImage from Users sheet
  const { rows: users } = getSheetData(SHEET_NAMES.USERS);
  const userImgMap = {};
  users.forEach(u => { userImgMap[u.displayName] = u.profileImage || ''; });
  members = members.map(m => ({ ...m, profileImage: userImgMap[m.name] || '' }));
  return { success: true, members };
}

function createMember(memberData, currentUser) {
  if (currentUser.role === 'member') return { success: false, error: 'ไม่มีสิทธิ์' };
  if (!memberData.name) return { success: false, error: 'กรุณากรอกชื่อสมาชิก' };
  const cpValue = parseFloat(memberData.cpValue) || 0;
  const tierInfo = findTier(cpValue);
  const sheet = getSheet(SHEET_NAMES.MEMBERS);
  const id = generateId();
  sheet.appendRow([
    id,
    memberData.name,
    cpValue,
    tierInfo.tierName,
    tierInfo.rewardPercent,
    'active'
  ]);
  logActivity(currentUser.username, 'createMember', 'Created: ' + memberData.name);
  return { success: true, message: 'เพิ่มสมาชิกสำเร็จ', memberId: id };
}

function updateMember(memberData, currentUser) {
  if (currentUser.role === 'member') return { success: false, error: 'ไม่มีสิทธิ์' };
  const sheet = getSheet(SHEET_NAMES.MEMBERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === memberData.id) {
      const oldCP = parseFloat(data[i][headers.indexOf('cpValue')]) || 0;
      const oldTier = data[i][headers.indexOf('tier')] || '-';
      const cpValue = parseFloat(memberData.cpValue) || oldCP;
      const tierInfo = findTier(cpValue);
      const updates = {
        name: memberData.name,
        cpValue: cpValue,
        tier: tierInfo.tierName,
        rewardPercent: tierInfo.rewardPercent,
        status: memberData.status
      };
      Object.entries(updates).forEach(([key, val]) => {
        if (val !== undefined) {
          const col = headers.indexOf(key);
          if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(val);
        }
      });
      // Log CP history if CP changed
      if (cpValue !== oldCP) {
        logCPHistory(memberData.id, memberData.name || data[i][headers.indexOf('name')], oldCP, cpValue, oldTier, tierInfo.tierName, 'manualEdit', currentUser.username, '');
        logActivity(currentUser.username, 'updateMember', 'Updated: ' + memberData.name, 'CP:' + oldCP, 'CP:' + cpValue);
      } else {
        logActivity(currentUser.username, 'updateMember', 'Updated: ' + memberData.name);
      }
      return { success: true, message: 'อัพเดทสมาชิกสำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบสมาชิก' };
}

function deleteMember(memberId, currentUser) {
  if (currentUser.role === 'member') return { success: false, error: 'ไม่มีสิทธิ์' };
  const sheet = getSheet(SHEET_NAMES.MEMBERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const statusCol = headers.indexOf('status');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === memberId) {
      sheet.getRange(i + 1, statusCol + 1).setValue('deleted');
      logActivity(currentUser.username, 'deleteMember', 'Deleted member: ' + memberId);
      return { success: true, message: 'ลบสมาชิกสำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบสมาชิก' };
}

function batchUpdateCP(updates, currentUser) {
  if (currentUser.role === 'member') return { success: false, error: 'ไม่มีสิทธิ์' };
  const sheet = getSheet(SHEET_NAMES.MEMBERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const cpCol = headers.indexOf('cpValue');
  const tierCol = headers.indexOf('tier');
  const pctCol = headers.indexOf('rewardPercent');
  const nameCol = headers.indexOf('name');
  let count = 0;
  updates.forEach(u => {
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === u.id) {
        const oldCP = parseFloat(data[i][cpCol]) || 0;
        const oldTier = data[i][tierCol] || '-';
        const cpValue = parseFloat(u.cpValue) || 0;
        const tierInfo = findTier(cpValue);
        sheet.getRange(i + 1, cpCol + 1).setValue(cpValue);
        sheet.getRange(i + 1, tierCol + 1).setValue(tierInfo.tierName);
        sheet.getRange(i + 1, pctCol + 1).setValue(tierInfo.rewardPercent);
        if (cpValue !== oldCP) {
          logCPHistory(u.id, data[i][nameCol], oldCP, cpValue, oldTier, tierInfo.tierName, 'batchUpdate', currentUser.username, '');
        }
        count++;
        break;
      }
    }
  });
  logActivity(currentUser.username, 'batchUpdateCP', 'Updated ' + count + ' members');
  return { success: true, message: 'อัพเดท CP สำเร็จ ' + count + ' คน' };
}

// === CP TIERS ===
function getCPTiers() {
  const { rows } = getSheetData(SHEET_NAMES.CP_TIERS);
  const tiers = rows.filter(r => r.status !== 'deleted');
  return { success: true, tiers };
}

function createCPTier(tierData, currentUser) {
  if (currentUser.role !== 'Super Admin') return { success: false, error: 'ไม่มีสิทธิ์' };
  if (!tierData.tierName || tierData.minCP === undefined || tierData.maxCP === undefined) {
    return { success: false, error: 'กรุณากรอกข้อมูลให้ครบ' };
  }
  const minCP = parseFloat(tierData.minCP);
  const maxCP = parseFloat(tierData.maxCP);
  if (minCP > maxCP) return { success: false, error: 'ค่า Min CP ต้องน้อยกว่า Max CP' };
  // Check overlap
  const overlap = checkTierOverlap(minCP, maxCP, null);
  if (overlap) return { success: false, error: 'ช่วง CP ซ้อนทับกับ Tier: ' + overlap };
  const sheet = getSheet(SHEET_NAMES.CP_TIERS);
  const id = generateId();
  sheet.appendRow([
    id,
    tierData.tierName,
    minCP,
    maxCP,
    parseFloat(tierData.rewardPercent) || 0,
    'active'
  ]);
  recalculateMemberTiers();
  logActivity(currentUser.username, 'createCPTier', 'Created tier: ' + tierData.tierName);
  return { success: true, message: 'สร้าง Tier สำเร็จ', tierId: id };
}

function updateCPTier(tierData, currentUser) {
  if (currentUser.role !== 'Super Admin') return { success: false, error: 'ไม่มีสิทธิ์' };
  const sheet = getSheet(SHEET_NAMES.CP_TIERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === tierData.id) {
      const minCP = parseFloat(tierData.minCP !== undefined ? tierData.minCP : data[i][headers.indexOf('minCP')]);
      const maxCP = parseFloat(tierData.maxCP !== undefined ? tierData.maxCP : data[i][headers.indexOf('maxCP')]);
      if (minCP > maxCP) return { success: false, error: 'ค่า Min CP ต้องน้อยกว่า Max CP' };
      const overlap = checkTierOverlap(minCP, maxCP, tierData.id);
      if (overlap) return { success: false, error: 'ช่วง CP ซ้อนทับกับ Tier: ' + overlap };
      ['tierName', 'minCP', 'maxCP', 'rewardPercent', 'status'].forEach(key => {
        if (tierData[key] !== undefined) {
          const col = headers.indexOf(key);
          if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(
            ['minCP', 'maxCP', 'rewardPercent'].includes(key) ? parseFloat(tierData[key]) : tierData[key]
          );
        }
      });
      recalculateMemberTiers();
      logActivity(currentUser.username, 'updateCPTier', 'Updated tier: ' + tierData.tierName);
      return { success: true, message: 'อัพเดท Tier สำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบ Tier' };
}

function deleteCPTier(tierId, currentUser) {
  if (currentUser.role !== 'Super Admin') return { success: false, error: 'ไม่มีสิทธิ์' };
  const sheet = getSheet(SHEET_NAMES.CP_TIERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const statusCol = headers.indexOf('status');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === tierId) {
      sheet.getRange(i + 1, statusCol + 1).setValue('deleted');
      recalculateMemberTiers();
      logActivity(currentUser.username, 'deleteCPTier', 'Deleted tier: ' + tierId);
      return { success: true, message: 'ลบ Tier สำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบ Tier' };
}

function checkTierOverlap(minCP, maxCP, excludeId) {
  const { rows } = getSheetData(SHEET_NAMES.CP_TIERS);
  const activeTiers = rows.filter(r => r.status !== 'deleted' && r.id !== excludeId);
  for (const tier of activeTiers) {
    const tMin = parseFloat(tier.minCP);
    const tMax = parseFloat(tier.maxCP);
    if (minCP <= tMax && maxCP >= tMin) {
      return tier.tierName;
    }
  }
  return null;
}

function findTier(cpValue) {
  const { rows } = getSheetData(SHEET_NAMES.CP_TIERS);
  const activeTiers = rows.filter(r => r.status !== 'deleted');
  for (const tier of activeTiers) {
    if (cpValue >= parseFloat(tier.minCP) && cpValue <= parseFloat(tier.maxCP)) {
      return { tierName: tier.tierName, rewardPercent: parseFloat(tier.rewardPercent) };
    }
  }
  return { tierName: '-', rewardPercent: 0 };
}

function recalculateMemberTiers() {
  const sheet = getSheet(SHEET_NAMES.MEMBERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const cpCol = headers.indexOf('cpValue');
  const tierCol = headers.indexOf('tier');
  const pctCol = headers.indexOf('rewardPercent');
  const statusCol = headers.indexOf('status');
  for (let i = 1; i < data.length; i++) {
    if (data[i][statusCol] === 'deleted') continue;
    const cpValue = parseFloat(data[i][cpCol]) || 0;
    const tierInfo = findTier(cpValue);
    sheet.getRange(i + 1, tierCol + 1).setValue(tierInfo.tierName);
    sheet.getRange(i + 1, pctCol + 1).setValue(tierInfo.rewardPercent);
  }
}

// === REWARD CALCULATION & DISTRIBUTION ===
function calculateRewards(totalPrize, currentUser) {
  if (currentUser.role === 'member') return { success: false, error: 'ไม่มีสิทธิ์' };
  totalPrize = parseFloat(totalPrize);
  if (!totalPrize || totalPrize <= 0) return { success: false, error: 'กรุณากรอกจำนวนเงินรางวัล' };

  const { rows: members } = getSheetData(SHEET_NAMES.MEMBERS);
  let activeMembers = members.filter(m => m.status === 'active');
  if (activeMembers.length === 0) return { success: false, error: 'ไม่มีสมาชิกที่ active' };

  // Calculate effective weights
  const breakdown = activeMembers.map(m => {
    const cpValue = parseFloat(m.cpValue) || 0;
    const tierInfo = findTier(cpValue);
    const effectiveWeight = cpValue * (tierInfo.rewardPercent / 100);
    return {
      memberId: m.id,
      memberName: m.name,
      cpValue,
      tier: tierInfo.tierName,
      percentage: tierInfo.rewardPercent,
      effectiveWeight,
      amount: 0
    };
  });

  const totalWeight = breakdown.reduce((sum, b) => sum + b.effectiveWeight, 0);
  if (totalWeight === 0) return { success: false, error: 'น้ำหนักรวมเป็น 0 ตรวจสอบ CP Tiers' };

  // Calculate amounts
  let distributedTotal = 0;
  breakdown.forEach(b => {
    b.amount = Math.floor((b.effectiveWeight / totalWeight) * totalPrize * 100) / 100;
    distributedTotal += b.amount;
  });

  // Adjust rounding difference to highest weight member
  const diff = Math.round((totalPrize - distributedTotal) * 100) / 100;
  if (diff !== 0) {
    const maxIdx = breakdown.reduce((mi, b, i, arr) => b.effectiveWeight > arr[mi].effectiveWeight ? i : mi, 0);
    breakdown[maxIdx].amount = Math.round((breakdown[maxIdx].amount + diff) * 100) / 100;
  }

  // Save as draft distribution
  const distSheet = getSheet(SHEET_NAMES.REWARD_DISTRIBUTIONS);
  const distId = generateId();
  distSheet.appendRow([distId, now(), totalPrize, currentUser.username, 'draft', '']);

  const detailSheet = getSheet(SHEET_NAMES.REWARD_DETAILS);
  breakdown.forEach(b => {
    detailSheet.appendRow([
      generateId(), distId, b.memberId, b.memberName,
      b.cpValue, b.tier, b.percentage, b.amount
    ]);
  });

  logActivity(currentUser.username, 'calculateRewards',
    'Prize: ' + totalPrize + ', Members: ' + breakdown.length);

  return {
    success: true,
    distributionId: distId,
    totalPrize,
    totalWeight,
    memberCount: breakdown.length,
    breakdown: breakdown.sort((a, b) => b.amount - a.amount)
  };
}

function confirmDistribution(distributionId, currentUser) {
  if (currentUser.role !== 'Super Admin') return { success: false, error: 'เฉพาะ Super Admin เท่านั้นที่ยืนยันได้' };
  const sheet = getSheet(SHEET_NAMES.REWARD_DISTRIBUTIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const statusCol = headers.indexOf('status');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === distributionId) {
      if (data[i][statusCol] === 'confirmed') {
        return { success: false, error: 'การแจกรางวัลนี้ยืนยันแล้ว' };
      }
      sheet.getRange(i + 1, statusCol + 1).setValue('confirmed');
      logActivity(currentUser.username, 'confirmDistribution', 'Confirmed: ' + distributionId);
      return { success: true, message: 'ยืนยันการแจกรางวัลสำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบรายการ' };
}

function getDistributions(currentUser) {
  const { rows } = getSheetData(SHEET_NAMES.REWARD_DISTRIBUTIONS);
  let distributions = rows.filter(r => r.status !== 'deleted');
  if (currentUser.role === 'member') {
    // Member sees distributions that include them
    const { rows: details } = getSheetData(SHEET_NAMES.REWARD_DETAILS);
    const myDistIds = details.filter(d => d.memberName === currentUser.displayName).map(d => d.distributionId);
    distributions = distributions.filter(d => myDistIds.includes(d.id));
  }
  return {
    success: true,
    distributions: distributions.map(d => ({
      id: d.id,
      date: d.date,
      totalPrize: d.totalPrize,
      distributedBy: d.distributedBy,
      status: d.status,
      note: d.note
    })).sort((a, b) => new Date(b.date) - new Date(a.date))
  };
}

function getDistributionDetails(distributionId) {
  const { rows } = getSheetData(SHEET_NAMES.REWARD_DETAILS);
  const details = rows.filter(r => r.distributionId === distributionId)
    .map(r => ({
      memberId: r.memberId,
      memberName: r.memberName,
      cpValue: r.cpValue,
      tier: r.tier,
      percentage: r.percentage,
      amount: r.amount
    }))
    .sort((a, b) => b.amount - a.amount);
  return { success: true, details };
}

function deleteDistribution(distributionId, currentUser) {
  if (currentUser.role !== 'Super Admin') return { success: false, error: 'ไม่มีสิทธิ์' };
  const sheet = getSheet(SHEET_NAMES.REWARD_DISTRIBUTIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const statusCol = headers.indexOf('status');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === distributionId) {
      if (data[i][statusCol] === 'confirmed') {
        return { success: false, error: 'ไม่สามารถลบรายการที่ยืนยันแล้ว' };
      }
      sheet.getRange(i + 1, statusCol + 1).setValue('deleted');
      logActivity(currentUser.username, 'deleteDistribution', 'Deleted: ' + distributionId);
      return { success: true, message: 'ลบรายการสำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบรายการ' };
}

// === DASHBOARD ===
function getDashboardData(currentUser) {
  const membersResult = getMembers(currentUser);
  const members = membersResult.success ? membersResult.members : [];
  const tiersResult = getCPTiers();
  const tiers = tiersResult.success ? tiersResult.tiers : [];
  const distsResult = getDistributions(currentUser);
  const distributions = distsResult.success ? distsResult.distributions : [];

  const activeMembers = members.filter(m => m.status === 'active');
  const totalCP = activeMembers.reduce((s, m) => s + (parseFloat(m.cpValue) || 0), 0);
  const avgCP = activeMembers.length > 0 ? Math.round(totalCP / activeMembers.length * 100) / 100 : 0;
  const totalDistributed = distributions
    .filter(d => d.status === 'confirmed')
    .reduce((s, d) => s + (parseFloat(d.totalPrize) || 0), 0);

  // Tier distribution
  const tierDistribution = {};
  activeMembers.forEach(m => {
    const t = m.tier || '-';
    if (!tierDistribution[t]) tierDistribution[t] = 0;
    tierDistribution[t]++;
  });

  // Top performers - lookup weaponClass and profileImage from Users sheet
  const usersData = getSheetData(SHEET_NAMES.USERS);
  const userMap = {};
  usersData.rows.forEach(u => { userMap[u.displayName] = { weaponClass: u.weaponClass || '', profileImage: u.profileImage || '' }; });
  const topPerformers = [...activeMembers]
    .sort((a, b) => (parseFloat(b.cpValue) || 0) - (parseFloat(a.cpValue) || 0))
    .slice(0, 10)
    .map(m => ({ name: m.name, cpValue: parseFloat(m.cpValue) || 0, tier: m.tier, weaponClass: (userMap[m.name] || {}).weaponClass || '', profileImage: (userMap[m.name] || {}).profileImage || '' }));

  // Recent distributions
  const recentDistributions = distributions.slice(0, 5);

  return {
    success: true,
    totalMembers: activeMembers.length,
    totalCP,
    avgCP,
    totalDistributed,
    distributionCount: distributions.filter(d => d.status === 'confirmed').length,
    tierDistribution,
    topPerformers,
    recentDistributions,
    pendingDistributions: distributions.filter(d => d.status === 'draft').length
  };
}

// === LOGS ===
function getActivityLogs(currentUser) {
  if (currentUser.role !== 'Super Admin') return { success: false, error: 'ไม่มีสิทธิ์' };
  const { rows } = getSheetData(SHEET_NAMES.ACTIVITY_LOGS);
  const logs = rows.slice(-200).reverse().map(r => ({
    timestamp: r.timestamp,
    user: r.user,
    action: r.action,
    details: r.details,
    oldValue: r.oldValue || '',
    newValue: r.newValue || ''
  }));
  return { success: true, logs };
}

function getLoginLogs(currentUser) {
  if (currentUser.role !== 'Super Admin') return { success: false, error: 'ไม่มีสิทธิ์' };
  const { rows } = getSheetData(SHEET_NAMES.LOGIN_LOGS);
  const logs = rows.slice(-200).reverse().map(r => ({
    timestamp: r.timestamp,
    username: r.username,
    action: r.action
  }));
  return { success: true, logs };
}

// === PASSWORD RESETS ===
function requestPasswordReset(username, reason) {
  if (!username) return { success: false, error: 'กรุณากรอกชื่อผู้ใช้' };
  const { rows: users } = getSheetData(SHEET_NAMES.USERS);
  if (!users.some(u => u.username === username)) {
    return { success: false, error: 'ไม่พบชื่อผู้ใช้นี้ในระบบ' };
  }
  // Check existing pending request
  const { rows: resets } = getSheetData(SHEET_NAMES.PASSWORD_RESETS);
  if (resets.some(r => r.username === username && r.status === 'pending')) {
    return { success: false, error: 'คุณมีคำขอรีเซ็ตที่รอดำเนินการอยู่แล้ว' };
  }
  const sheet = getSheet(SHEET_NAMES.PASSWORD_RESETS);
  const id = generateId();
  sheet.appendRow([id, now(), username, reason || '', 'pending']);
  // Create notification
  addNotification('password_reset', 'คำขอรีเซ็ตรหัสผ่าน',
    username + ' ส่งคำขอรีเซ็ตรหัสผ่าน' + (reason ? ' - ' + reason : ''));
  return { success: true, message: 'ส่งคำขอรีเซ็ตรหัสผ่านสำเร็จ แอดมินจะดำเนินการให้' };
}

function getPasswordResets(currentUser) {
  if (currentUser.role !== 'Super Admin' && currentUser.role !== 'admin') {
    return { success: false, error: 'ไม่มีสิทธิ์' };
  }
  const { rows } = getSheetData(SHEET_NAMES.PASSWORD_RESETS);
  const resets = rows.filter(r => r.status !== 'deleted').map(r => ({
    id: r.id, timestamp: r.timestamp, username: r.username,
    reason: r.reason, status: r.status
  }));
  return { success: true, resets };
}

function handlePasswordReset(resetId, approve, currentUser) {
  if (currentUser.role !== 'Super Admin' && currentUser.role !== 'admin') {
    return { success: false, error: 'ไม่มีสิทธิ์' };
  }
  const sheet = getSheet(SHEET_NAMES.PASSWORD_RESETS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const statusCol = headers.indexOf('status');
  const usernameCol = headers.indexOf('username');
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === resetId) {
      const username = data[i][usernameCol];
      if (approve) {
        // Auto-generate temp password
        var rand = Math.floor(1000 + Math.random() * 9000);
        var tempPw = String(username).toLowerCase() + rand;
        // Update user password + set forceChangePassword flag
        const userSheet = getSheet(SHEET_NAMES.USERS);
        const userData = userSheet.getDataRange().getValues();
        const uHeaders = userData[0];
        const uCol = uHeaders.indexOf('username');
        const pCol = uHeaders.indexOf('password');
        var fcCol = uHeaders.indexOf('forceChangePassword');
        // Add forceChangePassword column if not exists
        if (fcCol < 0) {
          fcCol = uHeaders.length;
          userSheet.getRange(1, fcCol + 1).setValue('forceChangePassword');
        }
        for (let j = 1; j < userData.length; j++) {
          if (userData[j][uCol] === username) {
            userSheet.getRange(j + 1, pCol + 1).setValue(tempPw);
            userSheet.getRange(j + 1, fcCol + 1).setValue(true);
            break;
          }
        }
        sheet.getRange(i + 1, statusCol + 1).setValue('approved');
        addNotification('info', 'รีเซ็ตรหัสผ่านสำเร็จ',
          'รีเซ็ตรหัสผ่านให้ ' + username + ' แล้ว');
        logActivity(currentUser.username, 'handlePasswordReset', 'Approved reset for: ' + username);
        return { success: true, tempPassword: tempPw, username: username, message: 'รีเซ็ตรหัสผ่าน ' + username + ' สำเร็จ' };
      } else {
        sheet.getRange(i + 1, statusCol + 1).setValue('rejected');
        logActivity(currentUser.username, 'handlePasswordReset', 'Rejected reset for: ' + username);
        return { success: true, message: 'ปฏิเสธคำขอสำเร็จ' };
      }
    }
  }
  return { success: false, error: 'ไม่พบคำขอ' };
}

function forceChangePassword(username, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร' };
  }
  const sheet = getSheet(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const uCol = headers.indexOf('username');
  const pCol = headers.indexOf('password');
  var fcCol = headers.indexOf('forceChangePassword');
  for (let i = 1; i < data.length; i++) {
    if (data[i][uCol] === username) {
      sheet.getRange(i + 1, pCol + 1).setValue(newPassword);
      if (fcCol >= 0) {
        sheet.getRange(i + 1, fcCol + 1).setValue(false);
      }
      logActivity(username, 'forceChangePassword', 'Password changed after reset');
      return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
    }
  }
  return { success: false, error: 'ไม่พบผู้ใช้' };
}

// === NOTIFICATIONS ===
function addNotification(type, title, message) {
  try {
    const sheet = getOrCreateSheet(SHEET_NAMES.NOTIFICATIONS,
      ['id', 'timestamp', 'type', 'title', 'message', 'read']);
    sheet.appendRow([generateId(), now(), type, title, message, false]);
  } catch (e) { /* ignore */ }
}

function getNotifications(currentUser) {
  if (currentUser.role !== 'Super Admin' && currentUser.role !== 'admin') {
    return { success: false, error: 'ไม่มีสิทธิ์' };
  }
  const { rows } = getSheetData(SHEET_NAMES.NOTIFICATIONS);
  const notifications = rows.reverse().slice(0, 100).map(r => ({
    id: r.id, timestamp: r.timestamp, type: r.type,
    title: r.title, message: r.message, read: r.read === true || r.read === 'TRUE'
  }));
  return { success: true, notifications };
}

function markNotificationRead(notifId, currentUser) {
  if (currentUser.role !== 'Super Admin' && currentUser.role !== 'admin') {
    return { success: false, error: 'ไม่มีสิทธิ์' };
  }
  const sheet = getSheet(SHEET_NAMES.NOTIFICATIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const readCol = headers.indexOf('read');
  for (let i = 1; i < data.length; i++) {
    if (notifId === 'all' || data[i][idCol] === notifId) {
      sheet.getRange(i + 1, readCol + 1).setValue(true);
    }
  }
  return { success: true };
}

// === GROWTH ===
function getGrowthData() {
  const sessionsData = getSheetData(SHEET_NAMES.CP_UPDATE_SESSIONS);
  const historyData = getSheetData(SHEET_NAMES.MEMBER_CP_HISTORY);

  const sessions = sessionsData.rows.map(s => ({
    id: s.id,
    startDate: s.startDate,
    endDate: s.endDate,
    status: s.status,
    submissionCount: s.submissionCount || 0
  }));

  const history = historyData.rows.map(h => ({
    id: h.id,
    memberId: h.memberId,
    memberName: h.memberName,
    oldCP: parseFloat(h.oldCP) || 0,
    newCP: parseFloat(h.newCP) || 0,
    oldTier: h.oldTier || '-',
    newTier: h.newTier || '-',
    sessionId: h.sessionId || '',
    timestamp: h.timestamp,
    source: h.source || ''
  }));

  return { success: true, sessions, history };
}
