// ===== Titlebar IPC =====
document.getElementById('btn-min').onclick = () => window.electronAPI.minimize();
document.getElementById('btn-max').onclick = () => window.electronAPI.maximize();
document.getElementById('btn-close').onclick = () => window.electronAPI.close();
window.electronAPI.onWindowState((isMax) => {
  document.getElementById('icon-max').innerHTML = isMax
    ? '<path d="M3 5h8v8H3zM5 3h8v8" fill="none" stroke="currentColor" stroke-width="1"/>'
    : '<rect x="3" y="3" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"/>';
});

// ===== Toast System =====
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 300); }, 2800);
}

// ===== Keyboard Shortcuts =====
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'd') { e.preventDefault(); document.getElementById('theme-toggle').click(); }
  if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportToCSV(); }
  if (e.ctrlKey && e.key === 'r') { e.preventDefault(); runDataProcessingPipeline(); }
  if (e.key === 'Escape') {
    const fs = document.querySelector('.fullscreen-mode');
    if (fs) { fs.classList.remove('fullscreen-mode'); }
  }
});

// ===== Core State =====
const STORAGE_CONFIGURATION_CACHE_KEY = "ewm_dashboard_state_v20";

let systemState = {
  kpiExclusions: {}, remarks: {},
  days: [
    { id: "mon", title: "Mon", stockCountRaw: "", ewmRaw: "" },
    { id: "tue", title: "Tue", stockCountRaw: "", ewmRaw: "" },
    { id: "wed", title: "Wed", stockCountRaw: "", ewmRaw: "" },
    { id: "thu", title: "Thu", stockCountRaw: "", ewmRaw: "" },
    { id: "fri", title: "Fri & Sat", stockCountRaw: "", ewmRaw: "" },
    { id: "sun", title: "Sun", stockCountRaw: "", ewmRaw: "" }
  ],
  activeDayId: "wed"
};

let processedCache = {};
let activeGridFilterMode = "ALL";
let activeGridScope = "CURRENT";
let trackingRowExpansionState = false;
let lastCheckedHash = null;

// ===== Init =====
window.addEventListener('DOMContentLoaded', () => {
  const preserved = localStorage.getItem(STORAGE_CONFIGURATION_CACHE_KEY);
  if (preserved) {
    try {
      let parsed = JSON.parse(preserved);
      systemState = { ...systemState, ...parsed };
      if (!systemState.remarks) systemState.remarks = {};
      if (!systemState.kpiExclusions) systemState.kpiExclusions = {};
    } catch (e) { console.error("Cache reset"); }
  }

  if (!systemState.days[2].stockCountRaw) {
    systemState.days[1].stockCountRaw = "Scan Inventory\tSystem\tProduct\tProduct Short Description\tQuantity\tBatch\tHU\tCreated By\tTimestamp\nO3-A4-1.0-06\tO3-A4-1.0-06\tXM1611701\tSIM_TRAY_DUAL_CARD\t180.000\t2603200002\tP5105\t038120\t6/3/2026 07:40\nO3-A4-1.0-06\tO3-A4-1.0-06\tXM1611701\tSIM_TRAY_DUAL_CARD\t180.000\t2603200002\tP5105\t038120\t6/3/2026 07:41";
    systemState.days[1].ewmRaw = "Storage Bin\tProduct\tProduct Short Description\tQuantity\tBatch\tHandling Unit\nO3-A4-1.0-06\tXM1611701\tSIM_TRAY_DUAL_CARD\t180.000\t2603200002\tP5105";
    systemState.days[2].stockCountRaw = "Scan Inventory\tSystem\tProduct\tProduct Short Description\tQuantity\tBatch\tHU\tCreated By\tTimestamp\nO3-A4-1.0-06\tO3-A4-1.0-07\tXM1611701\tSIM_TRAY_DUAL_CARD\t255.000\t2603200002\tP5105\t039210\t6/3/2026 08:15\nO3-A4-1.0-06\tO3-A4-1.0-07\tXM1611701\tSIM_TRAY_DUAL_CARD\t255.000\t2603200002\tP5105\t039210\t6/3/2026 08:15";
    systemState.days[2].ewmRaw = "Storage Bin\tProduct\tProduct Short Description\tQuantity\tBatch\tHandling Unit\nO3-A4-1.0-07\tXM1611701\tSIM_TRAY_DUAL_CARD\t255.000\t2603200002\tP5105";
  }

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    showToast(isDark ? 'Light mode enabled' : 'Dark mode enabled', 'info');
    renderDashboardWorkspaceView();
  });

  renderInputsSidebar();
  runDataProcessingPipeline();
});

// ===== Persistence =====
function saveConfigurationCache() {
  localStorage.setItem(STORAGE_CONFIGURATION_CACHE_KEY, JSON.stringify(systemState));
}

function saveRemark(rowKey, val) {
  systemState.remarks[rowKey] = val;
  saveConfigurationCache();
}

// ===== KPI Checkbox =====
function handleKpiCheckboxClick(e, hashKey, cb) {
  e.stopPropagation();
  let targetState = cb.checked;
  if (e.shiftKey && lastCheckedHash) {
    let boxes = Array.from(document.querySelectorAll('.kpi-exclude-cb'));
    let start = boxes.findIndex(b => b.getAttribute('data-hash') === lastCheckedHash);
    let end = boxes.findIndex(b => b.getAttribute('data-hash') === hashKey);
    if (start !== -1 && end !== -1) {
      let min = Math.min(start, end), max = Math.max(start, end);
      for (let i = min; i <= max; i++) {
        systemState.kpiExclusions[boxes[i].getAttribute('data-hash')] = targetState;
      }
    }
  } else {
    systemState.kpiExclusions[hashKey] = targetState;
  }
  lastCheckedHash = hashKey;
  saveConfigurationCache();
  runDataProcessingPipeline();
}

// ===== CSV Export =====
function exportToCSV() {
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Shift Window,Scan Bin,System Bin,Product Code,Description,Batch Code,User/Suspect,Scan Time,Scan Count,EWM Balance,Variance,System Status,KPI Excluded,Remarks\n";
  let rows = Array.from(document.querySelectorAll('.master-row'));
  let count = 0;
  rows.forEach(r => {
    if (r.style.display !== 'none') {
      let cols = r.querySelectorAll('td');
      let nextRow = r.nextElementSibling;
      let shift = nextRow ? (nextRow.innerText.match(/Shift Execution Source: (.*?) Target/)?.[1] || "N/A") : "N/A";
      let clean = (t) => `"${t.replace(/"/g, '""').trim()}"`;
      csvContent += `"${shift}","${cols[1].innerText}","${cols[2].innerText}","${cols[3].innerText}",${clean(cols[4].innerText)},"${cols[5].innerText}","${cols[6].innerText.replace('Suspect:', '').trim()}","${cols[7].innerText}",${cols[8].innerText.split('\n')[0].replace(/,/g, '')},${cols[9].innerText.replace(/,/g, '')},${cols[10].innerText.replace(/,/g, '').replace('+', '')},"${cols[11].innerText}","${cols[12].querySelector('input') ? (cols[12].querySelector('input').checked ? "YES" : "NO") : "N/A"}",${clean(cols[13].querySelector('input').value)}\n`;
      count++;
    }
  });
  if (count === 0) { showToast('No visible rows to export', 'error'); return; }
  var link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", "Discrepancy_Log_Export.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${count} records to CSV`, 'success');
}

// ===== Helpers =====
function generateRowHashKey(dayTitle, scanBin, sysBin, prod, batch, status) {
  return btoa(encodeURIComponent(`${dayTitle}_${scanBin}_${sysBin}_${prod}_${batch}_${status}`));
}

function renderInputsSidebar() {
  const container = document.getElementById('daysInputsContainer');
  container.innerHTML = '';
  systemState.days.forEach(day => {
    const div = document.createElement('div');
    div.className = 'day-config-box';
    div.innerHTML = `
      <button class="remove-btn" onclick="removeDayNode('${day.id}')">✕</button>
      <input type="text" class="day-label-input" value="${day.title}" onchange="updateDayLabelNode('${day.id}', this.value)" />
      <div class="textarea-pair">
        <div><label>Count Actual</label><textarea onchange="updateTextareaCache('${day.id}', 'stockCountRaw', this.value)" placeholder="Paste data…">${day.stockCountRaw || ''}</textarea></div>
        <div><label>EWM Balance</label><textarea onchange="updateTextareaCache('${day.id}', 'ewmRaw', this.value)" placeholder="Paste data…">${day.ewmRaw || ''}</textarea></div>
      </div>`;
    container.appendChild(div);
  });
  renderDynamicSelectorTabs();
}

function addNewDayProfile() {
  const id = 'shift_' + Date.now();
  systemState.days.push({ id, title: "Day " + (systemState.days.length + 1), stockCountRaw: "", ewmRaw: "" });
  saveConfigurationCache();
  renderInputsSidebar();
  showToast('New shift target added', 'info');
}

function removeDayNode(id) {
  if (systemState.days.length <= 1) return;
  systemState.days = systemState.days.filter(d => d.id !== id);
  if (systemState.activeDayId === id) systemState.activeDayId = systemState.days[0].id;
  saveConfigurationCache();
  renderInputsSidebar();
  runDataProcessingPipeline();
}

function updateDayLabelNode(id, val) {
  const d = systemState.days.find(x => x.id === id);
  if (d) d.title = val;
  saveConfigurationCache();
  renderDynamicSelectorTabs();
}

function updateTextareaCache(id, field, val) {
  const d = systemState.days.find(x => x.id === id);
  if (d) d[field] = val;
  saveConfigurationCache();
  runDataProcessingPipeline();
}

function renderDynamicSelectorTabs() {
  const container = document.getElementById('dayTabsContainer');
  container.innerHTML = '';
  systemState.days.forEach(day => {
    const btn = document.createElement('button');
    btn.className = `day-tab-nav ${systemState.activeDayId === day.id ? 'active' : ''}`;
    btn.innerText = day.title;
    btn.onclick = () => {
      systemState.activeDayId = day.id;
      document.querySelectorAll('.day-tab-nav').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      trackingRowExpansionState = false;
      renderDashboardWorkspaceView();
    };
    container.appendChild(btn);
  });
}

function toggleActiveTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  if (tabId === 'dashboard') {
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.getElementById('tab-dashboard').classList.add('active');
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('tab-details').classList.add('active');
  }
}

function toggleRowDrillFullscreen(cardId, btn) {
  const el = document.getElementById(cardId);
  if (el.classList.contains('fullscreen-mode')) {
    el.classList.remove('fullscreen-mode');
    btn.innerText = "⛶ Expand Viewport";
  } else {
    el.classList.add('fullscreen-mode');
    btn.innerText = "✖ Collapse Viewport";
  }
}

// ===== Data Parsing =====
function parseTabularInputString(txt) {
  if (!txt || !txt.trim()) return [];
  const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  let sep = lines[0].includes('|') ? '|' : '\t';
  const cleanArray = lines.map(l => l.split(sep).map(c => c.trim())).filter(r => r.length > 1 && r.some(c => c !== ''));
  if (cleanArray.length === 0) return [];
  const keys = cleanArray[0].map(h => h.toLowerCase().replace(/[\s_-]/g, ''));
  const output = [];
  for (let i = 1; i < cleanArray.length; i++) {
    if (cleanArray[i][0].startsWith('---') || cleanArray[i][0].toLowerCase().includes('entries')) continue;
    let entry = {};
    keys.forEach((k, idx) => { if (cleanArray[i][idx] !== undefined) entry[k] = cleanArray[i][idx]; });
    output.push(entry);
  }
  return output;
}

function fetchGridField(obj, variations) {
  for (let v of variations) { if (obj[v] !== undefined) return obj[v]; }
  return '';
}

function scrubNumericValue(str) {
  if (!str) return 0;
  let p = parseFloat(str.replace(/,/g, ''));
  return isNaN(p) ? 0 : p;
}

// ===== CORE: Pipeline Engine =====
function runDataProcessingPipeline() {
  processedCache = {};
  let weeklyAuditors = {};

  systemState.days.forEach(day => {
    const countGrid = parseTabularInputString(day.stockCountRaw);
    const ewmGrid = parseTabularInputString(day.ewmRaw);
    let uniqueCounts = [];
    let dailyAuditorMap = {};
    let binVisitorMap = {};

    if (countGrid.length > 0) {
      countGrid.forEach(row => {
        let bin = fetchGridField(row, ['storagebin', 'scaninventory', 'system', 'bin']);
        let prod = fetchGridField(row, ['material', 'product', 'item', 'partno']);
        let desc = fetchGridField(row, ['description', 'productshortdescription', 'itemdesc']);
        let batch = fetchGridField(row, ['batch', 'lot']);
        let qty = scrubNumericValue(fetchGridField(row, ['quantity', 'qty', 'countqty']));
        let user = fetchGridField(row, ['createdby', 'user', 'changedby']) || "UNKNOWN";
        let dateStr = fetchGridField(row, ['timestamp', 'createddate', 'date']);
        let timeStr = fetchGridField(row, ['time', 'createdtime']);
        let fullTime = dateStr;
        if (timeStr && dateStr && !dateStr.includes(':')) fullTime += ' ' + timeStr;
        if (!bin || !prod) return;

        if (!binVisitorMap[bin]) binVisitorMap[bin] = new Set();
        binVisitorMap[bin].add(user);

        if (!dailyAuditorMap[user]) dailyAuditorMap[user] = { user, scans: 0, dups: 0, mismatches: 0, missedScans: 0, kpiExcluded: 0 };
        if (!weeklyAuditors[user]) weeklyAuditors[user] = { user, totalScans: 0, dupsFlattened: 0, binMismatches: 0, totalMissedScans: 0, kpiExcludedTotal: 0, dailyWindows: {} };

        if (fullTime) {
          let ms = Date.parse(fullTime);
          if (!isNaN(ms)) {
            if (!weeklyAuditors[user].dailyWindows[day.id]) weeklyAuditors[user].dailyWindows[day.id] = { min: ms, max: ms };
            else {
              if (ms < weeklyAuditors[user].dailyWindows[day.id].min) weeklyAuditors[user].dailyWindows[day.id].min = ms;
              if (ms > weeklyAuditors[user].dailyWindows[day.id].max) weeklyAuditors[user].dailyWindows[day.id].max = ms;
            }
          }
        }

        let dup = uniqueCounts.find(x => x.bin === bin && x.prod === prod && x.batch === batch && Math.abs(x.qty - qty) < 0.001);
        if (dup) {
          dup.duplicatedCount++;
          dailyAuditorMap[user].dups++;
          weeklyAuditors[user].dupsFlattened++;
        } else {
          dailyAuditorMap[user].scans++;
          weeklyAuditors[user].totalScans++;
          uniqueCounts.push({ bin, prod, desc, batch, qty, user, timeStr: fullTime || '-', duplicatedCount: 0 });
        }
      });
    }

    let aggregatedEWM = {};
    ewmGrid.forEach(row => {
      let bin = fetchGridField(row, ['system', 'storagebin', 'scaninventory', 'bin']);
      let prod = fetchGridField(row, ['product', 'material', 'item', 'partno']);
      let desc = fetchGridField(row, ['productshortdescription', 'description', 'itemdesc']);
      let batch = fetchGridField(row, ['batch', 'lot']);
      let qty = scrubNumericValue(fetchGridField(row, ['quantity', 'qty', 'ewmqty']));
      if (!bin || !prod) return;
      let key = `${bin}||${prod}||${batch}`;
      if (!aggregatedEWM[key]) aggregatedEWM[key] = { bin, prod, desc, batch, qty: 0 };
      aggregatedEWM[key].qty += qty;
    });

    let rowsArray = [];
    let scopeKeys = new Set([
      ...uniqueCounts.map(u => `${u.prod}||${u.batch}`),
      ...Object.values(aggregatedEWM).map(e => `${e.prod}||${e.batch}`)
    ]);

    scopeKeys.forEach(pbKey => {
      let [pCode, bCode] = pbKey.split('||');
      let physicalSet = uniqueCounts.filter(u => u.prod === pCode && u.batch === bCode);
      let systemSet = Object.values(aggregatedEWM).filter(e => e.prod === pCode && e.batch === bCode);

      // Match exact bins first
      for (let p = physicalSet.length - 1; p >= 0; p--) {
        let pNode = physicalSet[p];
        let sIdx = systemSet.findIndex(s => s.bin === pNode.bin);
        if (sIdx !== -1) {
          let sNode = systemSet[sIdx];
          let v = pNode.qty - sNode.qty;
          let status = Math.abs(v) < 0.001 ? "MATCHED" : "QTY_MISMATCH";
          let hashKey = generateRowHashKey(day.title, pNode.bin, sNode.bin, pCode, bCode, status);
          let isExcluded = systemState.kpiExclusions[hashKey] || false;
          rowsArray.push({ hashKey, isExcluded, scanBin: pNode.bin, systemBin: sNode.bin, prod: pCode, desc: pNode.desc || sNode.desc, batch: bCode, countQty: pNode.qty, ewmQty: sNode.qty, variance: v, status, user: pNode.user, time: pNode.timeStr, dups: pNode.duplicatedCount });
          if (status === "QTY_MISMATCH") {
            if (!isExcluded) { if (dailyAuditorMap[pNode.user]) dailyAuditorMap[pNode.user].mismatches++; if (weeklyAuditors[pNode.user]) weeklyAuditors[pNode.user].binMismatches++; }
            else { if (dailyAuditorMap[pNode.user]) dailyAuditorMap[pNode.user].kpiExcluded++; if (weeklyAuditors[pNode.user]) weeklyAuditors[pNode.user].kpiExcludedTotal++; }
          }
          physicalSet.splice(p, 1);
          systemSet.splice(sIdx, 1);
        }
      }

      // Placement mismatches
      let pairs = Math.min(physicalSet.length, systemSet.length);
      for (let i = 0; i < pairs; i++) {
        let pNode = physicalSet.pop();
        let sNode = systemSet.pop();
        let hashKey = generateRowHashKey(day.title, pNode.bin, sNode.bin, pCode, bCode, "PLACEMENT_MISMATCH");
        let isExcluded = systemState.kpiExclusions[hashKey] || false;
        rowsArray.push({ hashKey, isExcluded, scanBin: pNode.bin, systemBin: sNode.bin, prod: pCode, desc: pNode.desc || sNode.desc, batch: bCode, countQty: pNode.qty, ewmQty: sNode.qty, variance: pNode.qty - sNode.qty, status: "PLACEMENT_MISMATCH", user: pNode.user, time: pNode.timeStr, dups: pNode.duplicatedCount });
        if (!isExcluded) { if (dailyAuditorMap[pNode.user]) dailyAuditorMap[pNode.user].mismatches++; if (weeklyAuditors[pNode.user]) weeklyAuditors[pNode.user].binMismatches++; }
        else { if (dailyAuditorMap[pNode.user]) dailyAuditorMap[pNode.user].kpiExcluded++; if (weeklyAuditors[pNode.user]) weeklyAuditors[pNode.user].kpiExcludedTotal++; }
      }

      // Issued (physical exists, no system match)
      while (physicalSet.length > 0) {
        let pNode = physicalSet.pop();
        let hashKey = generateRowHashKey(day.title, pNode.bin, "NOT IN EWM", pCode, bCode, "ISSUED");
        rowsArray.push({ hashKey, isExcluded: systemState.kpiExclusions[hashKey] || false, scanBin: pNode.bin, systemBin: "NOT IN EWM", prod: pCode, desc: pNode.desc, batch: bCode, countQty: pNode.qty, ewmQty: 0, variance: pNode.qty, status: "ISSUED", user: pNode.user, time: pNode.timeStr, dups: pNode.duplicatedCount });
      }

      // Not Scanned (system exists, no physical match)
      while (systemSet.length > 0) {
        let sNode = systemSet.pop();
        let assignedUser = "";
        let hashKey = generateRowHashKey(day.title, "NOT SCANNED", sNode.bin, pCode, bCode, "NOT_SCANNED");
        let isExcluded = systemState.kpiExclusions[hashKey] || false;
        if (binVisitorMap[sNode.bin] && binVisitorMap[sNode.bin].size > 0) {
          assignedUser = Array.from(binVisitorMap[sNode.bin])[0];
          if (!isExcluded) { if (dailyAuditorMap[assignedUser]) dailyAuditorMap[assignedUser].missedScans++; if (weeklyAuditors[assignedUser]) weeklyAuditors[assignedUser].totalMissedScans++; }
          else { if (dailyAuditorMap[assignedUser]) dailyAuditorMap[assignedUser].kpiExcluded++; if (weeklyAuditors[assignedUser]) weeklyAuditors[assignedUser].kpiExcludedTotal++; }
        }
        rowsArray.push({ hashKey, isExcluded, scanBin: "NOT SCANNED", systemBin: sNode.bin, prod: pCode, desc: sNode.desc, batch: bCode, countQty: 0, ewmQty: sNode.qty, variance: -sNode.qty, status: "NOT_SCANNED", user: assignedUser, time: "", dups: 0 });
      }
    });

    Object.keys(dailyAuditorMap).forEach(u => {
      let d = dailyAuditorMap[u];
      let faults = d.mismatches + d.missedScans;
      d.accuracy = d.scans > 0 ? Math.max(0, ((d.scans - faults) / d.scans) * 100) : 100;
    });

    let scannedFound = rowsArray.filter(r => r.scanBin !== "NOT SCANNED" && r.status !== "ISSUED").length;
    let notOkBin = rowsArray.filter(r => r.scanBin !== "NOT SCANNED" && r.status !== "ISSUED" && (r.status === "QTY_MISMATCH" || r.status === "PLACEMENT_MISMATCH")).length;
    let okBin = scannedFound - notOkBin;
    let totalBatch = rowsArray.filter(r => r.systemBin !== "NOT IN EWM").length;
    let scanned = rowsArray.filter(r => r.systemBin !== "NOT IN EWM" && r.scanBin !== "NOT SCANNED").length;
    let notScanned = totalBatch - scanned;

    processedCache[day.id] = { rows: rowsArray, dailyAuditors: Object.values(dailyAuditorMap), summary: { scannedFound, notOkBin, okBin, totalBatch, scanned, notScanned } };
  });

  systemState.days.forEach(day => {
    if (processedCache[day.id]) processedCache[day.id].weeklyAuditors = Object.values(weeklyAuditors);
  });

  renderDashboardWorkspaceView();
  showToast('Pipeline executed successfully', 'success');
}

// ===== Scope & Filter =====
function setGridDataScope(s) {
  activeGridScope = s;
  document.getElementById('btnScopeCURRENT').classList.remove('active');
  document.getElementById('btnScopeALL').classList.remove('active');
  document.getElementById('btnScope' + s).classList.add('active');
  renderMasterPipelineGrid();
}

function setGridDataFilter(m) {
  activeGridFilterMode = m;
  document.querySelectorAll('#filterAreaControls .filter-btn').forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('onclick').includes(m)) b.classList.add('active');
  });
  renderMasterPipelineGrid();
}

function toggleRowDetailDropdown(row) {
  if (event.target.tagName.toLowerCase() === 'input') return;
  const sub = row.nextElementSibling;
  if (sub && sub.classList.contains('expanded-row')) sub.classList.toggle('show');
}

function toggleGlobalRowCollapse() {
  trackingRowExpansionState = !trackingRowExpansionState;
  document.querySelectorAll('.expanded-row').forEach(r => {
    if (trackingRowExpansionState) r.classList.add('show'); else r.classList.remove('show');
  });
}

// ===== Dashboard Render =====
function renderDashboardWorkspaceView() {
  const currentDayId = systemState.activeDayId;
  const currentDay = processedCache[currentDayId];
  const config = systemState.days.find(x => x.id === currentDayId);
  if (!currentDay) return;

  let weekly = { scannedFound: 0, notOkBin: 0, okBin: 0, totalBatch: 0, scanned: 0, notScanned: 0 };
  Object.values(processedCache).forEach(c => {
    weekly.scannedFound += c.summary.scannedFound || 0;
    weekly.notOkBin += c.summary.notOkBin || 0;
    weekly.okBin += c.summary.okBin || 0;
    weekly.totalBatch += c.summary.totalBatch || 0;
    weekly.scanned += c.summary.scanned || 0;
    weekly.notScanned += c.summary.notScanned || 0;
  });

  let dailyDisc = currentDay.rows.filter(r => r.status === "PLACEMENT_MISMATCH" || r.status === "NOT_SCANNED").length;
  let dailyAcc = currentDay.summary.scannedFound > 0 ? (currentDay.summary.okBin / currentDay.summary.scannedFound * 100) : 0;
  let weeklyAcc = weekly.scannedFound > 0 ? (weekly.okBin / weekly.scannedFound * 100) : 0;

  document.getElementById('bannerTitle').innerText = `Shift Performance: ${config.title}`;
  document.getElementById('bannerTotalKeys').innerText = currentDay.rows.length;
  document.getElementById('bannerDiscrepancies').innerText = dailyDisc;
  document.getElementById('bannerAccuracy').innerText = weeklyAcc.toFixed(2) + "%";
  document.getElementById('btnScopeCURRENT').innerText = `Shift (${config.title})`;

  document.getElementById('titleEwmAcc').innerText = `MI11 EWM BIN ACCURACY (${config.title})`;
  document.getElementById('titleSysAcc').innerText = `MI11 SYSTEM VS SCANNED ACTUAL (${config.title})`;
  document.getElementById('lblEwmDaily').innerText = `Daily Details (${config.title})`;
  document.getElementById('lblSysDaily').innerText = `Daily Details (${config.title})`;
  document.getElementById('chartEwmTitle').innerText = `Daily EWM Bin Accuracy (${config.title})`;
  document.getElementById('chartSysTitle').innerText = `Daily System vs Scanned (${config.title})`;
  document.getElementById('auditorDailyHeader').innerText = `Daily Performance (${config.title})`;

  let d = currentDay.summary;
  document.getElementById('ewm-d-scan').innerText = d.scannedFound;
  document.getElementById('ewm-d-ok').innerText = d.okBin;
  document.getElementById('ewm-d-notok').innerText = d.notOkBin || '-';
  document.getElementById('ewm-d-ok-p').innerText = dailyAcc > 0 ? dailyAcc.toFixed(2) + "%" : "0.00%";
  document.getElementById('ewm-d-notok-p').innerText = d.scannedFound > 0 ? (d.notOkBin / d.scannedFound * 100).toFixed(2) + "%" : "0.00%";

  document.getElementById('ewm-w-scan').innerText = weekly.scannedFound;
  document.getElementById('ewm-w-ok').innerText = weekly.okBin;
  document.getElementById('ewm-w-notok').innerText = weekly.notOkBin || '-';
  document.getElementById('ewm-w-ok-p').innerText = weeklyAcc > 0 ? weeklyAcc.toFixed(2) + "%" : "0.00%";
  document.getElementById('ewm-w-notok-p').innerText = weekly.scannedFound > 0 ? (weekly.notOkBin / weekly.scannedFound * 100).toFixed(2) + "%" : "0.00%";

  document.getElementById('sys-d-batch').innerText = d.totalBatch;
  document.getElementById('sys-d-scanned').innerText = d.scanned;
  document.getElementById('sys-d-notscanned').innerText = d.notScanned || '-';
  let dailySys = d.totalBatch > 0 ? (d.scanned / d.totalBatch * 100) : 0;
  document.getElementById('sys-d-scanned-p').innerText = dailySys > 0 ? dailySys.toFixed(2) + "%" : "0.00%";
  document.getElementById('sys-d-notscanned-p').innerText = d.totalBatch > 0 ? (d.notScanned / d.totalBatch * 100).toFixed(2) + "%" : "0.00%";

  document.getElementById('sys-w-batch').innerText = weekly.totalBatch;
  document.getElementById('sys-w-scanned').innerText = weekly.scanned;
  document.getElementById('sys-w-notscanned').innerText = weekly.notScanned || '-';
  let weeklySys = weekly.totalBatch > 0 ? (weekly.scanned / weekly.totalBatch * 100) : 0;
  document.getElementById('sys-w-scanned-p').innerText = weeklySys > 0 ? weeklySys.toFixed(2) + "%" : "0.00%";
  document.getElementById('sys-w-notscanned-p').innerText = weekly.totalBatch > 0 ? (weekly.notScanned / weekly.totalBatch * 100).toFixed(2) + "%" : "0.00%";

  synchronizeDonutGraphic('donutEwmCircle', 'donutEwmText', dailyAcc);
  synchronizeDonutGraphic('donutSysCircle', 'donutSysText', dailySys);
  renderDualAxisSVGChart('trendEwmContainer', 'scannedFound', 'okBin', true);
  renderDualAxisSVGChart('trendSysContainer', 'totalBatch', 'scanned', false);
  renderAuditorPerformanceGrid(currentDay.dailyAuditors, currentDay.weeklyAuditors, currentDayId);
  renderMasterPipelineGrid();
}

function synchronizeDonutGraphic(circleId, textId, score) {
  const circ = document.getElementById(circleId);
  const circumference = 2 * Math.PI * 42;
  circ.style.strokeDashoffset = circumference - ((score / 100) * circumference);
  circ.style.strokeDasharray = `${circumference}`;
  document.getElementById(textId).innerText = score.toFixed(1) + "%";
}

// ===== Auditor Grid =====
function renderAuditorPerformanceGrid(dailyArr, weeklyArr, activeDayId) {
  const body = document.getElementById('auditorGridBody');
  if (!weeklyArr || weeklyArr.length === 0) { body.innerHTML = `<tr><td colspan="15" class="empty-state">No auditor data available.</td></tr>`; return; }

  body.innerHTML = weeklyArr.map(w => {
    let dm = dailyArr.find(d => d.user === w.user);
    let dScans = dm ? dm.scans.toLocaleString() : "-";
    let dDups = dm ? dm.dups.toLocaleString() : "-";
    let dMis = dm ? dm.mismatches.toLocaleString() : "-";
    let dMissed = dm ? dm.missedScans.toLocaleString() : "-";
    let dAcc = dm ? dm.accuracy.toFixed(1) + "%" : "-";
    let dAccCls = dm ? (dm.accuracy < 95 ? 'text-danger' : 'text-success') : '';

    let dailyWinStr = "-";
    if (w.dailyWindows[activeDayId]) {
      let win = w.dailyWindows[activeDayId];
      if (win.max >= win.min) {
        let mins = Math.round(((win.max === win.min ? 60000 : win.max - win.min)) / 60000);
        dailyWinStr = mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`;
      }
    }

    let totalMs = 0, dayCount = 0;
    Object.values(w.dailyWindows).forEach(win => {
      if (win.max >= win.min) { totalMs += (win.max === win.min ? 60000 : win.max - win.min); dayCount++; }
    });
    let weekWinStr = totalMs > 0 ? (() => { let m = Math.round(totalMs/60000); return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`; })() : "0m";
    let avgMs = dayCount > 0 ? totalMs / dayCount : 0;
    let avgStr = avgMs > 0 ? (() => { let m = Math.round(avgMs/60000); return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`; })() : "0m";

    let wFaults = w.binMismatches + w.totalMissedScans;
    let wAcc = w.totalScans > 0 ? Math.max(0, ((w.totalScans - wFaults) / w.totalScans) * 100) : 100;
    let wAccCls = wAcc < 95 ? 'text-danger' : 'text-success';

    return `<tr style="border-bottom:1px solid var(--border-color);">
      <td style="font-weight:700; color:var(--primary-blue); border-right:1px solid var(--border-color); position:sticky; left:0; background:var(--surface-color); z-index:1;">${w.user}</td>
      <td class="text-right">${dScans}</td><td class="text-right" style="color:${dm&&dm.dups>0?'var(--primary-orange)':'inherit'}">${dDups}</td>
      <td class="text-right" style="color:${dm&&dm.mismatches>0?'var(--primary-red)':'inherit'}">${dMis}</td>
      <td class="text-right" style="color:${dm&&dm.missedScans>0?'var(--primary-red)':'inherit'}">${dMissed}</td>
      <td class="text-center" style="font-size:11px; color:var(--text-muted);">${dailyWinStr}</td>
      <td class="text-right ${dAccCls}" style="font-weight:bold; border-right:2px solid var(--border-color);">${dAcc}</td>
      <td class="text-right" style="font-weight:600;">${w.totalScans.toLocaleString()}</td>
      <td class="text-right" style="color:var(--primary-orange);">${w.dupsFlattened.toLocaleString()}</td>
      <td class="text-right ${w.binMismatches>0?'text-danger':''}">${w.binMismatches.toLocaleString()}</td>
      <td class="text-right ${w.totalMissedScans>0?'text-danger':''}">${w.totalMissedScans.toLocaleString()}</td>
      <td class="text-right" style="color:var(--primary-orange); font-weight:700;">${w.kpiExcludedTotal.toLocaleString()}</td>
      <td class="text-center" style="font-size:11px; color:var(--text-muted);">${weekWinStr}</td>
      <td class="text-center" style="font-size:11px; color:var(--primary-blue); font-weight:700;">${avgStr}</td>
      <td class="text-right ${wAccCls}" style="font-weight:bold; font-size:13px;">${wAcc.toFixed(1)}%</td>
    </tr>`;
  }).join('');
}

// ===== Master Grid =====
function renderMasterPipelineGrid() {
  let allRows = [];
  if (activeGridScope === 'ALL') {
    Object.keys(processedCache).forEach(dayId => {
      if (processedCache[dayId]?.rows) {
        let cfg = systemState.days.find(d => d.id === dayId);
        allRows.push(...processedCache[dayId].rows.map(r => ({ ...r, dayTitle: cfg?.title || dayId })));
      }
    });
  } else {
    let dayId = systemState.activeDayId;
    if (processedCache[dayId]?.rows) {
      let cfg = systemState.days.find(d => d.id === dayId);
      allRows.push(...processedCache[dayId].rows.map(r => ({ ...r, dayTitle: cfg?.title || dayId })));
    }
  }

  const tbody = document.getElementById('masterPipelineGridBody');
  const search = document.getElementById('tableGridSearch').value.toLowerCase().trim();

  if (allRows.length === 0) { tbody.innerHTML = `<tr><td colspan="14" class="empty-state">No data processed yet.</td></tr>`; return; }

  let filtered = allRows.filter(r => {
    if (activeGridFilterMode === 'ERRORS' && (r.status === 'MATCHED' || r.status === 'ISSUED')) return false;
    if (activeGridFilterMode === 'PLACEMENT_MISMATCH' && r.status !== 'PLACEMENT_MISMATCH') return false;
    if (activeGridFilterMode === 'NOT_SCANNED' && r.status !== 'NOT_SCANNED') return false;
    if (activeGridFilterMode === 'ISSUED' && r.status !== 'ISSUED') return false;
    if (search) return r.scanBin.toLowerCase().includes(search) || r.systemBin.toLowerCase().includes(search) || r.prod.toLowerCase().includes(search) || r.batch.toLowerCase().includes(search) || (r.user && r.user.toLowerCase().includes(search));
    return true;
  });

  if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="14" class="empty-state">No records match filter.</td></tr>`; return; }

  tbody.innerHTML = filtered.map(r => {
    let badge = '';
    if (r.status === 'MATCHED') badge = `<span class="badge badge-matched">Matched</span>`;
    if (r.status === 'QTY_MISMATCH') badge = `<span class="badge badge-mismatch">Qty Var</span>`;
    if (r.status === 'PLACEMENT_MISMATCH') badge = `<span class="badge badge-placement">Bin Mismatch</span>`;
    if (r.status === 'NOT_SCANNED') badge = `<span class="badge badge-notscanned">Not Scanned</span>`;
    if (r.status === 'ISSUED') badge = `<span class="badge badge-issued">Issued</span>`;

    let varStyle = r.variance < 0 ? 'text-danger' : (r.variance > 0 ? 'text-success' : '');
    let dupsTag = r.dups > 0 ? `<br><span style="color:var(--primary-orange); font-size:10px; font-weight:700;">[${r.dups} dup]</span>` : '';
    let extOpen = trackingRowExpansionState ? 'show' : '';
    let displayUser = r.user;
    if (r.status === 'NOT_SCANNED') displayUser = r.user ? `<span style="color:var(--primary-orange); font-size:11px;">Suspect: ${r.user}</span>` : `<span style="color:var(--text-muted); font-size:11px; font-style:italic;">N/A</span>`;
    let remark = systemState.remarks[r.hashKey] || "";

    return `<tr class="master-row" onclick="toggleRowDetailDropdown(this)">
      <td style="color:var(--text-muted); font-size:9px;">▶</td>
      <td style="font-weight:600;">${r.scanBin === 'NOT SCANNED' ? '<span class="text-danger">NOT SCANNED</span>' : r.scanBin}</td>
      <td style="color:var(--text-muted);">${r.systemBin === 'NOT IN EWM' ? '<span class="badge badge-issued">NOT IN EWM</span>' : r.systemBin}</td>
      <td style="color:var(--primary-blue); font-weight:600;">${r.prod}</td>
      <td title="${r.desc || ''}" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.desc || '-'}</td>
      <td style="color:var(--text-muted);">${r.batch}</td>
      <td>${displayUser}</td>
      <td style="font-size:11px; color:var(--text-muted);">${r.time}</td>
      <td class="text-right" style="font-weight:600;">${r.countQty.toLocaleString()}${dupsTag}</td>
      <td class="text-right" style="color:var(--text-muted);">${r.ewmQty.toLocaleString()}</td>
      <td class="text-right ${varStyle}" style="font-weight:600;">${r.variance > 0 ? '+' : ''}${r.variance.toLocaleString()}</td>
      <td>${badge}</td>
      <td class="text-center">${(r.status === 'MATCHED' || r.status === 'ISSUED') ? '<span style="color:var(--border-color);">-</span>' : `<input type="checkbox" class="kpi-exclude-cb" data-hash="${r.hashKey}" style="cursor:pointer;" ${r.isExcluded ? 'checked' : ''} onclick="handleKpiCheckboxClick(event, '${r.hashKey}', this)" title="Shift+Click multi-select">`}</td>
      <td style="padding:4px 10px;"><input type="text" class="remark-input" placeholder="Justification…" value="${remark}" onchange="saveRemark('${r.hashKey}', this.value)"></td>
    </tr>
    <tr class="expanded-row ${extOpen}"><td colspan="14"><div class="expanded-box">
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:8px;">
        <div><strong>Shift:</strong> ${r.dayTitle}</div>
        <div><strong>Product:</strong> ${r.desc || 'N/A'}</div>
        <div><strong>User:</strong> ${r.status === 'NOT_SCANNED' ? (r.user ? `Suspect (${r.user})` : 'N/A') : (r.user || 'N/A')}</div>
        <div><strong>Duplicates cleaned:</strong> ${r.dups}</div>
      </div>
    </div></td></tr>`;
  }).join('');
}

// ===== SVG Trend Chart =====
function renderDualAxisSVGChart(wrapperId, volKey, accNumKey, isEwm) {
  const box = document.getElementById(wrapperId);
  box.innerHTML = '';

  const legend = document.createElement('div');
  legend.style.cssText = "display:flex; justify-content:center; gap:18px; font-size:10px; font-weight:600; color:var(--text-muted); margin-bottom:10px;";
  legend.innerHTML = `<div style="display:flex; align-items:center; gap:4px;"><span style="color:${isEwm ? 'var(--primary-blue)' : 'var(--primary-green)'};">■</span> Accuracy %</div><div style="display:flex; align-items:center; gap:4px;"><span style="color:var(--primary-orange);">■</span> Volume</div>`;
  box.appendChild(legend);

  let width = box.clientWidth || 420;
  let height = 180;
  let pL = 42, pR = 42, pT = 12, pB = 22;
  let cW = width - pL - pR, cH = height - pT - pB;

  let data = systemState.days.map(d => {
    let c = processedCache[d.id];
    let vol = c ? c.summary[volKey] : 0;
    let acc = c ? (vol > 0 ? (c.summary[accNumKey] / vol * 100) : 0) : 0;
    return { label: d.title, vol, acc };
  });

  let peakVol = Math.max(...data.map(x => x.vol), 10);
  let mag = Math.pow(10, Math.floor(Math.log10(peakVol)));
  peakVol = Math.ceil(peakVol / mag) * mag;
  if (peakVol === Math.max(...data.map(x => x.vol))) peakVol += mag;
  let stepsX = cW / data.length;

  let svgWrap = document.createElement('div');
  svgWrap.style.cssText = "flex:1; width:100%;";
  let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgWrap.appendChild(svg);
  box.appendChild(svgWrap);

  for (let i = 0; i <= 4; i++) {
    let y = pT + (cH / 4 * i);
    let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", pL); line.setAttribute("y1", y); line.setAttribute("x2", width - pR); line.setAttribute("y2", y);
    line.setAttribute("stroke", "rgba(148,163,184,0.1)");
    svg.appendChild(line);

    let accLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    accLabel.setAttribute("x", pL - 8); accLabel.setAttribute("y", y + 3);
    accLabel.setAttribute("text-anchor", "end"); accLabel.setAttribute("fill", "var(--text-muted)");
    accLabel.setAttribute("font-size", "9px"); accLabel.textContent = (100 - i * 25) + "%";
    svg.appendChild(accLabel);

    let volLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    volLabel.setAttribute("x", width - pR + 8); volLabel.setAttribute("y", y + 3);
    volLabel.setAttribute("text-anchor", "start"); volLabel.setAttribute("fill", "var(--text-muted)");
    volLabel.setAttribute("font-size", "9px"); volLabel.textContent = Math.round(peakVol - (i * peakVol / 4));
    svg.appendChild(volLabel);
  }

  let points = [];
  data.forEach((d, i) => {
    let cx = pL + (i * stepsX) + (stepsX / 2);
    let barH = (d.acc / 100) * cH;
    if (d.acc > 0) {
      let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", cx - stepsX * 0.26); rect.setAttribute("y", pT + cH - barH);
      rect.setAttribute("width", stepsX * 0.52); rect.setAttribute("height", barH);
      rect.setAttribute("fill", isEwm ? "var(--primary-blue)" : "var(--primary-green)");
      rect.setAttribute("opacity", "0.8"); rect.setAttribute("rx", "3");
      svg.appendChild(rect);
    }
    points.push({ x: cx, y: pT + cH - ((d.vol / peakVol) * cH) });

    let txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.setAttribute("x", cx); txt.setAttribute("y", height - 3);
    txt.setAttribute("text-anchor", "middle"); txt.setAttribute("fill", "var(--text-muted)");
    txt.setAttribute("font-size", "10px"); txt.textContent = d.label;
    svg.appendChild(txt);
  });

  if (points.length > 0) {
    let poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("fill", "none"); poly.setAttribute("stroke", "var(--primary-orange)");
    poly.setAttribute("stroke-width", "2.5");
    poly.setAttribute("points", points.map(p => `${p.x},${p.y}`).join(' '));
    svg.appendChild(poly);
    points.forEach(p => {
      let dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y); dot.setAttribute("r", "3.5");
      dot.setAttribute("fill", "var(--surface-color)"); dot.setAttribute("stroke", "var(--primary-orange)"); dot.setAttribute("stroke-width", "2");
      svg.appendChild(dot);
    });
  }
}
