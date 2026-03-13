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
  REGISTER: 'Register'
};

const DEFAULT_SUPERADMIN = {
  username: 'superadmin',
  password: 'admin1234',
  displayName: 'Super Admin',
  role: 'superadmin',
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

function logActivity(user, action, details) {
  try {
    const sheet = getOrCreateSheet(SHEET_NAMES.ACTIVITY_LOGS,
      ['timestamp', 'user', 'action', 'details']);
    sheet.appendRow([now(), user, action, details || '']);
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
    ['username', 'password', 'displayName', 'role', 'status', 'profileImage', 'weaponClass']);
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
    ['timestamp', 'user', 'action', 'details']);
  getOrCreateSheet(SHEET_NAMES.PASSWORD_RESETS,
    ['id', 'timestamp', 'username', 'reason', 'status']);
  getOrCreateSheet(SHEET_NAMES.NOTIFICATIONS,
    ['id', 'timestamp', 'type', 'title', 'message', 'read']);

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
  return { success: true, message: 'Sheets setup complete' };
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
      // Dashboard
      case 'getDashboardData': result = getDashboardData(data.currentUser); break;
      // Activity Logs
      case 'getActivityLogs': result = getActivityLogs(data.currentUser); break;
      case 'getLoginLogs': result = getLoginLogs(data.currentUser); break;
      // Password Resets & Notifications
      case 'requestPasswordReset': result = requestPasswordReset(data.username, data.reason); break;
      case 'getPasswordResets': result = getPasswordResets(data.currentUser); break;
      case 'handlePasswordReset': result = handlePasswordReset(data.resetId, data.approve, data.newPassword, data.currentUser); break;
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
  return {
    success: true,
    user: {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
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

// === USER MANAGEMENT (SuperAdmin) ===
function getUsers(currentUser) {
  if (currentUser.role !== 'superadmin') return { success: false, error: 'ไม่มีสิทธิ์' };
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
  if (currentUser.role !== 'superadmin') return { success: false, error: 'ไม่มีสิทธิ์' };
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
  if (currentUser.role !== 'superadmin') return { success: false, error: 'ไม่มีสิทธิ์' };
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
  if (currentUser.role !== 'superadmin') return { success: false, error: 'ไม่มีสิทธิ์' };
  if (username === 'superadmin') return { success: false, error: 'ไม่สามารถลบ SuperAdmin ได้' };
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
  if (currentUser.role !== 'superadmin') return { success: false, error: 'ไม่มีสิทธิ์' };
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
      const cpValue = parseFloat(memberData.cpValue) || parseFloat(data[i][headers.indexOf('cpValue')]) || 0;
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
      logActivity(currentUser.username, 'updateMember', 'Updated: ' + memberData.name);
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
  let count = 0;
  updates.forEach(u => {
    for (let i = 1; i < data.length; i++) {
      if (data[i][idCol] === u.id) {
        const cpValue = parseFloat(u.cpValue) || 0;
        const tierInfo = findTier(cpValue);
        sheet.getRange(i + 1, cpCol + 1).setValue(cpValue);
        sheet.getRange(i + 1, tierCol + 1).setValue(tierInfo.tierName);
        sheet.getRange(i + 1, pctCol + 1).setValue(tierInfo.rewardPercent);
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
  if (currentUser.role !== 'superadmin') return { success: false, error: 'ไม่มีสิทธิ์' };
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
  if (currentUser.role !== 'superadmin') return { success: false, error: 'ไม่มีสิทธิ์' };
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
  if (currentUser.role !== 'superadmin') return { success: false, error: 'ไม่มีสิทธิ์' };
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
  if (currentUser.role !== 'superadmin') return { success: false, error: 'เฉพาะ SuperAdmin เท่านั้นที่ยืนยันได้' };
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
  if (currentUser.role !== 'superadmin') return { success: false, error: 'ไม่มีสิทธิ์' };
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

  // Top performers - lookup weaponClass from Users sheet
  const usersData = getSheetData(SHEET_NAMES.USERS);
  const userMap = {};
  usersData.rows.forEach(u => { userMap[u.displayName] = u.weaponClass || ''; });
  const topPerformers = [...activeMembers]
    .sort((a, b) => (parseFloat(b.cpValue) || 0) - (parseFloat(a.cpValue) || 0))
    .slice(0, 10)
    .map(m => ({ name: m.name, cpValue: parseFloat(m.cpValue) || 0, tier: m.tier, weaponClass: userMap[m.name] || '' }));

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
  if (currentUser.role !== 'superadmin') return { success: false, error: 'ไม่มีสิทธิ์' };
  const { rows } = getSheetData(SHEET_NAMES.ACTIVITY_LOGS);
  const logs = rows.slice(-200).reverse().map(r => ({
    timestamp: r.timestamp,
    user: r.user,
    action: r.action,
    details: r.details
  }));
  return { success: true, logs };
}

function getLoginLogs(currentUser) {
  if (currentUser.role !== 'superadmin') return { success: false, error: 'ไม่มีสิทธิ์' };
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
  if (currentUser.role !== 'superadmin' && currentUser.role !== 'admin') {
    return { success: false, error: 'ไม่มีสิทธิ์' };
  }
  const { rows } = getSheetData(SHEET_NAMES.PASSWORD_RESETS);
  const resets = rows.filter(r => r.status !== 'deleted').map(r => ({
    id: r.id, timestamp: r.timestamp, username: r.username,
    reason: r.reason, status: r.status
  }));
  return { success: true, resets };
}

function handlePasswordReset(resetId, approve, newPassword, currentUser) {
  if (currentUser.role !== 'superadmin' && currentUser.role !== 'admin') {
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
        // Reset the user's password
        const pw = newPassword || '1234';
        const userSheet = getSheet(SHEET_NAMES.USERS);
        const userData = userSheet.getDataRange().getValues();
        const uHeaders = userData[0];
        const uCol = uHeaders.indexOf('username');
        const pCol = uHeaders.indexOf('password');
        for (let j = 1; j < userData.length; j++) {
          if (userData[j][uCol] === username) {
            userSheet.getRange(j + 1, pCol + 1).setValue(pw);
            break;
          }
        }
        sheet.getRange(i + 1, statusCol + 1).setValue('approved');
        addNotification('info', 'รีเซ็ตรหัสผ่านสำเร็จ',
          'รีเซ็ตรหัสผ่านให้ ' + username + ' แล้ว');
        logActivity(currentUser.username, 'handlePasswordReset', 'Approved reset for: ' + username);
        return { success: true, message: 'รีเซ็ตรหัสผ่าน ' + username + ' สำเร็จ (รหัสใหม่: ' + pw + ')' };
      } else {
        sheet.getRange(i + 1, statusCol + 1).setValue('rejected');
        logActivity(currentUser.username, 'handlePasswordReset', 'Rejected reset for: ' + username);
        return { success: true, message: 'ปฏิเสธคำขอสำเร็จ' };
      }
    }
  }
  return { success: false, error: 'ไม่พบคำขอ' };
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
  if (currentUser.role !== 'superadmin' && currentUser.role !== 'admin') {
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
  if (currentUser.role !== 'superadmin' && currentUser.role !== 'admin') {
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
