// Order reading, matching, totals and numbering. No UI code here so it can be tested in Node.
(function (root) {
  const INVISIBLE = /[‎‏‪-‮⁦-⁩﻿]/g;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // ---------- text helpers ----------
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[″"'’]/g, '').replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function singular(t) {
    if (t.length > 3 && t.endsWith('es') && /(ches|shes|xes|sses)$/.test(t)) return t.slice(0, -2);
    if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us')) return t.slice(0, -1);
    return t;
  }
  function tokens(s) { return norm(s).split(' ').filter(Boolean).map(singular); }

  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  const sorted = (t) => t.split('').sort().join('');
  function tokEq(a, b) {
    if (a === b) return true;
    const n = Math.min(a.length, b.length);
    if (n < 4 || /\d/.test(a + b)) return false;
    if (n >= 6 && a.length === b.length && sorted(a) === sorted(b)) return true; // foccaica ~ focaccia
    if (n >= 5 && (a.startsWith(b) || b.startsWith(a))) return true; // choco ~ chocolate
    return lev(a, b) <= (n >= 7 ? 2 : 1);
  }
  // Dice similarity on tokens with typo tolerance: 1 = same words.
  function similarity(aTok, bTok) {
    if (!aTok.length || !bTok.length) return 0;
    const used = new Array(bTok.length).fill(false);
    let m = 0;
    for (const a of aTok) {
      const j = bTok.findIndex((b, k) => !used[k] && tokEq(a, b));
      if (j >= 0) { used[j] = true; m++; }
    }
    return (2 * m) / (aTok.length + bTok.length);
  }

  // ---------- matching ----------
  const ACCEPT = 0.6;

  function matchClient(text, clients) {
    const t = tokens(text);
    let best = null;
    for (const c of clients) {
      const names = [c.short, c.name, c.code, ...(c.aliases || [])];
      const score = Math.max(...names.map((n) => similarity(t, tokens(n))));
      if (!best || score > best.score) best = { client: c, score };
    }
    return best && best.score >= ACCEPT ? best.client : null;
  }

  function findRate(client, productId) {
    return client ? (client.rates || []).find((r) => r.p === productId) : null;
  }

  function matchProduct(text, client, products) {
    const t = tokens(text);
    let best = null;
    for (const p of products) {
      const rate = findRate(client, p.id);
      const names = [p.name, ...(p.aliases || [])];
      if (rate && rate.label) names.push(rate.label);
      const raw = Math.max(...names.map((n) => similarity(t, tokens(n))));
      const score = raw + (rate ? (rate.old ? 0.1 : 0.2) : 0);
      if (!best || score > best.score) best = { product: p, rate, raw, score };
    }
    // Looser on the client's own price list, stricter elsewhere ("pistachio kunafa" is not "pistachio puff").
    const need = best && best.rate ? 0.5 : 0.75;
    return best && best.raw >= need ? best : null;
  }

  // ---------- reading WhatsApp text ----------
  const DATE_RE = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/;
  function toISO(d, m, y) {
    y = Number(y); if (y < 100) y += 2000;
    const dd = Number(d), mm = Number(m);
    if (!(mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31)) return null;
    return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
  function findDate(s) { const m = DATE_RE.exec(s || ''); return m ? toISO(m[1], m[2], m[3]) : null; }

  // Splits pasted chat into messages. Handles Android "[5:53 pm, 10/11/2026] Name: text"
  // and iPhone "[10/11/26, 5:53:12 PM] Name: text". Text with no headers is one message.
  function splitMessages(text) {
    const clean = String(text || '').replace(INVISIBLE, '').replace(/\r\n?/g, '\n');
    const HEAD = /^\[([^\]\n]{6,40})\]\s*([^:\n]{1,60}):[ \t]*/gm;
    const heads = [];
    let m;
    while ((m = HEAD.exec(clean))) if (DATE_RE.test(m[1])) heads.push({ index: m.index, end: HEAD.lastIndex, date: findDate(m[1]), sender: m[2].trim() });
    if (!heads.length) return clean.trim() ? [{ date: null, sender: '', body: clean }] : [];
    return heads.map((h, i) => ({ date: h.date, sender: h.sender, body: clean.slice(h.end, i + 1 < heads.length ? heads[i + 1].index : clean.length) }));
  }

  const UNIT = '(trays?|nos?|numbers?|pcs?|pieces?|kgs?|tubs?|box(?:es)?|cups?|slices?|packs?|units?|cakes?)';
  const QTY_LAST = new RegExp(`^(.*?[a-z].*?)[\\s=:\\-–—x×*@.,]*?(\\d+(?:\\.\\d+)?)\\s*${UNIT}?[.\\s]*$`, 'i');
  const QTY_FIRST = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${UNIT}?\\s*(?:x|×|-|of)?\\s+(.*[a-z].*)$`, 'i');

  function stripBullet(line) { return line.replace(/^\s*(?:\d{1,2}\s*[.)]|[-*•●▪➤])\s*/, '').trim(); }

  function parseItemLine(line) {
    const s = stripBullet(line);
    if (!s) return null;
    let m = QTY_LAST.exec(s);
    if (m) return { name: m[1].replace(/[\s=:\-–—.,*]+$/, '').trim(), qty: Number(m[2]), unit: (m[3] || '').toLowerCase() };
    m = QTY_FIRST.exec(s);
    if (m) return { name: m[3].replace(/[\s=:\-–—.,*]+$/, '').trim(), qty: Number(m[1]), unit: (m[2] || '').toLowerCase() };
    return null;
  }

  const DELIVERY_RE = /deliver|porter|transport|courier/i;
  const ORDER_HEAD_RE = /delivery\s*date|del\.?\s*date|deliver(?:y)?\s+on\b/i;

  // One message can hold one order or several (each starting with a "... delivery date ..." line).
  function splitOrders(msg) {
    const lines = msg.body.split('\n').map((l) => l.trim()).filter(Boolean);
    const orders = [];
    let cur = null;
    for (const line of lines) {
      const isHead = ORDER_HEAD_RE.test(line) && !/charge|fee|rs|₹/i.test(line);
      if (isHead || !cur) {
        if (!isHead && !cur && parseItemLine(line) && !DELIVERY_RE.test(line)) {
          cur = { header: '', date: msg.date, lines: [line], sender: msg.sender };
          orders.push(cur); continue;
        }
        cur = { header: line, date: findDate(line) || msg.date, lines: [], sender: msg.sender };
        orders.push(cur); continue;
      }
      cur.lines.push(line);
    }
    return orders;
  }

  function clientTextOf(header) {
    return header.replace(ORDER_HEAD_RE, ' ').replace(DATE_RE, ' ').replace(/[:\-–]+\s*$/, '').trim();
  }

  // ---------- drafts ----------
  let uid = 0;
  function newId() { return Date.now().toString(36) + '-' + (uid++).toString(36) + Math.random().toString(36).slice(2, 6); }

  function makeItem(product, rate, qty, extra) {
    return Object.assign({
      id: newId(),
      productId: product ? product.id : '',
      name: product ? ((rate && rate.label) || product.name) : '',
      desc: product ? ((rate && rate.desc) || product.desc || '') : '',
      qty,
      price: rate ? rate.price : 0,
      notes: [],
    }, extra || {});
  }

  function buildItem(parsed, client, products) {
    const hit = matchProduct(parsed.name, client, products);
    let qty = parsed.qty;
    const notes = [];
    if (hit) {
      const p = hit.product;
      if (/^tray/.test(parsed.unit)) {
        const per = p.tray || 12;
        qty = parsed.qty * per;
        notes.push(`${parsed.qty} tray → ${qty}`);
      } else if (p.slices && /^(no|number|pc|piece|slice)/.test(parsed.unit) && qty >= p.slices && qty % p.slices === 0) {
        qty = qty / p.slices;
        notes.push(`${parsed.qty} ${parsed.unit} → ${qty} whole cake${qty > 1 ? 's' : ''}`);
      }
      if (!hit.rate) notes.push('No rate for this client — check price');
      else if (hit.rate.old) notes.push('Not ordered recently — check price');
    }
    return makeItem(hit && hit.product, hit && hit.rate, qty, {
      raw: parsed.name + ' ' + parsed.qty + (parsed.unit ? ' ' + parsed.unit : ''),
      rawName: parsed.name,
      autoProduct: hit ? hit.product.id : '',
      notes,
      unmatched: !hit,
    });
  }

  function buildDraft(order, data) {
    const clientText = order.header ? clientTextOf(order.header) : '';
    const client = clientText ? matchClient(clientText, data.clients) : null;
    const items = [];
    const unread = [];
    let delivery = 0;
    for (const line of order.lines) {
      if (DELIVERY_RE.test(line)) {
        const m = /(\d+(?:\.\d+)?)/.exec(line.replace(DATE_RE, ''));
        if (m) { delivery += Number(m[1]); continue; }
      }
      const parsed = parseItemLine(line);
      if (parsed) items.push(buildItem(parsed, client, data.products));
      else unread.push(line);
    }
    const deliveryStated = delivery;
    delivery = deliveryFor(client, deliveryStated);
    return {
      id: newId(),
      deliveryStated,
      clientCode: client ? client.code : '',
      autoClient: client ? client.code : '',
      clientText,
      date: order.date || todayISO(),
      items,
      delivery,
      unread,
      raw: [order.header, ...order.lines].filter(Boolean).join('\n'),
      sender: order.sender || '',
      number: '',
    };
  }

  function readOrders(text, data) {
    const drafts = [];
    for (const msg of splitMessages(text)) for (const o of splitOrders(msg)) {
      if (!o.lines.length && !o.header) continue;
      const d = buildDraft(o, data);
      if (!d.items.length && !d.clientCode) continue; // chit-chat, not an order
      drafts.push(d);
    }
    return drafts;
  }

  // ---------- numbers, money ----------
  const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  // Some clients pay only part of the delivery fee (e.g. AGR S.P Kovil pays 50%).
  function deliveryShare(client) {
    const pct = client && client.deliveryPct != null && client.deliveryPct !== '' ? Number(client.deliveryPct) : 100;
    return isNaN(pct) ? 1 : pct / 100;
  }
  function deliveryFor(client, stated) { return r2(Number(stated || 0) * deliveryShare(client)); }

  function totals(items, delivery, gstMode) {
    const lines = items.map((it) => {
      const unit = gstMode === 'included' ? r2(Number(it.price) / 1.05) : r2(it.price);
      return { unit, total: r2(unit * Number(it.qty || 0)), gross: r2(Number(it.price) * Number(it.qty || 0)) };
    });
    const taxable = r2(lines.reduce((s, l) => s + l.total, 0));
    let cgst = 0, sgst = 0;
    if (gstMode === 'add') { cgst = r2(taxable * 0.025); sgst = cgst; }
    if (gstMode === 'included') {
      const gross = r2(lines.reduce((s, l) => s + l.gross, 0));
      const gst = r2(gross - taxable);
      cgst = r2(gst / 2); sgst = r2(gst - cgst);
    }
    const del = r2(delivery || 0);
    return { lines, taxable, cgst, sgst, delivery: del, total: r2(taxable + cgst + sgst + del) };
  }

  function invoiceNumber(prefix, dateISO, code, taken) {
    const [y, m, d] = dateISO.split('-');
    const base = `${prefix || 'MF'}${y.slice(2)}-${m}${d}-${code || 'NEW'}`; // e.g. MF26-1110-AGBN (GST allows 16 characters)
    if (!taken.has(base)) return base;
    for (let i = 1; i < 26; i++) {
      const n = `${base}-${String.fromCharCode(65 + i)}`;
      if (!taken.has(n)) return n;
    }
    return base + '-' + Date.now().toString(36).toUpperCase();
  }

  function fileName(client, dateISO, number) {
    const suffix = /-([B-Z])$/.exec(number || '');
    const slug = client && client.file ? client.file : norm(client ? client.short : 'client').replace(/ /g, '-');
    return `invoice-monterra-${slug}-${dateISO}${suffix ? '-' + suffix[1].toLowerCase() : ''}.pdf`;
  }

  function money(n) {
    const v = r2(n).toFixed(2);
    const [i, f] = v.split('.');
    return '₹' + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + f;
  }
  function longDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }
  function todayISO() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }

  // Remember a correction so the same wording matches next time.
  function learnAlias(list, text) {
    const n = norm(text);
    if (n && n.length > 1 && !list.some((a) => norm(a) === n)) list.push(n);
  }

  // ---------- bank statements (Kotak PDF text) ----------
  const MON3 = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const amt = (s) => Number(String(s).replace(/,/g, ''));
  const STOP = /MONTERRA FOODS|Statement Generated|End of Statement|Account Summary|Current Account Transactions|Page \d+ of/i;

  // Reads the transaction table. Credit/debit is worked out from the running balance.
  function parseStatement(text) {
    const flat = String(text || '').replace(INVISIBLE, '').replace(/\s+/g, ' ');
    const open = /Opening Balance[\s-]*?(\d[\d,]*\.\d\d)/i.exec(flat);
    const period = /(\d{1,2} [A-Za-z]{3} \d{4}) - (\d{1,2} [A-Za-z]{3} \d{4})/.exec(flat);
    const ROW = /(?:^|\s)(\d{1,4}) (\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) /g;
    const starts = [];
    let m, expect = null;
    while ((m = ROW.exec(flat))) {
      const n = Number(m[1]);
      if (expect !== null && n !== expect) continue; // a stray number that only looks like a row start
      starts.push({ i: m.index, end: ROW.lastIndex, n, date: toISO(m[2], MON3[m[3].toLowerCase()], m[4]) });
      expect = n + 1;
    }
    let prev = open ? amt(open[1]) : null;
    const rows = [];
    starts.forEach((s, k) => {
      let chunk = flat.slice(s.end, k + 1 < starts.length ? starts[k + 1].i : flat.length);
      const stop = STOP.exec(chunk); if (stop) chunk = chunk.slice(0, stop.index);
      const nums = [...chunk.matchAll(/\d[\d,]*\.\d\d/g)];
      if (nums.length < 2) return;
      const a = amt(nums[nums.length - 2][0]), bal = amt(nums[nums.length - 1][0]);
      let desc = chunk.slice(0, nums[nums.length - 2].index).trim();
      const refM = /\s(\S*-\S*|[A-Z]{3,}\d{6,}\S*)\s*$/.exec(desc);
      const ref = refM ? refM[1] : '';
      if (refM) desc = desc.slice(0, refM.index).trim();
      let credit = null;
      if (prev !== null) {
        if (Math.abs(prev + a - bal) < 0.011) credit = true;
        else if (Math.abs(prev - a - bal) < 0.011) credit = false;
      }
      if (credit === null) credit = /^(UPI\/[^/]+\/[^/]+\/\d+\/|Recd:|NEFT |MB:RECEIVED)/i.test(desc) && !/^UPI\/.*(Blinkit|Zepto|Swiggy)/i.test(desc);
      prev = bal;
      rows.push({ n: s.n, date: s.date, desc, ref, amount: a, balance: bal, credit, key: `${s.date}|${a}|${bal}` });
    });
    return {
      from: period ? toISOFromText(period[1]) : (rows[0] && rows[0].date), to: period ? toISOFromText(period[2]) : (rows.length && rows[rows.length - 1].date),
      rows, credits: rows.filter((r) => r.credit),
    };
  }
  function toISOFromText(s) { const [d, mo, y] = s.split(' '); return toISO(d, MON3[mo.toLowerCase()], y); }

  // Who sent the money, and the payment note (UPI remark).
  function payerOf(desc) {
    let m = /^UPI\/([^/]+)\/([^/]+)\/(\d+)\/?(.*)$/i.exec(desc);
    if (m) return { name: m[1].trim(), note: m[4].trim() };
    m = /Recd:IMPS\/\d+\/([^/]+)/i.exec(desc); if (m) return { name: m[1].trim(), note: '' };
    m = /NEFT\s+\d+\s+(.+)$/i.exec(desc); if (m) return { name: m[1].trim(), note: '' };
    m = /RECEIVED FROM\s+(.+?)(?:\s+[A-Z]{3,}\d{6,}.*)?$/i.exec(desc); if (m) return { name: m[1].trim(), note: '' };
    return { name: desc.slice(0, 40), note: '' };
  }

  // Short invoice code that fits in a UPI note (banks keep only ~12 characters): MF-2026-1110-RHY-B -> 1110RHYB
  function compactCode(number) { return String(number || '').replace(/^[A-Z]+-?\d{2,4}-/, '').replace(/[^A-Z0-9]/gi, '').toUpperCase(); }

  function payerClient(name, payers, clients) {
    const n = norm(name), t = tokens(name);
    let best = null;
    for (const [key, code] of Object.entries(payers || {})) {
      const s = (n.startsWith(key) || (key.startsWith(n) && n.length >= 6)) ? 1 : similarity(t, tokens(key));
      if (s >= 0.6 && (!best || s > best.s)) best = { code, s };
    }
    if (!best) for (const c of clients) {
      const s = Math.max(similarity(t, tokens(c.name)), similarity(t, tokens(c.short)));
      if (s >= 0.7 && (!best || s > best.s)) best = { code: c.code, s };
    }
    return best ? best.code : null;
  }

  // Finds unpaid invoices adding up to the payment (within ₹1). Tries "oldest first" before any combination.
  function findCombo(cands, target, tol) {
    const T = Math.round(target * 100), TOL = Math.round(tol * 100);
    const list = cands.slice(0, 22).map((c) => ({ c, v: Math.round(c.total * 100) }));
    let run = 0;
    for (let k = 0; k < list.length; k++) {
      run += list[k].v;
      if (Math.abs(run - T) <= TOL) return { picks: list.slice(0, k + 1).map((x) => x.c), unique: true };
      if (run > T + TOL) break;
    }
    const sols = [];
    let steps = 0;
    (function dfs(i, sum, pick) {
      if (sols.length > 1 || steps++ > 300000) return;
      if (Math.abs(sum - T) <= TOL && pick.length) { sols.push(pick.slice()); return; }
      if (i >= list.length || sum > T + TOL) return;
      pick.push(list[i].c); dfs(i + 1, sum + list[i].v, pick); pick.pop();
      dfs(i + 1, sum, pick);
    })(0, 0, []);
    return sols.length ? { picks: sols[0], unique: sols.length === 1 } : null;
  }

  // Matches incoming payments to unpaid invoices.
  // status: 'sure' (tick by default) · 'check' (a guess) · 'none' · 'owner' (own transfer) · 'done' (handled before)
  function matchPayments(credits, unpaid, opts) {
    const { clients = [], payers = {}, owner = [], doneKeys = new Set(), tol = 1 } = opts || {};
    const pool = unpaid.slice().sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
    const take = (invs) => { for (const i of invs) { const k = pool.indexOf(i); if (k >= 0) pool.splice(k, 1); } };
    const family = (code) => {
      const c = clients.find((x) => x.code === code);
      return c && c.gstin ? clients.filter((x) => x.gstin === c.gstin).map((x) => x.code) : [code];
    };
    const sum = (invs) => r2(invs.reduce((s, i) => s + i.total, 0));
    const res = credits.slice().sort((a, b) => a.date.localeCompare(b.date)).map((cr) => {
      const p = payerOf(cr.desc);
      return { credit: cr, payer: p.name, note: p.note, invoices: [], status: 'none', why: '' };
    });
    for (const r of res) {
      if (doneKeys.has(r.credit.key)) { r.status = 'done'; continue; }
      if (owner.some((o) => norm(r.payer).includes(norm(o)))) { r.status = 'owner'; r.why = 'Your own transfer'; }
    }
    const open = () => res.filter((r) => r.status === 'none');
    // 1) invoice code in the payment note
    for (const r of open()) {
      const hay = String(r.credit.desc).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const hits = pool.filter((i) => { const c = compactCode(i.number); return c.length >= 6 && hay.includes(c); });
      if (hits.length) {
        r.invoices = hits; take(hits); r.status = 'sure'; r.why = 'Invoice number in payment note';
        const d = r2(r.credit.amount - sum(hits)); if (Math.abs(d) > tol) { r.status = 'check'; r.why += ` · amount differs by ${money(Math.abs(d))}`; }
      }
    }
    // 2) known payer → that client's (or its branches') unpaid invoices
    for (const r of open()) {
      const code = payerClient(r.payer, payers, clients);
      if (!code) continue;
      r.clientCode = code;
      const fam = family(code);
      const cands = pool.filter((i) => fam.includes(i.clientCode) && i.date <= r.credit.date);
      const own = cands.filter((i) => i.clientCode === code);
      const single = own.find((i) => Math.abs(i.total - r.credit.amount) <= tol) || cands.find((i) => Math.abs(i.total - r.credit.amount) <= tol);
      if (single) { r.invoices = [single]; take([single]); r.status = 'sure'; r.why = 'Known payer · exact amount'; continue; }
      const combo = findCombo(own, r.credit.amount, tol) || findCombo(cands, r.credit.amount, tol);
      if (combo) { r.invoices = combo.picks; take(combo.picks); r.status = combo.unique ? 'sure' : 'check'; r.why = `Known payer · ${combo.picks.length} invoices paid together${combo.unique ? '' : ' (more than one way to add up — check)'}`; continue; }
      r.why = 'Known payer, but no unpaid invoices add up to this amount';
    }
    // 3) unknown payer: suggest a unique exact-amount invoice, or a unique combination within one client
    for (const r of open()) {
      if (r.why) continue;
      const cands = pool.filter((i) => i.date <= r.credit.date);
      const exact = cands.filter((i) => Math.abs(i.total - r.credit.amount) <= tol);
      if (exact.length === 1) { r.invoices = exact; take(exact); r.status = 'check'; r.why = 'Same amount as this invoice — new payer name'; continue; }
      const byClient = {};
      for (const i of cands) (byClient[i.clientCode] = byClient[i.clientCode] || []).push(i);
      const found = Object.values(byClient).map((list) => findCombo(list, r.credit.amount, tol)).filter(Boolean);
      if (found.length === 1) { r.invoices = found[0].picks; take(found[0].picks); r.status = 'check'; r.why = `${found[0].picks.length} invoices add up to this — new payer name`; }
    }
    return res;
  }

  const api = {
    parseStatement, payerOf, compactCode, payerClient, findCombo, matchPayments,
    norm, tokens, similarity, matchClient, matchProduct, findRate, splitMessages, splitOrders, parseItemLine,
    buildDraft, buildItem, makeItem, readOrders, totals, invoiceNumber, fileName, money, longDate, todayISO, findDate,
    clientTextOf, learnAlias, newId, r2, deliveryFor, deliveryShare,
  };
  if (typeof module !== 'undefined') module.exports = api; else root.MLogic = api;
})(this);
