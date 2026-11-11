(function () {
  'use strict';
  const L = window.MLogic;
  const DEFAULTS = window.MONTERRA_DEFAULTS;
  const KEY = 'monterra-invoices-v1';
  const APP_VERSION = '2.0';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const app = document.getElementById('app');
  const stage = document.getElementById('pdf-stage');

  // ---------- icons (Lucide-style line icons) ----------
  const P = {
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    orders: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    sent: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    clients: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    bank: '<path d="M3 21h18M3 10h18M5 6l7-3 7 3M5 10v11M19 10v11M9 14v3M12 14v3M15 14v3"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  };
  const icon = (n, cls) => `<svg class="${cls || 'ico'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

  // ---------- state ----------
  let state = load();
  const ui = {
    tab: 'orders', open: null, edit: false, typing: false, picker: null, client: null, product: null,
    seg: 'clients', listQ: '', sentFilter: 'all', sentClient: '', pasteText: '',
  };
  const pdfCache = {}; // invoice id -> { sig, file }
  const pdfFail = {};
  let pdfBusy = null;

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.data && Array.isArray(s.invoices)) {
        for (const i of s.invoices) if (i.status === 'ready') i.status = 'draft';
        migrate(s);
        return s;
      }
    } catch (e) { /* first run or storage blocked */ }
    return { data: clone(DEFAULTS), invoices: [], payments: [], migrations: ['agsp-delivery-50', 'payers-v1', 'gst-v1'] };
  }
  // One-off updates to data already saved on the phone (the starting list is only copied on first run).
  function migrate(s) {
    s.migrations = s.migrations || [];
    if (!s.migrations.includes('agsp-delivery-50')) {
      const sp = s.data.clients.find((c) => c.code === 'AGSP');
      if (sp && sp.deliveryPct == null) {
        sp.deliveryPct = 50;
        for (const i of s.invoices) if (i.clientCode === 'AGSP' && i.status !== 'sent' && i.deliveryStated == null) {
          i.deliveryStated = i.delivery; i.delivery = L.deliveryFor(sp, i.delivery);
        }
      }
      s.migrations.push('agsp-delivery-50');
    }
    if (!s.migrations.includes('payers-v1')) {
      s.data.payers = Object.assign(clone(DEFAULTS.payers), s.data.payers || {});
      s.data.owner = s.data.owner || clone(DEFAULTS.owner);
      s.migrations.push('payers-v1');
    }
    if (!s.migrations.includes('gst-v1')) {
      if (!s.data.business.hsn) s.data.business.hsn = '1905';
      const taken = new Set(s.invoices.map((i) => i.number));
      for (const i of s.invoices) if (i.status !== 'sent' && !i.numberManual && /^[A-Z]+-\d{4}-/.test(i.number)) {
        taken.delete(i.number); i.number = L.invoiceNumber(s.data.business.prefix, i.date, i.clientCode, taken); taken.add(i.number);
      }
      s.migrations.push('gst-v1');
    }
    s.payments = s.payments || [];
  }
  const statedDelivery = (inv) => (inv.deliveryStated != null ? inv.deliveryStated : inv.delivery) || 0;
  const deliveryPct = (inv) => (inv.deliveryStated ? Math.round((inv.delivery / inv.deliveryStated) * 100) : Math.round(L.deliveryShare(clientBy(inv.clientCode)) * 100));
  function deliveryNote(inv) {
    const pct = deliveryPct(inv), c = clientBy(inv.clientCode);
    return pct !== 100 && statedDelivery(inv) ? `${c.short} pays ${pct}% → ${L.money(inv.delivery)} on the invoice` : '';
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save on this phone: ' + e.message); }
  }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* optional */ }

  const D = () => state.data;
  const clientBy = (code) => D().clients.find((c) => c.code === code) || null;
  const productBy = (id) => D().products.find((p) => p.id === id) || null;
  const invBy = (id) => state.invoices.find((i) => i.id === id) || null;
  const billTo = (inv) => (inv.snap && inv.snap.c) || clientBy(inv.clientCode) || { name: '—', short: '—', addr: [], contact: '', gstin: '' };
  const gstModeOf = (inv) => inv.gst || (clientBy(inv.clientCode) || {}).gst || 'add';
  const invTotals = (inv) => L.totals(inv.items, inv.delivery, gstModeOf(inv));
  const takenNumbers = (exceptId) => new Set(state.invoices.filter((i) => i.id !== exceptId).map((i) => i.number));
  function renumber(inv) {
    if (!inv.numberManual) inv.number = L.invoiceNumber(D().business.prefix, inv.date, inv.clientCode, takenNumbers(inv.id));
  }
  function sig(inv) {
    const c = clientBy(inv.clientCode) || {};
    return JSON.stringify([inv.number, inv.date, inv.items.map((i) => [i.name, i.desc, i.qty, i.price]), inv.delivery, gstModeOf(inv),
      [c.name, c.addr, c.contact, c.gstin], D().business]);
  }
  const pdfFor = (inv) => { const c = pdfCache[inv.id]; return c && c.sig === sig(inv) ? c.file : null; };
  function markEdited(inv) {
    if (inv.status === 'sent') { inv.status = 'draft'; inv.resend = true; }
    delete inv.snap;
    save();
  }

  function issues(inv) {
    const out = [];
    const c = clientBy(inv.clientCode);
    if (!c) out.push({ block: true, text: inv.clientText ? `Choose the client for “${inv.clientText}”` : 'Choose the client' });
    if (!inv.items.length) out.push({ block: true, text: 'Add at least one item' });
    for (const it of inv.items) {
      if (!it.productId) { out.push({ block: true, text: `Choose the product for “${it.rawName || 'new item'}”` }); continue; }
      if (!(Number(it.qty) > 0)) { out.push({ block: true, text: `Quantity missing for ${it.name}` }); continue; }
      if (!(Number(it.price) > 0)) { out.push({ block: true, text: `Price missing for ${it.name}` }); continue; }
      for (const n of it.notes || []) if (/check/i.test(n)) out.push({ block: false, text: `${it.name}: ${n.replace(/ — check price/, '')}` });
    }
    if (inv.number && takenNumbers(inv.id).has(inv.number)) out.push({ block: true, text: `Invoice number ${inv.number} is already used` });
    for (const u of inv.unread || []) out.push({ block: false, text: `Couldn’t read “${u}”` });
    return out;
  }
  const blockers = (inv) => issues(inv).filter((x) => x.block);

  // ---------- toast ----------
  let toastTimer;
  function toast(msg, action) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.innerHTML = `<span class="msg">${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
    if (action) t.querySelector('button').onclick = () => { t.classList.remove('show'); action.fn(); };
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2800);
  }

  // ---------- formatting ----------
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function dayLabel(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const today = L.todayISO();
    const yest = (() => { const t = new Date(); t.setDate(t.getDate() - 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();
    if (iso === today) return 'Today';
    if (iso === yest) return 'Yesterday';
    return `${DAY[dt.getDay()]} ${d} ${MON[m - 1]}`;
  }
  const shortDate = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MON[m - 1]}`; };
  const monthName = (ym) => L.longDate(ym + '-01').split(' ').slice(1).join(' ');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const sum = (list) => list.reduce((s, i) => s + invTotals(i).total, 0);

  // ---------- render ----------
  let prevSheets = new Set();
  function render() {
    const scrolls = {};
    document.querySelectorAll('.sheet').forEach((s) => { scrolls[s.dataset.key] = s.scrollTop; });
    let html = '';
    if (ui.tab === 'orders') html = renderOrders();
    if (ui.tab === 'sent') html = renderSent();
    if (ui.tab === 'clients') html = renderClientsTab();
    if (ui.tab === 'settings') html = renderSettings();
    html += renderNav();
    const sheets = [];
    if (ui.open) sheets.push(ui.edit ? renderEditor(invBy(ui.open)) : renderView(invBy(ui.open)));
    if (ui.client) sheets.push(renderClientSheet(clientBy(ui.client)));
    if (ui.product) sheets.push(renderProductSheet(productBy(ui.product)));
    if (ui.typing) sheets.push(renderTypeSheet());
    if (ui.pack) sheets.push(renderPack());
    if (ui.remind) sheets.push(renderRemind());
    if (ui.bank) sheets.push(renderBank());
    if (ui.bank && ui.bankPick != null) sheets.push(renderBankPick());
    if (ui.picker) sheets.push(renderPicker());
    app.innerHTML = html + sheets.join('');
    const now = new Set();
    document.querySelectorAll('.sheet').forEach((s) => {
      const k = s.dataset.key; now.add(k);
      if (!prevSheets.has(k)) s.classList.add('anim');
      if (scrolls[k] != null) s.scrollTop = scrolls[k];
    });
    prevSheets = now;
    document.body.classList.toggle('locked', now.size > 0);
    fitPreview();
    kickPdfs();
  }
  // Redraw only when it won't disturb typing.
  function softRender() { if (!ui.typing && !ui.picker && !ui.edit && !ui.client && !ui.product && !ui.bank && !ui.pack && !ui.remind) render(); }

  function renderNav() {
    const unsent = state.invoices.filter((i) => i.status !== 'sent').length;
    const tab = (k, label) => `<button data-action="tab" data-tab="${k}" class="${ui.tab === k ? 'on' : ''}" aria-label="${label}">${icon(k)}${k === 'orders' && unsent ? `<span class="badge">${unsent}</span>` : ''}${label}</button>`;
    return `<nav class="tabs">${tab('orders', 'Orders')}${tab('sent', 'Sent')}${tab('clients', 'Clients')}${tab('settings', 'Settings')}</nav>`;
  }

  // ----- Orders -----
  function cardState(inv) {
    if (blockers(inv).length) return 'fix';
    if (pdfFor(inv)) return 'ready';
    if (pdfFail[inv.id] === sig(inv)) return 'failed';
    return 'wait';
  }
  function orderCard(inv) {
    const c = clientBy(inv.clientCode);
    const st = cardState(inv);
    const warn = issues(inv).filter((x) => !x.block);
    const nb = blockers(inv).length;
    let btn;
    if (st === 'fix') btn = `<button class="pill warn" data-action="fix" data-id="${inv.id}">${icon('alert', 'ico-s')}Fix ${nb}</button>`;
    else if (st === 'ready') btn = `<button class="pill" data-action="send" data-id="${inv.id}">${icon('send', 'ico-s')}Send</button>`;
    else if (st === 'failed') btn = `<button class="pill warn" data-action="open" data-id="${inv.id}">Retry</button>`; // view sheet has the retry button
    else btn = `<span class="pill wait" aria-label="Preparing PDF"><span class="spin"></span></span>`;
    return `<div class="order" id="o-${inv.id}">
      <button class="main" data-action="open" data-id="${inv.id}">
        <div class="t1" ${c ? '' : 'style="color:var(--bad)"'}>${c ? esc(c.short) : 'Unknown client'}</div>
        <div class="t2">${plural(inv.items.length, 'item')} · ${esc(inv.number)}${inv.resend ? ' · <b>re-send</b>' : ''}</div>
        <div class="money">${L.money(invTotals(inv).total)}</div>
        ${st !== 'fix' && warn.length ? `<div class="note"><span class="tag warn">${icon('alert', 'ico-s')}${esc(warn[0].text)}${warn.length > 1 ? ` +${warn.length - 1}` : ''}</span></div>` : ''}
      </button>${btn}</div>`;
  }

  function renderOrders() {
    const unsent = state.invoices.filter((i) => i.status !== 'sent')
      .sort((a, b) => b.date.localeCompare(a.date) || (a.createdAt - b.createdAt));
    const toFix = unsent.filter((i) => blockers(i).length).length;
    const byDay = {};
    for (const i of unsent) (byDay[i.date] = byDay[i.date] || []).push(i);
    let list = '';
    for (const [day, invs] of Object.entries(byDay)) {
      list += `<div class="section-h"><h2>${esc(dayLabel(day))}</h2><span class="aside num">${L.money(sum(invs))}</span></div>${invs.map(orderCard).join('')}`;
    }
    const hero = `<div class="hero">
      <div class="lbl">${unsent.length ? 'To send' : 'All caught up'}</div>
      <div class="big num">${unsent.length ? L.money(sum(unsent)) : 'Nothing to send'}</div>
      ${unsent.length ? `<div class="lbl" style="margin:-8px 0 14px">${plural(unsent.length, 'invoice')}${toFix ? ` · ${toFix} need${toFix === 1 ? 's' : ''} fixing` : ''}</div>` : ''}
      <div class="row2">
        <button class="btn light" data-action="paste">${icon('clipboard')}Paste orders</button>
        <button class="btn glass" style="width:auto;padding:0 16px" data-action="type" aria-label="Type orders">${icon('type')}</button>
      </div></div>`;
    const empty = `<div class="empty">${icon('inbox')}<div style="font-weight:600;color:var(--ink)">No orders waiting</div>
      <div class="small" style="margin-top:4px">In WhatsApp, long-press an order → <b>More…</b> → tick the orders → <b>Copy</b>. Then tap <b>Paste orders</b>.</div></div>`;
    const welcome = !D().clients.length ? `<div class="banner warn" style="margin-bottom:12px">${icon('download')}<div style="flex:1"><b>Bring your data over</b><span class="small">This copy of the app has no clients yet. Go to Settings → Restore from backup and pick your backup file.</span></div>
      <button class="pill" data-action="tab" data-tab="settings">Settings</button></div>` : '';
    return `<div class="wrap"><div class="eyebrow">Monterra</div><h1 class="title">Orders</h1>${welcome}${hero}
      ${unsent.length ? list : empty}
      <div style="display:flex;justify-content:center;margin-top:18px"><button class="btn text" data-action="new-invoice">${icon('plus', 'ico-s')}Blank invoice</button></div>
    </div>`;
  }

  // ----- Sent -----
  function renderSent() {
    const allSent = state.invoices.filter((i) => i.status === 'sent');
    const unpaid = allSent.filter((i) => !i.paid);
    const ym = L.todayISO().slice(0, 7);
    const thisMonth = allSent.filter((i) => i.date.startsWith(ym));
    let list = allSent.filter((i) => (ui.sentFilter !== 'unpaid' || !i.paid) && (!ui.sentClient || i.clientCode === ui.sentClient))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.sentAt || 0) - (a.sentAt || 0));
    const months = {};
    for (const i of list) (months[i.date.slice(0, 7)] = months[i.date.slice(0, 7)] || []).push(i);
    const usedClients = [...new Set(allSent.map((i) => i.clientCode))].map(clientBy).filter(Boolean);
    const chips = `<div class="chips" style="margin-top:16px">
      <button class="chip ${ui.sentFilter === 'all' && !ui.sentClient ? 'on' : ''}" data-action="sent-filter" data-v="all">All</button>
      <button class="chip ${ui.sentFilter === 'unpaid' ? 'on' : ''}" data-action="sent-filter" data-v="unpaid">Unpaid</button>
      ${usedClients.map((c) => `<button class="chip ${ui.sentClient === c.code ? 'on' : ''}" data-action="sent-client" data-v="${esc(c.code)}">${esc(c.short)}</button>`).join('')}
    </div>`;
    let body = '';
    for (const [m, invs] of Object.entries(months)) {
      body += `<div class="section-h"><h2>${esc(monthName(m))}</h2><span class="aside num">${L.money(sum(invs))}</span></div><div class="group">${invs.map((i) => {
        const c = clientBy(i.clientCode);
        return `<div class="cell tap" data-action="open" data-id="${i.id}" role="button" tabindex="0">
          <div class="main"><div class="t1">${c ? esc(c.short) : 'Unknown client'}</div><div class="t2">${esc(shortDate(i.date))} · ${esc(i.number)}</div></div>
          <div style="text-align:right"><div class="amt">${L.money(invTotals(i).total)}</div>
          <button class="pill ${i.paid ? 'paid' : 'unpaid'}" style="min-height:28px;padding:0 10px;font-size:12px;margin-top:4px" data-action="toggle-paid" data-id="${i.id}">${i.paid ? icon('check', 'ico-s') + 'Paid' : 'Unpaid'}</button></div></div>`;
      }).join('')}</div>`;
    }
    return `<div class="wrap"><div class="eyebrow">Monterra</div><h1 class="title">Sent</h1>
      <div class="hero"><div class="lbl">Waiting for payment</div><div class="big num">${L.money(sum(unpaid))}</div>
        <div class="lbl">${plural(unpaid.length, 'unpaid invoice')} · ${L.money(sum(thisMonth))} sent in ${esc(monthName(ym).split(' ')[0])}</div>
        <div class="row2" style="margin-top:14px"><button class="btn light" data-action="bank" ${ui.bankBusy ? 'disabled' : ''}>${ui.bankBusy ? '<span class="spin"></span>Reading…' : icon('bank') + 'Check bank'}</button>
          <button class="btn glass" data-action="pack">${icon('sheet')}GST pack</button></div></div>
      <input type="file" id="bank-file" accept="application/pdf,.pdf" style="display:none">
      ${renderRemindList()}
      ${allSent.length ? chips : ''}
      ${body || `<div class="empty">${icon('sent')}<div style="font-weight:600;color:var(--ink)">${allSent.length ? 'Nothing here' : 'No sent invoices yet'}</div><div class="small" style="margin-top:4px">Tap <b>Unpaid</b> on an invoice when the money comes in.</div></div>`}
    </div>`;
  }

  // ----- Clients & products -----
  function clientRows(q) {
    const t = L.norm(q);
    return D().clients.filter((c) => !t || L.norm([c.short, c.name, c.code, ...(c.aliases || [])].join(' ')).includes(t)).map((c) =>
      `<button class="cell" data-action="edit-client" data-code="${esc(c.code)}"><span class="avatar">${esc(c.code.slice(0, 4))}</span>
        <div class="main"><div class="t1">${esc(c.short)}</div><div class="t2">${plural(c.rates.filter((r) => !r.old).length, 'price')}${c.gstin ? '' : ' · <span style="color:var(--warn)">GSTIN pending</span>'}${c.gst === 'none' ? ' · no GST' : ''}</div></div>
        ${icon('right', 'ico chev')}</button>`).join('') || '<div class="cell muted">No match</div>';
  }
  function productRows(q) {
    const t = L.norm(q);
    return D().products.filter((p) => !t || L.norm([p.name, ...(p.aliases || [])].join(' ')).includes(t)).sort((a, b) => a.name.localeCompare(b.name)).map((p) =>
      `<button class="cell" data-action="edit-product" data-id="${esc(p.id)}"><div class="main"><div class="t1">${esc(p.name)}</div><div class="t2">${esc((p.aliases || []).join(', ') || '—')}</div></div>${icon('right', 'ico chev')}</button>`).join('') || '<div class="cell muted">No match</div>';
  }
  function renderClientsTab() {
    const isC = ui.seg === 'clients';
    return `<div class="wrap"><div class="eyebrow">Monterra</div><h1 class="title">Clients</h1>
      <div class="seg"><button data-action="seg" data-seg="clients" class="${isC ? 'on' : ''}">Clients</button><button data-action="seg" data-seg="products" class="${isC ? '' : 'on'}">Products</button></div>
      <label class="search" style="margin-top:12px">${icon('search', 'ico-s')}<input type="search" data-f="list-q" value="${esc(ui.listQ)}" placeholder="Search ${isC ? 'clients' : 'products'}" autocomplete="off"></label>
      <div class="group" style="margin-top:12px" id="list-rows">${isC ? clientRows(ui.listQ) : productRows(ui.listQ)}</div>
      <button class="btn secondary" style="margin-top:12px" data-action="${isC ? 'new-client' : 'new-product'}">${icon('plus')}New ${isC ? 'client' : 'product'}</button>
    </div>`;
  }

  // ----- Settings -----
  function field(label, f, value, attrs) {
    return `<div class="field"><label>${esc(label)}</label><input type="text" data-f="${f}" value="${esc(value)}" ${attrs || ''}></div>`;
  }
  function renderSettings() {
    const b = D().business;
    return `<div class="wrap"><div class="eyebrow">Monterra</div><h1 class="title">Settings</h1>
      <div class="group"><div class="cell">${icon('phone')}<div class="main"><div class="t1">Add to Home Screen</div><div class="t2" style="white-space:normal">In Safari tap Share → Add to Home Screen. It then opens like an app.</div></div></div></div>
      <div class="section-h"><h2>Backup</h2></div>
      <div class="group">
        <button class="cell" data-action="backup">${icon('download')}<div class="main"><div class="t1">Save backup</div><div class="t2">To Files, Drive or WhatsApp yourself</div></div>${icon('right', 'ico chev')}</button>
        <button class="cell" data-action="restore">${icon('upload')}<div class="main"><div class="t1">Restore from backup</div></div>${icon('right', 'ico chev')}</button>
        <button class="cell" data-action="csv">${icon('sheet')}<div class="main"><div class="t1">Export sent invoices</div><div class="t2">Spreadsheet for your accounts</div></div>${icon('right', 'ico chev')}</button>
      </div>
      <p class="small muted" style="margin:8px 4px 0">Invoices and prices are saved on this phone only. Save a backup every week or so.</p>
      <input type="file" id="restore-file" accept=".json,application/json" style="display:none">
      <div class="section-h"><h2>Printed on invoices</h2></div>
      <div class="group">
        ${field('Company name', 'b-name', b.name)}
        <div class="field"><label>Address (one line per row)</label><textarea data-f="b-addr">${esc(b.addr.join('\n'))}</textarea></div>
        ${field('GSTIN', 'b-gstin', b.gstin)}${field('CIN', 'b-cin', b.cin)}${field('GPay number', 'b-gpay', b.gpay)}
        ${field('UPI ID (QR code)', 'b-upi', b.upi)}${field('UPI name', 'b-upiName', b.upiName)}
        ${field('Account holder', 'b-acHolder', b.acHolder)}${field('Account number', 'b-acNo', b.acNo)}${field('Account type', 'b-acType', b.acType)}
        ${field('Bank', 'b-bank', b.bank)}${field('Branch', 'b-branch', b.branch)}${field('IFSC', 'b-ifsc', b.ifsc)}
        ${field('HSN code for bakery items', 'b-hsn', b.hsn || '')}${field('Note under payment details', 'b-note', b.note)}${field('Invoice number prefix', 'b-prefix', b.prefix)}
      </div>
      <div class="section-h"><h2>Start over</h2></div>
      <div class="group"><button class="cell" data-action="reset-data" style="color:var(--bad)">${icon('reset')}<div class="main"><div class="t1">Reset clients &amp; prices</div><div class="t2">Back to the starting list. Invoices are kept.</div></div></button></div>
      <p class="tiny faint" style="text-align:center;margin-top:24px">Monterra Invoices ${APP_VERSION}</p>
    </div>`;
  }

  // ---------- sheets ----------
  function navbar(left, title, right) {
    return `<div class="navbar"><div class="in"><div class="side">${left || ''}</div><div class="ttl">${esc(title)}</div><div class="side r">${right || ''}</div></div></div>`;
  }
  const backBtn = (label) => `<button class="btn text" data-action="back">${icon('left', 'ico-s')}${esc(label)}</button>`;

  function issueBanner(inv, withFix) {
    const iss = issues(inv);
    if (!iss.length) return '';
    const bad = iss.some((x) => x.block);
    return `<div class="banner ${bad ? 'bad' : 'warn'}">${icon('alert')}<div style="flex:1"><b>${bad ? 'Fix before sending' : 'Worth a check'}</b>
      <ul>${iss.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul></div>
      ${withFix ? `<button class="pill ${bad ? '' : 'warn'}" data-action="edit">${bad ? 'Fix' : 'Edit'}</button>` : ''}</div>`;
  }

  function renderView(inv) {
    if (!inv) return '';
    const c = clientBy(inv.clientCode);
    const st = inv.status === 'sent' ? 'sent' : cardState(inv);
    let actions;
    if (st === 'fix') actions = `<button class="btn accent" data-action="edit">${icon('pencil')}Fix ${plural(blockers(inv).length, 'thing')}</button>`;
    else if (!pdfFor(inv) && pdfFail[inv.id] === sig(inv)) actions = `<button class="btn" data-action="retry">Couldn’t make the PDF — try again</button>`;
    else if (!pdfFor(inv)) actions = `<button class="btn" disabled><span class="spin"></span>Preparing PDF…</button>`;
    else actions = `<button class="btn secondary" style="width:56px;flex:none;padding:0" data-action="download" aria-label="Save PDF">${icon('download')}</button>
      <button class="btn" data-action="send" data-id="${inv.id}">${icon('send')}${st === 'sent' ? 'Send again' : 'Send on WhatsApp'}</button>`;
    return `<div class="sheet" data-key="view-${inv.id}">
      ${navbar(backBtn(ui.tab === 'sent' ? 'Sent' : 'Orders'), c ? c.short : 'Invoice', `<button class="btn text" data-action="edit">${icon('pencil', 'ico-s')}Edit</button>`)}
      <div class="wrap stack" style="padding-top:14px">
        ${inv.status === 'sent' ? `<div class="banner" style="background:var(--ok-soft);color:var(--ink)">${icon('check')}<div style="flex:1"><b>Sent ${inv.sentAt ? esc(shortDate(new Date(inv.sentAt).toISOString().slice(0, 10))) : ''}</b><span class="small">${inv.paid ? (inv.paidVia ? `Paid ${esc(shortDate(inv.paidAt))} · ${esc(inv.paidVia)}` : 'Payment received') : 'Waiting for payment'}</span></div>
          <button class="pill ${inv.paid ? 'paid' : 'unpaid'}" data-action="toggle-paid" data-id="${inv.id}">${inv.paid ? 'Paid' : 'Mark paid'}</button></div>` : issueBanner(inv, true)}
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:0 2px">
          <span class="small muted">${esc(inv.number)} · ${esc(shortDate(inv.date))}</span>
          <span class="serif num" style="font-size:22px;font-weight:600">${L.money(invTotals(inv).total)}</span></div>
        <div class="preview" id="pbox"><div class="scaler">${invoiceHTML(inv)}</div></div>
      </div>
      <div class="actions"><div class="wrap">${actions}</div></div>
    </div>`;
  }

  function totalsHTML(inv) {
    const t = invTotals(inv), mode = gstModeOf(inv);
    let h = `<div class="l">Items${mode === 'none' ? '' : ' (before GST)'}</div><div class="v">${L.money(t.taxable)}</div>`;
    if (mode !== 'none') h += `<div class="l">GST 5% (CGST + SGST)</div><div class="v">${L.money(t.cgst + t.sgst)}</div>`;
    if (t.delivery) h += `<div class="l">Delivery${deliveryPct(inv) !== 100 ? ` (${deliveryPct(inv)}% of ${L.money(statedDelivery(inv))})` : ''}</div><div class="v">${L.money(t.delivery)}</div>`;
    h += `<div class="gl">Total</div><div class="gv">${L.money(t.total)}</div>`;
    return h;
  }

  function itemRow(inv, it, line) {
    const said = it.rawName && it.productId !== it.autoProduct;
    return `<div class="item">
      <div style="display:flex;gap:10px;align-items:flex-start">
        <button class="pick" data-action="pick-product" data-item="${it.id}" style="flex:1;min-width:0">
          <span class="nm ${it.productId ? '' : 'missing'}">${it.productId ? esc(it.name) : 'Choose product'}</span>${icon('right', 'ico-s chev')}</button>
        <span class="lt num" id="lt-${it.id}">${L.money(line.total)}</span>
      </div>
      ${said || !it.productId ? `<div class="said">Order said “${esc(it.raw || it.rawName || '')}”</div>` : ''}
      ${(it.notes || []).length ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${it.notes.map((n) => `<span class="tag ${/check/i.test(n) ? 'warn' : ''}">${esc(n)}</span>`).join('')}</div>` : ''}
      <div class="ctrl">
        <div class="stepper"><button data-action="qty-step" data-d="-1" data-item="${it.id}" aria-label="Less">−</button>
          <input type="number" inputmode="decimal" step="any" data-f="qty" data-item="${it.id}" value="${esc(it.qty)}" aria-label="Quantity">
          <button data-action="qty-step" data-d="1" data-item="${it.id}" aria-label="More">+</button></div>
        <span class="muted">×</span>
        <label class="price">₹<input type="number" inputmode="decimal" step="any" data-f="price" data-item="${it.id}" value="${esc(it.price)}" aria-label="Price"></label>
        <button class="rm" style="margin-left:auto" data-action="del-item" data-item="${it.id}" aria-label="Remove item">${icon('trash')}</button>
      </div></div>`;
  }

  function renderEditor(inv) {
    if (!inv) return '';
    const c = clientBy(inv.clientCode);
    const t = invTotals(inv);
    const mode = gstModeOf(inv);
    const gstOpts = [['add', 'Add 5% GST'], ['included', 'GST included in prices'], ['none', 'No GST']].map(([v, l]) => `<option value="${v}" ${mode === v ? 'selected' : ''}>${l}</option>`).join('');
    const showSaid = inv.clientText && inv.clientCode !== inv.autoClient;
    return `<div class="sheet" data-key="edit-${inv.id}">
      ${navbar(`<button class="btn text" style="color:var(--bad)" data-action="delete-invoice">Delete</button>`, 'Edit invoice', `<button class="btn text" data-action="done">Done</button>`)}
      <div class="wrap stack" style="padding-top:14px">
        ${inv.resend || inv.sentAt ? `<p class="small muted" style="padding:0 4px">Already sent once — after changes, send it again.</p>` : ''}
        ${issueBanner(inv, false)}
        <div class="group">
          <button class="cell" data-action="pick-client"><div class="main"><div class="tiny muted" style="font-weight:600">Client</div>
            <div class="t1" ${c ? '' : 'style="color:var(--bad)"'}>${c ? esc(c.short) : 'Choose client'}</div>
            ${showSaid ? `<div class="t2">Order said “${esc(inv.clientText)}”</div>` : ''}</div>${icon('right', 'ico chev')}</button>
        </div>
        <div class="group">
          <div class="field"><label>Date</label><input type="date" data-f="date" value="${esc(inv.date)}"></div>
          <div class="field"><label>Invoice number</label><input type="text" data-f="number" value="${esc(inv.number)}" autocapitalize="characters" autocomplete="off"></div>
          <div class="field"><label>GST</label><select data-f="gst">${gstOpts}</select></div>
        </div>
        <div class="section-h" style="margin-top:20px"><h2>Items</h2><span class="aside">${plural(inv.items.length, 'item')}</span></div>
        <div class="group">${inv.items.map((it, i) => itemRow(inv, it, t.lines[i])).join('')}
          <button class="cell" data-action="add-item" style="color:var(--accent);font-weight:600;min-height:52px">${icon('plus')}Add item</button></div>
        <div class="group"><div class="field"><label>Delivery fee (no GST)</label>
          <div style="display:flex;align-items:center;gap:4px"><span class="muted">₹</span><input type="number" inputmode="decimal" step="any" data-f="delivery" value="${esc(statedDelivery(inv) || '')}" placeholder="0"></div>
          <div class="small" id="del-note" style="color:var(--accent);font-weight:600;margin-top:2px">${esc(deliveryNote(inv))}</div></div></div>
        <div class="group"><div class="tot" id="totals">${totalsHTML(inv)}</div></div>
        ${inv.raw ? `<details class="group"><summary class="cell"><div class="main"><div class="t1">Original WhatsApp message</div>${inv.sender ? `<div class="t2">${esc(inv.sender)}</div>` : ''}</div>${icon('right', 'ico chev')}</summary><div class="raw-msg">${esc(inv.raw)}</div></details>` : ''}
      </div>
      <div class="actions"><div class="wrap"><button class="btn" data-action="done">${icon('check')}Done</button></div></div>
    </div>`;
  }

  function renderTypeSheet() {
    return `<div class="sheet" data-key="type">
      ${navbar(`<button class="btn text" data-action="close-type">Cancel</button>`, 'Type orders', '')}
      <div class="wrap stack" style="padding-top:14px">
        <textarea class="input" id="paste-box" data-f="paste" placeholder="Rhythm delivery date 12/11/2026&#10;1. Tiramisu 1 tray&#10;2. Carrot cake 6nos&#10;Delivery charges 200">${esc(ui.pasteText)}</textarea>
        <p class="small muted" style="padding:0 4px">One order per block: the client and “delivery date” on the first line, then one item per line. You can paste several WhatsApp messages at once.</p>
      </div>
      <div class="actions"><div class="wrap"><button class="btn" data-action="read-box">Read orders</button></div></div>
    </div>`;
  }

  // ----- picker (choose a client or product, with search) -----
  function pickerRows() {
    const pk = ui.picker;
    const t = L.norm(pk.q || '');
    const has = (s) => !t || t.split(' ').every((w) => L.norm(s).includes(w));
    if (pk.kind === 'client') {
      const rows = D().clients.filter((c) => has([c.short, c.name, c.code, ...(c.aliases || [])].join(' '))).map((c) =>
        `<button class="cell" data-action="picked" data-v="${esc(c.code)}"><span class="avatar">${esc(c.code.slice(0, 4))}</span><div class="main"><div class="t1">${esc(c.short)}</div><div class="t2">${esc(c.name)}</div></div></button>`).join('');
      return `<div class="group">${rows || '<div class="cell muted">No client matches. Add it under Clients.</div>'}</div>`;
    }
    const client = pk.clientCode ? clientBy(pk.clientCode) : null;
    const card = client ? client.rates.map((r) => ({ r, p: productBy(r.p) })).filter((x) => x.p && has([x.p.name, x.r.label || '', ...(x.p.aliases || [])].join(' '))) : [];
    const rest = D().products.filter((p) => !(client && client.rates.some((r) => r.p === p.id)) && has([p.name, ...(p.aliases || [])].join(' '))).sort((a, b) => a.name.localeCompare(b.name));
    let h = '';
    if (card.length) h += `<div class="section-h"><h2>${esc(client.short)} prices</h2></div><div class="group">${card.map(({ r, p }) =>
      `<button class="cell" data-action="picked" data-v="${esc(p.id)}"><div class="main"><div class="t1">${esc(r.label || p.name)}</div>${r.old ? '<div class="t2">Not ordered recently</div>' : ''}</div><span class="amt">₹${esc(r.price)}</span></button>`).join('')}</div>`;
    if (rest.length) h += `<div class="section-h"><h2>${card.length ? 'Other products' : 'Products'}</h2></div><div class="group">${rest.map((p) =>
      `<button class="cell" data-action="picked" data-v="${esc(p.id)}"><div class="main"><div class="t1">${esc(p.name)}</div></div></button>`).join('')}</div>`;
    if (pk.q && pk.q.trim()) h += `<div class="group" style="margin-top:12px"><button class="cell" data-action="picked-new" style="color:var(--accent);font-weight:600">${icon('plus')}Add “${esc(pk.q.trim())}” as a new product</button></div>`;
    return h || '<div class="empty">No products match.</div>';
  }
  function renderPicker() {
    const pk = ui.picker;
    return `<div class="sheet top" data-key="picker">
      ${navbar(`<button class="btn text" data-action="close-picker">Cancel</button>`, pk.kind === 'client' ? 'Choose client' : 'Choose product', '')}
      <div class="wrap" style="padding-top:12px">
        ${pk.said ? `<p class="small muted" style="margin:0 4px 10px">Order said “${esc(pk.said)}”</p>` : ''}
        <label class="search">${icon('search', 'ico-s')}<input type="search" data-f="picker-q" value="${esc(pk.q || '')}" placeholder="Search" autocomplete="off"></label>
        <div id="picker-rows" style="margin-top:4px">${pickerRows()}</div>
      </div></div>`;
  }

  // ----- client & product editing -----
  function renderClientSheet(c) {
    if (!c) return '';
    const gstOpts = [['add', 'Add 5% GST'], ['included', 'GST included in prices'], ['none', 'No GST']].map(([v, l]) => `<option value="${v}" ${c.gst === v ? 'selected' : ''}>${l}</option>`).join('');
    const rates = c.rates.map((r, i) => {
      const p = productBy(r.p);
      return `<div class="item">
        <div style="display:flex;gap:10px;align-items:center">
          <button class="pick" data-action="pick-rate" data-i="${i}" style="flex:1;min-width:0"><span class="nm">${esc(r.label || (p ? p.name : 'Choose product'))}</span>${icon('right', 'ico-s chev')}</button>
          <label class="price">₹<input type="number" inputmode="decimal" step="any" data-f="r-price" data-i="${i}" value="${esc(r.price)}" aria-label="Price"></label>
          <button class="rm" data-action="del-rate" data-i="${i}" aria-label="Remove price">${icon('trash')}</button>
        </div>
        <details style="margin-top:6px"><summary class="tiny faint" style="font-weight:600">${r.old ? '<span class="tag warn">Not ordered recently</span> ' : ''}${r.label ? 'Custom name ›' : 'Customise ›'}</summary>
          <div class="stack" style="margin-top:8px">
            <input class="input" type="text" data-f="r-label" data-i="${i}" value="${esc(r.label || '')}" placeholder="${esc(p ? p.name : 'Name on invoice')}">
            <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-f="r-old" data-i="${i}" ${r.old ? 'checked' : ''}> Not ordered recently (ask me to check the price)</label>
          </div></details></div>`;
    }).join('');
    return `<div class="sheet" data-key="client-${esc(c.code)}">
      ${navbar(backBtn('Clients'), c.short, `<button class="btn text" style="color:var(--bad)" data-action="delete-client">Delete</button>`)}
      <div class="wrap" style="padding-top:14px">
        <div class="group">
          ${field('Name in this app', 'c-short', c.short)}
          ${field('Code (in invoice number, up to 4 letters)', 'c-code', c.code, 'autocapitalize="characters" maxlength="4"')}
          ${field('Bill-to name on invoice', 'c-name', c.name)}
          <div class="field"><label>Address (one line per row)</label><textarea data-f="c-addr">${esc(c.addr.join('\n'))}</textarea></div>
          ${field('Contact line', 'c-contact', c.contact)}
          ${field('GSTIN', 'c-gstin', c.gstin, 'autocapitalize="characters" placeholder="Pending"')}
          <div class="field"><label>Share of delivery fee they pay (%)</label><input type="number" inputmode="numeric" data-f="c-deliveryPct" value="${esc(c.deliveryPct != null ? c.deliveryPct : 100)}"></div>
          <div class="field"><label>GST</label><select data-f="c-gst">${gstOpts}</select></div>
        </div>
        <div class="section-h"><h2>Prices before GST</h2><span class="aside">${plural(c.rates.length, 'item')}</span></div>
        <div class="group">${rates}<button class="cell" data-action="add-rate" style="color:var(--accent);font-weight:600;min-height:52px">${icon('plus')}Add price</button></div>
        <div class="section-h"><h2>Names used in WhatsApp orders</h2></div>
        <div class="group"><div class="field"><label>Comma separated — e.g. agr uthandi, uthandi</label><textarea data-f="c-aliases">${esc((c.aliases || []).join(', '))}</textarea></div></div>
      </div></div>`;
  }

  function renderProductSheet(p) {
    if (!p) return '';
    return `<div class="sheet" data-key="product-${esc(p.id)}">
      ${navbar(backBtn('Products'), p.name, `<button class="btn text" style="color:var(--bad)" data-action="delete-product">Delete</button>`)}
      <div class="wrap" style="padding-top:14px">
        <div class="group">
          ${field('Name on invoice', 'p-name', p.name)}
          ${field('HSN code (blank = default ' + (D().business.hsn || '') + ')', 'p-hsn', p.hsn || '')}
          <div class="field"><label>“1 tray” means (pieces)</label><input type="number" inputmode="numeric" data-f="p-tray" value="${esc(p.tray || '')}" placeholder="—"></div>
          <div class="field"><label>Slices per whole cake</label><input type="number" inputmode="numeric" data-f="p-slices" value="${esc(p.slices || '')}" placeholder="—"></div>
        </div>
        <p class="small muted" style="margin:8px 4px 0">With slices set, an order for “Carrot cake 6 nos” becomes 1 whole cake.</p>
        <div class="section-h"><h2>Names used in WhatsApp orders</h2></div>
        <div class="group"><div class="field"><label>Comma separated — e.g. brownie, fudge brownie</label><textarea data-f="p-aliases">${esc((p.aliases || []).join(', '))}</textarea></div></div>
      </div></div>`;
  }

  function fitPreview() {
    const box = document.getElementById('pbox');
    if (!box) return;
    const sc = box.querySelector('.scaler');
    const k = box.clientWidth / 800;
    sc.style.transform = `scale(${k})`;
    box.style.height = Math.ceil(sc.scrollHeight * k) + 'px';
  }


  // ---------- bank statement → mark invoices paid ----------
  const titleCase = (t) => String(t || '').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
  const unpaidSent = () => state.invoices.filter((i) => i.status === 'sent' && !i.paid);

  async function loadPdfJs() {
    if (window.pdfjsLib) return;
    await new Promise((res, rej) => {
      const sc = document.createElement('script'); sc.src = 'vendor/pdf.min.js';
      sc.onload = res; sc.onerror = () => rej(new Error('the PDF reader did not load'));
      document.head.appendChild(sc);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  }
  async function pdfText(file) {
    await loadPdfJs();
    const data = new Uint8Array(await file.arrayBuffer());
    let doc, password;
    for (;;) {
      try { doc = await window.pdfjsLib.getDocument({ data: data.slice(), password }).promise; break; }
      catch (e) {
        if (e && e.name === 'PasswordException') {
          password = prompt(password === undefined ? 'This statement is locked. Enter its password:' : 'Wrong password. Try again:');
          if (password == null) throw new Error('no password entered');
          continue;
        }
        throw e;
      }
    }
    let out = '';
    for (let n = 1; n <= doc.numPages; n++) {
      const tc = await (await doc.getPage(n)).getTextContent();
      out += tc.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n';
    }
    return out;
  }

  async function checkStatement(file) {
    ui.bankBusy = true; render();
    try {
      const st = L.parseStatement(await pdfText(file));
      if (!st.rows.length) throw new Error('no transactions found — is this a Kotak account statement?');
      const unpaid = unpaidSent().map((i) => ({ id: i.id, number: i.number, date: i.date, clientCode: i.clientCode, total: invTotals(i).total }));
      const doneKeys = new Set(state.payments.map((x) => x.key));
      const res = L.matchPayments(st.credits, unpaid, { clients: D().clients, payers: D().payers, owner: D().owner, doneKeys });
      ui.bank = {
        from: st.from, to: st.to,
        results: res.map((r) => ({ credit: r.credit, payer: r.payer, status: r.status, why: r.why, clientCode: r.clientCode, invoiceIds: r.invoices.map((i) => i.id), on: r.status === 'sure' })),
      };
      ui.bankPick = null;
    } catch (e) {
      console.error(e);
      toast('Could not read the statement: ' + e.message);
    } finally {
      ui.bankBusy = false; render();
    }
  }

  function bankInvLine(id) {
    const i = invBy(id); if (!i) return '';
    const c = clientBy(i.clientCode);
    return `<div style="display:flex;justify-content:space-between;gap:8px" class="small"><span>${esc(c ? c.short : '?')} · ${esc(shortDate(i.date))}</span><span class="num">${L.money(invTotals(i).total)}</span></div>`;
  }

  function renderBank() {
    const B = ui.bank;
    const R = B.results;
    const matched = R.map((r, i) => [r, i]).filter(([r]) => r.invoiceIds.length && ['sure', 'check', 'manual'].includes(r.status));
    const unmatched = R.map((r, i) => [r, i]).filter(([r]) => r.status === 'none');
    const other = R.filter((r) => ['owner', 'done', 'ignored'].includes(r.status));
    const nInv = matched.filter(([r]) => r.on).reduce((n, [r]) => n + r.invoiceIds.length, 0);
    const totalIn = R.reduce((t, r) => t + r.credit.amount, 0);
    const diffNote = (r) => {
      const d = L.r2(r.credit.amount - r.invoiceIds.reduce((t, id) => t + (invBy(id) ? invTotals(invBy(id)).total : 0), 0));
      return Math.abs(d) >= 0.01 ? `<div class="tiny muted" style="margin-top:4px">Paid ${L.money(Math.abs(d))} ${d < 0 ? 'less' : 'more'} than the invoice total${Math.abs(d) <= 1 ? ' (rounding)' : ''}</div>` : '';
    };
    const card = ([r, i]) => `<div class="group">
        <label class="cell" style="align-items:flex-start;cursor:pointer">
          <input type="checkbox" class="tick" data-f="bank-on" data-i="${i}" ${r.on ? 'checked' : ''} aria-label="Mark these invoices paid">
          <div class="main"><div style="display:flex;justify-content:space-between;gap:8px"><span class="t1">${esc(titleCase(r.payer))}</span><span class="amt">${L.money(r.credit.amount)}</span></div>
            <div class="t2">${esc(shortDate(r.credit.date))}</div>
            <div style="margin:8px 0 6px" class="stack">${r.invoiceIds.map(bankInvLine).join('')}</div>
            <span class="tag ${r.status === 'check' ? 'warn' : 'ok'}" style="white-space:normal">${esc(r.why)}</span>${diffNote(r)}
          </div></label>
        <button class="cell" data-action="bank-change" data-i="${i}" style="min-height:44px;color:var(--accent);font-weight:600;font-size:14px">Change invoices</button>
      </div>`;
    const loose = ([r, i]) => `<div class="group"><div class="cell" style="align-items:flex-start">
        <div class="main"><div style="display:flex;justify-content:space-between;gap:8px"><span class="t1">${esc(titleCase(r.payer))}</span><span class="amt">${L.money(r.credit.amount)}</span></div>
          <div class="t2" style="white-space:normal">${esc(shortDate(r.credit.date))}${r.why ? ' · ' + esc(r.why) : ''}</div>
          <div style="display:flex;gap:8px;margin-top:10px"><button class="pill" data-action="bank-change" data-i="${i}">Choose invoices</button><button class="pill wait" data-action="bank-ignore" data-i="${i}">Not an invoice</button></div>
        </div></div></div>`;
    return `<div class="sheet" data-key="bank">
      ${navbar(`<button class="btn text" data-action="close-bank">Cancel</button>`, 'Bank statement', '')}
      <div class="wrap stack" style="padding-top:14px">
        <div class="hero"><div class="lbl">${esc(shortDate(B.from))} – ${esc(shortDate(B.to))}</div>
          <div class="big num" style="margin-bottom:4px">${L.money(totalIn)}</div>
          <div class="lbl">${plural(R.length, 'payment')} in · ${matched.length} matched to invoices${unmatched.length ? ` · ${unmatched.length} not matched` : ''}</div></div>
        ${matched.length ? `<div class="section-h"><h2>Matched</h2><span class="aside">Untick anything that looks wrong</span></div>${matched.map(card).join('')}` : ''}
        ${unmatched.length ? `<div class="section-h"><h2>Not matched</h2></div>${unmatched.map(loose).join('')}` : ''}
        ${!matched.length && !unmatched.length ? `<div class="empty">${icon('check')}<div style="font-weight:600;color:var(--ink)">Nothing new to match</div></div>` : ''}
        ${other.length ? `<p class="small muted" style="padding:4px">${plural(other.length, 'other payment')} skipped (your own transfers, checked before or not an invoice).</p>` : ''}
      </div>
      <div class="actions"><div class="wrap"><button class="btn" data-action="bank-apply" ${nInv ? '' : 'disabled'}>${icon('check')}Mark ${plural(nInv, 'invoice')} paid</button></div></div>
    </div>`;
  }

  function renderBankPick() {
    const r = ui.bank.results[ui.bankPick];
    const usedElsewhere = new Set(ui.bank.results.filter((x, i) => i !== ui.bankPick && x.on).flatMap((x) => x.invoiceIds));
    const rc = r.clientCode ? clientBy(r.clientCode) : null;
    const fam = rc ? (rc.gstin ? D().clients.filter((c) => c.gstin === rc.gstin).map((c) => c.code) : [rc.code]) : [];
    const list = unpaidSent().filter((i) => !usedElsewhere.has(i.id))
      .sort((a, b) => (fam.includes(b.clientCode) - fam.includes(a.clientCode)) || a.date.localeCompare(b.date));
    const sel = ui.bankPickSel;
    const selTotal = L.r2(list.filter((i) => sel.has(i.id)).reduce((t, i) => t + invTotals(i).total, 0));
    const rows = list.map((i) => {
      const c = clientBy(i.clientCode);
      return `<label class="cell" style="cursor:pointer">
        <input type="checkbox" class="tick" data-f="bank-pickinv" data-id="${i.id}" ${sel.has(i.id) ? 'checked' : ''}>
        <div class="main"><div class="t1">${esc(c ? c.short : 'Unknown client')}</div><div class="t2">${esc(shortDate(i.date))} · ${esc(i.number)}</div></div>
        <span class="amt">${L.money(invTotals(i).total)}</span></label>`;
    }).join('');
    const diff = L.r2(r.credit.amount - selTotal);
    return `<div class="sheet top" data-key="bank-pick">
      ${navbar(`<button class="btn text" data-action="close-bank-pick">Cancel</button>`, 'Choose invoices', '')}
      <div class="wrap" style="padding-top:12px">
        <p class="small muted" style="margin:0 4px 10px">${esc(titleCase(r.payer))} paid <b>${L.money(r.credit.amount)}</b> on ${esc(shortDate(r.credit.date))}. Tick the invoices it covers.</p>
        <div class="group">${rows || '<div class="cell muted">No unpaid invoices.</div>'}</div>
      </div>
      <div class="actions"><div class="wrap" style="flex-direction:column;gap:6px">
        <div class="small" style="text-align:center;color:${sel.size && Math.abs(diff) <= 1 ? 'var(--ok)' : 'var(--muted)'}">Ticked ${L.money(selTotal)}${sel.size ? (Math.abs(diff) <= 1 ? ' · matches the payment' : ` · ${L.money(Math.abs(diff))} ${diff > 0 ? 'left over' : 'more than paid'}`) : ''}</div>
        <button class="btn" data-action="bank-pick-done">Done</button></div></div>
    </div>`;
  }

  function applyBank() {
    let n = 0;
    for (const r of ui.bank.results) {
      if (!r.on || !r.invoiceIds.length) continue;
      const via = titleCase(r.payer) + (r.invoiceIds.length > 1 ? ` (one payment for ${r.invoiceIds.length} invoices)` : '');
      for (const id of r.invoiceIds) {
        const i = invBy(id); if (!i) continue;
        i.paid = true; i.paidAt = r.credit.date; i.paidVia = via; i.payKey = r.credit.key; n++;
      }
      state.payments.push({ key: r.credit.key, date: r.credit.date, amount: r.credit.amount, payer: r.payer, invoiceIds: r.invoiceIds.slice() });
      // remember a new payer name for next time
      const first = invBy(r.invoiceIds[0]);
      if (first && first.clientCode && !L.payerClient(r.payer, D().payers, [])) D().payers[L.norm(r.payer)] = first.clientCode;
    }
    save();
    ui.bank = null; ui.bankPick = null; render();
    toast(`${plural(n, 'invoice')} marked paid`);
  }


  // ---------- turning HTML pages into one PDF ----------
  async function htmlToPdf(pages, title, fileName, onPage) {
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const W = 210, H = 297;
    for (let n = 0; n < pages.length; n++) {
      if (onPage) onPage(n + 1, pages.length);
      stage.innerHTML = pages[n];
      const node = stage.firstElementChild;
      await Promise.all([...node.querySelectorAll('img')].map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const canvas = await window.html2canvas(node, { scale: 2, backgroundColor: '#ffffff', logging: false, width: 800, windowWidth: 800 });
      let w = W, h = (canvas.height * W) / canvas.width;
      if (h > H) { w = (W * H) / h; h = H; }
      if (n) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', (W - w) / 2, 0, w, h);
    }
    stage.innerHTML = '';
    pdf.setProperties({ title, author: D().business.name });
    return new File([pdf.output('blob')], fileName, { type: 'application/pdf' });
  }

  const brandHead = (right) => `<div class="header"><div class="brand-mark"><div class="name">MONTERRA</div><div class="sub">FOODS</div><div class="tagline">Bakery &middot; Chennai</div></div><div class="meta">${right}</div></div>`;
  const isB2B = (inv) => !!billTo(inv).gstin;

  // ---------- 3. monthly GST pack ----------
  function packInvoices(ym) {
    return state.invoices.filter((i) => i.status === 'sent' && i.date.startsWith(ym))
      .sort((a, b) => (isB2B(b) - isB2B(a)) || a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  }
  function packTotals(list) {
    const t = { n: list.length, taxable: 0, cgst: 0, sgst: 0, delivery: 0, total: 0 };
    for (const i of list) { const x = invTotals(i); t.taxable += x.taxable; t.cgst += x.cgst; t.sgst += x.sgst; t.delivery += x.delivery; t.total += x.total; }
    for (const k of ['taxable', 'cgst', 'sgst', 'delivery', 'total']) t[k] = L.r2(t[k]);
    return t;
  }
  function renderPack() {
    const months = [...new Set(state.invoices.filter((i) => i.status === 'sent').map((i) => i.date.slice(0, 7)))].sort().reverse();
    if (!ui.pack.month) ui.pack.month = months[0] || L.todayISO().slice(0, 7);
    const ym = ui.pack.month;
    const list = packInvoices(ym);
    const b2b = packTotals(list.filter(isB2B)), b2c = packTotals(list.filter((i) => !isB2B(i))), all = packTotals(list);
    const unsent = state.invoices.filter((i) => i.status !== 'sent' && i.date.startsWith(ym)).length;
    const row = (label, t) => `<div class="cell" style="align-items:flex-start"><div class="main"><div class="t1">${label}</div><div class="t2" style="white-space:normal">${plural(t.n, 'invoice')} · taxable ${L.money(t.taxable)} · GST ${L.money(t.cgst + t.sgst)} · delivery ${L.money(t.delivery)}</div></div><span class="amt">${L.money(t.total)}</span></div>`;
    const P = ui.pack;
    let actions;
    if (P.files) actions = `<button class="btn" data-action="pack-share">${icon('send')}Share GST pack</button>`;
    else if (P.busy) actions = `<button class="btn" disabled><span class="spin"></span>${esc(P.busy)}</button>`;
    else actions = `<button class="btn" data-action="pack-make" ${list.length ? '' : 'disabled'}>Make GST pack</button>`;
    return `<div class="sheet" data-key="pack">
      ${navbar(`<button class="btn text" data-action="close-pack">Close</button>`, 'Monthly GST pack', '')}
      <div class="wrap stack" style="padding-top:14px">
        <div class="chips">${months.map((m) => `<button class="chip ${m === ym ? 'on' : ''}" data-action="pack-month" data-v="${m}">${esc(monthName(m))}</button>`).join('') || '<span class="muted small">No sent invoices yet</span>'}</div>
        <div class="group">${row('B2B · client has GSTIN', b2b)}${row('B2C · no GSTIN', b2c)}
          <div class="cell"><div class="main"><div class="t1">Total ${esc(monthName(ym))}</div><div class="t2">GST payable ${L.money(all.cgst + all.sgst)} (CGST ${L.money(all.cgst)} + SGST ${L.money(all.sgst)})</div></div><span class="amt">${L.money(all.total)}</span></div></div>
        ${unsent ? `<div class="banner warn">${icon('alert')}<div>${plural(unsent, 'invoice')} for this month ${unsent === 1 ? 'is' : 'are'} not sent yet, so ${unsent === 1 ? 'it is' : 'they are'} left out.</div></div>` : ''}
        <p class="small muted" style="padding:0 4px">You get two files: one PDF with a register page followed by every invoice (B2B first, then B2C), and a spreadsheet of the same list for your CA.</p>
      </div>
      <div class="actions"><div class="wrap">${actions}</div></div>
    </div>`;
  }
  function registerPages(ym, list) {
    const b = D().business;
    const b2b = packTotals(list.filter(isB2B)), b2c = packTotals(list.filter((i) => !isB2B(i))), all = packTotals(list);
    const sumRow = (l, t) => `<tr><td class="product">${l}</td><td class="center">${t.n}</td><td class="right">${L.money(t.taxable)}</td><td class="right">${L.money(t.cgst)}</td><td class="right">${L.money(t.sgst)}</td><td class="right">${L.money(t.delivery)}</td><td class="right">${L.money(t.total)}</td></tr>`;
    const rows = list.map((i) => { const t = invTotals(i), c = billTo(i); return `<tr><td style="white-space:nowrap">${esc(shortDate(i.date))}</td><td style="white-space:nowrap">${esc(i.number)}</td><td class="product" style="font-weight:400">${esc(c.name)}<span class="desc">${esc(c.gstin || 'B2C · no GSTIN')}</span></td><td class="right">${L.money(t.taxable)}</td><td class="right">${L.money(t.cgst + t.sgst)}</td><td class="right">${L.money(t.delivery)}</td><td class="right">${L.money(t.total)}</td></tr>`; });
    const PER = 22, pages = [];
    for (let k = 0; k < Math.max(1, Math.ceil(rows.length / PER)); k++) {
      pages.push(`<div class="inv">
        ${brandHead(`<h1>GST REGISTER</h1><div class="invoice-no">${esc(monthName(ym))}</div><div class="date">GSTIN ${esc(b.gstin)} · CIN ${esc(b.cin)}</div>`)}
        ${k === 0 ? `<table class="items" style="margin-bottom:24px"><thead><tr><th>Summary</th><th class="center">Invoices</th><th class="right">Taxable</th><th class="right">CGST 2.5%</th><th class="right">SGST 2.5%</th><th class="right">Delivery</th><th class="right">Total</th></tr></thead>
          <tbody>${sumRow('B2B (client has GSTIN)', b2b)}${sumRow('B2C (no GSTIN)', b2c)}${sumRow('<strong>Total</strong>', all)}</tbody></table>
          <p style="font-size:10px;color:#4b5563;margin:-12px 0 20px">Intra-state (Tamil Nadu) supplies · GST 5% on products · delivery charged without GST · no input tax credit claimed.</p>` : ''}
        <table class="items"><thead><tr><th>Date</th><th>Invoice</th><th>Billed to</th><th class="right">Taxable</th><th class="right">GST</th><th class="right">Delivery</th><th class="right">Total</th></tr></thead>
          <tbody>${rows.slice(k * PER, (k + 1) * PER).join('')}</tbody></table>
        <div class="footer"><p>Page ${k + 1} of register · ${plural(list.length, 'invoice')} follow</p></div>
      </div>`);
    }
    return pages;
  }
  async function makePack() {
    const ym = ui.pack.month, list = packInvoices(ym);
    try {
      const pages = [...registerPages(ym, list), ...list.map(invoiceHTML)];
      const pdf = await htmlToPdf(pages, `GST pack ${monthName(ym)}`, `Monterra_${monthName(ym).replace(' ', '_')}_GST_Pack.pdf`, (n, of) => {
        ui.pack.busy = `Making page ${n} of ${of}…`;
        const btn = document.querySelector('[data-key="pack"] .actions .btn'); if (btn) btn.innerHTML = `<span class="spin"></span>${esc(ui.pack.busy)}`;
      });
      const head = ['Date', 'Invoice No', 'Billed to', 'GSTIN', 'Type', 'Taxable', 'CGST', 'SGST', 'Delivery (no GST)', 'Total', 'Paid', 'Paid on'];
      const lines = [head, ...list.map((i) => { const t = invTotals(i), c = billTo(i); return [i.date, i.number, c.name, c.gstin || '', c.gstin ? 'B2B' : 'B2C', t.taxable, t.cgst, t.sgst, t.delivery, t.total, i.paid ? 'Yes' : 'No', i.paidAt || '']; })];
      const all = packTotals(list);
      lines.push([], ['', 'TOTAL', '', '', '', all.taxable, all.cgst, all.sgst, all.delivery, all.total]);
      const csv = lines.map((r) => r.map((v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const reg = new File(['﻿' + csv], `Monterra_${monthName(ym).replace(' ', '_')}_GST_Register.csv`, { type: 'text/csv' });
      ui.pack.files = [pdf, reg];
      toast('GST pack ready — tap Share');
    } catch (e) {
      console.error(e); toast('Could not make the pack: ' + e.message);
    }
    ui.pack.busy = null; render();
  }
  async function sharePack() {
    const files = ui.pack.files;
    try {
      if (navigator.canShare && navigator.canShare({ files })) await navigator.share({ files });
      else files.forEach(downloadFile);
    } catch (e) { if (!e || e.name !== 'AbortError') files.forEach(downloadFile); }
  }

  // ---------- 4. payment reminders ----------
  function unpaidByClient() {
    const map = {};
    for (const i of state.invoices) if (i.status === 'sent' && !i.paid) (map[i.clientCode] = map[i.clientCode] || []).push(i);
    return Object.entries(map).map(([code, invs]) => ({ code, invs: invs.sort((a, b) => a.date.localeCompare(b.date)) }))
      .sort((a, b) => a.invs[0].date.localeCompare(b.invs[0].date));
  }
  function reminderText(code) {
    const b = D().business, c = clientBy(code);
    const invs = (unpaidByClient().find((x) => x.code === code) || { invs: [] }).invs;
    const total = L.r2(invs.reduce((s, i) => s + invTotals(i).total, 0));
    return [
      `Hi${c ? ' ' + c.short : ''}, a gentle reminder from Monterra Foods.`,
      '',
      `Pending invoice${invs.length === 1 ? '' : 's'}:`,
      ...invs.map((i) => `• ${shortDate(i.date)} · ${i.number} · ${L.money(invTotals(i).total)}`),
      '',
      `Total due: ${L.money(total)}`,
      '',
      `UPI: ${b.upi} (GPay ${b.gpay})`,
      `Bank: ${b.bank} · A/C ${b.acNo} · IFSC ${b.ifsc}`,
      '',
      'Thank you!',
    ].join('\n');
  }
  function statementHTML(code) {
    const b = D().business, c = clientBy(code) || { name: '—', addr: [], gstin: '' };
    const invs = (unpaidByClient().find((x) => x.code === code) || { invs: [] }).invs;
    const total = L.r2(invs.reduce((s, i) => s + invTotals(i).total, 0));
    const payload = `upi://pay?pa=${b.upi}&pn=${encodeURIComponent(b.upiName || '')}&am=${total.toFixed(2)}&tn=${encodeURIComponent('SOA' + code)}&cu=INR`;
    const q = window.qrcode(0, 'M'); q.addData(payload); q.make();
    const bill = [...c.addr.map(esc)]; if (c.gstin) bill.push(`GSTIN: <strong>${esc(c.gstin)}</strong>`);
    return `<div class="inv">
      ${brandHead(`<h1>STATEMENT</h1><div class="invoice-no">Unpaid invoices</div><div class="date">As on ${esc(L.longDate(L.todayISO()))}</div>`)}
      <div class="parties"><div class="party"><h3>From</h3><div class="name">${esc(b.name)}</div><div class="addr">GSTIN: <strong>${esc(b.gstin)}</strong></div></div>
        <div class="party"><h3>To</h3><div class="name">${esc(c.name)}</div><div class="addr">${bill.join('<br>')}</div></div></div>
      <table class="items"><thead><tr><th>Date</th><th>Invoice</th><th class="right">Amount</th></tr></thead>
        <tbody>${invs.map((i) => `<tr><td>${esc(L.longDate(i.date))}</td><td class="product">${esc(i.number)}</td><td class="right">${L.money(invTotals(i).total)}</td></tr>`).join('')}</tbody></table>
      <div class="totals"><div></div><table><tr class="grand"><td class="label">Total Due</td><td class="value">${L.money(total)}</td></tr></table></div>
      <div class="terms"><h3>Payment Details</h3><table style="width:100%;border-collapse:collapse;"><tr><td style="vertical-align:top;">
        <p><strong>GPay:</strong> ${esc(b.gpay)} &middot; <strong>UPI:</strong> ${esc(b.upi)}</p>
        <p>A/C Holder: <strong>${esc(b.acHolder)}</strong> &middot; A/C No: <strong>${esc(b.acNo)}</strong> (${esc(b.acType)})</p>
        <p>Bank: <strong>${esc(b.bank)}</strong> &middot; Branch: <strong>${esc(b.branch)}</strong> &middot; IFSC: <strong>${esc(b.ifsc)}</strong></p>
      </td><td style="vertical-align:top;text-align:center;padding-left:14px;width:110px;">
        <img src="${q.createDataURL(6, 2)}" style="width:100px;height:100px;display:block;margin:0 auto;image-rendering:pixelated" alt="UPI QR">
        <div style="font-size:8px;margin-top:3px;color:#6b7280;font-weight:600;letter-spacing:0.5px;">SCAN TO PAY ${L.money(total)}</div></td></tr></table></div>
      <div class="footer"><p><strong>Monterra Foods</strong> &middot; Chennai</p><p>Thank you for your business.</p></div>
    </div>`;
  }
  function renderRemindList() {
    const groups = unpaidByClient();
    if (!groups.length) return '';
    return `<div class="section-h"><h2>Unpaid by client</h2><span class="aside">Tap to remind</span></div><div class="group">${groups.map(({ code, invs }) => {
      const c = clientBy(code);
      const last = Math.max(...invs.map((i) => i.remindedAt || 0));
      return `<button class="cell" data-action="remind" data-code="${esc(code)}">
        <div class="main"><div class="t1">${c ? esc(c.short) : 'Unknown client'}</div>
          <div class="t2">${plural(invs.length, 'invoice')} · oldest ${esc(shortDate(invs[0].date))}${last ? ` · reminded ${esc(shortDate(new Date(last).toISOString().slice(0, 10)))}` : ''}</div></div>
        <span class="amt">${L.money(invs.reduce((s, i) => s + invTotals(i).total, 0))}</span>${icon('right', 'ico chev')}</button>`;
    }).join('')}</div>`;
  }
  function renderRemind() {
    const code = ui.remind.code, c = clientBy(code);
    const invs = (unpaidByClient().find((x) => x.code === code) || { invs: [] }).invs;
    if (ui.remind.text == null) ui.remind.text = reminderText(code);
    return `<div class="sheet" data-key="remind-${esc(code)}">
      ${navbar(`<button class="btn text" data-action="close-remind">Close</button>`, c ? c.short : 'Reminder', '')}
      <div class="wrap stack" style="padding-top:14px">
        <div class="group">${invs.map((i) => `<div class="cell"><div class="main"><div class="t1">${esc(i.number)}</div><div class="t2">${esc(shortDate(i.date))}</div></div><span class="amt">${L.money(invTotals(i).total)}</span></div>`).join('')}
          <div class="cell"><div class="main"><div class="t1">Total due</div></div><span class="amt">${L.money(invs.reduce((s, i) => s + invTotals(i).total, 0))}</span></div></div>
        <div class="section-h"><h2>Message</h2><span class="aside">You can edit it</span></div>
        <textarea class="input" data-f="remind-text" style="min-height:260px;font-family:var(--sans);font-size:15px">${esc(ui.remind.text)}</textarea>
      </div>
      <div class="actions"><div class="wrap">
        <button class="btn secondary" style="flex:0 0 42%" data-action="remind-pdf" ${ui.remind.file ? '' : 'disabled'}>${ui.remind.file ? 'Statement' : '<span class="spin"></span>Statement'}</button>
        <button class="btn" data-action="remind-send">${icon('send')}Send message</button>
      </div></div>
    </div>`;
  }
  async function prepareStatement(code) {
    try {
      const file = await htmlToPdf([statementHTML(code)], 'Statement', `Monterra_Statement_${(clientBy(code) || { short: code }).short.replace(/\W+/g, '_')}_${L.todayISO()}.pdf`);
      if (ui.remind && ui.remind.code === code) { ui.remind.file = file; render(); }
    } catch (e) { console.error(e); }
  }
  function markReminded(code) {
    const now = Date.now();
    for (const i of state.invoices) if (i.clientCode === code && i.status === 'sent' && !i.paid) i.remindedAt = now;
    save();
  }

  // ---------- invoice document ----------
  const qrCache = {};
  // The QR fills in the exact amount and puts a short invoice code in the payment note,
  // so the payment can be matched from the bank statement.
  function qrDataURL(b, inv) {
    const am = inv ? `&am=${invTotals(inv).total.toFixed(2)}&tn=${encodeURIComponent(L.compactCode(inv.number))}` : '';
    const payload = `upi://pay?pa=${b.upi}&pn=${encodeURIComponent(b.upiName || '')}${am}&cu=INR`;
    if (!qrCache[payload]) {
      const q = window.qrcode(0, 'M'); q.addData(payload); q.make();
      qrCache[payload] = q.createDataURL(6, 2);
    }
    return qrCache[payload];
  }

  function invoiceHTML(inv) {
    const b = (inv.snap && inv.snap.b) || D().business, c = billTo(inv);
    const mode = gstModeOf(inv), t = invTotals(inv);
    const hsnOf = (it) => { const p = productBy(it.productId); return (p && p.hsn) || b.hsn || ''; };
    const billLines = c.addr.map(esc);
    if (c.contact) billLines.push(esc(/^contact|·/i.test(c.contact) ? c.contact : 'Contact: ' + c.contact));
    if (c.gstin) billLines.push(`GSTIN: <strong>${esc(c.gstin)}</strong>`);
    const rows = inv.items.map((it, i) => `<tr><td class="product">${esc(it.name || '—')}</td><td class="center">${esc(hsnOf(it))}</td>
      <td class="center">${esc(it.qty)}</td><td class="right">${L.money(t.lines[i].unit)}</td><td class="right">${L.money(t.lines[i].total)}</td></tr>`).join('');
    let tot = `<tr><td class="label">Items subtotal${mode === 'none' ? '' : ' (taxable)'}</td><td class="value">${L.money(t.taxable)}</td></tr>`;
    if (mode !== 'none') tot += `<tr><td class="label">CGST @ 2.5% (on items)</td><td class="value">${L.money(t.cgst)}</td></tr><tr><td class="label">SGST @ 2.5% (on items)</td><td class="value">${L.money(t.sgst)}</td></tr>`;
    const share = deliveryPct(inv) !== 100 ? `${deliveryPct(inv)}% share` : '';
    const delNote = [share, mode === 'none' ? '' : 'no GST'].filter(Boolean).join(', ');
    if (t.delivery) tot += `<tr><td class="label">Delivery charges${delNote ? ` (${delNote})` : ''}</td><td class="value">${L.money(t.delivery)}</td></tr>`;
    tot += `<tr class="grand"><td class="label">Total Due</td><td class="value">${L.money(t.total)}</td></tr>`;
    const gstLine = mode === 'add' ? 'GST @ 5% on bakery products (CGST 2.5% + SGST 2.5%). ' : mode === 'included' ? 'Prices include GST @ 5% (CGST 2.5% + SGST 2.5%). ' : '';
    return `<div class="inv">
      <div class="header"><div class="brand-mark"><div class="name">MONTERRA</div><div class="sub">FOODS</div><div class="tagline">Bakery &middot; Chennai</div></div>
        <div class="meta"><h1>${mode === 'none' ? 'INVOICE' : 'TAX INVOICE'}</h1><div class="invoice-no">Invoice #: ${esc(inv.number)}</div><div class="date">Date: ${esc(L.longDate(inv.date))}</div></div></div>
      <div class="parties">
        <div class="party"><h3>From</h3><div class="name">${esc(b.name)}</div><div class="addr">${b.addr.map(esc).join('<br>')}<br>GSTIN: <strong>${esc(b.gstin)}</strong><br>CIN: <strong>${esc(b.cin)}</strong></div></div>
        <div class="party"><h3>Bill To</h3><div class="name">${esc(c.name)}</div><div class="addr">${billLines.join('<br>')}</div></div>
      </div>
      <table class="items"><thead><tr><th>Item</th><th class="center">HSN</th><th class="center">Qty</th><th class="right">Unit Price</th><th class="right">Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals"><div></div><table>${tot}</table></div>
      <div class="terms"><h3>Payment Details</h3>
        <table style="width:100%;border-collapse:collapse;"><tr><td style="vertical-align:top;">
          <p><strong>Due on receipt</strong> &middot; <strong>GPay:</strong> ${esc(b.gpay)}</p>
          <p style="margin-top:6px;"><strong>Bank Transfer &mdash; Monterra Foods:</strong></p>
          <p>A/C Holder: <strong>${esc(b.acHolder)}</strong> &middot; A/C No: <strong>${esc(b.acNo)}</strong> (${esc(b.acType)})</p>
          <p>Bank: <strong>${esc(b.bank)}</strong> &middot; Branch: <strong>${esc(b.branch)}</strong> &middot; IFSC: <strong>${esc(b.ifsc)}</strong></p>
          <p style="margin-top:6px;">${esc(gstLine + (b.note || ''))}</p>
        </td><td style="vertical-align:top;text-align:center;padding-left:14px;width:110px;">
          <img src="${qrDataURL(b, inv)}" style="width:100px;height:100px;display:block;margin:0 auto;image-rendering:pixelated" alt="UPI QR">
          <div style="font-size:8px;margin-top:3px;color:#6b7280;font-weight:600;letter-spacing:0.5px;">SCAN TO PAY ${L.money(invTotals(inv).total)}</div>
          <div style="font-size:7px;margin-top:1px;color:#9ca3af;">${esc(b.upi)} · Ref ${esc(L.compactCode(inv.number))}</div>
        </td></tr></table></div>
      <div class="footer"><p><strong>Monterra Foods</strong> &middot; Chennai</p><p>Thank you for your order.</p></div>
    </div>`;
  }

  // ---------- PDFs are made in the background, one at a time ----------
  function needsPdf(inv) {
    return (inv.status !== 'sent' || ui.open === inv.id) && !(ui.edit && ui.open === inv.id) && !pdfFor(inv) && !blockers(inv).length && pdfFail[inv.id] !== sig(inv);
  }
  let pdfTimer;
  function kickPdfs() { clearTimeout(pdfTimer); pdfTimer = setTimeout(runPdfQueue, 120); }
  async function runPdfQueue() {
    if (pdfBusy) return;
    const inv = state.invoices.find(needsPdf);
    if (!inv) return;
    pdfBusy = inv.id;
    const s = sig(inv);
    try {
      pdfCache[inv.id] = { sig: s, file: await buildPdf(inv) };
    } catch (e) {
      console.error(e);
      pdfFail[inv.id] = s;
    }
    pdfBusy = null;
    if (ui.open === inv.id && !ui.edit && !ui.picker) render(); else softRender();
    kickPdfs();
  }

  async function buildPdf(inv) {
    return htmlToPdf([invoiceHTML(inv)], `Invoice ${inv.number}`, L.fileName(clientBy(inv.clientCode), inv.date, inv.number));
  }


  // ---------- sharing ----------
  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function shareFile(file) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return true; }
    downloadFile(file);
    return false;
  }
  async function shareOrSave(file) {
    try { await shareFile(file); } catch (e) { if (!e || e.name !== 'AbortError') downloadFile(file); }
  }

  async function sendInvoice(inv) {
    const file = pdfFor(inv);
    if (!file) { toast('Still preparing the PDF — one moment'); return; }
    try {
      const shared = await shareFile(file); // called straight from the tap, as iPhone requires
      if (!shared) { toast('Sharing isn’t available here, so the PDF was downloaded'); return; }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // share sheet closed
      toast('Could not share: ' + e.message); return;
    }
    learnFrom(inv);
    const wasSent = !!inv.sentAt;
    const bc = clientBy(inv.clientCode) || {};
    inv.gst = gstModeOf(inv);
    inv.snap = { c: { name: bc.name, short: bc.short, addr: (bc.addr || []).slice(), contact: bc.contact, gstin: bc.gstin }, b: clone(D().business) };
    inv.status = 'sent'; inv.sentAt = Date.now(); delete inv.resend; save();
    if (ui.tab === 'orders') { ui.open = null; ui.edit = false; }
    render();
    const c = clientBy(inv.clientCode);
    const left = state.invoices.filter((i) => i.status !== 'sent').length;
    toast(`Sent to ${c ? c.short : 'client'}${left && ui.tab === 'orders' ? ` · ${left} to go` : ''}`, wasSent ? null : {
      label: 'Undo', fn: () => { inv.status = 'draft'; delete inv.sentAt; save(); render(); },
    });
  }

  // Remember corrections so next time the same wording matches by itself.
  function learnFrom(inv) {
    const c = clientBy(inv.clientCode);
    if (!c) return;
    if (inv.clientText && inv.clientCode !== inv.autoClient) {
      c.aliases = c.aliases || [];
      L.learnAlias(c.aliases, inv.clientText);
      inv.autoClient = inv.clientCode;
    }
    for (const it of inv.items) {
      const p = productBy(it.productId);
      if (!p) continue;
      if (it.rawName && it.productId !== it.autoProduct) {
        p.aliases = p.aliases || [];
        L.learnAlias(p.aliases, it.rawName);
        it.autoProduct = it.productId;
      }
      const r = L.findRate(c, p.id);
      if (!r) c.rates.push({ p: p.id, price: Number(it.price) });
      else if (r.old) r.old = false;
    }
    save();
  }

  // ---------- reading orders ----------
  function readText(text) {
    if (!text || !text.trim()) { toast('Nothing to read — copy the orders in WhatsApp first'); return false; }
    const drafts = L.readOrders(text, D());
    let added = 0, skipped = 0;
    for (const d of drafts) {
      if (state.invoices.some((x) => x.raw === d.raw && x.date === d.date)) { skipped++; continue; }
      Object.assign(d, { status: 'draft', createdAt: Date.now() + added, gst: null, paid: false });
      d.number = L.invoiceNumber(D().business.prefix, d.date, d.clientCode, takenNumbers(null));
      state.invoices.push(d); added++;
    }
    save();
    ui.tab = 'orders';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!drafts.length) toast('No orders found in that text');
    else if (!added) toast(`Already read ${plural(skipped, 'order')} before`);
    else toast(`${plural(added, 'order')} read${skipped ? ` · ${skipped} already read` : ''}`);
    return added > 0;
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      readText(text);
    } catch (e) {
      ui.typing = true; render();
      toast('Paste the orders into the box');
    }
  }

  // ---------- editing helpers ----------
  function setItemProduct(inv, it, pid) {
    const p = productBy(pid), c = clientBy(inv.clientCode), r = c ? L.findRate(c, pid) : null;
    if (!p) return;
    it.productId = pid;
    it.name = (r && r.label) || p.name;
    it.desc = '';
    if (r) it.price = r.price;
    it.unmatched = false;
    it.notes = (it.notes || []).filter((n) => !/check/i.test(n));
    if (!r) it.notes.push('No price for this client — check price');
    else if (r.old) it.notes.push('Not ordered recently — check price');
  }
  function repriceForClient(inv) {
    const c = clientBy(inv.clientCode);
    for (const it of inv.items) {
      if (it.productId) setItemProduct(inv, it, it.productId);
      else if (it.rawName && c) { const hit = L.matchProduct(it.rawName, c, D().products); if (hit) setItemProduct(inv, it, hit.product.id); }
    }
  }
  function newProduct(name) {
    const base = L.norm(name).replace(/ /g, '-') || 'product';
    let id = base, n = 2;
    while (productBy(id)) id = base + '-' + n++;
    const p = { id, name: name.trim().replace(/\b\w/g, (ch) => ch.toUpperCase()), desc: '', aliases: [L.norm(name)] };
    D().products.push(p);
    return p;
  }
  function updateTotals(inv) {
    const t = invTotals(inv);
    inv.items.forEach((it, i) => { const el = document.getElementById('lt-' + it.id); if (el) el.textContent = L.money(t.lines[i].total); });
    const el = document.getElementById('totals'); if (el) el.innerHTML = totalsHTML(inv);
  }

  function openPicker(kind, target) {
    const inv = ui.open ? invBy(ui.open) : null;
    ui.picker = Object.assign({ kind, q: '' }, target);
    if (kind === 'product' && !ui.picker.clientCode && inv) ui.picker.clientCode = inv.clientCode;
    render();
  }
  function applyPick(value) {
    const pk = ui.picker;
    ui.picker = null;
    if (pk.kind === 'client') {
      const inv = invBy(ui.open);
      const stated = statedDelivery(inv);
      inv.clientCode = value; inv.gst = null; repriceForClient(inv); renumber(inv);
      inv.deliveryStated = stated; inv.delivery = L.deliveryFor(clientBy(value), stated);
      markEdited(inv);
    } else if (pk.target === 'item' || pk.target === 'new-item') {
      const inv = invBy(ui.open);
      let it = inv.items.find((x) => x.id === pk.itemId);
      if (!it) { it = L.makeItem(null, null, 1); inv.items.push(it); }
      setItemProduct(inv, it, value); markEdited(inv);
    } else if (pk.target === 'rate' || pk.target === 'new-rate') {
      const c = clientBy(ui.client);
      if (pk.target === 'new-rate') c.rates.push({ p: value, price: 0 });
      else c.rates[pk.i].p = value;
      save();
    }
    render();
  }

  // ---------- events ----------
  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    const inv = ui.open ? invBy(ui.open) : null;
    switch (a) {
      case 'tab': ui.tab = el.dataset.tab; ui.open = ui.client = ui.product = ui.picker = ui.bank = ui.pack = ui.remind = null; ui.edit = ui.typing = false; ui.listQ = ''; render(); window.scrollTo(0, 0); break;
      case 'seg': ui.seg = el.dataset.seg; ui.listQ = ''; render(); break;
      case 'paste': await pasteFromClipboard(); break;
      case 'type': ui.typing = true; render(); setTimeout(() => { const b = document.getElementById('paste-box'); if (b) b.focus(); }, 300); break;
      case 'close-type': ui.typing = false; render(); break;
      case 'read-box': { const ok = readText(ui.pasteText); if (ok) { ui.typing = false; ui.pasteText = ''; render(); } break; }
      case 'open': ui.open = el.dataset.id; ui.edit = false; render(); break;
      case 'fix': ui.open = el.dataset.id; ui.edit = true; render(); break;
      case 'retry': delete pdfFail[inv.id]; render(); break;
      case 'edit': ui.edit = true; render(); break;
      case 'done': ui.edit = false; save(); render(); break;
      case 'send': { const i = invBy(el.dataset.id); if (i) await sendInvoice(i); break; }
      case 'download': { const f = inv && pdfFor(inv); if (f) await shareOrSave(f); break; }
      case 'toggle-paid': { ev.stopPropagation(); const i = invBy(el.dataset.id); i.paid = !i.paid; save(); render(); toast(i.paid ? 'Marked paid' : 'Marked unpaid'); break; }
      case 'sent-filter': ui.sentFilter = el.dataset.v; ui.sentClient = ''; render(); break;
      case 'sent-client': ui.sentClient = ui.sentClient === el.dataset.v ? '' : el.dataset.v; ui.sentFilter = 'all'; render(); break;
      case 'back':
        if (ui.picker) ui.picker = null;
        else if (ui.open) { ui.open = null; ui.edit = false; }
        else if (ui.product) ui.product = null;
        else if (ui.client) ui.client = null;
        render(); break;
      case 'new-invoice': {
        const d = { id: L.newId(), status: 'draft', createdAt: Date.now(), clientCode: '', autoClient: '', clientText: '', date: L.todayISO(), items: [], delivery: 0, unread: [], raw: '', sender: '', gst: null, paid: false };
        d.number = L.invoiceNumber(D().business.prefix, d.date, '', takenNumbers(null));
        state.invoices.push(d); save(); ui.open = d.id; ui.edit = true; render(); break;
      }
      case 'delete-invoice':
        if (confirm(`Delete invoice ${inv.number}?`)) { state.invoices = state.invoices.filter((i) => i.id !== inv.id); save(); ui.open = null; ui.edit = false; render(); toast('Invoice deleted'); }
        break;
      case 'pick-client': openPicker('client', { said: inv.clientCode !== inv.autoClient || !inv.clientCode ? inv.clientText : '' }); break;
      case 'pick-product': { const it = inv.items.find((x) => x.id === el.dataset.item); openPicker('product', { target: 'item', itemId: it.id, said: it.rawName || '' }); break; }
      case 'add-item': openPicker('product', { target: 'new-item' }); break;
      case 'pick-rate': openPicker('product', { target: 'rate', i: Number(el.dataset.i), clientCode: '' }); break;
      case 'add-rate': openPicker('product', { target: 'new-rate', clientCode: '' }); break;
      case 'picked': applyPick(el.dataset.v); break;
      case 'picked-new': { const p = newProduct(ui.picker.q); save(); applyPick(p.id); toast(`Added ${p.name}`); break; }
      case 'close-picker': ui.picker = null; render(); break;
      case 'qty-step': {
        const it = inv.items.find((x) => x.id === el.dataset.item);
        it.qty = Math.max(0, L.r2(Number(it.qty || 0) + Number(el.dataset.d)));
        const input = el.parentElement.querySelector('input'); if (input) input.value = it.qty;
        markEdited(inv); updateTotals(inv); break;
      }
      case 'del-item': inv.items = inv.items.filter((i) => i.id !== el.dataset.item); markEdited(inv); render(); break;
      case 'edit-client': ui.client = el.dataset.code; render(); break;
      case 'edit-product': ui.product = el.dataset.id; render(); break;
      case 'new-client': {
        let code = 'NEW', n = 2; while (clientBy(code)) code = 'NEW' + n++;
        D().clients.push({ code, short: 'New client', file: '', name: '', addr: ['Chennai'], contact: '', gstin: '', gst: 'add', aliases: [], rates: [] });
        save(); ui.client = code; render(); break;
      }
      case 'new-product': { const p = newProduct('New product'); save(); ui.product = p.id; render(); break; }
      case 'delete-client': {
        const c = clientBy(ui.client);
        if (confirm(`Delete ${c.short}? Old invoices stay but show “Unknown client”.`)) { D().clients = D().clients.filter((x) => x !== c); save(); ui.client = null; render(); }
        break;
      }
      case 'delete-product': {
        const p = productBy(ui.product);
        const used = D().clients.filter((c) => c.rates.some((r) => r.p === p.id)).map((c) => c.short);
        if (confirm(`Delete ${p.name}?${used.length ? ' It is also removed from: ' + used.join(', ') : ''}`)) {
          D().products = D().products.filter((x) => x !== p);
          for (const c of D().clients) c.rates = c.rates.filter((r) => r.p !== p.id);
          save(); ui.product = null; render();
        }
        break;
      }
      case 'del-rate': { const c = clientBy(ui.client); c.rates.splice(Number(el.dataset.i), 1); save(); render(); break; }
      case 'backup': await shareOrSave(new File([JSON.stringify(state, null, 1)], `monterra-invoices-backup-${L.todayISO()}.json`, { type: 'application/json' })); break;
      case 'restore': document.getElementById('restore-file').click(); break;
      case 'csv': {
        const rows = [['Date', 'Invoice', 'Client', 'Taxable', 'CGST', 'SGST', 'Delivery', 'Total', 'Paid']];
        for (const i of state.invoices.filter((x) => x.status === 'sent').sort((x, y) => x.date.localeCompare(y.date))) {
          const t = invTotals(i), c = clientBy(i.clientCode);
          rows.push([i.date, i.number, c ? c.short : '', t.taxable, t.cgst, t.sgst, t.delivery, t.total, i.paid ? 'Yes' : 'No']);
        }
        const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        await shareOrSave(new File(['﻿' + csv], `monterra-invoices-${L.todayISO()}.csv`, { type: 'text/csv' }));
        break;
      }
      case 'bank': document.getElementById('bank-file').click(); break;
      case 'pack': ui.pack = { month: null }; render(); break;
      case 'close-pack': ui.pack = null; render(); break;
      case 'pack-month': ui.pack = { month: el.dataset.v }; render(); break;
      case 'pack-make': ui.pack.busy = 'Starting…'; render(); await makePack(); break;
      case 'pack-share': await sharePack(); break;
      case 'remind': ui.remind = { code: el.dataset.code, text: null, file: null }; render(); prepareStatement(el.dataset.code); break;
      case 'close-remind': ui.remind = null; render(); break;
      case 'remind-send': {
        const code = ui.remind.code;
        try {
          if (navigator.share) { await navigator.share({ text: ui.remind.text }); markReminded(code); toast('Reminder sent'); }
          else { await navigator.clipboard.writeText(ui.remind.text); toast('Message copied — paste it in WhatsApp'); markReminded(code); }
        } catch (e) { if (!e || e.name !== 'AbortError') toast('Could not share: ' + e.message); }
        render(); break;
      }
      case 'remind-pdf': {
        const f = ui.remind.file; if (!f) break;
        try { const ok = await shareFile(f); if (ok) markReminded(ui.remind.code); } catch (e) { if (!e || e.name !== 'AbortError') downloadFile(f); }
        render(); break;
      }
      case 'close-bank': ui.bank = null; ui.bankPick = null; render(); break;
      case 'bank-change': ui.bankPick = Number(el.dataset.i); ui.bankPickSel = new Set(ui.bank.results[ui.bankPick].invoiceIds); render(); break;
      case 'close-bank-pick': ui.bankPick = null; render(); break;
      case 'bank-pick-done': {
        const r = ui.bank.results[ui.bankPick];
        r.invoiceIds = [...ui.bankPickSel];
        r.on = r.invoiceIds.length > 0;
        r.status = r.on ? 'manual' : 'none'; r.why = r.on ? 'Chosen by you' : '';
        ui.bankPick = null; render(); break;
      }
      case 'bank-ignore': {
        const r = ui.bank.results[Number(el.dataset.i)];
        r.status = 'ignored'; r.on = false;
        state.payments.push({ key: r.credit.key, date: r.credit.date, amount: r.credit.amount, payer: r.payer, ignored: true });
        save(); render(); break;
      }
      case 'bank-apply': applyBank(); break;
      case 'reset-data':
        if (confirm('Put clients, products and prices back to the starting list? Your invoices are kept.')) { state.data = clone(DEFAULTS); save(); render(); toast('Clients and prices reset'); }
        break;
    }
  });

  // keyboard: Enter/Space on role=button cells
  document.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[role="button"][data-action]')) { ev.preventDefault(); ev.target.click(); }
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.id === 'bank-file') {
      const f = el.files && el.files[0];
      el.value = '';
      if (f) checkStatement(f);
      return;
    }
    if (el.id === 'restore-file') {
      const f = el.files && el.files[0];
      if (!f) return;
      f.text().then((txt) => {
        const s = JSON.parse(txt);
        if (!s || !s.data || !Array.isArray(s.invoices)) throw new Error('not a Monterra backup');
        if (!confirm(`Restore this backup (${plural(s.invoices.length, 'invoice')})? It replaces what is on this phone now.`)) return;
        for (const i of s.invoices) if (i.status === 'ready') i.status = 'draft';
        state = s; save(); render(); toast('Backup restored');
      }).catch((e) => toast('Could not restore: ' + e.message));
      el.value = '';
      return;
    }
    onField(ev, true);
  });
  document.addEventListener('input', (ev) => onField(ev, false));

  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

  function onField(ev, committed) {
    const el = ev.target;
    const f = el.dataset && el.dataset.f;
    if (!f) return;
    const val = el.type === 'checkbox' ? el.checked : el.value;

    if (f === 'paste') { ui.pasteText = val; return; }
    if (f === 'remind-text') { ui.remind.text = val; return; }
    if (f === 'bank-on') { if (committed) { ui.bank.results[Number(el.dataset.i)].on = el.checked; render(); } return; }
    if (f === 'bank-pickinv') { if (committed) { if (el.checked) ui.bankPickSel.add(el.dataset.id); else ui.bankPickSel.delete(el.dataset.id); render(); } return; }
    // Search boxes: redraw only while typing. Redrawing on "change" (fired when the box loses focus)
    // would swap the list out from under the tap that caused it.
    if ((f === 'picker-q' || f === 'list-q') && committed) return;
    if (f === 'picker-q') { ui.picker.q = val; document.getElementById('picker-rows').innerHTML = pickerRows(); return; }
    if (f === 'list-q') { ui.listQ = val; document.getElementById('list-rows').innerHTML = ui.seg === 'clients' ? clientRows(val) : productRows(val); return; }

    if (ui.open && ui.edit) {
      const inv = invBy(ui.open);
      const it = el.dataset.item ? inv.items.find((x) => x.id === el.dataset.item) : null;
      if (f === 'qty' || f === 'price') { it[f] = num(val); markEdited(inv); updateTotals(inv); return; }
      if (f === 'delivery') {
        inv.deliveryStated = num(val); inv.delivery = L.deliveryFor(clientBy(inv.clientCode), inv.deliveryStated);
        markEdited(inv); updateTotals(inv);
        const n = document.getElementById('del-note'); if (n) n.textContent = deliveryNote(inv);
        return;
      }
      if (f === 'number') { inv.number = val.trim().toUpperCase(); inv.numberManual = true; markEdited(inv); if (committed) render(); return; }
      if (!committed) return;
      if (f === 'date') { if (val) { inv.date = val; renumber(inv); markEdited(inv); render(); } return; }
      if (f === 'gst') { const c = clientBy(inv.clientCode); inv.gst = c && c.gst === val ? null : val; markEdited(inv); render(); return; }
      return;
    }

    if (ui.client) {
      const c = clientBy(ui.client);
      const i = Number(el.dataset.i);
      switch (f) {
        case 'c-short': c.short = val; break;
        case 'c-code': {
          if (!committed) return;
          const code = val.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); // keeps invoice numbers within GST's 16 characters
          if (!code || (code !== c.code && clientBy(code))) { toast('That code is empty or already used'); render(); return; }
          for (const x of state.invoices) if (x.clientCode === c.code) x.clientCode = code;
          c.code = code; ui.client = code; save(); render(); return;
        }
        case 'c-name': c.name = val; break;
        case 'c-addr': c.addr = val.split('\n').map((s) => s.trim()).filter(Boolean); break;
        case 'c-contact': c.contact = val; break;
        case 'c-gstin': c.gstin = val.trim().toUpperCase(); break;
        case 'c-gst': c.gst = val; break;
        case 'c-deliveryPct': {
          c.deliveryPct = val === '' ? undefined : Math.max(0, Math.min(100, num(val)));
          // update invoices for this client that haven't been sent yet
          for (const x of state.invoices) if (x.clientCode === c.code && x.status !== 'sent') {
            x.deliveryStated = statedDelivery(x); x.delivery = L.deliveryFor(c, x.deliveryStated);
          }
          break;
        }
        case 'c-aliases': c.aliases = val.split(',').map((s) => L.norm(s)).filter(Boolean); break;
        case 'r-price': c.rates[i].price = num(val); break;
        case 'r-label': c.rates[i].label = val.trim() || undefined; break;
        case 'r-desc': c.rates[i].desc = val.trim() || undefined; break;
        case 'r-old': c.rates[i].old = !!val || undefined; break;
      }
      save();
      if (committed && (f === 'c-short' || f === 'r-label' || f === 'r-old')) render();
      return;
    }

    if (ui.product) {
      const p = productBy(ui.product);
      switch (f) {
        case 'p-name': p.name = val; break;
        case 'p-hsn': p.hsn = val.trim() || undefined; break;
        case 'p-desc': p.desc = val; break;
        case 'p-aliases': p.aliases = val.split(',').map((s) => L.norm(s)).filter(Boolean); break;
        case 'p-tray': p.tray = num(val) || undefined; break;
        case 'p-slices': p.slices = num(val) || undefined; break;
      }
      save();
      if (committed && f === 'p-name') render();
      return;
    }

    if (f.startsWith('b-')) {
      const k = f.slice(2);
      D().business[k] = k === 'addr' ? val.split('\n').map((s) => s.trim()).filter(Boolean) : val;
      save();
    }
  }

  window.addEventListener('resize', fitPreview);
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }

  // test hooks for a desktop browser
  window.__monterra = {
    checkStatement, statementHTML, registerPages,
    state: () => state, readText, pdfFor: (id) => pdfFor(invBy(id)),
    idle: () => new Promise((res) => { const t = setInterval(() => { if (!pdfBusy && !state.invoices.some(needsPdf)) { clearInterval(t); res(); } }, 100); }),
  };

  render();
})();
