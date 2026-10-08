(() => {
  const REGIONS = ['', 'Nordamerika', 'Europa', 'Asien-Pazifik', 'Lateinamerika', 'Naher Osten & Afrika', 'Andere'];
  const $ = (id) => document.getElementById(id);
  let items = [];
  let editing = null; // Kandidat beim Bearbeiten
  let picked = null;  // Suchtreffer beim Neuerfassen

  // ---------- Hilfsfunktionen ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const fmtPrice = (p, cur) => p == null ? '–' : new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p) + (cur ? ' ' + cur : '');
  const fmtDate = (d) => d ? new Date(d).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const fmtDay = (d) => d ? new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  // Aktueller Kurs + Veränderung seit Erfassung (nur wenn der Kurs inzwischen aktualisiert wurde)
  const currentBlock = (i) => {
    if (i.entry_price == null || i.price == null || !i.price_updated_at) return '';
    const pct = (i.price / i.entry_price - 1) * 100;
    const cls = pct >= 0 ? 'pos' : 'neg';
    const sign = pct >= 0 ? '+' : '';
    return `<div class="cur">Aktuell ${esc(fmtPrice(i.price, i.currency))} <b class="${cls}">${sign}${pct.toFixed(1)}%</b></div><div class="upd">Stand ${esc(fmtDate(i.price_updated_at))}</div>`;
  };
  const pctOf = (i) => (i.entry_price != null && i.price != null && Number(i.entry_price) !== 0) ? (i.price / i.entry_price - 1) * 100 : null;
  const pctHtml = (p) => p == null ? '<span class="muted">–</span>' : `<b class="${p >= 0 ? 'pos' : 'neg'}">${p >= 0 ? '+' : ''}${p.toFixed(1)}%</b>`;
  const fmtNum = (p) => p == null ? '–' : new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p);
  const fmtShort = (d) => d ? new Date(d).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
  const fmtIso = (d) => d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '';
  const fmtIsoShort = (d) => d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(2, 4) : '';
  const fmtFull = (d) => d ? new Date(d).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const fmtQty = (q) => new Intl.NumberFormat('de-CH', { maximumFractionDigits: 4 }).format(q);
  const todayIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const parseNum = (v) => { const t = String(v ?? '').trim().replace(/['\s]/g, '').replace(',', '.'); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; };
  // Veränderung seit Kauf: nur beim Kauf eines Titels sinnvoll (bei Optionen ist der Preis die Prämie)
  const invPct = (i) => (i.inv_type === 'Kauf Titel' && i.inv_price > 0 && i.price != null) ? (i.price / i.inv_price - 1) * 100 : null;
  const invBlock = (i) => {
    if (!i.inv_type) return '';
    const chips = [
      i.inv_type,
      i.inv_date ? fmtIso(i.inv_date) : '',
      i.inv_qty != null ? 'Anzahl ' + fmtQty(i.inv_qty) : '',
      i.inv_price != null ? 'Preis ' + fmtPrice(i.inv_price, i.currency) : ''
    ].filter(Boolean).map((v) => `<span class="chip">${esc(v)}</span>`).join('');
    const p = invPct(i);
    return `<div class="invbox">
      <div class="ih">● Investment getätigt</div>
      <div class="invmeta">${chips}</div>
      ${p != null ? `<div class="ir">Seit Kauf: ${pctHtml(p)}</div>` : ''}
      ${i.inv_details ? `<div class="ir">${esc(i.inv_details)}</div>` : ''}
      <div class="is">Begründung</div>
      <div class="ir" style="margin-top:2px">${esc(i.inv_rationale || '')}</div>
      ${i.inv_saved_at ? `<div class="is">Erstmals erfasst am ${esc(fmtFull(i.inv_saved_at))}</div>` : ''}
    </div>`;
  };
  let invFor = null;
  let invBack = false;
  let view = localStorage.getItem('view') === 'cards' ? 'cards' : 'dash';
  let detailId = null;
  let toastTimer;
  const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.style.display = 'none'), 2500); };

  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const code = localStorage.getItem('accessCode');
    if (code) headers['x-access-code'] = code;
    const res = await fetch('/api' + path, { ...opts, headers });
    if (res.status === 401) {
      await askCode();
      return api(path, opts);
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Fehler ' + res.status);
    return data;
  }

  let codeWait = null;
  function askCode() {
    if (codeWait) return codeWait;
    codeWait = new Promise((resolve) => {
      const dlg = $('codeDlg');
      $('codeForm').onsubmit = () => { localStorage.setItem('accessCode', $('codeInput').value); codeWait = null; resolve(); };
      dlg.showModal();
    });
    return codeWait;
  }

  // ---------- Liste ----------
  function fillFilters() {
    const sectors = [...new Set(items.map((i) => i.sector).filter(Boolean))].sort();
    const regions = [...new Set(items.map((i) => i.region).filter(Boolean))].sort();
    const keep = (sel, label, vals) => {
      const cur = sel.value;
      sel.innerHTML = `<option value="">${label}</option>` + vals.map((v) => `<option>${esc(v)}</option>`).join('');
      sel.value = vals.includes(cur) ? cur : '';
    };
    keep($('fSector'), 'Sektor', sectors);
    keep($('fRegion'), 'Region', regions);
  }

  function sortedItems(arr) {
    const mode = $('fSort').value;
    const a = [...arr];
    if (mode === 'perf') a.sort((x, y) => (pctOf(y) ?? -Infinity) - (pctOf(x) ?? -Infinity));
    else if (mode === 'name') a.sort((x, y) => x.name.localeCompare(y.name, 'de'));
    else a.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
    return a;
  }

  function render() {
    const q = $('q').value.trim().toLowerCase();
    const fs = $('fSector').value, fr = $('fRegion').value, fst = $('fStatus').value;
    const shown = sortedItems(items.filter((i) =>
      (!q || (i.name + ' ' + i.symbol + ' ' + (i.notes || '') + ' ' + (i.inv_rationale || '')).toLowerCase().includes(q)) &&
      (!fs || i.sector === fs) && (!fr || i.region === fr) &&
      (!fst || (fst === 'inv') === !!i.inv_type)));

    $('dash').hidden = view !== 'dash';
    $('list').hidden = view !== 'cards';
    $('vDash').classList.toggle('on', view === 'dash');
    $('vCards').classList.toggle('on', view === 'cards');

    const emptyHtml = `<div class="empty">${items.length ? 'Keine Treffer.' : 'Noch keine Candidates.<br>Tippe auf + um den ersten zu erfassen.'}</div>`;

    if (view === 'dash') {
      $('dash').innerHTML = !shown.length ? emptyHtml :
        '<div class="dhead"><span>Candidate</span><span>Erfasst</span><span>Aktuell</span><span>%</span></div>' +
        shown.map((i) => `
        <div class="drow${i.inv_type ? ' invested' : ''}" data-id="${i.id}" role="button" tabindex="0">
          <div class="dn"><div class="name">${esc(i.name)}</div><div class="sym">${esc(i.symbol)}${i.currency ? ' · ' + esc(i.currency) : ''}</div>${i.inv_type ? `<div class="inv">● ${esc(i.inv_type)} · ${esc(fmtIsoShort(i.inv_date))}</div>` : ''}${window.marketFlags ? window.marketFlags(i) : ''}</div>
          <div class="dc"><div>${esc(fmtNum(i.entry_price))}</div><div class="sym">${esc(fmtShort(i.created_at))}</div></div>
          <div class="dc"><div>${esc(fmtNum(i.price))}</div><div class="sym">${esc(fmtShort(i.price_updated_at))}</div></div>
          <div class="dp">${pctHtml(pctOf(i))}</div>
        </div>`).join('');
      return;
    }

    const list = $('list');
    if (!shown.length) { list.innerHTML = emptyHtml; return; }
    list.innerHTML = shown.map((i) => `
      <article class="card" data-id="${i.id}">
        <div class="row">
          <div><div class="name">${esc(i.name)}</div><div class="sym">${esc(i.symbol)}</div></div>
          <div><div class="price">${esc(fmtPrice(i.entry_price, i.currency))}</div><div class="upd">Erfassungskurs ${esc(fmtDay(i.created_at))}</div>${currentBlock(i)}</div>
        </div>
        <div class="chips">
          ${[i.sector, i.country, i.region].filter(Boolean).map((v) => `<span class="chip">${esc(v)}</span>`).join('')}
        </div>
        ${invBlock(i)}
        ${i.notes ? `<div class="notes">${esc(i.notes)}</div>` : ''}
        ${(i.links || []).length ? `<div class="links">${i.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(l.title || host(l.url))}</a>`).join('')}</div>` : ''}
        <div class="actions"><button type="button" data-act="inv">${i.inv_type ? 'Investment bearbeiten' : 'Investment erfassen'}</button><button type="button" data-act="edit">Bearbeiten</button><button type="button" class="del" data-act="del">Löschen</button></div>
      </article>`).join('');
  }

  // ---------- Details ----------
  function openDetail(id) {
    const i = items.find((x) => x.id === id);
    if (!i) return;
    detailId = id;
    $('dInv').textContent = i.inv_type ? 'Investment bearbeiten' : 'Investment erfassen';
    $('detailBody').innerHTML = `
      <div class="name" style="font-size:20px">${esc(i.name)}</div>
      <div class="sym">${esc(i.symbol)}</div>
      <div class="chips">${[i.sector, i.country, i.region].filter(Boolean).map((v) => `<span class="chip">${esc(v)}</span>`).join('')}</div>
      <div class="dgrid" style="margin-top:14px">
        <div class="dbox"><div class="lbl">Erfassungskurs</div><div class="val">${esc(fmtNum(i.entry_price))}</div><div class="sub">${esc(fmtDay(i.created_at))}${i.currency ? ' · ' + esc(i.currency) : ''}</div></div>
        <div class="dbox"><div class="lbl">Aktuell</div><div class="val">${esc(fmtNum(i.price))}</div><div class="sub">${i.price_updated_at ? esc(fmtDate(i.price_updated_at)) : ''}</div></div>
        <div class="dbox"><div class="lbl">Veränderung</div><div class="val">${pctHtml(pctOf(i))}</div><div class="sub">seit Erfassung</div></div>
      </div>
      ${invBlock(i)}
      ${window.marketHints ? window.marketHints(i, 'Marktsicht-Abgleich') : ''}
      ${i.notes ? `<div class="notes">${esc(i.notes)}</div>` : ''}
      ${(i.links || []).length ? `<div class="links">${i.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(l.title || host(l.url))}</a>`).join('')}</div>` : ''}`;
    $('detailDlg').showModal();
  }

  $('dash').addEventListener('click', (ev) => {
    const r = ev.target.closest('.drow');
    if (r) openDetail(Number(r.dataset.id));
  });
  $('dash').addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const r = ev.target.closest('.drow');
    if (r) openDetail(Number(r.dataset.id));
  });
  $('dClose').onclick = () => $('detailDlg').close();
  $('dInv').onclick = () => {
    const c = items.find((x) => x.id === detailId);
    $('detailDlg').close();
    if (c) openInv(c, true);
  };
  $('dEdit').onclick = () => {
    const c = items.find((x) => x.id === detailId);
    $('detailDlg').close();
    if (c) openDialog(c);
  };
  $('dDel').onclick = async () => {
    const c = items.find((x) => x.id === detailId);
    if (!c || !confirm(`«${c.name}» löschen?`)) return;
    await api('/candidates/' + c.id, { method: 'DELETE' });
    $('detailDlg').close();
    await load();
  };

  const setView = (v) => { view = v; localStorage.setItem('view', v); render(); };
  $('vDash').onclick = () => setView('dash');
  $('vCards').onclick = () => setView('cards');

  async function load() {
    try {
      items = await api('/candidates');
      fillFilters();
      render();
    } catch (e) {
      $('list').innerHTML = `<div class="empty">Laden fehlgeschlagen:<br>${esc(e.message)}</div>`;
    }
  }

  // ---------- Dialog ----------
  function renderLinks(links) {
    const box = $('links');
    box.innerHTML = '';
    (links.length ? links : [{ url: '', title: '' }]).forEach((l) => addLinkRow(l));
  }
  function addLinkRow(l = { url: '', title: '' }) {
    const row = document.createElement('div');
    row.className = 'linkrow';
    row.innerHTML = `<div><input type="url" inputmode="url" placeholder="https://…" value="${esc(l.url)}" autocapitalize="none">
      <input type="text" placeholder="Titel (optional)" value="${esc(l.title)}" style="margin-top:6px"></div>
      <button type="button" class="rm" aria-label="Link entfernen">×</button>`;
    row.querySelector('.rm').onclick = () => row.remove();
    $('links').appendChild(row);
  }
  function collectLinks() {
    return [...$('links').querySelectorAll('.linkrow')].map((r) => {
      const [u, t] = r.querySelectorAll('input');
      let url = u.value.trim();
      if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
      return { url, title: t.value.trim() };
    }).filter((l) => l.url);
  }

  function setRegionOptions(val) {
    $('fr').innerHTML = REGIONS.map((r) => `<option value="${esc(r)}">${r || '–'}</option>`).join('');
    $('fr').value = REGIONS.includes(val) ? val : '';
  }

  function openDialog(c) {
    editing = c || null;
    picked = null;
    $('err').textContent = '';
    $('dlgTitle').textContent = c ? 'Candidate bearbeiten' : 'Neuer Candidate';
    $('searchBox').hidden = !!c;
    $('results').hidden = true;
    $('sq').value = '';
    $('picked').hidden = !c;
    $('pHint').hidden = !!c;
    if (c) {
      $('pName').textContent = c.name;
      $('pSym').textContent = c.symbol;
      $('pPrice').textContent = fmtPrice(c.entry_price, c.currency);
    }
    $('fs').value = c?.sector || '';
    $('fc').value = c?.country || '';
    setRegionOptions(c?.region || '');
    $('fn').value = c?.notes || '';
    renderLinks(c?.links || []);
    $('save').disabled = !c;
    $('dlg').showModal();
    if (!c) setTimeout(() => $('sq').focus(), 50);
  }

  let searchTimer, searchSeq = 0;
  $('sq').addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = $('sq').value.trim();
    if (!q) { $('results').hidden = true; return; }
    searchTimer = setTimeout(async () => {
      const seq = ++searchSeq;
      try {
        const r = await api('/search?q=' + encodeURIComponent(q));
        if (seq !== searchSeq) return;
        const box = $('results');
        box.hidden = false;
        box.innerHTML = r.length
          ? r.map((x, n) => `<button type="button" data-n="${n}">${esc(x.name)}<small>${esc(x.symbol)} · ${esc(x.exchange)}${x.type === 'ETF' ? ' · ETF' : ''}</small></button>`).join('')
          : '<button type="button" disabled>Keine Treffer</button>';
        box.onclick = (ev) => {
          const b = ev.target.closest('button[data-n]');
          if (b) pick(r[Number(b.dataset.n)]);
        };
      } catch (e) {
        $('results').hidden = false;
        $('results').innerHTML = `<button type="button" disabled>${esc(e.message)}</button>`;
      }
    }, 300);
  });

  async function pick(hit) {
    $('results').hidden = true;
    $('err').textContent = '';
    $('picked').hidden = false;
    $('pName').textContent = hit.name;
    $('pSym').textContent = hit.symbol;
    $('pPrice').textContent = 'lädt…';
    try {
      const d = await api('/lookup?symbol=' + encodeURIComponent(hit.symbol));
      picked = d;
      $('pName').textContent = d.name;
      $('pSym').textContent = d.symbol;
      $('pPrice').textContent = fmtPrice(d.price, d.currency);
      $('fs').value = d.sector || '';
      $('fc').value = d.country || '';
      setRegionOptions(d.region || '');
      $('save').disabled = false;
    } catch (e) {
      picked = null;
      $('pPrice').textContent = '';
      $('err').textContent = 'Details konnten nicht geladen werden: ' + e.message;
    }
  }

  $('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $('save').disabled = true;
    $('err').textContent = '';
    const body = {
      sector: $('fs').value.trim(), country: $('fc').value.trim(), region: $('fr').value,
      notes: $('fn').value.trim(), links: collectLinks()
    };
    try {
      if (editing) {
        await api('/candidates/' + editing.id, { method: 'PUT', body: JSON.stringify({ ...body, name: editing.name }) });
      } else if (picked) {
        await api('/candidates', { method: 'POST', body: JSON.stringify({ ...picked, ...body }) });
      } else return;
      $('dlg').close();
      await load();
      toast('Gespeichert');
    } catch (e) {
      $('err').textContent = e.message;
      $('save').disabled = false;
    }
  });
  $('cancel').onclick = () => $('dlg').close();
  $('addLink').onclick = () => addLinkRow();
  $('addBtn').onclick = () => openDialog(null);

  // ---------- Investment erfassen ----------
  function openInv(c, back) {
    invFor = c;
    invBack = !!back;
    const has = !!c.inv_type;
    $('invTitle').textContent = has ? 'Investment bearbeiten' : 'Investment erfassen';
    $('invFor').textContent = `${c.name} (${c.symbol})`;
    $('invHints').innerHTML = window.marketHints ? window.marketHints(c, 'Marktsicht zum Zeitpunkt der Entscheidung') : '';
    $('iType').value = c.inv_type || 'Kauf Titel';
    $('iDate').value = c.inv_date ? String(c.inv_date).slice(0, 10) : todayIso();
    $('iQty').value = c.inv_qty ?? '';
    $('iPrice').value = has ? (c.inv_price ?? '') : (c.price ?? '');
    $('iDet').value = c.inv_details || '';
    $('iRat').value = c.inv_rationale || '';
    $('iErr').textContent = '';
    $('iDel').hidden = !has;
    $('iSave').disabled = false;
    $('invDlg').showModal();
  }
  function closeInv() {
    $('invDlg').close();
    if (invBack && invFor) openDetail(invFor.id);
  }
  $('iCancel').onclick = closeInv;
  $('iDel').onclick = async () => {
    if (!invFor || !confirm('Investment-Eintrag inklusive Begründung löschen?')) return;
    try {
      await api(`/candidates/${invFor.id}/investment`, { method: 'DELETE' });
      await load();
      closeInv();
      toast('Investment entfernt');
    } catch (e) { $('iErr').textContent = e.message; }
  };
  $('invForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const rationale = $('iRat').value.trim();
    const price = parseNum($('iPrice').value), qty = parseNum($('iQty').value);
    if (!rationale) { $('iErr').textContent = 'Bitte die Begründung erfassen.'; return; }
    if (Number.isNaN(price) || Number.isNaN(qty)) { $('iErr').textContent = 'Preis oder Anzahl ist keine gültige Zahl.'; return; }
    if (!$('iDate').value) { $('iErr').textContent = 'Bitte ein Datum wählen.'; return; }
    $('iErr').textContent = '';
    $('iSave').disabled = true;
    try {
      await api(`/candidates/${invFor.id}/investment`, {
        method: 'PUT',
        body: JSON.stringify({ type: $('iType').value, date: $('iDate').value, price, qty, details: $('iDet').value.trim(), rationale })
      });
      await load();
      closeInv();
      toast('Investment gespeichert');
    } catch (e) {
      $('iErr').textContent = e.message;
      $('iSave').disabled = false;
    }
  });

  // ---------- Aktionen in der Liste ----------
  $('list').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const id = Number(btn.closest('.card').dataset.id);
    const c = items.find((i) => i.id === id);
    if (btn.dataset.act === 'edit') openDialog(c);
    if (btn.dataset.act === 'inv') openInv(c, false);
    if (btn.dataset.act === 'del' && confirm(`«${c.name}» löschen?`)) {
      await api('/candidates/' + id, { method: 'DELETE' });
      await load();
    }
  });

  $('refreshBtn').onclick = async () => {
    const b = $('refreshBtn');
    b.disabled = true; b.textContent = 'Lädt…';
    try {
      const r = await api('/refresh', { method: 'POST' });
      await load();
      toast(`${r.updated} von ${r.total} Kursen aktualisiert`);
    } catch (e) { toast(e.message); }
    b.disabled = false; b.textContent = 'Kurse aktualisieren';
  };

  ['q', 'fSector', 'fRegion', 'fStatus', 'fSort'].forEach((id) => $(id).addEventListener('input', render));

  // Kurse automatisch aktualisieren: beim Öffnen der App und wenn sie wieder in den Vordergrund kommt
  let lastAuto = 0;
  async function autoRefresh() {
    if (Date.now() - lastAuto < 120000) return;
    lastAuto = Date.now();
    const b = $('refreshBtn');
    if (b.disabled) return;
    b.disabled = true; b.textContent = 'Aktualisiere…';
    try {
      await api('/refresh', { method: 'POST' });
      await load();
    } catch (_) {
      lastAuto = 0;
    }
    b.disabled = false; b.textContent = 'Kurse aktualisieren';
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoRefresh(); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  const ready = load();
  window.CandidatesApp = { api, esc, toast, getItems: () => items, ready, rerender: () => render() };
  ready.then(autoRefresh);
})();
