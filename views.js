// Marktsicht (v2): taktische (1–3 Monate) und strategische (12+ Monate) Einschätzungen.
// Eigene Datei, damit der Rest der App unverändert bleibt. Fehlt app.js, tut diese Datei nichts.
(() => {
  const A = window.CandidatesApp;
  if (!A) return;
  const { api, esc, toast } = A;
  const $ = (id) => document.getElementById(id);

  // ---------- Auswahllisten ----------
  const REGIONS = ['Nordamerika', 'Europa', 'Asien-Pazifik', 'Lateinamerika', 'Naher Osten & Afrika', 'Andere'];
  // [Schlüssel wie bei den Candidates (Yahoo), Anzeige]
  const COUNTRIES = [
    ['Switzerland', 'Schweiz'], ['United States', 'USA'], ['Germany', 'Deutschland'], ['France', 'Frankreich'],
    ['United Kingdom', 'Grossbritannien'], ['Netherlands', 'Niederlande'], ['Italy', 'Italien'], ['Spain', 'Spanien'],
    ['Sweden', 'Schweden'], ['Denmark', 'Dänemark'], ['Norway', 'Norwegen'], ['Finland', 'Finnland'],
    ['Ireland', 'Irland'], ['Belgium', 'Belgien'], ['Austria', 'Österreich'], ['Japan', 'Japan'], ['China', 'China'],
    ['Hong Kong', 'Hongkong'], ['Taiwan', 'Taiwan'], ['South Korea', 'Südkorea'], ['India', 'Indien'],
    ['Singapore', 'Singapur'], ['Australia', 'Australien'], ['Canada', 'Kanada'], ['Brazil', 'Brasilien'], ['Israel', 'Israel']
  ];
  const SECTORS = [
    ['Technology', 'Technologie (IT)'], ['Healthcare', 'Gesundheit'], ['Financial Services', 'Finanzen'],
    ['Consumer Cyclical', 'Zyklischer Konsum'], ['Consumer Defensive', 'Basiskonsum'], ['Industrials', 'Industrie'],
    ['Energy', 'Energie'], ['Basic Materials', 'Grundstoffe'], ['Utilities', 'Versorger'],
    ['Real Estate', 'Immobilien'], ['Communication Services', 'Kommunikation'], ['ETF', 'ETF']
  ];
  const TILT = ['Übergewichten', 'Neutral', 'Untergewichten'];
  const STANCES = {
    Gesamtmarkt: ['Abwarten', 'Selektiv investieren', 'Investieren', 'Risiko reduzieren'],
    Region: TILT, Land: TILT, Sektor: TILT
  };
  const STANCE_HINT = {
    'Abwarten': 'Keine neuen Investments.',
    'Selektiv investieren': 'Nur ausgewählte, gut begründete Gelegenheiten.',
    'Investieren': 'Normal investieren.',
    'Risiko reduzieren': 'Bestehende Positionen prüfen und Risiko senken.',
    'Übergewichten': 'Mehr als das Marktgewicht.',
    'Neutral': 'Marktgewicht.',
    'Untergewichten': 'Weniger als das Marktgewicht.'
  };
  const TONE = {
    'Übergewichten': 'ok', 'Investieren': 'ok',
    'Untergewichten': 'bad', 'Risiko reduzieren': 'bad',
    'Abwarten': 'warn', 'Neutral': 'neu', 'Selektiv investieren': 'neu'
  };
  const HORIZON_LABEL = { taktisch: 'Taktisch', strategisch: 'Strategisch' };

  // ---------- Hilfsfunktionen ----------
  const pad = (n) => String(n).padStart(2, '0');
  const isoLocal = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayIso = () => isoLocal(new Date());
  const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d); };
  const plusMonths = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return isoLocal(d); };
  const d10 = (s) => (s ? String(s).slice(0, 10) : null);
  const fmtIso = (d) => (d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '');
  const fmtTs = (t) => (t ? new Date(t).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const daysLeft = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const now = new Date();
    return Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  };
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const tone = (st) => TONE[st] || 'neu';
  const chip = (st) => `<span class="sc t-${tone(st)}">${esc(st)}</span>`;
  const isEnded = (v) => !!v.ended_at;
  const isExpired = (v) => !!v.valid_until && v.valid_until < todayIso();
  const targetLabel = (kind, t) => {
    if (!t) return 'Gesamtmarkt';
    const list = kind === 'Land' ? COUNTRIES : kind === 'Sektor' ? SECTORS : null;
    const hit = list && list.find((x) => x[0] === t);
    return hit ? hit[1] : t;
  };

  let views = [];
  let viewsError = '';
  let page = 'cand';
  let current = null; // im Detailblatt geöffnete Einschätzung

  // ---------- Laden ----------
  async function loadViews() {
    try {
      const data = await api('/views');
      views = data.map((v) => ({ ...v, valid_from: d10(v.valid_from), valid_until: d10(v.valid_until) }));
      viewsError = '';
    } catch (e) {
      viewsError = e.message || 'Fehler';
    }
    renderBanner();
    if (page === 'views') renderViews();
  }

  // ---------- Seitenwechsel ----------
  function setPage(p) {
    page = p;
    $('candPage').hidden = p !== 'cand';
    $('viewsPage').hidden = p !== 'views';
    $('tabCand').classList.toggle('on', p === 'cand');
    $('tabViews').classList.toggle('on', p === 'views');
    $('pageTitle').textContent = p === 'cand' ? 'Candidates' : 'Marktsicht';
    $('refreshBtn').hidden = p !== 'cand';
    $('addBtn').setAttribute('aria-label', p === 'cand' ? 'Candidate hinzufügen' : 'Einschätzung hinzufügen');
    if (p === 'views') renderViews();
    window.scrollTo(0, 0);
  }
  $('tabCand').onclick = () => setPage('cand');
  $('tabViews').onclick = () => setPage('views');
  $('stanceBanner').onclick = () => setPage('views');

  // Der runde Plus-Knopf legt je nach Seite einen Candidate oder eine Einschätzung an
  const origAdd = $('addBtn').onclick;
  $('addBtn').onclick = (ev) => (page === 'views' ? openVw() : origAdd && origAdd(ev));

  // ---------- Banner auf der Candidates-Seite ----------
  const taktMain = () => views.find((v) => !isEnded(v) && v.horizon === 'taktisch' && v.kind === 'Gesamtmarkt');

  function renderBanner() {
    const b = $('stanceBanner');
    const main = taktMain();
    if (!main) { b.hidden = true; return; }
    const exp = isExpired(main);
    b.className = 'banner t-' + (exp ? 'warn' : tone(main.stance));
    b.innerHTML = exp
      ? `Taktische Einschätzung «${esc(main.stance)}» ist seit ${esc(fmtIso(main.valid_until))} abgelaufen. Bitte überprüfen.`
      : `<b>Taktisch: ${esc(main.stance)}</b> · ${esc(STANCE_HINT[main.stance] || '')}${main.valid_until ? ' Bis ' + esc(fmtIso(main.valid_until)) + '.' : ''}`;
    b.hidden = false;
  }

  // ---------- Marktsicht-Seite ----------
  function untilText(v) {
    if (!v.valid_until) return 'ohne Enddatum';
    if (isExpired(v)) return 'abgelaufen am ' + fmtIso(v.valid_until);
    const n = daysLeft(v.valid_until);
    return 'bis ' + fmtIso(v.valid_until) + (n === 0 ? ' (heute letzter Tag)' : ' (noch ' + n + (n === 1 ? ' Tag)' : ' Tage)'));
  }

  function stanceCard(v) {
    const exp = isExpired(v);
    return `<div class="stance t-${exp ? 'warn' : tone(v.stance)}" data-vid="${v.id}">
      <div class="sl">Gesamtmarkt · seit ${esc(fmtIso(v.valid_from))}</div>
      <div class="sv">${esc(v.stance)}</div>
      <div class="ss">${esc(STANCE_HINT[v.stance] || '')}</div>
      <div class="ss">${esc(cap(untilText(v)))}${exp ? '. Bitte überprüfen.' : ''}</div>
      <div class="sr">${esc(v.rationale)}</div>
    </div>`;
  }

  function rowHtml(v, withHorizon) {
    const exp = isExpired(v);
    const sub = [v.kind, withHorizon ? HORIZON_LABEL[v.horizon] : ''].filter(Boolean).join(' · ');
    return `<div class="vrow" data-vid="${v.id}">
      <div class="vt"><div class="name">${esc(targetLabel(v.kind, v.target))}</div><div class="sym">${esc(sub)}</div></div>
      <div class="vr">${chip(v.stance)}<div class="sym${exp ? ' wt' : ''}">${exp ? 'Überprüfung fällig seit ' + esc(fmtIso(v.valid_until)) : v.valid_until ? 'bis ' + esc(fmtIso(v.valid_until)) : ''}</div></div>
    </div>`;
  }

  function renderViews() {
    if (viewsError && !views.length) {
      $('vTactMain').innerHTML = `<div class="stance empty">Marktsicht konnte nicht geladen werden:<br>${esc(viewsError)}<br><span class="sm">Ist der Server auf dem neuen Stand?</span></div>`;
      $('vTactList').innerHTML = $('vStratList').innerHTML = $('vHistList').innerHTML = '';
      $('vHistSum').textContent = 'Verlauf';
      return;
    }
    const active = views.filter((v) => !isEnded(v));
    const tact = active.filter((v) => v.horizon === 'taktisch');
    const strat = active.filter((v) => v.horizon === 'strategisch');
    const main = tact.find((v) => v.kind === 'Gesamtmarkt');
    const tilts = tact.filter((v) => v.kind !== 'Gesamtmarkt');

    $('vTactMain').innerHTML = main ? stanceCard(main)
      : `<div class="stance empty"><div>Keine taktische Gesamtmarkt-Einschätzung.</div><button type="button" class="btn secondary" id="vSetMain" style="margin-top:10px">Festlegen</button></div>`;

    $('vTactList').innerHTML = tilts.length
      ? `<div class="vlist">${tilts.map((v) => rowHtml(v, false)).join('')}</div>` : '';

    if (!strat.length) {
      $('vStratList').innerHTML = `<div class="stance empty">Noch keine strategische Einschätzung.<br><span class="sm">Z. B. «Schweiz übergewichten» oder «Technologie untergewichten».</span></div>`;
    } else {
      $('vStratList').innerHTML = '<div class="vlist">' + TILT.map((st) => {
        const grp = strat.filter((v) => v.stance === st);
        return grp.length ? `<div class="vgrp">${esc(st)}</div>` + grp.map((v) => rowHtml(v, false)).join('') : '';
      }).join('') + '</div>';
    }

    const hist = views.filter(isEnded).sort((a, b) => new Date(b.ended_at) - new Date(a.ended_at));
    $('vHistSum').textContent = 'Verlauf' + (hist.length ? ' (' + hist.length + ')' : '');
    $('vHistList').innerHTML = hist.length
      ? `<div class="vlist">${hist.map((v) => `<div class="vrow" data-vid="${v.id}">
          <div class="vt"><div class="name">${esc(targetLabel(v.kind, v.target))}</div><div class="sym">${esc(HORIZON_LABEL[v.horizon])} · ${esc(v.kind)}</div></div>
          <div class="vr">${chip(v.stance)}<div class="sym">${esc(fmtIso(v.valid_from))} – ${esc(fmtIso(d10(v.ended_at) || ''))}</div></div>
        </div>`).join('')}</div>`
      : '<div class="sym" style="padding:6px 2px">Noch kein Verlauf. Beendete und ersetzte Einschätzungen erscheinen hier.</div>';
  }

  $('viewsPage').addEventListener('click', (ev) => {
    if (ev.target.closest('#vSetMain')) { openVw({ horizon: 'taktisch', kind: 'Gesamtmarkt' }); return; }
    const el = ev.target.closest('[data-vid]');
    if (el) openVd(Number(el.dataset.vid));
  });

  // ---------- Detailblatt ----------
  function candidatesFor(v) {
    const items = A.getItems();
    if (v.kind === 'Region') return items.filter((i) => i.region === v.target);
    if (v.kind === 'Land') return items.filter((i) => i.country === v.target);
    if (v.kind === 'Sektor') return items.filter((i) => i.sector === v.target);
    return [];
  }

  function openVd(id) {
    const v = views.find((x) => x.id === id);
    if (!v) return;
    current = v;
    const ended = isEnded(v);
    const exp = !ended && isExpired(v);
    const cands = candidatesFor(v);
    $('vdBody').innerHTML = `
      <div class="sm">${esc(HORIZON_LABEL[v.horizon])} · ${v.horizon === 'taktisch' ? '1–3 Monate' : '12+ Monate'}</div>
      <div class="name" style="font-size:20px">${esc(targetLabel(v.kind, v.target))}</div>
      <div class="sym">${esc(v.kind)}</div>
      <div style="margin-top:10px">${chip(v.stance)} ${ended ? '<span class="chip">beendet</span>' : exp ? '<span class="sc t-warn">Überprüfung fällig</span>' : ''}</div>
      <div class="sym" style="margin-top:10px">${esc(STANCE_HINT[v.stance] || '')}</div>
      <div class="sym" style="margin-top:6px">Gültig ab ${esc(fmtIso(v.valid_from))}${v.valid_until ? ' bis ' + esc(fmtIso(v.valid_until)) : ''}</div>
      <div class="sym">Erfasst am ${esc(fmtTs(v.created_at))}${ended ? ' · beendet am ' + esc(fmtTs(v.ended_at)) : ''}</div>
      <div class="sm" style="margin-top:12px">Begründung</div>
      <div class="notes" style="margin-top:2px">${esc(v.rationale)}</div>
      ${v.kind !== 'Gesamtmarkt' ? `<div class="mhint"><div class="mh">Betroffene Candidates (${cands.length})</div>${
        cands.length ? cands.map((c) => `<div class="mrow"><span>${c.inv_type ? '<span style="color:var(--ok)">●</span> ' : ''}${esc(c.name)}</span><span class="sm">${esc(c.symbol)}</span></div>`).join('')
          : '<div class="sym">Keine Candidates in diesem Bereich.</div>'}</div>` : ''}`;
    $('vdEnd').hidden = ended;
    $('vdDlg').showModal();
  }

  $('vdClose').onclick = () => $('vdDlg').close();
  $('vdNew').onclick = () => {
    const v = current;
    $('vdDlg').close();
    if (v) openVw({ horizon: v.horizon, kind: v.kind, target: v.target, stance: v.stance });
  };
  $('vdEnd').onclick = async () => {
    if (!current || !confirm('Einschätzung beenden? Sie bleibt im Verlauf erhalten.')) return;
    try {
      await api(`/views/${current.id}/end`, { method: 'POST' });
      await loadViews();
      $('vdDlg').close();
      toast('Einschätzung beendet');
    } catch (e) { toast(e.message); }
  };
  $('vdDel').onclick = async () => {
    if (!current || !confirm('Einschätzung endgültig löschen?')) return;
    try {
      await api(`/views/${current.id}`, { method: 'DELETE' });
      await loadViews();
      $('vdDlg').close();
      toast('Gelöscht');
    } catch (e) { toast(e.message); }
  };

  // ---------- Eingabe-Dialog ----------
  let horizon = 'taktisch';
  const currentTarget = () => ($('vwKind').value === 'Gesamtmarkt' ? null : $('vwTarget').value);

  function fillTarget(sel) {
    const k = $('vwKind').value;
    $('vwTargetBox').hidden = k === 'Gesamtmarkt';
    $('vwTargetLbl').textContent = k === 'Gesamtmarkt' ? '' : k;
    const opts = k === 'Region' ? REGIONS.map((r) => [r, r]) : k === 'Land' ? COUNTRIES : k === 'Sektor' ? SECTORS : [];
    $('vwTarget').innerHTML = opts.map(([val, label]) => `<option value="${esc(val)}">${esc(label)}</option>`).join('');
    if (sel && opts.some((o) => o[0] === sel)) $('vwTarget').value = sel;
  }

  function fillStance(sel) {
    const k = $('vwKind').value;
    const list = STANCES[k];
    $('vwStance').innerHTML = list.map((s) => `<option>${esc(s)}</option>`).join('');
    $('vwStance').value = sel && list.includes(sel) ? sel : (k === 'Gesamtmarkt' ? 'Abwarten' : 'Übergewichten');
    $('vwStanceHint').textContent = STANCE_HINT[$('vwStance').value] || '';
  }

  function updateNote() {
    const k = $('vwKind').value, t = currentTarget();
    const ex = views.find((v) => !isEnded(v) && v.horizon === horizon && v.kind === k && (v.target || null) === t);
    $('vwNote').textContent = ex
      ? `Ersetzt die bestehende Einschätzung «${ex.stance}» (seit ${fmtIso(ex.valid_from)}). Die alte bleibt im Verlauf.`
      : '';
  }

  function setHorizon(h, pre = {}) {
    horizon = h;
    [...$('vwHorizon').children].forEach((b) => b.classList.toggle('on', b.dataset.h === h));
    const kinds = h === 'taktisch' ? ['Gesamtmarkt', 'Region', 'Land', 'Sektor'] : ['Region', 'Land', 'Sektor'];
    const keep = pre.kind && kinds.includes(pre.kind) ? pre.kind : (kinds.includes($('vwKind').value) ? $('vwKind').value : kinds[0]);
    $('vwKind').innerHTML = kinds.map((k) => `<option>${esc(k)}</option>`).join('');
    $('vwKind').value = keep;
    fillTarget(pre.target);
    fillStance(pre.stance);
    const quick = h === 'taktisch'
      ? [['2 Wochen', plusDays(14)], ['4 Wochen', plusDays(28)], ['3 Monate', plusMonths(3)]]
      : [['12 Monate', plusMonths(12)], ['18 Monate', plusMonths(18)], ['24 Monate', plusMonths(24)]];
    $('vwQuick').innerHTML = quick.map(([label, d]) => `<button type="button" class="qbtn" data-d="${d}">${label}</button>`).join('');
    $('vwUntil').value = h === 'taktisch' ? plusDays(28) : plusMonths(12);
    $('vwUntilLbl').textContent = h === 'taktisch' ? 'Gültig bis' : 'Gültig bis / Überprüfung am';
    updateNote();
  }

  function openVw(pre = {}) {
    $('vwTitle').textContent = pre.kind ? 'Neue Einschätzung dazu' : 'Neue Einschätzung';
    const h = pre.horizon || 'taktisch';
    setHorizon(h, { ...pre, kind: pre.kind || (h === 'taktisch' ? 'Gesamtmarkt' : 'Region') });
    $('vwRat').value = '';
    $('vwErr').textContent = '';
    $('vwSave').disabled = false;
    $('vwDlg').showModal();
  }

  $('vwHorizon').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-h]');
    if (b && b.dataset.h !== horizon) setHorizon(b.dataset.h);
  });
  $('vwKind').addEventListener('change', () => { fillTarget(); fillStance(); updateNote(); });
  $('vwTarget').addEventListener('change', updateNote);
  $('vwStance').addEventListener('change', () => { $('vwStanceHint').textContent = STANCE_HINT[$('vwStance').value] || ''; });
  $('vwQuick').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-d]');
    if (b) $('vwUntil').value = b.dataset.d;
  });
  $('vwCancel').onclick = () => $('vwDlg').close();

  $('vwForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const rationale = $('vwRat').value.trim();
    if (!rationale) { $('vwErr').textContent = 'Bitte die Begründung erfassen.'; return; }
    const body = {
      horizon, kind: $('vwKind').value, target: currentTarget(), stance: $('vwStance').value,
      valid_from: todayIso(), valid_until: $('vwUntil').value || null, rationale
    };
    if (body.valid_until && body.valid_until < body.valid_from) { $('vwErr').textContent = '«Gültig bis» liegt in der Vergangenheit.'; return; }
    $('vwErr').textContent = '';
    $('vwSave').disabled = true;
    try {
      await api('/views', { method: 'POST', body: JSON.stringify(body) });
      await loadViews();
      $('vwDlg').close();
      toast('Einschätzung gespeichert');
    } catch (e) {
      $('vwErr').textContent = e.message;
      $('vwSave').disabled = false;
    }
  });

  // ---------- Abgleich bei Candidates (wird von app.js aufgerufen) ----------
  function applicable(c) {
    const today = todayIso();
    const live = views.filter((v) => !isEnded(v) && !(v.horizon === 'taktisch' && v.valid_until && v.valid_until < today));
    const match = (v) => (v.kind === 'Gesamtmarkt' ? v.horizon === 'taktisch'
      : v.kind === 'Region' ? v.target === c.region
      : v.kind === 'Land' ? v.target === c.country
      : v.kind === 'Sektor' ? v.target === c.sector : false);
    const rank = (v) => (v.horizon === 'taktisch' ? 0 : 2) + (v.kind === 'Gesamtmarkt' ? 0 : 1);
    return live.filter(match).sort((a, b) => rank(a) - rank(b));
  }

  window.marketHints = (c, heading) => {
    if (!views.length) return '';
    const list = applicable(c);
    if (!list.length) {
      return `<div class="mhint"><div class="mh">${esc(heading)}</div><div class="sym">Keine aktive Einschätzung zu Gesamtmarkt, Sektor, Land oder Region dieses Candidates.</div></div>`;
    }
    return `<div class="mhint"><div class="mh">${esc(heading)}</div>${list.map((v) => `
      <div class="mrow">${chip(v.stance)}<span>${esc(targetLabel(v.kind, v.target))} <span class="sm">· ${esc(v.kind === 'Gesamtmarkt' ? '' : v.kind + ' · ')}${esc(HORIZON_LABEL[v.horizon].toLowerCase())}${v.valid_until ? ' · bis ' + esc(fmtIso(v.valid_until)) : ''}${isExpired(v) ? ' · Überprüfung fällig' : ''}</span></span></div>`).join('')}
      <div class="sm" style="margin-top:6px">Begründungen im Tab «Marktsicht».</div></div>`;
  };

  // ---------- Start ----------
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadViews(); });
  (A.ready || Promise.resolve()).then(loadViews);
})();
