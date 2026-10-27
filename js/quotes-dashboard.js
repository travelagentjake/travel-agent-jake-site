/* Quotes tab for the Travel Agent Jake business dashboard (enquiries-admin.html).
   Adds: an Enquiries / Quotes switch, a "Generate quote" form (saves a quote request with links, notes,
   WhatsApp notes and files, and creates the customer profile if they are new), the list of quote links
   with view tracking, and a quotes block inside each customer card.
   Data: /quotes/quotes.json (published quote pages), /api/quote-admin (views + requests), /api/enquiry-admin (customers). */
(function () {
  var KEY_NAME = 'taj-enq-admin-key';
  var QUOTE_HOST = 'https://quotes.travelagentjake.co.uk/';
  var S = { quotes: [], views: {}, requests: [], enquiries: [], statuses: {}, sync: null, bookings: [], showDone: false, tab: 'enq', openHist: {}, openBk: {} };
  var RSTAT = [['requested', 'Requested'], ['building', 'Being built'], ['sent', 'Sent'], ['booked', 'Booked'], ['closed', 'Closed']];
  function $(i) { return document.getElementById(i); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function key() { try { return localStorage.getItem(KEY_NAME) || ''; } catch (e) { return ''; } }
  function toast(m) { var t = $('eaToast'); if (!t) return; t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600); }
  function api(path, method, body) {
    return fetch(path, { method: method, headers: { 'x-admin-key': key(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; }); });
  }
  function ago(iso) { var m = Math.floor((Date.now() - Date.parse(iso)) / 60000); if (isNaN(m)) return ''; if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; var h = Math.floor(m / 60); if (h < 24) return h + ' hr ago'; var d = Math.floor(h / 24); return d + ' day' + (d === 1 ? '' : 's') + ' ago'; }
  function nice(iso) { try { return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function waNum(p) { var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('00') === 0) d = d.slice(2); else if (d.charAt(0) === '0') d = '44' + d.slice(1); return d; }
  function enq(id) { id = String(id || '').toLowerCase(); for (var i = 0; i < S.enquiries.length; i++) if (String(S.enquiries[i].id).toLowerCase() === id) return S.enquiries[i]; return null; }
  function quoteUrl(q) { return q.url || (QUOTE_HOST + q.slug); }
  function copy(text, msg) {
    var done = function () { toast(msg || 'Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Could not copy'); } t.remove(); }
  }

  /* ---------- styles ---------- */
  var css = '.qd-tabs{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:18px}'
    + '.qd-tab{border:2px solid var(--ink);background:#fff;border-radius:999px;padding:10px 18px;font:800 15px inherit;font-family:inherit;cursor:pointer}'
    + '.qd-tab[aria-pressed="true"]{background:var(--blue);border-color:var(--blue);color:#fff}'
    + '.qd-gen{margin-left:auto;background:var(--yellow);border:2px solid var(--ink);border-radius:999px;padding:10px 18px;font:800 15px inherit;font-family:inherit;cursor:pointer}'
    + '.qd-h{font-family:"Archivo Black",sans-serif;font-size:22px;margin:6px 0 12px}'
    + '.qd-card{background:#fff;border:2px solid var(--ink);border-radius:16px;padding:16px 18px;margin-bottom:14px;box-shadow:5px 5px 0 #d5dbea}'
    + '#eaStats.ea-stats{grid-template-columns:repeat(9,minmax(0,1fr));gap:8px}#eaStats .ea-stat{padding:8px 8px;border-radius:12px;min-width:0}#eaStats .ea-stat b{font-size:20px}#eaStats .ea-stat span{font-size:12px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '@media (max-width:760px){#eaStats.ea-stats{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(74px,1fr);overflow-x:auto;padding-bottom:4px}}'
    + '#eaList .ea-card{padding:12px 14px;margin-bottom:10px;border-radius:14px;box-shadow:3px 3px 0 #d5dbea}#eaList .ea-card.is-new{box-shadow:3px 3px 0 var(--yellow)}'
    + '#eaList .ea-name{font-size:16px}#eaList .ea-meta{font-size:12px}#eaList .ea-badge{font-size:10px;padding:2px 8px}#eaList .ea-sum{margin:6px 0 0;font-size:14px}'
    + '#eaList .ea-actions{margin-top:8px;gap:6px}#eaList .ea-btn{padding:5px 12px;font-size:13px}'
    + '#eaList .ea-ctl{grid-template-columns:160px 1fr;gap:8px;margin-top:8px}#eaList .ea-ctl select,#eaList .ea-ctl textarea{padding:6px 10px;font-size:14px;border-radius:8px}#eaList .ea-ctl textarea{min-height:34px}'
    + '#eaList .qd-block{margin-top:8px;padding-top:8px;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}#eaList .qd-block .qd-small{margin:0}#eaList .qd-block .qd-act{margin:0}#eaList .qd-block .qd-empty{padding:0;font-size:13px}#eaList .qd-block .qd-booked{flex-basis:100%;margin:0}#eaList .qd-block .qd-mini{flex-basis:100%}'
    + '@media (max-width:640px){#eaList .ea-ctl{grid-template-columns:1fr}}'
    + '#eaList .ea-ctl{align-items:start}.qd-notes{display:grid;gap:6px}.qd-nadd{display:flex;gap:6px}.qd-nadd input{flex:1;min-width:0;padding:6px 10px;border:2px solid #d5dbea;border-radius:8px;font:inherit;font-size:14px}'
    + '.qd-nlog{max-height:150px;overflow:auto;display:grid;gap:4px}.qd-nlog div{font-size:13px;background:#f6f8fd;border-radius:8px;padding:5px 9px}.qd-nlog div.auto{color:#5b6478;background:#fff;border:1px dashed #d5dbea}'
    + '.qd-nlog time{display:block;font-size:11px;font-weight:700;color:#6b7190;text-transform:uppercase;letter-spacing:.03em}'
    + '#qdPane .qd-tools{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}#qdPane .qd-tools input{flex:1 1 240px;padding:9px 12px;border:2px solid #d5dbea;border-radius:10px;font:inherit;font-size:15px;background:#fff}#qdPane .qd-tools select{padding:9px 12px;border:2px solid #d5dbea;border-radius:10px;font:inherit;font-size:14px;background:#fff}'
    + '#qdPane .qd-sync{padding:6px 12px;font-size:13px;margin-bottom:10px;border-radius:10px}#qdPane .qd-sync .ea-btn{padding:4px 12px;font-size:12px}'
    + '#qdPane .qd-h{font-size:16px;margin:12px 0 8px}#qdPane .qd-card{padding:10px 14px;margin-bottom:8px;border-radius:14px;box-shadow:3px 3px 0 #d5dbea}'
    + '#qdPane .qd-name{font-size:16px}#qdPane .qd-meta{font-size:12px}#qdPane .qd-link{margin:2px 0 0;font-size:13px}'
    + '#qdPane .qd-views b{font-size:20px}#qdPane .qd-views span{font-size:11px}#qdPane .qd-act{margin-top:6px;gap:6px}#qdPane .ea-btn{padding:5px 12px;font-size:13px}#qdPane .qd-act select{padding:5px 10px!important;font-size:13px}'
    + '#qdPane .qd-hist{margin-top:6px;max-height:160px;font-size:12px;padding:6px 10px}#qdPane .qd-small{margin-top:6px}#qdPane .qd-pre{font-size:13px}'
    + '.qd-done{opacity:.75}.qd-pill.booked{background:#118A5B;border-color:#118A5B;color:#fff}.qd-pill.closed{background:#eceef5;border-color:#9aa0b8;color:#5b6478}.qd-wants{background:#FFD21F;border-color:#FFD21F;color:#10142B}.bk-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}.bk-btns{display:flex;gap:6px;flex-wrap:wrap}.bk-btns .ea-btn{background:#fff}.bk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;margin-top:10px;font-weight:500;font-size:13px;background:#fff;border-radius:10px;padding:12px}.bk-grid b{display:block;color:#004AAD;margin-bottom:3px}.bk-foot{margin-top:8px;font-size:12px;font-weight:500;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.bk-foot .ea-btn{background:#fff;font-size:12px;padding:4px 10px}@media(max-width:640px){.bk-grid{grid-template-columns:1fr}}'
    + '.qd-sync{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#fff;border:2px dashed #d5dbea;border-radius:14px;padding:10px 14px;margin-bottom:14px;font-size:14px;color:#5b6478}'
    + '.qd-booked{background:#e3f4ea;border:2px solid #118A5B;color:#0a5c3b;border-radius:12px;padding:8px 12px;font-weight:700;font-size:14px;margin-top:12px}'
    + '.qd-row{display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;align-items:flex-start}.qd-row>div:first-child{flex:1 1 280px;min-width:0}.qd-row>.qd-views{flex:0 0 auto;margin-left:auto;display:flex;flex-direction:column;align-items:flex-end}'
    + '.qd-name{font-family:"Archivo Black",sans-serif;font-size:18px;margin:0}'
    + '.qd-meta{font-size:13px;color:#5b6478}'
    + '.qd-views{text-align:right}.qd-views b{display:block;font-family:"Archivo Black",sans-serif;font-size:28px;line-height:1;color:var(--blue)}.qd-views span{font-size:12px;color:#5b6478}'
    + '.qd-link{display:block;font-weight:700;word-break:break-all;margin:8px 0 0}'
    + '.qd-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}'
    + '.qd-hist{margin:10px 0 0;padding:10px 12px;background:#f4f6fb;border-radius:10px;font-size:13px;max-height:220px;overflow:auto}'
    + '.qd-live{display:block;width:max-content;background:#25D366;color:#fff;font-weight:800;font-size:12px;border-radius:999px;padding:3px 10px;margin:4px 0}'
    + '.qd-keen{display:inline-block;background:var(--yellow);font-weight:800;font-size:12px;border-radius:999px;padding:3px 10px;margin-top:4px}'
    + '.qd-hist div{padding:3px 0;border-bottom:1px solid #e6eaf3}.qd-hist div:last-child{border:none}'
    + '.qd-pill{font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;border:2px solid var(--ink);background:#fff;text-transform:uppercase;letter-spacing:.04em}'
    + '.qd-pill.requested{background:var(--yellow)}.qd-pill.building{background:#dfe9ff;border-color:#99ACFF}.qd-pill.sent{background:#e3f4ea;border-color:#118A5B;color:#0a5c3b}.qd-pill.booked{background:#118A5B;border-color:#118A5B;color:#fff}.qd-pill.closed{background:#eceef5;border-color:#9aa0b8;color:#5b6478}'
    + '.qd-pre{white-space:pre-wrap;font-size:14px;margin:8px 0 0;background:#f4f6fb;border-radius:10px;padding:10px 12px}'
    + '.qd-small{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7190;margin-top:10px}'
    + '.qd-block{margin-top:14px;border-top:1px solid #e6eaf3;padding-top:12px}'
    + '.bk-pax{background:#fff;border-radius:10px;padding:12px;margin-top:10px;font-size:13px}.bk-pax>b{display:block;color:#004AAD;margin-bottom:6px}.bk-ptab{border-collapse:collapse;width:100%}.bk-ptab th{text-align:left;font-size:12px;color:#5b6478;border-bottom:2px solid #004AAD;padding:4px 8px}.bk-ptab td{padding:6px 8px;border-bottom:1px solid #e3e7f5;font-weight:700}.bk-room td{background:#f1f4fc;color:#004AAD;font-weight:800!important}.bk-none{font-weight:400;color:#9aa0b8}@media(max-width:640px){.bk-ptab th,.bk-ptab td{padding:5px 4px;font-size:12px}}'
    + '.qd-flash{box-shadow:0 0 0 4px var(--yellow)!important;transition:box-shadow .3s}'
    + '.qd-block .qd-mini{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:14px;padding:6px 0}'
    + '.qd-empty{color:#5b6478;font-size:14px}'
    + '.qd-modal{position:fixed;inset:0;z-index:80;background:rgba(16,20,43,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px}'
    + '.qd-form{background:#fff;border:2px solid var(--ink);border-radius:18px;max-width:640px;width:100%;padding:22px}'
    + '.qd-form h3{margin:0 0 4px;font-family:"Archivo Black",sans-serif}'
    + '.qd-form label{display:block;font-weight:700;font-size:14px;margin:14px 0 6px}'
    + '.qd-form input,.qd-form select,.qd-form textarea{width:100%;box-sizing:border-box;padding:11px 12px;border:2px solid #d5dbea;border-radius:10px;font:inherit;font-size:16px;background:#fff}'
    + '.qd-form textarea{min-height:90px;resize:vertical}'
    + '.qd-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
    + '.qd-hint{font-size:13px;color:#5b6478;margin-top:4px}'
    + '@media (max-width:640px){.qd-two{grid-template-columns:1fr}.qd-gen{margin-left:0}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- layout ---------- */
  var app = $('eaApp'), paneEnq = $('eaPaneEnq');
  if (!app || !paneEnq) return;
  var tabs = document.createElement('div'); tabs.className = 'qd-tabs';
  tabs.innerHTML = '<button type="button" class="qd-tab" data-tab="enq" aria-pressed="true">Enquiries</button><button type="button" class="qd-tab" data-tab="quotes" aria-pressed="false">Quotes</button><button type="button" class="qd-gen" id="qdGen">+ Generate quote</button>';
  app.insertBefore(tabs, paneEnq);
  var paneQ = document.createElement('div'); paneQ.id = 'qdPane'; paneQ.hidden = true; app.appendChild(paneQ);
  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]'); if (b) { S.tab = b.dataset.tab; paneEnq.hidden = S.tab !== 'enq'; paneQ.hidden = S.tab !== 'quotes'; Array.prototype.forEach.call(tabs.querySelectorAll('[data-tab]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); if (S.tab === 'quotes') load(); }
    if (e.target.id === 'qdGen') openForm(null);
  });

  /* ---------- data ---------- */
  function load() {
    if (!key()) return Promise.resolve();
    return Promise.all([
      fetch('https://taj-quotes.pages.dev/quotes.json?cb=' + Date.now()).then(function (r) { return r.json(); }).catch(function () { return { quotes: [] }; }),
      api('/api/quote-admin', 'GET'),
      api('/api/enquiry-admin', 'GET')
    ]).then(function (res) {
      S.quotes = (res[0] && res[0].quotes) || [];
      if (res[1].j) { S.views = res[1].j.views || {}; S.requests = res[1].j.requests || []; S.statuses = res[1].j.statuses || {}; S.sync = res[1].j.sync || null; S.bookings = res[1].j.bookings || []; }
      if (res[2].j && res[2].j.enquiries) S.enquiries = res[2].j.enquiries;
      window.__eaQuoteActivity = quoteActivity; window.__eaChaseReady = true; if (window.__eaRerender) window.__eaRerender();
      renderPane(); decorate();
      /* opening the dashboard also checks for new bookings if the last check was over 15 minutes ago */
      if (!S.autoSynced && (!S.sync || Date.now() - Date.parse(S.sync.at) > 15 * 60000)) { S.autoSynced = true; api('/api/quote-admin', 'POST', { action: 'sync-bookings' }); }
    });
  }

  /* ---------- Quotes pane ---------- */
  /* how the customer has been using the quotes sent to them, used by the chase filter */
  function quoteActivity(enquiryId) {
    var id = String(enquiryId || '').toLowerCase(), qs = S.quotes.filter(function (q) { return String(q.enquiryId || '').toLowerCase() === id; });
    if (!qs.length) return null;
    var views = 0, last = 0, sent = 0;
    qs.forEach(function (q) {
      var v = S.views[q.slug] || {}; views += v.views || 0;
      var lv = v.lastView ? Date.parse(v.lastView) : 0; if (lv > last) last = lv;
      var c = q.created ? Date.parse(q.created + 'T12:00:00Z') : 0; if (c > sent) sent = c;
    });
    return { quotes: qs.length, views: views, lastView: last, sentAt: sent };
  }
  window.__eaQuoteActivity = quoteActivity;
  /* what the chase rulebook needs about one customer's quotes */
  window.__eaChaseCtx = function (id) {
    var k = String(id || '').toLowerCase(), qs = S.quotes.filter(function (q) { return String(q.enquiryId || '').toLowerCase() === k; });
    var views = 0, last = 0, sent = 0, recent = 0;
    qs.forEach(function (q) {
      var v = S.views[q.slug] || {}; views += v.views || 0;
      var lv = v.lastView ? Date.parse(v.lastView) : 0; if (lv > last) last = lv;
      var c = q.created ? Date.parse(q.created + 'T12:00:00Z') : 0; if (c > sent) sent = c;
      (v.opens || []).forEach(function (o) { if (Date.now() - Date.parse(o.t) < 7 * 86400000) recent++; });
    });
    return { quotes: qs.map(function (q) { return { slug: q.slug, title: q.title, created: q.created, url: quoteUrl(q) }; }), views: views, lastView: last, sentAt: sent, recentViews: recent };
  };
  function viewsOf(slug) { return S.views[slug] || { views: 0, opens: [] }; }
  /* a quote is booked or closed when Jake marks it, or booked when its customer's enquiry is booked */
  function qState(q) {
    var s = S.statuses[q.slug], e = enq(q.enquiryId);
    if (s && s.status !== 'open') return s.status;
    if (!s && e && e.status === 'booked') return 'booked';
    return 'open';
  }
  function quoteCard(q) {
    var v = viewsOf(q.slug), e = enq(q.enquiryId), url = quoteUrl(q);
    var hello = 'Hi ' + (q.customer || (e && e.firstName) || '') + ", it's Jake from Travel Agent Jake. Here's your personal holiday quote, have a look and let me know what you think: " + url;
    var showAll = S.openHist[q.slug];
    var live = v.lastView && (Date.now() - Date.parse(v.lastView) < 5 * 60000);
    var comeback = (v.opens || []).some(function (o, i, a) { return a[i + 1] && Date.parse(o.t) - Date.parse(a[i + 1].t) >= 86400000; });
    var hist = !showAll ? '' : (v.opens || []).slice(0, 100).map(function (o) { return '<div>' + esc(nice(o.t)) + ' &#183; ' + esc(o.device || '') + (o.place ? ' &#183; ' + esc(o.place) : '') + (o.from ? ' &#183; via ' + esc(o.from) : '') + '</div>'; }).join('');
    var st = qState(q);
    return '<article class="qd-card' + (st !== 'open' ? ' qd-done' : '') + '" data-slug="' + esc(q.slug) + '"><div class="qd-row"><div><h3 class="qd-name">' + esc(q.customer || '') + (st !== 'open' ? ' <span class="qd-pill ' + st + '">' + (st === 'booked' ? 'Booked' : 'Closed') + '</span>' : '') + '</h3><div class="qd-meta">' + esc(q.title || '') + (q.created ? ' &#183; made ' + esc(q.created) : '') + '</div>'
      + '<a class="qd-link" href="' + esc(url) + '?jake=1" target="_blank" rel="noopener">' + esc(url.replace('https://', '')) + '</a></div>'
      + '<div class="qd-views"><b>' + (v.views || 0) + '</b><span>view' + (v.views === 1 ? '' : 's') + '</span>' + (live ? '<div class="qd-live">Viewing now</div>' : '') + (v.lastView ? '<div class="qd-meta">Last opened ' + esc(ago(v.lastView)) + (v.opens && v.opens[0] ? ' &#183; ' + esc(v.opens[0].device || '') + (v.opens[0].place ? ', ' + esc(String(v.opens[0].place).split(',')[0]) : '') : '') + '</div>' : '<div class="qd-meta">Not opened yet</div>') + '</div></div>'
      + '<div class="qd-act"><a class="ea-btn" href="' + esc(url) + '?jake=1" target="_blank" rel="noopener">Open</a>'
      + '<button class="ea-btn" type="button" data-qa="amend" style="background:var(--yellow)">Amend quote</button>'
      + '<button class="ea-btn" type="button" data-qa="copy" data-url="' + esc(url) + '">Copy link</button>'
      + (e && e.phone ? '<a class="ea-btn wa" target="_blank" rel="noopener" href="https://wa.me/' + waNum(e.phone) + '?text=' + encodeURIComponent(hello) + '">Send on WhatsApp</a>' : '')
      + (st === 'open' ? '<button class="ea-btn" type="button" data-qa="qbooked" style="background:#118A5B;border-color:#118A5B;color:#fff">Booked</button><button class="ea-btn" type="button" data-qa="qclosed">Close</button>' : '<button class="ea-btn" type="button" data-qa="qopen">Reopen</button>')
      + ((v.opens || []).length ? '<button class="ea-btn" type="button" data-qa="hist">' + (showAll ? 'Hide opens' : 'Opens (' + v.opens.length + ')') + '</button>' : '') + '</div>'
      + (hist ? '<div class="qd-small">When it was opened</div><div class="qd-hist">' + hist + '</div>' : '') + '</article>';
  }
  function reqCard(r) {
    var e = enq(r.enquiryId), published = S.quotes.some(function (q) { return q.slug === r.slug; });
    return '<article class="qd-card" data-req="' + esc(r.id) + '"><div class="qd-row"><div><h3 class="qd-name">' + esc(r.customerName || (e ? e.firstName + ' ' + e.lastName : 'Customer')) + '</h3>'
      + '<div class="qd-meta">Requested ' + esc(nice(r.createdAt)) + ' &#183; link quotes.travelagentjake.co.uk/' + esc(r.slug) + (published ? ' (live)' : '') + '</div></div>'
      + '<span class="qd-pill ' + esc(r.status) + '">' + esc((RSTAT.filter(function (x) { return x[0] === r.status; })[0] || [0, r.status])[1]) + '</span></div>'
      + (r.title ? '<div class="qd-small">Quote</div><div>' + esc(r.title) + '</div>' : '')
      + (r.urls && r.urls.length ? '<div class="qd-small">Supplier links</div>' + r.urls.map(function (u) { return '<a class="qd-link" style="font-weight:600" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.length > 90 ? u.slice(0, 90) + '...' : u) + '</a>'; }).join('') : '')
      + (r.notes ? '<div class="qd-small">Your notes for this quote</div><div class="qd-pre">' + esc(r.notes) + '</div>' : '')
      + (r.chatNotes ? '<div class="qd-small">WhatsApp notes</div><div class="qd-pre">' + esc(r.chatNotes) + '</div>' : '')
      + (r.files && r.files.length ? '<div class="qd-small">Files</div><div class="qd-act" style="margin-top:6px">' + r.files.map(function (f) { return '<button class="ea-btn" type="button" data-qa="file" data-i="' + f.index + '">' + esc(f.name) + '</button>'; }).join('') + '</div>' : '')
      + '<div class="qd-act"><button class="ea-btn" type="button" data-qa="brief" style="background:var(--yellow)">Copy brief for Claude</button>'
      + '<select data-qa="status" aria-label="Request status" style="padding:9px 12px;border:2px solid #d5dbea;border-radius:999px;font:inherit">' + RSTAT.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === r.status ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>'
      + '<button class="ea-btn danger" type="button" data-qa="del">Delete</button></div></article>';
  }
  function qMatches(q) {
    var t = (S.qSearch || '').trim().toLowerCase(); if (!t) return true;
    var e = enq(q.enquiryId);
    return [q.customer, q.title, q.slug, e && e.firstName, e && e.lastName, e && e.email, e && e.phone, e && e.destination].join(' ').toLowerCase().indexOf(t) >= 0;
  }
  function qSorted(list) {
    var lv = function (q) { var v = viewsOf(q.slug); return v.lastView ? Date.parse(v.lastView) : 0; };
    var by = S.qSort || 'viewed';
    return list.slice().sort(function (a, b) {
      if (by === 'views') return (viewsOf(b.slug).views || 0) - (viewsOf(a.slug).views || 0);
      if (by === 'newest') return String(b.created || '').localeCompare(String(a.created || ''));
      if (by === 'unopened') return (lv(a) ? 1 : 0) - (lv(b) ? 1 : 0) || String(b.created || '').localeCompare(String(a.created || ''));
      if (by === 'name') return String(a.customer || '').localeCompare(String(b.customer || ''));
      return lv(b) - lv(a) || String(b.created || '').localeCompare(String(a.created || ''));
    });
  }
  function qFiltered(q) {
    var f = S.qFilter || 'all', v = viewsOf(q.slug), last = v.lastView ? Date.parse(v.lastView) : 0;
    if (f === 'today') return last && Date.now() - last < 86400000;
    if (f === 'week') return last && Date.now() - last < 7 * 86400000;
    if (f === 'unopened') return !last;
    if (f === 'quiet') return last && Date.now() - last >= 3 * 86400000;
    return true;
  }
  function renderPane() {
    if (!$('qdList')) {
      paneQ.innerHTML = '<div id="qdSync"></div><div class="qd-tools"><input id="qdSearch" type="search" placeholder="Search name, email, phone, destination or quote">'
        + '<select id="qdSort" aria-label="Sort quotes"><option value="viewed">Last viewed by customer</option><option value="views">Most views</option><option value="newest">Newest quote</option><option value="unopened">Not opened first</option><option value="name">Name A to Z</option></select>'
        + '<select id="qdFilter" aria-label="Filter quotes"><option value="all">All open quotes</option><option value="today">Viewed in last 24 hours</option><option value="week">Viewed in last 7 days</option><option value="quiet">Not viewed for 3+ days</option><option value="unopened">Never opened</option></select></div><div id="qdList"></div>';
      $('qdSearch').addEventListener('input', function () { S.qSearch = this.value; renderPane(); });
      $('qdSort').addEventListener('change', function () { S.qSort = this.value; renderPane(); });
      $('qdFilter').addEventListener('change', function () { S.qFilter = this.value; renderPane(); });
    }
    var open = S.requests.filter(function (r) { return r.status === 'requested' || r.status === 'building'; });
    var all = qSorted(S.quotes.filter(qMatches));
    var qs = all.filter(function (q) { return qState(q) === 'open' && qFiltered(q); }), done = all.filter(function (q) { return qState(q) !== 'open'; });
    var sy = S.sync;
    $('qdSync').innerHTML = '<div class="qd-sync"><span>' + (sy ? (sy.ok ? 'Bookings from your sales dashboard are picked up automatically. Last checked ' + esc(ago(sy.at)) + (sy.matched && sy.matched.length ? ', marked ' + sy.matched.map(function (m) { return esc(m.name); }).join(', ') + ' as booked' : '') : 'Bookings check failed: ' + esc(sy.error || '')) : 'Bookings are checked against your sales dashboard every hour') + '</span><button class="ea-btn" type="button" data-qa="sync">Check now</button></div>';
    $('qdList').innerHTML = (open.length ? '<h2 class="qd-h">Waiting to be built (' + open.length + ')</h2>' + open.map(reqCard).join('') : '')
      + '<h2 class="qd-h">Quote links (' + qs.length + ')</h2>' + (qs.length ? qs.map(quoteCard).join('') : '<p class="qd-empty">No quotes match.</p>')
      + (done.length ? '<button class="ea-btn" type="button" data-qa="showdone" style="margin:4px 0 10px">' + (S.showDone ? 'Hide' : 'Show') + ' booked and closed quotes (' + done.length + ')</button>' + (S.showDone ? done.map(quoteCard).join('') : '') : '');
  }
  paneQ.addEventListener('click', function (e) {
    var b = e.target.closest('[data-qa]'); if (!b || b.tagName === 'SELECT') return; var act = b.dataset.qa;
    if (act === 'copy') return copy(b.dataset.url, 'Quote link copied');
    if (act === 'amend') return openAmend(b.closest('[data-slug]').dataset.slug);
    if (act === 'showdone') { S.showDone = !S.showDone; renderPane(); return; }
    if (act === 'sync') { b.disabled = true; b.textContent = 'Checking...'; api('/api/quote-admin', 'POST', { action: 'sync-bookings' }).then(function () { toast('Checking your sales dashboard, this can take a minute'); setTimeout(function () { load(); if (window.taj_enq_reload) window.taj_enq_reload(); }, 45000); }); return; }
    if (act === 'qbooked' || act === 'qclosed' || act === 'qopen') {
      var sl = b.closest('[data-slug]').dataset.slug, ns = act === 'qbooked' ? 'booked' : act === 'qclosed' ? 'closed' : 'open';
      api('/api/quote-admin', 'POST', { action: 'quote-status', slug: sl, status: ns }).then(function (x) {
        if (x.j && x.j.ok) { S.statuses[sl] = x.j.status; if (ns === 'booked') { var qq = S.quotes.filter(function (z) { return z.slug === sl; })[0], ee = qq && enq(qq.enquiryId); if (ee) ee.status = 'booked'; } renderPane(); toast(ns === 'open' ? 'Reopened' : ns === 'booked' ? 'Marked booked' : 'Closed'); }
        else toast('Could not save');
      });
      return;
    }
    if (act === 'hist') { var slug = b.closest('[data-slug]').dataset.slug; S.openHist[slug] = !S.openHist[slug]; renderPane(); return; }
    var card = b.closest('[data-req]'); if (!card) return; var r = S.requests.filter(function (x) { return x.id === card.dataset.req; })[0]; if (!r) return;
    if (act === 'brief') return copy(brief(r), 'Brief copied. Paste it to Claude');
    if (act === 'file') { b.disabled = true; api('/api/quote-admin', 'POST', { action: 'request-file', id: r.id, index: Number(b.dataset.i) }).then(function (x) { b.disabled = false; if (x.j && x.j.ok) download(x.j.name, x.j.type, x.j.b64); else toast('Could not get the file'); }); return; }
    if (act === 'del') {
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Tap again to delete'; b.classList.add('armed'); setTimeout(function () { if (b.isConnected) { b.dataset.armed = ''; b.textContent = 'Delete'; b.classList.remove('armed'); } }, 3500); return; }
      api('/api/quote-admin', 'POST', { action: 'request-delete', id: r.id }).then(function (x) { if (x.j && x.j.ok) { S.requests = S.requests.filter(function (y) { return y.id !== r.id; }); renderPane(); toast('Deleted'); } else toast('Could not delete'); });
    }
  });
  paneQ.addEventListener('change', function (e) {
    if (e.target.dataset.qa !== 'status') return; var r = S.requests.filter(function (x) { return x.id === e.target.closest('[data-req]').dataset.req; })[0]; if (!r) return;
    var v = e.target.value; api('/api/quote-admin', 'POST', { action: 'request-update', id: r.id, status: v }).then(function (x) { if (x.j && x.j.ok) { r.status = v; renderPane(); toast('Saved'); } else toast('Could not save'); });
  });
  function download(name, type, b64) { var bin = atob(b64), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); var url = URL.createObjectURL(new Blob([arr], { type: type || 'application/octet-stream' })); var a = document.createElement('a'); a.href = url; a.download = name || 'file'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000); }

  /* ---------- brief for Claude ---------- */
  function enquiryText(e) {
    if (!e) return '';
    var rooms = (e.rooms || []).map(function (r, i) { return 'Room ' + (i + 1) + ': ' + r.adults + ' adult(s)' + (Number(r.children) ? ', ' + r.children + ' child(ren) aged ' + (r.childAges || []).join(', ') : ''); }).join('\n');
    var rows = [['Name', [e.firstName, e.lastName].join(' ')], ['Email', e.email], ['Mobile', e.phone], ['Enquiry ref', String(e.id || '').toUpperCase()], ['Type of holiday', e.holidayType], ['Where', e.destination], ['Departure date', e.departDate], ['Date flexibility', e.dateFlex], ['Date notes', e.dateNotes], ['Nights', e.nights], ['Airports', (e.airports || []).join(', ')], ['Rooms', rooms], ['Adults', e.adults], ['Children', e.children], ['Accommodation', e.accommodation], ['Minimum stars', e.stars], ['Board', e.board], ['Budget', e.budget], ['Booking timescale', e.whenBook], ['Anything else', e.notes], ['Jake\'s enquiry notes', e.adminNotes]];
    return rows.filter(function (r) { return r[1]; }).map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');
  }
  function chatTitle(r, e) {
    var name = e ? [e.firstName, e.lastName].filter(Boolean).join(' ') : '';
    var when = '';
    if (e && e.departDate) { var t = Date.parse(e.departDate); if (!isNaN(t)) when = new Date(t).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); }
    return [name || r.customerName || 'Customer', (e && e.destination) || r.title || '', when].filter(Boolean).join(' | ');
  }
  function brief(r) {
    var e = enq(r.enquiryId);
    var title = chatTitle(r, e);
    return [
      'CHAT TITLE: ' + title,
      'Start your first reply with this exact line in bold as a heading so this chat can be found later: ' + title,
      '',
      'Build a Travel Agent Jake interactive quote page using the quotes system on travelagentjake.co.uk (quotes/assets/quote.js renderer, data only).',
      'Quote link: ' + QUOTE_HOST + r.slug,
      'Quote request ID: ' + r.id + (r.enquiryId ? '   Enquiry ID: ' + r.enquiryId : ''),
      r.title ? 'Quote: ' + r.title : '',
      '', 'CUSTOMER', enquiryText(e) || r.customerName,
      '', 'SUPPLIER LINKS', (r.urls || []).join('\n') || 'None',
      '', "JAKE'S NOTES FOR THIS QUOTE (personalise sections from these)", r.notes || 'None',
      '', 'WHATSAPP NOTES', r.chatNotes || 'None',
      '', 'FILES', (r.files || []).length ? r.files.map(function (f) { return f.name; }).join(', ') + ' (download from the Quotes tab of the dashboard)' : 'None',
      '', 'MUST HAVE', 'Tourist tax payable at the hotel (CMA): if the supplier or trade site lists a local charge, set touristTax { amount, note } and tax/taxNote on any hotel that differs. If none is listed, leave touristTax out (the standard tourist tax small print shows on every quote).',
      'Extras with LIVE prices only: click through the supplier booking (up to passenger details) for room upgrades, private transfers and seats, and search travelagentjake.co.uk/airport-extras with this customer\'s airport, dates, flight times and party for parking, lounges and fast track. Anything with no live price is left out. Never link to Holiday Extras or other sellers.',
      'Link preview: og:image in the page head must be the same photo as heroImg (1200 wide), with og:title and og:description written for this customer.',
      '', 'When done: add the page to quotes/<slug>/index.html, add it to quotes/quotes.json with the enquiry ID, push, and set this request to Sent.'
    ].filter(function (x) { return x !== null; }).join('\n');
  }

  /* ---------- quotes inside each customer card ---------- */
  function decorate() {
    Array.prototype.forEach.call(document.querySelectorAll('#eaList .ea-card'), function (c) {
      var id = String(c.dataset.id || '').toLowerCase();
      var qs = S.quotes.filter(function (q) { return String(q.enquiryId || '').toLowerCase() === id; });
      var rs = S.requests.filter(function (r) { return String(r.enquiryId || '').toLowerCase() === id && !qs.some(function (q) { return q.slug === r.slug; }); });
      var en = S.enquiries.filter(function (x) { return String(x.id || '').toLowerCase() === id; })[0];
      var bks = S.bookings.filter(function (k) { return k.email && en && String(k.email).toLowerCase() === String(en.email || '').toLowerCase() || (en && en.wantsToBook && k.id === en.wantsToBook.bookingId); });
      var html = bks.map(bookingPanel).join('')
        + (en && en.status === 'booked' && en.booked ? '<div class="qd-booked">Booked' + (en.booked.ref ? ', ref ' + esc(en.booked.ref) : '') + (en.booked.supplier ? ' with ' + esc(en.booked.supplier) : '') + (en.booked.via ? ' (found in your ' + esc(en.booked.via) + ')' : '') + '</div>' : '')
        + (function () {
          var v = 0, last = 0;
          qs.forEach(function (q) { var w = viewsOf(q.slug); v += w.views || 0; var t = w.lastView ? Date.parse(w.lastView) : 0; if (t > last) last = t; });
          var line = qs.length ? '<span class="qd-meta"><b>' + qs.length + ' quote' + (qs.length === 1 ? '' : 's') + '</b> &#183; ' + v + ' view' + (v === 1 ? '' : 's') + (last ? ', last ' + esc(ago(new Date(last).toISOString())) : ', not opened yet') + '</span>'
            : rs.length ? '<span class="qd-meta">' + rs.map(function (r) { return esc(r.status); }).join(', ') + ' quote request' + (rs.length === 1 ? '' : 's') + '</span>' : '<span class="qd-meta">No quotes yet</span>';
          return line + (qs.length ? '<button class="ea-btn" type="button" data-qview="' + esc(c.dataset.id) + '">View quote' + (qs.length === 1 ? '' : 's') + '</button>' : '')
            + '<button class="ea-btn" type="button" data-qgen="' + esc(c.dataset.id) + '" style="background:var(--yellow)">Generate quote</button>';
        })();
      notesBlock(c, en);
      var blk = c.querySelector('.qd-block');
      if (!blk) { blk = document.createElement('div'); blk.className = 'qd-block'; var ctl = c.querySelector('.ea-ctl'); c.insertBefore(blk, ctl || null); }
      if (blk.innerHTML !== html) blk.innerHTML = html;
    });
  }
  /* ---------- booking form details, kept on the dashboard rather than in email ---------- */
  function gbp(n) { n = Number(n || 0); return '\u00a3' + (n % 1 ? n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toLocaleString('en-GB')); }
  function dmy(d) { try { var t = Date.parse(d); return isNaN(t) ? esc(d) : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return esc(d); } }
  function ordinal(d) { return d + ([, 'st', 'nd', 'rd'][(d % 100 >> 3 ^ 1 && d % 10)] || 'th'); }
  function bookingPanel(k) {
    var open = !!S.openBk[k.id];
    var h = '<div class="qd-booked qd-wants" id="bk-' + esc(k.id) + '"><div class="bk-top"><span>Wants to book! Booking form sent ' + esc(ago(k.at)) + ': ' + esc(k.hotel) + ', ' + gbp(k.total) + ', paying ' + gbp(k.payToday) + ' today by ' + (k.payHow === 'bank' ? 'bank transfer' : 'card') + '.</span>'
      + '<span class="bk-btns"><button class="ea-btn" type="button" data-bk="toggle" data-id="' + esc(k.id) + '">' + (open ? 'Hide details' : 'Show details') + '</button></span></div>';
    if (open) {
      h += '<div class="bk-pax"><b>Who is travelling</b><table class="bk-ptab"><thead><tr><th>#</th><th>Title</th><th>First name</th><th>Middle name</th><th>Surname</th><th>Date of birth</th></tr></thead><tbody>' + (function () {
          var ps = k.passengers || [], rooms = []; ps.forEach(function (p) { var r = p.room || 1; if (rooms.indexOf(r) < 0) rooms.push(r); }); rooms.sort(function (a, b) { return a - b; });
          function row(p, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(p.title || '') + '</td><td>' + esc(p.first) + '</td><td>' + (p.middle ? esc(p.middle) : '') + '</td><td>' + esc(p.last) + '</td><td>' + dmy(p.dob) + '</td></tr>'; }
          if (rooms.length < 2) return ps.map(row).join('');
          return rooms.map(function (r) { return '<tr class="bk-room"><td colspan="6">Room ' + r + '</td></tr>' + ps.map(function (p, i) { return [p, i]; }).filter(function (x) { return (x[0].room || 1) === r; }).map(function (x) { return row(x[0], x[1]); }).join(''); }).join('');
        })() + '</tbody></table></div>'
        + '<div class="bk-grid">'
        + '<div><b>Contact</b><div>' + esc(k.address).replace(/\n/g, '<br>') + '<br>' + esc(k.postcode) + '</div><div>' + esc(k.mobile) + '</div><div>' + esc(k.email) + '</div></div>'
        + '<div><b>Holiday</b><div>' + esc(k.hotel) + ', ' + gbp(k.hotelTotal) + '</div>' + (k.extras || []).map(function (e) { return '<div>+ ' + esc(e.title) + ', ' + gbp(e.total) + (e.separate ? ' (paid in full at booking)' : '') + '</div>'; }).join('') + '<div>Total ' + gbp(k.total) + (k.departDate ? ', departs ' + dmy(k.departDate) : '') + '</div></div>'
        + '<div><b>Payment</b><div>' + gbp(k.payToday) + ' today, ' + (k.payNow === 'full' ? 'the full amount' : 'the deposit') + ', by ' + (k.payHow === 'bank' ? 'bank transfer' : 'card') + '</div>'
        + (k.dd ? '<div>Direct debit on the ' + ordinal(k.dd.day) + ' of each month</div><div>Account holder: ' + esc(k.dd.name) + '</div><div>Sort code ' + esc(String(k.dd.sort).replace(/(\d\d)(?=\d)/g, '$1-')) + ', account ' + esc(k.dd.account) + '</div>' : '<div>' + (k.payNow === 'full' ? 'No balance to follow' : 'No direct debit, balance due about 14 weeks before travel') + '</div>') + '</div></div>'
        + '<div class="bk-foot">Agreed to the booking conditions on ' + esc(noteTime(k.at)) + '. Ref ' + esc(k.id) + '. <button class="ea-btn" type="button" data-bk="delete" data-id="' + esc(k.id) + '">Remove these details</button></div>';
    }
    return h + '</div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-bk]'); if (!b) return;
    if (b.dataset.bk === 'toggle') { S.openBk[b.dataset.id] = !S.openBk[b.dataset.id]; decorate(); renderPane(); return; }
    if (b.dataset.bk === 'delete' && confirm('Remove these booking details from the dashboard? Do this once the holiday is booked.')) {
      api('/api/quote-admin', 'POST', { action: 'booking-delete', id: b.dataset.id }).then(function () { S.bookings = S.bookings.filter(function (k) { return k.id !== b.dataset.id; }); decorate(); renderPane(); toast('Removed'); });
    }
  });
  /* ---------- notes history on each enquiry (replaces the single notes box) ---------- */
  function noteTime(iso) { try { return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function notesBlock(c, en) {
    var ta = c.querySelector('textarea[data-act="notes"]'); if (!ta || !en) return;
    ta.hidden = true; ta.removeAttribute('data-act');
    var log = (en.notesLog || []).slice().reverse();
    var html = '<div class="qd-nadd"><input type="text" placeholder="Add a note, for example Rang and left a voicemail" data-note-in><button class="ea-btn" type="button" data-note-save>Save note</button></div>'
      + '<div class="qd-nlog">' + log.map(function (n) { return '<div' + (n.auto ? ' class="auto"' : '') + '><time>' + esc(noteTime(n.t)) + '</time>' + esc(n.text) + '</div>'; }).join('')
      + (en.adminNotes ? '<div><time>Earlier note</time>' + esc(en.adminNotes) + '</div>' : '') + '</div>';
    var nb = c.querySelector('.qd-notes');
    if (!nb) { nb = document.createElement('div'); nb.className = 'qd-notes'; ta.parentNode.appendChild(nb); }
    var typing = nb.querySelector('[data-note-in]'), val = typing ? typing.value : '', focused = typing && document.activeElement === typing;
    if (nb.dataset.h !== html) { nb.innerHTML = html; nb.dataset.h = html; var ni = nb.querySelector('[data-note-in]'); ni.value = val; if (focused) ni.focus(); }
  }
  function saveNote(btn) {
    var c = btn.closest('.ea-card'), inp = c.querySelector('[data-note-in]'), text = inp.value.trim(); if (!text) return;
    btn.disabled = true;
    api('/api/enquiry-admin', 'POST', { action: 'note', id: c.dataset.id, text: text }).then(function (x) {
      btn.disabled = false;
      if (x.j && x.j.ok) { inp.value = ''; var en = enq(c.dataset.id); if (en) en.notesLog = x.j.enquiry.notesLog; else S.enquiries.push(x.j.enquiry); if (window.__eaTouch) window.__eaTouch(c.dataset.id, x.j.enquiry.notesLog); decorate(); toast('Note saved'); }
      else toast((x.j && x.j.error) || 'Could not save the note');
    });
  }
  var list = $('eaList');
  if (list) {
    list.addEventListener('click', function (e) { var b = e.target.closest('[data-note-save]'); if (b) saveNote(b); });
    list.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('[data-note-in]')) { e.preventDefault(); saveNote(e.target.closest('.ea-card').querySelector('[data-note-save]')); } });
    /* status changes are logged on the server, so refresh the history shortly after one */
    list.addEventListener('change', function (e) { if (e.target.matches('select[data-act="status"]')) setTimeout(load, 1500); });
    new MutationObserver(function () { decorate(); }).observe(list, { childList: true });
    list.addEventListener('click', function (e) { var b = e.target.closest('[data-qgen]'); if (b) openForm(b.dataset.qgen); });
    /* "View quotes" on a customer card: jump to the Quotes tab and land on that customer's quote(s) */
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-qview]'); if (!b) return;
      var id = String(b.dataset.qview || '').toLowerCase();
      tabs.querySelector('[data-tab="quotes"]').click();
      load().then(function () {
        var qs = S.quotes.filter(function (q) { return String(q.enquiryId || '').toLowerCase() === id; });
        if (!qs.length) return;
        S.qSearch = ''; S.qFilter = 'all'; var si = $('qdSearch'); if (si) si.value = ''; var sf = $('qdFilter'); if (sf) sf.value = 'all';
        if (qs.some(function (q) { return qState(q) !== 'open'; })) S.showDone = true;
        renderPane();
        qs.forEach(function (q, i) { var card = paneQ.querySelector('[data-slug="' + q.slug + '"]'); if (!card) return; card.classList.add('qd-flash'); if (i === 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(function () { card.classList.remove('qd-flash'); }, 2500); });
      });
    });
  }

  /* ---------- Generate quote form ---------- */
  function slugFor(name) {
    var base = String(name || 'quote').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'quote';
    var taken = S.quotes.map(function (q) { return q.slug; }).concat(S.requests.map(function (r) { return r.slug; }));
    var s = base, n = 2; while (taken.indexOf(s) >= 0) s = base + '-' + (n++);
    return s;
  }
  function openForm(enquiryId) {
    var opts = S.enquiries.map(function (e) { return '<option value="' + esc(e.id) + '"' + (String(e.id) === String(enquiryId) ? ' selected' : '') + '>' + esc(e.firstName + ' ' + e.lastName + (e.destination ? ' (' + e.destination + ')' : '')) + '</option>'; }).join('');
    var m = document.createElement('div'); m.className = 'qd-modal';
    m.innerHTML = '<form class="qd-form" novalidate><h3>Generate quote</h3><p class="qd-hint">Add the links, files and any personal touches. Everything is saved here, then copy the brief for Claude.</p>'
      + '<label for="qfCust">Customer</label><select id="qfCust"><option value="">New customer (adds them to the dashboard)</option>' + opts + '</select>'
      + '<div id="qfNew"><div class="qd-two"><div><label for="qfFirst">First name</label><input id="qfFirst" autocomplete="off"></div><div><label for="qfLast">Last name</label><input id="qfLast" autocomplete="off"></div></div>'
      + '<div class="qd-two"><div><label for="qfPhone">Mobile / WhatsApp</label><input id="qfPhone" type="tel" autocomplete="off"></div><div><label for="qfEmail">Email</label><input id="qfEmail" type="email" autocomplete="off"></div></div>'
      + '<label for="qfDest">Where and when</label><input id="qfDest" placeholder="e.g. Tunisia, 7 nights from 7 Aug 2027"></div>'
      + '<label for="qfSlug">Quote link</label><input id="qfSlug"><div class="qd-hint" id="qfSlugPrev"></div>'
      + '<label for="qfTitle">Quote title (optional)</label><input id="qfTitle" placeholder="e.g. Tunisia group holiday, 6 hotel options">'
      + '<label for="qfUrls">Supplier links (one per line)</label><textarea id="qfUrls" placeholder="Paste Jet2holidays, TUI, easyJet holidays or other quote links"></textarea>'
      + '<label for="qfNotes">Your notes for this quote</label><textarea id="qfNotes" placeholder="e.g. Add a section on the best restaurants in Sousse. Mention it is their 25th anniversary. Highlight hotels with slides."></textarea>'
      + '<label for="qfChat">WhatsApp notes (paste anything useful from the chat)</label><textarea id="qfChat"></textarea>'
      + '<label for="qfFiles">Files (supplier quote PDFs, screenshots)</label><input id="qfFiles" type="file" multiple accept=".pdf,image/*,.txt,.docx">'
      + '<div class="qd-hint">Up to 10 files, about 4MB in total.</div>'
      + '<div id="qfErr" style="color:#c2412d;font-weight:700;margin-top:12px" hidden></div>'
      + '<div class="qd-act" style="margin-top:18px"><button class="btn btn-primary" type="submit" id="qfGo">Save quote request</button><button class="ea-btn" type="button" id="qfX">Cancel</button></div></form>';
    document.body.appendChild(m);
    var f = m.querySelector('form');
    function cust() { return enq(f.querySelector('#qfCust').value); }
    function sync() { var e = cust(); f.querySelector('#qfNew').hidden = !!e; var s = f.querySelector('#qfSlug'); if (!s.dataset.touched) s.value = slugFor(e ? e.firstName : f.querySelector('#qfFirst').value); f.querySelector('#qfSlugPrev').textContent = 'quotes.travelagentjake.co.uk/' + s.value; }
    f.querySelector('#qfCust').addEventListener('change', sync);
    f.querySelector('#qfFirst').addEventListener('input', sync);
    f.querySelector('#qfSlug').addEventListener('input', function () { this.dataset.touched = '1'; this.value = this.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); f.querySelector('#qfSlugPrev').textContent = 'quotes.travelagentjake.co.uk/' + this.value; });
    f.querySelector('#qfX').addEventListener('click', function () { m.remove(); });
    sync();
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var err = f.querySelector('#qfErr'); err.hidden = true;
      var e = cust();
      var files = Array.prototype.slice.call(f.querySelector('#qfFiles').files || [], 0, 10);
      var total = files.reduce(function (a, x) { return a + x.size; }, 0);
      if (total > 4.2 * 1024 * 1024) { err.textContent = 'Those files are a bit big. Please keep them under about 4MB in total.'; err.hidden = false; return; }
      if (!e && !f.querySelector('#qfFirst').value.trim()) { err.textContent = 'Pick a customer or add a first name.'; err.hidden = false; return; }
      var go = f.querySelector('#qfGo'); go.disabled = true; go.textContent = 'Saving...';
      Promise.all(files.map(function (file) { return new Promise(function (res) { var rd = new FileReader(); rd.onload = function () { res({ name: file.name, type: file.type, b64: String(rd.result).split(',')[1] || '' }); }; rd.onerror = function () { res(null); }; rd.readAsDataURL(file); }); }))
        .then(function (fs) {
          return api('/api/quote-admin', 'POST', {
            action: 'request-create', enquiryId: e ? e.id : '',
            customer: e ? { firstName: e.firstName, lastName: e.lastName } : { firstName: f.querySelector('#qfFirst').value, lastName: f.querySelector('#qfLast').value, phone: f.querySelector('#qfPhone').value, email: f.querySelector('#qfEmail').value, destination: f.querySelector('#qfDest').value },
            slug: f.querySelector('#qfSlug').value, title: f.querySelector('#qfTitle').value,
            urls: f.querySelector('#qfUrls').value.split(/\s*\n\s*/).filter(Boolean),
            notes: f.querySelector('#qfNotes').value, chatNotes: f.querySelector('#qfChat').value, files: fs.filter(Boolean)
          });
        }).then(function (x) {
          if (x.j && x.j.ok) {
            m.remove(); toast('Quote request saved');
            load().then(function () { tabs.querySelector('[data-tab="quotes"]').click(); copy(brief(x.j.request), 'Saved, and the brief is copied for Claude'); });
          } else { go.disabled = false; go.textContent = 'Save quote request'; err.textContent = (x.j && x.j.error) || 'Could not save. Please try again.'; err.hidden = false; }
        });
    });
  }

  /* ---------- Amend a published quote (no rebuild needed) ---------- */
  function mins(m) { if (!m) return ''; if (m < 60) return m + ' mins'; var h = Math.floor(m / 60), r = m % 60; return h + ' hr' + (r ? ' ' + r : ''); }
  function openAmend(slug) {
    Promise.all([
      fetch('https://taj-quotes.pages.dev/' + encodeURIComponent(slug) + '/?cb=' + Date.now()).then(function (r) { return r.text(); }),
      fetch('/api/quote-config?slug=' + encodeURIComponent(slug), { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return {}; })
    ]).then(function (res) {
      var Q; try { Q = JSON.parse(new DOMParser().parseFromString(res[0], 'text/html').getElementById('quote-data').textContent); } catch (e) { toast('Could not read that quote'); return; }
      var A = (res[1] && res[1].amendments) || {}; A.hidden = A.hidden || []; A.edits = A.edits || {};
      var PENDING = null;
      var m = document.createElement('div'); m.className = 'qd-modal';
      var rows = (Q.hotels || []).map(function (h) {
        var e = A.edits[h.id] || {};
        return '<div class="qd-card" style="box-shadow:none;margin:10px 0" data-hid="' + esc(h.id) + '" data-transfer="' + (h.transfer || 0) + '">'
          + '<label style="display:flex;gap:10px;align-items:center;margin:0;font-weight:800"><input type="checkbox" data-f="show" style="width:22px;height:22px"' + (A.hidden.indexOf(h.id) < 0 ? ' checked' : '') + '> ' + esc(h.name) + '</label>'
          + '<div class="qd-meta" style="margin:4px 0 0 32px">' + esc(h.area) + ' &#183; transfer ' + esc(mins(h.transfer)) + ' &#183; &#163;' + Number(h.total).toLocaleString('en-GB') + ' total</div>'
          + '<details style="margin:8px 0 0 32px"><summary style="cursor:pointer;font-weight:700;font-size:14px">Edit wording or price</summary>'
          + '<div class="qd-two"><div><label>Total price (&#163;)</label><input data-f="total" inputmode="numeric" placeholder="' + h.total + '" value="' + esc(e.total || '') + '"></div><div><label>Per person (&#163;)</label><input data-f="pp" inputmode="numeric" placeholder="' + h.pp + '" value="' + esc(e.pp || '') + '"></div></div>'
          + '<label>Tourist tax paid at the hotel (&#163;, whole party)</label><input data-f="tax" inputmode="numeric" placeholder="' + (h.tax != null ? h.tax : 'Leave blank to use the quote default') + '" value="' + esc(e.tax != null ? e.tax : '') + '">'
          + '<label>Badge on the photo</label><input data-f="badge" placeholder="' + esc(h.badge || '') + '" value="' + esc(e.badge || '') + '">'
          + '<label>Rooms</label><input data-f="rooms" placeholder="' + esc(h.rooms || '') + '" value="' + esc(e.rooms || '') + '">'
          + '<label>Why it was chosen</label><textarea data-f="why" placeholder="' + esc(h.why || '') + '">' + esc(e.why || '') + '</textarea>'
          + '<div class="qd-hint">Leave a box empty to keep the original.</div></details></div>';
      }).join('');
      m.innerHTML = '<form class="qd-form" novalidate><h3>Amend ' + esc(Q.customer || slug) + '\'s quote</h3><p class="qd-hint">Changes go live on quotes.travelagentjake.co.uk/' + esc(slug) + ' as soon as you save. Nothing needs rebuilding.</p>'
        + '<div class="qd-card" style="box-shadow:none;margin:12px 0;border-color:var(--blue)"><label for="amAI" style="margin-top:0;font-size:18px">Tell the AI what to change</label>'
        + '<textarea id="amAI" rows="4" placeholder="e.g. Take out the hotels with over an hour transfer, add a note saying I have done this, and add sea view upgrades at Tour Khalef for £12 per person per night."></textarea>'
        + '<div class="qd-act"><button type="button" class="btn btn-primary" data-q="ai">Make the changes</button></div>'
        + '<div id="amAIOut" hidden style="margin-top:12px"></div></div>'
        + '<details style="margin-top:14px"><summary style="cursor:pointer;font-weight:800">Or edit by hand</summary>'
        + '<div class="qd-act"><button type="button" class="ea-btn" data-q="hide60">Hide transfers over 1 hour</button><button type="button" class="ea-btn" data-q="showall">Show all hotels</button></div>'
        + rows
        + (function () {
            var ds = (Array.isArray(A.dates) ? A.dates : (Q.dates || []));
            if (!ds.length) return '';
            return '<div class="qd-small" style="margin-top:16px">Other dates and prices</div>' + ds.map(function (d) {
              return '<div class="qd-card" style="box-shadow:none;margin:8px 0;padding:12px" data-did="' + esc(d.id) + '" data-dlabel="' + esc(d.label) + '" data-dnote="' + esc(d.note || '') + '" data-dcur="' + (d.current ? 1 : 0) + '" data-dhotel="' + esc(d.hotel || '') + '">'
                + '<label style="display:flex;gap:10px;align-items:center;margin:0;font-weight:800"><input type="checkbox" data-f="dshow" style="width:22px;height:22px"' + (d.hidden ? '' : ' checked') + '> ' + esc(d.label) + (d.hotel ? ' &#183; ' + esc(((Q.hotels || []).filter(function (x) { return x.id === d.hotel; })[0] || {}).name || d.hotel) : '') + (d.current ? ' (quoted dates, uses the hotel price above)' : '') + '</label>'
                + '<div class="qd-two"><div><label>Total (&#163;)</label><input data-f="dtotal" inputmode="decimal" value="' + esc(d.total != null ? d.total : '') + '"></div><div><label>Per person (&#163;)</label><input data-f="dpp" inputmode="decimal" value="' + esc(d.pp != null ? d.pp : '') + '"></div></div></div>';
            }).join('');
          })()
        + '<label for="amNote">A note from Jake at the top of the quote (optional)</label><textarea id="amNote" placeholder="e.g. I have taken out the hotels with longer transfers as requested.">' + esc(A.note || '') + '</textarea>'
        + '<label for="amSub">Subtitle</label><input id="amSub" placeholder="' + esc(Q.subtitle || '') + '" value="' + esc(A.subtitle || '') + '">'
        + '<label for="amIntro">Intro paragraph</label><textarea id="amIntro" placeholder="' + esc(Q.intro || '') + '">' + esc(A.intro || '') + '</textarea>'
        + '<div class="qd-act" style="margin-top:14px"><button class="btn btn-primary" type="submit">Save hand edits</button></div></details>'
        + '<div id="amErr" style="color:#c2412d;font-weight:700;margin-top:12px" hidden></div>'
        + '<div class="qd-act" style="margin-top:18px"><a class="ea-btn" href="' + QUOTE_HOST + esc(slug) + '?jake=1" target="_blank" rel="noopener">View quote</a><button class="ea-btn" type="button" data-q="x">Close</button></div></form>';
      document.body.appendChild(m);
      var f = m.querySelector('form');
      m.addEventListener('click', function (ev) {
        var q = ev.target.closest('[data-q]'); if (!q) return;
        if (q.dataset.q === 'x') m.remove();
        if (q.dataset.q === 'ai') {
          var pr = f.querySelector('#amAI').value.trim(), out = f.querySelector('#amAIOut'); if (!pr) return;
          q.disabled = true; q.textContent = 'Working on it...'; out.hidden = true;
          api('/api/quote-ai', 'POST', { slug: slug, prompt: pr, quote: Q, amendments: A }).then(function (x) {
            q.disabled = false; q.textContent = 'Make the changes';
            if (!(x.j && x.j.ok)) { out.innerHTML = '<div style="color:#c2412d;font-weight:700">' + esc((x.j && x.j.error) || 'Something went wrong.') + '</div>'; out.hidden = false; return; }
            PENDING = x.j.amendments;
            out.innerHTML = '<div class="qd-pre" style="white-space:normal"><b>Ready to save:</b> ' + esc(x.j.summary) + '</div><div class="qd-act"><button type="button" class="btn btn-primary" data-q="aisave">Save and go live</button><button type="button" class="ea-btn" data-q="aino">Discard</button></div>';
            out.hidden = false;
          });
        }
        if (q.dataset.q === 'aino') { PENDING = null; f.querySelector('#amAIOut').hidden = true; }
        if (q.dataset.q === 'aisave' && PENDING) {
          api('/api/quote-config', 'POST', { slug: slug, amendments: PENDING }).then(function (x) {
            if (x.j && x.j.ok) { A = x.j.amendments; PENDING = null; f.querySelector('#amAI').value = ''; f.querySelector('#amAIOut').innerHTML = '<div class="qd-pre" style="white-space:normal"><b>Saved.</b> It is live now. <a href="' + QUOTE_HOST + esc(slug) + '?jake=1" target="_blank" rel="noopener">View quote</a>. Type another change, or close this window.</div>'; toast('Quote updated'); }
            else toast((x.j && x.j.error) || 'Could not save');
          });
        }
        if (q.dataset.q === 'hide60') Array.prototype.forEach.call(f.querySelectorAll('[data-hid]'), function (c) { if (Number(c.dataset.transfer) > 60) c.querySelector('[data-f="show"]').checked = false; });
        if (q.dataset.q === 'showall') Array.prototype.forEach.call(f.querySelectorAll('[data-f="show"]'), function (c) { c.checked = true; });
      });
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var hidden = [], edits = {};
        Array.prototype.forEach.call(f.querySelectorAll('[data-hid]'), function (c) {
          var id = c.dataset.hid; if (!c.querySelector('[data-f="show"]').checked) hidden.push(id);
          var e = {}; ['total', 'pp', 'tax', 'badge', 'rooms', 'why'].forEach(function (k) { var v = c.querySelector('[data-f="' + k + '"]').value.trim(); if (v) e[k] = k === 'total' || k === 'pp' || k === 'tax' ? v.replace(/[^\d.]/g, '') : v; });
          if (Object.keys(e).length) edits[id] = e;
        });
        var dcards = f.querySelectorAll('[data-did]'), newDates;
        if (dcards.length) newDates = Array.prototype.map.call(dcards, function (c) {
          var o = { id: c.dataset.did, label: c.dataset.dlabel, note: c.dataset.dnote, total: c.querySelector('[data-f="dtotal"]').value.replace(/[^\d.]/g, ''), pp: c.querySelector('[data-f="dpp"]').value.replace(/[^\d.]/g, '') };
          if (c.dataset.dcur === '1') o.current = true; if (c.dataset.dhotel) o.hotel = c.dataset.dhotel;
          if (!c.querySelector('[data-f="dshow"]').checked) o.hidden = true;
          return o;
        });
        if (hidden.length >= (Q.hotels || []).length) { var er = f.querySelector('#amErr'); er.textContent = 'Keep at least one hotel showing.'; er.hidden = false; return; }
        api('/api/quote-config', 'POST', { slug: slug, amendments: Object.assign({}, A, newDates ? { dates: newDates } : {}, { hidden: hidden, edits: edits, note: f.querySelector('#amNote').value, subtitle: f.querySelector('#amSub').value, intro: f.querySelector('#amIntro').value }) })
          .then(function (x) { if (x.j && x.j.ok) { toast('Quote updated'); m.remove(); } else { var er = f.querySelector('#amErr'); er.textContent = (x.j && x.j.error) || 'Could not save.'; er.hidden = false; } });
      });
    });
  }

  /* first load once the dashboard is unlocked, then keep in step with it */
  var tries = 0;
  (function wait() {
    if (key() && !app.hidden) {
      load().then(function () { var m = /#amend=([a-z0-9-]+)/.exec(location.hash); if (m) { tabs.querySelector('[data-tab="quotes"]').click(); openAmend(m[1]); history.replaceState(null, '', location.pathname); } });
      return;
    }
    if (tries++ < 600) setTimeout(wait, 1000);
  })();
  setInterval(function () { if (key() && !app.hidden && document.visibilityState === 'visible') load(); }, 60000);
  /* near realtime while the Quotes tab is open */
  setInterval(function () { if (key() && !app.hidden && S.tab === 'quotes' && document.visibilityState === 'visible' && !document.querySelector('.qd-modal')) load(); }, 20000);
  setInterval(function () { if (key() && !app.hidden && S.tab === 'enq' && document.visibilityState === 'visible' && !document.querySelector('[data-note-in]:focus')) load(); }, 60000);
})();
