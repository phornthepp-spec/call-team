import { COL_KEYS, COL_COLORS } from './pdf-processor.js';
import { esc, parseNum } from './ui-renderer.js';

// ---- Row Selection ----
export function selectRow(ctx, idx) {
  const { allRows, dom } = ctx;
  if (idx < 0 || idx >= allRows.length) return;
  ctx.selectedRowIndex = idx;

  // Highlight row in table
  dom.tableBody.querySelectorAll('tr.row-active').forEach(tr => tr.classList.remove('row-active'));
  const targetTr = dom.tableBody.querySelector(`tr[data-row-idx="${idx}"]`);
  if (targetTr) {
    targetTr.classList.add('row-active');
    targetTr.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else {
    ctx.currentPage = Math.floor(idx / ctx.PAGE_SIZE) + 1;
    ctx.renderTable();
  }

  // Show verification section if not visible
  if (!dom.verifySection.classList.contains('active')) {
    dom.verifySection.classList.add('active');
    renderValidationPanel(ctx);
    renderColLegend(ctx);
  }

  // Render PDF page and detail
  const row = allRows[idx];
  if (row._meta && ctx.pdfDoc) {
    ctx.currentPdfPage = row._meta.pageNum;
    renderPdfPage(ctx, ctx.currentPdfPage).then(() => drawRowHighlights(ctx, idx));
  }
  renderRowDetail(ctx, idx);
}

// ---- PDF Rendering ----
export async function renderPdfPage(ctx, pageNum) {
  const { pdfDoc, RENDER_SCALE, detectedLayout, dom } = ctx;
  if (!pdfDoc) return;
  pageNum = Math.max(1, Math.min(pageNum, pdfDoc.numPages));
  ctx.currentPdfPage = pageNum;
  dom.pdfPageLabel.textContent = `${pageNum} / ${pdfDoc.numPages}`;

  const page = await pdfDoc.getPage(pageNum);
  const vp = page.getViewport({ scale: RENDER_SCALE });

  dom.pdfCanvas.width = vp.width;
  dom.pdfCanvas.height = vp.height;
  dom.overlayCanvas.width = vp.width;
  dom.overlayCanvas.height = vp.height;

  const canvasCtx = dom.pdfCanvas.getContext('2d');
  await page.render({ canvasContext: canvasCtx, viewport: vp }).promise;

  // Draw column boundary lines
  if (detectedLayout) {
    const octx = dom.overlayCanvas.getContext('2d');
    octx.clearRect(0, 0, dom.overlayCanvas.width, dom.overlayCanvas.height);
    octx.setLineDash([4, 4]);
    octx.lineWidth = 0.5;
    octx.strokeStyle = 'rgba(255,255,255,.15)';
    for (const col of detectedLayout.columns) {
      if (col.start > 0) {
        const x = col.start * RENDER_SCALE;
        octx.beginPath(); octx.moveTo(x, 0); octx.lineTo(x, vp.height); octx.stroke();
      }
    }
    octx.setLineDash([]);
  }
}

// ---- Row Highlights ----
export function drawRowHighlights(ctx, rowIndex) {
  const { allRows, RENDER_SCALE, detectedLayout, dom } = ctx;
  const row = allRows[rowIndex];
  if (!row || !row._meta) return;

  const octx = dom.overlayCanvas.getContext('2d');
  octx.clearRect(0, 0, dom.overlayCanvas.width, dom.overlayCanvas.height);

  if (detectedLayout) {
    octx.setLineDash([4, 4]);
    octx.lineWidth = 0.5;
    octx.strokeStyle = 'rgba(255,255,255,.15)';
    for (const col of detectedLayout.columns) {
      if (col.start > 0) {
        const x = col.start * RENDER_SCALE;
        octx.beginPath(); octx.moveTo(x, 0); octx.lineTo(x, dom.overlayCanvas.height); octx.stroke();
      }
    }
    octx.setLineDash([]);
  }

  for (const item of row._meta.rawItems) {
    const color = COL_COLORS[item.assignedCol] || '#ffffff';
    const fs = (item.fontSize || 10) * RENDER_SCALE;
    const x = item.x * RENDER_SCALE;
    const y = (item.y - item.fontSize) * RENDER_SCALE;
    const w = Math.max((item.w || item.str.length * item.fontSize * 0.5) * RENDER_SCALE, 10);
    const h = fs * 1.3;

    octx.fillStyle = color + '30';
    octx.fillRect(x, y, w, h);
    octx.strokeStyle = color + '80';
    octx.lineWidth = 1;
    octx.strokeRect(x, y, w, h);
  }

  const minY = Math.min(...row._meta.rawItems.map(i => i.y)) * RENDER_SCALE;
  dom.pdfCanvasWrap.scrollTop = Math.max(0, minY - 100);
}

// ---- Column Legend ----
export function renderColLegend(ctx) {
  const { detectedLayout, dom } = ctx;
  if (!detectedLayout) { dom.colLegend.innerHTML = ''; return; }
  dom.colLegend.innerHTML = detectedLayout.columns.map(col => {
    const color = COL_COLORS[col.key] || '#94a3b8';
    return `<span class="col-legend-item" style="background:${color}20;color:${color}">${col.key}</span>`;
  }).join('');
}

// ---- Validation ----
export function runValidation(ctx) {
  if (ctx.validationCache) return ctx.validationCache;
  const { allRows, grandTotalRow } = ctx;
  const issues = [];

  // 1. Check sequence numbers
  const nums = [];
  for (let i = 0; i < allRows.length; i++) {
    const n = parseInt((allRows[i].no || '').trim());
    if (!isNaN(n)) nums.push({ n, idx: i });
  }
  nums.sort((a, b) => a.n - b.n);
  for (let i = 1; i < nums.length; i++) {
    const gap = nums[i].n - nums[i - 1].n;
    if (gap > 1) {
      for (let g = nums[i - 1].n + 1; g < nums[i].n; g++) {
        issues.push({ type: 'error', msg: `ลำดับ #${g} หายไป (ระหว่าง #${nums[i-1].n} และ #${nums[i].n})`, rowIdx: nums[i].idx, cat: 'sequence' });
      }
    }
    if (gap === 0) {
      issues.push({ type: 'warn', msg: `ลำดับ #${nums[i].n} ซ้ำ`, rowIdx: nums[i].idx, cat: 'sequence' });
    }
  }

  // 2. Check grand total
  if (grandTotalRow) {
    const gtAmt = parseNum(grandTotalRow.paidAmt || grandTotalRow.totalAmt || '0');
    let sumAmt = 0;
    for (const r of allRows) sumAmt += parseNum(r.paidAmt || r.totalAmt || '0');
    const diff = Math.abs(gtAmt - sumAmt);
    if (gtAmt > 0 && diff > 0.5) {
      issues.push({ type: 'error', msg: `ยอดรวมไม่ตรง: Grand Total = ${gtAmt.toLocaleString('th-TH',{minimumFractionDigits:2})} vs Sum = ${sumAmt.toLocaleString('th-TH',{minimumFractionDigits:2})} (ต่าง ${diff.toLocaleString('th-TH',{minimumFractionDigits:2})})`, rowIdx: -1, cat: 'total' });
    } else if (gtAmt > 0) {
      issues.push({ type: 'info', msg: `ยอดรวมถูกต้อง: ${gtAmt.toLocaleString('th-TH',{minimumFractionDigits:2})}`, rowIdx: -1, cat: 'total' });
    }
  }

  // 3. Check column quality
  for (let i = 0; i < allRows.length; i++) {
    const r = allRows[i];
    if ((r.paidAmt || '').includes('-') && !/^\d/.test((r.paidAmt||'').trim())) {
      issues.push({ type: 'warn', msg: `paidAmt มี "-": "${r.paidAmt}"`, rowIdx: i, cat: 'quality' });
    }
    if ((r.fee || '').trim() && !/^[\d,.\-\s]+$/.test((r.fee||'').trim())) {
      issues.push({ type: 'warn', msg: `fee มีข้อความปน: "${r.fee}"`, rowIdx: i, cat: 'quality' });
    }
    if (!(r.status || '').trim() && (r.paidAmt || r.totalAmt || '').trim()) {
      issues.push({ type: 'warn', msg: `status ว่างเปล่า`, rowIdx: i, cat: 'quality' });
    }
  }

  // 4. Check distance
  for (let i = 0; i < allRows.length; i++) {
    const meta = allRows[i]._meta;
    if (!meta) continue;
    for (const item of meta.rawItems) {
      if (item.distance > 80 && item.assignedCol) {
        issues.push({ type: 'warn', msg: `"${item.str}" ห่างจาก center ของ ${item.assignedCol} = ${item.distance.toFixed(0)}px`, rowIdx: i, cat: 'distance' });
      }
    }
  }

  ctx.validationCache = issues;
  return issues;
}

export function renderValidationPanel(ctx) {
  const issues = runValidation(ctx);
  const body = ctx.dom.validationBody;
  const countEl = ctx.dom.validationCount;

  const errors = issues.filter(i => i.type === 'error').length;
  const warns = issues.filter(i => i.type === 'warn').length;

  countEl.textContent = `${errors} errors, ${warns} warnings`;

  if (issues.length === 0) {
    body.innerHTML = '<div class="rd-empty" style="color:var(--green)">ไม่พบปัญหา</div>';
    return;
  }

  let html = '<div class="v-summary">';
  if (errors > 0) html += `<span class="v-summary-item v-summary-err">${errors} errors</span>`;
  if (warns > 0) html += `<span class="v-summary-item v-summary-warn">${warns} warnings</span>`;
  if (errors === 0 && warns === 0) html += '<span class="v-summary-item v-summary-ok">OK</span>';
  html += '</div>';

  for (const issue of issues) {
    const cls = `v-issue v-issue-${issue.type}`;
    const icon = issue.type === 'error' ? '!' : issue.type === 'warn' ? '?' : 'i';
    const rowLabel = issue.rowIdx >= 0 ? `#${issue.rowIdx + 1}` : '';
    html += `<div class="${cls}" data-issue-row="${issue.rowIdx}">
      <div class="v-issue-icon">${icon}</div>
      <div class="v-issue-text">${esc(issue.msg)}</div>
      ${rowLabel ? `<div class="v-issue-row">${rowLabel}</div>` : ''}
    </div>`;
  }

  body.innerHTML = html;

  body.querySelectorAll('.v-issue[data-issue-row]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.issueRow);
      if (idx >= 0) ctx.selectRow(idx);
    });
  });
}

// ---- Row Detail ----
export function renderRowDetail(ctx, rowIndex) {
  const { allRows, dom } = ctx;
  const body = dom.rowDetailBody;
  const label = dom.rowDetailLabel;
  const row = allRows[rowIndex];
  if (!row) { body.innerHTML = '<div class="rd-empty">คลิกแถวในตารางเพื่อดูรายละเอียด</div>'; return; }

  label.textContent = `Row #${rowIndex + 1} | Page ${row._meta ? row._meta.pageNum : '?'}`;

  let html = '<div class="rd-grid">';
  for (const key of COL_KEYS) {
    const val = row[key] || '';
    html += `<div class="rd-item col-${key}">
      <div class="rd-item-label">${key}</div>
      <div class="rd-item-value">${esc(val) || '<span style="opacity:.3">-</span>'}</div>
    </div>`;
  }
  html += '</div>';

  if (row._meta && row._meta.rawItems.length > 0) {
    const distances = row._meta.rawItems.filter(i => i.assignedCol).map(i => i.distance);
    const avgDist = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;
    const confidence = Math.max(0, Math.min(100, 100 - avgDist * 0.8));
    const confColor = confidence > 80 ? 'var(--green)' : confidence > 50 ? 'var(--yellow)' : 'var(--red)';

    html += `<div class="rd-confidence">
      Confidence: ${confidence.toFixed(0)}%
      <div class="rd-conf-bar"><div class="rd-conf-fill" style="width:${confidence}%;background:${confColor}"></div></div>
    </div>`;

    html += '<div class="rd-raw"><div class="rd-raw-title">Raw Text Items</div>';
    for (const item of row._meta.rawItems) {
      const color = COL_COLORS[item.assignedCol] || '#94a3b8';
      html += `<div class="rd-raw-item" style="background:${color}10;border-left:2px solid ${color}">
        "${esc(item.str)}" → ${item.assignedCol || '?'}
        <span>x:${item.x.toFixed(0)} y:${item.y.toFixed(0)} w:${item.w.toFixed(0)} d:${item.distance.toFixed(0)}</span>
      </div>`;
    }
    html += '</div>';
  }

  body.innerHTML = html;
}
