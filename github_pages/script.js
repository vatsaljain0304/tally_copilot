// =====================================================================
// Tally Copilot - Real-World Live Verification Console JavaScript
// =====================================================================

// Global State
const urlParams = new URLSearchParams(window.location.search);
let apiBase = urlParams.get('backend') || localStorage.getItem('tally_copilot_api_base') || 'http://localhost:8000';
if (urlParams.get('backend')) {
  localStorage.setItem('tally_copilot_api_base', apiBase);
}

let activePredictions = [];
let activeRankings = [];
let activeActions = [];
let activeDiscrepancies = [];

// DOM Elements
const backendUrlInput = document.getElementById('backendUrl');
const btnConnect = document.getElementById('btnConnect');
const btnSyncTally = document.getElementById('btnSyncTally');
const btnSyncDemo = document.getElementById('btnSyncDemo');
const fileTallyXml = document.getElementById('fileTallyXml');
const btnUploadXml = document.getElementById('btnUploadXml');
const toggleInstBtn = document.getElementById('toggleInstBtn');
const instructionsPanel = document.getElementById('instructionsPanel');

const backendDot = document.getElementById('backendDot');
const backendStatusText = document.getElementById('backendStatusText');
const tallyDot = document.getElementById('tallyDot');
const tallyStatusText = document.getElementById('tallyStatusText');
const sessionStatusBadge = document.getElementById('sessionStatusBadge');

// Initialize UI
backendUrlInput.value = apiBase;

function formatCurrency(val) {
  const num = parseFloat(val) || 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------
// Instructions Toggle
// ---------------------------------------------------------------------
toggleInstBtn.addEventListener('click', () => {
  const isHidden = instructionsPanel.style.display === 'none';
  instructionsPanel.style.display = isHidden ? 'block' : 'none';
  toggleInstBtn.textContent = isHidden ? '✕ Close Guide' : '📘 Testing Guide';
});

// ---------------------------------------------------------------------
// Tab Switching
// ---------------------------------------------------------------------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const targetId = btn.getAttribute('data-tab');
    const targetContent = document.getElementById(targetId);
    if (targetContent) targetContent.classList.add('active');

    // Auto refresh tab data on switch
    if (targetId === 'tab-report') loadReport();
  });
});

// ---------------------------------------------------------------------
// Backend Health & Connectivity
// ---------------------------------------------------------------------
async function checkBackendHealth() {
  apiBase = backendUrlInput.value.trim().replace(/\/+$/, '');
  localStorage.setItem('tally_copilot_api_base', apiBase);

  backendStatusText.textContent = 'Backend: Connecting...';
  backendDot.className = 'status-dot';

  try {
    const res = await fetch(`${apiBase}/health`, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    backendDot.className = 'status-dot active';
    backendStatusText.textContent = 'Backend: Connected';

    if (data.tally_online) {
      tallyDot.className = 'status-dot active';
      tallyStatusText.textContent = `Tally: Online (${data.company || 'Ready'})`;
    } else {
      tallyDot.className = 'status-dot error';
      tallyStatusText.textContent = 'Tally: Offline (Port 9000)';
    }

    sessionStatusBadge.textContent = data.mode === 'live' ? 'Live Tally Mode' : (data.mode === 'demo' ? 'Sample Demo Mode' : 'Connected');
    sessionStatusBadge.className = data.mode === 'live' ? 'badge badge-success' : 'badge badge-warning';

    return true;
  } catch (err) {
    backendDot.className = 'status-dot error';
    backendStatusText.textContent = 'Backend: Unreachable';
    tallyDot.className = 'status-dot error';
    tallyStatusText.textContent = 'Tally: Unknown';
    sessionStatusBadge.textContent = 'Offline';
    sessionStatusBadge.className = 'badge badge-danger';
    return false;
  }
}

btnConnect.addEventListener('click', async () => {
  const ok = await checkBackendHealth();
  if (ok) {
    await refreshAllData();
  } else {
    alert(`Could not connect to backend at ${backendUrlInput.value}.\n\nMake sure the local backend or ngrok tunnel is running.`);
  }
});

// ---------------------------------------------------------------------
// Tally Sync Actions (Live vs Demo)
// ---------------------------------------------------------------------
async function syncData(mode = 'live', silent = false) {
  const isHealthy = await checkBackendHealth();
  if (!isHealthy) {
    if (!silent) alert('Please connect to the backend first.');
    return;
  }

  const btn = mode === 'live' ? btnSyncTally : btnSyncDemo;
  const originalText = btn.textContent;
  if (!silent) {
    btn.textContent = '⏳ Syncing...';
    btn.disabled = true;
  }

  try {
    const res = await fetch(`${apiBase}/api/tally/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: mode }),
      mode: 'cors'
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.detail?.message || errData.detail || `Server responded with ${res.status}`;
      throw new Error(msg);
    }

    const data = await res.json();
    if (!silent) {
      alert(`✅ Successfully synced ${mode === 'live' ? 'Live Tally' : 'Sample Dataset'}!\n\nCompany: ${data.company}\nReceivables: ${formatCurrency(data.summary?.receivables)}\nCash: ${formatCurrency(data.summary?.cash_balance)}`);
    }
    await refreshAllData();
  } catch (err) {
    if (!silent) {
      alert(`❌ Sync Failed: ${err.message}\n\nTip: If testing without live TallyPrime running, click "Load Sample Data" instead.`);
    }
  } finally {
    if (!silent) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
}

// Auto-Sync Timer (Live polling Tally every 30 seconds)
let autoSyncTimer = null;
const chkAutoSync = document.getElementById('chkAutoSync');
if (chkAutoSync) {
  chkAutoSync.addEventListener('change', (e) => {
    if (e.target.checked) {
      syncData('live', true);
      autoSyncTimer = setInterval(() => {
        syncData('live', true);
      }, 30000);
    } else {
      if (autoSyncTimer) clearInterval(autoSyncTimer);
      autoSyncTimer = null;
    }
  });
}

btnSyncTally.addEventListener('click', () => syncData('live'));
btnSyncDemo.addEventListener('click', () => syncData('demo'));

// ---------------------------------------------------------------------
// Tally XML File Upload Handler (No-Install Mode)
// ---------------------------------------------------------------------
btnUploadXml.addEventListener('click', () => {
  fileTallyXml.click();
});

fileTallyXml.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const originalText = btnUploadXml.textContent;
  btnUploadXml.textContent = '⏳ Reading XML...';
  btnUploadXml.disabled = true;

  try {
    const textContent = await file.text();
    const res = await fetch(`${apiBase}/api/tally/upload-xml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xml: textContent, company: file.name.replace('.xml', '') }),
      mode: 'cors'
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Server responded with ${res.status}`);
    }

    const data = await res.json();
    alert(`✅ Tally XML File Loaded!\n\nCompany: ${data.company}\nParties: ${data.summary?.parties}\nInvoices: ${data.summary?.bills}\nTotal Receivables: ${formatCurrency(data.summary?.receivables)}\nCash Balance: ${formatCurrency(data.summary?.cash_balance)}`);
    await refreshAllData();
  } catch (err) {
    alert(`❌ Could not process Tally XML file: ${err.message}\n\nMake sure the file was exported from Tally in XML format.`);
  } finally {
    btnUploadXml.textContent = originalText;
    btnUploadXml.disabled = false;
    fileTallyXml.value = '';
  }
});

// ---------------------------------------------------------------------
// Data Refresh Aggregator
// ---------------------------------------------------------------------
async function refreshAllData() {
  await Promise.allSettled([
    loadRunway(),
    loadPredictions(),
    loadPriority(),
    loadWhatsApp(),
    loadDiscrepancies(),
    loadReport()
  ]);
}

// ---------------------------------------------------------------------
// Tab 1: Cash Runway Logic
// ---------------------------------------------------------------------
async function loadRunway() {
  try {
    const res = await fetch(`${apiBase}/api/runway`, { mode: 'cors' });
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('rwCashNow').textContent = formatCurrency(data.cash_now);

    const tblBody = document.querySelector('#tblRunway tbody');
    if (!data.horizons || data.horizons.length === 0) {
      tblBody.innerHTML = '<tr><td colspan="8" class="text-center">No forecast data.</td></tr>';
      return;
    }

    tblBody.innerHTML = '';
    let minClosingSafe = Infinity;

    data.horizons.forEach(h => {
      const isShort = h.short;
      if (h.closing_safe < minClosingSafe) minClosingSafe = h.closing_safe;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${h.days} Days</strong></td>
        <td class="font-mono">${formatCurrency(h.cash_now)}</td>
        <td class="font-mono" style="color: var(--success);">${formatCurrency(h.inflow_expected)}</td>
        <td class="font-mono" style="color: var(--primary); font-weight: 600;">${formatCurrency(h.inflow_low)}</td>
        <td class="font-mono" style="color: var(--warning);">${formatCurrency(h.supplier_payments)}</td>
        <td class="font-mono">${formatCurrency(h.running_costs)}</td>
        <td class="font-mono" style="font-weight: 700; color: ${isShort ? 'var(--danger)' : 'var(--text-main)'};">
          ${formatCurrency(h.closing_safe)}
        </td>
        <td>
          <span class="badge ${isShort ? 'badge-danger' : 'badge-success'}">
            ${isShort ? `Deficit (-${formatCurrency(h.to_collect_to_stay_positive)})` : 'Safe'}
          </span>
        </td>
      `;
      tblBody.appendChild(tr);
    });

    document.getElementById('rwSafeClosing').textContent = formatCurrency(minClosingSafe);
  } catch (err) {
    console.error('Error loading runway:', err);
  }
}

// ---------------------------------------------------------------------
// Tab 2: Predictions Logic
// ---------------------------------------------------------------------
async function loadPredictions() {
  try {
    const res = await fetch(`${apiBase}/api/predict`, { mode: 'cors' });
    if (!res.ok) return;
    const data = await res.json();
    activePredictions = data.items || [];

    const tblBody = document.querySelector('#tblPredictions tbody');
    if (activePredictions.length === 0) {
      tblBody.innerHTML = '<tr><td colspan="10" class="text-center">No open invoices found.</td></tr>';
      return;
    }

    tblBody.innerHTML = '';
    let totalReceivables = 0;

    activePredictions.forEach(inv => {
      totalReceivables += (inv.amount || 0);
      const tr = document.createElement('tr');

      let badgeClass = 'badge-success';
      if (inv.risk_tier === 'CRITICAL') badgeClass = 'badge-danger';
      else if (inv.risk_tier === 'HIGH' || inv.risk_tier === 'MEDIUM') badgeClass = 'badge-warning';

      tr.innerHTML = `
        <td class="font-mono"><strong>${inv.invoice_id}</strong></td>
        <td>${inv.customer}</td>
        <td>${inv.bill_date}</td>
        <td>${inv.due_date}</td>
        <td class="font-mono" style="color: ${inv.overdue_days > 0 ? 'var(--danger)' : 'inherit'};">
          ${inv.overdue_days}d
        </td>
        <td class="font-mono" style="font-weight: 600;">${formatCurrency(inv.amount)}</td>
        <td class="font-mono" style="color: var(--primary);">${inv.expected_date}</td>
        <td class="font-mono">${Math.round((inv.probability_14d || 0) * 100)}%</td>
        <td><span class="badge ${badgeClass}">${inv.risk_tier}</span></td>
        <td>
          <button class="btn-outline btn-sm btn-report-disc" data-ref="${inv.invoice_id}" data-customer="${inv.customer}" data-exp="${inv.expected_date}" data-prob="${inv.probability_14d}">
            ⚠️ Discrepancy
          </button>
        </td>
      `;
      tblBody.appendChild(tr);
    });

    document.getElementById('rwReceivables').textContent = formatCurrency(totalReceivables);
    document.getElementById('rwBillsCount').textContent = `${activePredictions.length} open bills`;

    // Attach Discrepancy modal openers
    document.querySelectorAll('.btn-report-disc').forEach(btn => {
      btn.addEventListener('click', () => {
        const ref = btn.getAttribute('data-ref');
        const cust = btn.getAttribute('data-customer');
        const expDate = btn.getAttribute('data-exp');
        const prob = Math.round(parseFloat(btn.getAttribute('data-prob') || 0) * 100);

        openDiscrepancyModal({
          category: 'prediction_error',
          entity: `${ref} (${cust})`,
          copilotOutput: `Expected: ${expDate} (${prob}% chance in 14d)`,
          expected: '',
          notes: ''
        });
      });
    });

  } catch (err) {
    console.error('Error loading predictions:', err);
  }
}

document.getElementById('btnRefreshPredictions').addEventListener('click', loadPredictions);

// ---------------------------------------------------------------------
// Tab 3: Priority Collections Logic
// ---------------------------------------------------------------------
async function loadPriority() {
  try {
    const res = await fetch(`${apiBase}/api/priority`, { mode: 'cors' });
    if (!res.ok) return;
    const data = await res.json();
    activeRankings = data.items || [];

    const tblBody = document.querySelector('#tblPriority tbody');
    if (activeRankings.length === 0) {
      tblBody.innerHTML = '<tr><td colspan="7" class="text-center">No priority items found.</td></tr>';
      return;
    }

    tblBody.innerHTML = '';
    activeRankings.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono"><strong>#${idx + 1} (${r.score})</strong></td>
        <td><strong>${r.party}</strong></td>
        <td class="font-mono">${r.phone || 'N/A'}</td>
        <td class="font-mono" style="font-weight: 600; color: var(--danger);">${formatCurrency(r.amount)}</td>
        <td><span class="badge badge-info">${r.tone}</span></td>
        <td style="font-size: 0.85rem; color: var(--text-muted);">${r.reason || 'Dues pending'}</td>
        <td>
          <button class="btn-primary btn-sm btn-draft-wa" data-party="${r.party}" data-tone="${r.tone}">
            💬 Draft WhatsApp
          </button>
        </td>
      `;
      tblBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-draft-wa').forEach(btn => {
      btn.addEventListener('click', async () => {
        const party = btn.getAttribute('data-party');
        const tone = btn.getAttribute('data-tone');
        await draftWhatsAppMessage(party, tone);
      });
    });

  } catch (err) {
    console.error('Error loading priority:', err);
  }
}

async function draftWhatsAppMessage(partyName, tone = 'friendly') {
  try {
    const res = await fetch(`${apiBase}/api/action/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ party_name: partyName, tone: tone }),
      mode: 'cors'
    });
    if (!res.ok) throw new Error('Failed to draft WhatsApp message');
    await loadWhatsApp();

    // Switch to WhatsApp tab
    document.querySelector('.tab-btn[data-tab="tab-whatsapp"]').click();
  } catch (err) {
    alert(`Could not draft WhatsApp reminder: ${err.message}`);
  }
}

// ---------------------------------------------------------------------
// Tab 4: WhatsApp Actions & Live Dispatch Tracking
// ---------------------------------------------------------------------
async function loadWhatsApp() {
  try {
    const res = await fetch(`${apiBase}/api/action/list`, { mode: 'cors' });
    if (!res.ok) return;
    const data = await res.json();
    activeActions = data.messages || [];
    const summary = data.summary || { total_drafted: 0, total_pushed: 0, push_rate: '0.0%' };

    // Update Counters
    document.getElementById('tabCountPushed').textContent = summary.total_pushed;
    document.getElementById('tabCountDrafted').textContent = summary.total_drafted;
    document.getElementById('badgePushStats').textContent = `${summary.total_pushed} Pushed / ${summary.total_drafted} Drafted (${summary.push_rate})`;

    const container = document.getElementById('whatsappListContainer');
    if (activeActions.length === 0) {
      container.innerHTML = `
        <div class="card text-center" style="padding: 3rem;">
          <p style="color: var(--text-muted);">No reminders drafted yet. Click "Draft WhatsApp" in Priority tab or click "+ New Reminder".</p>
        </div>`;
      return;
    }

    container.innerHTML = '';
    activeActions.forEach(m => {
      const isPushed = ['pushed', 'pushed_whatsapp_web', 'marked_sent'].includes(m.status);
      const isSkipped = m.status === 'skipped';

      let statusBadge = `<span class="badge badge-warning">Drafted</span>`;
      if (isPushed) statusBadge = `<span class="badge badge-success">✓ Pushed (${m.status})</span>`;
      if (isSkipped) statusBadge = `<span class="badge badge-info">Skipped</span>`;

      const card = document.createElement('div');
      card.className = 'action-card';
      card.innerHTML = `
        <div class="action-header">
          <div>
            <strong>${m.party}</strong> &nbsp;
            <span class="font-mono" style="font-size: 0.85rem; color: var(--text-muted);">${m.phone || 'No phone'}</span> &nbsp;
            <span class="badge badge-info">${m.tone || 'tone'}</span>
          </div>
          <div>
            <span class="font-mono" style="font-weight: 700; margin-right: 0.75rem;">${formatCurrency(m.amount)}</span>
            ${statusBadge}
          </div>
        </div>
        <div class="action-body">
          <textarea class="action-text-box" id="waText_${m.id}">${m.text || ''}</textarea>
        </div>
        <div class="action-footer">
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            Created: ${new Date(m.created_at || Date.now()).toLocaleTimeString()}
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button class="btn-success btn-sm btn-send-web" data-id="${m.id}" data-phone="${m.phone}" data-party="${m.party}">
              🟢 Send via WhatsApp Web
            </button>
            <button class="btn-primary btn-sm btn-mark-sent" data-id="${m.id}" data-party="${m.party}" data-phone="${m.phone}">
              🔵 Mark as Pushed
            </button>
            <button class="btn-outline btn-sm btn-skip" data-id="${m.id}" data-party="${m.party}">
              ⚪ Skip
            </button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // Wire dispatch handlers
    document.querySelectorAll('.btn-send-web').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const phone = btn.getAttribute('data-phone');
        const party = btn.getAttribute('data-party');
        const text = document.getElementById(`waText_${id}`).value;

        // Clean phone number
        const cleanPhone = (phone || '').replace(/[^\d]/g, '');
        const encodedText = encodeURIComponent(text);
        const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedText}` : `https://web.whatsapp.com/`;

        // Open WhatsApp Web in new tab
        window.open(waUrl, '_blank');

        // Record push event on backend
        await pushStatus(id, party, cleanPhone, text, 'whatsapp_web', 'pushed_whatsapp_web');
      });
    });

    document.querySelectorAll('.btn-mark-sent').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const phone = btn.getAttribute('data-phone');
        const party = btn.getAttribute('data-party');
        const text = document.getElementById(`waText_${id}`).value;
        await pushStatus(id, party, phone, text, 'manual_record', 'marked_sent');
      });
    });

    document.querySelectorAll('.btn-skip').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const party = btn.getAttribute('data-party');
        const text = document.getElementById(`waText_${id}`).value;
        await pushStatus(id, party, '', text, 'skipped', 'skipped');
      });
    });

  } catch (err) {
    console.error('Error loading WhatsApp actions:', err);
  }
}

async function pushStatus(id, party, phone, text, pushType, status) {
  try {
    const res = await fetch(`${apiBase}/api/action/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: id,
        party: party,
        phone: phone,
        text: text,
        push_type: pushType,
        status: status
      }),
      mode: 'cors'
    });
    if (!res.ok) throw new Error('Status update failed');
    await loadWhatsApp();
  } catch (err) {
    alert(`Could not record push status: ${err.message}`);
  }
}

document.getElementById('btnCreateCustomDraft').addEventListener('click', () => {
  const party = prompt('Enter Customer / Debtor Name:');
  if (party) draftWhatsAppMessage(party, 'friendly');
});

// ---------------------------------------------------------------------
// Tab 5: Discrepancies Log & Modal Logic
// ---------------------------------------------------------------------
const modalDiscrepancy = document.getElementById('modalDiscrepancy');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');
const formDiscrepancy = document.getElementById('formDiscrepancy');

function openDiscrepancyModal(prefill = {}) {
  document.getElementById('discCategory').value = prefill.category || 'prediction_error';
  document.getElementById('discEntity').value = prefill.entity || '';
  document.getElementById('discCopilotOutput').value = prefill.copilotOutput || '';
  document.getElementById('discExpected').value = prefill.expected || '';
  document.getElementById('discNotes').value = prefill.notes || '';
  modalDiscrepancy.style.display = 'flex';
}

function closeDiscrepancyModal() {
  modalDiscrepancy.style.display = 'none';
}

btnCloseModal.addEventListener('click', closeDiscrepancyModal);
btnCancelModal.addEventListener('click', closeDiscrepancyModal);
document.getElementById('btnOpenNewDiscrepancyModal').addEventListener('click', () => openDiscrepancyModal());

formDiscrepancy.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    category: document.getElementById('discCategory').value,
    entity: document.getElementById('discEntity').value,
    copilot_output: document.getElementById('discCopilotOutput').value,
    user_expected: document.getElementById('discExpected').value,
    tester_notes: document.getElementById('discNotes').value,
  };

  try {
    const res = await fetch(`${apiBase}/api/discrepancy/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors'
    });
    if (!res.ok) throw new Error('Failed to record discrepancy');
    closeDiscrepancyModal();
    alert('✅ Discrepancy successfully logged in session audit!');
    await loadDiscrepancies();
    await loadReport();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
});

async function loadDiscrepancies() {
  try {
    const res = await fetch(`${apiBase}/api/discrepancies`, { mode: 'cors' });
    if (!res.ok) return;
    const data = await res.json();
    activeDiscrepancies = data.discrepancies || [];

    document.getElementById('tabCountDisc').textContent = activeDiscrepancies.length;

    const tblBody = document.querySelector('#tblDiscrepancies tbody');
    if (activeDiscrepancies.length === 0) {
      tblBody.innerHTML = '<tr><td colspan="6" class="text-center">No discrepancies recorded yet.</td></tr>';
      return;
    }

    tblBody.innerHTML = '';
    activeDiscrepancies.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono" style="font-size: 0.8rem;">${new Date(d.timestamp).toLocaleTimeString()}</td>
        <td><span class="badge badge-warning">${d.category}</span></td>
        <td><strong>${d.entity}</strong></td>
        <td style="color: var(--primary);">${d.copilot_output}</td>
        <td style="color: var(--danger); font-weight: 600;">${d.user_expected}</td>
        <td style="font-size: 0.85rem; color: var(--text-muted);">${d.tester_notes || ''}</td>
      `;
      tblBody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading discrepancies:', err);
  }
}

// ---------------------------------------------------------------------
// Tab 6: Audit Report & Download Logic
// ---------------------------------------------------------------------
async function loadReport() {
  try {
    const res = await fetch(`${apiBase}/api/report`, { mode: 'cors' });
    if (!res.ok) return;
    const rep = await res.json();

    document.getElementById('repCompany').textContent = rep.environment?.company_name || 'N/A';
    document.getElementById('repMode').textContent = `Mode: ${rep.environment?.mode?.toUpperCase() || 'N/A'}`;
    document.getElementById('repInvoices').textContent = rep.testing_metrics?.invoices_evaluated || 0;
    document.getElementById('repPushRate').textContent = rep.testing_metrics?.whatsapp_push_conversion_rate || '0.0%';
    document.getElementById('repPushDetail').textContent = `${rep.testing_metrics?.whatsapp_pushed || 0} pushed / ${rep.testing_metrics?.whatsapp_drafted || 0} drafted`;
    document.getElementById('repDiscCount').textContent = rep.testing_metrics?.discrepancies_recorded_count || 0;

    // Load readable summary preview
    const txtRes = await fetch(`${apiBase}/api/report/download?format=txt`, { mode: 'cors' });
    if (txtRes.ok) {
      const textPreview = await txtRes.text();
      document.getElementById('preReportText').textContent = textPreview;
    }
  } catch (err) {
    console.error('Error loading report:', err);
  }
}

document.getElementById('btnRefreshReport').addEventListener('click', loadReport);

async function downloadReportFile(format = 'json') {
  try {
    const res = await fetch(`${apiBase}/api/report/download?format=${format}`, { mode: 'cors' });
    if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tally_copilot_verification_report.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Could not download report: ${err.message}`);
  }
}

document.getElementById('btnDownloadJson').addEventListener('click', () => downloadReportFile('json'));
document.getElementById('btnDownloadTxt').addEventListener('click', () => downloadReportFile('txt'));

// ---------------------------------------------------------------------
// Startup Check
// ---------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  checkBackendHealth().then(ok => {
    if (ok) refreshAllData();
  });
});
