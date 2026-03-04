var SHEET_ID = '11WHnqFbA1Us2dNSIkucYEd-pgbSyPEb4u39YNtor6jY';
var SHEET_NAME = 'Summary';

function getSheet_() {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
}

// ============ REST API ============

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  var result;

  try {
    switch (action) {
      case 'getAttendees':
        result = { success: true, data: getAttendees() };
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  return jsonResponse_(result);
}

function doPost(e) {
  var result;

  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || '';

    switch (action) {
      case 'checkIn':
        result = checkIn_(body.rowNum, body.tableNo);
        break;
      case 'undoCheckIn':
        result = undoCheckIn_(body.rowNum);
        break;
      case 'setTableNo':
        result = setTableNo_(body.rowNum, body.tableNo);
        break;
      case 'setMemberId':
        result = setMemberId_(body.rowNum, body.memberId);
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  return jsonResponse_(result);
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ Data Functions ============

function getAttendees() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
  var attendees = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    // Skip only if both name (D) and phone (E) are empty
    if ((!row[3] || String(row[3]).trim() === '') && (!row[4] || String(row[4]).trim() === '')) continue;

    var checkinTimeRaw = row[14];
    var checkinTimeStr = '';
    if (checkinTimeRaw) {
      try {
        checkinTimeStr = Utilities.formatDate(new Date(checkinTimeRaw), 'Asia/Bangkok', 'HH:mm:ss');
      } catch(e) {
        checkinTimeStr = String(checkinTimeRaw);
      }
    }

    attendees.push({
      rowNum: i + 2,
      order: row[0],                    // A: ลำดับ
      memberId: String(row[1]),          // B: รหัสสมาชิก
      channel: String(row[2]),           // C: ช่องทาง
      name: String(row[3]),              // D: ชื่อนามสกุล
      phone: String(row[4]),             // E: เบอร์โทร
      type: String(row[5]),              // F: ผู้สมัคร/ผู้ติดตาม
      callStatus: String(row[6]),        // G
      confirmed: String(row[7]),         // H
      shirtSize: String(row[8]),         // I
      visited: String(row[10]),          // K
      note: String(row[11]),             // L
      checkinStatus: String(row[13]),    // N: สถานะเช็คอิน
      checkinTime: checkinTimeStr,       // O: เวลาเช็คอิน
      tableNo: String(row[15])           // P: โต๊ะ
    });
  }

  return attendees;
}

function checkIn_(rowNum, tableNo) {
  var sheet = getSheet_();
  var now = new Date();
  sheet.getRange(rowNum, 14).setValue('เช็คอินแล้ว');
  sheet.getRange(rowNum, 15).setValue(now);
  if (tableNo) {
    sheet.getRange(rowNum, 16).setValue(tableNo);
  }
  SpreadsheetApp.flush();
  return {
    success: true,
    time: Utilities.formatDate(now, 'Asia/Bangkok', 'HH:mm:ss')
  };
}

function undoCheckIn_(rowNum) {
  var sheet = getSheet_();
  sheet.getRange(rowNum, 14).setValue('');
  sheet.getRange(rowNum, 15).setValue('');
  sheet.getRange(rowNum, 16).setValue('');
  SpreadsheetApp.flush();
  return { success: true };
}

function setTableNo_(rowNum, tableNo) {
  var sheet = getSheet_();
  sheet.getRange(rowNum, 16).setValue(tableNo);
  SpreadsheetApp.flush();
  return { success: true };
}

function setMemberId_(rowNum, memberId) {
  var sheet = getSheet_();
  sheet.getRange(rowNum, 2).setValue(memberId);  // B: รหัสสมาชิก
  SpreadsheetApp.flush();
  return { success: true };
}

// ============ Setup ============

function setupHeaders() {
  var sheet = getSheet_();
  sheet.getRange(1, 14).setValue('สถานะเช็คอิน');
  sheet.getRange(1, 15).setValue('เวลาเช็คอิน');
  sheet.getRange(1, 16).setValue('โต๊ะ');
}
