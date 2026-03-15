// ============================================================
// SWAI Guild - Frontend JavaScript
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
    { id:'t5', tierName:'Diamond', minCP:1001, maxCP:999999, rewardPercent:40, status:'active' }
  ],
  members: [
    { id:'m0', name:'iitoonx', cpValue:260000, tier:'Diamond', rewardPercent:40, status:'active', weaponClass:'Cannon' },
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
    { username:'iitoonx', displayName:'iitoonx', role:'Super Admin', status:'active', profileImage:'', weaponClass:'Cannon' },
    { username:'superadmin', displayName:'Super Admin', role:'Super Admin', status:'active', profileImage:'', weaponClass:'' },
    { username:'darknight', displayName:'DarkKnight', role:'admin', status:'active', profileImage:'', weaponClass:'One-handed Sword' },
    { username:'shadowfox', displayName:'ShadowFox', role:'admin', status:'active', profileImage:'', weaponClass:'Dagger' },
    { username:'icequeen', displayName:'IceQueen', role:'member', status:'active', profileImage:'', weaponClass:'Staff' },
    { username:'firestorm', displayName:'FireStorm', role:'member', status:'active', profileImage:'', weaponClass:'Wand' },
    { username:'thunderbolt', displayName:'ThunderBolt', role:'member', status:'active', profileImage:'', weaponClass:'Spear' },
    { username:'moonwalker', displayName:'MoonWalker', role:'member', status:'active', profileImage:'', weaponClass:'Bow' },
    { username:'starlight', displayName:'StarLight', role:'member', status:'active', profileImage:'', weaponClass:'Orb' },
    { username:'windrunner', displayName:'WindRunner', role:'member', status:'active', profileImage:'', weaponClass:'Twin Sword' },
    { username:'earthshaker', displayName:'EarthShaker', role:'member', status:'active', profileImage:'', weaponClass:'Two-handed Sword' },
    { username:'novablade', displayName:'NovaBlade', role:'member', status:'active', profileImage:'', weaponClass:'Rapier' },
    { username:'newplayer99', displayName:'NewPlayer99', role:'member', status:'pending', profileImage:'', weaponClass:'Rapier' }
  ],
  distributions: [
    { id:'dist1', date:'2026-03-10T14:30:00', totalPrize:50000, distributedBy:'iitoonx', status:'confirmed' },
    { id:'dist2', date:'2026-03-05T10:00:00', totalPrize:30000, distributedBy:'iitoonx', status:'confirmed' },
    { id:'dist3', date:'2026-02-28T16:45:00', totalPrize:100000, distributedBy:'superadmin', status:'confirmed' },
    { id:'dist4', date:'2026-03-13T09:00:00', totalPrize:25000, distributedBy:'iitoonx', status:'draft' }
  ],
  rewardDetails: [
    { distributionId:'dist1', memberId:'m1', memberName:'DarkKnight', cpValue:1520, tier:'Diamond', percentage:200, amount:15841 },
    { distributionId:'dist1', memberId:'m2', memberName:'ShadowFox', cpValue:870, tier:'Platinum', percentage:150, amount:6795 },
    { distributionId:'dist1', memberId:'m3', memberName:'IceQueen', cpValue:750, tier:'Platinum', percentage:150, amount:5856 },
    { distributionId:'dist1', memberId:'m4', memberName:'FireStorm', cpValue:520, tier:'Gold', percentage:100, amount:2708 },
    { distributionId:'dist1', memberId:'m5', memberName:'ThunderBolt', cpValue:480, tier:'Gold', percentage:100, amount:2500 },
    { distributionId:'dist1', memberId:'m6', memberName:'MoonWalker', cpValue:350, tier:'Gold', percentage:100, amount:1823 },
    { distributionId:'dist1', memberId:'m7', memberName:'StarLight', cpValue:250, tier:'Silver', percentage:75, amount:977 },
    { distributionId:'dist1', memberId:'m8', memberName:'WindRunner', cpValue:180, tier:'Silver', percentage:75, amount:703 },
    { distributionId:'dist1', memberId:'m9', memberName:'EarthShaker', cpValue:90, tier:'Bronze', percentage:50, amount:234 },
    { distributionId:'dist1', memberId:'m10', memberName:'NovaBlade', cpValue:45, tier:'Bronze', percentage:50, amount:117 },
    { distributionId:'dist2', memberId:'m1', memberName:'DarkKnight', cpValue:1520, tier:'Diamond', percentage:200, amount:9504 },
    { distributionId:'dist2', memberId:'m2', memberName:'ShadowFox', cpValue:870, tier:'Platinum', percentage:150, amount:4077 },
    { distributionId:'dist2', memberId:'m3', memberName:'IceQueen', cpValue:750, tier:'Platinum', percentage:150, amount:3514 },
    { distributionId:'dist2', memberId:'m4', memberName:'FireStorm', cpValue:520, tier:'Gold', percentage:100, amount:1625 },
    { distributionId:'dist2', memberId:'m5', memberName:'ThunderBolt', cpValue:480, tier:'Gold', percentage:100, amount:1500 },
    { distributionId:'dist2', memberId:'m6', memberName:'MoonWalker', cpValue:350, tier:'Gold', percentage:100, amount:1094 },
    { distributionId:'dist2', memberId:'m7', memberName:'StarLight', cpValue:250, tier:'Silver', percentage:75, amount:586 },
    { distributionId:'dist2', memberId:'m8', memberName:'WindRunner', cpValue:180, tier:'Silver', percentage:75, amount:422 },
    { distributionId:'dist2', memberId:'m9', memberName:'EarthShaker', cpValue:90, tier:'Bronze', percentage:50, amount:141 },
    { distributionId:'dist2', memberId:'m10', memberName:'NovaBlade', cpValue:45, tier:'Bronze', percentage:50, amount:70 }
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
  items: [
    { id:'item1', name:'เสื้อบอส สมรภูมิ', value:40000, createdBy:'iitoonx', createdAt:new Date(Date.now() - 15*60000).toISOString(), status:'active' },
    { id:'item2', name:'ดาบเทพ +15', value:25000, createdBy:'iitoonx', createdAt:'2026-03-12T14:00:00', status:'active' }
  ],
  itemSubmissions: [
    { id:'sub1', itemId:'item1', username:'icequeen', displayName:'IceQueen', image:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23264653' width='200' height='200'/%3E%3Ccircle cx='100' cy='80' r='40' fill='%232a9d8f'/%3E%3Ctext x='100' y='160' text-anchor='middle' fill='%23e9c46a' font-size='14' font-family='sans-serif'%3EIceQueen%3C/text%3E%3Ctext x='100' y='180' text-anchor='middle' fill='%23f4a261' font-size='11' font-family='sans-serif'%3EBoss Armor Drop%3C/text%3E%3C/svg%3E", submittedAt:'2026-03-14T01:30:00', status:'pending', reviewedBy:null },
    { id:'sub2', itemId:'item1', username:'firestorm', displayName:'FireStorm', image:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23e76f51' width='200' height='200'/%3E%3Crect x='40' y='50' width='120' height='80' rx='8' fill='%23f4a261'/%3E%3Ctext x='100' y='100' text-anchor='middle' fill='%23264653' font-size='14' font-weight='bold' font-family='sans-serif'%3EFireStorm%3C/text%3E%3Ctext x='100' y='170' text-anchor='middle' fill='%23fff' font-size='11' font-family='sans-serif'%3EScreenshot 01%3C/text%3E%3C/svg%3E", submittedAt:'2026-03-14T02:15:00', status:'pending', reviewedBy:null },
    { id:'sub3', itemId:'item1', username:'thunderbolt', displayName:'ThunderBolt', image:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23003049' width='200' height='200'/%3E%3Cpolygon points='100,30 130,90 170,90 140,130 155,190 100,155 45,190 60,130 30,90 70,90' fill='%23fcbf49'/%3E%3Ctext x='100' y='195' text-anchor='middle' fill='%23eae2b7' font-size='11' font-family='sans-serif'%3EThunderBolt%3C/text%3E%3C/svg%3E", submittedAt:'2026-03-14T03:00:00', status:'pending', reviewedBy:null },
    { id:'sub4', itemId:'item1', username:'moonwalker', displayName:'MoonWalker', image:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%231d3557' width='200' height='200'/%3E%3Ccircle cx='100' cy='80' r='50' fill='%23457b9d'/%3E%3Ccircle cx='80' cy='65' r='20' fill='%231d3557'/%3E%3Ctext x='100' y='170' text-anchor='middle' fill='%23a8dadc' font-size='13' font-family='sans-serif'%3EMoonWalker%3C/text%3E%3C/svg%3E", submittedAt:'2026-03-14T04:20:00', status:'pending', reviewedBy:null },
    { id:'sub5', itemId:'item1', username:'starlight', displayName:'StarLight', image:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%232b2d42' width='200' height='200'/%3E%3Ccircle cx='60' cy='50' r='5' fill='%23edf2f4'/%3E%3Ccircle cx='150' cy='30' r='3' fill='%23edf2f4'/%3E%3Ccircle cx='100' cy='70' r='4' fill='%23edf2f4'/%3E%3Ccircle cx='40' cy='120' r='3' fill='%23edf2f4'/%3E%3Ccircle cx='160' cy='100' r='5' fill='%23edf2f4'/%3E%3Ccircle cx='100' cy='100' r='30' fill='%238d99ae'/%3E%3Ctext x='100' y='170' text-anchor='middle' fill='%23ef233c' font-size='13' font-family='sans-serif'%3EStarLight%3C/text%3E%3C/svg%3E", submittedAt:'2026-03-14T05:10:00', status:'pending', reviewedBy:null },
    { id:'sub6', itemId:'item1', username:'darknight', displayName:'DarkKnight', image:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23212529' width='200' height='200'/%3E%3Crect x='60' y='40' width='80' height='100' rx='4' fill='%23343a40'/%3E%3Crect x='75' y='55' width='50' height='30' fill='%23495057'/%3E%3Cline x1='100' y1='100' x2='100' y2='130' stroke='%23adb5bd' stroke-width='3'/%3E%3Ctext x='100' y='175' text-anchor='middle' fill='%23f8f9fa' font-size='13' font-family='sans-serif'%3EDarkKnight%3C/text%3E%3C/svg%3E", submittedAt:'2026-03-14T06:00:00', status:'approved', reviewedBy:'iitoonx' },
    { id:'sub7', itemId:'item1', username:'shadowfox', displayName:'ShadowFox', image:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23370617' width='200' height='200'/%3E%3Cellipse cx='100' cy='90' rx='60' ry='45' fill='%236a040f'/%3E%3Cellipse cx='80' cy='80' rx='10' ry='14' fill='%23dc2f02'/%3E%3Cellipse cx='120' cy='80' rx='10' ry='14' fill='%23dc2f02'/%3E%3Ctext x='100' y='175' text-anchor='middle' fill='%23ffba08' font-size='13' font-family='sans-serif'%3EShadowFox%3C/text%3E%3C/svg%3E", submittedAt:'2026-03-14T06:30:00', status:'approved', reviewedBy:'iitoonx' },
    { id:'sub8', itemId:'item1', username:'windrunner', displayName:'WindRunner', image:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23386641' width='200' height='200'/%3E%3Cpath d='M30,120 Q80,40 140,100 Q160,120 180,80' fill='none' stroke='%23a7c957' stroke-width='4'/%3E%3Cpath d='M20,140 Q90,70 150,130 Q170,150 190,100' fill='none' stroke='%236a994e' stroke-width='3'/%3E%3Ctext x='100' y='180' text-anchor='middle' fill='%23f2e8cf' font-size='13' font-family='sans-serif'%3EWindRunner%3C/text%3E%3C/svg%3E", submittedAt:'2026-03-14T07:00:00', status:'pending', reviewedBy:null },
    { id:'sub9', itemId:'item1', username:'earthshaker', displayName:'EarthShaker', image:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23582f0e' width='200' height='200'/%3E%3Crect x='20' y='120' width='160' height='60' fill='%237f4f24'/%3E%3Crect x='50' y='80' width='100' height='40' fill='%239c6644'/%3E%3Crect x='80' y='50' width='40' height='30' fill='%23b08968'/%3E%3Ctext x='100' y='195' text-anchor='middle' fill='%23ede0d4' font-size='12' font-family='sans-serif'%3EEarthShaker%3C/text%3E%3C/svg%3E", submittedAt:'2026-03-14T07:45:00', status:'rejected', reviewedBy:'iitoonx' },
    { id:'sub10', itemId:'item1', username:'novablade', displayName:'NovaBlade', image:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%2310002b' width='200' height='200'/%3E%3Ccircle cx='100' cy='90' r='50' fill='%23240046'/%3E%3Ccircle cx='100' cy='90' r='30' fill='%233c096c'/%3E%3Ccircle cx='100' cy='90' r='12' fill='%23e0aaff'/%3E%3Ctext x='100' y='175' text-anchor='middle' fill='%23c77dff' font-size='13' font-family='sans-serif'%3ENovaBlade%3C/text%3E%3C/svg%3E", submittedAt:'2026-03-14T08:30:00', status:'pending', reviewedBy:null }
  ],
  notifications: [
    { id:'n1', timestamp:'2026-03-13 08:00', type:'password_reset', title:'คำขอรีเซ็ตรหัสผ่าน', message:'moonwalker ส่งคำขอรีเซ็ตรหัสผ่าน - ลืมรหัสผ่าน เปลี่ยนเครื่องใหม่', read:false },
    { id:'n2', timestamp:'2026-03-12 17:30', type:'register', title:'ผู้ใช้ใหม่ลงทะเบียน', message:'newplayer99 (NewPlayer99) ลงทะเบียน CP: 0', read:false },
    { id:'n3', timestamp:'2026-03-11 10:00', type:'info', title:'รีเซ็ตรหัสผ่านสำเร็จ', message:'รีเซ็ตรหัสผ่านให้ starlight แล้ว', read:true },
    { id:'n4', timestamp:'2026-03-10 14:30', type:'info', title:'แจกรางวัลสำเร็จ', message:'ยืนยันการแจกรางวัล 50,000 เพชร ให้ 10 คน', read:true },
    { id:'n5', timestamp:'2026-03-08 09:00', type:'register', title:'ผู้ใช้ใหม่ลงทะเบียน', message:'thunderbolt (ThunderBolt) ลงทะเบียน CP: 480', read:true },
    { id:'n6', timestamp:'2026-03-14 01:00', type:'new_item', title:'รายการใหม่: เสื้อบอส สมรภูมิ', message:'Admin สร้างรายการ "เสื้อบอส สมรภูมิ" มูลค่า 40,000 เพชร กรุณาอัพโหลดรูปยืนยัน', read:false, itemId:'item1' },
    { id:'n7', timestamp:'2026-03-12 14:00', type:'new_item', title:'รายการใหม่: ดาบเทพ +15', message:'Admin สร้างรายการ "ดาบเทพ +15" มูลค่า 25,000 เพชร กรุณาอัพโหลดรูปยืนยัน', read:false, itemId:'item2' }
  ],
  cpUpdateSession: null,
  cpUpdateSessions: [
    { id:'ses1', startDate:'2026-02-15T10:00:00', endDate:'2026-02-16T22:00:00', status:'completed', submissionCount:11, approvedCount:11, rejectedCount:0, confirmedBy:'iitoonx', confirmedAt:'2026-02-17T09:00:00' },
    { id:'ses2', startDate:'2026-02-22T10:00:00', endDate:'2026-02-23T22:00:00', status:'completed', submissionCount:11, approvedCount:11, rejectedCount:0, confirmedBy:'iitoonx', confirmedAt:'2026-02-24T09:00:00' },
    { id:'ses3', startDate:'2026-03-01T10:00:00', endDate:'2026-03-02T22:00:00', status:'completed', submissionCount:11, approvedCount:10, rejectedCount:1, confirmedBy:'iitoonx', confirmedAt:'2026-03-03T09:00:00' },
    { id:'ses4', startDate:'2026-03-08T10:00:00', endDate:'2026-03-09T22:00:00', status:'completed', submissionCount:11, approvedCount:11, rejectedCount:0, confirmedBy:'iitoonx', confirmedAt:'2026-03-10T09:00:00' }
  ],
  cpUpdateSubmissions: [],
  memberCPHistory: [
    // === Session 1 (15 Feb) ===
    { id:'cph101', timestamp:'2026-02-17T09:00:00', memberId:'m0', memberName:'iitoonx', oldCP:245000, newCP:250000, oldTier:'Diamond', newTier:'Diamond', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses1' },
    { id:'cph102', timestamp:'2026-02-17T09:00:00', memberId:'m1', memberName:'DarkKnight', oldCP:1200, newCP:1300, oldTier:'Diamond', newTier:'Diamond', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses1' },
    { id:'cph103', timestamp:'2026-02-17T09:00:00', memberId:'m2', memberName:'ShadowFox', oldCP:580, newCP:650, oldTier:'Gold', newTier:'Gold', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses1' },
    { id:'cph104', timestamp:'2026-02-17T09:00:00', memberId:'m3', memberName:'IceQueen', oldCP:500, newCP:560, oldTier:'Gold', newTier:'Gold', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses1' },
    { id:'cph105', timestamp:'2026-02-17T09:00:00', memberId:'m4', memberName:'FireStorm', oldCP:280, newCP:340, oldTier:'Silver', newTier:'Gold', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses1' },
    { id:'cph106', timestamp:'2026-02-17T09:00:00', memberId:'m5', memberName:'ThunderBolt', oldCP:250, newCP:310, oldTier:'Silver', newTier:'Gold', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses1' },
    { id:'cph107', timestamp:'2026-02-17T09:00:00', memberId:'m6', memberName:'MoonWalker', oldCP:180, newCP:220, oldTier:'Silver', newTier:'Silver', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses1' },
    { id:'cph108', timestamp:'2026-02-17T09:00:00', memberId:'m7', memberName:'StarLight', oldCP:100, newCP:130, oldTier:'Bronze', newTier:'Silver', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses1' },
    { id:'cph109', timestamp:'2026-02-17T09:00:00', memberId:'m8', memberName:'WindRunner', oldCP:60, newCP:90, oldTier:'Bronze', newTier:'Bronze', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses1' },
    { id:'cph110', timestamp:'2026-02-17T09:00:00', memberId:'m9', memberName:'EarthShaker', oldCP:20, newCP:35, oldTier:'Bronze', newTier:'Bronze', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses1' },
    { id:'cph111', timestamp:'2026-02-17T09:00:00', memberId:'m10', memberName:'NovaBlade', oldCP:0, newCP:10, oldTier:'Bronze', newTier:'Bronze', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses1' },
    // === Session 2 (22 Feb) ===
    { id:'cph201', timestamp:'2026-02-24T09:00:00', memberId:'m0', memberName:'iitoonx', oldCP:250000, newCP:253000, oldTier:'Diamond', newTier:'Diamond', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses2' },
    { id:'cph202', timestamp:'2026-02-24T09:00:00', memberId:'m1', memberName:'DarkKnight', oldCP:1300, newCP:1380, oldTier:'Diamond', newTier:'Diamond', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses2' },
    { id:'cph203', timestamp:'2026-02-24T09:00:00', memberId:'m2', memberName:'ShadowFox', oldCP:650, newCP:720, oldTier:'Gold', newTier:'Platinum', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses2' },
    { id:'cph204', timestamp:'2026-02-24T09:00:00', memberId:'m3', memberName:'IceQueen', oldCP:560, newCP:630, oldTier:'Gold', newTier:'Platinum', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses2' },
    { id:'cph205', timestamp:'2026-02-24T09:00:00', memberId:'m4', memberName:'FireStorm', oldCP:340, newCP:400, oldTier:'Gold', newTier:'Gold', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses2' },
    { id:'cph206', timestamp:'2026-02-24T09:00:00', memberId:'m5', memberName:'ThunderBolt', oldCP:310, newCP:370, oldTier:'Gold', newTier:'Gold', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses2' },
    { id:'cph207', timestamp:'2026-02-24T09:00:00', memberId:'m6', memberName:'MoonWalker', oldCP:220, newCP:260, oldTier:'Silver', newTier:'Silver', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses2' },
    { id:'cph208', timestamp:'2026-02-24T09:00:00', memberId:'m7', memberName:'StarLight', oldCP:130, newCP:170, oldTier:'Silver', newTier:'Silver', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses2' },
    { id:'cph209', timestamp:'2026-02-24T09:00:00', memberId:'m8', memberName:'WindRunner', oldCP:90, newCP:120, oldTier:'Bronze', newTier:'Silver', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses2' },
    { id:'cph210', timestamp:'2026-02-24T09:00:00', memberId:'m9', memberName:'EarthShaker', oldCP:35, newCP:50, oldTier:'Bronze', newTier:'Bronze', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses2' },
    { id:'cph211', timestamp:'2026-02-24T09:00:00', memberId:'m10', memberName:'NovaBlade', oldCP:10, newCP:20, oldTier:'Bronze', newTier:'Bronze', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses2' },
    // === Session 3 (1 Mar) ===
    { id:'cph301', timestamp:'2026-03-03T09:00:00', memberId:'m0', memberName:'iitoonx', oldCP:253000, newCP:257000, oldTier:'Diamond', newTier:'Diamond', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses3' },
    { id:'cph302', timestamp:'2026-03-03T09:00:00', memberId:'m1', memberName:'DarkKnight', oldCP:1380, newCP:1450, oldTier:'Diamond', newTier:'Diamond', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses3' },
    { id:'cph303', timestamp:'2026-03-03T09:00:00', memberId:'m2', memberName:'ShadowFox', oldCP:720, newCP:800, oldTier:'Platinum', newTier:'Platinum', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses3' },
    { id:'cph304', timestamp:'2026-03-03T09:00:00', memberId:'m3', memberName:'IceQueen', oldCP:630, newCP:690, oldTier:'Platinum', newTier:'Platinum', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses3' },
    { id:'cph305', timestamp:'2026-03-03T09:00:00', memberId:'m4', memberName:'FireStorm', oldCP:400, newCP:460, oldTier:'Gold', newTier:'Gold', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses3' },
    { id:'cph306', timestamp:'2026-03-03T09:00:00', memberId:'m5', memberName:'ThunderBolt', oldCP:370, newCP:430, oldTier:'Gold', newTier:'Gold', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses3' },
    { id:'cph307', timestamp:'2026-03-03T09:00:00', memberId:'m6', memberName:'MoonWalker', oldCP:260, newCP:310, oldTier:'Silver', newTier:'Gold', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses3' },
    { id:'cph308', timestamp:'2026-03-03T09:00:00', memberId:'m7', memberName:'StarLight', oldCP:170, newCP:210, oldTier:'Silver', newTier:'Silver', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses3' },
    { id:'cph309', timestamp:'2026-03-03T09:00:00', memberId:'m8', memberName:'WindRunner', oldCP:120, newCP:150, oldTier:'Silver', newTier:'Silver', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses3' },
    { id:'cph310', timestamp:'2026-03-03T09:00:00', memberId:'m9', memberName:'EarthShaker', oldCP:50, newCP:70, oldTier:'Bronze', newTier:'Bronze', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses3' },
    { id:'cph311', timestamp:'2026-03-03T09:00:00', memberId:'m10', memberName:'NovaBlade', oldCP:20, newCP:30, oldTier:'Bronze', newTier:'Bronze', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses3' },
    // === Session 4 (8 Mar) ===
    { id:'cph401', timestamp:'2026-03-10T09:00:00', memberId:'m0', memberName:'iitoonx', oldCP:257000, newCP:260000, oldTier:'Diamond', newTier:'Diamond', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses4' },
    { id:'cph402', timestamp:'2026-03-10T09:00:00', memberId:'m1', memberName:'DarkKnight', oldCP:1450, newCP:1520, oldTier:'Diamond', newTier:'Diamond', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses4' },
    { id:'cph403', timestamp:'2026-03-10T09:00:00', memberId:'m2', memberName:'ShadowFox', oldCP:800, newCP:870, oldTier:'Platinum', newTier:'Platinum', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses4' },
    { id:'cph404', timestamp:'2026-03-10T09:00:00', memberId:'m3', memberName:'IceQueen', oldCP:690, newCP:750, oldTier:'Platinum', newTier:'Platinum', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses4' },
    { id:'cph405', timestamp:'2026-03-10T09:00:00', memberId:'m4', memberName:'FireStorm', oldCP:460, newCP:520, oldTier:'Gold', newTier:'Gold', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses4' },
    { id:'cph406', timestamp:'2026-03-10T09:00:00', memberId:'m5', memberName:'ThunderBolt', oldCP:430, newCP:480, oldTier:'Gold', newTier:'Gold', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses4' },
    { id:'cph407', timestamp:'2026-03-10T09:00:00', memberId:'m6', memberName:'MoonWalker', oldCP:310, newCP:350, oldTier:'Gold', newTier:'Gold', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses4' },
    { id:'cph408', timestamp:'2026-03-10T09:00:00', memberId:'m7', memberName:'StarLight', oldCP:210, newCP:250, oldTier:'Silver', newTier:'Silver', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses4' },
    { id:'cph409', timestamp:'2026-03-10T09:00:00', memberId:'m8', memberName:'WindRunner', oldCP:150, newCP:180, oldTier:'Silver', newTier:'Silver', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses4' },
    { id:'cph410', timestamp:'2026-03-10T09:00:00', memberId:'m9', memberName:'EarthShaker', oldCP:70, newCP:90, oldTier:'Bronze', newTier:'Bronze', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses4' },
    { id:'cph411', timestamp:'2026-03-10T09:00:00', memberId:'m10', memberName:'NovaBlade', oldCP:30, newCP:45, oldTier:'Bronze', newTier:'Bronze', source:'cpUpdate', changedBy:'iitoonx', sessionId:'ses4' }
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
    case 'forceChangePassword': { const u = DEMO.users.find(u => u.username === data.username); if (u) { u.password = data.newPassword; u.forceChangePassword = false; } return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' }; }
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
    case 'getNotifications': {
      let notifs = DEMO.notifications;
      if (currentUser.role === 'member') {
        notifs = notifs.filter(n => !n.targetUser || n.targetUser === currentUser.username);
      }
      return { success: true, notifications: notifs };
    }
    case 'markNotificationRead': return demoMarkNotifRead(data);
    case 'createAnnouncement': return demoCreateAnnouncement(data);
    case 'createItem': return demoCreateItem(data);
    case 'getItems': return demoGetItems();
    case 'getItemSubmissions': return demoGetItemSubmissions(data);
    case 'submitItemImage': return demoSubmitItemImage(data);
    case 'reviewItemSubmission': return demoReviewItemSubmission(data);
    case 'deleteItem': return demoDeleteItem(data);
    case 'distributeItemRewards': return demoDistributeItemRewards(data);
    case 'startCPUpdate': return demoStartCPUpdate(data);
    case 'getCPUpdateSession': return demoGetCPUpdateSession();
    case 'submitCPUpdate': return demoSubmitCPUpdate(data);
    case 'reviewCPUpdate': return demoReviewCPUpdate(data);
    case 'confirmCPUpdate': return demoConfirmCPUpdate();
    case 'getGrowthData': return demoGetGrowthData();
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
      return { success: true, forceChangePassword: !!u.forceChangePassword, user: { username: u.username, displayName: u.displayName, role: u.role, profileImage: u.profileImage || '' } };
    }
    // Auto-create superadmin for demo
    if (d.username === 'demo' || d.username === 'admin') {
      return { success: true, user: { username: 'superadmin', displayName: 'Super Admin', role: 'Super Admin', profileImage: '' } };
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
  if (d.username === 'superadmin') return { success: false, error: 'ไม่สามารถลบ Super Admin' };
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
  // Lookup profileImage from users
  members = members.map(m => {
    const u = DEMO.users.find(u => u.displayName === m.name);
    return { ...m, profileImage: u ? u.profileImage || '' : '', weaponClass: m.weaponClass || (u ? u.weaponClass || '' : '') };
  });
  members.sort((a, b) => (parseFloat(b.cpValue) || 0) - (parseFloat(a.cpValue) || 0));
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
    const oldCP = parseFloat(m.cpValue) || 0;
    const oldTier = m.tier || '-';
    m.cpValue = parseFloat(d.member.cpValue) || 0;
    const tier = demoFindTier(m.cpValue);
    m.tier = tier.tierName; m.rewardPercent = tier.rewardPercent;
    // Log CP history if changed
    if (m.cpValue !== oldCP) {
      DEMO.memberCPHistory.push({
        id: 'cph' + Date.now(), timestamp: new Date().toISOString(),
        memberId: m.id, memberName: m.name,
        oldCP: oldCP, newCP: m.cpValue, oldTier: oldTier, newTier: tier.tierName,
        source: 'manualEdit', changedBy: currentUser.username, sessionId: ''
      });
      DEMO.activityLogs.unshift({ timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16), user: currentUser.username, action: 'updateMember', details: 'Updated: ' + m.name, oldValue: 'CP:' + oldCP, newValue: 'CP:' + m.cpValue });
    }
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
  var changedCount = 0;
  d.updates.forEach(u => {
    const m = DEMO.members.find(m => m.id === u.id);
    if (m) {
      const oldCP = parseFloat(m.cpValue) || 0;
      const oldTier = m.tier || '-';
      m.cpValue = parseFloat(u.cpValue) || 0;
      const tier = demoFindTier(m.cpValue);
      m.tier = tier.tierName; m.rewardPercent = tier.rewardPercent;
      if (m.cpValue !== oldCP) {
        DEMO.memberCPHistory.push({
          id: 'cph' + Date.now() + changedCount, timestamp: new Date().toISOString(),
          memberId: m.id, memberName: m.name,
          oldCP: oldCP, newCP: m.cpValue, oldTier: oldTier, newTier: tier.tierName,
          source: 'batchUpdate', changedBy: currentUser.username, sessionId: ''
        });
        changedCount++;
      }
    }
  });
  DEMO.activityLogs.unshift({ timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16), user: currentUser.username, action: 'batchUpdateCP', details: 'Updated ' + d.updates.length + ' members' });
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
  if (!totalPrize || totalPrize <= 0) return { success: false, error: 'กรุณากรอกจำนวนเพชร' };
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
    b.amount = Math.floor((b.effectiveWeight / totalWeight) * totalPrize);
    distributed += b.amount;
  });
  const diff = totalPrize - distributed;
  if (diff !== 0) {
    const mi = breakdown.reduce((mi, b, i, a) => b.effectiveWeight > a[mi].effectiveWeight ? i : mi, 0);
    breakdown[mi].amount += diff;
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

function generateTempPassword(username) {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return username.toLowerCase() + rand;
}

function demoHandlePasswordReset(d) {
  const r = DEMO.passwordResets.find(r => r.id === d.resetId);
  if (!r) return { success: false, error: 'ไม่พบคำขอ' };
  if (d.approve) {
    const tempPw = generateTempPassword(r.username);
    r.status = 'approved';
    // Set forceChangePassword flag on user
    const user = DEMO.users.find(u => u.username === r.username);
    if (user) { user.password = tempPw; user.forceChangePassword = true; }
    DEMO.notifications.unshift({ id: 'n' + Date.now(), timestamp: new Date().toISOString(), type: 'info', title: 'รีเซ็ตรหัสผ่านสำเร็จ', message: 'รีเซ็ตรหัสผ่านให้ ' + r.username + ' แล้ว', read: false });
    return { success: true, tempPassword: tempPw, username: r.username, message: 'รีเซ็ตรหัสผ่าน ' + r.username + ' สำเร็จ' };
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

function demoCreateAnnouncement(d) {
  const title = (d.title || '').trim();
  const content = (d.content || '').trim();
  if (!title || !content) return { success: false, error: 'กรุณากรอกข้อมูลให้ครบ' };
  // สร้าง notification ให้ทุกคน (ไม่มี targetUser = broadcast)
  DEMO.notifications.unshift({
    id: 'n' + Date.now(),
    timestamp: new Date().toISOString(),
    type: 'announcement',
    title: '📢 ' + title,
    message: content,
    read: false
  });
  return { success: true, message: 'ส่งประกาศสำเร็จ' };
}

// === DEMO ITEM HANDLERS ===
function demoCreateItem(d) {
  const name = (d.name || '').trim();
  const value = parseFloat(d.value) || 0;
  if (!name) return { success: false, error: 'กรุณากรอกชื่อรายการ' };
  if (value <= 0) return { success: false, error: 'กรุณากรอกมูลค่า' };
  const item = { id: 'item' + Date.now(), name, value, createdBy: currentUser.username, createdAt: new Date().toISOString(), status: 'active' };
  DEMO.items.push(item);
  // Notify all members
  const members = DEMO.users.filter(u => u.role === 'member' && u.status === 'active');
  members.forEach(m => {
    DEMO.notifications.unshift({ id: 'n' + Date.now() + m.username, timestamp: new Date().toISOString(), type: 'new_item', title: 'รายการใหม่: ' + name, message: 'มูลค่า ' + fmt(value) + ' เพชร - กดอัพโหลดรูปเพื่อรับรางวัล', read: false, targetUser: m.username, itemId: item.id });
  });
  return { success: true, message: 'สร้างรายการสำเร็จ', item };
}

function itemTimeRemaining(item) {
  const elapsed = Date.now() - new Date(item.createdAt).getTime();
  const remaining = 3600000 - elapsed;
  return remaining > 0 ? remaining : 0;
}

function demoGetItems() {
  const items = DEMO.items.filter(i => i.status !== 'deleted').map(i => {
    const subs = DEMO.itemSubmissions.filter(s => s.itemId === i.id);
    const remaining = itemTimeRemaining(i);
    return { ...i, submissionCount: subs.length, approvedCount: subs.filter(s => s.status === 'approved').length, rejectedCount: subs.filter(s => s.status === 'rejected').length, pendingCount: subs.filter(s => s.status === 'pending').length, timeRemaining: remaining, expired: remaining <= 0 };
  });
  return { success: true, items: items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) };
}

function demoGetItemSubmissions(d) {
  const subs = DEMO.itemSubmissions.filter(s => s.itemId === d.itemId);
  return { success: true, submissions: subs.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)) };
}

function demoSubmitItemImage(d) {
  if (!d.itemId || !d.image) return { success: false, error: 'ข้อมูลไม่ครบ' };
  const item = DEMO.items.find(i => i.id === d.itemId);
  if (!item) return { success: false, error: 'ไม่พบรายการ' };
  // Check time limit (1 hour) — ยกเว้น rejected ส่งใหม่ได้
  const elapsed = Date.now() - new Date(item.createdAt).getTime();
  const existing = DEMO.itemSubmissions.find(s => s.itemId === d.itemId && s.username === currentUser.username);
  if (elapsed > 3600000 && (!existing || existing.status !== 'rejected')) return { success: false, error: 'หมดเวลาอัพโหลดแล้ว (เกิน 1 ชั่วโมง)' };
  // ถ้ามี submission เดิม
  if (existing) {
    if (existing.status === 'approved') return { success: false, error: 'รายการนี้อนุมัติแล้ว ไม่สามารถแก้ไขได้' };
    // pending หรือ rejected → อัพเดทรูปใหม่
    existing.image = d.image;
    existing.submittedAt = new Date().toISOString();
    existing.status = 'pending';
    existing.reviewedBy = null;
    DEMO.notifications.unshift({ id: 'n' + Date.now(), timestamp: new Date().toISOString(), type: 'item_submission', title: 'แก้ไขรูปรายการ: ' + item.name, message: currentUser.displayName + ' ส่งรูปใหม่สำหรับรายการ "' + item.name + '"', read: false });
    return { success: true, message: 'แก้ไขรูปสำเร็จ รอการตรวจสอบ' };
  }
  const sub = { id: 'sub' + Date.now(), itemId: d.itemId, username: currentUser.username, displayName: currentUser.displayName, image: d.image, submittedAt: new Date().toISOString(), status: 'pending', reviewedBy: null };
  DEMO.itemSubmissions.push(sub);
  // Notify admins
  DEMO.notifications.unshift({ id: 'n' + Date.now(), timestamp: new Date().toISOString(), type: 'item_submission', title: 'ส่งรูปรายการ: ' + item.name, message: currentUser.displayName + ' ส่งรูปสำหรับรายการ "' + item.name + '"', read: false });
  return { success: true, message: 'ส่งรูปสำเร็จ รอการตรวจสอบ' };
}

function demoReviewItemSubmission(d) {
  const sub = DEMO.itemSubmissions.find(s => s.id === d.submissionId);
  if (!sub) return { success: false, error: 'ไม่พบ submission' };
  sub.status = d.approve ? 'approved' : 'rejected';
  sub.reviewedBy = currentUser.username;
  return { success: true, message: d.approve ? 'อนุมัติสำเร็จ' : 'ปฏิเสธสำเร็จ' };
}

function demoDeleteItem(d) {
  const item = DEMO.items.find(i => i.id === d.itemId);
  if (!item) return { success: false, error: 'ไม่พบรายการ' };
  if (item.status === 'distributed') return { success: false, error: 'ไม่สามารถลบรายการที่แจกรางวัลแล้ว' };
  item.status = 'deleted';
  // Remove related submissions
  DEMO.itemSubmissions = DEMO.itemSubmissions.filter(s => s.itemId !== d.itemId);
  return { success: true, message: 'ลบรายการสำเร็จ' };
}

function demoDistributeItemRewards(d) {
  const item = DEMO.items.find(i => i.id === d.itemId);
  if (!item) return { success: false, error: 'ไม่พบรายการ' };
  const approvedSubs = DEMO.itemSubmissions.filter(s => s.itemId === d.itemId && s.status === 'approved');
  if (approvedSubs.length === 0) return { success: false, error: 'ไม่มีคนที่ได้รับอนุมัติ' };
  // Calculate rewards using effectiveWeight = CP * tier%
  const breakdown = approvedSubs.map(s => {
    const member = DEMO.members.find(m => m.name === s.displayName);
    const cp = member ? parseFloat(member.cpValue) || 0 : 0;
    const tier = demoFindTier(cp);
    return { username: s.username, displayName: s.displayName, cpValue: cp, tier: tier.tierName, percentage: tier.rewardPercent, effectiveWeight: cp * (tier.rewardPercent / 100), amount: 0 };
  });
  const totalWeight = breakdown.reduce((s, b) => s + b.effectiveWeight, 0);
  if (totalWeight === 0) return { success: false, error: 'น้ำหนักรวมเป็น 0 (คนที่อนุมัติอาจอยู่ tier 0%)' };
  let distributed = 0;
  breakdown.forEach(b => {
    b.amount = Math.floor((b.effectiveWeight / totalWeight) * item.value * 100) / 100;
    distributed += b.amount;
  });
  const diff = Math.round((item.value - distributed) * 100) / 100;
  if (diff !== 0 && breakdown.length > 0) {
    const mi = breakdown.reduce((mi, b, i, a) => b.effectiveWeight > a[mi].effectiveWeight ? i : mi, 0);
    breakdown[mi].amount = Math.round((breakdown[mi].amount + diff) * 100) / 100;
  }
  // Record as distribution
  const distId = 'dd' + Date.now();
  DEMO.distributions.push({ id: distId, date: new Date().toISOString(), totalPrize: item.value, distributedBy: currentUser.username, status: 'confirmed', itemId: item.id, itemName: item.name });
  breakdown.forEach(b => DEMO.rewardDetails.push({ distributionId: distId, memberId: '', memberName: b.displayName, cpValue: b.cpValue, tier: b.tier, percentage: b.percentage, amount: b.amount }));
  item.status = 'distributed';
  return { success: true, message: 'แจกรางวัลสำเร็จ ' + fmt(item.value) + ' เพชร ให้ ' + breakdown.length + ' คน', breakdown: breakdown.sort((a, b) => b.amount - a.amount) };
}

// === DEMO CP UPDATE SESSION ===
function demoStartCPUpdate(d) {
  const sessionId = 'cpSession' + Date.now();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  DEMO.cpUpdateSession = { id: sessionId, createdBy: currentUser.username, createdAt: createdAt, status: 'active', submissions: [] };
  // Store in cpUpdateSessions array
  DEMO.cpUpdateSessions.push({
    id: sessionId, createdAt: createdAt, createdBy: currentUser.username,
    expiresAt: expiresAt, status: 'active', totalSubmissions: 0,
    approvedCount: 0, rejectedCount: 0, confirmedBy: '', confirmedAt: ''
  });
  const members = DEMO.users.filter(u => u.role === 'member' && u.status === 'active');
  members.forEach(m => {
    DEMO.notifications.unshift({ id: 'n' + Date.now() + m.username, timestamp: new Date().toISOString(), type: 'cp_update', title: 'Update CP', message: 'แอดมินเปิดให้อัพเดท CP - กรุณาอัพเดทภายใน 24 ชั่วโมง', read: false, targetUser: m.username });
  });
  DEMO.activityLogs.unshift({ timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16), user: currentUser.username, action: 'startCPUpdate', details: 'Session: ' + sessionId });
  return { success: true, message: 'เริ่ม CP Update Session สำเร็จ สมาชิกมีเวลา 24 ชั่วโมงในการอัพเดท CP', sessionId: sessionId };
}

function cpSessionTimeRemaining() {
  if (!DEMO.cpUpdateSession || DEMO.cpUpdateSession.status !== 'active') return 0;
  const elapsed = Date.now() - new Date(DEMO.cpUpdateSession.createdAt).getTime();
  const remaining = 86400000 - elapsed; // 24 hours
  return remaining > 0 ? remaining : 0;
}

function updateCPSessionUI() {
  var box = document.getElementById('cpSessionBox');
  if (!box) return;
  if (DEMO.cpUpdateSession && DEMO.cpUpdateSession.status === 'active') {
    var remaining = cpSessionTimeRemaining();
    if (remaining > 0) {
      var alreadySubmitted = DEMO.cpUpdateSession.submissions.some(function(s) { return s.username === currentUser.username; });
      if (!alreadySubmitted) {
        box.className = '';
        box.style.textAlign = 'right';
        var hrs = Math.floor(remaining / 3600000);
        var mins = Math.floor((remaining % 3600000) / 60000);
        document.getElementById('cpSessionTimer').textContent = 'เหลือเวลา ' + hrs + ' ชม. ' + mins + ' นาที';
        return;
      }
    }
  }
  box.className = 'hidden';
}

function demoGetCPUpdateSession() {
  if (!DEMO.cpUpdateSession || DEMO.cpUpdateSession.status !== 'active') return { success: true, session: null };
  if (cpSessionTimeRemaining() <= 0) {
    DEMO.cpUpdateSession.status = 'expired';
    // Update in sessions array too
    const sess = DEMO.cpUpdateSessions.find(s => s.id === DEMO.cpUpdateSession.id);
    if (sess) sess.status = 'expired';
    return { success: true, session: null };
  }
  return { success: true, session: DEMO.cpUpdateSession };
}

function demoSubmitCPUpdate(d) {
  if (!DEMO.cpUpdateSession || DEMO.cpUpdateSession.status !== 'active') return { success: false, error: 'ไม่มี CP Update Session ที่เปิดอยู่' };
  if (cpSessionTimeRemaining() <= 0) return { success: false, error: 'หมดเวลา CP Update Session แล้ว' };
  const cpVal = parseFloat(String(d.cpValue || '').replace(/,/g, '')) || 0;
  if (cpVal <= 0) return { success: false, error: 'กรุณากรอกค่า CP' };
  if (!d.image) return { success: false, error: 'กรุณาอัพโหลดรูปภาพ' };
  // Check duplicate
  const existing = DEMO.cpUpdateSession.submissions.find(s => s.username === currentUser.username);
  if (existing) return { success: false, error: 'คุณส่ง CP อัพเดทแล้ว' };
  // Get old CP from members
  const member = DEMO.members.find(m => m.name === currentUser.displayName && m.status !== 'deleted');
  const oldCP = member ? parseFloat(member.cpValue) || 0 : 0;
  const subId = 'cpsub' + Date.now();
  // Store as pending — Admin must approve before CP is updated
  DEMO.cpUpdateSession.submissions.push({ id: subId, username: currentUser.username, displayName: currentUser.displayName, oldCP: oldCP, cpValue: cpVal, image: d.image, submittedAt: new Date().toISOString(), status: 'pending', reviewedBy: null });
  // Also store in cpUpdateSubmissions array
  DEMO.cpUpdateSubmissions.push({
    id: subId, sessionId: DEMO.cpUpdateSession.id, username: currentUser.username,
    displayName: currentUser.displayName, oldCP: oldCP, newCP: cpVal,
    imageData: d.image, submittedAt: new Date().toISOString(),
    status: 'pending', reviewedBy: '', reviewedAt: ''
  });
  // Update session totalSubmissions
  const sess = DEMO.cpUpdateSessions.find(s => s.id === DEMO.cpUpdateSession.id);
  if (sess) sess.totalSubmissions = (sess.totalSubmissions || 0) + 1;
  DEMO.notifications.unshift({ id: 'n' + Date.now(), timestamp: new Date().toISOString(), type: 'cp_update_submit', title: 'CP Update: ' + currentUser.displayName, message: currentUser.displayName + ' ส่ง CP ' + fmt(cpVal) + ' (เดิม: ' + fmt(oldCP) + ') รอการอนุมัติ', read: false });
  DEMO.activityLogs.unshift({ timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16), user: currentUser.username, action: 'submitCPUpdate', details: 'Session: ' + DEMO.cpUpdateSession.id + ', CP: ' + fmt(cpVal), oldValue: 'CP:' + oldCP, newValue: 'CP:' + cpVal });
  return { success: true, message: 'ส่ง CP สำเร็จ! รอ Admin อนุมัติ' };
}

function demoReviewCPUpdate(d) {
  if (!DEMO.cpUpdateSession) return { success: false, error: 'ไม่มี session' };
  const sub = DEMO.cpUpdateSession.submissions.find(s => s.id === d.submissionId);
  if (!sub) return { success: false, error: 'ไม่พบ submission' };
  const reviewedAt = new Date().toISOString();
  if (d.action === 'pending') {
    sub.status = 'pending';
    sub.reviewedBy = null;
    // Update in cpUpdateSubmissions
    const subRecord = DEMO.cpUpdateSubmissions.find(s => s.id === d.submissionId);
    if (subRecord) { subRecord.status = 'pending'; subRecord.reviewedBy = ''; subRecord.reviewedAt = ''; }
    DEMO.activityLogs.unshift({ timestamp: reviewedAt.replace('T', ' ').slice(0, 16), user: currentUser.username, action: 'reviewCPUpdate', details: 'Submission: ' + d.submissionId + ' → pending (' + sub.displayName + ')' });
    return { success: true, message: 'ย้อนกลับเป็นรอตรวจ' };
  }
  const approve = d.action === 'approve';
  sub.status = approve ? 'approved' : 'rejected';
  sub.reviewedBy = currentUser.username;
  // Update in cpUpdateSubmissions
  const subRecord = DEMO.cpUpdateSubmissions.find(s => s.id === d.submissionId);
  if (subRecord) { subRecord.status = sub.status; subRecord.reviewedBy = currentUser.username; subRecord.reviewedAt = reviewedAt; }
  DEMO.activityLogs.unshift({ timestamp: reviewedAt.replace('T', ' ').slice(0, 16), user: currentUser.username, action: 'reviewCPUpdate', details: 'Submission: ' + d.submissionId + ' → ' + sub.status + ' (' + sub.displayName + ')' });
  return { success: true, message: approve ? 'อนุมัติ ' + sub.displayName + ' สำเร็จ' : 'ปฏิเสธสำเร็จ' };
}

function demoConfirmCPUpdate() {
  if (!DEMO.cpUpdateSession) return { success: false, error: 'ไม่มี session' };
  const approved = DEMO.cpUpdateSession.submissions.filter(s => s.status === 'approved');
  const rejected = DEMO.cpUpdateSession.submissions.filter(s => s.status === 'rejected');
  if (approved.length === 0) return { success: false, error: 'ไม่มีรายการที่อนุมัติ' };
  var updated = 0;
  var sessionId = DEMO.cpUpdateSession.id;
  var confirmedAt = new Date().toISOString();
  approved.forEach(function(sub) {
    var member = DEMO.members.find(function(m) { return m.name === sub.displayName; });
    if (member) {
      var oldCP = parseFloat(member.cpValue) || 0;
      var oldTier = member.tier || '-';
      member.cpValue = sub.cpValue;
      var tierInfo = demoFindTier(sub.cpValue);
      member.tier = tierInfo.tierName;
      member.rewardPercent = tierInfo.rewardPercent;
      // Log to memberCPHistory
      DEMO.memberCPHistory.push({
        id: 'cph' + Date.now() + updated, timestamp: confirmedAt,
        memberId: member.id, memberName: member.name,
        oldCP: oldCP, newCP: sub.cpValue, oldTier: oldTier, newTier: tierInfo.tierName,
        source: 'cpUpdate', changedBy: currentUser.username, sessionId: sessionId
      });
      updated++;
    } else {
      var user = DEMO.users.find(function(u) { return u.username === sub.username; });
      var newId = 'm' + Date.now() + updated;
      var tierInfo = demoFindTier(sub.cpValue);
      var newMember = { id: newId, name: sub.displayName, cpValue: sub.cpValue, tier: tierInfo.tierName, rewardPercent: tierInfo.rewardPercent, status: 'active', weaponClass: user ? user.weaponClass || '' : '' };
      DEMO.members.push(newMember);
      // Log to memberCPHistory
      DEMO.memberCPHistory.push({
        id: 'cph' + Date.now() + updated, timestamp: confirmedAt,
        memberId: newId, memberName: sub.displayName,
        oldCP: 0, newCP: sub.cpValue, oldTier: '-', newTier: tierInfo.tierName,
        source: 'cpUpdate', changedBy: currentUser.username, sessionId: sessionId
      });
      updated++;
    }
  });
  DEMO.cpUpdateSession.status = 'confirmed';
  // Update cpUpdateSessions array
  var sess = DEMO.cpUpdateSessions.find(function(s) { return s.id === sessionId; });
  if (sess) {
    sess.status = 'completed';
    sess.approvedCount = approved.length;
    sess.rejectedCount = rejected.length;
    sess.confirmedBy = currentUser.username;
    sess.confirmedAt = confirmedAt;
  }
  DEMO.activityLogs.unshift({ timestamp: confirmedAt.replace('T', ' ').slice(0, 16), user: currentUser.username, action: 'confirmCPUpdate', details: 'Session: ' + sessionId + ', Approved: ' + approved.length + ', Rejected: ' + rejected.length });
  return { success: true, message: 'อัพเดท CP สำเร็จ ' + updated + ' คน', updatedCount: updated };
}

function demoGetGrowthData() {
  const sessions = DEMO.cpUpdateSessions.map(s => ({
    id: s.id, startDate: s.startDate, endDate: s.endDate,
    status: s.status, submissionCount: s.submissionCount || 0
  }));
  const history = DEMO.memberCPHistory.map(h => ({
    id: h.id, memberId: h.memberId, memberName: h.memberName,
    oldCP: h.oldCP, newCP: h.newCP, oldTier: h.oldTier || '-', newTier: h.newTier || '-',
    sessionId: h.sessionId || '', timestamp: h.timestamp, source: h.source || ''
  }));
  return { success: true, sessions, history };
}

function demoGetDashboard() {
  const members = DEMO.members.filter(m => m.status === 'active');
  const filtered = currentUser.role === 'member' ? members.filter(m => m.name === currentUser.displayName) : members;
  const totalCP = filtered.reduce((s, m) => s + (parseFloat(m.cpValue) || 0), 0);
  const tierDist = {};
  filtered.forEach(m => { const t = m.tier || '-'; tierDist[t] = (tierDist[t] || 0) + 1; });
  const topPerformers = [...filtered].sort((a, b) => (parseFloat(b.cpValue) || 0) - (parseFloat(a.cpValue) || 0)).slice(0, 10).map(m => {
    const u = DEMO.users.find(u => u.displayName === m.name);
    return { name: m.name, cpValue: parseFloat(m.cpValue) || 0, tier: m.tier, weaponClass: m.weaponClass || '', profileImage: u ? u.profileImage || '' : '' };
  });
  const confirmed = DEMO.distributions.filter(d => d.status === 'confirmed');
  return {
    success: true, totalMembers: filtered.length, totalCP, avgCP: filtered.length > 0 ? Math.round(totalCP / filtered.length * 100) / 100 : 0,
    totalDistributed: confirmed.reduce((s, d) => s + (parseFloat(d.totalPrize) || 0), 0),
    distributionCount: confirmed.length, tierDistribution: tierDist, topPerformers,
    recentDistributions: DEMO.distributions.filter(d => d.status !== 'deleted').sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5), pendingDistributions: DEMO.distributions.filter(d => d.status === 'draft').length
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
function hideAllModals() { document.querySelectorAll('.modal-overlay.show').forEach(m => { if (m.id !== 'forceChangePasswordModal') m.classList.remove('show'); }); }

// Add close button to all modals (except forceChangePasswordModal — mandatory)
document.querySelectorAll('.modal-overlay .modal').forEach(modal => {
  if (modal.parentElement.id === 'forceChangePasswordModal') return;
  const btn = document.createElement('button');
  btn.className = 'modal-close';
  btn.innerHTML = '&times;';
  btn.onclick = function() { modal.parentElement.classList.remove('show'); };
  modal.insertBefore(btn, modal.firstChild);
});
// Close modal on clicking outside (overlay area) — except forceChangePasswordModal
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('show') && e.target.id !== 'forceChangePasswordModal') {
    e.target.classList.remove('show');
  }
});
// Close modal on Escape key — except forceChangePasswordModal
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') hideAllModals();
});

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
  const remember = document.getElementById('rememberMe').checked;
  if (!username) { showToast('กรุณากรอกชื่อผู้ใช้', 'error'); return; }
  const r = await callAPI('login', { username, password });
  if (r.success) {
    currentUser = r.user;
    localStorage.setItem('cpUser', JSON.stringify(currentUser));
    localStorage.setItem('cpDemoMode', DEMO_MODE);
    // Remember me
    if (remember) {
      localStorage.setItem('cpRemember', JSON.stringify({ username, password }));
    } else {
      localStorage.removeItem('cpRemember');
    }
    // Check if must change password
    if (r.forceChangePassword) {
      showModal('forceChangePasswordModal');
      showToast('กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน', 'info');
      return;
    }
    showApp();
    showToast('ยินดีต้อนรับ ' + currentUser.displayName);
    if (currentUser.role === 'member') {
      checkPendingItemsOnLogin();
    }
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
  // Restore remembered credentials on logout
  loadRememberedCredentials();
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

async function doForceChangePassword() {
  const n = document.getElementById('forceNewPass').value;
  const c = document.getElementById('forceConfirmPass').value;
  if (!n) { showToast('กรุณากรอกรหัสผ่านใหม่', 'error'); return; }
  if (n.length < 4) { showToast('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร', 'error'); return; }
  if (n !== c) { showToast('รหัสผ่านใหม่ไม่ตรงกัน', 'error'); return; }
  const r = await callAPI('forceChangePassword', { username: currentUser.username, newPassword: n });
  if (r.success) {
    hideModal('forceChangePasswordModal');
    showApp();
    showToast('เปลี่ยนรหัสผ่านสำเร็จ ยินดีต้อนรับ ' + currentUser.displayName);
  } else {
    showToast(r.error, 'error');
  }
}

// === NAVIGATION ===
const NAV_ITEMS = [
  { id: 'Dashboard', label: 'Dashboard', icon: '📊', roles: ['Super Admin', 'admin', 'member'] },
  { id: 'Notifications', label: 'แจ้งเตือน', icon: '🔔', roles: ['Super Admin', 'admin', 'member'] },
  { id: 'Members', label: 'สมาชิก', icon: '👥', roles: ['Super Admin', 'admin'] },
  { id: 'Rewards', label: 'แจกรางวัล', icon: '🎁', roles: ['Super Admin', 'admin'] },
  { id: 'Growth', label: 'Growth', icon: '📈', roles: ['Super Admin', 'admin', 'member'] },
  { id: 'Settings', label: 'CP Tiers', icon: '⚙️', roles: ['Super Admin', 'admin'] },
  { id: 'Admin', label: 'จัดการระบบ', icon: '🔧', roles: ['Super Admin', 'admin'] }
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
    if (item.id === 'Notifications') {
      el.innerHTML += '<span id="navNotifBadge" class="badge badge-red" style="margin-left:auto;display:none">0</span>';
    }
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
  // Show/hide CP session UI
  try { updateCPSessionUI(); } catch(e) {}
  // Load page data
  switch (pageId) {
    case 'Dashboard': loadDashboard(); break;
    case 'Members': loadMembers(); break;
    case 'Rewards': loadRewards(); break;
    case 'Settings': loadSettings(); break;
    case 'Notifications': loadNotificationPage(); break;
    case 'Growth': loadGrowth(); break;
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
    document.getElementById('btnCreateItem').classList.add('hidden');
    document.getElementById('btnStartCPUpdate').classList.add('hidden');
    document.getElementById('btnReviewCP').classList.add('hidden');
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
  refreshNotifBadge();
  showPage('Dashboard');
}

// === DASHBOARD ===
async function loadDashboard() {
  try { updateCPSessionUI(); } catch(e) { console.error('CP UI error:', e); }

  const r = await callAPI('getDashboardData');
  if (!r.success) return;
  // KPI
  document.getElementById('dashKPI').innerHTML = `
    <div class="kpi"><div class="kpi-header"><span class="kpi-icon">👥</span><span class="kpi-label">สมาชิกทั้งหมด</span></div><div class="kpi-value">${fmt(r.totalMembers)}</div><div class="kpi-sub">Active members</div></div>
    <div class="kpi"><div class="kpi-header"><span class="kpi-icon">⚡</span><span class="kpi-label">CP รวม</span></div><div class="kpi-value">${fmt(r.totalCP)}</div><div class="kpi-sub">Total CP</div></div>
    <div class="kpi"><div class="kpi-header"><span class="kpi-icon">📈</span><span class="kpi-label">CP เฉลี่ย</span></div><div class="kpi-value">${fmt(r.avgCP)}</div><div class="kpi-sub">Average per member</div></div>
    <div class="kpi"><div class="kpi-header"><span class="kpi-icon">💰</span><span class="kpi-label">แจกรางวัลแล้ว</span></div><div class="kpi-value">${fmt(r.totalDistributed)}</div><div class="kpi-sub">${r.distributionCount} ครั้ง</div></div>
    <div class="kpi"><div class="kpi-header"><span class="kpi-icon">📝</span><span class="kpi-label">รอยืนยัน</span></div><div class="kpi-value">${fmt(r.pendingDistributions)}</div><div class="kpi-sub">Draft distributions</div></div>
  `;

  // Top performers
  const max = r.topPerformers[0]?.cpValue || 1;
  const tierClass = t => 'rank-tier-' + (t || '').toLowerCase();
  document.getElementById('dashTopList').innerHTML = r.topPerformers.map((p, i) => {
    const avatar = p.profileImage
      ? `<img src="${p.profileImage}" alt="${p.name}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;margin-right:8px;border:2px solid ${getTierColor(p.tier)}">`
      : `<div style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:var(--text2);margin-right:8px;border:2px solid ${getTierColor(p.tier)};flex-shrink:0">${(p.name||'?').charAt(0)}</div>`;
    return `<div class="rank-item ${tierClass(p.tier)}">
      <div class="rank-num ${i < 3 ? 'rank-' + (i + 1) : ''}">${i + 1}</div>
      ${avatar}
      <div class="rank-info"><div class="rank-name">${p.name}</div><div class="rank-sub"><span class="rank-tier-label ${tierClass(p.tier)}">${p.tier}</span>${p.weaponClass ? ' · ' + p.weaponClass : ''}</div></div>
      <div class="rank-val">${fmt(p.cpValue)}</div>
    </div>`;
  }).join('') || '<p style="color:var(--text3);font-size:.8rem;padding:12px">ยังไม่มีข้อมูล</p>';

  // Refresh CP session UI after dashboard data loaded
  updateCPSessionUI();

  // Recent distributions (clickable → popup)
  document.getElementById('dashRecentDist').innerHTML = r.recentDistributions.map(d => `
    <div class="dist-item" onclick="showDistDetailPopup('${d.id}','${fmt(d.totalPrize)}','${fmtDate(d.date)}','${d.distributedBy}','${d.status}')">
      <div class="dist-item-header">
        <div class="dist-item-info"><div class="dist-item-amount">${d.itemName ? d.itemName + ' — ' : ''}${fmt(d.totalPrize)} เพชร</div><div class="dist-item-sub">${fmtDate(d.date)} · ${d.distributedBy}</div></div>
        <span class="badge ${d.status === 'confirmed' ? 'badge-green' : 'badge-yellow'}">${d.status.toUpperCase()}</span>
      </div>
    </div>`).join('') || '<p style="color:var(--text3);font-size:.8rem">ยังไม่มีข้อมูล</p>';
}

async function showDistDetailPopup(distId, totalPrize, date, by, status) {
  document.getElementById('distDetailTitle').innerHTML = `รายละเอียดการแจกรางวัล <span style="font-size:.7rem;color:var(--text3);font-weight:400;margin-left:8px">${date} · ${by}</span>`;
  document.getElementById('distDetailTotal').innerHTML = `<span style="color:var(--gold);font-weight:900">${totalPrize}</span> เพชร <span class="badge ${status === 'confirmed' ? 'badge-green' : 'badge-yellow'}" style="margin-left:8px">${status.toUpperCase()}</span>`;
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
    <td><strong style="color:var(--gold)">${fmt(Math.floor(d.amount))} เพชร</strong></td>
  </tr>`).join('');
}

// === MEMBERS ===
let allMembers = [];

async function loadMembers() {
  updateCPReviewBadge();
  const r = await callAPI('getMembers');
  if (!r.success) return;
  allMembers = r.members;
  // Populate tier filter
  const tiers = [...new Set(allMembers.map(m => m.tier).filter(Boolean))];
  const tf = document.getElementById('memberTierFilter');
  tf.innerHTML = '<option value="all">ทุก Tier</option>' + tiers.map(t => `<option value="${t}">${t}</option>`).join('');
  const classes = [...new Set(allMembers.map(m => m.weaponClass).filter(Boolean))].sort();
  const cf = document.getElementById('memberClassFilter');
  cf.innerHTML = '<option value="all">ทุกอาชีพ</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
  renderMembers();
  // Tier distribution chart
  // Tier stacked bar
  const tierDist = {};
  allMembers.filter(m => m.status === 'active').forEach(m => { const t = m.tier || '-'; tierDist[t] = (tierDist[t] || 0) + 1; });
  const tierLabels = Object.keys(tierDist);
  const tierData = Object.values(tierDist);
  const total = tierData.reduce((a, b) => a + b, 0) || 1;
  const barEl = document.getElementById('tierStackedBar');
  if (barEl) {
    const segments = tierLabels.map((label, i) => {
      const pct = (tierData[i] / total * 100).toFixed(1);
      const color = getTierColor(label);
      return `<div class="tier-seg" style="width:${pct}%;background:${color}" data-tip="${label}: ${tierData[i]} คน (${pct}%)"><span class="tier-seg-text">${label} ${tierData[i]}</span></div>`;
    }).join('');
    barEl.innerHTML = `<div class="tier-stacked-bar">${segments}</div>`;
  }
}

function renderMembers() {
  const search = document.getElementById('memberSearch').value.toLowerCase();
  const tf = document.getElementById('memberTierFilter').value;
  const cf = document.getElementById('memberClassFilter').value;
  let list = allMembers.filter(m => {
    if (search && !m.name.toLowerCase().includes(search)) return false;
    if (tf !== 'all' && m.tier !== tf) return false;
    if (cf !== 'all' && m.weaponClass !== cf) return false;
    return true;
  }).sort((a, b) => (parseFloat(b.cpValue) || 0) - (parseFloat(a.cpValue) || 0));
  const canEdit = currentUser.role !== 'member';
  document.getElementById('membersTable').innerHTML = list.map(m => {
    const avatar = m.profileImage
      ? `<img src="${m.profileImage}" alt="${m.name}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;margin-right:8px;border:2px solid ${getTierColor(m.tier)};vertical-align:middle">`
      : `<span style="display:inline-flex;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.08);align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:var(--text2);margin-right:8px;border:2px solid ${getTierColor(m.tier)};vertical-align:middle">${(m.name||'?').charAt(0)}</span>`;
    return `<tr>
      <td>${avatar}<strong>${m.name}</strong></td>
      <td style="font-size:.75rem;color:var(--text2)">${m.weaponClass || '-'}</td>
      <td><strong style="color:var(--cyan)">${fmt(m.cpValue)}</strong></td>
      <td>${tierBadge(m.tier)}</td>
      <td>${m.rewardPercent || 0}%</td>
      <td><span class="badge ${m.status === 'active' ? 'badge-green' : 'badge-red'}">${m.status}</span></td>
      <td class="table-actions">${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="editMember('${m.id}')">แก้ไข</button><button class="btn btn-danger btn-sm" onclick="deleteMember('${m.id}','${m.name}')">ลบ</button>` : '-'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" class="text-center" style="color:var(--text3);padding:30px">ไม่พบข้อมูลสมาชิก</td></tr>';
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
  // Remember if preview was visible before reload
  const previewEl = document.getElementById('rewardPreviewSection');
  const wasVisible = previewEl && !previewEl.classList.contains('hidden');
  loadItems();
  const r = await callAPI('getDistributions');
  if (!r.success) return;
  allDistItems = r.distributions.filter(d => d.status === 'confirmed' || d.status === 'paid').sort((a, b) => new Date(b.date) - new Date(a.date));
  document.getElementById('distHistoryTable').innerHTML = renderDistRows(allDistItems.slice(0, 5));
  // Restore preview visibility
  if (wasVisible && previewEl) previewEl.classList.remove('hidden');
}

let allDistItems = [];

function renderDistRows(list) {
  return list.map(d => {
    const subCount = DEMO.itemSubmissions ? DEMO.itemSubmissions.filter(s => s.itemId === d.itemId).length : 0;
    const isPaid = d.status === 'paid';
    const statusBadge = isPaid ? '<span class="badge badge-cyan">จ่ายแล้ว</span>' : '<span class="badge badge-green">แจกแล้ว</span>';
    const actions = isPaid
      ? `<button class="btn btn-ghost btn-sm" onclick="viewDistDetail('${d.id}')">ดู</button><button class="btn btn-ghost btn-sm" onclick="markDistStatus('${d.id}','confirmed')">ย้อนกลับ</button>`
      : `<button class="btn btn-ghost btn-sm" onclick="viewDistDetail('${d.id}')">ดู</button><button class="btn btn-primary btn-sm" onclick="markDistStatus('${d.id}','paid')">จ่ายแล้ว</button>`;
    return `<tr>
      <td><strong>${d.itemName || '-'}</strong></td>
      <td><strong style="color:var(--cyan)">${fmt(d.totalPrize)}</strong></td>
      <td>${d.distributedBy}</td>
      <td>${fmtDate(d.date)}</td>
      <td>${subCount} คน</td>
      <td>${statusBadge}</td>
      <td class="table-actions">${actions}</td></tr>`;
  }).join('') || '<tr><td colspan="7" class="text-center" style="color:var(--text3);padding:30px">ยังไม่มีประวัติ</td></tr>';
}

function showDistHistoryModal() {
  document.getElementById('distHistoryFullTable').innerHTML = renderDistRows(allDistItems);
  showModal('distHistoryModal');
}

function markDistStatus(distId, newStatus) {
  const dist = DEMO.distributions.find(d => d.id === distId);
  if (!dist) return;
  dist.status = newStatus;
  showToast(newStatus === 'paid' ? 'บันทึกจ่ายแล้ว' : 'ย้อนกลับสำเร็จ');
  loadRewards();
}

async function calculateRewards() {
  const totalPrize = parseNum(document.getElementById('totalPrize').value);
  const r = await callAPI('calculateRewards', { totalPrize });
  if (!r.success) { showToast(r.error, 'error'); return; }
  currentDistributionId = r.distributionId;
  currentRewardBreakdown = r.breakdown;
  document.getElementById('rewardPreviewSection').classList.remove('hidden');
  document.getElementById('rewardSummary').innerHTML = `
    <div class="reward-summary-item"><div class="val">${fmt(r.totalPrize)}</div><div class="lbl">เพชรรวม</div></div>
    <div class="reward-summary-item"><div class="val">${r.memberCount}</div><div class="lbl">จำนวนสมาชิก</div></div>
    <div class="reward-summary-item"><div class="val">${fmt(r.totalWeight)}</div><div class="lbl">น้ำหนักรวม</div></div>`;
  document.getElementById('rewardTable').innerHTML = r.breakdown.map((b, i) => `
    <tr><td>${i + 1}</td><td><strong>${b.memberName}</strong></td>
    <td>${fmt(b.cpValue)}</td><td>${tierBadge(b.tier)}</td>
    <td>${b.percentage}%</td><td><strong style="color:var(--green)">${fmt(Math.floor(b.amount))}</strong> เพชร</td></tr>`).join('');
  // Show confirm only for superadmin
  document.getElementById('btnConfirmDist').style.display = currentUser.role === 'Super Admin' ? 'inline-flex' : 'none';
  showToast('คำนวณสำเร็จ');
  loadRewards();
}

async function confirmCurrentDistribution() {
  if (!currentDistributionId) return;
  if (!confirm('ยืนยันการแจกรางวัลนี้?')) return;
  const r = await callAPI('confirmDistribution', { distributionId: currentDistributionId });
  if (r.success) {
    showToast(r.message);
    // Hide confirm button, show confirmed status
    const btn = document.getElementById('btnConfirmDist');
    if (btn) { btn.textContent = 'ยืนยันแล้ว'; btn.disabled = true; btn.classList.remove('btn-success'); btn.classList.add('btn-ghost'); }
    loadRewards();
  }
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
    <td><strong style="color:var(--green)">${fmt(Math.floor(d.amount))}</strong> เพชร</td></tr>`).join('');
  showModal('distDetailModal');
}

function exportRewardCSV() {
  if (!currentRewardBreakdown) return;
  let csv = '\uFEFF#,ชื่อ,CP,Tier,%,จำนวนเพชร\n';
  currentRewardBreakdown.forEach((b, i) => {
    csv += `${i + 1},"${b.memberName}",${b.cpValue},"${b.tier}",${b.percentage},${Math.floor(b.amount)}\n`;
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
  const canEdit = currentUser.role === 'Super Admin';
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
  document.getElementById('tierMinCP').value = tier ? fmt(tier.minCP) : '';
  document.getElementById('tierMaxCP').value = tier ? fmt(tier.maxCP) : '';
  document.getElementById('tierRewardPct').value = tier ? fmt(tier.rewardPercent) : '';
  showModal('tierModal');
}

function editTier(id) { const t = allTiers.find(t => t.id === id); if (t) showTierModal(t); }

async function saveTier() {
  const id = document.getElementById('editTierId').value;
  const tier = { tierName: document.getElementById('tierName').value.trim(), minCP: document.getElementById('tierMinCP').value.replace(/,/g, ''), maxCP: document.getElementById('tierMaxCP').value.replace(/,/g, ''), rewardPercent: document.getElementById('tierRewardPct').value.replace(/,/g, '') };
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
  if (currentUser.role === 'Super Admin') {
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
      <select class="inline-role-select ${u.role === 'Super Admin' ? 'role-superadmin' : u.role === 'admin' ? 'role-admin' : 'role-member'}" onchange="inlineUpdateRole('${u.username}', this.value, this)" ${u.username === 'superadmin' ? 'disabled' : ''}>
        <option value="member" ${u.role === 'member' ? 'selected' : ''}>Member</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
        <option value="Super Admin" ${u.role === 'Super Admin' ? 'selected' : ''}>Super Admin</option>
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
    selectEl.className = 'inline-role-select ' + (newRole === 'Super Admin' ? 'role-superadmin' : newRole === 'admin' ? 'role-admin' : 'role-member');
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
  document.getElementById('activityLogList').innerHTML = r.logs.map(l => {
    let extra = '';
    if (l.oldValue || l.newValue) extra = ' <span style="color:var(--yellow);font-size:.7rem">[' + (l.oldValue || '') + ' → ' + (l.newValue || '') + ']</span>';
    return `<div class="log-item"><span class="log-time">${fmtDate(l.timestamp)}</span><span class="log-user">${l.user}</span><span class="log-action">${l.action} - ${l.details || ''}${extra}</span></div>`;
  }).join('') || '<p style="color:var(--text3);font-size:.8rem;padding:12px">ไม่มีข้อมูล</p>';
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
  if (!approve) {
    if (!confirm('ปฏิเสธคำขอนี้?')) return;
  }
  const r = await callAPI('handlePasswordReset', { resetId, approve });
  if (r.success) {
    if (approve && r.tempPassword) {
      // Show temp password popup for admin to copy
      showTempPasswordPopup(r.username, r.tempPassword);
    } else {
      showToast(r.message);
    }
    loadPasswordResets(); loadNotifications();
  }
  else showToast(r.error, 'error');
}

function showTempPasswordPopup(username, tempPw) {
  document.getElementById('tempPwUsername').textContent = username;
  document.getElementById('tempPwValue').textContent = tempPw;
  showModal('tempPasswordModal');
}

function copyTempPassword() {
  const pw = document.getElementById('tempPwValue').textContent;
  navigator.clipboard.writeText(pw).then(() => {
    showToast('คัดลอกรหัสผ่านชั่วคราวแล้ว');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = pw; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    showToast('คัดลอกรหัสผ่านชั่วคราวแล้ว');
  });
}

// === NOTIFICATIONS (Admin) ===
async function loadNotifications() {
  const r = await callAPI('getNotifications');
  if (!r.success) return;
  const unread = r.notifications.filter(n => !n.read).length;
  document.getElementById('notifBadge').textContent = unread;
  const typeIcons = { password_reset: '🔑', register: '👤', info: 'ℹ️', warning: '⚠️', new_item: '📦', item_submission: '📸', cp_update: '📊', cp_update_submit: '📤', announcement: '📢' };
  const typeColors = { password_reset: 'var(--yellow)', register: 'var(--cyan)', info: 'var(--blue)', warning: 'var(--red)', new_item: 'var(--green)', item_submission: 'var(--purple)', cp_update: 'var(--purple)', cp_update_submit: 'var(--gold)', announcement: 'var(--orange)' };
  document.getElementById('notificationList').innerHTML = (unread > 0 ? `<div style="text-align:right;margin-bottom:12px"><button class="btn btn-ghost btn-sm" onclick="markAllNotifRead()">อ่านทั้งหมด</button></div>` : '') +
    r.notifications.map(n => `
    <div class="log-item" style="opacity:${n.read ? '.6' : '1'};${!n.read ? 'border-left:3px solid ' + (typeColors[n.type] || 'var(--cyan)') + ';padding-left:12px' : ''}">
      <span style="font-size:1.1rem;min-width:24px">${typeIcons[n.type] || '📌'}</span>
      <div style="flex:1"><div style="font-weight:700;font-size:.8rem;${!n.read ? 'color:var(--text)' : 'color:var(--text2)'}">${n.title}</div><div style="font-size:.72rem;color:var(--text3);margin-top:2px">${n.message}</div></div>
      <span class="log-time">${fmtDate(n.timestamp)}</span>
      ${!n.read ? `<button class="btn btn-ghost btn-sm" onclick="markNotifRead('${n.id}')" style="padding:4px 8px;font-size:.65rem">อ่าน</button>` : ''}
      ${n.type === 'new_item' && n.itemId && currentUser.role === 'member' ? `<button class="btn btn-primary btn-sm" onclick="markNotifRead('${n.id}');showPage('Rewards')" style="padding:4px 8px;font-size:.65rem">ไปอัพโหลด</button>` : ''}
    </div>`).join('') || '<p style="color:var(--text3);font-size:.8rem;padding:12px">ไม่มีแจ้งเตือน</p>';
}

async function markNotifRead(notifId) {
  await callAPI('markNotificationRead', { notifId });
  loadNotifications();
  refreshNotifBadge();
  if (document.getElementById('pageNotifications') && document.getElementById('pageNotifications').classList.contains('active')) {
    loadNotificationPage();
  }
}

async function markAllNotifRead() {
  await callAPI('markNotificationRead', { notifId: 'all' });
  loadNotifications();
  refreshNotifBadge();
  // If on notification page, reload it
  if (document.getElementById('pageNotifications') && document.getElementById('pageNotifications').classList.contains('active')) {
    loadNotificationPage();
  }
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

// === ANNOUNCEMENT ===
function showAnnouncementModal() {
  document.getElementById('annTitle').value = '';
  document.getElementById('annContent').value = '';
  showModal('announcementModal');
}

async function submitAnnouncement() {
  const title = document.getElementById('annTitle').value.trim();
  const content = document.getElementById('annContent').value.trim();
  if (!title) { showToast('กรุณากรอกหัวข้อเรื่อง', 'error'); return; }
  if (!content) { showToast('กรุณากรอกเนื้อหา', 'error'); return; }
  const r = await callAPI('createAnnouncement', { title, content });
  if (r.success) {
    showToast(r.message);
    hideModal('announcementModal');
    loadNotifications();
    refreshNotifBadge();
  } else {
    showToast(r.error, 'error');
  }
}

// === NOTIFICATION PAGE ===
async function loadNotificationPage() {
  const r = await callAPI('getNotifications');
  if (!r.success) return;
  const notifs = r.notifications;

  // Render items tab
  await renderPendingItems();

  // Update items badge on tab
  const itemR = await callAPI('getItems');
  let itemBadgeCount = 0;
  if (itemR.success) {
    itemBadgeCount = itemR.items.filter(item => {
      if (item.status === 'distributed') return false;
      const mySub = DEMO.itemSubmissions.find(s => s.itemId === item.id && s.username === currentUser.username);
      if (!mySub) return true; // ยังไม่ส่ง
      if (mySub.status === 'rejected') return true; // ถูกปฏิเสธ ต้องส่งใหม่
      return false;
    }).length;
  }
  const itemsBadge = document.getElementById('notifTabItemsBadge');
  if (itemsBadge) {
    itemsBadge.textContent = itemBadgeCount;
    itemsBadge.style.display = itemBadgeCount > 0 ? 'inline' : 'none';
  }

  // Render system tab (non-item notifications)
  const systemNotifs = notifs.filter(n => n.type !== 'new_item');
  renderNotifListTo(systemNotifs, 'notifSystemList');

  // Render all tab
  renderNotifList(notifs);

  // Update sidebar badge
  updateNotifBadge(notifs);

  // Force-read unread announcements
  showUnreadAnnouncements(notifs);
}

// === FORCE-READ ANNOUNCEMENT POPUP ===
let announcementQueue = [];

function showUnreadAnnouncements(notifs) {
  // Filter unread announcements
  const unread = notifs.filter(n => n.type === 'announcement' && !n.read);
  if (unread.length === 0) return;
  announcementQueue = [...unread];
  showNextAnnouncement();
}

function showNextAnnouncement() {
  if (announcementQueue.length === 0) {
    hideModal('announcementReadModal');
    return;
  }
  const ann = announcementQueue[0];
  const total = announcementQueue.length;
  document.getElementById('annReadTitle').textContent = ann.title.replace(/^📢\s*/, '');
  document.getElementById('annReadContent').textContent = ann.message;
  document.getElementById('annReadDate').textContent = fmtDate(ann.timestamp);
  const counter = document.getElementById('annReadCounter');
  if (total > 1) {
    counter.textContent = `เหลืออีก ${total} ประกาศที่ยังไม่ได้อ่าน`;
    counter.style.display = '';
  } else {
    counter.style.display = 'none';
  }
  showModal('announcementReadModal');
}

async function dismissAnnouncement() {
  if (announcementQueue.length === 0) return;
  const ann = announcementQueue.shift();
  // Mark as read
  await callAPI('markNotificationRead', { notifId: ann.id });
  refreshNotifBadge();
  if (announcementQueue.length > 0) {
    showNextAnnouncement();
  } else {
    hideModal('announcementReadModal');
    // Reload notification page to reflect read status
    loadNotificationPage_noPopup();
  }
}

// Version of loadNotificationPage that doesn't trigger popups (to avoid recursion)
async function loadNotificationPage_noPopup() {
  const r = await callAPI('getNotifications');
  if (!r.success) return;
  const notifs = r.notifications;
  await renderPendingItems();
  const itemR = await callAPI('getItems');
  let itemBadgeCount = 0;
  if (itemR.success) {
    itemBadgeCount = itemR.items.filter(item => {
      if (item.status === 'distributed') return false;
      const mySub = DEMO.itemSubmissions.find(s => s.itemId === item.id && s.username === currentUser.username);
      if (!mySub) return true;
      if (mySub.status === 'rejected') return true;
      return false;
    }).length;
  }
  const itemsBadge = document.getElementById('notifTabItemsBadge');
  if (itemsBadge) {
    itemsBadge.textContent = itemBadgeCount;
    itemsBadge.style.display = itemBadgeCount > 0 ? 'inline' : 'none';
  }
  const systemNotifs = notifs.filter(n => n.type !== 'new_item');
  renderNotifListTo(systemNotifs, 'notifSystemList');
  renderNotifList(notifs);
  updateNotifBadge(notifs);
}

function switchNotifTab(tab) {
  document.querySelectorAll('#notifTabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#pageNotifications .tab-content').forEach(c => c.classList.remove('active'));
  const tabMap = { items: 0, system: 1, all: 2 };
  document.querySelectorAll('#notifTabs .tab')[tabMap[tab]].classList.add('active');
  document.getElementById('notifTab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
}

async function renderPendingItems() {
  const r = await callAPI('getItems');
  if (!r.success) return;
  const container = document.getElementById('pendingItemsList');
  const items = r.items;

  if (items.length === 0) {
    container.innerHTML = '<p style="color:var(--text3);font-size:.8rem;padding:12px">ไม่มีรายการ</p>';
    return;
  }

  let html = '';
  items.forEach(item => {
    // Item overall status
    const isDistributed = item.status === 'distributed';
    const statusBadge = isDistributed
      ? '<span class="badge badge-green">CONFIRMED</span>'
      : '<span class="badge badge-yellow">PENDING</span>';

    // My submission status
    const mySub = DEMO.itemSubmissions.find(s => s.itemId === item.id && s.username === currentUser.username);
    let myAction = '';
    if (!isDistributed) {
      if (!mySub) {
        myAction = item.expired
          ? '<span style="color:var(--text3);font-size:.7rem">ปิดรับแล้ว</span>'
          : `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();showItemUpload('${item.id}')">ส่งรูป</button>`;
      } else if (mySub.status === 'pending' && !item.expired) {
        myAction = `<span style="color:var(--yellow);font-size:.7rem">รอตรวจ</span> <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showItemUpload('${item.id}')">แก้ไข</button>`;
      } else if (mySub.status === 'rejected') {
        myAction = `<span style="color:var(--red);font-size:.7rem">ถูกปฏิเสธ</span> <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();showItemUpload('${item.id}')">ส่งใหม่</button>`;
      } else if (mySub.status === 'approved') {
        myAction = '<span class="badge badge-green">อนุมัติแล้ว</span>';
      } else {
        myAction = '<span style="color:var(--yellow);font-size:.7rem">รอตรวจ</span>';
      }
    } else if (mySub) {
      myAction = mySub.status === 'approved' ? '<span class="badge badge-green">อนุมัติแล้ว</span>' : '';
    }

    // Submission summary
    const subs = DEMO.itemSubmissions.filter(s => s.itemId === item.id);
    const approvedCount = subs.filter(s => s.status === 'approved').length;
    const subSummary = `<span style="font-size:.7rem;color:var(--text3)">ส่งแล้ว ${subs.length} · อนุมัติ ${approvedCount}</span>`;

    html += `<div class="pending-item-card" style="cursor:pointer" onclick="showNotifItemDetail('${item.id}')">
      <div>
        <strong>${item.name}</strong><br>
        <span style="color:var(--gold);font-size:.8rem">${fmt(item.value)} เพชร</span>
        <span style="margin-left:8px;font-size:.7rem;color:var(--text3)">${fmtDate(item.createdAt)} · ${item.createdBy}</span><br>
        ${subSummary}
      </div>
      <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${statusBadge}
        ${myAction}
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

function showNotifItemDetail(itemId) {
  const item = DEMO.items.find(i => i.id === itemId);
  if (!item) return;
  const subs = DEMO.itemSubmissions.filter(s => s.itemId === itemId);
  const isDistributed = item.status === 'distributed';
  const remaining = itemTimeRemaining(item);

  const statusLabel = isDistributed
    ? '<span class="badge badge-green">CONFIRMED</span>'
    : '<span class="badge badge-yellow">PENDING</span>';

  let subsHtml = '';
  if (subs.length === 0) {
    subsHtml = '<p style="color:var(--text3);font-size:.8rem;padding:12px">ยังไม่มีใครส่งรูป</p>';
  } else {
    const subStatusMap = {
      pending: { text: 'รอตรวจ', badge: 'badge-yellow' },
      approved: { text: 'อนุมัติ', badge: 'badge-green' },
      rejected: { text: 'ปฏิเสธ', badge: 'badge-red' }
    };
    subsHtml = subs.map(s => {
      const st = subStatusMap[s.status] || subStatusMap.pending;
      const thumb = `<img src="${s.image}" class="submission-thumb" style="width:48px;height:48px;border-radius:2px" onclick="event.stopPropagation();document.getElementById('imagePreviewImg').src='${s.image}';showModal('imagePreviewModal')">`;
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px;border-bottom:1px solid var(--metal-dark)">
        ${thumb}
        <div style="flex:1"><strong style="font-size:.82rem">${s.displayName}</strong><br><span style="font-size:.68rem;color:var(--text3)">${fmtDate(s.submittedAt)}</span></div>
        <span class="badge ${st.badge}">${st.text}</span>
      </div>`;
    }).join('');
  }

  const approvedCount = subs.filter(s => s.status === 'approved').length;

  document.getElementById('notifItemDetailTitle').textContent = item.name;
  document.getElementById('notifItemDetailBody').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <span style="color:var(--gold);font-size:1.1rem;font-weight:900">${fmt(item.value)} เพชร</span><br>
        <span style="font-size:.72rem;color:var(--text3)">${fmtDate(item.createdAt)} · สร้างโดย ${item.createdBy}</span>
      </div>
      <div style="text-align:right">
        ${statusLabel}<br>
        <span style="font-size:.72rem;color:var(--text3);margin-top:4px;display:inline-block">ส่งแล้ว ${subs.length} · อนุมัติ ${approvedCount}</span>
      </div>
    </div>
    <div style="font-weight:700;font-size:.82rem;margin-bottom:8px;color:var(--gold2)">รายชื่อผู้ส่งรูป</div>
    <div style="max-height:350px;overflow-y:auto;border:1px solid var(--metal-dark);border-radius:2px">${subsHtml}</div>`;
  showModal('notifItemDetailModal');
}

function renderNotifList(notifs) {
  renderNotifListTo(notifs, 'notifPageList');
}

function renderNotifListTo(notifs, containerId) {
  const typeIcons = { password_reset: '🔑', register: '👤', info: 'ℹ️', warning: '⚠️', new_item: '📦', item_submission: '📸', cp_update: '📊', cp_update_submit: '📤', announcement: '📢' };
  const typeColors = { password_reset: 'var(--yellow)', register: 'var(--blue)', info: 'var(--blue)', warning: 'var(--red)', new_item: 'var(--green)', item_submission: 'var(--purple)', cp_update: 'var(--purple)', cp_update_submit: 'var(--gold)', announcement: 'var(--orange)' };
  // Deduplicate new_item notifications by itemId
  let displayed = [];
  const seenItemIds = new Set();
  notifs.forEach(n => {
    if (n.type === 'new_item' && n.itemId) {
      if (seenItemIds.has(n.itemId)) return;
      seenItemIds.add(n.itemId);
    }
    displayed.push(n);
  });
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = displayed.map(n => {
    // Action button for new_item notifications (ทุก role เป็นผู้เล่น ต้องอัพโหลดรูปได้)
    let actionBtn = '';
    if (n.type === 'new_item' && n.itemId) {
      const item = DEMO.items.find(i => i.id === n.itemId);
      const alreadySubmitted = DEMO.itemSubmissions.some(s => s.itemId === n.itemId && s.username === currentUser.username);
      const expired = item ? itemTimeRemaining(item) <= 0 : true;
      if (alreadySubmitted) {
        actionBtn = '<span class="badge badge-green" style="margin-left:8px">ส่งแล้ว</span>';
      } else if (!expired) {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="markNotifRead('${n.id}');showItemUpload('${n.itemId}')" style="padding:4px 8px;font-size:.65rem">อัพโหลดรูป</button>`;
      } else {
        actionBtn = '<span style="color:var(--text3);font-size:.7rem;margin-left:8px">ปิดรับแล้ว</span>';
      }
    }
    return `<div class="log-item" style="opacity:${n.read ? '.6' : '1'};${!n.read ? 'border-left:3px solid ' + (typeColors[n.type] || 'var(--blue)') + ';padding-left:12px' : ''}">
      <span style="font-size:1.1rem;min-width:24px">${typeIcons[n.type] || '📌'}</span>
      <div style="flex:1"><div style="font-weight:700;font-size:.8rem;${!n.read ? 'color:var(--text)' : 'color:var(--text2)'}">${n.title}</div><div style="font-size:.72rem;color:var(--text3);margin-top:2px">${n.message}</div></div>
      <span class="log-time">${fmtDate(n.timestamp)}</span>
      ${!n.read ? `<button class="btn btn-ghost btn-sm" onclick="markNotifRead('${n.id}')" style="padding:4px 8px;font-size:.65rem">อ่าน</button>` : ''}
      ${actionBtn}
    </div>`;
  }).join('') || '<p style="color:var(--text3);font-size:.8rem;padding:12px">ไม่มีแจ้งเตือน</p>';
}

function updateNotifBadge(notifs) {
  const badge = document.getElementById('navNotifBadge');
  if (!badge) return;
  // Deduplicate new_item by itemId before counting
  const seenItemIds = new Set();
  let count = 0;
  notifs.forEach(n => {
    if (n.read) return;
    if (n.type === 'new_item' && n.itemId) {
      if (seenItemIds.has(n.itemId)) return;
      seenItemIds.add(n.itemId);
    }
    count++;
  });
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

async function refreshNotifBadge() {
  const r = await callAPI('getNotifications');
  if (!r.success) return;
  updateNotifBadge(r.notifications);
}

// === LOGIN PENDING ITEMS CHECK ===
async function checkPendingItemsOnLogin() {
  const r = await callAPI('getItems');
  if (!r.success) return;
  const pending = r.items.filter(item => {
    if (item.status !== 'active' || item.expired) return false;
    return !DEMO.itemSubmissions.some(s => s.itemId === item.id && s.username === currentUser.username);
  });
  if (pending.length > 0) {
    showPendingItemsPopup(pending);
  }
}

function showPendingItemsPopup(items) {
  document.getElementById('pendingItemsModalList').innerHTML = items.map(item =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border:1px solid var(--border);border-radius:2px;margin-bottom:8px">
      <div><strong>${item.name}</strong><br><span style="color:var(--gold);font-size:.8rem">${fmt(item.value)} เพชร</span></div>
      <span style="color:var(--green);font-size:.7rem">เหลือ ${fmtTimeRemaining(item.timeRemaining)}</span>
    </div>`
  ).join('');
  showModal('pendingItemsModal');
}

// === ITEMS (Create Item Feature) ===
let pendingItemImage = null;

function showCreateItemModal() {
  document.getElementById('itemName').value = '';
  document.getElementById('itemValue').value = '';
  showModal('createItemModal');
}

async function saveCreateItem() {
  const name = document.getElementById('itemName').value.trim();
  const value = parseNum(document.getElementById('itemValue').value);
  if (!name) { showToast('กรุณากรอกชื่อรายการ', 'error'); return; }
  if (value <= 0) { showToast('กรุณากรอกมูลค่า', 'error'); return; }
  const r = await callAPI('createItem', { name, value });
  if (r.success) { showToast(r.message); hideModal('createItemModal'); loadItems(); }
  else showToast(r.error, 'error');
}

function fmtTimeRemaining(ms) {
  if (ms <= 0) return 'หมดเวลา';
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return min + ' นาที ' + sec + ' วินาที';
}

async function loadItems() {
  const r = await callAPI('getItems');
  if (!r.success) return;
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'Super Admin';
  document.getElementById('itemsTable').innerHTML = r.items.map(item => {
    let statusBadge, statusText;
    if (item.status === 'distributed') { statusBadge = 'badge-cyan'; statusText = 'แจกแล้ว'; }
    else if (item.expired) { statusBadge = 'badge-yellow'; statusText = 'ปิดรับอัพโหลด'; }
    else { statusBadge = 'badge-green'; statusText = 'เปิดรับอัพโหลด'; }
    // Time info line
    let timeInfo = '';
    if (item.status !== 'distributed') {
      timeInfo = item.expired
        ? '<span style="color:var(--yellow);font-size:.7rem">ปิดรับอัพโหลดแล้ว</span>'
        : '<span style="color:var(--green);font-size:.7rem">เหลือ ' + fmtTimeRemaining(item.timeRemaining) + '</span>';
    }
    // Check if current member already submitted
    const alreadySubmitted = !isAdmin && DEMO.itemSubmissions.some(s => s.itemId === item.id && s.username === currentUser.username);
    let actions = '';
    if (isAdmin) {
      // Admin always sees review button regardless of time
      actions = `<button class="btn btn-ghost btn-sm" onclick="showItemReview('${item.id}')">ตรวจสอบ (${item.pendingCount})</button>`;
      if (item.status !== 'distributed') actions += ` <button class="btn btn-danger btn-sm" onclick="deleteItem('${item.id}','${item.name}')">ลบ</button>`;
    } else if (item.status === 'active' && !item.expired) {
      actions = alreadySubmitted ? '<span class="badge badge-green">ส่งแล้ว</span>' : `<button class="btn btn-primary btn-sm" onclick="showItemUpload('${item.id}')">อัพโหลดรูป</button>`;
    } else {
      actions = alreadySubmitted ? '<span class="badge badge-green">ส่งแล้ว</span>' : '<span style="color:var(--text3);font-size:.7rem">ปิดรับแล้ว</span>';
    }
    return `<tr>
      <td><strong>${item.name}</strong></td>
      <td><strong style="color:var(--gold)">${fmt(item.value)}</strong></td>
      <td>${item.createdBy}</td>
      <td>${fmtDate(item.createdAt)}<br>${timeInfo}</td>
      <td>${item.submissionCount} (${item.approvedCount} อนุมัติ)</td>
      <td><span class="badge ${statusBadge}">${statusText}</span></td>
      <td class="table-actions">${actions}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" class="text-center" style="color:var(--text3);padding:30px">ยังไม่มีรายการ</td></tr>';
}

function showItemUpload(itemId) {
  const item = DEMO.items.find(i => i.id === itemId);
  if (!item) return;
  const existing = DEMO.itemSubmissions.find(s => s.itemId === itemId && s.username === currentUser.username);
  // approved → แก้ไขไม่ได้
  if (existing && existing.status === 'approved') { showToast('รายการนี้อนุมัติแล้ว ไม่สามารถแก้ไขได้', 'error'); return; }
  // หมดเวลา แต่ถ้า rejected ส่งใหม่ได้
  if (itemTimeRemaining(item) <= 0 && (!existing || existing.status !== 'rejected')) { showToast('หมดเวลาอัพโหลดแล้ว (เกิน 1 ชั่วโมง)', 'error'); return; }
  document.getElementById('uploadItemId').value = itemId;
  const isEdit = existing && existing.status === 'pending';
  const isResubmit = existing && existing.status === 'rejected';
  document.getElementById('itemUploadTitle').textContent = (isEdit ? 'แก้ไขรูป: ' : isResubmit ? 'ส่งรูปใหม่: ' : 'อัพโหลดรูป: ') + item.name;
  pendingItemImage = null;
  document.getElementById('uploadPreviewArea').innerHTML = '<label>เลือกรูปภาพ<input type="file" accept="image/*" onchange="handleItemImage(this)"></label><div style="font-size:.65rem;color:var(--text3)">รูปจะถูก resize อัตโนมัติ</div>';
  showModal('itemUploadModal');
}

function handleItemImage(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('กรุณาเลือกไฟล์รูปภาพ', 'error'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const maxSize = 1920;
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      pendingItemImage = canvas.toDataURL('image/jpeg', 0.92);
      document.getElementById('uploadPreviewArea').innerHTML = '<img src="' + pendingItemImage + '" alt="preview"><label>เปลี่ยนรูป<input type="file" accept="image/*" onchange="handleItemImage(this)"></label>';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function submitItemUpload() {
  if (!pendingItemImage) { showToast('กรุณาเลือกรูปภาพ', 'error'); return; }
  const itemId = document.getElementById('uploadItemId').value;
  const r = await callAPI('submitItemImage', { itemId, image: pendingItemImage });
  if (r.success) { showToast(r.message); hideModal('itemUploadModal'); pendingItemImage = null; loadItems(); }
  else showToast(r.error, 'error');
}

// === CP UPDATE UI ===
let pendingCPImage = null;

async function startCPUpdate() {
  const r = await callAPI('startCPUpdate', {});
  if (r.success) {
    showToast(r.message);
    showPage('Dashboard');
  } else {
    showToast(r.error, 'error');
  }
}

function getCPSessionStatus() {
  if (!DEMO.cpUpdateSession) return null;
  return { active: DEMO.cpUpdateSession.status === 'active', remaining: cpSessionTimeRemaining(), submissions: DEMO.cpUpdateSession.submissions.length };
}

// === CP REVIEW (Admin) ===
function showCPReviewModal() {
  if (!DEMO.cpUpdateSession) { showToast('ไม่มี CP Update Session', 'error'); return; }
  const subs = DEMO.cpUpdateSession.submissions;
  renderCPSubmissions(subs);
  showModal('cpReviewModal');
}

function renderCPSubmissions(subs) {
  const el = document.getElementById('cpSubmissionsList');
  if (!subs || subs.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:.8rem;padding:12px;text-align:center">ยังไม่มีคนส่ง CP</p>';
    return;
  }
  el.innerHTML = '<div class="table-wrap"><table><thead><tr><th>รูป</th><th>ผู้ส่ง</th><th>CP ใหม่</th><th>เวลา</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>' +
    subs.map(function(s) { return renderCPSubRow(s); }).join('') + '</tbody></table></div>';
}

function renderCPSubRow(s) {
  var statusBadge = s.status === 'approved' ? 'badge-green' : s.status === 'rejected' ? 'badge-red' : 'badge-yellow';
  var statusText = s.status === 'approved' ? 'อนุมัติ' : s.status === 'rejected' ? 'ปฏิเสธ' : 'รอตรวจ';
  var actions = '';
  if (s.status === 'pending') {
    actions = '<button class="btn btn-success btn-sm" onclick="reviewCPSub(\'' + s.id + '\',\'approve\')">อนุมัติ</button><button class="btn btn-danger btn-sm" onclick="reviewCPSub(\'' + s.id + '\',\'reject\')">ปฏิเสธ</button>';
  } else if (s.status === 'approved') {
    actions = '<span style="font-size:.7rem;color:var(--text3)">โดย ' + s.reviewedBy + '</span><button class="btn btn-danger btn-sm" onclick="reviewCPSub(\'' + s.id + '\',\'reject\')">ปฏิเสธ</button><button class="btn btn-ghost btn-sm" onclick="reviewCPSub(\'' + s.id + '\',\'pending\')">ย้อน</button>';
  } else if (s.status === 'rejected') {
    actions = '<span style="font-size:.7rem;color:var(--text3)">โดย ' + s.reviewedBy + '</span><button class="btn btn-success btn-sm" onclick="reviewCPSub(\'' + s.id + '\',\'approve\')">อนุมัติ</button><button class="btn btn-ghost btn-sm" onclick="reviewCPSub(\'' + s.id + '\',\'pending\')">ย้อน</button>';
  }
  return '<tr id="cpSubRow_' + s.id + '">' +
    '<td><img class="submission-thumb" src="' + s.image + '" alt="cp" onclick="previewImage(\'' + s.image + '\')"></td>' +
    '<td><strong>' + s.displayName + '</strong></td>' +
    '<td>' + fmt(s.cpValue) + '</td>' +
    '<td>' + fmtDate(s.submittedAt) + '</td>' +
    '<td><span class="badge ' + statusBadge + '">' + statusText + '</span></td>' +
    '<td class="table-actions">' + actions + '</td></tr>';
}

async function reviewCPSub(subId, action) {
  var r = await callAPI('reviewCPUpdate', { submissionId: subId, action: action });
  if (r.success) {
    showToast(r.message);
    var sub = DEMO.cpUpdateSession.submissions.find(function(s) { return s.id === subId; });
    if (sub) {
      var row = document.getElementById('cpSubRow_' + subId);
      if (row) row.outerHTML = renderCPSubRow(sub);
    }
    updateCPReviewBadge();
  } else {
    showToast(r.error, 'error');
  }
}

function bulkCPReview(action) {
  if (!DEMO.cpUpdateSession) return;
  var subs = DEMO.cpUpdateSession.submissions;
  var label = action === 'approve' ? 'อนุมัติ' : action === 'reject' ? 'ปฏิเสธ' : 'ย้อนกลับ';
  var targets = subs.filter(function(s) { return s.status !== action && !(action === 'pending' && s.status === 'pending'); });
  if (action === 'approve') targets = subs.filter(function(s) { return s.status !== 'approved'; });
  else if (action === 'reject') targets = subs.filter(function(s) { return s.status !== 'rejected'; });
  else targets = subs.filter(function(s) { return s.status !== 'pending'; });
  if (targets.length === 0) { showToast('ไม่มีรายการที่ต้อง' + label, 'info'); return; }
  targets.forEach(function(s) {
    var oldStatus = s.status;
    if (action === 'pending') {
      s.status = 'pending';
      s.reviewedBy = null;
    } else {
      s.status = action === 'approve' ? 'approved' : 'rejected';
      s.reviewedBy = currentUser.username;
    }
    var row = document.getElementById('cpSubRow_' + s.id);
    if (row) row.outerHTML = renderCPSubRow(s);
  });
  updateCPReviewBadge();
  showToast(label + 'ทั้งหมด ' + targets.length + ' รายการสำเร็จ');
}

function previewImage(src) {
  document.getElementById('imagePreviewImg').src = src;
  showModal('imagePreviewModal');
}

function updateCPReviewBadge() {
  var btn = document.getElementById('btnReviewCP');
  var badge = document.getElementById('cpPendingBadge');
  if (!DEMO.cpUpdateSession || DEMO.cpUpdateSession.submissions.length === 0) {
    btn.className = 'btn btn-success hidden';
    return;
  }
  var pending = DEMO.cpUpdateSession.submissions.filter(function(s) { return s.status === 'pending'; }).length;
  badge.textContent = pending;
  btn.className = 'btn btn-success';
}

async function confirmCPUpdateAll() {
  var approved = DEMO.cpUpdateSession ? DEMO.cpUpdateSession.submissions.filter(function(s) { return s.status === 'approved'; }).length : 0;
  if (approved === 0) { showToast('ไม่มีรายการที่อนุมัติ กรุณาอนุมัติก่อนกด Update', 'error'); return; }
  var r = await callAPI('confirmCPUpdate');
  if (r.success) {
    showToast(r.message);
    hideModal('cpReviewModal');
    updateCPReviewBadge();
    updateCPSessionUI();
    showPage('Members');
  } else {
    showToast(r.error, 'error');
  }
}

function showUpdateCPModal() {
  if (!DEMO.cpUpdateSession || cpSessionTimeRemaining() <= 0) { showToast('ไม่มี CP Update Session ที่เปิดอยู่', 'error'); return; }
  pendingCPImage = null;
  document.getElementById('cpNewValue').value = '';
  document.getElementById('cpUploadPreviewArea').innerHTML = '<label>เลือกรูปภาพ<input type="file" accept="image/*" onchange="handleCPImage(this)"></label><div style="font-size:.65rem;color:var(--text3)">รูปจะถูก resize อัตโนมัติ</div>';
  showModal('updateCPModal');
}

function handleCPImage(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('กรุณาเลือกไฟล์รูปภาพ', 'error'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const maxSize = 1920;
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      pendingCPImage = canvas.toDataURL('image/jpeg', 0.92);
      document.getElementById('cpUploadPreviewArea').innerHTML = '<img src="' + pendingCPImage + '" alt="preview"><label>เปลี่ยนรูป<input type="file" accept="image/*" onchange="handleCPImage(this)"></label>';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function submitCPUpdate() {
  if (!pendingCPImage) { showToast('กรุณาอัพโหลดรูปภาพ', 'error'); return; }
  const cpVal = document.getElementById('cpNewValue').value;
  if (!cpVal || cpVal === '0') { showToast('กรุณากรอกค่า CP', 'error'); return; }
  const r = await callAPI('submitCPUpdate', { cpValue: cpVal, image: pendingCPImage });
  if (r.success) { showToast(r.message); hideModal('updateCPModal'); pendingCPImage = null; loadDashboard(); }
  else showToast(r.error, 'error');
}

let currentReviewItemId = null;

async function showItemReview(itemId) {
  currentReviewItemId = itemId;
  const item = DEMO.items.find(i => i.id === itemId);
  document.getElementById('itemReviewTitle').textContent = 'ตรวจสอบ: ' + (item ? item.name + ' (' + fmt(item.value) + ' เพชร)' : '');
  const btn = document.getElementById('btnDistributeItemReward');
  btn.dataset.itemId = itemId;
  btn.style.display = (item && item.status === 'active') ? 'inline-flex' : 'none';
  const r = await callAPI('getItemSubmissions', { itemId });
  if (!r.success) return;
  renderItemSubmissions(r.submissions);
  // Disable only if no approved submissions
  const hasApproved = r.submissions.some(s => s.status === 'approved');
  btn.disabled = !hasApproved;
  btn.title = !hasApproved ? 'ไม่มีคนที่ได้รับอนุมัติ' : '';
  showModal('itemReviewModal');
}

function renderItemSubmissions(submissions) {
  if (submissions.length === 0) {
    document.getElementById('itemSubmissionsList').innerHTML = '<p style="color:var(--text3);font-size:.8rem;padding:12px;text-align:center">ยังไม่มีคนส่งรูป</p>';
    return;
  }
  document.getElementById('itemSubmissionsList').innerHTML = '<div class="table-wrap"><table><thead><tr><th>รูป</th><th>ผู้ส่ง</th><th>เวลา</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>' +
    submissions.map(s => renderSubmissionRow(s)).join('') + '</tbody></table></div>';
}

function renderSubmissionRow(s) {
  const statusBadge = s.status === 'approved' ? 'badge-green' : s.status === 'rejected' ? 'badge-red' : 'badge-yellow';
  const statusText = s.status === 'approved' ? 'อนุมัติ' : s.status === 'rejected' ? 'ปฏิเสธ' : 'รอตรวจ';
  let actions = '';
  if (s.status === 'pending') {
    actions = `<button class="btn btn-success btn-sm" onclick="reviewSubmission('${s.id}',true)">อนุมัติ</button><button class="btn btn-danger btn-sm" onclick="reviewSubmission('${s.id}',false)">ปฏิเสธ</button>`;
  } else if (s.status === 'approved') {
    actions = `<span style="font-size:.7rem;color:var(--text3)">โดย ${s.reviewedBy}</span> <button class="btn btn-danger btn-sm" onclick="reviewSubmission('${s.id}',false)" title="เปลี่ยนเป็นปฏิเสธ">ปฏิเสธ</button><button class="btn btn-ghost btn-sm" onclick="reviewSubmission('${s.id}','pending')" title="ย้อนกลับเป็นรอตรวจ">ย้อน</button>`;
  } else if (s.status === 'rejected') {
    actions = `<span style="font-size:.7rem;color:var(--text3)">โดย ${s.reviewedBy}</span> <button class="btn btn-success btn-sm" onclick="reviewSubmission('${s.id}',true)" title="เปลี่ยนเป็นอนุมัติ">อนุมัติ</button><button class="btn btn-ghost btn-sm" onclick="reviewSubmission('${s.id}','pending')" title="ย้อนกลับเป็นรอตรวจ">ย้อน</button>`;
  }
  return `<tr id="subRow_${s.id}">
    <td><img class="submission-thumb" src="${s.image}" alt="submission" data-sub-id="${s.id}" onclick="previewSubmissionImage(this.dataset.subId)"></td>
    <td><strong>${s.displayName}</strong></td>
    <td>${fmtDate(s.submittedAt)}</td>
    <td><span class="badge ${statusBadge}">${statusText}</span></td>
    <td class="table-actions">${actions}</td>
  </tr>`;
}

async function reviewSubmission(submissionId, approve) {
  // approve can be true, false, or 'pending' (to revert)
  if (approve === 'pending') {
    const sub = DEMO.itemSubmissions.find(s => s.id === submissionId);
    if (sub) { sub.status = 'pending'; sub.reviewedBy = null; }
    updateSubmissionRowInPlace(submissionId);
    showToast('ย้อนกลับเป็นรอตรวจ');
    return;
  }
  const r = await callAPI('reviewItemSubmission', { submissionId, approve });
  if (r.success) {
    showToast(r.message);
    updateSubmissionRowInPlace(submissionId);
  } else showToast(r.error, 'error');
}

function updateSubmissionRowInPlace(submissionId) {
  const sub = DEMO.itemSubmissions.find(s => s.id === submissionId);
  if (!sub) return;
  const row = document.getElementById('subRow_' + submissionId);
  if (row) {
    row.outerHTML = renderSubmissionRow(sub);
  }
  // Update distribute button state
  const itemId = sub.itemId;
  const allSubs = DEMO.itemSubmissions.filter(s => s.itemId === itemId);
  const hasApproved = allSubs.some(s => s.status === 'approved');
  const btn = document.getElementById('btnDistributeItemReward');
  btn.disabled = !hasApproved;
  btn.title = !hasApproved ? 'ไม่มีคนที่ได้รับอนุมัติ' : '';
}

function bulkReview(action) {
  const itemId = currentReviewItemId;
  if (!itemId) return;
  const subs = DEMO.itemSubmissions.filter(s => s.itemId === itemId);
  if (subs.length === 0) { showToast('ไม่มี submission', 'info'); return; }
  let targets, newStatus, label;
  if (action === 'approve') {
    targets = subs.filter(s => s.status !== 'approved');
    newStatus = 'approved'; label = 'อนุมัติ';
  } else if (action === 'reject') {
    targets = subs.filter(s => s.status !== 'rejected');
    newStatus = 'rejected'; label = 'ปฏิเสธ';
  } else {
    targets = subs.filter(s => s.status !== 'pending');
    newStatus = 'pending'; label = 'ย้อนกลับ';
  }
  if (targets.length === 0) { showToast('ไม่มีรายการที่ต้อง' + label, 'info'); return; }
  targets.forEach(s => {
    s.status = newStatus;
    s.reviewedBy = newStatus === 'pending' ? null : currentUser.username;
    const row = document.getElementById('subRow_' + s.id);
    if (row) row.outerHTML = renderSubmissionRow(s);
  });
  // Update distribute button
  const allSubs = DEMO.itemSubmissions.filter(s => s.itemId === itemId);
  const hasApproved = allSubs.some(s => s.status === 'approved');
  const btn = document.getElementById('btnDistributeItemReward');
  btn.disabled = !hasApproved;
  btn.title = !hasApproved ? 'ไม่มีคนที่ได้รับอนุมัติ' : '';
  showToast(label + 'ทั้งหมด ' + targets.length + ' รายการสำเร็จ');
}

function previewSubmissionImage(subId) {
  const sub = DEMO.itemSubmissions.find(s => s.id === subId);
  if (sub) previewImage(sub.image);
}

function closeImagePreview(event) {
  if (event.target === document.getElementById('imagePreviewModal')) {
    hideModal('imagePreviewModal');
  }
}

async function deleteItem(itemId, itemName) {
  if (!confirm('ลบรายการ "' + itemName + '" ?')) return;
  const r = await callAPI('deleteItem', { itemId });
  if (r.success) { showToast(r.message); loadItems(); }
  else showToast(r.error, 'error');
}

async function distributeItemRewards() {
  const itemId = currentReviewItemId;
  if (!itemId) return;
  const r = await callAPI('distributeItemRewards', { itemId });
  if (r.success) {
    showToast(r.message);
    hideModal('itemReviewModal');
    loadItems();
    loadRewards();
    loadDashboard();
  } else showToast(r.error, 'error');
}

// === GROWTH PAGE ===
let growthData = { sessions: [], history: [] };

async function loadGrowth() {
  const r = await callAPI('getGrowthData');
  if (r.success) {
    growthData = r;
    const filter = document.getElementById('growthMemberFilter');
    const names = [...new Set(r.history.map(h => h.memberName))].sort();
    const currentVal = filter.value;
    filter.innerHTML = '<option value="all">ทุกคน</option>' + names.map(n => '<option value="' + n + '">' + n + '</option>').join('');
    filter.value = currentVal || 'all';
    renderGrowthPage();
  }
}

function analyzeGrowth() {
  const allHistory = (growthData.history || []).filter(h => h.sessionId);
  const sessions = (growthData.sessions || []).filter(s => s.status === 'completed');
  const totalSessions = sessions.length;

  // Build sessionMap
  const sessionMap = {};
  allHistory.forEach(h => {
    if (!sessionMap[h.sessionId]) sessionMap[h.sessionId] = [];
    sessionMap[h.sessionId].push(h);
  });

  // Per-session growth
  const sessionGrowths = sessions.map(s => {
    const entries = sessionMap[s.id] || [];
    const totalGrowth = entries.reduce((sum, e) => sum + ((e.newCP || 0) - (e.oldCP || 0)), 0);
    return { session: s, entries, totalGrowth };
  });

  // Per-member analysis
  const memberMap = {};
  allHistory.forEach(h => {
    if (!memberMap[h.memberName]) memberMap[h.memberName] = { name: h.memberName, entries: [], totalGrowth: 0, sessionsJoined: 0, firstTier: null, lastTier: null, growths: [] };
    const m = memberMap[h.memberName];
    const g = (h.newCP || 0) - (h.oldCP || 0);
    m.entries.push(h);
    m.totalGrowth += g;
    m.sessionsJoined++;
    m.growths.push(g);
    if (!m.firstTier) m.firstTier = h.oldTier || '-';
    m.lastTier = h.newTier || '-';
  });

  // Compute member stats
  const memberStats = Object.values(memberMap).map(m => {
    const avg = m.sessionsJoined > 0 ? Math.round(m.totalGrowth / m.sessionsJoined) : 0;
    // Consistency: standard deviation / mean (lower = more consistent)
    const mean = avg;
    const variance = m.growths.length > 1 ? m.growths.reduce((s, g) => s + Math.pow(g - mean, 2), 0) / m.growths.length : 0;
    const stdDev = Math.sqrt(variance);
    const consistency = mean > 0 ? Math.max(0, Math.round((1 - stdDev / mean) * 100)) : 0;
    // Growth trend: compare last session growth vs first
    const trend = m.growths.length >= 2 ? m.growths[m.growths.length - 1] - m.growths[0] : 0;
    // Tier changes count
    const tierChanges = m.entries.filter(e => e.oldTier !== e.newTier && e.oldTier !== '-').length;
    return { ...m, avg, consistency, trend, tierChanges };
  }).sort((a, b) => b.totalGrowth - a.totalGrowth);

  return { sessionGrowths, memberStats, totalSessions, sessionMap };
}

function renderGrowthPage() {
  const filterName = document.getElementById('growthMemberFilter').value;
  const analysis = analyzeGrowth();
  let { sessionGrowths, memberStats, totalSessions } = analysis;

  // Apply filter to session data
  if (filterName !== 'all') {
    sessionGrowths = sessionGrowths.map(sg => {
      const entries = sg.entries.filter(e => e.memberName === filterName);
      const totalGrowth = entries.reduce((sum, e) => sum + ((e.newCP || 0) - (e.oldCP || 0)), 0);
      return { ...sg, entries, totalGrowth };
    });
  }

  const totalGrowth = sessionGrowths.reduce((s, sg) => s + sg.totalGrowth, 0);
  const avgGrowth = totalSessions > 0 ? Math.round(totalGrowth / totalSessions) : 0;

  // Top grower from full analysis
  const topMember = memberStats.length > 0 ? memberStats[0] : null;
  const topGrower = topMember ? topMember.name : '-';
  const topGrowthVal = topMember ? topMember.totalGrowth : 0;

  // Tier upgrades count
  const tierUpgrades = memberStats.reduce((s, m) => s + m.tierChanges, 0);

  // KPI
  document.getElementById('growthKPI').innerHTML =
    '<div class="kpi-card"><div class="kpi-value">' + totalSessions + '</div><div class="kpi-label">รอบทั้งหมด</div></div>' +
    '<div class="kpi-card"><div class="kpi-value">' + fmt(totalGrowth) + '</div><div class="kpi-label">' + (filterName !== 'all' ? filterName + ' Growth' : 'Growth รวม') + '</div></div>' +
    '<div class="kpi-card"><div class="kpi-value">' + fmt(avgGrowth) + '</div><div class="kpi-label">เฉลี่ย/รอบ</div></div>' +
    '<div class="kpi-card"><div class="kpi-value">' + tierUpgrades + '</div><div class="kpi-label">Tier Upgrades</div></div>';

  renderGrowthChart(sessionGrowths, filterName);
  renderGrowthRanking(memberStats);
  renderGrowthAnalysis(memberStats, totalSessions, sessionGrowths);
}

function renderGrowthChart(sessionGrowths, filterName) {
  if (charts.growth) { charts.growth.destroy(); charts.growth = null; }
  const canvas = document.getElementById('growthChart');
  if (!canvas || sessionGrowths.length === 0) return;
  const labels = sessionGrowths.map((sg, i) => {
    return sg.session.startDate ? new Date(sg.session.startDate).toLocaleDateString('th-TH', { day:'numeric', month:'short' }) : 'รอบ ' + (i + 1);
  });

  if (filterName && filterName !== 'all') {
    // Individual member: line chart showing CP progression
    const cpValues = sessionGrowths.map(sg => {
      const entry = sg.entries[0];
      return entry ? entry.newCP : null;
    }).filter(v => v !== null);
    const filteredLabels = sessionGrowths.filter(sg => sg.entries.length > 0).map((sg, i) => {
      return sg.session.startDate ? new Date(sg.session.startDate).toLocaleDateString('th-TH', { day:'numeric', month:'short' }) : 'รอบ ' + (i + 1);
    });
    charts.growth = new Chart(canvas, {
      type: 'line',
      data: {
        labels: filteredLabels,
        datasets: [{
          label: filterName + ' CP',
          data: cpValues,
          borderColor: 'rgba(155,109,255,1)',
          backgroundColor: 'rgba(155,109,255,0.15)',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: 'rgba(155,109,255,1)'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { color: '#b0a89a' }, grid: { color: 'rgba(255,255,255,0.06)' } },
          x: { ticks: { color: '#b0a89a' }, grid: { display: false } }
        }
      }
    });
  } else {
    // All members: bar chart showing total growth per session
    const data = sessionGrowths.map(sg => sg.totalGrowth);
    const colors = data.map(v => v >= 0 ? 'rgba(46,204,113,0.7)' : 'rgba(231,76,60,0.7)');
    charts.growth = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Growth รวม',
          data,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.7', '1')),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: '#b0a89a' }, grid: { color: 'rgba(255,255,255,0.06)' } },
          x: { ticks: { color: '#b0a89a' }, grid: { display: false } }
        }
      }
    });
  }
}

function renderGrowthRanking(memberStats) {
  const container = document.getElementById('growthRanking');
  if (memberStats.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:16px">ไม่มีข้อมูล</div>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  container.innerHTML = memberStats.slice(0, 10).map((m, i) => {
    const medal = i < 3 ? medals[i] : '<span style="color:var(--text3)">' + (i + 1) + '.</span>';
    const trendIcon = m.trend > 0 ? '<span style="color:var(--green);font-size:.7rem">▲</span>' : m.trend < 0 ? '<span style="color:var(--red);font-size:.7rem">▼</span>' : '<span style="color:var(--text3);font-size:.7rem">━</span>';
    const consistColor = m.consistency >= 70 ? 'var(--green)' : m.consistency >= 40 ? 'var(--yellow)' : 'var(--red)';
    return '<div class="rank-row" style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">' +
      '<div style="display:flex;align-items:center;gap:8px">' + medal + ' <span style="font-weight:600">' + m.name + '</span> ' + trendIcon + '</div>' +
      '<div style="text-align:right"><span style="color:var(--green);font-weight:700">+' + fmt(m.totalGrowth) + '</span> <span style="font-size:.65rem;color:' + consistColor + ';margin-left:4px" title="ความสม่ำเสมอ">' + m.consistency + '%</span></div>' +
      '</div>';
  }).join('');
}

function renderGrowthAnalysis(memberStats, totalSessions, sessionGrowths) {
  const thead = document.getElementById('growthAnalysisHead');
  const tbody = document.getElementById('growthAnalysisTable');

  // Take last 4 sessions (most recent last), display columns right = newest
  const recentSessions = sessionGrowths.slice(-4);
  const colCount = 5 + recentSessions.length;

  if (memberStats.length === 0) {
    thead.innerHTML = '<tr><th>ชื่อ</th><th>Growth รวม</th><th>เฉลี่ย/รอบ</th><th>Tier</th><th>สถานะ</th></tr>';
    tbody.innerHTML = '<tr><td colspan="' + colCount + '" style="text-align:center;color:var(--text3)">ไม่มีข้อมูล</td></tr>';
    return;
  }

  // Build session column headers (oldest → newest, left → right)
  const sessionHeaders = recentSessions.map(sg => {
    const d = sg.session.startDate
      ? new Date(sg.session.startDate).toLocaleDateString('th-TH', { day:'numeric', month:'short' })
      : '?';
    return '<th style="text-align:center;font-size:.72rem;white-space:nowrap">' + d + '</th>';
  }).join('');

  thead.innerHTML = '<tr><th>ชื่อ</th>' + sessionHeaders + '<th>Growth รวม</th><th>เฉลี่ย/รอบ</th><th>Tier</th><th>สถานะ</th></tr>';

  // Build per-member lookup: sessionId → growth for this member
  tbody.innerHTML = memberStats.map(m => {
    const memberGrowthBySession = {};
    m.entries.forEach(e => {
      if (e.sessionId) memberGrowthBySession[e.sessionId] = {
        growth: (e.newCP || 0) - (e.oldCP || 0),
        oldTier: e.oldTier,
        newTier: e.newTier
      };
    });

    // Session columns
    const sessionCells = recentSessions.map(sg => {
      const info = memberGrowthBySession[sg.session.id];
      if (!info) return '<td style="text-align:center;color:var(--text3)">-</td>';
      const g = info.growth;
      const tierUp = info.oldTier !== info.newTier && info.oldTier !== '-';
      const tierIcon = tierUp ? ' <span style="font-size:.6rem" title="' + info.oldTier + '→' + info.newTier + '">⬆</span>' : '';
      const color = g > 0 ? 'var(--green)' : g < 0 ? 'var(--red)' : 'var(--text3)';
      return '<td style="text-align:center;color:' + color + ';font-weight:600;font-size:.8rem">' + (g > 0 ? '+' : '') + fmt(g) + tierIcon + '</td>';
    }).join('');

    // Trend icon
    const trendIcon = m.trend > 0 ? ' <span style="color:var(--green)">▲</span>' : m.trend < 0 ? ' <span style="color:var(--red)">▼</span>' : '';

    // Tier
    const tierChanged = m.firstTier !== m.lastTier;
    const tierStr = tierChanged
      ? '<span style="color:var(--text3)">' + m.firstTier + '</span> → <span style="font-weight:600;color:' + getTierColor(m.lastTier) + '">' + m.lastTier + '</span>'
      : '<span style="color:' + getTierColor(m.lastTier) + '">' + m.lastTier + '</span>';

    // Status
    let statusBadge = '';
    if (m.consistency >= 70) statusBadge = '<span style="font-size:.68rem;padding:2px 6px;border-radius:2px;background:rgba(46,204,113,.15);color:var(--green)">สม่ำเสมอ</span>';
    else if (m.consistency >= 40) statusBadge = '<span style="font-size:.68rem;padding:2px 6px;border-radius:2px;background:rgba(241,196,15,.15);color:var(--yellow)">ปานกลาง</span>';
    else statusBadge = '<span style="font-size:.68rem;padding:2px 6px;border-radius:2px;background:rgba(231,76,60,.15);color:var(--red)">ไม่สม่ำเสมอ</span>';
    if (m.sessionsJoined < totalSessions) statusBadge += ' <span style="font-size:.68rem;padding:2px 6px;border-radius:2px;background:rgba(93,173,226,.15);color:var(--cyan)">ขาด ' + (totalSessions - m.sessionsJoined) + ' รอบ</span>';

    return '<tr><td style="font-weight:600">' + m.name + '</td>' +
      sessionCells +
      '<td style="color:var(--green);font-weight:700">+' + fmt(m.totalGrowth) + trendIcon + '</td>' +
      '<td>+' + fmt(m.avg) + '</td>' +
      '<td>' + tierStr + '</td>' +
      '<td>' + statusBadge + '</td></tr>';
  }).join('');
}

// === REMEMBER ME ===
function loadRememberedCredentials() {
  const remembered = localStorage.getItem('cpRemember');
  if (remembered) {
    try {
      const cred = JSON.parse(remembered);
      document.getElementById('loginUser').value = cred.username || '';
      document.getElementById('loginPass').value = cred.password || '';
      document.getElementById('rememberMe').checked = true;
    } catch { /* ignore */ }
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
  } else {
    // Restore remembered credentials on login page
    loadRememberedCredentials();
  }
  // Enter key support for login
  document.querySelectorAll('#loginFields input').forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });
  // Enter key support for register
  document.querySelectorAll('#registerFields input').forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
  });
  // Global Enter key: input inside a container with a submit button triggers click
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    const el = e.target;
    if (el.tagName !== 'INPUT' || el.type === 'checkbox' || el.type === 'file') return;
    // Skip login/register (already handled above)
    if (el.closest('#loginFields') || el.closest('#registerFields')) return;
    // Skip search/filter inputs
    if (el.id === 'memberSearch') return;
    e.preventDefault();
    // Find the nearest card, modal, or toolbar that contains a primary/submit button
    const container = el.closest('.card') || el.closest('.modal') || el.closest('.toolbar');
    if (!container) return;
    const btn = container.querySelector('.btn-primary:not(:disabled)') || container.querySelector('.btn-success:not(:disabled)');
    if (btn) btn.click();
  });
})();
