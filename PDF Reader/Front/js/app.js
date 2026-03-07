import { getPageTextItems, detectLayout, extractPageRows, mergeMultiLineRows, splitNoAndName, filterDataRows } from './pdf-processor.js';
import { renderTable, showSummary, showDebug, appendDebug, updateProgress, exportCSV } from './ui-renderer.js';
import { selectRow, renderPdfPage, renderValidationPanel, renderColLegend } from './verification.js';

// ---- PDF.js Setup ----
await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs');
const pdfjsLib = globalThis.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs';

// ---- Base Path ----
const B = window.location.pathname.replace(/\/(index\.html)?$/, '');

// ---- State ----
const ctx = {
  allRows: [],
  currentPage: 1,
  pdfDoc: null,
  detectedLayout: null,
  grandTotalRow: null,
  selectedRowIndex: -1,
  currentPdfPage: 1,
  validationCache: null,
  lastFile: null,
  PAGE_SIZE: 100,
  RENDER_SCALE: 1.5,
  dom: {}
};

// ---- DOM References ----
const $ = id => document.getElementById(id);
const dom = ctx.dom;
dom.uploadZone = $('uploadZone');
dom.fileInput = $('fileInput');
dom.progressSection = $('progressSection');
dom.progressLabel = $('progressLabel');
dom.progressFill = $('progressFill');
dom.progressText = $('progressText');
dom.summarySection = $('summarySection');
dom.sumTotal = $('sumTotal');
dom.sumAmount = $('sumAmount');
dom.sumSuccess = $('sumSuccess');
dom.sumFail = $('sumFail');
dom.sumPages = $('sumPages');
dom.tableSection = $('tableSection');
dom.tableBody = $('tableBody');
dom.debugSection = $('debugSection');
dom.debugPre = $('debugPre');
dom.debugInfo = $('debugInfo');
dom.verifySection = $('verifySection');
dom.pdfCanvas = $('pdfCanvas');
dom.overlayCanvas = $('overlayCanvas');
dom.pdfCanvasWrap = $('pdfCanvasWrap');
dom.pageInfo = $('pageInfo');
dom.pageBtns = $('pageBtns');
dom.pdfPageLabel = $('pdfPageLabel');
dom.colLegend = $('colLegend');
dom.validationBody = $('validationBody');
dom.validationCount = $('validationCount');
dom.rowDetailBody = $('rowDetailBody');
dom.rowDetailLabel = $('rowDetailLabel');

// ---- Register cross-module callbacks on ctx ----
ctx.renderTable = () => renderTable(ctx);
ctx.selectRow = (idx) => selectRow(ctx, idx);

// ---- 401 Fetch Interceptor ----
const _originalFetch = window.fetch;
window.fetch = async function (...args) {
  const res = await _originalFetch.apply(this, args);
  if (res.status === 401) {
    window.location.href = B + '/login.html';
  }
  return res;
};

// ---- Logout ----
$('btnLogout').addEventListener('click', async () => {
  await fetch(B + '/api/auth/logout', { method: 'POST' });
  window.location.href = B + '/login.html';
});

// ---- User Info + Admin Panel ----
(async () => {
  try {
    const res = await _originalFetch(B + '/api/auth/me');
    if (!res.ok) return;
    const { user } = await res.json();
    $('userBadge').textContent = user.display_name || user.username;
    if (user.role === 'admin') {
      $('btnAdmin').style.display = '';
    }
  } catch {}
})();

// Admin modal
$('btnAdmin').addEventListener('click', () => {
  $('adminModal').classList.add('active');
  loadLogs(0);
});
$('adminClose').addEventListener('click', () => {
  $('adminModal').classList.remove('active');
});
$('adminModal').addEventListener('click', (e) => {
  if (e.target === $('adminModal')) $('adminModal').classList.remove('active');
});

// Tab switching
document.querySelectorAll('.modal-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $('tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)).classList.add('active');
    if (tab.dataset.tab === 'users') loadUsers();
    if (tab.dataset.tab === 'logs') loadLogs(0);
  });
});

// Login Logs
let logsOffset = 0;
const LOGS_LIMIT = 50;

async function loadLogs(offset) {
  logsOffset = offset;
  try {
    const res = await fetch(`${B}/api/auth/logs?limit=${LOGS_LIMIT}&offset=${offset}`);
    const data = await res.json();
    const tbody = $('logsBody');
    tbody.innerHTML = '';
    for (const log of data.logs) {
      const tr = document.createElement('tr');
      const time = new Date(log.created_at + 'Z').toLocaleString('th-TH');
      tr.innerHTML = `
        <td>${time}</td>
        <td><strong>${esc(log.username)}</strong></td>
        <td class="${log.success ? 'status-ok' : 'status-fail'}">${log.success ? 'Success' : 'Failed'}</td>
        <td>${esc(log.ip_address || '-')}</td>
        <td class="ua-cell" title="${esc(log.user_agent || '')}">${esc(log.user_agent || '-')}</td>
      `;
      tbody.appendChild(tr);
    }
    $('logsInfo').textContent = `${offset + 1}-${Math.min(offset + LOGS_LIMIT, data.total)} of ${data.total}`;
    $('logsPrev').disabled = offset === 0;
    $('logsNext').disabled = offset + LOGS_LIMIT >= data.total;
  } catch {}
}

$('logsPrev').addEventListener('click', () => loadLogs(Math.max(0, logsOffset - LOGS_LIMIT)));
$('logsNext').addEventListener('click', () => loadLogs(logsOffset + LOGS_LIMIT));

// Users management
async function loadUsers() {
  try {
    const res = await fetch(B + '/api/auth/users');
    const data = await res.json();
    const tbody = $('usersBody');
    tbody.innerHTML = '';
    for (const u of data.users) {
      const tr = document.createElement('tr');
      const time = new Date(u.created_at + 'Z').toLocaleString('th-TH');
      tr.innerHTML = `
        <td>${u.id}</td>
        <td><strong>${esc(u.username)}</strong></td>
        <td>${esc(u.display_name || '-')}</td>
        <td class="${u.role === 'admin' ? 'role-admin' : ''}">${esc(u.role)}</td>
        <td>${time}</td>
        <td></td>
      `;
      const td = tr.lastElementChild;
      const btn = document.createElement('button');
      btn.className = 'btn-reset-pw';
      btn.textContent = 'Reset Password';
      btn.addEventListener('click', async () => {
        const newPw = prompt(`Reset password for "${u.username}" to:`);
        if (!newPw) return;
        if (newPw.length < 4) { alert('Password must be at least 4 characters'); return; }
        const r = await fetch(B + '/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: u.id, newPassword: newPw })
        });
        const d = await r.json();
        if (d.ok) { alert('Password reset successfully'); }
        else { alert(d.error || 'Failed'); }
      });
      td.appendChild(btn);
      tbody.appendChild(tr);
    }
  } catch {}
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---- Events ----
$('debugToggle').addEventListener('click', () => {
  const c = $('debugContent');
  c.style.display = c.style.display === 'none' ? '' : 'none';
});

dom.uploadZone.addEventListener('click', () => dom.fileInput.click());
dom.fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

dom.uploadZone.addEventListener('dragover', e => { e.preventDefault(); dom.uploadZone.classList.add('dragover'); });
dom.uploadZone.addEventListener('dragleave', () => dom.uploadZone.classList.remove('dragover'));
dom.uploadZone.addEventListener('drop', e => {
  e.preventDefault(); dom.uploadZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') handleFile(f);
});

$('btnReset').addEventListener('click', () => {
  ctx.allRows = []; ctx.currentPage = 1; dom.fileInput.value = '';
  ctx.pdfDoc = null; ctx.detectedLayout = null; ctx.grandTotalRow = null;
  ctx.selectedRowIndex = -1; ctx.validationCache = null;
  ctx.lastFile = null; ctx.currentPdfPage = 1;
  dom.uploadZone.style.display = '';
  $('btnVerify').style.display = 'none';
  $('btnRefresh').style.display = 'none';
  [dom.progressSection, dom.summarySection, dom.tableSection, dom.debugSection, dom.verifySection].forEach(s => s.classList.remove('active'));
});

$('btnRefresh').addEventListener('click', () => {
  if (ctx.lastFile) handleFile(ctx.lastFile);
});

$('btnVerify').addEventListener('click', () => {
  const isActive = dom.verifySection.classList.contains('active');
  if (isActive) {
    dom.verifySection.classList.remove('active');
  } else {
    dom.verifySection.classList.add('active');
    renderValidationPanel(ctx);
    renderColLegend(ctx);
    if (ctx.selectedRowIndex >= 0) selectRow(ctx, ctx.selectedRowIndex);
  }
});

$('btnExport').addEventListener('click', () => exportCSV(ctx.allRows));

$('pdfPrev').addEventListener('click', () => {
  if (ctx.currentPdfPage > 1) { ctx.currentPdfPage--; renderPdfPage(ctx, ctx.currentPdfPage); }
});
$('pdfNext').addEventListener('click', () => {
  if (ctx.pdfDoc && ctx.currentPdfPage < ctx.pdfDoc.numPages) { ctx.currentPdfPage++; renderPdfPage(ctx, ctx.currentPdfPage); }
});

document.addEventListener('keydown', e => {
  if (!dom.verifySection.classList.contains('active')) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); $('pdfPrev').click(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); $('pdfNext').click(); }
  else if (e.key === 'ArrowUp' && ctx.selectedRowIndex > 0) { e.preventDefault(); selectRow(ctx, ctx.selectedRowIndex - 1); }
  else if (e.key === 'ArrowDown' && ctx.selectedRowIndex < ctx.allRows.length - 1) { e.preventDefault(); selectRow(ctx, ctx.selectedRowIndex + 1); }
});

// ---- Helpers ----
function showResetOption() {
  const card = dom.progressSection.querySelector('.progress-card');
  if (card && !card.querySelector('.btn-back')) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-back';
    btn.textContent = '← กลับหน้าอัปโหลด';
    btn.style.marginTop = '12px';
    btn.addEventListener('click', () => $('btnReset').click());
    card.appendChild(btn);
  }
}

let processing = false;

// ---- Main Flow ----
async function handleFile(file) {
  if (processing) return;
  processing = true;
  ctx.lastFile = file;
  ctx.currentPdfPage = 1;
  dom.uploadZone.style.display = 'none';
  dom.progressSection.classList.add('active');
  [dom.summarySection, dom.tableSection, dom.debugSection, dom.verifySection].forEach(s => s.classList.remove('active'));
  $('btnRefresh').disabled = true;
  ctx.allRows = [];
  // Remove any leftover back button from previous error
  const oldBtn = dom.progressSection.querySelector('.btn-back');
  if (oldBtn) oldBtn.remove();

  try {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    ctx.pdfDoc = pdf;
    const totalPages = pdf.numPages;
    updateProgress(0, totalPages, dom);
    ctx.grandTotalRow = null;
    ctx.validationCache = null;

    const p1Items = await getPageTextItems(pdf, 1);
    showDebug(p1Items, totalPages, dom);

    let layout = detectLayout(p1Items);
    for (let tryPage = 2; !layout && tryPage <= Math.min(5, totalPages); tryPage++) {
      layout = detectLayout(await getPageTextItems(pdf, tryPage));
    }
    if (!layout) {
      dom.progressLabel.textContent = 'ไม่พบ header ของตาราง — ตรวจสอบ Debug panel';
      dom.debugSection.classList.add('active');
      showResetOption();
      return;
    }
    ctx.detectedLayout = layout;

    appendDebug(`\nLayout: ${layout.columns.length} cols detected, dataStartY=${layout.dataStartY.toFixed(1)}`, dom);
    appendDebug('Columns: ' + layout.columns.map(c => `${c.key}[${c.start.toFixed(0)}-${c.end.toFixed(0)}]`).join(' | '), dom);

    for (let p = 1; p <= totalPages; p++) {
      const items = p === 1 ? p1Items : await getPageTextItems(pdf, p);
      const rows = extractPageRows(items, layout, p, ctx);
      ctx.allRows.push(...rows);
      updateProgress(p, totalPages, dom);
      if (p % 10 === 0) await new Promise(r => setTimeout(r, 0));
    }

    appendDebug(`\nRaw rows: ${ctx.allRows.length}`, dom);
    ctx.allRows = mergeMultiLineRows(ctx.allRows);
    ctx.allRows = splitNoAndName(ctx.allRows);
    ctx.allRows = filterDataRows(ctx.allRows);
    appendDebug(`After merge+filter: ${ctx.allRows.length}`, dom);

    dom.progressSection.classList.remove('active');
    showSummary(ctx.allRows, totalPages, dom);
    ctx.currentPage = 1;
    renderTable(ctx);
    dom.tableSection.classList.add('active');
    $('btnVerify').style.display = '';
    $('btnRefresh').style.display = '';
    $('btnRefresh').disabled = false;
  } catch (err) {
    dom.progressLabel.textContent = 'Error: ' + err.message;
    console.error(err);
    showResetOption();
  } finally {
    processing = false;
  }
}
