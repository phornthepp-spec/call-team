// ---- Constants ----
export const COL_KEYS = ['no','name','account','bank','totalAmt','invoiceAmt','vat','wht','paidAmt','fee','status','reason'];

export const COL_LABELS = [
  { key:'no',        th:['เลขที่','ลำดับ'], en:['No.','No'] },
  { key:'name',      th:['ชื่อผู้รับเงิน','ผู้รับเงิน'], en:['Recipient','Beneficiary'] },
  { key:'account',   th:['บัญชี','พร้อมเพย์'], en:['PromptPay','Acc.','A/C'] },
  { key:'bank',      th:['รหัส','สาขา'], en:['Bank','Branch'] },
  { key:'paidAmt',   th:['เงินที่จ่าย'], en:['Amount Paid','Total Amount Paid'] },
  { key:'totalAmt',  th:['จำนวนเงินทั้งหมด','จำนวนเงิน'], en:['Total Amount'] },
  { key:'invoiceAmt',th:['แจ้งหนี้'], en:['Invoice'] },
  { key:'vat',       th:['มูลค่าเพิ่ม'], en:['VAT'] },
  { key:'wht',       th:['ณ ที่จ่าย','หัก ณ'], en:['Withholding','WHT'] },
  { key:'fee',       th:['ค่าธรรมเนียม'], en:['Fee','Charge'] },
  { key:'status',    th:['สถานะ'], en:['Status'] },
  { key:'reason',    th:['เหตุผล'], en:['Reason','Rejection','Remark'] },
];

export const HEADER_KEYWORDS = [
  'เลขที่','No.','ลำดับ','ลำดับที่','Recipient','สถานะ','Status','ผู้รับเงิน',
  'Beneficiary','Account','Amount','จำนวนเงิน','เลขที่บัญชี','ธนาคาร',
  'Seq','A/C','Remark','WHT','VAT','Fee','Invoice',
];

export const SKIP_ROW_KEYWORDS = [
  'รวมทั้งหมด','จำนวนรวม','จำนวนรายการ','สรุป',
  'effective date','company name','payment date',
  'report name','report date','printed by',
  'ธนาคารไทยพาณิชย์','หมายเหตุ','grand total',
  'transaction summary','transaction successful','transaction failed',
  'canceled/rejected','in progress','กำลังดำเนินก','ถูกยกเลิก',
  'no. of trans','amount (thb)','หน้าที่ (page)',
];

export const COL_COLORS = {
  no:'#00e5ff', name:'#a855f7', account:'#3b82f6', bank:'#f97316',
  totalAmt:'#10b981', invoiceAmt:'#14b8a6', vat:'#f59e0b', wht:'#ef4444',
  paidAmt:'#ec4899', fee:'#fb923c', status:'#10b981', reason:'#94a3b8'
};

// ---- PDF Text Extraction ----
export async function getPageTextItems(pdf, pageNum) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  const vp = page.getViewport({ scale: 1 });
  return content.items
    .map(item => {
      const tx = item.transform;
      return {
        str: item.str,
        x: tx[4],
        y: vp.height - tx[5],
        w: item.width || 0,
        fontSize: Math.abs(tx[0])
      };
    })
    .filter(it => it.str.trim() !== '');
}

// ---- Layout Detection ----
export function detectLayout(items) {
  const candidateYs = new Map();
  for (const kw of HEADER_KEYWORDS) {
    for (const it of items) {
      if (it.str.includes(kw)) {
        let foundGroup = false;
        for (const [y, info] of candidateYs) {
          if (Math.abs(y - it.y) < 8) {
            info.count++;
            foundGroup = true;
            break;
          }
        }
        if (!foundGroup) {
          candidateYs.set(it.y, { count: 1 });
        }
      }
    }
  }

  if (candidateYs.size === 0) return null;

  const sorted = [...candidateYs.entries()].sort((a, b) => b[1].count - a[1].count || a[0] - b[0]);

  for (const [headerY] of sorted) {
    const layout = tryLayoutAt(items, headerY);
    if (layout) return layout;
  }

  return null;
}

export function tryLayoutAt(items, headerY) {
  // Wider upward (-15) for multi-line headers, tighter downward (+20) to exclude data rows
  const bandItems = items.filter(it => it.y >= headerY - 15 && it.y <= headerY + 20);
  if (bandItems.length < 3) return null;

  // Find the Y level with the most individual column-label matches
  // This picks the cleanest header line (avoids merged Thai text spanning columns)
  const yLevels = groupByY(bandItems, 4);
  let bestLevel = null;
  let bestScore = 0;
  for (const level of yLevels) {
    let score = 0;
    const matched = new Set();
    for (const item of level.items) {
      for (const def of COL_LABELS) {
        if (matched.has(def.key)) continue;
        const allPats = [...def.th, ...def.en];
        if (allPats.some(p => item.str.includes(p))) {
          score++;
          matched.add(def.key);
          break;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestLevel = level;
    }
  }

  // Use the best single line for clustering to get clean column boundaries
  const clusterSource = bestLevel && bestScore >= 3 ? bestLevel.items : bandItems;
  const clusters = clusterByX(clusterSource);

  const labeled = [];
  const usedKeys = new Set();
  for (const cl of clusters) {
    const text = cl.items.map(i => i.str).join(' ');
    let matchedKey = null;
    for (const def of COL_LABELS) {
      if (usedKeys.has(def.key)) continue;
      const allPats = [...def.th, ...def.en];
      if (allPats.some(p => text.includes(p))) {
        matchedKey = def.key;
        break;
      }
    }
    if (matchedKey) {
      usedKeys.add(matchedKey);
      labeled.push({ key: matchedKey, centerX: cl.centerX, minX: cl.minX, maxX: cl.maxX });
    }
  }

  if (labeled.length < 3) return null;
  labeled.sort((a, b) => a.centerX - b.centerX);

  const columns = labeled.map((col, i) => ({
    key: col.key,
    center: col.centerX,
    start: i === 0 ? 0 : (labeled[i-1].maxX + col.minX) / 2,
    end: i === labeled.length - 1 ? 9999 : (col.maxX + labeled[i+1].minX) / 2,
  }));

  const maxBandY = Math.max(...bandItems.map(i => i.y));
  return { columns, dataStartY: maxBandY + 5, headerY };
}

export function clusterByX(items) {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const clusters = [];

  for (const item of sorted) {
    const iw = Math.max(item.w, item.fontSize * item.str.length * 0.45, 3);
    const iRight = item.x + iw;
    let merged = false;

    for (const cl of clusters) {
      if (item.x <= cl.maxX + 12 && iRight >= cl.minX - 12) {
        cl.items.push(item);
        cl.minX = Math.min(cl.minX, item.x);
        cl.maxX = Math.max(cl.maxX, iRight);
        merged = true;
        break;
      }
    }

    if (!merged) {
      clusters.push({ items: [item], minX: item.x, maxX: iRight });
    }
  }

  return clusters.map(c => ({
    ...c,
    centerX: (c.minX + c.maxX) / 2,
  })).sort((a, b) => a.centerX - b.centerX);
}

// ---- Per-Page Row Extraction ----
export function extractPageRows(items, layout, pageNum, ctx) {
  let dataStartY = layout.dataStartY;

  // Robust header detection: cluster keyword matches by Y position
  const candidateYs = new Map();
  for (const it of items) {
    for (const kw of HEADER_KEYWORDS) {
      if (it.str.includes(kw)) {
        let foundGroup = false;
        for (const [y, info] of candidateYs) {
          if (Math.abs(y - it.y) < 8) {
            info.count++;
            foundGroup = true;
            break;
          }
        }
        if (!foundGroup) {
          candidateYs.set(it.y, { count: 1 });
        }
        break;
      }
    }
  }

  // Require 3+ keywords at same Y level to identify as header
  let pageHeaderY = null;
  let bestCount = 0;
  for (const [y, info] of candidateYs) {
    if (info.count >= 3 && info.count > bestCount) {
      bestCount = info.count;
      pageHeaderY = y;
    }
  }

  if (pageHeaderY !== null) {
    // Use calibrated offset from initial layout detection
    const headerToDataOffset = layout.dataStartY - layout.headerY;
    dataStartY = pageHeaderY + headerToDataOffset;
  }

  const dataItems = items.filter(it => it.y > dataStartY);
  if (dataItems.length === 0) return [];

  const yGroups = groupByY(dataItems, 4);

  const rows = [];
  for (const group of yGroups) {
    const row = {};
    for (const col of layout.columns) row[col.key] = '';

    const rawItems = [];
    for (const item of group.items) {
      const col = findColumn(item.x, layout.columns);
      const distance = col ? Math.abs(item.x - col.center) : 999;
      rawItems.push({
        str: item.str, x: item.x, y: item.y, w: item.w || 0,
        assignedCol: col ? col.key : null, distance, fontSize: item.fontSize
      });
      if (col) {
        row[col.key] = row[col.key] ? row[col.key] + ' ' + item.str.trim() : item.str.trim();
      }
    }

    // Capture grand total before skipping
    const text = Object.values(row).join(' ').toLowerCase();
    if (text.includes('grand total') || text.includes('รวมทั้งหมด')) {
      ctx.grandTotalRow = { ...row, _meta: { pageNum, y: group.y, rawItems } };
    }

    if (isSkipRow(row)) continue;
    row._meta = { pageNum, y: group.y, rawItems };
    rows.push(row);
  }
  return rows;
}

export function findColumn(x, columns) {
  for (const c of columns) {
    if (x >= c.start && x < c.end) return c;
  }
  let best = null, bestD = Infinity;
  for (const c of columns) {
    const d = Math.abs(x - c.center);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function groupByY(items, tolerance) {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const groups = [];
  for (const item of sorted) {
    const g = groups.find(gr => Math.abs(gr.y - item.y) < tolerance);
    if (g) { g.items.push(item); }
    else { groups.push({ y: item.y, items: [item] }); }
  }
  return groups;
}

export function isSkipRow(row) {
  const text = Object.values(row).join(' ');
  const lower = text.toLowerCase();

  for (const kw of SKIP_ROW_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }

  let hdrCount = 0;
  for (const kw of HEADER_KEYWORDS) {
    if (text.includes(kw)) hdrCount++;
  }
  if (hdrCount >= 4) return true;

  const filled = Object.values(row).filter(v => v.trim()).length;
  if (filled < 2) return true;

  return false;
}

// ---- Merge Multi-Line Rows ----
export function mergeMultiLineRows(rows) {
  if (rows.length === 0) return [];
  const merged = [];

  for (const row of rows) {
    const noVal = (row.no || '').trim();
    const isNewRow = /^\d+(\s+P\d+)?$/i.test(noVal);

    if (isNewRow || merged.length === 0) {
      merged.push({ ...row, _meta: row._meta ? { ...row._meta, rawItems: [...(row._meta.rawItems || [])] } : null });
    } else {
      const filled = Object.keys(row).filter(k => k !== '_meta' && (row[k]||'').trim()).length;
      if (filled <= 3 && merged.length > 0) {
        const prev = merged[merged.length - 1];
        for (const key of Object.keys(row)) {
          if (key === '_meta') continue;
          const val = (row[key] || '').trim();
          if (!val) continue;
          const prevVal = (prev[key] || '').trim();
          prev[key] = prevVal ? prevVal + ' ' + val : val;
        }
        if (prev._meta && row._meta) {
          prev._meta.rawItems.push(...(row._meta.rawItems || []));
        }
      } else {
        merged.push({ ...row, _meta: row._meta ? { ...row._meta, rawItems: [...(row._meta.rawItems || [])] } : null });
      }
    }
  }
  return merged;
}

// ---- Filter: keep only rows where 'no' is a valid sequence number ----
export function filterDataRows(rows) {
  return rows.filter(row => {
    const no = (row.no || '').trim();
    return /^\d+$/.test(no);
  });
}

// ---- Post-Process: Split Merged Columns ----
export function splitNoAndName(rows) {
  for (const row of rows) {
    const noVal = (row.no || '').trim();
    const mNo = noVal.match(/^(\d+)\s+(P\d+.*)$/i);
    if (mNo) {
      row.no = mNo[1];
      const existing = (row.name || '').trim();
      row.name = existing ? mNo[2] + ' ' + existing : mNo[2];
    }

    const accVal = (row.account || '').trim();
    if (accVal && !(row.bank || '').trim()) {
      const mAcc = accVal.match(/^(\S+)\s+(\d{3}\/\d{4}.*)$/);
      if (mAcc) {
        row.account = mAcc[1];
        row.bank = mAcc[2];
      }
    }

    // Clean standalone "-" from amount fields (means nil/zero in SCB reports)
    for (const key of ['totalAmt', 'invoiceAmt', 'vat', 'wht', 'paidAmt', 'fee']) {
      const v = (row[key] || '').trim();
      if (v === '-') row[key] = '';
      // "- 10,000.00" → dash is a separator, extract the number
      else if (/^-\s+[\d,.]/.test(v)) row[key] = v.replace(/^-\s+/, '');
    }

    const paidVal = (row.paidAmt || '').trim();
    if (paidVal) {
      const mPaid = paidVal.match(/^([\d,.]+)\s*-\s*([\d,.]+)$/);
      if (mPaid) {
        if (!(row.vat || '').trim()) row.vat = mPaid[1];
        else if (!(row.wht || '').trim()) row.wht = mPaid[1];
        row.paidAmt = mPaid[2];
      }
    }

    const feeVal = (row.fee || '').trim();
    if (feeVal && !(row.status || '').trim()) {
      const mFee = feeVal.match(/^([\d,.]+)\s+(\S+.*)$/);
      if (mFee) {
        row.fee = mFee[1];
        row.status = mFee[2];
      }
    }
  }
  return rows;
}
