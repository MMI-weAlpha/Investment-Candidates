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

  function askCode() {
    return new Promise((resolve) => {
      const dlg = $('codeDlg');
      $('codeForm').onsubmit = () => { localStorage.setItem('accessCode', $('codeInput').value); resolve(); };
      dlg.showModal();
    });
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

  function render() {
    const q = $('q').value.trim().toLowerCase();
    const fs = $('fSector').value, fr = $('fRegion').value;
    const shown = items.filter((i) =>
      (!q || (i.name + ' ' + i.symbol + ' ' + (i.notes || '')).toLowerCase().includes(q)) &&
      (!fs || i.sector === fs) && (!fr || i.region === fr));
    const list = $('list');
    if (!shown.length) {
      list.innerHTML = `<div class="empty">${items.length ? 'Keine Treffer.' : 'Noch keine Kandidaten.<br>Tippe auf + um den ersten zu erfassen.'}</div>`;
      return;
    }
    list.innerHTML = shown.map((i) => `
      <article class="card" data-id="${i.id}">
        <div class="row">
          <div><div class="name">${esc(i.name)}</div><div class="sym">${esc(i.symbol)}</div></div>
          <div><div class="price">${esc(fmtPrice(i.price, i.currency))}</div><div class="upd">${esc(fmtDate(i.price_updated_at))}</div></div>
        </div>
        <div class="chips">
          ${[i.sector, i.country, i.region].filter(Boolean).map((v) => `<span class="chip">${esc(v)}</span>`).join('')}
        </div>
        ${i.notes ? `<div class="notes">${esc(i.notes)}</div>` : ''}
        ${(i.links || []).length ? `<div class="links">${i.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(l.title || host(l.url))}</a>`).join('')}</div>` : ''}
        <div class="actions"><button type="button" data-act="edit">Bearbeiten</button><button type="button" class="del" data-act="del">Löschen</button></div>
      </article>`).join('');
  }

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
    $('dlgTitle').textContent = c ? 'Kandidat bearbeiten' : 'Neuer Kandidat';
    $('searchBox').hidden = !!c;
    $('results').hidden = true;
    $('sq').value = '';
    $('picked').hidden = !c;
    if (c) {
      $('pName').textContent = c.name;
      $('pSym').textContent = c.symbol;
      $('pPrice').textContent = fmtPrice(c.price, c.currency);
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

  // ---------- Aktionen in der Liste ----------
  $('list').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const id = Number(btn.closest('.card').dataset.id);
    const c = items.find((i) => i.id === id);
    if (btn.dataset.act === 'edit') openDialog(c);
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

  ['q', 'fSector', 'fRegion'].forEach((id) => $(id).addEventListener('input', render));

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  load();
})();
