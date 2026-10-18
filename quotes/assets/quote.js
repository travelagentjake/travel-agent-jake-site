/* Travel Agent Jake interactive quote renderer.
   Each quote page (quotes/<slug>/index.html) only holds a JSON data block (id="quote-data").
   This file turns that data into the full page, so new quotes only need new data, not new code.
   Data shape (all text fields are plain text, keep them free of dashes):
   {
     slug, customer, title, tag, subtitle, intro, heroImg, heroAlt, heroPos,
     facts: [[label, value]], partyLabel ("all 11"), whatsappName,
     compareIntro, hotelsIntro,
     hotels: [{ id, match, name, area, country, rating, reviews, transfer (minutes), slides (bool),
                badge, total, pp, tax (tourist tax paid at the hotel, £ for the party), taxNote, rooms, board, why, feats: [], site, imgs: [full image URLs], deposit }],
     extras: [{ id, cat, title, text, price (unit price), unit ("per person", "per car for 8 days"),
                units (defaults to partyCount for "per person", else 1), separate (bool: not part of the tour operator booking, so not in the direct debits),
                prices: { <hotel id>: total for the party } for prices that change by hotel (room upgrades, private transfers),
                hotels: [hotel ids it applies to] }], extrasIntro,
     Extras only show with a real live price. No price means it is left off the page. Extras never link out to other sellers.
     dates: [{ id, label, total, pp, note, current (bool) }], datesIntro   // other dates with their prices, editable from the dashboard
     extras may also have group: extras in the same group are either or (one villa upgrade at a time)
     touristTax: { amount, note }   // default tourist tax for every hotel; a hotel's own tax/taxNote wins. Required on every quote (CMA).
     sections: [{ id, title, intro, html, after: "hotels" | "trip" | "todo" }],   // custom sections from Jake's notes
     flights: { intro, legs: [{ tag, date, from, fromCode, to, toCode, dep, arr, dur, carrier }] },
     rooms: [], included: [],
     areas: [{ img, title, text }],
     areas: [{ img, title, text, alt, link (GetYourGuide page, affiliate code added automatically), linkLabel }],
     departDate (YYYY-MM-DD), depositTotal, partyCount   // used by the built in monthly payment calculator
     priceIntro, steps: [[title, text]], smallprint, prepared
   }
*/
(function () {
  var BASE = JSON.parse(document.getElementById('quote-data').textContent);
  var CONFIG_URL = 'https://travelagentjake.co.uk/api/quote-config?slug=';
  /* Jake's amendments (hidden hotels, edited wording or prices) are saved from the dashboard
     and applied on top of the page data, so changes need no rebuild. */
  function applyAmendments(Q, a) {
    if (!a) return Q;
    var hidden = a.hidden || [], edits = a.edits || {};
    Q.hotels = (Q.hotels || []).filter(function (h) { return hidden.indexOf(h.id) < 0; }).map(function (h) {
      var e = edits[h.id] || {}, o = {};
      for (var k in h) o[k] = h[k];
      ['why', 'badge', 'rooms'].forEach(function (k) { if (e[k]) o[k] = e[k]; });
      ['total', 'pp', 'tax'].forEach(function (k) { if (e[k] !== undefined && e[k] !== '' && !isNaN(Number(e[k]))) o[k] = Number(e[k]); });
      return o;
    });
    if (a.intro) Q.intro = a.intro;
    if (a.subtitle) Q.subtitle = a.subtitle;
    if (a.note) Q.jakeNote = a.note;
    if (Array.isArray(a.extras)) Q.extras = a.extras;
    if (Array.isArray(a.dates)) Q.dates = a.dates;
    if (a.datesIntro) Q.datesIntro = a.datesIntro;
    if (a.priceIntro) Q.priceIntro = a.priceIntro;
    if (a.extrasIntro) Q.extrasIntro = a.extrasIntro;
    if (a.touristTax && (a.touristTax.amount != null || a.touristTax.note)) Q.touristTax = a.touristTax;
    return Q;
  }
  var done = false;
  function go(a) { if (done) return; done = true; render(applyAmendments(BASE, a)); }
  setTimeout(function () { go(null); }, 2500);
  try {
    fetch(CONFIG_URL + encodeURIComponent(BASE.slug), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { go(j && j.amendments); }, function () { go(null); });
  } catch (e) { go(null); }

  function render(Q) {
  var WA = '447899290262';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function gbp(n) { n = Number(n); return '£' + (n % 1 ? n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toLocaleString('en-GB')); }
  function mins(m) { if (!m) return ''; if (m < 60) return m + ' mins'; var h = Math.floor(m / 60), r = m % 60; return h + ' hr' + (r ? ' ' + r : ''); }
  /* tourist tax payable locally at the hotel: always shown next to every price (CMA rules) */
  function taxText(x) {
    var d = Q.touristTax || {}, amt = x.tax != null && x.tax !== '' ? x.tax : d.amount, note = x.taxNote || d.note;
    return 'Plus ' + (amt ? 'about ' + gbp(amt) + ' ' : 'any ') + 'tourist tax, paid locally at the hotel' + (note ? ' (' + note + ')' : '') + '.';
  }
  function wa(text) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text); }
  function img(u, w) {
    if (/media\.jet2\.com/.test(u)) return u.split('?')[0] + '?wid=' + w + '&qlt=80&fmt=jpg';
    if (/images\.unsplash\.com/.test(u)) return u.split('?')[0] + '?w=' + w + '&q=78&auto=format&fit=crop';
    return u;
  }
  /* every GetYourGuide link always carries Jake's affiliate code */
  function gygLink(u) {
    try { var x = new URL(u); if (!/getyourguide\./.test(x.hostname)) return u; x.searchParams.set('partner_id', 'EFDILG1'); x.searchParams.set('utm_medium', 'online_publisher'); return x.toString(); } catch (e) { return u; }
  }
  function ordinal(n) { var r = n % 100; if (r >= 11 && r <= 13) return 'th'; return ['th', 'st', 'nd', 'rd'][n % 10] || 'th'; }
  /* Same rules as the calculator on travelagentjake.co.uk/my-booking.html:
     travel at least 18 weeks away, first payment more than 14 days away on the chosen day,
     weekends roll to the next working day, last payment before 6 weeks ahead of travel. */
  function ddPlan(balance, travelISO, prefDay) {
    var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var travel = new Date(travelISO + 'T00:00:00');
    function add(d, n) { var r = new Date(d.getTime()); r.setDate(r.getDate() + n); return r; }
    function between(a, b) { return Math.round((b - a) / 86400000); }
    function clamp(y, m, day) { var yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12; return new Date(yy, mm, Math.min(day, new Date(yy, mm + 1, 0).getDate())); }
    function work(d) { var r = new Date(d.getTime()); while (r.getDay() === 0 || r.getDay() === 6) r = add(r, 1); return r; }
    if (travel < add(today, 18 * 7)) return { ok: false };
    var due = add(travel, -42), off = 0, base = clamp(today.getFullYear(), today.getMonth(), prefDay);
    while (between(today, base) <= 14) { off++; base = clamp(today.getFullYear(), today.getMonth() + off, prefDay); }
    var rows = [], i = 0, d = work(base);
    while (d < due) { rows.push(d); i++; d = work(clamp(base.getFullYear(), base.getMonth() + i, prefDay)); }
    if (!rows.length) return { ok: false };
    var each = Math.floor(balance / rows.length * 100) / 100;
    return { ok: true, n: rows.length, each: each, last: Math.round((balance - each * (rows.length - 1)) * 100) / 100, first: rows[0], end: rows[rows.length - 1], rows: rows, due: due };
  }
  /* step text tokens: {balanceDue} = about 14 weeks before travel, {monthlyPlan} = live summary from the calculator */
  function stepText(t) {
    var out = esc(t);
    if (Q.departDate) { var bd = new Date(Q.departDate + 'T00:00:00'); bd.setDate(bd.getDate() - 98); out = out.replace('{balanceDue}', '<b>' + dmy(bd) + '</b>'); }
    return out.replace('{monthlyPlan}', '<b id="planLine">monthly payments</b>');
  }
  function dmy(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function money(n) { return '\u00a3' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function dots(r) { var s = ''; for (var i = 1; i <= 5; i++) s += '<i class="' + (r >= i ? '' : (r >= i - 0.5 ? 'h' : 'e')) + '"></i>'; return '<span class="dots" aria-hidden="true">' + s + '</span>'; }
  var who = Q.whatsappName || Q.customer;
  var party = Q.partyLabel || 'everyone';
  var hotels = Q.hotels || [];
  var multi = hotels.length > 1;
  var anySlides = hotels.some(function (h) { return h.slides; });

  function custom(after) {
    return (Q.sections || []).filter(function (s) { return (s.after || 'hotels') === after; }).map(function (s, i) {
      return '<section id="' + esc(s.id || ('extra-' + after + i)) + '"' + (s.alt ? ' class="alt"' : '') + '><div class="wrap"><h2 class="h2">' + esc(s.title) + '</h2>'
        + (s.intro ? '<p class="intro">' + esc(s.intro) + '</p>' : '') + '<div class="custom">' + (s.html || '') + '</div></div></section>';
    }).join('');
  }

  var nav = [];
  if (multi) nav.push(['compare', 'Compare']);
  if (hotels.length) nav.push(['hotels', multi ? 'The hotels' : 'Your hotel']);
  (Q.sections || []).forEach(function (s, i) { if (s.nav) nav.push([s.id || ('extra-' + (s.after || 'hotels') + i), s.nav]); });
  if (Q.flights) nav.push(['trip', 'Flights and rooms']);
  var dates = (Q.dates || []).filter(function (d) { return d && d.label && !d.hidden && d.total != null && d.total !== '' && !isNaN(Number(d.total)); });
  /* the quoted dates always show the hotel price, so amending the hotel price keeps them in step */
  if (hotels.length === 1) dates = dates.map(function (d) { if (!d.current) return d; var o = {}; for (var k in d) o[k] = d[k]; o.total = hotels[0].total; o.pp = hotels[0].pp; return o; });
  if (dates.length > 1) nav.push(['dates', 'Other dates']);
  if (Q.areas && Q.areas.length) nav.push(['todo', 'Things to do']);
  function hasPrice(e) { return (e.price !== '' && e.price != null && !isNaN(Number(e.price))) || (e.prices && Object.keys(e.prices).some(function (k) { return e.prices[k] != null && !isNaN(Number(e.prices[k])); })); }
  var hotelIds = hotels.map(function (x) { return x.id; });
  var extras = (Q.extras || []).filter(function (e) {
    if (!e || !e.title || !hasPrice(e)) return false;
    if (e.prices) return hotelIds.some(function (id) { return e.prices[id] != null; });
    return true;
  });
  if (extras.length) nav.push(['extras', 'Extras']);
  nav.push(['next', 'Prices and booking']);
  nav.push(['feedback', 'Send feedback']);

  var h = '';
  h += '<header class="top"><div class="wrap"><a href="https://travelagentjake.co.uk" aria-label="Travel Agent Jake home"><img src="https://travelagentjake.co.uk/images/logo.png" alt="Travel Agent Jake"></a>'
    + '<a class="btn btn-wa" href="' + wa('Hi Jake, it’s ' + who + '. I’ve had a look at my quote and ') + '" target="_blank" rel="noopener">WhatsApp Jake</a></div></header>';
  h += '<div class="hero"><img class="hero-img" src="' + esc(img(Q.heroImg, 2000)) + '" alt="' + esc(Q.heroAlt) + '"' + (Q.heroPos ? ' style="object-position:' + esc(Q.heroPos) + '"' : '') + '><div class="wrap"><div class="hero-card">'
    + '<span class="tag">' + esc(Q.tag || 'YOUR PERSONAL QUOTE') + '</span><h1>' + esc(Q.title) + '</h1><div class="sub">' + esc(Q.subtitle) + '</div>'
    + '<p class="lead">' + esc(Q.intro) + '</p><div class="facts">'
    + (Q.facts || []).map(function (f) { return '<div class="fact"><small>' + esc(f[0]) + '</small><b>' + esc(f[1]) + '</b></div>'; }).join('')
    + '</div>'
    /* Jake's sign off sits in the blue hero, under the summary boxes, so nobody misses it */
    + '<div class="note top"><h2>A personal note from Jake</h2><p>As an Independent Self Employed Travel Agent I really appreciate you giving me the opportunity to provide you with this quote. If you have any questions then please feel free to ask. We can of course tweak this where needed to make it suitable for you.</p>'
    + '<p>If you have seen something else then please do send it my way before going ahead and booking because as a self employed travel agent I work on commission only so booking with me helps support my small business &amp; family.</p>'
    + '<p>I look forward to helping you get your holiday booked.</p><p style="margin:0">Kind regards</p><div class="sig">Jake</div></div>'
    + '</div></div></div>';
  if (Q.jakeNote) h += '<div class="wrap"><div class="jnote"><b>A note from Jake</b><p>' + esc(Q.jakeNote) + '</p></div></div>';
  h += '<nav class="snav" aria-label="Quote sections"><div class="wrap">' + nav.map(function (n) { return '<a href="#' + n[0] + '">' + esc(n[1]) + '</a>'; }).join('') + '</div></nav>';

  if (multi) {
    h += '<section id="compare"><div class="wrap"><h2 class="h2">Your ' + (hotels.length === 2 ? 'two' : hotels.length === 3 ? 'three' : hotels.length === 4 ? 'four' : hotels.length === 5 ? 'five' : hotels.length === 6 ? 'six' : hotels.length) + ' hotels at a glance</h2>'
      + (Q.compareIntro ? '<p class="intro">' + esc(Q.compareIntro) + '</p>' : '')
      + '<div class="ctrl" role="group" aria-label="Sort hotels"><span>Sort by</span>'
      + '<button class="chipbtn" type="button" data-sort="match" aria-pressed="true">Best match</button>'
      + '<button class="chipbtn" type="button" data-sort="price" aria-pressed="false">Lowest price</button>'
      + '<button class="chipbtn" type="button" data-sort="rating" aria-pressed="false">Top rated</button>'
      + '<button class="chipbtn" type="button" data-sort="transfer" aria-pressed="false">Shortest transfer</button>'
      + (anySlides ? '<button class="chipbtn" type="button" id="slidesOnly" aria-pressed="false">Slides only</button>' : '')
      + '</div><div class="tablebox"><table><thead><tr><th>Hotel</th><th>Resort</th><th>Tripadvisor</th><th>Transfer</th>' + (anySlides ? '<th>Slides</th>' : '') + '<th class="n">Total for ' + esc(party.replace(/^all /, '')) + '</th><th class="n">Per person</th></tr></thead><tbody id="ctable"></tbody></table></div><div class="cmob" id="cmob"></div><p class="taxnote">' + esc(Q.touristTax && Q.touristTax.amount ? 'Prices do not include tourist tax of about ' + gbp(Q.touristTax.amount) + ', paid locally at the hotel.' : 'Prices do not include any tourist tax, paid locally at the hotel.') + '</p></div></section>';
  }
  if (hotels.length) {
    h += '<section id="hotels" class="alt"><div class="wrap"><h2 class="h2">' + (multi ? 'The hotels' : 'Your hotel') + '</h2>'
      + '<p class="intro">' + esc(Q.hotelsIntro || 'Swipe or tap the arrows to browse the photos, and tap any photo to see it full screen.') + '</p><div class="hotels" id="hotelList"></div></div></section>';
  }
  h += custom('hotels');

  if (Q.flights) {
    var F = Q.flights;
    h += '<section id="trip"><div class="wrap"><h2 class="h2">Flights and rooms</h2>' + (F.intro ? '<p class="intro">' + esc(F.intro) + '</p>' : '') + '<div class="trip">';
    (F.legs || []).forEach(function (l) {
      h += '<div class="flight"><div class="top2"><span class="tg">' + esc(l.tag) + '</span><span class="ft">' + esc(l.date) + '</span></div>'
        + '<div class="rt"><div><div class="cd">' + esc(l.fromCode) + '</div><div class="tm">' + esc(l.dep) + '</div></div>'
        + '<svg width="80" height="20" viewBox="0 0 80 20" aria-hidden="true"><line x1="2" y1="10" x2="60" y2="10" stroke="#99ACFF" stroke-width="2" stroke-dasharray="4 4"></line><path d="M64 4l12 6-12 6 2-6z" fill="#FFD21F"></path></svg>'
        + '<div style="text-align:right"><div class="cd">' + esc(l.toCode) + '</div><div class="tm">' + esc(l.arr) + '</div></div></div>'
        + '<div class="ft">' + esc(l.from) + ' to ' + esc(l.to) + (l.dur ? ' &#183; ' + esc(l.dur) : '') + (l.carrier ? ' &#183; ' + esc(l.carrier) : '') + '</div></div>';
    });
    if (Q.rooms && Q.rooms.length) h += '<div class="box"><h3>Your rooms</h3><ul>' + Q.rooms.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';
    if (Q.included && Q.included.length) h += '<div class="box"><h3>Included for everyone</h3><ul>' + Q.included.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';
    h += '</div></div></section>';
  }
  h += custom('trip');

  /* other dates: same holiday on different dates, with live prices Jake can amend */
  if (dates.length > 1) {
    var cur = dates.filter(function (d) { return d.current; })[0];
    h += '<section id="dates" class="alt"><div class="wrap"><h2 class="h2">Other dates</h2>' + (Q.datesIntro ? '<p class="intro">' + esc(Q.datesIntro) + '</p>' : '')
      + '<div class="acar dcar"><button class="arr l" type="button" data-ddir="-1" aria-label="Previous">&#8249;</button><button class="arr r" type="button" data-ddir="1" aria-label="Next">&#8250;</button><div class="areas" id="dTrack">'
      + dates.map(function (d) {
        var diff = cur && !d.current ? Number(d.total) - Number(cur.total) : 0;
        return '<div class="dcard' + (d.current ? ' on' : '') + '">' + (d.current ? '<span class="dtag">Your quote</span>' : '')
          + '<b class="dl">' + esc(d.label) + '</b>' + (d.note ? '<span class="dn">' + esc(d.note) + '</span>' : '')
          + '<span class="dp">' + gbp(d.total) + '</span><span class="dpp">' + (d.pp ? gbp(d.pp) + ' per person' : 'total for ' + esc(party)) + '</span>'
          + (diff ? '<span class="dd ' + (diff > 0 ? 'up' : 'down') + '">' + gbp(Math.abs(diff)) + (diff > 0 ? ' more' : ' less') + '</span>' : '')
          + (d.current ? '' : '<a class="btn btn-o dbtn" target="_blank" rel="noopener" href="' + wa('Hi Jake, it’s ' + who + '. Could you look at ' + d.label + ' for our holiday? ') + '">Ask about these dates</a>') + '</div>';
      }).join('') + '</div></div></div></section>';
  }

  if (Q.areas && Q.areas.length) {
    h += '<section id="todo" class="alt"><div class="wrap"><h2 class="h2">Things to do</h2>' + (Q.todoIntro ? '<p class="intro">' + esc(Q.todoIntro) + '</p>' : '');
    h += '<div class="acar"><button class="arr l" type="button" data-adir="-1" aria-label="Previous">&#8249;</button><button class="arr r" type="button" data-adir="1" aria-label="Next">&#8250;</button><div class="areas" id="areaTrack">' + Q.areas.map(function (a) {
      var inner = '<img loading="lazy" src="' + esc(img(a.img, 800)) + '" alt="' + esc(a.alt || a.title) + '"><div><b>' + esc(a.title) + '</b><p>' + esc(a.text) + '</p>' + (a.link ? '<span class="see">' + esc(a.linkLabel || 'See tours and prices') + '</span>' : '') + '</div>';
      return a.link ? '<a class="areacard" href="' + esc(gygLink(a.link)) + '" target="_blank" rel="noopener sponsored">' + inner + '</a>' : '<div class="areacard">' + inner + '</div>';
    }).join('') + '</div></div>';
    h += '</div></section>';
  }
  h += custom('todo');

  /* optional extras: parking, lounges, fast track, seats, upgrades, transfers. Ticked ones feed the full cost box */
  var SKEY = 'tajx-' + Q.slug, sel = {};
  try { sel = JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { sel = {}; }
  function fmt(n) { return Number(n) % 1 ? money(n) : gbp(n); }
  function xUnits(e) { return e.units ? Number(e.units) : (/per person/i.test(e.unit || '') && Number(Q.partyCount) ? Number(Q.partyCount) : 1); }
  function xTotal(e, x) {
    if (e.prices) { x = x || curHotel(); var v = x && e.prices[x.id]; return v == null || isNaN(Number(v)) ? null : Number(v); }
    return e.price === '' || e.price == null || isNaN(Number(e.price)) ? null : Math.round(Number(e.price) * xUnits(e) * 100) / 100;
  }
  function fits(e, x) { if (!x) return true; if (e.prices) return e.prices[x.id] != null; return !e.hotels || !e.hotels.length || e.hotels.indexOf(x.id) >= 0; }
  function xFor(x) { return extras.filter(function (e) { return sel[e.id] && fits(e, x); }); }
  var hIdx = 0;  /* the hotel picked in the full cost box or the calculator, kept in step */
  function curHotel() { return hotels[hIdx] || hotels[0]; }
  function paidToday(x) { return xFor(x).reduce(function (a, e) { var t = xTotal(e, x); return a + (t != null && e.separate ? t : 0); }, 0); }
  function xPriceLine(e) {
    if (e.prices) {
      var x = curHotel(), v = x ? e.prices[x.id] : null;
      if (v == null) return 'Not available with ' + esc(x ? x.name : 'this hotel');
      return fmt(v) + (e.unit ? ' ' + esc(e.unit) : '') + (multi ? ' <span class="xwith">with ' + esc(x.name) + '</span>' : '');
    }
    var t = xTotal(e), u = xUnits(e);
    return fmt(e.price) + (e.unit ? ' ' + esc(e.unit) : '') + (u > 1 ? ' &#183; ' + fmt(t) + ' for ' + esc(party) : '');
  }
  function hotelName(id) { var f = hotels.filter(function (x) { return x.id === id; })[0]; return f ? f.name : ''; }
  if (extras.length) {
    var cats = []; extras.forEach(function (e) { var c = e.cat || 'Extras'; if (cats.indexOf(c) < 0) cats.push(c); });
    h += '<section id="extras"><div class="wrap"><h2 class="h2">Add extras</h2><p class="intro">' + esc(Q.extrasIntro || 'Tick anything you would like and it is added to your full holiday cost further down, so you can see exactly what the whole holiday will cost.') + '</p>'
      + '<div class="acar xcar"><button class="arr l" type="button" data-xdir="-1" aria-label="Previous">&#8249;</button><button class="arr r" type="button" data-xdir="1" aria-label="Next">&#8250;</button><div class="areas" id="xTrack">'
      + extras.map(function (e) {
          var hs = (e.hotels || []).map(hotelName).filter(Boolean);
          return '<label class="xcard"><input type="checkbox" data-x="' + esc(e.id) + '"' + (sel[e.id] ? ' checked' : '') + '><span class="xbody"><span class="xcat">' + esc(e.cat || 'Extras') + '</span><b>' + esc(e.title) + '</b>'
            + (e.text ? '<span class="xt">' + esc(e.text) + '</span>' : '')
            + (hs.length && multi ? '<span class="xh">With ' + esc(hs.join(' or ')) + '</span>' : '')
            + '<span class="xp" data-xp="' + esc(e.id) + '">' + xPriceLine(e) + '</span>' + (e.separate ? '<span class="xh">Paid in full when you book</span>' : '<span class="xh">Added to your holiday balance</span>')
            + '</span></label>';
        }).join('') + '</div></div>'
      + '<div class="xsum" id="xSum"></div></div></section>';
  }

  h += '<section id="next"><div class="wrap"><h2 class="h2">Prices and booking</h2>' + (Q.priceIntro ? '<p class="intro">' + esc(Q.priceIntro) + '</p>' : '')
    + '<div class="pay">' + (Q.steps || []).map(function (s, i) { return '<div class="step"><div class="sn">' + (i + 1) + '</div><h3>' + esc(s[0]) + '</h3><p>' + stepText(s[1]) + '</p></div>'; }).join('') + '</div>'
    + '<p style="margin:22px 0 0;display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-wa" href="' + wa('Hi Jake, it’s ' + who + '. We’d like to go ahead with ') + '" target="_blank" rel="noopener">WhatsApp me to book</a>'
    + '</p>'
    + (hotels.length ? '<div class="full" id="fullCost"></div>' : '')
    + (Q.departDate && hotels.length ? '<div class="calc" id="calc"><h3>Your monthly payments</h3><p class="intro" style="margin:4px 0 16px">Pick a hotel and the day of the month that suits you, and see how the balance could be spread by direct debit.</p>'
      + '<div class="calcgrid">' + (multi ? '<div><label class="fbl" for="cHotel">Hotel</label><select id="cHotel">' + hotels.map(function (x, i) { return '<option value="' + i + '">' + esc(x.name) + ' (' + gbp(x.total) + ')</option>'; }).join('') + '</select></div>' : '')
      + '<div><label class="fbl" for="cDay">Payment day each month</label><select id="cDay">' + Array.apply(null, Array(28)).map(function (_, i) { var d = i + 1; return '<option value="' + d + '"' + (d === 1 ? ' selected' : '') + '>' + d + ordinal(d) + '</option>'; }).join('') + '</select></div></div>'
      + '<div id="cOut"></div></div>' : '')
    + '<div class="fb" id="feedback"><h3>Send your feedback to Jake</h3><p class="intro" style="margin:4px 0 14px">Tell me what you think and it opens WhatsApp with your message ready to send.</p>'
    + '<div class="fbopts" role="radiogroup" aria-label="What would you like to do?">'
    + [['book', 'We would like to book'], ['changes', 'We would like some changes'], ['question', 'I have a question']].map(function (o, i) { return '<label class="fbopt"><input type="radio" name="fbType" value="' + o[0] + '"' + (i === 0 ? ' checked' : '') + '><span>' + o[1] + '</span></label>'; }).join('')
    + '</div>'
    + (hotels.length ? '<label class="fbl" for="fbHotel">' + (multi ? 'Your favourite hotel' : 'Hotel') + '</label><select id="fbHotel"><option value="">' + (multi ? 'Not decided yet' : esc(hotels[0].name)) + '</option>' + (multi ? hotels.map(function (x) { return '<option>' + esc(x.name) + '</option>'; }).join('') : '') + '</select>' : '')
    + '<label class="fbl" for="fbMsg">Your message</label><textarea id="fbMsg" rows="4" placeholder="e.g. We love Tour Khalef, could we add sea view rooms?"></textarea>'
    + '<button class="btn btn-wa" type="button" id="fbSend" style="margin-top:14px">Send to Jake on WhatsApp</button></div>'

    + '<p class="small" style="margin-top:20px">' + esc(Q.smallprint || ('Prices were correct when this quote was prepared on ' + Q.prepared + ' and are subject to availability until booked. Your holiday is ATOL protected.')) + '</p></div></section>';
  h += '<footer><div class="wrap"><p>Travel Agent Jake is part of Club Voyages, a Member of ABTA, membership number P8503 &amp; Y6784. Travel Agent Jake is part of Club Voyages Ltd, which is as an agent for Hays Tour Operating Ltd, ATOL 10531. All the flights and flight inclusive holidays on this website are financially protected by the ATOL scheme. Please see our <a href="https://travelagentjake.co.uk/booking-conditions.html">booking conditions</a> for more information.</p><p>&copy; ' + new Date().getFullYear() + ' Travel Agent Jake &#183; <a href="https://travelagentjake.co.uk">travelagentjake.co.uk</a></p></div></footer>';
  h += '<a class="btn btn-wa float" id="fbFloat" href="#feedback">Send feedback to Jake</a>';
  h += '<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Photo viewer"><button class="x" type="button" id="lbX" aria-label="Close">&#215;</button><button class="arr l" type="button" id="lbP" aria-label="Previous photo">&#8249;</button><img id="lbImg" alt=""><button class="arr r" type="button" id="lbN" aria-label="Next photo">&#8250;</button><div class="cap" id="lbCap"></div></div>';
  var isJake = false; try { if (new URLSearchParams(location.search).has('jake')) localStorage.setItem('taj-jake', '1'); isJake = localStorage.getItem('taj-jake') === '1'; } catch (e) {}
  if (isJake) h = h.replace('id="fbFloat"', 'id="fbFloat" hidden');
  if (isJake) h += '<a class="btn btn-y amend" href="https://travelagentjake.co.uk/enquiries-admin.html#amend=' + encodeURIComponent(Q.slug) + '" target="_blank" rel="noopener">Amend this quote</a>';
  document.getElementById('app').innerHTML = h;
  var deposit = Number(Q.depositTotal || 0), people = Number(Q.partyCount || 0);
  function taxOf(x) { var d = Q.touristTax || {}; return x.tax != null && x.tax !== '' ? Number(x.tax) : (d.amount ? Number(d.amount) : null); }
  function inBooking(x) { return xFor(x).reduce(function (a, e) { var t = xTotal(e, x); return a + (t != null && !e.separate ? t : 0); }, 0); }
  function full() {
    var el = document.getElementById('fullCost'); if (!el || !hotels.length) return;
    var x = curHotel(), list = xFor(x), tax = taxOf(x), sum = x.total, pending = 0;
    var rows = '<tr><td>' + esc(x.name) + ', ' + esc(party) + '</td><td class="n">' + gbp(x.total) + '</td></tr>';
    list.forEach(function (e) { var t = xTotal(e, x); if (t == null) return; sum += t; rows += '<tr><td>' + esc(e.title) + '</td><td class="n">' + fmt(t) + '</td></tr>'; });
    if (tax != null) sum += tax;
    rows += '<tr><td>Tourist tax, paid locally at the hotel</td><td class="n">' + (tax != null ? 'about ' + gbp(tax) : 'To confirm') + '</td></tr>';
    var today = paidToday(x);
    el.innerHTML = '<h3>Your full holiday cost</h3>'
      + (multi ? '<label class="fbl" for="fHotel">Hotel</label><select id="fHotel" class="fsel">' + hotels.map(function (h, i) { return '<option value="' + i + '"' + (i === hIdx ? ' selected' : '') + '>' + esc(h.name) + ' (' + gbp(h.total) + ')</option>'; }).join('') + '</select>' : '')
      + '<table><tbody>' + rows + '</tbody><tfoot><tr><td>Total</td><td class="n">' + fmt(Math.round(sum * 100) / 100) + '</td></tr>'
      + (people > 1 ? '<tr class="pp"><td>About per person</td><td class="n">' + money(sum / people) + '</td></tr>' : '') + '</tfoot></table>'
      + (deposit || today ? '<div class="today"><b>To pay today: ' + fmt(Math.round((deposit + today) * 100) / 100) + '</b><span>' + (deposit ? gbp(deposit) + ' deposit' : '') + (today ? (deposit ? ' plus ' : '') + fmt(Math.round(today * 100) / 100) + ' for your airport extras, which are paid in full when you book' : '') + '. ' + (Q.departDate ? 'The rest of the holiday is the balance, spread in the calculator below.' : '') + '</span></div>' : '')
      + (extras.length ? '<p class="small" style="margin:10px 0 0">' + (list.length ? 'Change your extras in <a href="#extras">Add extras</a>.' : 'Nothing extra added yet. Have a look at <a href="#extras">parking, fast track, room upgrades and more</a>.') + (multi ? '' : '') + '</p>' : '');
    var xs = document.getElementById('xSum');
    Array.prototype.forEach.call(document.querySelectorAll('[data-xp]'), function (el) { var e = extras.filter(function (z) { return z.id === el.dataset.xp; })[0]; if (e && e.prices) el.innerHTML = xPriceLine(e); });
    if (xs) { var all = xFor(x), tot = all.reduce(function (a, e) { var t = xTotal(e, x); return a + (t || 0); }, 0); xs.innerHTML = all.length ? '<b>' + all.length + ' extra' + (all.length > 1 ? 's' : '') + ' added' + (tot ? ', ' + fmt(Math.round(tot * 100) / 100) : '') + '</b><a class="btn btn-y" href="#fullCost">See your full holiday cost</a>' : ''; }
  }
  function calc() {
    full();
    var out = document.getElementById('cOut'); if (!out || !Q.departDate) return;
    var x = curHotel(), extra = inBooking(x);
    var day = Number(document.getElementById('cDay').value), bal = Math.max(0, x.total + extra - deposit);
    var p = ddPlan(bal, Q.departDate, day);
    if (!p.ok) { out.innerHTML = '<p class="intro">Your holiday is too close for monthly payments, but I can send you a secure payment link instead.</p>'; return; }
    var pl = document.getElementById('planLine'); if (pl) pl.textContent = (multi ? 'for ' + x.name + ', ' : '') + p.n + ' monthly payments of ' + money(p.each) + ' with the final payment on ' + dmy(p.end);
    out.innerHTML = '<div class="tiles">'
      + '<div class="tile"><small>Paid today</small><b>' + fmt(Math.round((deposit + paidToday(x)) * 100) / 100) + '</b>' + (paidToday(x) ? '<span>' + gbp(deposit) + ' deposit plus ' + fmt(Math.round(paidToday(x) * 100) / 100) + ' airport extras</span>' : '') + '</div>'
      + '<div class="tile hi"><small>Then each month</small><b>' + money(p.each) + '</b>' + (people > 1 ? '<span>about ' + money(p.each / people) + ' per person</span>' : '') + '</div>'
      + '<div class="tile"><small>Number of payments</small><b>' + p.n + '</b><span>' + dmy(p.first) + ' to ' + dmy(p.end) + '</span></div></div>'
      + '<details class="sched"><summary>See every payment date</summary><table><tbody>'
      + p.rows.map(function (d, i) { return '<tr><td>Payment ' + (i + 1) + '</td><td>' + dmy(d) + '</td><td class="n">' + money(i === p.n - 1 ? p.last : p.each) + '</td></tr>'; }).join('')
      + '</tbody></table></details>'
      + '<p class="small" style="margin:12px 0 0">Based on ' + esc(x.name) + ' at ' + gbp(x.total) + ' for ' + esc(party) + (extra ? ' plus ' + fmt(Math.round(extra * 100) / 100) + ' of extras added to the booking' : '') + ', with a ' + gbp(deposit) + ' deposit and the balance cleared 6 weeks before you fly. This is an estimate to help you budget, and I confirm the exact plan when you book. Payments falling on a weekend move to the next working day.</p>';
  }
  /* carousel arrows: things to do, extras and other dates */
  Array.prototype.forEach.call(document.querySelectorAll('[data-adir],[data-xdir],[data-ddir]'), function (b) {
    b.addEventListener('click', function () {
      var dir = Number(b.dataset.adir || b.dataset.xdir || b.dataset.ddir) || 1;
      var t = b.parentElement.querySelector('.areas'), c = t && t.firstElementChild;
      if (t) t.scrollBy({ left: dir * ((c ? c.offsetWidth : 280) + 14), behavior: 'smooth' });
    });
  });
  /* other dates: open with the quoted dates in view */
  (function () { var t = document.getElementById('dTrack'), on = t && t.querySelector('.dcard.on'); if (on && on.previousElementSibling) t.scrollLeft = on.previousElementSibling.offsetLeft - t.firstElementChild.offsetLeft; })();
  var cH = document.getElementById('cHotel');
  if (cH) cH.addEventListener('change', function () { hIdx = Number(cH.value) || 0; calc(); });
  var cD = document.getElementById('cDay'); if (cD) cD.addEventListener('change', calc);
  var fc = document.getElementById('fullCost');
  if (fc) fc.addEventListener('change', function (ev) { if (ev.target.id !== 'fHotel') return; hIdx = Number(ev.target.value) || 0; if (cH) cH.value = hIdx; calc(); });
  calc();
  Array.prototype.forEach.call(document.querySelectorAll('[data-x]'), function (c) {
    c.addEventListener('change', function () {
      var me = extras.filter(function (z) { return z.id === c.dataset.x; })[0];
      if (c.checked && me && me.group) extras.forEach(function (z) { if (z.group === me.group && z.id !== me.id) { delete sel[z.id]; var o = document.querySelector('[data-x="' + z.id + '"]'); if (o) o.checked = false; } });
      if (c.checked) sel[c.dataset.x] = 1; else delete sel[c.dataset.x]; try { localStorage.setItem(SKEY, JSON.stringify(sel)); } catch (e) {} calc(); });
  });
  var fbBtn = document.getElementById('fbSend');
  if (fbBtn) fbBtn.addEventListener('click', function () {
    var t = (document.querySelector('input[name="fbType"]:checked') || {}).value || 'question';
    var hs = document.getElementById('fbHotel'), hotel = hs ? (hs.value || (multi ? '' : hotels[0].name)) : '';
    var msg = document.getElementById('fbMsg').value.trim();
    var head = { book: 'we would like to book!', changes: 'we would like some changes to our quote.', question: 'I have a question about our quote.' }[t];
    var text = 'Hi Jake, it\u2019s ' + who + ' (quote: quotes.travelagentjake.co.uk/' + Q.slug + '). ' + head
      + (hotel ? '\nHotel: ' + hotel : '') + (xFor(null).length ? '\nExtras: ' + xFor(null).map(function (e) { return e.title; }).join(', ') : '') + (msg ? '\n\n' + msg : '');
    window.open(wa(text), '_blank', 'noopener');
  });
  Array.prototype.forEach.call(document.querySelectorAll('#app a[href*="getyourguide."]'), function (a) { a.href = gygLink(a.href); a.rel = 'noopener sponsored'; a.target = '_blank'; });

  /* hotels, table, sorting */
  var sortKey = 'match', slidesOnly = false;
  function ordered() {
    var list = hotels.slice();
    list.sort(function (a, b) {
      if (sortKey === 'price') return a.total - b.total;
      if (sortKey === 'rating') return b.rating - a.rating || a.total - b.total;
      if (sortKey === 'transfer') return a.transfer - b.transfer;
      return (a.match || 0) - (b.match || 0);
    });
    return slidesOnly ? list.filter(function (x) { return x.slides; }) : list;
  }
  function renderTable() {
    var t = document.getElementById('ctable'); if (!t) return;
    t.innerHTML = ordered().map(function (x) {
      return '<tr><td><a href="#h-' + esc(x.id) + '">' + esc(x.name) + '</a></td><td>' + esc(x.area) + '</td><td><span class="stars">' + (x.rating ? x.rating.toFixed(1) : '') + '</span>' + (x.rating ? ' / 5' : '') + '</td><td>' + mins(x.transfer) + '</td>'
        + (anySlides ? '<td>' + (x.slides ? '<span class="yes">Yes</span>' : '<span class="no">No</span>') + '</td>' : '') + '<td class="n"><b>' + gbp(x.total) + '</b></td><td class="n">' + gbp(x.pp) + '</td></tr>';
    }).join('');
    /* phones get a stacked list instead of the wide table */
    var m = document.getElementById('cmob'); if (m) m.innerHTML = ordered().map(function (x) {
      return '<a class="crow" href="#h-' + esc(x.id) + '"><span class="cn"><b>' + esc(x.name) + '</b><span>' + esc(x.area)
        + (x.rating ? ' &#183; ' + x.rating.toFixed(1) + '/5' : '') + (x.transfer ? ' &#183; ' + mins(x.transfer) + ' transfer' : '') + (anySlides && x.slides ? ' &#183; Slides' : '') + '</span></span>'
        + '<span class="cp"><b>' + gbp(x.total) + '</b>' + (x.pp ? '<span>' + gbp(x.pp) + 'pp</span>' : '') + '</span></a>';
    }).join('');
  }
  function renderHotels() {
    var el = document.getElementById('hotelList'); if (!el) return;
    el.innerHTML = ordered().map(function (x) {
      var slides = (x.imgs || []).map(function (u, i) { return '<img loading="' + (i ? 'lazy' : 'eager') + '" src="' + esc(img(u, 1000)) + '" srcset="' + esc(img(u, 700)) + ' 700w, ' + esc(img(u, 1000)) + ' 1000w, ' + esc(img(u, 1400)) + ' 1400w" sizes="(max-width:900px) 100vw, 600px" alt="' + esc(x.name) + ' photo ' + (i + 1) + '" data-h="' + esc(x.id) + '" data-i="' + i + '">'; }).join('');
      return '<article class="hotel" id="h-' + esc(x.id) + '"><div class="hotel-grid"><div class="slider"><div class="track">' + slides + '</div>'
        + (x.badge ? '<span class="badge">' + esc(x.badge) + '</span>' : '')
        + '<button class="arr l" type="button" aria-label="Previous photo" data-dir="-1">&#8249;</button><button class="arr r" type="button" aria-label="Next photo" data-dir="1">&#8250;</button>'
        + '<button class="zoom" type="button" data-zoom="' + esc(x.id) + '">View full screen</button><span class="count">1 / ' + (x.imgs || []).length + '</span></div>'
        + '<div class="hb"><div class="area">' + esc(x.area) + (x.country ? ', ' + esc(x.country) : '') + '</div><h3>' + esc(x.name) + '</h3>'
        + (x.rating ? '<div class="rating">' + dots(x.rating) + '<span><b>' + x.rating.toFixed(1) + '</b> on Tripadvisor' + (x.reviews ? ', ' + esc(x.reviews) + ' reviews' : '') + '</span></div>' : '')
        + '<p>' + esc(x.why) + '</p>'
        + '<div class="feat">' + (x.feats || []).map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + (x.transfer ? '<span>Transfer ' + mins(x.transfer) + '</span>' : '') + '</div>'
        + (x.rooms ? '<p class="rooms"><b>Your rooms:</b> ' + esc(x.rooms) + (x.board ? ', ' + esc(x.board) : '') + '</p>' : '')
        + '<div class="price"><div><small>TOTAL FOR ' + esc(party.toUpperCase()) + '</small><div class="big">' + gbp(x.total) + '</div></div><div class="r">' + (x.pp ? gbp(x.pp) + ' per person<br>' : '') + esc(x.deposit || '') + (function () { if (!Q.departDate) return ''; var mp = ddPlan(Math.max(0, x.total - Number(Q.depositTotal || 0)), Q.departDate, 1); return mp.ok ? '<br><a href="#calc" class="monthly">or about ' + money(mp.each) + ' a month</a>' : ''; })() + '</div><p class="tax">' + esc(taxText(x)) + '</p></div>'
        + '<div class="links"><a class="btn btn-wa" target="_blank" rel="noopener" href="' + wa('Hi Jake, it’s ' + who + '. We love the ' + x.name + '! ') + '">I like this one</a>'
        + (x.site ? '<a class="btn btn-o" target="_blank" rel="noopener" href="' + esc(x.site) + '">Hotel website</a>' : '') + '</div></div></div></article>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('.slider'), function (s) {
      var track = s.querySelector('.track'), count = s.querySelector('.count'), n = track.children.length;
      function idx() { return Math.round(track.scrollLeft / track.clientWidth); }
      track.addEventListener('scroll', function () { count.textContent = (idx() + 1) + ' / ' + n; }, { passive: true });
      Array.prototype.forEach.call(s.querySelectorAll('.arr'), function (b) {
        b.addEventListener('click', function () { var i = (idx() + Number(b.dataset.dir) + n) % n; track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }); });
      });
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-sort]'), function (b) {
    b.addEventListener('click', function () { sortKey = b.dataset.sort; Array.prototype.forEach.call(document.querySelectorAll('[data-sort]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); renderTable(); renderHotels(); });
  });
  var so = document.getElementById('slidesOnly');
  if (so) so.addEventListener('click', function () { slidesOnly = !slidesOnly; so.setAttribute('aria-pressed', String(slidesOnly)); renderTable(); renderHotels(); });
  renderTable(); renderHotels();

  /* lightbox */
  var lbH = null, lbI = 0;
  function hotel(id) { for (var i = 0; i < hotels.length; i++) if (hotels[i].id === id) return hotels[i]; }
  function lbShow() { var x = hotel(lbH); var im = document.getElementById('lbImg'); im.src = img(x.imgs[lbI], 1800); im.alt = x.name + ' photo ' + (lbI + 1); document.getElementById('lbCap').textContent = x.name + '  ' + (lbI + 1) + ' / ' + x.imgs.length; }
  function lbOpen(id, i) { lbH = id; lbI = i || 0; lbShow(); document.getElementById('lb').classList.add('on'); document.body.style.overflow = 'hidden'; }
  function lbClose() { document.getElementById('lb').classList.remove('on'); document.body.style.overflow = ''; }
  function lbStep(d) { var n = hotel(lbH).imgs.length; lbI = (lbI + d + n) % n; lbShow(); }
  var list = document.getElementById('hotelList');
  if (list) list.addEventListener('click', function (e) {
    var z = e.target.closest('[data-zoom]'); if (z) { var tr = z.parentNode.querySelector('.track'); lbOpen(z.dataset.zoom, Math.round(tr.scrollLeft / tr.clientWidth)); return; }
    var im = e.target.closest('.track img'); if (im) lbOpen(im.dataset.h, Number(im.dataset.i));
  });
  document.getElementById('lbX').addEventListener('click', lbClose);
  document.getElementById('lbP').addEventListener('click', function () { lbStep(-1); });
  document.getElementById('lbN').addEventListener('click', function () { lbStep(1); });
  document.getElementById('lb').addEventListener('click', function (e) { if (e.target.id === 'lb') lbClose(); });
  document.addEventListener('keydown', function (e) { if (!document.getElementById('lb').classList.contains('on')) return; if (e.key === 'Escape') lbClose(); if (e.key === 'ArrowLeft') lbStep(-1); if (e.key === 'ArrowRight') lbStep(1); });
  (function () { var x0 = null, el = document.getElementById('lb');
    el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) lbStep(dx < 0 ? 1 : -1); x0 = null; }, { passive: true }); })();

  /* GetYourGuide widgets load after the page is built */

  /* view counter: lets Jake see when the quote is opened. Jake's own devices are skipped once he opens any quote with ?jake=1 */
  (function () {
    try {
      var q = new URLSearchParams(location.search);
      if (q.has('jake')) localStorage.setItem('taj-jake', '1');
      if (localStorage.getItem('taj-jake') === '1') return;
      var k = 'tajqv-' + Q.slug, last = Number(localStorage.getItem(k) || 0);
      if (Date.now() - last < 30 * 60 * 1000) return;
      localStorage.setItem(k, String(Date.now()));
    } catch (e) {}
    var body = JSON.stringify({ slug: Q.slug, ref: (document.referrer || '').slice(0, 200) });
    var url = 'https://travelagentjake.co.uk/api/quote-view';
    try { if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return; } catch (e) {}
    try { fetch(url, { method: 'POST', body: body, mode: 'no-cors', keepalive: true }); } catch (e) {}
  })();
  }
})();
