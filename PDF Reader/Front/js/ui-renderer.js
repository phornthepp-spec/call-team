import { COL_KEYS, groupByY } from './pdf-processor.js';

// ---- Utilities ----
export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function parseNum(s) {
  if (!s) return 0;
  let cleaned = s.trim();
  // "- 10,000.00" or "- " means separator/nil, not negative — strip leading dash+space
  if (/^-\s/.test(cleaned)) cleaned = cleaned.replace(/^-\s+/, '');
  if (cleaned === '-') return 0;
  const n = parseFloat(cleaned.replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

export function csvQ(s) {
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ---- Progress ----
export function updateProgress(cur, total, dom) {
  const pct = total > 0 ? Math.round((cur / total) * 100) : 0;
  dom.progressFill.style.width = pct + '%';
  dom.progressText.textContent = pct + '%';
  dom.progressLabel.textContent = cur >= total ? 'ประมวลผลเสร็จสิ้น' : `กำลังประมวลผลหน้า ${cur}/${total}`;
}

// ---- Summary ----
export function showSummary(rows, totalPages, dom) {
  dom.sumTotal.textContent = rows.length.toLocaleString();
  dom.sumPages.textContent = totalPages;

  let totalAmt = 0, success = 0, fail = 0;
  for (const r of rows) {
    totalAmt += parseNum(r.paidAmt || r.totalAmt || '0');
    const st = (r.status || '').toLowerCase();
    if (st.includes('success') || st.includes('สำเร็จ')) success++;
    else if (st.trim()) fail++;
  }

  dom.sumAmount.textContent = totalAmt.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  dom.sumSuccess.textContent = success.toLocaleString();
  dom.sumFail.textContent = fail.toLocaleString();
  dom.summarySection.classList.add('active');
}

// ---- Table + Pagination ----
export function renderTable(ctx) {
  const { allRows, currentPage, PAGE_SIZE, selectedRowIndex, dom } = ctx;
  const totalPg = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  ctx.currentPage = Math.max(1, Math.min(currentPage, totalPg));
  const start = (ctx.currentPage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, allRows.length);
  const slice = allRows.slice(start, end);
  const numCols = new Set(['totalAmt','invoiceAmt','vat','wht','paidAmt','fee']);

  let html = '';
  if (slice.length === 0) {
    html = `<tr><td colspan="${COL_KEYS.length}" style="text-align:center;color:var(--text3);padding:20px">ไม่พบข้อมูล — ตรวจสอบ Debug panel ด้านบน</td></tr>`;
  } else {
    for (let i = 0; i < slice.length; i++) {
      const row = slice[i];
      const globalIdx = start + i;
      const activeClass = globalIdx === selectedRowIndex ? ' class="row-active"' : '';
      html += `<tr data-row-idx="${globalIdx}"${activeClass}>`;
      for (const key of COL_KEYS) {
        const val = row[key] || '';
        let cls = '';
        if (numCols.has(key)) cls = ' class="num"';
        if (key === 'status') {
          const st = val.toLowerCase();
          if (st.includes('success') || st.includes('สำเร็จ')) cls = ' class="status-success"';
          else if (val.trim()) cls = ' class="status-fail"';
        }
        html += `<td${cls}>${esc(val)}</td>`;
      }
      html += '</tr>';
    }
  }
  dom.tableBody.innerHTML = html;

  // Add click handlers for row selection
  dom.tableBody.querySelectorAll('tr[data-row-idx]').forEach(tr => {
    tr.addEventListener('click', () => ctx.selectRow(parseInt(tr.dataset.rowIdx)));
  });

  dom.pageInfo.textContent = allRows.length > 0
    ? `แสดง ${start+1}-${end} จาก ${allRows.length} รายการ` : 'ไม่พบข้อมูล';

  // Pagination buttons
  if (totalPg <= 1 && allRows.length === 0) { dom.pageBtns.innerHTML = ''; return; }
  let bh = `<button class="page-btn" ${ctx.currentPage<=1?'disabled':''} data-p="${ctx.currentPage-1}">&lt;</button>`;
  let sp = Math.max(1, ctx.currentPage - 3), ep = Math.min(totalPg, sp + 6);
  if (ep - sp < 6) sp = Math.max(1, ep - 6);
  for (let p = sp; p <= ep; p++) bh += `<button class="page-btn ${p===ctx.currentPage?'active':''}" data-p="${p}">${p}</button>`;
  bh += `<button class="page-btn" ${ctx.currentPage>=totalPg?'disabled':''} data-p="${ctx.currentPage+1}">&gt;</button>`;
  dom.pageBtns.innerHTML = bh;
  dom.pageBtns.querySelectorAll('.page-btn').forEach(b => b.addEventListener('click', () => {
    const p = parseInt(b.dataset.p);
    if (p >= 1 && p <= totalPg) { ctx.currentPage = p; renderTable(ctx); }
  }));
}

// ---- Debug ----
export function showDebug(items, totalPages, dom) {
  dom.debugSection.classList.add('active');
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  const yGroups = groupByY(sorted, 4);
  let summary = '=== Y-GROUP SUMMARY (text per row) ===\n';
  for (const g of yGroups) {
    const texts = g.items.sort((a,b) => a.x - b.x).map(i => i.str).join(' | ');
    summary += `y:${g.y.toFixed(1).padStart(7)}  [${g.items.length} items]  ${texts}\n`;
  }
  summary += '\n=== RAW ITEMS ===\n';

  let lines = [], lastY = -1;
  for (const it of sorted) {
    if (lastY >= 0 && Math.abs(it.y - lastY) > 3) lines.push('---');
    lines.push(`y:${it.y.toFixed(1).padStart(7)} x:${it.x.toFixed(1).padStart(7)} w:${(it.w||0).toFixed(1).padStart(6)} fs:${it.fontSize.toFixed(1)} | "${it.str}"`);
    lastY = it.y;
  }
  dom.debugInfo.textContent = `Page 1: ${items.length} items | Pages: ${totalPages}`;
  dom.debugPre.textContent = summary + lines.join('\n');
}

export function appendDebug(text, dom) {
  dom.debugInfo.textContent += text;
}

// ---- CSV Export ----
export function exportCSV(allRows) {
  if (allRows.length === 0) { alert('ไม่มีข้อมูลสำหรับ export'); return; }
  const headers = ['เลขที่','ชื่อผู้รับเงิน','บัญชี/พร้อมเพย์','รหัส/สาขา','จำนวนเงินทั้งหมด','จำนวนเงินใบแจ้งหนี้','ภาษีมูลค่าเพิ่ม','ภาษีหัก ณ ที่จ่าย','เงินที่จ่ายทั้งหมด','ค่าธรรมเนียม','สถานะ','เหตุผล'];
  let csv = '\uFEFF' + headers.map(csvQ).join(',') + '\n';
  for (const row of allRows) csv += COL_KEYS.map(k => csvQ(row[k] || '')).join(',') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'scb-payment-report.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
