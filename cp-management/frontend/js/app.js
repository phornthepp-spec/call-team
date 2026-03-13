// ============================================================
// CP Management - Frontend JavaScript
// ============================================================

// === CONFIG ===
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwWfPaQwRpqmX2I9UTw2Nh_fP4pIof8b69ghebaYfwlDoRg3hFpwmrP2a0zP_oVqneU/exec';
let DEMO_MODE = true;
let currentUser = null;
let charts = {};
let currentDistributionId = null;
let currentRewardBreakdown = null;
const TIER_COLORS = { Diamond:'#e74c3c', Platinum:'#9b6dff', Gold:'#f1c40f', Silver:'#5dade2', Bronze:'#8b5e3c' };
function getTierColor(name) { return TIER_COLORS[name] || '#6b6058'; }

// === DEMO DATA ===
const DEMO = {
  tiers: [
    { id:'t1', tierName:'Bronze', minCP:0, maxCP:100, rewardPercent:0, status:'active' },
    { id:'t2', tierName:'Silver', minCP:101, maxCP:300, rewardPercent:10, status:'active' },
    { id:'t3', tierName:'Gold', minCP:301, maxCP:600, rewardPercent:20, status:'active' },
    { id:'t4', tierName:'Platinum', minCP:601, maxCP:1000, rewardPercent:30, status:'active' },
    { id:'t5', tierName:'Diamond', minCP:1001, maxCP:9999, rewardPercent:40, status:'active' }
  ],
  members: [
    { id:'m1', name:'DarkKnight', cpValue:1520, tier:'Diamond', rewardPercent:40, status:'active', weaponClass:'One-handed Sword' },
    { id:'m2', name:'ShadowFox', cpValue:870, tier:'Platinum', rewardPercent:30, status:'active', weaponClass:'Dagger' },
    { id:'m3', name:'IceQueen', cpValue:750, tier:'Platinum', rewardPercent:30, status:'active', weaponClass:'Staff' },
    { id:'m4', name:'FireStorm', cpValue:520, tier:'Gold', rewardPercent:20, status:'active', weaponClass:'Wand' },
    { id:'m5', name:'ThunderBolt', cpValue:480, tier:'Gold', rewardPercent:20, status:'active', weaponClass:'Spear' },
    { id:'m6', name:'MoonWalker', cpValue:350, tier:'Gold', rewardPercent:20, status:'active', weaponClass:'Bow' },
    { id:'m7', name:'StarLight', cpValue:250, tier:'Silver', rewardPercent:10, status:'active', weaponClass:'Orb' },
    { id:'m8', name:'WindRunner', cpValue:180, tier:'Silver', rewardPercent:10, status:'active', weaponClass:'Twin Sword' },
    { id:'m9', name:'EarthShaker', cpValue:90, tier:'Bronze', rewardPercent:0, status:'active', weaponClass:'Two-handed Sword' },
    { id:'m10', name:'NovaBlade', cpValue:45, tier:'Bronze', rewardPercent:0, status:'active', weaponClass:'Rapier' }
  ],
  users: [
    { username:'iitoonx', displayName:'iitoonx', role:'superadmin', status:'active', profileImage:'', weaponClass:'Two-handed Sword' },
    { username:'superadmin', displayName:'Super Admin', role:'superadmin', status:'active', profileImage:'', weaponClass:'' },
    { username:'darknight', displayName:'DarkKnight', role:'admin', status:'active', profileImage:'', weaponClass:'One-handed Sword' },
    { username:'shadowfox', displayName:'ShadowFox', role:'admin', status:'active', profileImage:'', weaponClass:'Dagger' },
    { username:'icequeen', displayName:'IceQueen', role:'member', status:'active', profileImage:'', weaponClass:'Staff' },
    { username:'firestorm', displayName:'FireStorm', role:'member', status:'active', profileImage:'', weaponClass:'Wand' },
    { username:'thunderbolt', displayName:'ThunderBolt', role:'member', status:'active', profileImage:'', weaponClass:'Spear' },
    { username:'moonwalker', displayName:'MoonWalker', role:'member', status:'active', profileImage:'', weaponClass:'Bow' },
    { username:'starlight', displayName:'StarLight', role:'member', status:'active', profileImage:'', weaponClass:'Orb' },
    { username:'newplayer99', displayName:'NewPlayer99', role:'member', status:'pending', profileImage:'', weaponClass:'Rapier' }
  ],
  distributions: [
    { id:'dist1', date:'2026-03-10T14:30:00', totalPrize:50000, distributedBy:'iitoonx', status:'confirmed' },
    { id:'dist2', date:'2026-03-05T10:00:00', totalPrize:30000, distributedBy:'iitoonx', status:'confirmed' },
    { id:'dist3', date:'2026-02-28T16:45:00', totalPrize:100000, distributedBy:'superadmin', status:'confirmed' },
    { id:'dist4', date:'2026-03-13T09:00:00', totalPrize:25000, distributedBy:'iitoonx', status:'draft' }
  ],
  rewardDetails: [
    { distributionId:'dist1', memberId:'m1', memberName:'DarkKnight', cpValue:1520, tier:'Diamond', percentage:200, amount:15840.56 },
    { distributionId:'dist1', memberId:'m2', memberName:'ShadowFox', cpValue:870, tier:'Platinum', percentage:150, amount:6795.24 },
    { distributionId:'dist1', memberId:'m3', memberName:'IceQueen', cpValue:750, tier:'Platinum', percentage:150, amount:5856.42 },
    { distributionId:'dist1', memberId:'m4', memberName:'FireStorm', cpValue:520, tier:'Gold', percentage:100, amount:2708.33 },
    { distributionId:'dist1', memberId:'m5', memberName:'ThunderBolt', cpValue:480, tier:'Gold', percentage:100, amount:2500.00 },
    { distributionId:'dist1', memberId:'m6', memberName:'MoonWalker', cpValue:350, tier:'Gold', percentage:100, amount:1822.92 },
    { distributionId:'dist1', memberId:'m7', memberName:'StarLight', cpValue:250, tier:'Silver', percentage:75, amount:976.56 },
    { distributionId:'dist1', memberId:'m8', memberName:'WindRunner', cpValue:180, tier:'Silver', percentage:75, amount:703.13 },
    { distributionId:'dist1', memberId:'m9', memberName:'EarthShaker', cpValue:90, tier:'Bronze', percentage:50, amount:234.38 },
    { distributionId:'dist1', memberId:'m10', memberName:'NovaBlade', cpValue:45, tier:'Bronze', percentage:50, amount:117.19 },
    { distributionId:'dist2', memberId:'m1', memberName:'DarkKnight', cpValue:1520, tier:'Diamond', percentage:200, amount:9504.34 },
    { distributionId:'dist2', memberId:'m2', memberName:'ShadowFox', cpValue:870, tier:'Platinum', percentage:150, amount:4077.14 },
    { distributionId:'dist2', memberId:'m3', memberName:'IceQueen', cpValue:750, tier:'Platinum', percentage:150, amount:3513.85 },
    { distributionId:'dist2', memberId:'m4', memberName:'FireStorm', cpValue:520, tier:'Gold', percentage:100, amount:1625.00 },
    { distributionId:'dist2', memberId:'m5', memberName:'ThunderBolt', cpValue:480, tier:'Gold', percentage:100, amount:1500.00 },
    { distributionId:'dist2', memberId:'m6', memberName:'MoonWalker', cpValue:350, tier:'Gold', percentage:100, amount:1093.75 },
    { distributionId:'dist2', memberId:'m7', memberName:'StarLight', cpValue:250, tier:'Silver', percentage:75, amount:585.94 },
    { distributionId:'dist2', memberId:'m8', memberName:'WindRunner', cpValue:180, tier:'Silver', percentage:75, amount:421.87 },
    { distributionId:'dist2', memberId:'m9', memberName:'EarthShaker', cpValue:90, tier:'Bronze', percentage:50, amount:140.63 },
    { distributionId:'dist2', memberId:'m10', memberName:'NovaBlade', cpValue:45, tier:'Bronze', percentage:50, amount:70.31 }
  ],
  activityLogs: [
    { timestamp:'2026-03-13 10:30', user:'iitoonx', action:'calculateRewards', details:'Prize: 25,000, Members: 10' },
    { timestamp:'2026-03-13 10:00', user:'iitoonx', action:'login', details:'Login success' },
    { timestamp:'2026-03-12 18:00', user:'iitoonx', action:'updateMember', details:'Updated: DarkKnight CP 1520' },
    { timestamp:'2026-03-12 17:30', user:'iitoonx', action:'createMember', details:'Created: NovaBlade' },
    { timestamp:'2026-03-11 14:00', user:'darknight', action:'login', details:'Login success' },
    { timestamp:'2026-03-10 14:30', user:'iitoonx', action:'confirmDistribution', details:'Confirmed: dist1 (50,000 baht)' },
    { timestamp:'2026-03-10 14:00', user:'iitoonx', action:'calculateRewards', details:'Prize: 50,000, Members: 10' },
    { timestamp:'2026-03-08 09:00', user:'superadmin', action:'createCPTier', details:'Created tier: Diamond' },
    { timestamp:'2026-03-07 11:00', user:'superadmin', action:'approveUser', details:'Approved: firestorm' },
    { timestamp:'2026-03-05 10:00', user:'iitoonx', action:'confirmDistribution', details:'Confirmed: dist2 (30,000 baht)' }
  ],
  loginLogs: [
    { timestamp:'2026-03-13 10:00', username:'iitoonx', action:'success' },
    { timestamp:'2026-03-12 18:00', username:'iitoonx', action:'success' },
    { timestamp:'2026-03-12 15:30', username:'unknown_user', action:'failed' },
    { timestamp:'2026-03-11 14:00', username:'darknight', action:'success' },
    { timestamp:'2026-03-11 09:00', username:'shadowfox', action:'success' },
    { timestamp:'2026-03-10 20:00', username:'icequeen', action:'success' },
    { timestamp:'2026-03-10 14:00', username:'iitoonx', action:'success' },
    { timestamp:'2026-03-09 12:00', username:'firestorm', action:'success' },
    { timestamp:'2026-03-08 09:00', username:'superadmin', action:'success' },
    { timestamp:'2026-03-07 22:00', username:'hacker123', action:'failed' }
  ],
  passwordResets: [
    { id:'pr1', timestamp:'2026-03-13 08:00', username:'moonwalker', reason:'ลืมรหัสผ่าน เปลี่ยนเครื่องใหม่', status:'pending' },
    { id:'pr2', timestamp:'2026-03-11 10:00', username:'starlight', reason:'จำรหัสผ่านไม่ได้', status:'approved' },
    { id:'pr3', timestamp:'2026-03-09 15:00', username:'firestorm', reason:'', status:'rejected' }
  ],
  notifications: [
    { id:'n1', timestamp:'2026-03-13 08:00', type:'password_reset', title:'คำขอรีเซ็ตรหัสผ่าน', message:'moonwalker ส่งคำขอรีเซ็ตรหัสผ่าน - ลืมรหัสผ่าน เปลี่ยนเครื่องใหม่', read:false },
    { id:'n2', timestamp:'2026-03-12 17:30', type:'register', title:'ผู้ใช้ใหม่ลงทะเบียน', message:'newplayer99 (NewPlayer99) ลงทะเบียน CP: 0', read:false },
    { id:'n3', timestamp:'2026-03-11 10:00', type:'info', title:'รีเซ็ตรหัสผ่านสำเร็จ', message:'รีเซ็ตรหัสผ่านให้ starlight แล้ว', read:true },
    { id:'n4', timestamp:'2026-03-10 14:30', type:'info', title:'แจกรางวัลสำเร็จ', message:'ยืนยันการแจกรางวัล 50,000 บาท ให้ 10 คน', read:true },
    { id:'n5', timestamp:'2026-03-08 09:00', type:'register', title:'ผู้ใช้ใหม่ลงทะเบียน', message:'thunderbolt (ThunderBolt) ลงทะเบียน CP: 480', read:true }
  ]
};

// === API ===
async function callAPI(action, data = {}) {
  if (DEMO_MODE) return demoAPI(action, data);
  try {
    const payload = JSON.stringify({ action, ...data, currentUser });
    const resp = await fetch(GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      body: payload
    });
    const text = await resp.text();
    try { return JSON.parse(text); }
    catch { return { success: false, error: 'Invalid response from server' }; }
  } catch (err) {
    showToast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + err.message, 'error');
    return { success: false, error: err.message };
  }
}

// === DEMO API ===
function demoAPI(action, data) {
  switch (action) {
    case 'login': return demoLogin(data);
    case 'register': return demoRegister(data);
    case 'changePassword': return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ (Demo)' };
    case 'updateProfile': return demoUpdateProfile(data);
    case 'getUsers': return { success: true, users: DEMO.users };
    case 'getPendingUsers': return { success: true, pending: DEMO.users.filter(u => u.status === 'pending') };
    case 'approveUser': return demoApproveUser(data);
    case 'updateUser': return demoUpdateUser(data);
    case 'deleteUser': return demoDeleteUser(data);
    case 'resetUserPassword': return { success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ (Demo)' };
    case 'getMembers': return demoGetMembers();
    case 'createMember': return demoCreateMember(data);
    case 'updateMember': return demoUpdateMember(data);
    case 'deleteMember': return demoDeleteMember(data);
    case 'batchUpdateCP': return demoBatchUpdateCP(data);
    case 'getCPTiers': return { success: true, tiers: DEMO.tiers.filter(t => t.status !== 'deleted') };
    case 'createCPTier': return demoCreateTier(data);
    case 'updateCPTier': return demoUpdateTier(data);
    case 'deleteCPTier': return demoDeleteTier(data);
    case 'calculateRewards': return demoCalculateRewards(data);
    case 'confirmDistribution': return demoConfirmDist(data);
    case 'getDistributions': return demoGetDistributions();
    case 'getDistributionDetails': return demoGetDistDetails(data);
    case 'deleteDistribution': return demoDeleteDist(data);
    case 'getDashboardData': return demoGetDashboard();
    case 'getActivityLogs': return { success: true, logs: DEMO.activityLogs };
    case 'getLoginLogs': return { success: true, logs: DEMO.loginLogs };
    case 'requestPasswordReset': return demoRequestPasswordReset(data);
    case 'getPasswordResets': return { success: true, resets: DEMO.passwordResets.filter(r => r.status !== 'deleted') };
    case 'handlePasswordReset': return demoHandlePasswordReset(data);
    case 'getNotifications': return { success: true, notifications: DEMO.notifications };
    case 'markNotificationRead': return demoMarkNotifRead(data);
    default: return { success: false, error: 'Unknown action' };
  }
}

function demoLogin(d) {
  if (DEMO_MODE) {
    // In demo, accept any user from demo data with any password, or create superadmin on-the-fly
    const u = DEMO.users.find(u => u.username === d.username);
    if (u) {
      if (u.status === 'pending') return { success: false, error: 'บัญชียังไม่ได้รับการอนุมัติ' };
      if (u.status === 'inactive') return { success: false, error: 'บัญชีถูกระงับ' };
      return { success: true, user: { username: u.username, displayName: u.displayName, role: u.role, profileImage: u.profileImage || '' } };
    }
    // Auto-create superadmin for demo
    if (d.username === 'demo' || d.username === 'admin') {
      return { success: true, user: { username: 'superadmin', displayName: 'Super Admin', role: 'superadmin', profileImage: '' } };
    }
    return { success: false, error: 'ชื่อผู้ใช้ไม่ถูกต้อง (Demo: superadmin, admin1, admin2, user1)' };
  }
}

function demoRegister(d) {
  if (DEMO.users.some(u => u.username === d.user.username)) return { success: false, error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' };
  DEMO.users.push({ username: d.user.username, displayName: d.user.displayName, role: 'member', status: 'pending', cpValue: parseFloat(d.user.cpValue) || 0, weaponClass: d.user.weaponClass || '' });
  DEMO.notifications.unshift({ id: 'n' + Date.now(), timestamp: new Date().toISOString(), type: 'register', title: 'ผู้ใช้ใหม่ลงทะเบียน', message: d.user.username + ' (' + d.user.displayName + ') ลงทะเบียน CP: ' + (d.user.cpValue || 0), read: false });
  return { success: true, message: 'ลงทะเบียนสำเร็จ กรุณารอแอดมินอนุมัติ' };
}

function demoApproveUser(d) {
  const u = DEMO.users.find(u => u.username === d.username);
  if (!u) return { success: false, error: 'ไม่พบผู้ใช้' };
  if (d.approve) { u.status = 'active'; return { success: true, message: 'อนุมัติสำเร็จ' }; }
  DEMO.users = DEMO.users.filter(u => u.username !== d.username);
  return { success: true, message: 'ปฏิเสธสำเร็จ' };
}

function demoUpdateUser(d) {
  const u = DEMO.users.find(u => u.username === d.user.username);
  if (!u) return { success: false, error: 'ไม่พบผู้ใช้' };
  Object.assign(u, d.user);
  return { success: true, message: 'อัพเดทสำเร็จ' };
}

function demoDeleteUser(d) {
  if (d.username === 'superadmin') return { success: false, error: 'ไม่สามารถลบ SuperAdmin' };
  DEMO.users = DEMO.users.filter(u => u.username !== d.username);
  return { success: true, message: 'ลบสำเร็จ' };
}

function demoUpdateProfile(d) {
  const u = DEMO.users.find(u => u.username === currentUser.username);
  if (!u) return { success: false, error: 'ไม่พบผู้ใช้' };
  if (d.displayName) u.displayName = d.displayName;
  if (d.profileImage !== undefined) u.profileImage = d.profileImage;
  return { success: true, message: 'อัพเดทโปรไฟล์สำเร็จ' };
}

function demoGetMembers() {
  let members = DEMO.members.filter(m => m.status !== 'deleted');
  if (currentUser.role === 'member') {
    members = members.filter(m => m.name === currentUser.displayName);
  }
  return { success: true, members };
}

function demoFindTier(cp) {
  const t = DEMO.tiers.find(t => t.status !== 'deleted' && cp >= t.minCP && cp <= t.maxCP);
  return t ? { tierName: t.tierName, rewardPercent: t.rewardPercent } : { tierName: '-', rewardPercent: 0 };
}

function demoCreateMember(d) {
  const cp = parseFloat(d.member.cpValue) || 0;
  const tier = demoFindTier(cp);
  const m = { id: 'dm' + Date.now(), name: d.member.name, cpValue: cp, tier: tier.tierName, rewardPercent: tier.rewardPercent, status: 'active' };
  DEMO.members.push(m);
  return { success: true, message: 'เพิ่มสมาชิกสำเร็จ' };
}

function demoUpdateMember(d) {
  const m = DEMO.members.find(m => m.id === d.member.id);
  if (!m) return { success: false, error: 'ไม่พบสมาชิก' };
  if (d.member.name !== undefined) m.name = d.member.name;
  if (d.member.cpValue !== undefined) {
    m.cpValue = parseFloat(d.member.cpValue) || 0;
    const tier = demoFindTier(m.cpValue);
    m.tier = tier.tierName; m.rewardPercent = tier.rewardPercent;
  }
  if (d.member.status !== undefined) m.status = d.member.status;
  return { success: true, message: 'อัพเดทสำเร็จ' };
}

function demoDeleteMember(d) {
  const m = DEMO.members.find(m => m.id === d.memberId);
  if (m) m.status = 'deleted';
  return { success: true, message: 'ลบสำเร็จ' };
}

function demoBatchUpdateCP(d) {
  d.updates.forEach(u => {
    const m = DEMO.members.find(m => m.id === u.id);
    if (m) {
      m.cpValue = parseFloat(u.cpValue) || 0;
      const tier = demoFindTier(m.cpValue);
      m.tier = tier.tierName; m.rewardPercent = tier.rewardPercent;
    }
  });
  return { success: true, message: 'อัพเดท CP สำเร็จ ' + d.updates.length + ' คน' };
}


function demoCreateTier(d) {
  const minCP = parseFloat(d.tier.minCP), maxCP = parseFloat(d.tier.maxCP);
  if (minCP > maxCP) return { success: false, error: 'Min CP ต้องน้อยกว่า Max CP' };
  const overlap = DEMO.tiers.find(t => t.status !== 'deleted' && minCP <= t.maxCP && maxCP >= t.minCP);
  if (overlap) return { success: false, error: 'ช่วง CP ซ้อนทับกับ: ' + overlap.tierName };
  DEMO.tiers.push({ id: 'dt' + Date.now(), tierName: d.tier.tierName, minCP, maxCP, rewardPercent: parseFloat(d.tier.rewardPercent) || 0, status: 'active' });
  demoRecalcTiers();
  return { success: true, message: 'สร้าง Tier สำเร็จ' };
}

function demoUpdateTier(d) {
  const t = DEMO.tiers.find(t => t.id === d.tier.id);
  if (!t) return { success: false, error: 'ไม่พบ Tier' };
  const minCP = parseFloat(d.tier.minCP !== undefined ? d.tier.minCP : t.minCP);
  const maxCP = parseFloat(d.tier.maxCP !== undefined ? d.tier.maxCP : t.maxCP);
  if (minCP > maxCP) return { success: false, error: 'Min CP ต้องน้อยกว่า Max CP' };
  const overlap = DEMO.tiers.find(x => x.id !== d.tier.id && x.status !== 'deleted' && minCP <= x.maxCP && maxCP >= x.minCP);
  if (overlap) return { success: false, error: 'ช่วง CP ซ้อนทับกับ: ' + overlap.tierName };
  if (d.tier.tierName !== undefined) t.tierName = d.tier.tierName;
  t.minCP = minCP; t.maxCP = maxCP;
  if (d.tier.rewardPercent !== undefined) t.rewardPercent = parseFloat(d.tier.rewardPercent);
  demoRecalcTiers();
  return { success: true, message: 'อัพเดท Tier สำเร็จ' };
}

function demoDeleteTier(d) {
  const t = DEMO.tiers.find(t => t.id === d.tierId);
  if (t) t.status = 'deleted';
  demoRecalcTiers();
  return { success: true, message: 'ลบ Tier สำเร็จ' };
}

function demoRecalcTiers() {
  DEMO.members.forEach(m => {
    if (m.status === 'deleted') return;
    const tier = demoFindTier(parseFloat(m.cpValue) || 0);
    m.tier = tier.tierName; m.rewardPercent = tier.rewardPercent;
  });
}

function demoCalculateRewards(d) {
  const totalPrize = parseFloat(d.totalPrize);
  if (!totalPrize || totalPrize <= 0) return { success: false, error: 'กรุณากรอกจำนวนเงินรางวัล' };
  let members = DEMO.members.filter(m => m.status === 'active');
  if (members.length === 0) return { success: false, error: 'ไม่มีสมาชิกที่ active' };
  const breakdown = members.map(m => {
    const cp = parseFloat(m.cpValue) || 0;
    const tier = demoFindTier(cp);
    return { memberId: m.id, memberName: m.name, cpValue: cp, tier: tier.tierName, percentage: tier.rewardPercent, effectiveWeight: cp * (tier.rewardPercent / 100), amount: 0 };
  });
  const totalWeight = breakdown.reduce((s, b) => s + b.effectiveWeight, 0);
  if (totalWeight === 0) return { success: false, error: 'น้ำหนักรวมเป็น 0' };
  let distributed = 0;
  breakdown.forEach(b => {
    b.amount = Math.floor((b.effectiveWeight / totalWeight) * totalPrize * 100) / 100;
    distributed += b.amount;
  });
  const diff = Math.round((totalPrize - distributed) * 100) / 100;
  if (diff !== 0) {
    const mi = breakdown.reduce((mi, b, i, a) => b.effectiveWeight > a[mi].effectiveWeight ? i : mi, 0);
    breakdown[mi].amount = Math.round((breakdown[mi].amount + diff) * 100) / 100;
  }
  const distId = 'dd' + Date.now();
  DEMO.distributions.push({ id: distId, date: new Date().toISOString(), totalPrize, distributedBy: currentUser.username, status: 'draft' });
  breakdown.forEach(b => DEMO.rewardDetails.push({ ...b, distributionId: distId }));
  return { success: true, distributionId: distId, totalPrize, totalWeight, memberCount: breakdown.length, breakdown: breakdown.sort((a, b) => b.amount - a.amount) };
}

function demoConfirmDist(d) {
  const dist = DEMO.distributions.find(x => x.id === d.distributionId);
  if (!dist) return { success: false, error: 'ไม่พบรายการ' };
  if (dist.status === 'confirmed') return { success: false, error: 'ยืนยันแล้ว' };
  dist.status = 'confirmed';
  return { success: true, message: 'ยืนยันการแจกรางวัลสำเร็จ' };
}

function demoGetDistributions() {
  return { success: true, distributions: DEMO.distributions.filter(d => d.status !== 'deleted').sort((a, b) => new Date(b.date) - new Date(a.date)) };
}

function demoGetDistDetails(d) {
  return { success: true, details: DEMO.rewardDetails.filter(r => r.distributionId === d.distributionId).sort((a, b) => b.amount - a.amount) };
}

function demoDeleteDist(d) {
  const dist = DEMO.distributions.find(x => x.id === d.distributionId);
  if (!dist) return { success: false, error: 'ไม่พบรายการ' };
  if (dist.status === 'confirmed') return { success: false, error: 'ไม่สามารถลบรายการที่ยืนยันแล้ว' };
  dist.status = 'deleted';
  return { success: true, message: 'ลบรายการสำเร็จ' };
}

function demoRequestPasswordReset(d) {
  const u = DEMO.users.find(u => u.username === d.username);
  if (!u) return { success: false, error: 'ไม่พบชื่อผู้ใช้นี้ในระบบ' };
  if (DEMO.passwordResets.some(r => r.username === d.username && r.status === 'pending')) return { success: false, error: 'คุณมีคำขอรีเซ็ตที่รอดำเนินการอยู่แล้ว' };
  DEMO.passwordResets.push({ id: 'pr' + Date.now(), timestamp: new Date().toISOString(), username: d.username, reason: d.reason || '', status: 'pending' });
  DEMO.notifications.unshift({ id: 'n' + Date.now(), timestamp: new Date().toISOString(), type: 'password_reset', title: 'คำขอรีเซ็ตรหัสผ่าน', message: d.username + ' ส่งคำขอรีเซ็ตรหัสผ่าน' + (d.reason ? ' - ' + d.reason : ''), read: false });
  return { success: true, message: 'ส่งคำขอรีเซ็ตรหัสผ่านสำเร็จ แอดมินจะดำเนินการให้' };
}

function demoHandlePasswordReset(d) {
  const r = DEMO.passwordResets.find(r => r.id === d.resetId);
  if (!r) return { success: false, error: 'ไม่พบคำขอ' };
  if (d.approve) {
    r.status = 'approved';
    DEMO.notifications.unshift({ id: 'n' + Date.now(), timestamp: new Date().toISOString(), type: 'info', title: 'รีเซ็ตรหัสผ่านสำเร็จ', message: 'รีเซ็ตรหัสผ่านให้ ' + r.username + ' แล้ว (รหัสใหม่: ' + (d.newPassword || '1234') + ')', read: false });
    return { success: true, message: 'รีเซ็ตรหัสผ่าน ' + r.username + ' สำเร็จ (รหัสใหม่: ' + (d.newPassword || '1234') + ')' };
  } else {
    r.status = 'rejected';
    return { success: true, message: 'ปฏิเสธคำขอสำเร็จ' };
  }
}

function demoMarkNotifRead(d) {
  if (d.notifId === 'all') { DEMO.notifications.forEach(n => n.read = true); }
  else { const n = DEMO.notifications.find(n => n.id === d.notifId); if (n) n.read = true; }
  return { success: true };
}

function demoGetDashboard() {
  const members = DEMO.members.filter(m => m.status === 'active');
  const filtered = currentUser.role === 'member' ? members.filter(m => m.name === currentUser.displayName) : members;
  const totalCP = filtered.reduce((s, m) => s + (parseFloat(m.cpValue) || 0), 0);
  const tierDist = {};
  filtered.forEach(m => { const t = m.tier || '-'; tierDist[t] = (tierDist[t] || 0) + 1; });
  const topPerformers = [...filtered].sort((a, b) => (parseFloat(b.cpValue) || 0) - (parseFloat(a.cpValue) || 0)).slice(0, 10).map(m => ({ name: m.name, cpValue: parseFloat(m.cpValue) || 0, tier: m.tier, weaponClass: m.weaponClass || '' }));
  const confirmed = DEMO.distributions.filter(d => d.status === 'confirmed');
  return {
    success: true, totalMembers: filtered.length, totalCP, avgCP: filtered.length > 0 ? Math.round(totalCP / filtered.length * 100) / 100 : 0,
    totalDistributed: confirmed.reduce((s, d) => s + (parseFloat(d.totalPrize) || 0), 0),
    distributionCount: confirmed.length, tierDistribution: tierDist, topPerformers,
    recentDistributions: DEMO.distributions.filter(d => d.status !== 'deleted').slice(0, 5), pendingDistributions: DEMO.distributions.filter(d => d.status === 'draft').length
  };
}

// === UI HELPERS ===
function tierBadge(tier) {
  const cls = 'badge-tier-' + (tier || '').toLowerCase();
  return `<span class="badge ${cls}">${tier || '-'}</span>`;
}

function showToast(msg, type = 'success') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  t.innerHTML = '<span>' + (icons[type] || '') + '</span><span>' + msg + '</span>';
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(40px)'; setTimeout(() => t.remove(), 300); }, 3000);
}

function showModal(id) { document.getElementById(id).classList.add('show'); }
function hideModal(id) { document.getElementById(id).classList.remove('show'); }

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarBackdrop').classList.toggle('show');
}

function fmt(n) { return n != null ? Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'; }
function formatNumberInput(el) {
  let v = el.value.replace(/[^0-9.]/g, '');
  const parts = v.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const pos = el.selectionStart;
  const oldLen = el.value.length;
  el.value = parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0];
  const newLen = el.value.length;
  el.setSelectionRange(pos + (newLen - oldLen), pos + (newLen - oldLen));
}
function parseNum(str) { return parseFloat(String(str).replace(/,/g, '')) || 0; }
function fmtDate(d) { try { return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d || '-'; } }

// === AUTH ===
function switchLoginTab(tab) {
  document.querySelectorAll('.login-tab').forEach((t, i) => t.classList.toggle('active', (tab === 'login' ? i === 0 : i === 1)));
  document.getElementById('loginFields').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerFields').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('registerFields').classList.toggle('show', tab === 'register');
}

function toggleDemoMode() { DEMO_MODE = document.getElementById('demoToggle').checked; }

function checkRegPassMatch() {
  const pw = document.getElementById('regPass').value;
  const cf = document.getElementById('regPassConfirm').value;
  const el = document.getElementById('regPassMismatch');
  const inp = document.getElementById('regPassConfirm');
  if (cf.length > 0 && pw !== cf) {
    el.style.display = 'block';
    inp.style.borderColor = 'var(--red)';
  } else {
    el.style.display = 'none';
    inp.style.borderColor = cf.length > 0 && pw === cf ? 'var(--green)' : '';
  }
}

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  if (!username) { showToast('กรุณากรอกชื่อผู้ใช้', 'error'); return; }
  const r = await callAPI('login', { username, password });
  if (r.success) {
    currentUser = r.user;
    localStorage.setItem('cpUser', JSON.stringify(currentUser));
    localStorage.setItem('cpDemoMode', DEMO_MODE);
    showApp();
    showToast('ยินดีต้อนรับ ' + currentUser.displayName);
  } else {
    showToast(r.error, 'error');
  }
}

async function doRegister() {
  const user = { username: document.getElementById('regUser').value.trim(), password: document.getElementById('regPass').value, displayName: document.getElementById('regName').value.trim(), weaponClass: document.getElementById('regClass').value, cpValue: parseNum(document.getElementById('regCP').value) };
  const confirmPw = document.getElementById('regPassConfirm').value;
  if (!user.username || !user.password || !user.displayName) { showToast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
  if (user.password !== confirmPw) { showToast('รหัสผ่านไม่ตรงกัน กรุณากรอกให้ตรงกัน', 'error'); return; }
  const r = await callAPI('register', { user });
  if (r.success) { showToast(r.message); switchLoginTab('login'); }
  else showToast(r.error, 'error');
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem('cpUser');
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showChangePasswordModal() { showModal('passwordModal'); }

async function doChangePassword() {
  const o = document.getElementById('oldPass').value;
  const n = document.getElementById('newPass').value;
  const c = document.getElementById('confirmPass').value;
  if (n !== c) { showToast('รหัสผ่านใหม่ไม่ตรงกัน', 'error'); return; }
  if (n.length < 4) { showToast('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร', 'error'); return; }
  const r = await callAPI('changePassword', { username: currentUser.username, oldPassword: o, newPassword: n });
  if (r.success) { showToast(r.message); hideModal('passwordModal'); }
  else showToast(r.error, 'error');
}

// === NAVIGATION ===
const NAV_ITEMS = [
  { id: 'Dashboard', label: 'Dashboard', icon: '📊', roles: ['superadmin', 'admin', 'member'] },
  { id: 'Members', label: 'สมาชิก', icon: '👥', roles: ['superadmin', 'admin', 'member'] },
  { id: 'Rewards', label: 'แจกรางวัล', icon: '🎁', roles: ['superadmin', 'admin', 'member'] },
  { id: 'Settings', label: 'CP Tiers', icon: '⚙️', roles: ['superadmin', 'admin'] },
  { id: 'Admin', label: 'จัดการระบบ', icon: '🔧', roles: ['superadmin', 'admin'] }
];

function initNav() {
  const nav = document.getElementById('navItems');
  nav.innerHTML = '';
  NAV_ITEMS.forEach(item => {
    if (!item.roles.includes(currentUser.role)) return;
    const el = document.createElement('div');
    el.className = 'nav-item';
    el.dataset.page = item.id;
    el.innerHTML = '<span class="nav-icon">' + item.icon + '</span><span>' + item.label + '</span>';
    el.onclick = () => showPage(item.id);
    nav.appendChild(el);
  });
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page' + pageId);
  if (page) page.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === pageId));
  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('show');
  // Load page data
  switch (pageId) {
    case 'Dashboard': loadDashboard(); break;
    case 'Members': loadMembers(); break;
    case 'Rewards': loadRewards(); break;
    case 'Settings': loadSettings(); break;
    case 'Admin': loadAdmin(); break;
  }
}

function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('userName').textContent = currentUser.displayName;
  document.getElementById('userRole').textContent = currentUser.role;
  updateAvatarDisplay();
  // Hide add buttons for members
  if (currentUser.role === 'member') {
    document.getElementById('btnAddMember').classList.add('hidden');
    document.getElementById('btnAddTier').classList.add('hidden');
  }
  if (currentUser.role === 'admin') {
    document.getElementById('btnAddTier').classList.add('hidden');
    // Admin: hide Users tab and Activity/Login logs, show only resetpw + notifications
    const adminTabEls = document.querySelectorAll('#adminTabs .tab');
    adminTabEls[0].classList.add('hidden'); // Users
    adminTabEls[4].classList.add('hidden'); // Activity Logs
    adminTabEls[5].classList.add('hidden'); // Login Logs
  }
  initNav();
  showPage('Dashboard');
}

// === DASHBOARD ===
async function loadDashboard() {
  const r = await callAPI('getDashboardData');
  if (!r.success) return;
  // KPI
  document.getElementById('dashKPI').innerHTML = `
    <div class="kpi"><div class="kpi-icon">👥</div><div class="kpi-label">สมาชิกทั้งหมด</div><div class="kpi-value">${fmt(r.totalMembers)}</div><div class="kpi-sub">Active members</div></div>
    <div class="kpi"><div class="kpi-icon">⚡</div><div class="kpi-label">CP รวม</div><div class="kpi-value">${fmt(r.totalCP)}</div><div class="kpi-sub">Total CP</div></div>
    <div class="kpi"><div class="kpi-icon">📈</div><div class="kpi-label">CP เฉลี่ย</div><div class="kpi-value">${fmt(r.avgCP)}</div><div class="kpi-sub">Average per member</div></div>
    <div class="kpi"><div class="kpi-icon">💰</div><div class="kpi-label">แจกรางวัลแล้ว</div><div class="kpi-value">${fmt(r.totalDistributed)}</div><div class="kpi-sub">${r.distributionCount} ครั้ง</div></div>
    <div class="kpi"><div class="kpi-icon">📝</div><div class="kpi-label">รอยืนยัน</div><div class="kpi-value">${fmt(r.pendingDistributions)}</div><div class="kpi-sub">Draft distributions</div></div>
  `;

  // Top performers
  const max = r.topPerformers[0]?.cpValue || 1;
  const tierClass = t => 'rank-tier-' + (t || '').toLowerCase();
  document.getElementById('dashTopList').innerHTML = r.topPerformers.map((p, i) => `
    <div class="rank-item ${tierClass(p.tier)}">
      <div class="rank-num ${i < 3 ? 'rank-' + (i + 1) : ''}">${i + 1}</div>
      <div class="rank-info"><div class="rank-name">${p.name}</div><div class="rank-sub"><span class="rank-tier-label ${tierClass(p.tier)}">${p.tier}</span>${p.weaponClass ? ' · ' + p.weaponClass : ''}</div></div>
      <div class="rank-val">${fmt(p.cpValue)}</div>
    </div>`).join('') || '<p style="color:var(--text3);font-size:.8rem;padding:12px">ยังไม่มีข้อมูล</p>';

  // Recent distributions (clickable → popup)
  document.getElementById('dashRecentDist').innerHTML = r.recentDistributions.map(d => `
    <div class="dist-item" onclick="showDistDetailPopup('${d.id}','${fmt(d.totalPrize)}','${fmtDate(d.date)}','${d.distributedBy}','${d.status}')">
      <div class="dist-item-header">
        <div class="dist-item-info"><div class="dist-item-amount">${fmt(d.totalPrize)} บาท</div><div class="dist-item-sub">${fmtDate(d.date)} · ${d.distributedBy}</div></div>
        <span class="badge ${d.status === 'confirmed' ? 'badge-green' : 'badge-yellow'}">${d.status.toUpperCase()}</span>
      </div>
    </div>`).join('') || '<p style="color:var(--text3);font-size:.8rem">ยังไม่มีข้อมูล</p>';
}

async function showDistDetailPopup(distId, totalPrize, date, by, status) {
  document.getElementById('distDetailTitle').innerHTML = `รายละเอียดการแจกรางวัล <span style="font-size:.7rem;color:var(--text3);font-weight:400;margin-left:8px">${date} · ${by}</span>`;
  document.getElementById('distDetailTotal').innerHTML = `<span style="color:var(--gold);font-weight:900">${totalPrize}</span> บาท <span class="badge ${status === 'confirmed' ? 'badge-green' : 'badge-yellow'}" style="margin-left:8px">${status.toUpperCase()}</span>`;
  const tbody = document.getElementById('distDetailTable');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">กำลังโหลด...</td></tr>';
  showModal('distDetailModal');
  const r = await callAPI('getDistributionDetails', { distributionId: distId });
  if (!r.success) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--red);padding:20px">ไม่สามารถโหลดข้อมูลได้</td></tr>'; return; }
  tbody.innerHTML = r.details.map((d, i) => `<tr>
    <td>${i + 1}</td>
    <td><strong>${d.memberName}</strong></td>
    <td>${fmt(d.cpValue)}</td>
    <td>${tierBadge(d.tier)}</td>
    <td>${d.percentage}%</td>
    <td><strong style="color:var(--gold)">${fmt(d.amount)} บาท</strong></td>
  </tr>`).join('');
}

// === MEMBERS ===
let allMembers = [];

async function loadMembers() {
  const r = await callAPI('getMembers');
  if (!r.success) return;
  allMembers = r.members;
  // Populate tier filter
  const tiers = [...new Set(allMembers.map(m => m.tier).filter(Boolean))];
  const tf = document.getElementById('memberTierFilter');
  tf.innerHTML = '<option value="all">ทุก Tier</option>' + tiers.map(t => `<option value="${t}">${t}</option>`).join('');
  renderMembers();
  // Tier distribution chart
  const tierDist = {};
  allMembers.filter(m => m.status === 'active').forEach(m => { const t = m.tier || '-'; tierDist[t] = (tierDist[t] || 0) + 1; });
  const tierLabels = Object.keys(tierDist);
  const tierData = Object.values(tierDist);
  const chartColors = tierLabels.map(t => getTierColor(t));
  if (charts.tier) charts.tier.destroy();
  // Custom HTML legend
  const legendEl = document.getElementById('chartTierLegend');
  if (legendEl) legendEl.innerHTML = tierLabels.map((l, i) => `<span class="badge badge-tier-${l.toLowerCase()}" style="margin:2px 4px;font-size:.7rem">${l} (${tierData[i]})</span>`).join('');
  charts.tier = new Chart(document.getElementById('chartTier'), {
    type: 'doughnut',
    data: { labels: tierLabels, datasets: [{ data: tierData, backgroundColor: chartColors, borderColor: '#161420', borderWidth: 3, hoverOffset: 18, hoverBorderWidth: 2, hoverBorderColor: 'rgba(255,255,255,.3)' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(22,20,32,.95)', titleColor: '#ede6d6', bodyColor: '#a09585',
          borderColor: 'rgba(201,165,74,.3)', borderWidth: 1, cornerRadius: 4, padding: 10,
          titleFont: { weight: '700', size: 13 }, bodyFont: { size: 12 },
          callbacks: {
            title: (items) => items[0].label,
            label: (item) => ' ' + item.raw + ' คน (' + Math.round(item.raw / tierData.reduce((a, b) => a + b, 0) * 100) + '%)'
          }
        }
      },
      animation: { animateScale: true }
    },
    plugins: [{
      id: 'doughnutLabels',
      afterDraw(chart) {
        const { ctx } = chart;
        chart.data.datasets[0].data.forEach((val, i) => {
          const meta = chart.getDatasetMeta(0).data[i];
          if (!meta) return;
          const { x, y } = meta.tooltipPosition();
          ctx.save();
          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,.6)';
          ctx.shadowBlur = 4;
          ctx.fillText(val, x, y);
          ctx.restore();
        });
      }
    }]
  });
}

function renderMembers() {
  const search = document.getElementById('memberSearch').value.toLowerCase();
  const tf = document.getElementById('memberTierFilter').value;
  let list = allMembers.filter(m => {
    if (search && !m.name.toLowerCase().includes(search)) return false;
    if (tf !== 'all' && m.tier !== tf) return false;
    return true;
  });
  const canEdit = currentUser.role !== 'member';
  document.getElementById('membersTable').innerHTML = list.map(m => {
    return `<tr>
      <td><strong>${m.name}</strong></td>
      <td><strong style="color:var(--cyan)">${fmt(m.cpValue)}</strong></td>
      <td>${tierBadge(m.tier)}</td>
      <td>${m.rewardPercent || 0}%</td>
      <td><span class="badge ${m.status === 'active' ? 'badge-green' : 'badge-red'}">${m.status}</span></td>
      <td class="table-actions">${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="editMember('${m.id}')">แก้ไข</button><button class="btn btn-danger btn-sm" onclick="deleteMember('${m.id}','${m.name}')">ลบ</button>` : '-'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="text-center" style="color:var(--text3);padding:30px">ไม่พบข้อมูลสมาชิก</td></tr>';
}

async function showMemberModal(member) {
  document.getElementById('memberModalTitle').textContent = member ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิก';
  document.getElementById('editMemberId').value = member ? member.id : '';
  document.getElementById('memberName').value = member ? member.name : '';
  document.getElementById('memberCP').value = member ? fmt(member.cpValue) : '';
  document.getElementById('memberStatus').value = member ? member.status : 'active';
  showModal('memberModal');
}

function editMember(id) { const m = allMembers.find(m => m.id === id); if (m) showMemberModal(m); }

async function saveMember() {
  const id = document.getElementById('editMemberId').value;
  const member = { name: document.getElementById('memberName').value.trim(), cpValue: parseNum(document.getElementById('memberCP').value), status: document.getElementById('memberStatus').value };
  if (!member.name) { showToast('กรุณากรอกชื่อ', 'error'); return; }
  let r;
  if (id) { member.id = id; r = await callAPI('updateMember', { member }); }
  else r = await callAPI('createMember', { member });
  if (r.success) { showToast(r.message); hideModal('memberModal'); loadMembers(); }
  else showToast(r.error, 'error');
}

async function deleteMember(id, name) {
  if (!confirm('ลบสมาชิก "' + name + '" ?')) return;
  const r = await callAPI('deleteMember', { memberId: id });
  if (r.success) { showToast(r.message); loadMembers(); }
  else showToast(r.error, 'error');
}

function showBatchUpdateModal() {
  const active = allMembers.filter(m => m.status === 'active');
  document.getElementById('batchTable').innerHTML = active.map(m => `
    <tr><td>${m.name}</td><td>${fmt(m.cpValue)}</td>
    <td><input inputmode="numeric" value="${fmt(m.cpValue)}" data-id="${m.id}" class="batch-cp" style="width:120px" oninput="formatNumberInput(this)"></td></tr>`).join('');
  showModal('batchModal');
}

async function saveBatchUpdate() {
  const inputs = document.querySelectorAll('.batch-cp');
  const updates = [];
  inputs.forEach(inp => {
    const m = allMembers.find(m => m.id === inp.dataset.id);
    if (m && parseNum(inp.value) !== parseFloat(m.cpValue)) {
      updates.push({ id: inp.dataset.id, cpValue: parseNum(inp.value) });
    }
  });
  if (updates.length === 0) { showToast('ไม่มีการเปลี่ยนแปลง', 'info'); return; }
  const r = await callAPI('batchUpdateCP', { updates });
  if (r.success) { showToast(r.message); hideModal('batchModal'); loadMembers(); }
  else showToast(r.error, 'error');
}

// === REWARDS ===
async function loadRewards() {
  const r = await callAPI('getDistributions');
  if (!r.success) return;
  document.getElementById('distHistoryTable').innerHTML = r.distributions.map(d => `
    <tr><td>${fmtDate(d.date)}</td><td><strong style="color:var(--cyan)">${fmt(d.totalPrize)}</strong> บาท</td>
    <td>${d.distributedBy}</td>
    <td><span class="badge ${d.status === 'confirmed' ? 'badge-green' : d.status === 'draft' ? 'badge-yellow' : 'badge-red'}">${d.status}</span></td>
    <td class="table-actions">
      <button class="btn btn-ghost btn-sm" onclick="viewDistDetail('${d.id}')">ดู</button>
      ${d.status === 'draft' && currentUser.role === 'superadmin' ? `<button class="btn btn-success btn-sm" onclick="confirmDist('${d.id}')">ยืนยัน</button>` : ''}
      ${d.status === 'draft' && currentUser.role === 'superadmin' ? `<button class="btn btn-danger btn-sm" onclick="deleteDist('${d.id}')">ลบ</button>` : ''}
    </td></tr>`).join('') || '<tr><td colspan="5" class="text-center" style="color:var(--text3);padding:30px">ยังไม่มีประวัติ</td></tr>';
}

async function calculateRewards() {
  const totalPrize = parseNum(document.getElementById('totalPrize').value);
  const r = await callAPI('calculateRewards', { totalPrize });
  if (!r.success) { showToast(r.error, 'error'); return; }
  currentDistributionId = r.distributionId;
  currentRewardBreakdown = r.breakdown;
  document.getElementById('rewardPreviewSection').classList.remove('hidden');
  document.getElementById('rewardSummary').innerHTML = `
    <div class="reward-summary-item"><div class="val">${fmt(r.totalPrize)}</div><div class="lbl">เงินรางวัลรวม (บาท)</div></div>
    <div class="reward-summary-item"><div class="val">${r.memberCount}</div><div class="lbl">จำนวนสมาชิก</div></div>
    <div class="reward-summary-item"><div class="val">${fmt(r.totalWeight)}</div><div class="lbl">น้ำหนักรวม</div></div>`;
  document.getElementById('rewardTable').innerHTML = r.breakdown.map((b, i) => `
    <tr><td>${i + 1}</td><td><strong>${b.memberName}</strong></td>
    <td>${fmt(b.cpValue)}</td><td>${tierBadge(b.tier)}</td>
    <td>${b.percentage}%</td><td><strong style="color:var(--green)">${fmt(b.amount)}</strong></td></tr>`).join('');
  // Show confirm only for superadmin
  document.getElementById('btnConfirmDist').style.display = currentUser.role === 'superadmin' ? 'inline-flex' : 'none';
  showToast('คำนวณสำเร็จ');
  loadRewards();
}

async function confirmCurrentDistribution() {
  if (!currentDistributionId) return;
  if (!confirm('ยืนยันการแจกรางวัลนี้?')) return;
  const r = await callAPI('confirmDistribution', { distributionId: currentDistributionId });
  if (r.success) { showToast(r.message); loadRewards(); }
  else showToast(r.error, 'error');
}

async function confirmDist(id) {
  if (!confirm('ยืนยันการแจกรางวัลนี้?')) return;
  const r = await callAPI('confirmDistribution', { distributionId: id });
  if (r.success) { showToast(r.message); loadRewards(); }
  else showToast(r.error, 'error');
}

async function deleteDist(id) {
  if (!confirm('ลบรายการแจกรางวัลนี้?')) return;
  const r = await callAPI('deleteDistribution', { distributionId: id });
  if (r.success) { showToast(r.message); loadRewards(); }
  else showToast(r.error, 'error');
}

async function viewDistDetail(id) {
  const r = await callAPI('getDistributionDetails', { distributionId: id });
  if (!r.success) return;
  document.getElementById('distDetailTable').innerHTML = r.details.map((d, i) => `
    <tr><td>${i + 1}</td><td><strong>${d.memberName}</strong></td><td>${fmt(d.cpValue)}</td>
    <td>${tierBadge(d.tier)}</td><td>${d.percentage}%</td>
    <td><strong style="color:var(--green)">${fmt(d.amount)}</strong></td></tr>`).join('');
  showModal('distDetailModal');
}

function exportRewardCSV() {
  if (!currentRewardBreakdown) return;
  let csv = '\uFEFF#,ชื่อ,CP,Tier,%,จำนวนเงิน\n';
  currentRewardBreakdown.forEach((b, i) => {
    csv += `${i + 1},"${b.memberName}",${b.cpValue},"${b.tier}",${b.percentage},${b.amount}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'reward_distribution_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  showToast('Export CSV สำเร็จ');
}


// === SETTINGS (CP Tiers) ===
let allTiers = [];

async function loadSettings() {
  const r = await callAPI('getCPTiers');
  if (!r.success) return;
  allTiers = r.tiers;
  // Visual range
  const maxCP = Math.max(...allTiers.map(t => t.maxCP), 100);
  document.getElementById('tierVisual').innerHTML = allTiers.sort((a, b) => a.minCP - b.minCP).map(t => {
    const w = Math.max(((t.maxCP - t.minCP) / maxCP) * 100, 10);
    const left = (t.minCP / maxCP) * 100;
    return `<div class="tier-bar"><div class="tier-bar-fill" style="width:${w}%;margin-left:${left}%;background:${getTierColor(t.tierName)}">${t.tierName}</div><div class="tier-bar-label">${fmt(t.minCP)} - ${fmt(t.maxCP)} CP (${t.rewardPercent}%)</div></div>`;
  }).join('');
  // Table
  const canEdit = currentUser.role === 'superadmin';
  document.getElementById('tiersTable').innerHTML = allTiers.map(t => `
    <tr><td>${tierBadge(t.tierName)}</td><td>${fmt(t.minCP)}</td><td>${fmt(t.maxCP)}</td>
    <td><strong style="color:var(--purple)">${t.rewardPercent}%</strong></td>
    <td><span class="badge badge-green">${t.status}</span></td>
    <td class="table-actions">${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="editTier('${t.id}')">แก้ไข</button><button class="btn btn-danger btn-sm" onclick="deleteTier('${t.id}','${t.tierName}')">ลบ</button>` : '-'}</td></tr>`).join('');
}

function showTierModal(tier) {
  document.getElementById('tierModalTitle').textContent = tier ? 'แก้ไข CP Tier' : 'เพิ่ม CP Tier';
  document.getElementById('editTierId').value = tier ? tier.id : '';
  document.getElementById('tierName').value = tier ? tier.tierName : '';
  document.getElementById('tierMinCP').value = tier ? tier.minCP : '';
  document.getElementById('tierMaxCP').value = tier ? tier.maxCP : '';
  document.getElementById('tierRewardPct').value = tier ? tier.rewardPercent : '';
  showModal('tierModal');
}

function editTier(id) { const t = allTiers.find(t => t.id === id); if (t) showTierModal(t); }

async function saveTier() {
  const id = document.getElementById('editTierId').value;
  const tier = { tierName: document.getElementById('tierName').value.trim(), minCP: document.getElementById('tierMinCP').value, maxCP: document.getElementById('tierMaxCP').value, rewardPercent: document.getElementById('tierRewardPct').value };
  if (!tier.tierName) { showToast('กรุณากรอกชื่อ Tier', 'error'); return; }
  let r;
  if (id) { tier.id = id; r = await callAPI('updateCPTier', { tier }); }
  else r = await callAPI('createCPTier', { tier });
  if (r.success) { showToast(r.message); hideModal('tierModal'); loadSettings(); }
  else showToast(r.error, 'error');
}

async function deleteTier(id, name) {
  if (!confirm('ลบ Tier "' + name + '" ?')) return;
  const r = await callAPI('deleteCPTier', { tierId: id });
  if (r.success) { showToast(r.message); loadSettings(); }
  else showToast(r.error, 'error');
}

// === ADMIN ===
let allUsersData = [];

function switchAdminTab(tab) {
  document.querySelectorAll('#adminTabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#pageAdmin .tab-content').forEach(t => t.classList.remove('active'));
  const tabs = { users: 0, pending: 1, resetpw: 2, notifications: 3, activity: 4, loginlogs: 5 };
  document.querySelectorAll('#adminTabs .tab')[tabs[tab]].classList.add('active');
  document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  if (tab === 'activity') loadActivityLogs();
  if (tab === 'loginlogs') loadLoginLogs();
  if (tab === 'pending') loadPendingUsers();
  if (tab === 'resetpw') loadPasswordResets();
  if (tab === 'notifications') loadNotifications();
}

async function loadAdmin() {
  if (currentUser.role === 'superadmin') {
    await Promise.all([loadUsers(), loadPendingUsers(), loadPasswordResets(), loadNotifications()]);
  } else {
    // Admin role: default to resetpw tab
    await Promise.all([loadPendingUsers(), loadPasswordResets(), loadNotifications()]);
    switchAdminTab('pending');
  }
}

async function loadUsers() {
  const r = await callAPI('getUsers');
  if (!r.success) return;
  allUsersData = r.users;
  renderUsers();
}

function renderUsers() {
  const search = document.getElementById('userSearch').value.toLowerCase();
  const list = allUsersData.filter(u => !search || u.username.toLowerCase().includes(search) || u.displayName.toLowerCase().includes(search));
  document.getElementById('usersTable').innerHTML = list.map(u => `
    <tr><td>${u.username}</td><td>${u.displayName}</td>
    <td>${u.weaponClass || '-'}</td>
    <td>
      <select class="inline-role-select ${u.role === 'superadmin' ? 'role-superadmin' : u.role === 'admin' ? 'role-admin' : 'role-member'}" onchange="inlineUpdateRole('${u.username}', this.value, this)" ${u.username === 'superadmin' ? 'disabled' : ''}>
        <option value="member" ${u.role === 'member' ? 'selected' : ''}>member</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
        <option value="superadmin" ${u.role === 'superadmin' ? 'selected' : ''}>superadmin</option>
      </select>
    </td>
    <td><span class="badge ${u.status === 'active' ? 'badge-green' : u.status === 'pending' ? 'badge-yellow' : 'badge-red'}">${u.status}</span></td>
    <td class="table-actions">
      <button class="btn btn-ghost btn-sm" onclick="editUser('${u.username}')">แก้ไข</button>
      <button class="btn btn-ghost btn-sm" onclick="resetPassword('${u.username}')">Reset PW</button>
      ${u.username !== 'superadmin' ? `<button class="btn btn-danger btn-sm" onclick="deleteUser('${u.username}')">ลบ</button>` : ''}
    </td></tr>`).join('');
}

async function loadPendingUsers() {
  const r = await callAPI('getPendingUsers');
  if (!r.success) return;
  document.getElementById('pendingBadge').textContent = r.pending.length;
  document.getElementById('pendingTable').innerHTML = r.pending.map(u => `
    <tr><td>${u.username}</td><td>${u.displayName}</td>
    <td class="table-actions">
      <button class="btn btn-success btn-sm" onclick="approveUser('${u.username}',true)">อนุมัติ</button>
      <button class="btn btn-danger btn-sm" onclick="approveUser('${u.username}',false)">ปฏิเสธ</button>
    </td></tr>`).join('') || '<tr><td colspan="3" class="text-center" style="color:var(--text3);padding:30px">ไม่มีผู้ใช้รออนุมัติ</td></tr>';
}

async function approveUser(username, approve) {
  const action = approve ? 'อนุมัติ' : 'ปฏิเสธ';
  if (!confirm(action + ' ผู้ใช้ "' + username + '" ?')) return;
  const r = await callAPI('approveUser', { username, approve });
  if (r.success) { showToast(r.message); loadPendingUsers(); loadUsers(); }
  else showToast(r.error, 'error');
}

function showUserModal(user) {
  document.getElementById('userModalTitle').textContent = user ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้';
  document.getElementById('editUserUsername').value = user ? user.username : '';
  document.getElementById('mUserName').value = user ? user.username : '';
  document.getElementById('mUserName').disabled = !!user;
  document.getElementById('mUserPass').value = '';
  document.getElementById('mUserDisplay').value = user ? user.displayName : '';
  document.getElementById('mUserClass').value = user ? (user.weaponClass || '') : '';
  document.getElementById('mUserRole').value = user ? user.role : 'member';
  document.getElementById('mUserStatus').value = user ? user.status : 'active';
  showModal('userModal');
}

function editUser(username) { const u = allUsersData.find(u => u.username === username); if (u) showUserModal(u); }

async function inlineUpdateRole(username, newRole, selectEl) {
  selectEl.disabled = true;
  selectEl.style.opacity = '0.5';
  const user = { username, role: newRole };
  const r = await callAPI('updateUser', { user });
  selectEl.disabled = false;
  selectEl.style.opacity = '1';
  if (r.success) {
    // Update local data
    const u = allUsersData.find(u => u.username === username);
    if (u) u.role = newRole;
    // Update select color
    selectEl.className = 'inline-role-select ' + (newRole === 'superadmin' ? 'role-superadmin' : newRole === 'admin' ? 'role-admin' : 'role-member');
    showToast('อัพเดท Role "' + username + '" เป็น ' + newRole + ' สำเร็จ (Google Sheet อัพเดทแล้ว)');
  } else {
    // Revert selection
    const u = allUsersData.find(u => u.username === username);
    if (u) selectEl.value = u.role;
    showToast(r.error, 'error');
  }
}

async function saveUser() {
  const existing = document.getElementById('editUserUsername').value;
  const user = { username: document.getElementById('mUserName').value.trim(), displayName: document.getElementById('mUserDisplay').value.trim(), weaponClass: document.getElementById('mUserClass').value, role: document.getElementById('mUserRole').value, status: document.getElementById('mUserStatus').value };
  if (!user.username || !user.displayName) { showToast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
  let r;
  if (existing) {
    r = await callAPI('updateUser', { user });
  } else {
    const pw = document.getElementById('mUserPass').value;
    if (!pw) { showToast('กรุณากรอกรหัสผ่าน', 'error'); return; }
    r = await callAPI('register', { user: { ...user, password: pw } });
    // Then approve immediately
    if (r.success) await callAPI('approveUser', { username: user.username, approve: true });
  }
  if (r.success) { showToast(r.message || 'สำเร็จ'); hideModal('userModal'); loadUsers(); }
  else showToast(r.error, 'error');
}

async function deleteUser(username) {
  if (!confirm('ลบผู้ใช้ "' + username + '" ?')) return;
  const r = await callAPI('deleteUser', { username });
  if (r.success) { showToast(r.message); loadUsers(); }
  else showToast(r.error, 'error');
}

async function resetPassword(username) {
  const pw = prompt('รหัสผ่านใหม่สำหรับ ' + username + ' (เว้นว่าง = 1234):');
  if (pw === null) return;
  const r = await callAPI('resetUserPassword', { username, newPassword: pw || '1234' });
  if (r.success) showToast(r.message);
  else showToast(r.error, 'error');
}

async function loadActivityLogs() {
  const r = await callAPI('getActivityLogs');
  if (!r.success) return;
  document.getElementById('activityLogList').innerHTML = r.logs.map(l => `
    <div class="log-item"><span class="log-time">${fmtDate(l.timestamp)}</span><span class="log-user">${l.user}</span><span class="log-action">${l.action} - ${l.details || ''}</span></div>`).join('') || '<p style="color:var(--text3);font-size:.8rem;padding:12px">ไม่มีข้อมูล</p>';
}

async function loadLoginLogs() {
  const r = await callAPI('getLoginLogs');
  if (!r.success) return;
  document.getElementById('loginLogList').innerHTML = r.logs.map(l => `
    <div class="log-item"><span class="log-time">${fmtDate(l.timestamp)}</span><span class="log-user">${l.username}</span><span class="log-action"><span class="badge ${l.action === 'success' ? 'badge-green' : 'badge-red'}">${l.action}</span></span></div>`).join('') || '<p style="color:var(--text3);font-size:.8rem;padding:12px">ไม่มีข้อมูล</p>';
}

// === FORGOT PASSWORD ===
function showForgotPassword() {
  document.getElementById('forgotUser').value = document.getElementById('loginUser').value || '';
  document.getElementById('forgotReason').value = '';
  showModal('forgotModal');
}

async function submitForgotPassword() {
  const username = document.getElementById('forgotUser').value.trim();
  const reason = document.getElementById('forgotReason').value.trim();
  if (!username) { showToast('กรุณากรอกชื่อผู้ใช้', 'error'); return; }
  const r = await callAPI('requestPasswordReset', { username, reason });
  if (r.success) { showToast(r.message); hideModal('forgotModal'); }
  else showToast(r.error, 'error');
}

// === PASSWORD RESETS (Admin) ===
async function loadPasswordResets() {
  const r = await callAPI('getPasswordResets');
  if (!r.success) return;
  const pending = r.resets.filter(x => x.status === 'pending');
  document.getElementById('resetPwBadge').textContent = pending.length;
  document.getElementById('resetPwTable').innerHTML = r.resets.map(x => {
    const statusBadge = x.status === 'pending' ? 'badge-yellow' : x.status === 'approved' ? 'badge-green' : 'badge-red';
    return `<tr><td>${fmtDate(x.timestamp)}</td><td><strong>${x.username}</strong></td><td>${x.reason || '-'}</td>
    <td><span class="badge ${statusBadge}">${x.status === 'pending' ? 'รอดำเนินการ' : x.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}</span></td>
    <td class="table-actions">${x.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="handlePasswordReset('${x.id}',true)">รีเซ็ต</button><button class="btn btn-danger btn-sm" onclick="handlePasswordReset('${x.id}',false)">ปฏิเสธ</button>` : '-'}</td></tr>`;
  }).join('') || '<tr><td colspan="5" class="text-center" style="color:var(--text3);padding:30px">ไม่มีคำขอ</td></tr>';
}

async function handlePasswordReset(resetId, approve) {
  let newPassword = null;
  if (approve) {
    newPassword = prompt('กรอกรหัสผ่านใหม่ (เว้นว่าง = 1234):') || '1234';
  } else {
    if (!confirm('ปฏิเสธคำขอนี้?')) return;
  }
  const r = await callAPI('handlePasswordReset', { resetId, approve, newPassword });
  if (r.success) { showToast(r.message); loadPasswordResets(); loadNotifications(); }
  else showToast(r.error, 'error');
}

// === NOTIFICATIONS (Admin) ===
async function loadNotifications() {
  const r = await callAPI('getNotifications');
  if (!r.success) return;
  const unread = r.notifications.filter(n => !n.read).length;
  document.getElementById('notifBadge').textContent = unread;
  const typeIcons = { password_reset: '🔑', register: '👤', info: 'ℹ️', warning: '⚠️' };
  const typeColors = { password_reset: 'var(--yellow)', register: 'var(--cyan)', info: 'var(--blue)', warning: 'var(--red)' };
  document.getElementById('notificationList').innerHTML = (unread > 0 ? `<div style="text-align:right;margin-bottom:12px"><button class="btn btn-ghost btn-sm" onclick="markAllNotifRead()">อ่านทั้งหมด</button></div>` : '') +
    r.notifications.map(n => `
    <div class="log-item" style="opacity:${n.read ? '.6' : '1'};${!n.read ? 'border-left:3px solid ' + (typeColors[n.type] || 'var(--cyan)') + ';padding-left:12px' : ''}">
      <span style="font-size:1.1rem;min-width:24px">${typeIcons[n.type] || '📌'}</span>
      <div style="flex:1"><div style="font-weight:700;font-size:.8rem;${!n.read ? 'color:var(--text)' : 'color:var(--text2)'}">${n.title}</div><div style="font-size:.72rem;color:var(--text3);margin-top:2px">${n.message}</div></div>
      <span class="log-time">${fmtDate(n.timestamp)}</span>
      ${!n.read ? `<button class="btn btn-ghost btn-sm" onclick="markNotifRead('${n.id}')" style="padding:4px 8px;font-size:.65rem">อ่าน</button>` : ''}
    </div>`).join('') || '<p style="color:var(--text3);font-size:.8rem;padding:12px">ไม่มีแจ้งเตือน</p>';
}

async function markNotifRead(notifId) {
  await callAPI('markNotificationRead', { notifId });
  loadNotifications();
}

async function markAllNotifRead() {
  await callAPI('markNotificationRead', { notifId: 'all' });
  loadNotifications();
  showToast('อ่านแจ้งเตือนทั้งหมดแล้ว');
}

// === PROFILE ===
let pendingProfileImage = null;

function updateAvatarDisplay() {
  const avatar = document.getElementById('userAvatar');
  if (currentUser.profileImage) {
    avatar.innerHTML = '<img src="' + currentUser.profileImage + '" alt="avatar">';
  } else {
    avatar.textContent = currentUser.displayName.charAt(0).toUpperCase();
  }
}

function showProfileModal() {
  const preview = document.getElementById('profilePreview');
  if (currentUser.profileImage) {
    preview.innerHTML = '<img src="' + currentUser.profileImage + '" alt="preview">';
  } else {
    preview.textContent = currentUser.displayName.charAt(0).toUpperCase();
  }
  pendingProfileImage = null;
  showModal('profileModal');
}

function handleProfileImage(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('กรุณาเลือกไฟล์รูปภาพ', 'error'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const size = 128;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // Crop to square from center
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      pendingProfileImage = canvas.toDataURL('image/jpeg', 0.8);
      // Update preview
      const preview = document.getElementById('profilePreview');
      preview.innerHTML = '<img src="' + pendingProfileImage + '" alt="preview">';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveProfile() {
  if (pendingProfileImage === null) { hideModal('profileModal'); return; }
  const payload = { profileImage: pendingProfileImage };
  const r = await callAPI('updateProfile', payload);
  if (r.success) {
    currentUser.profileImage = pendingProfileImage;
    localStorage.setItem('cpUser', JSON.stringify(currentUser));
    updateAvatarDisplay();
    hideModal('profileModal');
    showToast(r.message);
    pendingProfileImage = null;
  } else {
    showToast(r.error, 'error');
  }
}

// === INIT ===
(function init() {
  // Check saved session
  const saved = localStorage.getItem('cpUser');
  // DEMO_MODE is controlled by the variable at top of script
  document.getElementById('demoToggle').checked = DEMO_MODE;
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      showApp();
    } catch { doLogout(); }
  }
  // Enter key support for login
  document.querySelectorAll('#loginFields input').forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });
  // Enter key support for register
  document.querySelectorAll('#registerFields input').forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
  });
})();
