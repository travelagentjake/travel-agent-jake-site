/* Sales dashboard for /enquiries-admin.html. Talks only to /api/sales-bridge (admin key required). */
(function () {
  'use strict';
  var CSS = [
    '.sd-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin:0 0 14px;font-size:13px;color:#5b6478}',
    '.sd-nav{display:flex;gap:6px;overflow-x:auto;margin:0 0 16px;padding-bottom:4px}',
    '.sd-nav button{flex:0 0 auto;border:2px solid var(--ink);background:#fff;color:var(--ink);border-radius:999px;padding:8px 16px;font:700 14px inherit;font-family:inherit;cursor:pointer}',
    '.sd-nav button[aria-current="true"]{background:var(--ink);color:#fff}',
    '.sd-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px}',
    '.sd-tile{background:#fff;border:2px solid var(--ink);border-radius:14px;padding:12px 14px}',
    '.sd-tile.hi{background:var(--blue);border-color:var(--blue);color:#fff}',
    '.sd-tile.hi small{color:rgba(255,255,255,.85)}',
    '.sd-tile b{display:block;font-family:"Archivo Black",sans-serif;font-size:24px;line-height:1.15;word-break:break-word}',
    '.sd-tile small{display:block;font-size:12px;color:#5b6478;margin-top:2px}',
    '.sd-tile b.pos{color:#118A5B}.sd-tile b.neg{color:#c2412d}',
    '.sd-h{font-family:"Archivo Black",sans-serif;font-size:18px;margin:22px 0 10px}',
    '.sd-card{background:#fff;border:2px solid var(--ink);border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:5px 5px 0 #d5dbea}',
    '.sd-card.cancelled{opacity:.6;box-shadow:none}',
    '.sd-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:flex-start}',
    '.sd-name{font-family:"Archivo Black",sans-serif;font-size:18px;margin:0}',
    '.sd-sub{font-size:13px;color:#5b6478;margin-top:2px}',
    '.sd-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
    '.sd-chip{background:#f2f5fb;border-radius:10px;padding:6px 10px;font-size:13px}.sd-chip b{display:block;font-size:15px}',
    '.sd-pay{display:flex;gap:10px;align-items:center;justify-content:space-between;border-top:1px solid #e6eaf3;margin-top:10px;padding-top:10px;font-size:14px}',
    '.sd-pay label{display:flex;gap:8px;align-items:center;cursor:pointer;font-weight:700}',
    '.sd-pay input[type=checkbox],.sd-line input[type=checkbox]{width:20px;height:20px}',
    '.sd-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}',
    '.sd-detail{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 18px;margin-top:12px;border-top:1px solid #e6eaf3;padding-top:12px;font-size:14px}',
    '.sd-detail small{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7190}',
    '.sd-bar2{height:10px;background:#e6eaf3;border-radius:999px;overflow:hidden;margin-top:8px}.sd-bar2 i{display:block;height:100%;background:var(--blue);border-radius:999px}',
    '.sd-bar2.red i{background:#c2412d}.sd-bar2.orange i{background:#e08a1e}.sd-bar2.green i{background:#118A5B}',
    '.sd-month{background:#fff;border:2px solid var(--ink);border-radius:14px;padding:12px 14px;margin-bottom:10px;cursor:pointer}',
    '.sd-month .sd-row b{font-size:16px}',
    '.sd-line{display:flex;gap:10px;align-items:center;justify-content:space-between;border-top:1px solid #e6eaf3;padding:8px 0;font-size:14px;cursor:default}',
    '.sd-line label{display:flex;gap:10px;align-items:center;cursor:pointer}',
    '.sd-tbl{width:100%;border-collapse:collapse;font-size:13.5px;background:#fff;border:2px solid var(--ink);border-radius:12px;overflow:hidden}',
    '.sd-tbl th,.sd-tbl td{padding:8px 10px;text-align:right;border-bottom:1px solid #e6eaf3;white-space:nowrap}',
    '.sd-tbl th:first-child,.sd-tbl td:first-child{text-align:left}',
    '.sd-tbl th{background:#f2f5fb;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7190}',
    '.sd-tbl tr.tot td{font-weight:700;background:#fff8dd}',
    '.sd-scroll{overflow-x:auto;margin-bottom:12px}',
    '.sd-rank{display:flex;gap:10px;align-items:center;font-size:14px;margin:6px 0}.sd-rank span:first-child{flex:0 0 38%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sd-rank .sd-bar2{flex:1;margin:0}.sd-rank span:last-child{flex:0 0 auto;font-weight:700}',
    '.sd-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}',
    '.sd-code{font-family:ui-monospace,Menlo,monospace;font-size:16px;font-weight:700;letter-spacing:.04em;background:#f2f5fb;border-radius:8px;padding:4px 8px}',
    '.sd-badge{font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;border:2px solid var(--ink);background:#fff}',
    '.sd-badge.ok{background:#e3f4ea;border-color:#118A5B;color:#0a5c3b}.sd-badge.bad{background:#fde7e3;border-color:#c2412d;color:#8f2a1b}.sd-badge.warn{background:#fff3cf;border-color:#e0a800}',
    '.sd-modal{position:fixed;inset:0;background:rgba(16,20,43,.55);z-index:60;overflow:auto;padding:18px 12px}',
    '.sd-modal>div{max-width:720px;margin:0 auto;background:#fff;border:2px solid var(--ink);border-radius:18px;padding:20px}',
    '.sd-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px}',
    '.sd-form label{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7190}',
    '.sd-form input,.sd-form select,.sd-form textarea{width:100%;box-sizing:border-box;margin-top:4px;padding:10px 12px;border:2px solid #d5dbea;border-radius:10px;font:inherit;font-size:16px;background:#fff;text-transform:none;letter-spacing:0;color:var(--ink);font-weight:400}',
    '.sd-form .full{grid-column:1/-1}',
    '.sd-extras{display:flex;gap:6px 16px;flex-wrap:wrap;margin-top:6px}.sd-extras label{display:flex;gap:6px;align-items:center;font-size:14px;text-transform:none;letter-spacing:0;color:var(--ink);font-weight:400}.sd-extras input{width:auto;margin:0}',
    '.sd-note{background:#fff8dd;border:2px solid var(--yellow);border-radius:12px;padding:10px 14px;font-size:14px;margin:12px 0}',
    '.sd-steps{margin:10px 0 0 18px;padding:0;font-size:15px;line-height:1.6}',
    '.sd-loading{text-align:center;padding:50px 10px;color:#5b6478}',
    '.sd-query{white-space:pre-wrap;background:#f2f5fb;border-radius:10px;padding:12px;font-size:14px}',
    '@media (max-width:640px){.sd-detail,.sd-form{grid-template-columns:1fr}.sd-tile b{font-size:21px}}'
  ].join('\n');

  var VIEWS = [['home', 'Home'], ['bookings', 'Bookings'], ['income', 'Income'], ['stats', 'Stats'], ['vouchers', 'Vouchers'], ['recon', 'Recon']];
  var HOLIDAY_TYPES = ['Summer Beach Package', 'Winter Beach Package', 'Ski', 'Ocean Cruise', 'River Cruise', 'Tailor Made', 'Expedition Cruise', 'Touring and Adventure', 'ATOL Packaged', 'Rail Holiday', 'City Break', 'Disney Holiday', 'Theme Park Holiday', 'Special Interest Holiday'];
  var EXTRAS = ['Car Parking', 'Insurance', 'Airport Lounge', 'Security Fast Track', 'Car Hire', 'Attraction Tickets', 'Airport Hotel', 'Excursions'];

  var S = { all: null, view: 'home', loading: false, error: '', setup: false, bq: '', bf: 'active', bs: 'booked', open: {}, inc: {}, year: null, vf: 'avail', form: null, busy: false, at: null };
  var root, getKey, toast;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n, dp) { n = Number(n) || 0; dp = dp == null ? 0 : dp; return (n < 0 ? '-' : '') + '£' + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function pc(n, dp) { return n == null || isNaN(n) ? 'n/a' : (Number(n) * 100).toFixed(dp == null ? 1 : dp) + '%'; }
  function chg(n) { return n == null || isNaN(n) ? 'n/a' : (n >= 0 ? '+' : '') + (n * 100).toFixed(0) + '%'; }
  function cls(n) { return n == null ? '' : n >= 0 ? 'pos' : 'neg'; }
  function dashFree(s) { return String(s || '').replace(/\u2013|\u2014/g, ' to '); }
  function tel(p) { return String(p || '').replace(/[^\d+]/g, ''); }
  function tile(v, l, extra) { return '<div class="sd-tile' + (extra && extra.hi ? ' hi' : '') + '"><b class="' + (extra && extra.c || '') + '">' + v + '</b><small>' + esc(l) + '</small></div>'; }

  /* ---------- bridge ---------- */
  function call(fn, args) {
    return fetch('/api/sales-bridge', { method: 'POST', headers: { 'x-admin-key': getKey(), 'content-type': 'application/json' }, body: JSON.stringify({ fn: fn, args: args || [] }) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401) throw new Error('Admin key not recognised. Lock and unlock again.');
          if (j.error === 'not_configured') { var e = new Error('setup'); e.setup = true; throw e; }
          if (!j.ok) throw new Error(j.error === 'timeout' ? 'Google took too long. Tap Refresh to see if it went through.' : j.error === 'bridge_unreachable' ? (j.detail || 'Could not reach your sales app.') : (j.error || 'Something went wrong'));
          return j.data;
        });
      });
  }
  function adopt(d) { if (d && d.dashboard) { S.all = d; S.at = new Date(); } return d; }
  function load(quiet) {
    if (S.loading) return Promise.resolve();
    S.loading = true; S.error = ''; if (!quiet && !S.all) render();
    return call('webapp_getAll').then(function (d) { adopt(d); S.setup = false; }).catch(function (e) { if (e.setup) S.setup = true; else S.error = e.message; })
      .then(function () { S.loading = false; render(); });
  }
  function act(fn, args, msg) {
    if (S.busy) return Promise.resolve();
    S.busy = true;
    return call(fn, args).then(function (d) { adopt(d); if (d && d.bookingWarning) toast(d.bookingWarning); else if (msg) toast(msg); return d; })
      .catch(function (e) { toast(e.message || 'Could not save'); throw e; })
      .then(function (d) { S.busy = false; render(); return d; }, function (e) { S.busy = false; render(); throw e; });
  }

  /* ---------- views ---------- */
  function vSetup() {
    return '<div class="sd-card"><h3 class="sd-name">One-time setup needed</h3><p class="sd-sub" style="font-size:15px">The website cannot see your sales sheet yet. It takes about five minutes, once:</p>'
      + '<ol class="sd-steps"><li>Open your Apps Script project and add the bridge code Jake was sent (a new file called Bridge).</li><li>Add the one line to the top of <code>doGet</code>, then set a <code>BRIDGE_SECRET</code> script property.</li><li>Deploy it as a new web app that anyone can open (run as you).</li><li>Add <code>SALES_BRIDGE_URL</code> and <code>SALES_BRIDGE_SECRET</code> in Netlify and redeploy.</li></ol>'
      + '<div class="sd-actions"><button class="ea-btn" data-a="refresh" type="button">Check again</button></div></div>';
  }
  function vHome() {
    var a = S.all, d = a.dashboard, inc = a.income, soon = a.travellingSoon || [];
    var t = '<div class="sd-tiles">' + tile(money(inc.thisMonth), 'Commission due this month', { hi: 1 }) + tile(money(inc.nextMonth), 'Commission due next month') + tile(money(d.mtdSales), 'Sales this month') + tile(money(d.mtdCommission), 'Commission this month') + tile(money(d.ytdSales), 'Sales this year') + tile(money(d.ytdCommission), 'Commission this year') + tile(d.ytdPassengers, 'Passengers booked this year') + tile(d.totalBookings, 'Total bookings') + '</div>';
    var band = inc.months && inc.months[0] ? inc.months[0].band : 'green';
    var pctT = Math.min(100, Math.round(inc.thisMonth / (inc.target || 1) * 100));
    t += '<div class="sd-card"><div class="sd-row"><b>This month against your ' + money(inc.target) + ' target</b><span>' + money(inc.thisMonth) + ' (' + pctT + '%)</span></div><div class="sd-bar2 ' + band + '"><i style="width:' + pctT + '%"></i></div><p class="sd-sub">Below ' + money(inc.chargeThreshold) + ' a month the host agency charges a fee.</p></div>';
    t += '<div class="sd-tiles">' + tile(esc(d.topSupplier || 'n/a'), 'Top supplier') + tile(esc(d.topDestination || 'n/a'), 'Top destination') + tile(pc(d.avgMarginPct), 'Average margin') + '</div>';
    t += '<h3 class="sd-h">Travelling in the next 14 days</h3>';
    if (!soon.length) t += '<p class="sd-sub">Nobody flying in the next two weeks.</p>';
    soon.forEach(function (s) {
      t += '<div class="sd-card"><div class="sd-row"><div><h4 class="sd-name">' + esc(s.customerName) + '</h4><div class="sd-sub">' + esc(s.destination) + ' &middot; departs ' + esc(s.departureLabel) + ' &middot; ' + esc(s.bookingRef) + '</div></div>'
        + '<label style="display:flex;gap:8px;align-items:center;font-weight:700;cursor:pointer"><input type="checkbox" data-a="pretravel" data-ref="' + esc(s.bookingRef) + '"' + (s.done ? ' checked' : '') + ' style="width:20px;height:20px"> Checked in</label></div>'
        + '<div class="sd-actions">' + (s.whatsappUrl ? '<a class="ea-btn wa" target="_blank" rel="noopener" href="' + esc(s.whatsappUrl) + '">WhatsApp</a>' : '') + (s.customerPhone ? '<a class="ea-btn" href="tel:' + esc(tel(s.customerPhone)) + '">Call</a>' : '') + '</div></div>';
    });
    return t;
  }

  function bookingMatches(b) {
    if (S.bf === 'active' && b.cancelled) return false;
    if (S.bf === 'cancelled' && !b.cancelled) return false;
    var q = S.bq.trim().toLowerCase();
    if (!q) return true;
    return [b.customerName, b.bookingRef, b.destination, b.supplier, b.customerEmail, b.customerPhone, b.accommodation].join(' ').toLowerCase().indexOf(q) >= 0;
  }
  function payRow(b, p) {
    if (!p) return '';
    return '<div class="sd-pay"><label><input type="checkbox" data-a="paid" data-key="' + esc(p.key) + '"' + (p.paid ? ' checked' : '') + '> ' + esc(p.label) + ' received</label><span>' + money(p.amount, 2) + ' &middot; due ' + esc(p.dueDateLabel) + '</span></div>';
  }
  function bookingCard(b) {
    var id = String(b.row), o = S.open[id];
    var d = [['Email', b.customerEmail], ['Mobile', b.customerPhone], ['Date of birth', b.customerDob], ['Holiday type', b.holidayType], ['Flying from', b.flyingFrom], ['Sailing from', b.sailingFrom], ['Rail from', b.railFrom], ['Accommodation', b.accommodation], ['Board basis', b.boardBasis], ['Extras', b.extras], ['Discount', b.discount ? money(b.discount, 2) : ''], ['Gross commission', b.grossCommission ? money(b.grossCommission, 2) : ''], ['Net commission', money(b.netCommission, 2)], ['Margin', pc(b.marginPct)]].filter(function (r) { return r[1]; });
    return '<article class="sd-card' + (b.cancelled ? ' cancelled' : '') + '"><div class="sd-row"><div><h4 class="sd-name">' + esc(b.customerName) + '</h4><div class="sd-sub">' + esc(b.bookingRef) + ' &middot; ' + esc([b.destination, b.supplier].filter(Boolean).join(' &middot; ').replace(/&middot;/g, '|')).replace(/\|/g, '&middot;') + '</div></div>' + (b.cancelled ? '<span class="sd-badge bad">Cancelled</span>' : '') + '</div>'
      + '<div class="sd-chips"><div class="sd-chip">Departs<b>' + esc(b.departureLabel || 'TBC') + '</b></div><div class="sd-chip">Returns<b>' + esc(b.returnLabel || 'TBC') + '</b></div><div class="sd-chip">Party<b>' + (b.adults || 0) + 'A' + (b.children ? ' ' + b.children + 'C' : '') + '</b></div><div class="sd-chip">Holiday cost<b>' + money(b.grossHolidayCost) + '</b></div><div class="sd-chip">My commission<b>' + money(b.myTotalCommission, 2) + '</b></div>' + (b.balanceDueDate ? '<div class="sd-chip">Balance ' + esc(b.balanceDueLabel) + '<b>' + (b.balanceDueAmount !== '' ? money(b.balanceDueAmount, 2) : 'TBC') + '</b></div>' : '') + '</div>'
      + payRow(b, b.payment1) + payRow(b, b.payment2)
      + '<div class="sd-actions">' + (b.whatsappUrl ? '<a class="ea-btn wa" target="_blank" rel="noopener" href="' + esc(b.whatsappUrl) + '">WhatsApp</a>' : '') + (b.customerEmail ? '<a class="ea-btn" href="mailto:' + esc(b.customerEmail) + '">Email</a>' : '') + (b.customerPhone ? '<a class="ea-btn" href="tel:' + esc(tel(b.customerPhone)) + '">Call</a>' : '')
      + '<button class="ea-btn" type="button" data-a="bk-toggle" data-row="' + id + '">' + (o ? 'Hide details' : 'Show details') + '</button><button class="ea-btn" type="button" data-a="bk-edit" data-row="' + id + '">Edit</button><button class="ea-btn danger" type="button" data-a="bk-cancel" data-row="' + id + '">' + (b.cancelled ? 'Restore' : 'Cancel booking') + '</button></div>'
      + (o ? '<div class="sd-detail">' + d.map(function (r) { return '<div><small>' + esc(r[0]) + '</small>' + esc(r[1]) + '</div>'; }).join('') + '</div>' : '') + '</article>';
  }
  function vBookings() {
    var list = S.all.bookings.filter(bookingMatches);
    if (S.bs === 'depart') list = list.slice().sort(function (a, b) { return (a.departureDate || '9999').localeCompare(b.departureDate || '9999'); });
    var t = '<div class="ea-tools"><input id="sdBq" type="search" placeholder="Search name, ref, destination, supplier" value="' + esc(S.bq) + '"><select id="sdBf"><option value="active"' + (S.bf === 'active' ? ' selected' : '') + '>Active</option><option value="cancelled"' + (S.bf === 'cancelled' ? ' selected' : '') + '>Cancelled</option><option value="all"' + (S.bf === 'all' ? ' selected' : '') + '>All</option></select><select id="sdBs"><option value="booked"' + (S.bs === 'booked' ? ' selected' : '') + '>Newest booked</option><option value="depart"' + (S.bs === 'depart' ? ' selected' : '') + '>Departing soonest</option></select><button class="ea-btn wa" type="button" data-a="bk-add">+ Add booking</button></div>';
    t += '<p class="sd-sub" style="margin:-6px 0 12px">' + list.length + ' booking' + (list.length === 1 ? '' : 's') + '. Trips that have already finished are hidden.</p>';
    return t + (list.length ? list.map(bookingCard).join('') : '<div class="ea-empty">No bookings match.</div>');
  }

  function vIncome() {
    var inc = S.all.income, mx = Math.max(inc.target || 1, 1);
    var t = '<div class="sd-tiles">' + tile(money(inc.thisMonth), 'This month', { hi: 1 }) + tile(money(inc.nextMonth), 'Next month') + tile(money(inc.next12), 'Next 12 months') + tile(money(inc.total36), 'Next 36 months') + '</div>';
    t += '<p class="sd-sub">Green is ' + money(inc.target) + ' or more, amber is between ' + money(inc.chargeThreshold) + ' and ' + money(inc.target) + ', red is under ' + money(inc.chargeThreshold) + '. Tap a month to see which bookings it is made of and tick off what has arrived.</p>';
    inc.months.forEach(function (m, i) {
      if (!m.amount && !m.bookingsCount && i > 24) return;
      var o = S.inc[i], w = Math.min(100, Math.round(m.amount / mx * 100));
      t += '<div class="sd-month" data-a="inc-toggle" data-i="' + i + '"><div class="sd-row"><b>' + esc(m.label) + '</b><span><b>' + money(m.amount, 2) + '</b> &middot; ' + m.bookingsCount + ' payment' + (m.bookingsCount === 1 ? '' : 's') + '</span></div><div class="sd-bar2 ' + esc(m.band) + '"><i style="width:' + w + '%"></i></div>';
      if (o) t += '<div style="margin-top:10px">' + (m.bookings.length ? m.bookings.map(function (l) { return '<div class="sd-line"><label><input type="checkbox" data-a="paid" data-key="' + esc(l.key) + '"' + (l.paid ? ' checked' : '') + '><span>' + esc(l.customer) + ' <small style="color:#6b7190">' + esc(l.ref) + ' &middot; ' + esc(l.paymentLabel) + ' &middot; flies ' + esc(l.departureLabel) + '</small></span></label><b>' + money(l.amount, 2) + '</b></div>'; }).join('') : '<p class="sd-sub">Nothing due.</p>') + '</div>';
      t += '</div>';
    });
    if (inc.outsideWindow) t += '<p class="sd-sub">Plus ' + money(inc.outsideWindow) + ' falling outside the 36 month window.</p>';
    return t;
  }

  function rankBlock(title, arr) {
    var mx = Math.max.apply(null, (arr || []).map(function (r) { return r.value; }).concat([1]));
    return '<div class="sd-card"><b>' + esc(title) + '</b>' + ((arr || []).length ? arr.map(function (r) { return '<div class="sd-rank"><span title="' + esc(r.name) + '">' + esc(r.name) + '</span><div class="sd-bar2"><i style="width:' + Math.round(r.value / mx * 100) + '%"></i></div><span>' + money(r.value) + ' (' + r.count + ')</span></div>'; }).join('') : '<p class="sd-sub">No data yet.</p>') + '</div>';
  }
  function vStats() {
    var an = S.all.analytics, y = S.all.yearly, g = y.growth || {};
    var t = '<div class="sd-tiles">' + tile(chg(g.wow), 'Commission vs last week', { c: cls(g.wow) }) + tile(chg(g.mom), 'vs last month', { c: cls(g.mom) }) + tile(chg(g.yoy), 'vs same point last year', { c: cls(g.yoy) }) + tile(money(an.averages.avgBookingValue), 'Average booking') + tile(pc(an.averages.avgMarginPct), 'Average margin') + tile(an.averages.avgLeadTimeDays + ' days', 'Average lead time') + tile(pc(an.averages.loyalRatePct, 0), 'Repeat customers') + '</div>';
    var P = [['today', 'Today'], ['yesterday', 'Yesterday'], ['wtd', 'This week'], ['mtd', 'This month'], ['ytd', 'This year']];
    t += '<h3 class="sd-h">Sales and commission</h3><div class="sd-scroll"><table class="sd-tbl"><tr><th>Period</th><th>Sales</th><th>Passengers</th><th>Commission</th></tr>' + P.map(function (p) { var r = an.totals[p[0]] || {}; return '<tr><td>' + p[1] + '</td><td>' + money(r.sales) + '</td><td>' + (r.passengers || 0) + '</td><td>' + money(r.commission, 2) + '</td></tr>'; }).join('') + '</table></div>';
    var cm = y.currentMonth;
    if (cm) {
      t += '<h3 class="sd-h">' + esc(cm.monthLabel) + ' week by week</h3><div class="sd-scroll"><table class="sd-tbl"><tr><th>Week</th><th>Bookings</th><th>Sales</th><th>Net commission</th><th>My commission</th><th>Margin</th><th>vs last wk</th></tr>' + cm.weeks.map(function (w) { return '<tr><td>' + esc(dashFree(w.label)) + (w.isCurrentWeek ? ' (now)' : '') + '</td><td>' + w.bookings + '</td><td>' + money(w.sales) + '</td><td>' + money(w.netCommission, 2) + '</td><td>' + money(w.myCommission, 2) + '</td><td>' + pc(w.marginPct) + '</td><td>' + chg(w.wowPct) + '</td></tr>'; }).join('') + '<tr class="tot"><td>Month</td><td>' + cm.totals.bookings + '</td><td>' + money(cm.totals.sales) + '</td><td>' + money(cm.totals.netCommission, 2) + '</td><td>' + money(cm.totals.myCommission, 2) + '</td><td>' + pc(cm.totals.marginPct) + '</td><td></td></tr></table></div>';
    }
    var yrs = y.years || []; if (!S.year || yrs.indexOf(S.year) < 0) S.year = yrs[yrs.length - 1];
    t += '<h3 class="sd-h">Year by year</h3><div class="sd-scroll"><table class="sd-tbl"><tr><th>Year</th><th>Bookings</th><th>Sales</th><th>Net commission</th><th>My commission</th><th>Margin</th><th>vs prior year</th></tr>' + (y.yearTotals || []).map(function (r) { return '<tr><td>' + r.year + '</td><td>' + r.bookings + '</td><td>' + money(r.sales) + '</td><td>' + money(r.netCommission, 2) + '</td><td>' + money(r.myCommission, 2) + '</td><td>' + pc(r.marginPct) + '</td><td>' + chg(r.yoyPct) + '</td></tr>'; }).join('') + '</table></div>';
    var rows = (y.monthlyByYear || {})[S.year] || [], mxc = Math.max.apply(null, rows.map(function (r) { return r.myCommission; }).concat([1]));
    t += '<div class="sd-row" style="margin-top:14px"><h3 class="sd-h" style="margin:0">Month by month</h3><select id="sdYear" class="ea-btn">' + yrs.map(function (v) { return '<option' + (v === S.year ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>';
    t += '<div class="sd-scroll" style="margin-top:10px"><table class="sd-tbl"><tr><th>Month</th><th>Bookings</th><th>Sales</th><th>My commission</th><th></th><th>Margin</th><th>vs prior month</th><th>vs last year</th></tr>' + rows.map(function (r) { return '<tr><td>' + esc(r.name) + '</td><td>' + r.bookings + '</td><td>' + money(r.sales) + '</td><td>' + money(r.myCommission, 2) + '</td><td style="width:120px"><div class="sd-bar2" style="margin:0"><i style="width:' + Math.round(r.myCommission / mxc * 100) + '%"></i></div></td><td>' + pc(r.marginPct) + '</td><td>' + chg(r.momPct) + '</td><td>' + chg(r.yoyPct) + '</td></tr>'; }).join('') + '</table></div>';
    t += '<h3 class="sd-h">Top performers</h3><div class="sd-cols">' + rankBlock('Suppliers', an.rankings.suppliers) + rankBlock('Destinations', an.rankings.destinations) + rankBlock('Airports', an.rankings.airports) + rankBlock('Holiday types', an.rankings.holidayTypes) + '</div>';
    var lc = an.loyalCustomers || [];
    t += '<h3 class="sd-h">Repeat customers (' + lc.length + ')</h3>' + (lc.length ? '<div class="sd-card">' + lc.map(function (c) { return '<div class="sd-line"><span>' + esc(c.name) + ' <small style="color:#6b7190">' + c.count + ' bookings</small></span><b>' + money(c.value) + '</b></div>'; }).join('') + '</div>' : '<p class="sd-sub">No repeat customers yet.</p>');
    return t;
  }

  function vVouchers() {
    var codes = (S.all.jet2Codes && S.all.jet2Codes.codes) || [];
    var f = S.vf, list = codes.filter(function (c) { return f === 'all' ? true : f === 'used' ? c.used : f === 'expired' ? (c.expired && !c.used) : (!c.used && !c.expired); });
    var cnt = { avail: 0, used: 0, expired: 0 }; codes.forEach(function (c) { if (c.used) cnt.used++; else if (c.expired) cnt.expired++; else cnt.avail++; });
    var t = '<div class="sd-bar"><div class="ea-tools" style="margin:0"><select id="sdVf"><option value="avail"' + (f === 'avail' ? ' selected' : '') + '>Available (' + cnt.avail + ')</option><option value="used"' + (f === 'used' ? ' selected' : '') + '>Used (' + cnt.used + ')</option><option value="expired"' + (f === 'expired' ? ' selected' : '') + '>Expired (' + cnt.expired + ')</option><option value="all"' + (f === 'all' ? ' selected' : '') + '>All</option></select></div><label class="ea-btn wa" style="cursor:pointer">+ Add from photo<input id="sdPhoto" type="file" accept="image/*" hidden></label></div>';
    var by = {}; list.forEach(function (c) { (by[c.brand || 'Other'] = by[c.brand || 'Other'] || []).push(c); });
    Object.keys(by).sort().forEach(function (br) {
      t += '<h3 class="sd-h">' + esc(br) + '</h3>';
      by[br].forEach(function (c) {
        var st = c.used ? '<span class="sd-badge ' + (c.reason && /work/i.test(c.reason) ? 'bad' : 'ok') + '">' + esc(c.reason || 'Used') + (c.dateUsedLabel ? ' ' + esc(c.dateUsedLabel) : '') + '</span>' : c.expired ? '<span class="sd-badge bad">Expired</span>' : '<span class="sd-badge ' + (c.daysLeft != null && c.daysLeft <= 14 ? 'warn' : 'ok') + '">' + (c.daysLeft != null ? c.daysLeft + ' days left' : 'Available') + '</span>';
        t += '<div class="sd-card"><div class="sd-row"><div><span class="sd-code">' + esc(c.code) + '</span><div class="sd-sub" style="margin-top:6px">' + esc([c.type, c.validity, c.expiryLabel && 'expires ' + c.expiryLabel].filter(Boolean).join(' | ')).replace(/ \| /g, ' &middot; ') + '</div></div>' + st + '</div><div class="sd-actions"><button class="ea-btn" type="button" data-a="copy" data-code="' + esc(c.code) + '">Copy code</button>'
          + (c.used ? '<button class="ea-btn" type="button" data-a="vch" data-row="' + c.row + '" data-o="unused">Put back</button>' : '<button class="ea-btn" type="button" data-a="vch" data-row="' + c.row + '" data-o="used">Mark used</button><button class="ea-btn danger" type="button" data-a="vch" data-row="' + c.row + '" data-o="error">Did not work</button>') + '</div></div>';
      });
    });
    return t + (list.length ? '' : '<div class="ea-empty">Nothing here.</div>');
  }

  function vRecon() {
    var r = S.all.reconciliation;
    var t = '<div class="sd-card"><b>Commission statement check</b><p class="sd-sub" style="font-size:14px">Upload the Club Voyages statement CSV. Payments that match your tracker are ticked off as received, and anything odd is listed as a query.</p><div class="sd-actions"><label class="ea-btn wa" style="cursor:pointer">Upload statement CSV<input id="sdRecon" type="file" accept=".csv,text/csv,text/plain" hidden></label>' + (r ? '<button class="ea-btn" type="button" data-a="recon-again">Re-check against my tracker</button>' : '') + '</div></div>';
    if (!r) return t + '<div class="ea-empty">No statement checked yet.</div>';
    var x = r.totals || {};
    t += '<h3 class="sd-h">' + esc(r.statementLabel) + '</h3><div class="sd-tiles">' + tile(x.bookingsOnStatement, 'Bookings on statement') + tile(money(x.totalAgentCommission, 2), 'Agent commission') + tile(money(x.totalPayableNow, 2), 'Payable now') + tile(x.matched, 'Matched and ticked') + tile(x.amountMismatch, 'Amount differs') + tile(x.notFound, 'Not on my tracker') + tile(x.cancelledButCharged, 'Cancelled but charged') + tile(x.overdueMissing, 'Due but missing') + '</div>';
    var tone = { matched: 'ok', amount_mismatch: 'warn', not_found: 'bad', cancelled_but_charged: 'bad', unclear: 'warn' };
    t += '<div class="sd-scroll"><table class="sd-tbl"><tr><th>Ref</th><th>Client</th><th>Departs</th><th>Commission</th><th>Result</th></tr>' + (r.rows || []).map(function (w) { return '<tr><td>' + esc(w.ref) + '</td><td>' + esc(w.client) + '</td><td>' + esc(w.departure) + '</td><td>' + money(w.agentCommission, 2) + '</td><td style="text-align:left;white-space:normal"><span class="sd-badge ' + (tone[w.status] || '') + '">' + esc(String(w.status).replace(/_/g, ' ')) + '</span> ' + esc(w.detail) + '</td></tr>'; }).join('') + '</table></div>';
    if (r.queryText) t += '<h3 class="sd-h">Message to send to Club Voyages</h3><div class="sd-query">' + esc(r.queryText) + '</div><div class="sd-actions"><button class="ea-btn" type="button" data-a="copy" data-code="' + esc(r.queryText) + '">Copy message</button></div>';
    return t;
  }

  /* ---------- forms ---------- */
  function fv(o, k) { return o && o[k] != null ? o[k] : ''; }
  function dl(id, arr) { return '<datalist id="' + id + '">' + (arr || []).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>'; }
  function inp(label, name, v, type, extra) { return '<div' + (extra && extra.full ? ' class="full"' : '') + '><label>' + esc(label) + '<input name="' + name + '" type="' + (type || 'text') + '" value="' + esc(v) + '"' + (extra && extra.list ? ' list="' + extra.list + '" autocomplete="off"' : '') + (extra && extra.step ? ' step="' + extra.step + '"' : '') + '></label></div>'; }
  function bookingForm() {
    var f = S.form, b = f.b || {}, a = S.all, ex = String(b.extras || '').split(',').map(function (s) { return s.trim(); });
    return '<div class="sd-modal"><div><h3 class="sd-name" style="font-size:22px">' + (f.row ? 'Edit booking' : 'Add booking') + '</h3>'
      + (f.row ? '' : '<div class="sd-note">Saving a new booking writes it to your sheet and, if there is an email and a departure date, sends the customer their booking confirmation email, just like your current app.</div>')
      + '<form id="sdForm" class="sd-form">' + inp('Booking reference', 'bookingRef', fv(b, 'bookingRef')) + inp('Customer name', 'customerName', fv(b, 'customerName')) + inp('Email', 'customerEmail', fv(b, 'customerEmail'), 'email') + inp('Mobile', 'customerPhone', fv(b, 'customerPhone'), 'tel') + inp('Date of birth', 'customerDob', fv(b, 'customerDob'), 'date')
      + inp('Departure date', 'departureDate', fv(b, 'departureDate'), 'date') + inp('Return date', 'returnDate', fv(b, 'returnDate'), 'date') + inp('Balance due date', 'balanceDueDate', fv(b, 'balanceDueDate'), 'date') + inp('Balance due amount', 'balanceDueAmount', fv(b, 'balanceDueAmount'), 'number', { step: '0.01' })
      + inp('Adults', 'adults', fv(b, 'adults'), 'number') + inp('Children', 'children', fv(b, 'children'), 'number')
      + inp('Supplier', 'supplier', fv(b, 'supplier'), 'text', { list: 'dlSup' })
      + '<div><label>Holiday type<select name="holidayType"><option value="">Choose</option>' + HOLIDAY_TYPES.concat(b.holidayType && HOLIDAY_TYPES.indexOf(b.holidayType) < 0 ? [b.holidayType] : []).map(function (h) { return '<option' + (h === b.holidayType ? ' selected' : '') + '>' + esc(h) + '</option>'; }).join('') + '</select></label></div>'
      + inp('Flying from', 'flyingFrom', fv(b, 'flyingFrom'), 'text', { list: 'dlFly' }) + inp('Sailing from', 'sailingFrom', fv(b, 'sailingFrom'), 'text', { list: 'dlSail' }) + inp('Rail from', 'railFrom', fv(b, 'railFrom'), 'text', { list: 'dlRail' })
      + inp('Destination', 'destination', fv(b, 'destination'), 'text', { list: 'dlDest' }) + inp('Accommodation', 'accommodation', fv(b, 'accommodation')) + inp('Board basis', 'boardBasis', fv(b, 'boardBasis'), 'text', { list: 'dlBoard' })
      + '<div class="full"><label>Extras booked</label><div class="sd-extras">' + EXTRAS.map(function (e) { return '<label><input type="checkbox" name="extra" value="' + esc(e) + '"' + (ex.indexOf(e) >= 0 ? ' checked' : '') + '> ' + esc(e) + '</label>'; }).join('') + '</div></div>'
      + inp('Gross holiday cost', 'grossHolidayCost', fv(b, 'grossHolidayCost'), 'number', { step: '0.01' }) + inp('Gross commission', 'grossCommission', fv(b, 'grossCommission'), 'number', { step: '0.01' }) + inp('Discount given', 'discount', fv(b, 'discount'), 'number', { step: '0.01' })
      + '<div class="full sd-actions"><button class="ea-btn wa" type="submit">' + (f.row ? 'Save changes' : 'Save booking') + '</button><button class="ea-btn" type="button" data-a="form-close">Cancel</button></div></form>'
      + dl('dlSup', a.supplierList) + dl('dlFly', a.flyingFromList) + dl('dlSail', a.sailingFromList) + dl('dlRail', a.railFromList) + dl('dlDest', a.destinationList) + dl('dlBoard', a.boardBasisList) + '</div></div>';
  }
  /* ---------- render ---------- */
  function render() {
    if (!root) return;
    var keepFocus = document.activeElement && document.activeElement.id;
    var h = '';
    if (S.setup) { root.innerHTML = vSetup(); return; }
    h += '<div class="sd-bar"><span>' + (S.at ? 'Updated ' + S.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '') + (S.loading ? ' &middot; refreshing...' : '') + '</span><button class="ea-btn" type="button" data-a="refresh">Refresh</button></div>';
    h += '<div class="sd-nav" role="tablist">' + VIEWS.map(function (v) { return '<button type="button" data-a="view" data-v="' + v[0] + '" aria-current="' + (S.view === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div>';
    if (!S.all) h += S.error ? '<div class="sd-note" style="background:#fde7e3;border-color:#c2412d">' + esc(S.error) + '</div>' : '<div class="sd-loading">Loading your sales numbers. The first load can take a few seconds.</div>';
    else {
      if (S.error) h += '<div class="sd-note" style="background:#fde7e3;border-color:#c2412d">' + esc(S.error) + '</div>';
      var fn = { home: vHome, bookings: vBookings, income: vIncome, stats: vStats, vouchers: vVouchers, recon: vRecon }[S.view];
      try { h += fn(); } catch (e) { h += '<div class="sd-note">Could not draw this screen: ' + esc(e.message) + '</div>'; }
      if (S.form) h += bookingForm();
    }
    var sy = window.pageYOffset;
    root.innerHTML = h;
    window.scrollTo(0, sy);
    if (keepFocus) { var el = document.getElementById(keepFocus); if (el && el.focus) { el.focus(); try { var l = el.value.length; el.setSelectionRange(l, l); } catch (e) { } } }
  }

  function findBy(list, k, v) { for (var i = 0; i < (list || []).length; i++) if (String(list[i][k]) === String(v)) return list[i]; return null; }
  function formObj(form) {
    var o = {}, fd = new FormData(form); fd.forEach(function (v, k) { if (k !== 'extra') o[k] = v; });
    o.extras = fd.getAll('extra'); return o;
  }
  function setPaidLocal(key, v) { var a = S.all; (a.bookings || []).forEach(function (b) { [b.payment1, b.payment2].forEach(function (p) { if (p && p.key === key) p.paid = v; }); }); (a.income.months || []).forEach(function (m) { m.bookings.forEach(function (l) { if (l.key === key) l.paid = v; }); }); }
  function resize(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () { var s = Math.min(1, 1500 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.85).split(',')[1]); };
      img.onerror = function () { rej(new Error('Could not read that photo')); }; img.src = url;
    });
  }

  function onClick(e) {
    var el = e.target.closest('[data-a]'); if (!el || el.tagName === 'INPUT' && el.type !== 'checkbox' || el.tagName === 'SELECT') return;
    var a = el.dataset.a;
    if (a === 'paid' || a === 'pretravel') return; // handled on change
    if (a === 'view') { S.view = el.dataset.v; render(); }
    else if (a === 'refresh') { load(false).then(function () { toast('Refreshed'); }); }
    else if (a === 'bk-toggle') { S.open[el.dataset.row] = !S.open[el.dataset.row]; render(); }
    else if (a === 'bk-add') { S.form = { row: 0, b: {} }; render(); }
    else if (a === 'bk-edit') { S.form = { row: Number(el.dataset.row), b: findBy(S.all.bookings, 'row', el.dataset.row) || {} }; render(); }
    else if (a === 'form-close') { S.form = null; render(); }
    else if (a === 'bk-cancel') {
      var b = findBy(S.all.bookings, 'row', el.dataset.row); if (!b) return;
      if (!b.cancelled && el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = 'Tap again to cancel'; el.classList.add('armed'); setTimeout(function () { if (el.isConnected) { el.dataset.armed = ''; el.textContent = 'Cancel booking'; el.classList.remove('armed'); } }, 3500); return; }
      act('webapp_setBookingCancelled', [b.row, !b.cancelled], b.cancelled ? 'Booking restored' : 'Booking cancelled').catch(function () { });
    }
    else if (a === 'inc-toggle') { if (e.target.closest('.sd-line')) return; S.inc[el.dataset.i] = !S.inc[el.dataset.i]; render(); }
    else if (a === 'copy') { var txt = el.dataset.code; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('Copied'); }, function () { toast('Could not copy'); }); }
    else if (a === 'vch') { act('webapp_setJet2CodeOutcome', [Number(el.dataset.row), el.dataset.o], el.dataset.o === 'unused' ? 'Put back in the pool' : el.dataset.o === 'error' ? 'Marked as not working' : 'Marked used').catch(function () { }); }
    else if (a === 'recon-again') { toast('Re-checking...'); act('webapp_rerunReconciliation', [], 'Re-checked').catch(function () { }); }
  }
  function onChange(e) {
    var t = e.target, a = t.dataset && t.dataset.a;
    if (a === 'paid') { var v = t.checked; setPaidLocal(t.dataset.key, v); act('webapp_setCommissionPaid', [t.dataset.key, v], v ? 'Marked as received' : 'Marked as not received').catch(function () { setPaidLocal(t.dataset.key, !v); render(); }); return; }
    if (a === 'pretravel') { var d = t.checked; (S.all.travellingSoon || []).forEach(function (s) { if (s.bookingRef === t.dataset.ref) s.done = d; }); act('webapp_setPreTravelCheckDone', [t.dataset.ref, d], d ? 'Checked in' : 'Unticked').catch(function () { }); return; }
    if (t.id === 'sdBf') { S.bf = t.value; render(); } else if (t.id === 'sdBs') { S.bs = t.value; render(); } else if (t.id === 'sdVf') { S.vf = t.value; render(); } else if (t.id === 'sdYear') { S.year = Number(t.value); render(); }
    else if (t.id === 'sdPhoto' && t.files[0]) { toast('Reading the voucher photo...'); resize(t.files[0]).then(function (b64) { return act('webapp_addJet2CodeFromPhoto', [b64, 'image/jpeg'], 'Voucher added'); }).catch(function (er) { toast(er.message); }); }
    else if (t.id === 'sdRecon' && t.files[0]) { var f = t.files[0]; toast('Checking the statement...'); f.text().then(function (txt) { return act('webapp_processReconciliationCsv', [txt], 'Statement checked'); }).catch(function () { }); }
  }
  function onInput(e) { var id = e.target.id; if (id === 'sdBq') { S.bq = e.target.value; render(); } }
  function onSubmit(e) {
    e.preventDefault();
    if (e.target.id === 'sdForm') {
      var o = formObj(e.target), row = S.form.row;
      if (!o.bookingRef.trim() && !o.customerName.trim()) { toast('Add a booking reference or a customer name first.'); return; }
      act(row ? 'webapp_updateBooking' : 'webapp_addBooking', row ? [row, o] : [o], row ? 'Booking updated' : 'Booking added').then(function () { S.form = null; render(); }).catch(function () { });
    }
  }

  window.TAJSales = {
    mount: function (el, keyFn, toastFn) {
      if (!document.getElementById('sdCss')) { var st = document.createElement('style'); st.id = 'sdCss'; st.textContent = CSS; document.head.appendChild(st); }
      root = el; getKey = keyFn; toast = toastFn;
      if (!root.dataset.bound) { root.dataset.bound = '1'; root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('input', onInput); root.addEventListener('submit', onSubmit); }
      render(); load(false);
    },
    refresh: function () { return load(true); },
    reset: function () { S.all = null; S.form = null; S.setup = false; S.error = ''; if (root) root.innerHTML = ''; }
  };
})();
