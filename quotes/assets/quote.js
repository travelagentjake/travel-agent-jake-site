/* Travel Agent Jake interactive quote renderer.
   Each quote page (quotes/<slug>/index.html) only holds a JSON data block (id="quote-data").
   This file turns that data into the full page, so new quotes only need new data, not new code.
   Data shape (all text fields are plain text, keep them free of dashes):
   {
     slug, customer, title, tag, subtitle, intro, heroImg, heroAlt, heroPos,
     facts: [[label, value]], partyLabel ("all 11"), whatsappName,
     compareIntro, hotelsIntro, compareTitle, hotelsTitle, pickTitle (optional heading overrides, e.g. when every option is the same hotel),
     hotels: [{ id, match, name, area, country, rating, reviews, transfer (minutes), slides (bool),
                badge, total, pp (per paying person when free > 0), free (number of free child places), depositAmt (this hotel's deposit for the party, when it differs from depositTotal), tax (tourist tax paid at the hotel, £ for the party), taxNote, rooms, board, why, feats: [], site, imgs: [full image URLs], deposit }],
     extras: [{ id, cat, title, text, price (unit price), unit ("per person", "per car for 8 days"),
                units (defaults to partyCount for "per person", else 1), separate (bool: not part of the tour operator booking, so not in the direct debits),
                prices: { <hotel id>: total for the party } for prices that change by hotel (room upgrades, private transfers),
                hotels: [hotel ids it applies to] }], extrasIntro,
     Extras only show with a real live price. No price means it is left off the page. Extras never link out to other sellers.
     dates: [{ id, label, total, pp, note, current (bool) }], datesIntro   // other dates with their prices, editable from the dashboard
     hotels[].upgrade: { title, text, perks, options: [{ name, price, extra (extras id, adds it from the card) }], note, button (label: keeps the box closed behind a button on the card) }
     extras may also have group: extras in the same group are either or (one villa upgrade at a time)
     touristTax: { amount, note }   // default tourist tax for every hotel; a hotel's own tax/taxNote wins. Required on every quote (CMA).
     sections: [{ id, title, intro, html, after: "hotels" | "trip" | "todo" }],   // custom sections from Jake's notes
     flights: { intro, legs: [{ group (optional heading, e.g. the hotels these flights are for), tag, date, from, fromCode, to, toCode, dep, arr, dur, carrier }] },
     rooms: [], included: [],
     hotels[].package: { dates, flights: { legs: [same as flights.legs] }, transfer (text), included: [] }   // whole package on the option card: hotel, dates, flights and transfers together. When every hotel has a package, the separate Flights section is left off.
     areas: [{ img, title, text }],
     areas: [{ img, title, text, alt, link (GetYourGuide page, affiliate code added automatically), linkLabel }],
     departDate (YYYY-MM-DD), depositTotal, partyCount   // used by the built in monthly payment calculator
     priceIntro, steps: [[title, text]], smallprint, prepared,
     weatherIntro (optional), noWeather (true to leave the weather section off), fullPayment (true when the holiday is paid in full at booking)
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
    if (a.fullPayment === true) Q.fullPayment = true;
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
  /* tourist tax payable locally at the hotel (CMA rules): shown next to every price when the supplier lists one.
     When the supplier lists none, nothing is shown and the standard small print covers it. */
  function taxAmt(x) { var d = Q.touristTax || {}; return x && x.tax != null && x.tax !== '' ? Number(x.tax) : (d.amount ? Number(d.amount) : null); }
  function taxText(x) {
    var d = Q.touristTax || {}, amt = taxAmt(x), note = x.taxNote || d.note;
    if (amt == null) return '';
    return 'Plus about ' + gbp(amt) + ' tourist tax, paid locally at the hotel' + (note ? ' (' + note + ')' : '') + '.';
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
  function hotelName(id) { var f = hotels.filter(function (x) { return x.id === id; })[0]; return f ? f.name : ''; }
  var multi = hotels.length > 1;
  var anySlides = hotels.some(function (h) { return h.slides; });

  function custom(after) {
    return (Q.sections || []).filter(function (s) { return (s.after || 'hotels') === after; }).map(function (s, i) {
      return '<section id="' + esc(s.id || ('extra-' + after + i)) + '"' + (s.alt ? ' class="alt"' : '') + '><div class="wrap"><h2 class="h2">' + esc(s.title) + '</h2>'
        + (s.intro ? '<p class="intro">' + esc(s.intro) + '</p>' : '') + '<div class="custom">' + (s.html || '') + '</div></div></section>';
    }).join('');
  }

  /* older quotes: build each option's package from the separate flights, included and transfer details, so every quote uses the same layout */
  (function legacyPackages() {
    var F = Q.flights && Q.flights.legs && Q.flights.legs.length ? Q.flights : null; if (!F) return;
    var grouped = F.legs.some(function (l) { return l.group; });
    var inc = Q.included || [], trs = inc.filter(function (i) { return /transfer/i.test(i); }), rest = inc.filter(function (i) { return !/transfer/i.test(i); });
    function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
    function pd(s) { var m = String(s || '').match(/(\d{1,2}) ([A-Za-z]+) (\d{4})/); return m ? new Date(m[2] + ' ' + m[1] + ', ' + m[3] + ' 12:00:00') : null; }
    hotels.forEach(function (h) {
      if (h.package) return;
      var legs = F.legs;
      if (grouped) {
        var hn = norm(h.name);
        legs = F.legs.filter(function (l) { var g = norm(l.group); return l.group && (g.indexOf(hn) >= 0 || hn.indexOf(g) >= 0); });
        if (!legs.length) return;
      }
      var o = legs[0], b = legs[legs.length - 1], d1 = pd(o.date), d2 = pd(b.date);
      var n = d1 && d2 ? Math.round((d2 - d1) / 86400000) : 0;
      var cm = (o.carrier || '') || ((String(o.group || '').match(/with ([A-Za-z0-9. ]+)$/) || [])[1] || '');
      var sd = d1 ? d1.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : String(o.date || '');
      h.package = {
        auto: true,
        dates: String(o.date || '') + ' to ' + String(b.date || '') + (n ? ', ' + n + ' nights' : ''),
        short: sd + (cm ? ', ' + cm : ''),
        flights: { legs: legs.map(function (l) { var c = {}; for (var k in l) if (k !== 'group') c[k] = l[k]; return c; }) },
        transfer: trs[0] || (h.transfer ? 'Transfer about ' + h.transfer + ' minutes' : ''),
        included: rest,
        note: F.intro || ''
      };
    });
  })();
  var pkgAll = hotels.length > 0 && hotels.every(function (h) { return h.package && h.package.flights && h.package.flights.legs && h.package.flights.legs.length; });
  if (pkgAll) document.body.classList.add('pkgq');
  var nav = [];
  if (multi) nav.push(['compare', 'Compare']);
  if (hotels.length) nav.push(['hotels', Q.hotelsTitle || (multi ? 'The hotels' : 'Your hotel')]);
  (Q.sections || []).forEach(function (s, i) { if (s.nav) nav.push([s.id || ('extra-' + (s.after || 'hotels') + i), s.nav]); });
  if (pkgAll) { if ((Q.included && Q.included.length) || (Q.rooms && Q.rooms.length)) nav.push(['trip', 'Included']); } else if (Q.flights) nav.push(['trip', 'Flights and rooms']);
  var wxPlaces = wxList();
  if (wxPlaces.length) nav.push(['weather', 'Weather']);
  var dates = (Q.dates || []).filter(function (d) { return d && d.label && !d.hidden && d.total != null && d.total !== '' && !isNaN(Number(d.total)); });
  /* the quoted dates always show the hotel price, so amending the hotel price keeps them in step */
  dates = dates.map(function (d) {
    if (!d.current) return d;
    var hh = d.hotel ? hotels.filter(function (x) { return x.id === d.hotel; })[0] : (hotels.length === 1 ? hotels[0] : null);
    if (!hh) return d;
    var o = {}; for (var k in d) o[k] = d[k]; o.total = hh.total; o.pp = hh.pp; return o;
  });
  dates = dates.filter(function (d) { return !d.hotel || hotels.some(function (x) { return x.id === d.hotel; }); });
  var dateHotels = []; dates.forEach(function (d) { if (d.hotel && dateHotels.indexOf(d.hotel) < 0) dateHotels.push(d.hotel); });
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
  nav.push(['feedback', hotels.length ? 'Book or ask' : 'Send feedback']);

  /* paid in full at booking when travel is within 14 weeks, or when Jake marks the quote fullPayment */
  var fullOnly = Q.fullPayment === true || !!(Q.departDate && (Date.parse(Q.departDate) - Date.now()) < 98 * 86400000);
  function wxMonthName() { var m = Q.departDate ? new Date(Q.departDate + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }) : ''; return m; }
  function wxList() {
    if (!Q.departDate || Q.noWeather) return [];
    var seen = {}, out = [];
    hotels.forEach(function (x) {
      var place = (x.area || '').trim(), country = (x.country || '').trim(); if (!place && !country) return;
      var key = (place + '|' + country).toLowerCase(); if (seen[key]) return; seen[key] = 1;
      out.push({ key: key, place: place, country: country, label: place ? place.replace(/^nr\s+/i, '') + (country ? ', ' + country : '') : country, hotels: hotels.filter(function (y) { return ((y.area || '') + '|' + (y.country || '')).toLowerCase() === key; }).map(function (y) { return y.name; }) });
    });
    return out.slice(0, 8);
  }
  var h = '';
  h += '<div class="hero"><img class="hero-img" src="' + esc(img(Q.heroImg, 2000)) + '" alt="' + esc(Q.heroAlt) + '"' + (Q.heroPos ? ' style="object-position:' + esc(Q.heroPos) + '"' : '') + '><div class="hero-logo"><img src="https://travelagentjake.co.uk/images/logo.png" alt="Travel Agent Jake"></div><div class="wrap"><div class="hero-card">'
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
    h += '<section id="compare"><div class="wrap"><h2 class="h2">' + (Q.compareTitle ? esc(Q.compareTitle) : 'Your ' + (hotels.length === 2 ? 'two' : hotels.length === 3 ? 'three' : hotels.length === 4 ? 'four' : hotels.length === 5 ? 'five' : hotels.length === 6 ? 'six' : hotels.length) + ' hotels at a glance') + '</h2>'
      + (Q.compareIntro ? '<p class="intro">' + esc(Q.compareIntro) + '</p>' : '')
      + '<div class="ctrl" role="group" aria-label="Sort hotels"><span>Sort by</span>'
      + '<select id="sortSel" class="sortsel" aria-label="Sort hotels"><option value="match">Sort: Best match</option><option value="price">Sort: Lowest price</option><option value="rating">Sort: Top rated</option><option value="transfer">Sort: Shortest transfer</option></select>'
      + '<button class="chipbtn" type="button" data-sort="match" aria-pressed="true">Best match</button>'
      + '<button class="chipbtn" type="button" data-sort="price" aria-pressed="false">Lowest price</button>'
      + '<button class="chipbtn" type="button" data-sort="rating" aria-pressed="false">Top rated</button>'
      + '<button class="chipbtn" type="button" data-sort="transfer" aria-pressed="false">Shortest transfer</button>'
      + (anySlides ? '<button class="chipbtn" type="button" id="slidesOnly" aria-pressed="false">Slides only</button>' : '')
      + '</div><div class="tablebox"><table><thead><tr><th>Hotel</th><th>Resort</th><th>Tripadvisor</th><th>Transfer</th>' + (anySlides ? '<th>Slides</th>' : '') + '<th class="n">Total for ' + esc(party.replace(/^all /, '')) + '</th><th class="n">Per person</th></tr></thead><tbody id="ctable"></tbody></table></div><div class="cmob" id="cmob"></div>' + (Q.touristTax && Q.touristTax.amount ? '<p class="taxnote">' + esc('Prices do not include tourist tax of about ' + gbp(Q.touristTax.amount) + ', paid locally at the hotel.') + '</p>' : '') + '</div></section>';
  }
  if (hotels.length) {
    h += '<section id="hotels" class="alt"><div class="wrap"><h2 class="h2">' + esc(Q.hotelsTitle || (multi ? 'The hotels' : 'Your hotel')) + '</h2>'
      + '<p class="intro">' + esc(Q.hotelsIntro || 'Swipe or tap the arrows to browse the photos, and tap any photo to see it full screen.') + '</p><div class="hotels" id="hotelList"></div></div></section>';
  }
  h += custom('hotels');

  if (pkgAll ? ((Q.included && Q.included.length) || (Q.rooms && Q.rooms.length)) : Q.flights) {
    var F = pkgAll ? {} : Q.flights;
    h += '<section id="trip"><div class="wrap"><h2 class="h2">' + (pkgAll ? 'What is included' : 'Flights and rooms') + '</h2>' + (F.intro ? '<p class="intro">' + esc(F.intro) + '</p>' : '') + '<div class="trip">';
    var lastGrp = null;
    (F.legs || []).forEach(function (l) {
      /* legs can be grouped by hotel when options fly to different airports: { group: "Eftalia Village and Eftalia Splash" } */
      if (l.group && l.group !== lastGrp) { h += '<h3 class="fgrp">' + esc(l.group) + '</h3>'; lastGrp = l.group; }
      h += '<div class="flight"><div class="top2"><span class="tg">' + esc(l.tag) + '</span><span class="ft">' + esc(l.date) + '</span></div>'
        + '<div class="rt"><div><div class="cd">' + esc(l.fromCode) + '</div><div class="tm">' + esc(l.dep) + '</div></div>'
        + '<svg width="80" height="20" viewBox="0 0 80 20" aria-hidden="true"><line x1="2" y1="10" x2="60" y2="10" stroke="#99ACFF" stroke-width="2" stroke-dasharray="4 4"></line><path d="M64 4l12 6-12 6 2-6z" fill="#FFD21F"></path></svg>'
        + '<div style="text-align:right"><div class="cd">' + esc(l.toCode) + '</div><div class="tm">' + esc(l.arr) + '</div></div></div>'
        + '<div class="ft">' + esc(l.from) + ' to ' + esc(l.to) + (l.dur ? ' &#183; ' + esc(l.dur) : '') + (l.carrier ? ' &#183; ' + esc(l.carrier) : '') + '</div>'
        /* each flight and the wait between them, so connections are clear */
        + (l.segments && l.segments.length ? '<ol class="segs">' + l.segments.map(function (g) {
            if (g.wait) return '<li class="wait"><b>' + esc(g.wait) + ' wait in ' + esc(g.at) + '</b></li>';
            return '<li><span class="fn">' + esc(g.flight || '') + '</span><span>' + esc(g.dep) + ' ' + esc(g.from) + '</span><span class="ar">&#8594;</span><span>' + esc(g.arr) + ' ' + esc(g.to) + '</span>' + (g.note ? '<em>' + esc(g.note) + '</em>' : '') + '</li>';
          }).join('') + '</ol>' : '')
        + '</div>';
    });
    if (Q.rooms && Q.rooms.length) h += '<div class="box"><h3>Your rooms</h3><ul>' + Q.rooms.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';
    if (Q.included && Q.included.length) h += '<div class="box"><h3>Included for everyone</h3><ul>' + Q.included.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';
    h += '</div></div></section>';
  }
  h += custom('trip');

  /* weather: what each hotel's area is usually like in the month they travel, from /api/quote-weather */
  if (wxPlaces.length) {
    h += '<section id="weather" class="alt"><div class="wrap"><h2 class="h2">The weather when you go</h2><p class="intro">' + esc(Q.weatherIntro || ('What ' + wxMonthName() + ' is usually like' + (wxPlaces.length > 1 ? ' in each area' : '') + ', based on the last three years of real weather data, with my tips on what to pack.')) + '</p>'
      + '<div class="wx" id="wxList">' + wxPlaces.map(function (w) { return '<div class="wxc" data-wx="' + esc(w.key) + '"><div class="wxh"><b>' + esc(w.label) + '</b><span>Checking the weather…</span></div></div>'; }).join('') + '</div></div></section>';
  }

  /* other dates: same holiday on different dates, with live prices Jake can amend */
  if (dates.length > 1) {
    var dcard = function (d, cur) {
      var diff = cur && !d.current ? Number(d.total) - Number(cur.total) : 0;
      return '<div class="dcard' + (d.current ? ' on' : '') + '" data-dh="' + esc(d.hotel || '') + '">' + (d.current ? '<span class="dtag">Your quote</span>' : '')
        + '<b class="dl">' + esc(d.label) + '</b>' + (d.note ? '<span class="dn">' + esc(d.note) + '</span>' : '')
        + '<span class="dp">' + gbp(d.total) + '</span><span class="dpp">' + (d.pp ? gbp(d.pp) + ' per person' : 'total for ' + esc(party)) + '</span>'
        + (diff ? '<span class="dd ' + (diff > 0 ? 'up' : 'down') + '">' + gbp(Math.abs(diff)) + (diff > 0 ? ' more' : ' less') + '</span>' : '')
        + (d.current ? '' : '<a class="btn btn-o dbtn" target="_blank" rel="noopener" href="' + wa('Hi Jake, it’s ' + who + '. Could you look at ' + d.label + (d.hotel ? ' at ' + hotelName(d.hotel) : '') + ' for our holiday? ') + '">Ask about these dates</a>') + '</div>';
    };
    var groups = dateHotels.length > 1 ? dateHotels : [null];
    h += '<section id="dates" class="alt"><div class="wrap"><h2 class="h2">Other dates</h2>' + (Q.datesIntro ? '<p class="intro">' + esc(Q.datesIntro) + '</p>' : '')
      + (groups.length > 1 ? '<div class="ctrl" role="group" aria-label="Choose a hotel">' + groups.map(function (g, i) { return '<button class="chipbtn" type="button" data-dg="' + esc(g) + '" aria-pressed="' + (i === 0) + '">' + esc(hotelName(g)) + '</button>'; }).join('') + '</div>' : '')
      + groups.map(function (g, i) {
        var list = dates.filter(function (d) { return !g || d.hotel === g; }), cur = list.filter(function (d) { return d.current; })[0];
        return '<div class="acar dcar" data-dgrp="' + esc(g || '') + '"' + (i ? ' hidden' : '') + '><button class="arr l" type="button" data-ddir="-1" aria-label="Previous">&#8249;</button><button class="arr r" type="button" data-ddir="1" aria-label="Next">&#8250;</button><div class="areas">'
          + list.map(function (d) { return dcard(d, cur); }).join('') + '</div></div>';
      }).join('') + '</div></section>';
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
    + '<p style="margin:22px 0 0;display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-y" href="#feedback" data-pick="book">I want to book</a><a class="btn btn-o" href="#feedback" data-pick="question">I have a question</a></p>'
    + (hotels.length ? '<div class="full" id="fullCost"></div>' : '')
    + (Q.departDate && hotels.length ? '<div class="calc" id="calc"><h3>Your monthly payments</h3><p class="intro" style="margin:4px 0 16px">Pick a hotel and the day of the month that suits you, and see how the balance could be spread by direct debit.</p>'
      + '<div class="calcgrid">' + (multi ? '<div><label class="fbl" for="cHotel">Hotel</label><select id="cHotel">' + hotels.map(function (x, i) { return '<option value="' + i + '">' + esc(x.name) + ' (' + gbp(x.total) + ')</option>'; }).join('') + '</select></div>' : '')
      + '<div><label class="fbl" for="cDay">Payment day each month</label><select id="cDay">' + Array.apply(null, Array(28)).map(function (_, i) { var d = i + 1; return '<option value="' + d + '"' + (d === 1 ? ' selected' : '') + '>' + d + ordinal(d) + '</option>'; }).join('') + '</select></div></div>'
      + '<div id="cOut"></div></div>' : '')
    + '<div class="fb" id="feedback"><h3>What would you like to do?</h3><p class="intro" style="margin:4px 0 14px">Pick one. Booking is done right here. Questions and changes go to me on WhatsApp with your message ready to send.</p>'
    + '<div class="fbopts" role="radiogroup" aria-label="What would you like to do?">'
    + (hotels.length ? [['book', 'We would like to book']] : []).concat([['changes', 'We would like some changes'], ['question', 'I have a question']]).map(function (o) { return '<label class="fbopt"><input type="radio" name="fbType" value="' + o[0] + '"><span>' + o[1] + '</span></label>'; }).join('')
    + '</div>'
    + (hotels.length ? bookForm() : '')
    + '<div id="fbWrap" hidden>'
    + (hotels.length ? '<label class="fbl" for="fbHotel">' + (multi ? 'Your favourite hotel' : 'Hotel') + '</label><select id="fbHotel"><option value="">' + (multi ? 'Not decided yet' : esc(hotels[0].name)) + '</option>' + (multi ? hotels.map(function (x) { return '<option>' + esc(x.name) + '</option>'; }).join('') : '') + '</select>' : '')
    + '<label class="fbl" for="fbMsg">Your message</label><textarea id="fbMsg" rows="4" placeholder="e.g. We love Tour Khalef, could we add sea view rooms?"></textarea>'
    + '<button class="btn btn-wa" type="button" id="fbSend" style="margin-top:14px">Send to Jake on WhatsApp</button></div></div>'

    + '<p class="small" style="margin-top:20px">' + esc(Q.smallprint || ('Prices were correct when this quote was prepared on ' + Q.prepared + ' and are subject to availability until booked. Your holiday is ATOL protected.')) + '</p>'
    /* standard tourist tax wording on every quote */
    + '<p class="small">' + esc('Tourist taxes are set by local governments and can change. Any tourist tax amounts shown are an estimate and are paid locally at the hotel. Destinations that do not currently charge a tourist tax may introduce one at any time, and if this happens I will let you know.') + '</p></div></section>';
  h += '<footer><div class="wrap"><p>Travel Agent Jake is part of Club Voyages, a Member of ABTA, membership number P8503 &amp; Y6784. Travel Agent Jake is part of Club Voyages Ltd, which is as an agent for Hays Tour Operating Ltd, ATOL 10531. All the flights and flight inclusive holidays on this website are financially protected by the ATOL scheme. Please see our <a href="https://travelagentjake.co.uk/booking-conditions.html">booking conditions</a> for more information.</p><p>&copy; ' + new Date().getFullYear() + ' Travel Agent Jake &#183; <a href="https://travelagentjake.co.uk">travelagentjake.co.uk</a></p></div></footer>';
  h += '<a class="btn btn-y float" id="fbFloat" href="#feedback">' + (hotels.length ? 'Book or ask Jake' : 'Send feedback to Jake') + '</a>';
  h += '<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Photo viewer"><button class="x" type="button" id="lbX" aria-label="Close">&#215;</button><button class="arr l" type="button" id="lbP" aria-label="Previous photo">&#8249;</button><img id="lbImg" alt=""><button class="arr r" type="button" id="lbN" aria-label="Next photo">&#8250;</button><div class="cap" id="lbCap"></div></div>';
  var isJake = false; try { if (new URLSearchParams(location.search).has('jake')) localStorage.setItem('taj-jake', '1'); isJake = localStorage.getItem('taj-jake') === '1'; } catch (e) {}
  if (isJake) h = h.replace('id="fbFloat"', 'id="fbFloat" hidden');
  if (isJake) h += '<a class="btn btn-y amend" href="https://travelagentjake.co.uk/enquiries-admin.html#amend=' + encodeURIComponent(Q.slug) + '" target="_blank" rel="noopener">Amend this quote</a>';
  document.getElementById('app').innerHTML = h;
  var people = Number(Q.partyCount || 0);
  /* deposit for the party: a hotel's own depositAmt wins over the quote wide depositTotal (operators differ) */
  function depOf(x) { return x && x.depositAmt != null ? Number(x.depositAmt) : Number(Q.depositTotal || 0); }
  function taxOf(x) { return taxAmt(x); }
  function inBooking(x) { return xFor(x).reduce(function (a, e) { var t = xTotal(e, x); return a + (t != null && !e.separate ? t : 0); }, 0); }
  function full() {
    var el = document.getElementById('fullCost'); if (!el || !hotels.length) return;
    var x = curHotel(), list = xFor(x), tax = taxOf(x), sum = x.total, pending = 0, deposit = depOf(x);
    var rows = '<tr><td>' + esc(x.name) + ', ' + esc(party) + '</td><td class="n">' + gbp(x.total) + '</td></tr>';
    list.forEach(function (e) { var t = xTotal(e, x); if (t == null) return; sum += t; rows += '<tr><td>' + esc(e.title) + '</td><td class="n">' + fmt(t) + '</td></tr>'; });
    if (tax != null) sum += tax;
    if (tax != null) rows += '<tr><td>Tourist tax, paid locally at the hotel</td><td class="n">about ' + gbp(tax) + '</td></tr>';
    var today = paidToday(x);
    el.innerHTML = '<h3>Your full holiday cost</h3>'
      + (multi ? '<label class="fbl" for="fHotel">Hotel</label><select id="fHotel" class="fsel">' + hotels.map(function (h, i) { return '<option value="' + i + '"' + (i === hIdx ? ' selected' : '') + '>' + esc(h.name) + ' (' + gbp(h.total) + ')</option>'; }).join('') + '</select>' : '')
      + '<table><tbody>' + rows + '</tbody><tfoot><tr><td>Total</td><td class="n">' + fmt(Math.round(sum * 100) / 100) + '</td></tr>'
      + (people > 1 ? '<tr class="pp"><td>' + (x.free ? 'About per paying person (' + x.free + (Number(x.free) === 1 ? ' child goes' : ' children go') + ' free)' : 'About per person') + '</td><td class="n">' + money(sum / Math.max(1, people - Number(x.free || 0))) + '</td></tr>' : '') + '</tfoot></table>'
      + (deposit || today ? '<div class="today"><b>To pay today: ' + fmt(Math.round((deposit + today) * 100) / 100) + '</b><span>' + (deposit ? gbp(deposit) + ' deposit' : '') + (today ? (deposit ? ' plus ' : '') + fmt(Math.round(today * 100) / 100) + ' for your airport extras, which are paid in full when you book' : '') + '. ' + (Q.departDate ? 'The rest of the holiday is the balance, spread in the calculator below.' : '') + '</span></div>' : '')
      + (extras.some(function (e) { return fits(e, x); }) ? '<p class="small" style="margin:10px 0 0">' + (list.length ? 'Change your extras in <a href="#extras">Add extras</a>.' : 'Nothing extra added yet. Have a look at <a href="#extras">the extras for this hotel</a>.') + (multi ? '' : '') + '</p>' : '');
    var xs = document.getElementById('xSum');
    /* only show extras that go with the hotel picked */
    Array.prototype.forEach.call(document.querySelectorAll('[data-x]'), function (c) { var e = extras.filter(function (z) { return z.id === c.dataset.x; })[0], card = c.closest('.xcard'); if (e && card) card.hidden = !fits(e, x); });
    /* no extras for the hotel picked: hide the whole section and its menu link */
    var anyFit = extras.some(function (e) { return fits(e, x); });
    var xs0 = document.getElementById('extras'); if (xs0) xs0.hidden = !anyFit;
    var xnav = document.querySelector('.snav a[href="#extras"]'); if (xnav) xnav.hidden = !anyFit;
    Array.prototype.forEach.call(document.querySelectorAll('[data-xp]'), function (el) { var e = extras.filter(function (z) { return z.id === el.dataset.xp; })[0]; if (e && e.prices) el.innerHTML = xPriceLine(e); });
    if (xs) { var all = xFor(x), tot = all.reduce(function (a, e) { var t = xTotal(e, x); return a + (t || 0); }, 0); xs.innerHTML = all.length ? '<b>' + all.length + ' extra' + (all.length > 1 ? 's' : '') + ' added' + (tot ? ', ' + fmt(Math.round(tot * 100) / 100) : '') + '</b><a class="btn btn-y" href="#fullCost">See your full holiday cost</a>' : ''; }
  }
  function calc() {
    full();
    try { document.dispatchEvent(new CustomEvent('taj-calc')); } catch (e) {}
    var out = document.getElementById('cOut'); if (!out || !Q.departDate) return;
    var x = curHotel(), extra = inBooking(x), deposit = depOf(x);
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
  function dFocus() { Array.prototype.forEach.call(document.querySelectorAll('.dcar:not([hidden]) .areas'), function (t) { var on = t.querySelector('.dcard.on'); if (on && on.previousElementSibling) t.scrollLeft = on.previousElementSibling.offsetLeft - t.firstElementChild.offsetLeft; }); }
  dFocus();
  Array.prototype.forEach.call(document.querySelectorAll('[data-dg]'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-dg]'), function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      Array.prototype.forEach.call(document.querySelectorAll('[data-dgrp]'), function (g) { g.hidden = g.dataset.dgrp !== b.dataset.dg; });
      dFocus();
    });
  });
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

  /* booking form: passengers, contact, how they want to pay, optional direct debit, T&Cs. Posts to /api/quote-book which emails Jake. */
  function bookForm() {
    var n = Math.max(1, Number(Q.partyCount || 1));
    function paxRow(i) {
      return '<div class="paxrow"><div class="paxn">Passenger ' + (i + 1) + (i === 0 ? ' (lead passenger)' : '') + '</div><div class="paxg">'
        + '<label>First name<input type="text" name="first" autocomplete="given-name" required></label>'
        + '<label>Middle name (if any)<input type="text" name="middle" autocomplete="additional-name"></label>'
        + '<label>Surname<input type="text" name="last" autocomplete="family-name" required></label>'
        + '<label>Date of birth<input type="date" name="dob" required max="' + new Date().toISOString().slice(0, 10) + '"></label></div></div>';
    }
    var rows = ''; for (var i = 0; i < n; i++) rows += paxRow(i);
    return '<div class="book" id="book" hidden><h3>Book this holiday</h3>'
      + '<p class="intro" style="margin:4px 0 16px">Fill this in and it comes straight to me. I will then text you a secure payment link for ' + (fullOnly ? 'the full amount' : 'your deposit (or the full amount if you prefer)') + ', and as soon as that is paid I get your holiday confirmed. Nothing is charged on this page. Names must match passports exactly.</p>'
      + '<form id="bookForm" novalidate>'
      + '<h4>' + esc(Q.pickTitle || 'Which hotel') + '</h4>'
      + (multi ? '<select id="bkHotel" class="fsel">' + hotels.map(function (h, i) { return '<option value="' + i + '"' + (i === hIdx ? ' selected' : '') + '>' + esc(h.name) + ' (' + gbp(h.total) + ')</option>'; }).join('') + '</select>' : '<p class="bkh"><b>' + esc(hotels[0].name) + '</b>, ' + gbp(hotels[0].total) + '</p>')
      + '<div id="bkSum" class="bksum"></div>'
      + '<h4>Who is travelling</h4><div id="bkPax">' + rows + '</div>'
      + '<p><button class="btn btn-o" type="button" id="bkAdd">Add another passenger</button></p>'
      + '<h4>Your contact details</h4><div class="paxg">'
      + '<label class="wide">Home address<textarea name="address" rows="3" autocomplete="street-address" required placeholder="House number, street, town"></textarea></label>'
      + '<label>Postcode<input type="text" name="postcode" autocomplete="postal-code" required></label>'
      + '<label>Mobile number<input type="tel" name="mobile" autocomplete="tel" required></label>'
      + '<label class="wide">Email address<input type="email" name="email" autocomplete="email" required></label></div>'
      + '<h4>Paying today</h4>' + (fullOnly
        ? '<p class="bkfull" id="bkFullNote">' + (Q.fullPayment === true ? 'This holiday is paid in full at the time of booking.' : 'As you travel within 14 weeks, this holiday is paid in full at the time of booking.') + '</p><input type="hidden" name="payNow" value="full" checked>'
        : '<div class="bkopts" id="bkPayNow"><label class="fbopt"><input type="radio" name="payNow" value="deposit" checked><span>Just the deposit</span></label>'
        + '<label class="fbopt"><input type="radio" name="payNow" value="full"><span>The full amount</span></label></div>')
      + '<div class="bkopts" style="margin-top:10px"><label class="fbopt"><input type="radio" name="payHow" value="card" checked><span>Debit or credit card</span></label>'
      + '<label class="fbopt"><input type="radio" name="payHow" value="bank"><span>Bank transfer</span></label></div>'
      + '<p class="small" style="margin:8px 0 0">Either way I text you a secure payment link, so nothing is paid on this page.</p>'
      + (fullOnly ? '' : '<div id="bkDD"><h4>The rest of the balance</h4>'
      + '<label class="fbopt" style="display:inline-flex"><input type="checkbox" id="bkWantDD" checked><span>Set up a monthly direct debit for the remaining balance</span></label>'
      + '<div id="bkDDFields" class="paxg" style="margin-top:12px">'
      + '<label>Day of the month it comes out<select name="ddDay">' + Array.apply(null, Array(28)).map(function (_, i) { var d = i + 1; return '<option value="' + d + '">' + d + ordinal(d) + '</option>'; }).join('') + '</select></label>'
      + '<label>Name of the account holder<input type="text" name="ddName" autocomplete="off"></label>'
      + '<label>Sort code<input type="text" name="ddSort" inputmode="numeric" placeholder="00-00-00" autocomplete="off"></label>'
      + '<label>Account number<input type="text" name="ddAcc" inputmode="numeric" placeholder="8 digits" autocomplete="off"></label></div>'
      + '<p class="small" id="bkDDNote">Without a direct debit, the balance is due in one go about 14 weeks before you travel.</p></div>')
      + '<label class="bkagree"><input type="checkbox" id="bkAgree" required><span>I have read and agree to the <a href="https://travelagentjake.co.uk/booking-conditions.html" target="_blank" rel="noopener">booking conditions</a> on travelagentjake.co.uk, and I confirm the details above are correct.</span></label>'
      + '<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">'
      + '<p id="bkErr" class="bkerr" hidden></p>'
      + '<button class="btn btn-y" type="submit" id="bkSend" style="margin-top:6px">Send my booking details to Jake</button>'
      + '<p class="small" style="margin:12px 0 0">Your details are sent securely to Jake only and are used just to make this booking. Questions or changes to the quote? Those are easiest on <a href="' + wa('Hi Jake, it’s ' + who + '. Before I book, ') + '" target="_blank" rel="noopener">WhatsApp</a>.</p>'
      + '</form><div id="bkDone" class="bkdone" hidden></div></div>';
  }
  function bookWire() {
    var f = document.getElementById('bookForm'); if (!f) return;
    var hs = document.getElementById('bkHotel');
    function bkHotel() { return hs ? hotels[Number(hs.value)] || hotels[0] : hotels[0]; }
    function sum() {
      var x = bkHotel(), list = xFor(x), ex = list.reduce(function (a, e) { var t = xTotal(e, x); return a + (t || 0); }, 0);
      var total = x.total + ex, today = paidToday(x), deposit = depOf(x), dep = deposit + today;
      var full = fullOnly || (document.querySelector('input[name="payNow"]:checked') || {}).value === 'full';
      var el = document.getElementById('bkSum');
      el.innerHTML = '<div><span>Holiday' + (list.length ? ' with ' + list.length + ' extra' + (list.length > 1 ? 's' : '') : '') + '</span><b>' + fmt(Math.round(total * 100) / 100) + '</b></div>'
        + '<div><span>' + (full ? 'To pay today, the full amount' : 'To pay today' + (today ? ' (deposit plus airport extras)' : ', your deposit')) + '</span><b>' + fmt(Math.round((full ? total : dep) * 100) / 100) + '</b></div>'
        + (full ? '' : '<div><span>Balance to follow</span><b>' + fmt(Math.round((total - dep) * 100) / 100) + '</b></div>')
        + (list.length ? '<p class="small" style="margin:8px 0 0">Extras: ' + list.map(function (e) { return esc(e.title); }).join(', ') + '. Change them in <a href="#extras">Add extras</a>.</p>' : '');
      var dd = document.getElementById('bkDD'); if (dd) dd.hidden = full;
      var w = document.getElementById('bkWantDD'), ff = document.getElementById('bkDDFields'); if (w && ff) ff.hidden = !w.checked;
      var opt = document.querySelector('input[name="payNow"][value="deposit"]'); if (opt) opt.nextSibling.textContent = 'Just the deposit, ' + fmt(Math.round(dep * 100) / 100);
      var opt2 = document.querySelector('input[name="payNow"][value="full"]'); if (opt2) opt2.nextSibling.textContent = 'The full amount, ' + fmt(Math.round(total * 100) / 100);
    }
    if (hs) hs.addEventListener('change', function () { hIdx = Number(hs.value); calc(); var c = document.getElementById('cHotel'); if (c) c.value = hs.value; var fh = document.getElementById('fHotel'); if (fh) fh.value = hs.value; sum(); });
    f.addEventListener('change', sum);
    document.addEventListener('taj-calc', function () { if (hs && Number(hs.value) !== hIdx) hs.value = String(hIdx); sum(); });
    document.getElementById('bkAdd').addEventListener('click', function () {
      var box = document.getElementById('bkPax'), i = box.children.length;
      var d = document.createElement('div'); d.innerHTML = '<div class="paxrow"><div class="paxn">Passenger ' + (i + 1) + ' <button type="button" class="paxdel" aria-label="Remove passenger">Remove</button></div><div class="paxg"><label>First name<input type="text" name="first" required></label><label>Middle name (if any)<input type="text" name="middle"></label><label>Surname<input type="text" name="last" required></label><label>Date of birth<input type="date" name="dob" required></label></div></div>';
      box.appendChild(d.firstChild);
    });
    document.getElementById('bkPax').addEventListener('click', function (e) { if (e.target.classList.contains('paxdel')) e.target.closest('.paxrow').remove(); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = document.getElementById('bkErr'); err.hidden = true;
      var x = bkHotel(), pax = [];
      Array.prototype.forEach.call(document.querySelectorAll('#bkPax .paxrow'), function (r) {
        pax.push({ first: r.querySelector('[name=first]').value.trim(), middle: r.querySelector('[name=middle]').value.trim(), last: r.querySelector('[name=last]').value.trim(), dob: r.querySelector('[name=dob]').value });
      });
      var g = function (n) { var el = f.querySelector('[name=' + n + ']'); return el ? el.value.trim() : ''; };
      var full = fullOnly || (document.querySelector('input[name="payNow"]:checked') || {}).value === 'full';
      var wantDD = !full && !!document.getElementById('bkWantDD') && document.getElementById('bkWantDD').checked;
      var problems = [];
      if (pax.some(function (p) { return !p.first || !p.last || !p.dob; })) problems.push('every passenger needs a first name, surname and date of birth');
      if (!g('address') || !g('postcode')) problems.push('your home address and postcode');
      if (!/^\+?[\d\s]{10,15}$/.test(g('mobile'))) problems.push('a mobile number');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g('email'))) problems.push('a valid email address');
      if (wantDD) {
        if (!g('ddName')) problems.push('the name on the bank account');
        if (!/^\d{6}$/.test(g('ddSort').replace(/\D/g, ''))) problems.push('a 6 digit sort code');
        if (!/^\d{8}$/.test(g('ddAcc').replace(/\D/g, ''))) problems.push('an 8 digit account number');
      }
      if (!document.getElementById('bkAgree').checked) problems.push('a tick to agree to the booking conditions');
      if (problems.length) { err.textContent = 'Please check: ' + problems.join(', ') + '.'; err.hidden = false; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      var list = xFor(x), ex = list.reduce(function (a, e) { var t = xTotal(e, x); return a + (t || 0); }, 0), deposit = depOf(x);
      var body = {
        slug: Q.slug, customer: Q.customer, title: Q.title, hotel: x.name, hotelTotal: x.total, extras: list.map(function (e) { return { title: e.title, total: xTotal(e, x), separate: !!e.separate }; }),
        total: Math.round((x.total + ex) * 100) / 100, deposit: deposit, payToday: Math.round(((full ? x.total + ex : deposit + paidToday(x))) * 100) / 100,
        payNow: full ? 'full' : 'deposit', payHow: (document.querySelector('input[name="payHow"]:checked') || {}).value || 'card',
        dd: wantDD ? { day: Number(g('ddDay')), name: g('ddName'), sort: g('ddSort').replace(/\D/g, ''), account: g('ddAcc').replace(/\D/g, '') } : null,
        passengers: pax, address: g('address'), postcode: g('postcode'), mobile: g('mobile'), email: g('email'), agreed: true, website: g('website'), departDate: Q.departDate || ''
      };
      var btn = document.getElementById('bkSend'); btn.disabled = true; btn.textContent = 'Sending…';
      fetch('https://travelagentjake.co.uk/api/quote-book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
        .then(function (r) {
          if (!r.ok) throw new Error((r.j && r.j.error) || 'Something went wrong');
          f.hidden = true; var d = document.getElementById('bkDone'); d.hidden = false;
          d.innerHTML = '<h4>Thank you, ' + esc(pax[0].first) + '!</h4><p>Your booking details are with me. I will text ' + esc(body.mobile) + ' with a secure payment link for ' + fmt(body.payToday) + '. As soon as that is paid I get your holiday confirmed and send your confirmation and ATOL certificate.</p><p>A copy of what you sent (without any bank details) is on its way to ' + esc(body.email) + '.</p>';
          d.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function (e) { err.textContent = 'Sorry, that did not send (' + e.message + '). Please try again, or send me a WhatsApp and I will take the details there.'; err.hidden = false; btn.disabled = false; btn.textContent = 'Send my booking details to Jake'; });
    });
    sum();
  }
  bookWire();
  (function loadWeather() {
    if (!wxPlaces.length) return;
    var month = Number(Q.departDate.slice(5, 7));
    wxPlaces.forEach(function (w) {
      var el = document.querySelector('[data-wx="' + w.key.replace(/"/g, '') + '"]'); if (!el) return;
      fetch('https://travelagentjake.co.uk/api/quote-weather?place=' + encodeURIComponent(w.place) + '&country=' + encodeURIComponent(w.country) + '&month=' + month)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok) { el.remove(); wxEmpty(); return; }
          var stat = function (n, v, s, ic) { return '<div class="wxs"><i class="wxi" aria-hidden="true">' + (ic || '') + '</i><small>' + n + '</small><b>' + v + '</b>' + (s ? '<span>' + s + '</span>' : '') + '</div>'; };
          el.innerHTML = '<div class="wxh"><b>' + esc(w.label) + '</b><span>' + esc(d.monthName) + (w.hotels.length > 1 && wxPlaces.length > 1 ? ' · ' + esc(w.hotels.join(', ')) : '') + '</span></div>'
            + '<div class="wxg">' + stat('Daytime high', Math.round(d.high) + '°C', 'average', '☀️') + stat('Night low', Math.round(d.low) + '°C', 'average', '🌙')
            + stat('Sunshine', (d.sun != null ? Math.round(d.sun) + ' hrs' : 'n/a'), 'a day', '🌤️') + stat('Rain', d.rainDays + (d.rainDays === 1 ? ' day' : ' days'), d.tropical ? 'with a shower, mostly short bursts' : 'about ' + d.rainMm + 'mm', '🌧️')
            + (d.sea != null ? stat('Sea', Math.round(d.sea) + '°C', 'average', '🌊') : '') + '</div>'
            + '<ul class="wxa">' + (d.advice || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
        })
        .catch(function () { el.remove(); wxEmpty(); });
    });
    function wxEmpty() { var l = document.getElementById('wxList'); if (l && !l.children.length) { var sec = document.getElementById('weather'); if (sec) sec.remove(); var nl = document.querySelector('.snav a[href="#weather"]'); if (nl) nl.remove(); } }
  })();
  /* which option is picked decides what shows: the booking form, or the WhatsApp message box */
  function pickType(t, hotelId) {
    var r = document.querySelector('input[name="fbType"][value="' + t + '"]'); if (r) r.checked = true;
    var bk = document.getElementById('book'), fw = document.getElementById('fbWrap');
    if (bk) bk.hidden = t !== 'book';
    if (fw) fw.hidden = !(t === 'changes' || t === 'question');
    if (hotelId != null && hotelId !== '') { var i = -1; hotels.forEach(function (h, k) { if (h.id === hotelId) i = k; }); if (i >= 0) { hIdx = i; var c = document.getElementById('cHotel'); if (c) c.value = String(i); var fh = document.getElementById('fHotel'); if (fh) fh.value = String(i); var bh = document.getElementById('bkHotel'); if (bh) bh.value = String(i); calc(); } }
    var msg = document.getElementById('fbMsg'); if (msg && t !== 'book') msg.placeholder = t === 'changes' ? 'e.g. Could we add sea view rooms, or look at different dates?' : 'e.g. How long is the transfer, and is the balance date flexible?';
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name="fbType"]'), function (r) { r.addEventListener('change', function () { pickType(r.value); }); });
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-pick]'); if (!a) return;
    e.preventDefault(); pickType(a.dataset.pick, a.dataset.hotel);
    var box = document.getElementById('feedback'); if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  var fbBtn = document.getElementById('fbSend');
  if (fbBtn) fbBtn.addEventListener('click', function () {
    var t = (document.querySelector('input[name="fbType"]:checked') || {}).value || 'question';
    var hs = document.getElementById('fbHotel'), hotel = hs ? (hs.value || (multi ? '' : hotels[0].name)) : '';
    var msg = document.getElementById('fbMsg').value.trim();
    var head = { changes: 'we would like some changes to our quote.', question: 'I have a question about our quote.' }[t];
    var text = 'Hi Jake, it\u2019s ' + who + ' (quote: quotes.travelagentjake.co.uk/' + Q.slug + '). ' + head
      + (hotel ? '\nHotel: ' + hotel : '') + (xFor(null).length ? '\nExtras: ' + xFor(null).map(function (e) { return e.title; }).join(', ') : '') + (msg ? '\n\n' + msg : '');
    window.open(wa(text), '_blank', 'noopener');
  });
  Array.prototype.forEach.call(document.querySelectorAll('#app a[href*="getyourguide."]'), function (a) { a.href = gygLink(a.href); a.rel = 'noopener sponsored'; a.target = '_blank'; });

  /* hotels, table, sorting */
  var sortKey = 'match', slidesOnly = false;
  var RMKEY = 'tajrm-' + Q.slug, removed = {};
  try { removed = JSON.parse(localStorage.getItem(RMKEY) || '{}') || {}; } catch (e) { removed = {}; }
  function saveRm() { try { localStorage.setItem(RMKEY, JSON.stringify(removed)); } catch (e) {} }
  function ordered() {
    var list = hotels.filter(function (x) { return !(pkgAll && removed[x.id]); });
    list.sort(function (a, b) {
      if (sortKey === 'price') return a.total - b.total;
      if (sortKey === 'rating') return b.rating - a.rating || a.total - b.total;
      if (sortKey === 'transfer') return a.transfer - b.transfer;
      return (a.match || 0) - (b.match || 0);
    });
    return slidesOnly ? list.filter(function (x) { return x.slides; }) : list;
  }
  function optName(x) { return 'Option ' + (x.match || '') + (x.package && !x.package.auto ? ': ' + (x.package.short || x.package.dates || '') : ''); }
  function optLine(x) { return x.package && !x.package.auto ? '<small class="optsm">' + esc(optName(x)) + '</small>' : ''; }
  function renderTable() {
    var t = document.getElementById('ctable'); if (!t) return;
    t.innerHTML = ordered().map(function (x) {
      return '<tr><td><a href="#h-' + esc(x.id) + '">' + esc(x.name) + '</a>' + optLine(x) + '</td><td>' + esc(x.area) + '</td><td><span class="stars">' + (x.rating ? x.rating.toFixed(1) : '') + '</span>' + (x.rating ? ' / 5' : '') + '</td><td>' + mins(x.transfer) + '</td>'
        + (anySlides ? '<td>' + (x.slides ? '<span class="yes">Yes</span>' : '<span class="no">No</span>') + '</td>' : '') + '<td class="n"><b>' + gbp(x.total) + '</b></td><td class="n">' + gbp(x.pp) + (x.free ? '<br><small>' + x.free + ' kids free</small>' : '') + '</td></tr>';
    }).join('');
    /* phones get a stacked list instead of the wide table */
    var m = document.getElementById('cmob'); if (m) m.innerHTML = ordered().map(function (x) {
      return '<a class="crow" href="#h-' + esc(x.id) + '"><span class="cn"><b>' + esc(x.name) + '</b>' + (x.package && !x.package.auto ? '<span class="cpk">' + esc(optName(x)) + '</span>' : '') + '<span>' + esc(x.area)
        + (x.rating ? ' &#183; ' + x.rating.toFixed(1) + '/5' : '') + (x.transfer ? ' &#183; ' + mins(x.transfer) + ' transfer' : '') + (anySlides && x.slides ? ' &#183; Slides' : '') + '</span></span>'
        + '<span class="cp"><b>' + gbp(x.total) + '</b>' + (x.pp ? '<span>' + gbp(x.pp) + 'pp' + (x.free ? ', ' + x.free + ' kids free' : '') + '</span>' : '') + '</span></a>';
    }).join('');
  }
  function pkgHtml(x) {
    var p = x.package; if (!p) return '';
    var legs = (p.flights && p.flights.legs) || [];
    var carrier = legs[0] && legs[0].carrier ? legs[0].carrier : '';
    var tshort = (p.transfer || '').split(',')[0];
    return '<div class="pkg"><div class="pkgsum"><div class="pkgsl"><b>' + esc(p.short || p.dates || '') + '</b><span>' + esc([((p.dates || '').match(/\d+ nights?/) || [''])[0], tshort].filter(Boolean).join(' \u00b7 ')) + '</span></div>'
      + '<button class="mbtn pb" type="button" data-tog="pkg" aria-expanded="false"><span class="m1">View flights</span><span class="m2">Hide flights</span></button></div>'
      + '<div class="pkgdet"><div class="pkgfl">' + legs.map(function (l) {
        return '<div class="pkgf"><div class="pkgtop"><span class="tg">' + esc(l.tag) + '</span><b>' + esc(l.date) + '</b></div><div class="pkgt">' + esc(l.fromCode) + ' ' + esc(l.dep) + ' &#8594; ' + esc(l.toCode) + ' ' + esc(l.arr) + '</div>'
          + '<small>' + esc(l.from) + ' to ' + esc(l.to) + (l.dur ? ' &#183; ' + esc(l.dur) : '') + (l.carrier ? ' &#183; ' + esc(l.carrier) : '') + '</small>'
          + (l.segments && l.segments.length ? '<ol class="pkgs">' + l.segments.map(function (g) { return g.wait ? '<li class="wait">' + esc(g.wait) + ' wait in ' + esc(g.at) + '</li>' : '<li>' + esc(g.flight || '') + ' ' + esc(g.dep) + ' ' + esc(g.from) + ' &#8594; ' + esc(g.arr) + ' ' + esc(g.to) + '</li>'; }).join('') + '</ol>' : '')
          + '</div>';
      }).join('') + '</div>'
      + (p.transfer ? '<div class="pkgr"><b>Transfers</b><span>' + esc(p.transfer) + '</span></div>' : '')
      + (p.note ? '<div class="pkgr"><b>Good to know</b><span>' + esc(p.note) + '</span></div>' : '')
      + (p.included && p.included.length ? '<div class="pkgr"><b>Included</b><span>' + p.included.map(esc).join(' &#183; ') + '</span></div>' : '')
      + '</div></div>';
  }
  function renderHotels() {
    var el = document.getElementById('hotelList'); if (!el) return;
    el.innerHTML = ordered().map(function (x, oi) {
      var base = x.variantOf ? hotel(x.variantOf) : null, pics = (x.imgs && x.imgs.length) ? x.imgs : (base && base.imgs) || [], hid = (x.imgs && x.imgs.length) ? x.id : (base ? base.id : x.id);
      var slides = pics.map(function (u, i) { return '<img loading="' + (i ? 'lazy' : 'eager') + '" src="' + esc(img(u, 1000)) + '" srcset="' + esc(img(u, 700)) + ' 700w, ' + esc(img(u, 1000)) + ' 1000w, ' + esc(img(u, 1400)) + ' 1400w" sizes="(max-width:900px) 100vw, 600px" alt="' + esc(x.name) + ' photo ' + (i + 1) + '" data-h="' + esc(hid) + '" data-i="' + i + '">'; }).join('');
      return '<article class="hotel' + (x.variantOf ? ' variant' : '') + (x.package ? ' pk' : '') + '" id="h-' + esc(x.id) + '"><div class="hotel-grid"><div class="slider"><div class="track">' + slides + '</div>'
        + (x.badge ? '<span class="badge">' + esc(x.badge) + '</span>' : '')
        + '<button class="arr l" type="button" aria-label="Previous photo" data-dir="-1">&#8249;</button><button class="arr r" type="button" aria-label="Next photo" data-dir="1">&#8250;</button>'
        + '<button class="zoom" type="button" data-zoom="' + esc(x.id) + '">View full screen</button><span class="count">1 / ' + (x.imgs || []).length + '</span></div>'
        + '<div class="hb">' + (x.package && multi ? '<div class="optl">' + esc(x.optionLabel || ('Option ' + (x.match || oi + 1))) + '</div>' + (x.variantOf && x.badge ? '<div class="vbadge">' + esc(x.badge) + '</div>' : '') : '') + '<div class="area">' + esc(x.area) + (x.country ? ', ' + esc(x.country) : '') + '</div><h3>' + esc(x.name) + '</h3>'
        + (x.rating ? '<div class="rating">' + dots(x.rating) + '<span><b>' + x.rating.toFixed(1) + '</b> on Tripadvisor' + (x.reviews ? ', ' + esc(x.reviews) + ' reviews' : '') + '</span></div>' : '')
        + '<p class="why">' + esc(x.why) + '</p>' + ((x.story || (base && base.story)) ? '<p class="story">' + esc(x.story || base.story) + '</p>' : '') + (x.package ? '<button class="mbtn" type="button" data-tog="more" aria-expanded="false"><span class="m1">About the resort</span><span class="m2">About the resort</span></button>' : '')
        + '<div class="feat">' + (x.feats || []).map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + (x.transfer ? '<span>Transfer ' + mins(x.transfer) + '</span>' : '') + '</div>'
        + (x.rooms ? '<p class="rooms"><b>Your rooms:</b> ' + esc(x.rooms) + (x.board ? ', ' + esc(x.board) : '') + '</p>' : '')
        + '<div class="price"><div><small>TOTAL FOR ' + esc(party.toUpperCase()) + '</small><div class="big">' + gbp(x.total) + '</div></div><div class="r">' + (x.pp ? gbp(x.pp) + (x.free ? ' per paying person<br><span class="freec">' + x.free + ' free child place' + (Number(x.free) === 1 ? '' : 's') + ' included</span><br>' : ' per person<br>') : '') + esc(x.deposit || '') + (function () { if (!Q.departDate) return ''; var mp = ddPlan(Math.max(0, x.total - depOf(x)), Q.departDate, 1); return mp.ok ? '<br><a href="#calc" class="monthly">then about ' + money(mp.each) + ' a month</a>' : ''; })() + '</div>' + (taxText(x) ? '<p class="tax">' + esc(taxText(x)) + '</p>' : '') + '</div>'
        /* optional in-card upgrade, e.g. a resort's deluxe collection: { title, text, perks: [], options: [{ name, price }], note } */
        /* upgrade.button (optional): the upgrade box stays closed behind a button on the card. option.extra links an option to an extras id so it can be added straight from the card */
        + (x.upgrade && x.upgrade.options && x.upgrade.options.length && x.upgrade.button ? '<button class="btn btn-upg" type="button" data-upg="' + esc(x.id) + '" aria-expanded="false">' + esc(x.upgrade.button) + ' <span class="upgc" aria-hidden="true">&#9662;</span></button>' : '')
        + (x.upgrade && x.upgrade.options && x.upgrade.options.length ? '<div class="upg"' + (x.upgrade.button ? ' id="upg-' + esc(x.id) + '" hidden' : '') + '><div class="upgh">' + esc(x.upgrade.title || 'Upgrade option') + '</div>' + (x.upgrade.text ? '<p>' + esc(x.upgrade.text) + '</p>' : '')
          + (x.upgrade.perks && x.upgrade.perks.length ? '<ul>' + x.upgrade.perks.map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('') + '</ul>' : '')
          + x.upgrade.options.map(function (o) { return '<div class="upo"><span class="un">' + esc(o.name) + (o.extra ? '<button class="upadd' + (sel[o.extra] ? ' on' : '') + '" type="button" data-upgadd="' + esc(o.extra) + '" data-hid="' + esc(x.id) + '">' + (sel[o.extra] ? 'Added, tap to remove' : 'Add to my holiday') + '</button>' : '') + '</span><span class="up"><b>+' + gbp(o.price) + '</b><small>total ' + gbp(Math.round((Number(x.total) + Number(o.price)) * 100) / 100) + ' for ' + esc(party) + '</small></span></div>'; }).join('')
          + (x.upgrade.note ? '<p class="upn">' + esc(x.upgrade.note) + '</p>' : '') + '</div>' : '')
        + '<div class="links"><a class="btn btn-y bk" href="#feedback" data-pick="book" data-hotel="' + esc(x.id) + '">' + (x.package ? 'Book this one' : 'I like this one') + '</a>' + (x.package && multi ? '<button type="button" class="rmopt" data-rm="' + esc(x.id) + '">Remove this option</button>' : '')
        + (x.site ? '<a class="btn btn-o" target="_blank" rel="noopener" href="' + esc(x.site) + '">Hotel website</a>' : '') + '</div></div></div>' + pkgHtml(x) + '</article>';
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
  var sSel = document.getElementById('sortSel');
  if (sSel) sSel.addEventListener('change', function () { sortKey = sSel.value; Array.prototype.forEach.call(document.querySelectorAll('[data-sort]'), function (x) { x.setAttribute('aria-pressed', String(x.dataset.sort === sortKey)); }); renderTable(); renderHotels(); if (typeof deckRefresh === 'function') deckRefresh(); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-sort]'), function (b) {
    b.addEventListener('click', function () { sortKey = b.dataset.sort; if (sSel) sSel.value = sortKey; Array.prototype.forEach.call(document.querySelectorAll('[data-sort]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); renderTable(); renderHotels(); if (typeof deckRefresh === 'function') deckRefresh(); });
  });
  var so = document.getElementById('slidesOnly');
  if (so) so.addEventListener('click', function () { slidesOnly = !slidesOnly; so.setAttribute('aria-pressed', String(slidesOnly)); renderTable(); renderHotels(); });
  renderTable(); renderHotels();
  /* area guides: written once, matched to a hotel by its name and area. A hotel can override with areaKey, or with its own resort details. */
  var AREA_GUIDES = [
    { k: 'ovacik', m: /ovacik|hisaronu|oludeniz/, t: 'Ovacik and Oludeniz, Turkey', i: 'A hillside village a few minutes inland from the famous Oludeniz lagoon, with its own little strip of shops, restaurants and bars. It is greener and calmer than the beach resorts, with mountain views all around.',
      eat: ['Turkish grills, pide and gozleme in the village restaurants', 'Fresh fish and sea view dinners down at Oludeniz', 'Turkish tea, baklava and ice cream from the village cafes'],
      feel: ['Relaxed and friendly, with a lively little strip for the evenings', 'Hilly, so most people use the dolmus minibus or a taxi to reach the beach', 'Mountain scenery and cooler evenings than the coast'],
      near: [['about 10 mins', 'Oludeniz Blue Lagoon', 'A sheltered turquoise lagoon and one of the best beaches in Turkey'], ['about 15 mins', 'Hisaronu', 'Busier bars, shops and restaurants for a night out'], ['about 25 mins', 'Fethiye', 'Harbour, markets and boat trips to the islands'], ['about 30 mins', 'Butterfly Valley', 'A hidden beach reached by boat, with a waterfall walk']] },
    { k: 'marmaris', m: /marmaris|icmeler/, t: 'Marmaris, Turkey', i: 'A lively harbour town on a wide bay ringed by pine covered mountains. There is a pretty old town with a castle above the marina, a big bazaar and a long seafront promenade, with calmer Icmeler just around the headland.',
      eat: ['Fish and meze restaurants along the harbour and promenade', 'Kebabs, pide and fresh Turkish bread in the old town', 'Bazaar cafes for Turkish coffee and baklava'],
      feel: ['A real town rather than a resort, so there is plenty going on', 'Famous Bar Street for lively nights if you want them, easy to avoid if you do not', 'Easy to get around by dolmus minibus and water taxi'],
      near: [['about 10 mins', 'Marmaris Old Town and castle', 'Whitewashed lanes, the bazaar and views over the bay'], ['about 15 mins', 'Icmeler', 'A smaller, calmer beach resort with a promenade of restaurants'], ['about 40 mins', 'Turunc', 'A pretty bay reached by road or boat'], ['around 1.5 hours', 'Dalyan', 'River boat to the Lycian rock tombs and Iztuzu turtle beach']] },
    { k: 'protaras', m: /protaras|paralimni|ayia napa|agia napa/, t: 'Protaras, Cyprus', i: 'A relaxed resort on the east coast of Cyprus, built around a string of sandy bays with clear, shallow water, including Fig Tree Bay and Sunrise Beach. It is lively without being rowdy, with a promenade of shops, restaurants and bars.',
      eat: ['Cypriot meze of halloumi, grilled meats and fresh fish in the seafront tavernas', 'Casual beach cafes at Fig Tree Bay for lunch and ice cream', 'Wider choice of restaurants in nearby Ayia Napa'],
      feel: ['Easy going and very family friendly', 'Evenings are friendly rather than wild, much quieter than Ayia Napa', 'Flat and walkable along the seafront'],
      near: [['about 5 mins', 'Fig Tree Bay', 'A sheltered golden beach and one of the island favourites'], ['about 15 mins', 'Cape Greco', 'Sea caves, cliff walks and snorkelling in a national park'], ['about 15 mins', 'Ayia Napa', 'Beaches, the harbour and a busier choice of bars and restaurants'], ['about 25 mins', 'Deryneia viewpoint', 'A look across to the abandoned beach town of Varosha']] },
    { k: 'limassol', m: /limassol/, t: 'Limassol, Cyprus', i: 'Cyprus\'s lively second city, with a long seafront promenade, a smart marina and a pretty old town. The hotels sit along the beach strip, so you are never far from restaurants, bars and shops.',
      eat: ['Cypriot meze in the old town tavernas', 'Fish restaurants and waterfront cafes along the promenade', 'Limassol Marina for a wider choice of restaurants'],
      feel: ['A proper city with a resort strip, so there is always something to do', 'Good evenings out, from relaxed tavernas to cocktail bars', 'Pebbly and sandy mix on the beaches, with calm water'],
      near: [['about 15 mins', 'Limassol Old Town and castle', 'Narrow streets, markets and the medieval castle'], ['about 15 mins', 'Limassol Marina', 'Restaurants, bars and boats along the waterfront'], ['about 25 mins', 'Kourion', 'Ancient Greek and Roman ruins above the sea'], ['about 40 mins', 'Aphrodite\'s Rock', 'The legendary birthplace of Aphrodite, on a dramatic stretch of coast']] },
    { k: 'paphos', m: /paphos|pafos/, t: 'Paphos, Cyprus', i: 'A relaxed seaside town on the west coast of Cyprus, with a pretty harbour, a medieval fort and some of the best ancient ruins on the island. Kato Paphos is the tourist area by the sea, with restaurants, bars and shops all within an easy walk.',
      eat: ['Fish tavernas and meze restaurants around the harbour', 'Souvlaki, halloumi and slow cooked kleftiko in the village style tavernas', 'Harbour cafes for sunset drinks'],
      feel: ['Laid back and good for couples and families', 'Plenty of history on the doorstep as well as beaches', 'Easy to walk or take a short taxi between areas'],
      near: [['about 10 mins', 'Paphos Archaeological Park', 'Roman mosaics and ruins, a UNESCO World Heritage Site'], ['about 10 mins', 'Tombs of the Kings', 'Grand underground tombs carved into the rock by the sea'], ['about 30 mins', 'Aphrodite\'s Rock', 'A famous sea stack and swimming spot'], ['about 45 mins', 'Akamas and the Blue Lagoon', 'Boat trips and snorkelling at the tip of the peninsula']] },
    { k: 'ari', m: /ari atoll|villa park|sun island/, t: 'South Ari Atoll, Maldives', i: 'You stay on your own small island in the middle of the atoll, ringed by white sand, a shallow turquoise lagoon and a coral reef. There are no cars or crowds, just barefoot days and spectacular sunsets.',
      eat: ['Buffet and a la carte dining at the island restaurants', 'Fresh Maldivian tuna, curries and mas huni at breakfast', 'Sunset drinks at the beach bar'],
      feel: ['Quiet, barefoot and very relaxing', 'The evenings are at the hotel, with live music and themed nights', 'Warm sea all year, with the best snorkelling right from the beach'],
      near: [['on the island', 'House reef snorkelling', 'Colourful fish and often turtles just off the beach'], ['half day trip', 'Sandbank picnic', 'A tiny sandbank in the middle of the ocean by boat'], ['half day trip', 'Dolphin cruise', 'Boat trips at sunset to spot dolphins'], ['full day trip', 'Whale shark snorkelling', 'South Ari Atoll is one of the best places in the world to see whale sharks']] },
    { k: 'lhaviyani', m: /lhaviyani|kuredu/, t: 'Lhaviyani Atoll, Maldives', i: 'One of the larger resort islands in the Maldives, a long strip of white sand surrounded by a reef and a calm lagoon. It is known for its diving and snorkelling, and for being relaxed, friendly and good value for the Maldives.',
      eat: ['Buffet restaurants and a la carte dining on the island', 'Fresh seafood and Maldivian curries', 'Beach bars for cocktails at sunset'],
      feel: ['Barefoot and easy going, with space to spread out', 'Great for snorkelling, diving and water sports', 'Evenings are at the resort with entertainment and bars'],
      near: [['on the island', 'House reef', 'Snorkel straight from the beach, with turtles and reef sharks often seen'], ['half day trip', 'Local island visit', 'See everyday Maldivian life and the village shops'], ['half day trip', 'Dolphin and sunset cruise', 'A boat trip over the lagoon at golden hour'], ['full day trip', 'Diving and snorkelling trips', 'Some of the best reef sites in the Maldives']] },
    { k: 'kantaoui', m: /kantaoui/, t: 'Port El Kantaoui, Tunisia', i: 'A purpose built resort a short way north of Sousse, centred on a pretty marina lined with cafes, restaurants and shops. It feels smarter and calmer than most of Tunisia\'s resorts, with golf courses and long sandy beaches close by.',
      eat: ['Marina restaurants serving fresh fish, grills and couscous', 'Tunisian pastries and mint tea at the harbour cafes', 'Pizza and international food along the promenade'],
      feel: ['Safe, tidy and easy to stroll around', 'Calm evenings, with a few bars and live music along the marina', 'A little train and taxis link the hotels with the marina'],
      near: [['about 5 mins', 'Port El Kantaoui marina', 'Boats, restaurants and a lovely evening walk'], ['about 15 mins', 'Sousse Medina', 'A walled old town with a fortress, souks and a great mosque'], ['about 30 mins', 'Monastir', 'A seaside town with a huge ribat fortress and the Bourguiba Mausoleum'], ['about 1 hour', 'El Jem', 'A spectacular Roman amphitheatre, almost as big as the Colosseum']] },
    { k: 'sousse', m: /sousse/, t: 'Sousse, Tunisia', i: 'Tunisia\'s liveliest holiday city, with a long sandy beach, a UNESCO listed old town and a busy hotel strip. There is plenty to do in the evenings, and the medina is only a short taxi ride away.',
      eat: ['Tunisian dishes such as brik, couscous and grilled fish in the medina', 'Seafront restaurants along the beach', 'Fresh pastries, mint tea and strong coffee at the cafes'],
      feel: ['Busy and lively, with lots of choice for nights out', 'Best to take taxis after dark, which are cheap', 'A good mix of beach days and sightseeing'],
      near: [['about 10 mins', 'Sousse Medina', 'A walled old town with a fortress, souks and a great mosque'], ['about 10 mins', 'Port El Kantaoui', 'A pretty marina with cafes, restaurants and boat trips'], ['about 30 mins', 'Monastir', 'A seaside town with a huge ribat fortress and the Bourguiba Mausoleum'], ['about 1 hour', 'El Jem', 'A spectacular Roman amphitheatre, almost as big as the Colosseum']] },
    { k: 'monastir', m: /monastir|skanes/, t: 'Skanes and Monastir, Tunisia', i: 'A quieter hotel zone on a long, wide sandy beach just outside Monastir, beside the lagoon at Skanes. The old town of Monastir is close by, with a big seafront fortress, and the airport is only minutes away.',
      eat: ['Tunisian grills, couscous and fish in Monastir town', 'Cafes for mint tea and pastries on the seafront', 'Most hotels have several restaurants to choose from'],
      feel: ['Calm and relaxed, with a hotel zone feel', 'Evenings are mostly at the hotel, with taxis into Monastir', 'A long sandy beach with plenty of space'],
      near: [['about 10 mins', 'Monastir Old Town and Ribat', 'A sea fortress where parts of Life of Brian were filmed'], ['about 10 mins', 'Bourguiba Mausoleum', 'A grand golden domed tomb at the heart of the town'], ['about 20 mins', 'Sousse', 'The medina, souks and a lively seafront'], ['about 1 hour', 'El Jem', 'A spectacular Roman amphitheatre']] },
    { k: 'hammamet', m: /hammamet/, t: 'Hammamet, Tunisia', i: 'Tunisia\'s original beach resort, set on a sweeping bay lined with white sand, jasmine and orange blossom. It has a pretty walled medina right on the sea and a modern marina at Yasmine Hammamet.',
      eat: ['Fish and seafood restaurants in the old town and marina', 'Tunisian couscous, brik and grills', 'Cafes for mint tea and pastries'],
      feel: ['A softer, more upmarket resort feel than Sousse', 'Good evenings in the medina and marina', 'Easy to explore by taxi'],
      near: [['about 10 mins', 'Hammamet Medina and Kasbah', 'A fortress and old town right on the seafront'], ['about 10 mins', 'Yasmine Hammamet', 'A modern marina with bars, restaurants and boat trips'], ['about 20 mins', 'Nabeul', 'Famous for its pottery and Friday market'], ['about 1 hour', 'Tunis and Carthage', 'The capital and its ancient Roman ruins']] },
    { k: 'mahdia', m: /mahdia/, t: 'Mahdia, Tunisia', i: 'A calm, authentic coastal town on a narrow peninsula, with a fishing harbour, a walled old town and a long sandy beach. It is much quieter than Sousse or Hammamet, so it suits a gentler holiday.',
      eat: ['Fresh grilled fish by the fishing harbour', 'Tunisian pastries and mint tea in the old town cafes', 'Hotel restaurants for relaxed evenings'],
      feel: ['Peaceful, with a local feel', 'Evenings are quiet, mostly at the hotel or a short taxi into town', 'A long, uncrowded beach'],
      near: [['about 10 mins', 'Mahdia Old Town', 'The old gate, the fishing harbour and the fortress'], ['about 10 mins', 'Cemetery by the sea', 'A beautiful cliff top spot for sunset'], ['about 45 mins', 'El Jem', 'A spectacular Roman amphitheatre'], ['about 1 hour', 'Monastir', 'A seaside town with a famous ribat fortress']] },
    { k: 'miches', m: /miches/, t: 'Miches, Dominican Republic', i: 'A quiet, unspoilt stretch of the north east coast, far from the crowds of Punta Cana. Think long empty beaches, palm trees, lagoons and green hills, with a very peaceful feel.',
      eat: ['Fresh seafood and Dominican dishes such as mofongo and la bandera', 'Local beach cafes for fried fish', 'Resort restaurants for most evening meals'],
      feel: ['Remote and peaceful, a true escape', 'Evenings are at the resort, with little else around', 'Best for people who want to relax rather than go out'],
      near: [['about 15 mins', 'Miches town', 'A small local town with simple restaurants'], ['about 30 mins', 'Laguna Redonda and Laguna Limon', 'Peaceful lagoons ringed by mangroves and beach'], ['about 1 hour', 'Los Haitises National Park', 'Boat trips among caves, mangroves and wildlife'], ['about 1.5 hours', 'Punta Cana', 'The airport and the main resort area']] },
    { k: 'bavaro', m: /bavaro|punta cana/, t: 'Bavaro, Punta Cana', i: 'Mile after mile of white sand and palm trees, with the warm Caribbean on one side and the big all inclusive resorts spread along the coast. Most things you need are inside the resort, with shops, restaurants and day trips a short drive away.',
      eat: ['Resort restaurants and a la carte dining included in your stay', 'Dominican food such as mofongo, la bandera and fresh seafood', 'Beach bars and restaurants in Bavaro town'],
      feel: ['Relaxed and sociable, with an all inclusive feel', 'Most evenings are at the resort, with shows and live music', 'Taxis and excursions are easy to arrange'],
      near: [['about 10 mins', 'Palma Real Shopping Village', 'An open air centre with shops and restaurants'], ['about 20 mins', 'Bavaro town', 'Beach bars, shops and local restaurants'], ['full day trip', 'Saona Island', 'A catamaran trip to a white sand island and natural pool'], ['about 1 hour', 'Altos de Chavon', 'A recreated Mediterranean village with an amphitheatre']] },
    { k: 'akumal', m: /akumal|riviera maya|tulum/, t: 'Akumal, Riviera Maya', i: 'A small, laid back bay on the Mexican Caribbean, whose name means place of the turtles. It is quiet and green, with a calm bay for swimming and snorkelling and the busier towns of the Riviera Maya close by.',
      eat: ['Fresh seafood, tacos and Mexican dishes at the beach cafes', 'Resort restaurants for most evenings', 'More choice in Playa del Carmen and Tulum'],
      feel: ['Peaceful, with a Caribbean beach town feel', 'Evenings are quiet, mostly at the resort', 'Great for nature, snorkelling and day trips'],
      near: [['about 5 mins', 'Akumal Bay', 'Snorkel with green turtles in the shallows'], ['about 15 mins', 'Xel-Ha', 'A natural water park with snorkelling and rivers'], ['about 25 mins', 'Tulum ruins', 'A Mayan city on a cliff above the sea'], ['about 35 mins', 'Playa del Carmen', 'Fifth Avenue for shopping, bars and restaurants']] },
    { k: 'cancun', m: /cancun/, t: 'Cancun, Mexico', i: 'A long, thin strip of land between the Caribbean and a lagoon, packed with beaches, resorts, restaurants and nightlife. It is lively, with the airport close and some of Mexico\'s best day trips within reach.',
      eat: ['Mexican tacos, ceviche and fresh seafood at lagoon side restaurants', 'Large choice of restaurants along the hotel zone', 'Resort dining for most meals'],
      feel: ['Lively and well set up for visitors', 'Good nightlife, with Coco Bongo the famous party show', 'Buses and taxis run along the hotel zone'],
      near: [['about 10 mins', 'Hotel zone shops and restaurants', 'Malls, bars and beach clubs along the strip'], ['about 25 mins', 'Isla Mujeres', 'Ferry to a laid back island with clear water'], ['about 30 mins', 'Cancun downtown', 'Local markets and Mexican restaurants'], ['around 2.5 hours', 'Chichen Itza', 'The world famous Mayan pyramid, as a day trip']] },
    { k: 'qawra', m: /qawra|bugibba|st paul/, t: 'Qawra and Bugibba, Malta', i: 'A lively seaside resort on the north east coast of Malta, with a long promenade of restaurants, shops and bars. The sea here is clear and the shoreline is rocky, with lidos and swimming platforms rather than sandy beaches.',
      eat: ['Maltese dishes such as rabbit stew, pastizzi and fresh fish', 'Promenade restaurants overlooking the bay', 'Bugibba Square for a wide choice of restaurants and bars'],
      feel: ['Busy and sociable, with plenty going on in the evenings', 'Very easy to walk along the seafront', 'Buses to Valletta and the rest of the island are frequent'],
      near: [['about 5 mins', 'National Aquarium', 'A big aquarium right on the Qawra seafront'], ['about 25 mins', 'Mdina', 'The silent city, a walled medieval town with rooftop views'], ['about 40 mins', 'Valletta', 'The capital, with palaces, churches and harbour views'], ['about 45 mins', 'Gozo', 'Ferry from Cirkewwa to the greener, quieter sister island']] },
    { k: 'alanya', m: /alanya|antalya|konakli|okurcalar/, t: 'The Alanya coast, Turkey', i: 'A long stretch of the Turkish Riviera, with sandy beaches, mountains behind and a lively harbour town at its heart. The hotels are mostly big, well equipped resorts, so most days are spent by the pool or on the beach.',
      eat: ['Turkish kebabs, pide and gozleme', 'Fresh fish in the harbour restaurants', 'Baklava, Turkish ice cream and strong tea in the cafes'],
      feel: ['Relaxed and very family friendly', 'Evenings are mostly at the resort, with shows and entertainment', 'Alanya town has lots to choose from for a night out'],
      near: [['about 30 mins', 'Alanya Castle', 'A hilltop fortress with views over the whole coast'], ['about 30 mins', 'Cleopatra Beach', 'A golden beach with calm water in Alanya'], ['about 45 mins', 'Side', 'Roman ruins beside a pretty harbour'], ['about 1 hour', 'Manavgat Waterfall', 'A waterfall with a river boat trip nearby']] },
    { k: 'praia', m: /praia da rocha|algarve|portimao/, t: 'Praia da Rocha, Algarve', i: 'One of the Algarve\'s most famous beaches, a wide golden bay backed by red cliffs and rock formations. The resort is lively but never rowdy, with a promenade of cafes and restaurants overlooking the sea.',
      eat: ['Grilled sardines, cataplana seafood stew and piri piri chicken', 'Clifftop restaurants with sea views', 'Pastel de nata and coffee in the beach cafes'],
      feel: ['Relaxed and friendly, with good evenings out', 'The strip has bars and restaurants all within walking distance', 'Wide, sandy beach with plenty of space'],
      near: [['about 5 mins', 'Portimao', 'A busy town with a fishing quay and sardine restaurants'], ['about 25 mins', 'Lagos', 'A pretty old town, beaches and boat trips'], ['about 30 mins', 'Benagil Caves', 'A boat or kayak trip into the famous sea cave'], ['about 35 mins', 'Albufeira', 'The Algarve\'s liveliest resort, with a busy old town']] },
    { k: 'faliraki', m: /faliraki|rhodes/, t: 'Faliraki, Rhodes', i: 'Rhodes\'s liveliest resort, with a long sandy beach, a huge water park and a busy strip of bars and restaurants. There is plenty to do for families by day and for a lively night out after dark.',
      eat: ['Greek tavernas for souvlaki, moussaka and Greek salad', 'Fresh fish along the beach', 'Cafes for frappe and Greek ice cream'],
      feel: ['Lively and sociable, with lots going on', 'Easy to dip in and out of the busy strip', 'Buses and taxis make Rhodes Town easy to reach'],
      near: [['about 5 mins', 'Faliraki Water Park', 'One of the biggest water parks in Greece'], ['about 10 mins', 'Kallithea Springs', 'A restored 1920s spa with a swimming bay'], ['about 20 mins', 'Rhodes Old Town', 'A medieval walled city with the Palace of the Grand Master'], ['about 40 mins', 'Lindos', 'A whitewashed village below an ancient acropolis']] },
    { k: 'adeje', m: /adeje|tenerife/, t: 'Costa Adeje, Tenerife', i: 'The smartest resort on Tenerife\'s sunny south coast, with a long seafront promenade, calm beaches and lots of restaurants. It is polished, safe and family friendly, with Siam Park, one of the world\'s best water parks, close by.',
      eat: ['Fresh fish and Canarian dishes such as papas arrugadas with mojo sauce', 'Restaurants along the promenade and at Playa del Duque', 'Puerto Colon marina for waterside dining'],
      feel: ['Polished and calm, with a lot of choice', 'Good for families and couples', 'Easy to walk along the promenade between the beaches'],
      near: [['about 10 mins', 'Siam Park', 'A top rated water park with wave pools and slides'], ['about 10 mins', 'Puerto Colon', 'Marina with boat trips to see whales and dolphins'], ['about 1 hour', 'Masca', 'A dramatic mountain village with walking trails'], ['about 1.25 hours', 'Mount Teide', 'Spain\'s highest peak, with cable car and volcanic scenery']] },
    { k: 'jerseycity', m: /jersey city/, t: 'Jersey City, New Jersey', i: 'Just across the Hudson River from Manhattan, with some of the best skyline views anywhere. It is a lively city in its own right, with great restaurants, a waterfront walk and a fast train into New York.',
      eat: ['Great pizza, Indian and Latin restaurants, often much cheaper than Manhattan', 'Grove Street Plaza for lots of places in one spot', 'Waterfront cafes with views of the skyline'],
      feel: ['Lively and friendly, with a local feel', 'The skyline views at night are fantastic', 'Quieter and better value than staying in Manhattan'],
      near: [['about 10 mins', 'PATH train to Manhattan', 'Straight to the World Trade Center or Midtown'], ['about 10 mins', 'Liberty State Park', 'Ferries to the Statue of Liberty and Ellis Island'], ['about 10 mins', 'Hudson River waterfront walk', 'A lovely walk with skyline views'], ['about 20 mins', 'Hoboken', 'A pretty town with bars, restaurants and Frank Sinatra\'s birthplace']] },
    { k: 'weehawken', m: /weehawken|lincoln harbor/, t: 'Lincoln Harbor, Weehawken', i: 'A smart waterfront district on the Hudson, directly across from Midtown Manhattan. The skyline views are among the best, and a short ferry takes you straight into the city.',
      eat: ['Waterfront restaurants along the harbour walk', 'More choice in nearby Hoboken', 'Manhattan is a short ferry ride away for dinner'],
      feel: ['Quiet and tidy, with a waterfront walk', 'Great views of the Manhattan skyline', 'A calm base to come back to after busy days in New York'],
      near: [['about 10 mins', 'Ferry to Midtown', 'A short ride across the river to West 39th Street'], ['about 10 mins', 'Port Imperial waterfront', 'A long riverside walk with restaurants'], ['about 15 mins', 'Hoboken', 'A pretty town with bars, restaurants and parks'], ['about 25 mins', 'Times Square', 'Straight into the heart of New York']] },
    { k: 'orlando', m: /international drive|orlando/, t: 'International Drive, Orlando', i: 'Orlando\'s busiest tourist strip, packed with restaurants, shops and attractions, with the big theme parks close by. It is well set up for families, with free trolleys and a huge choice of food.',
      eat: ['Huge choice of restaurants, from burgers and steaks to Asian and Italian', 'Restaurant Row on Sand Lake Road for something special', 'ICON Park and Pointe Orlando for evening meals'],
      feel: ['Busy, lively and very well set up for visitors', 'Plenty of shops and attractions within a short ride', 'A hire car or taxi helps for the parks, though free trolleys run along International Drive'],
      near: [['about 10 mins', 'ICON Park', 'A giant observation wheel, shops and restaurants'], ['about 10 mins', 'SeaWorld Orlando', 'Rides, shows and marine life'], ['about 15 mins', 'Universal Orlando', 'Harry Potter, Volcano Bay and thrill rides'], ['about 25 mins', 'Walt Disney World', 'Magic Kingdom, EPCOT, Animal Kingdom and Hollywood Studios']] }
  ];
  function areaGuideFor(x) {
    if (x.areaKey) { var g = AREA_GUIDES.filter(function (a) { return a.k === x.areaKey; })[0]; if (g) return g; }
    var text = ((x.area || '') + ' ' + (x.name || '')).toLowerCase();
    for (var i = 0; i < AREA_GUIDES.length; i++) if (AREA_GUIDES[i].m.test(text)) return AREA_GUIDES[i];
    return null;
  }
  /* turn a hotel's own resort details into the same shape, so Madeira and others can use their own */
  function areaGuideFromResort(x, r) {
    var eat = (r.eat || []).concat(r.bars || []);
    return { t: 'The area around ' + x.name, i: r.town || '', eat: eat, feel: [], near: (r.nearby || []).map(function (n) { return ['', n, '']; }) };
  }
  function areaGuideHtml(g) {
    if (!g) return '';
    var h = '<div class="ag"><h3>' + esc(g.t) + '</h3><div class="agh">The area around your hotel</div>';
    if (g.i) h += '<p class="agi">' + esc(g.i) + '</p>';
    var cols = [];
    if (g.eat && g.eat.length) cols.push('<div class="agb"><h4>Eat and drink</h4><ul>' + g.eat.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>');
    if (g.feel && g.feel.length) cols.push('<div class="agb safe"><h4>What it is like</h4><ul>' + g.feel.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>');
    if (cols.length) h += '<div class="aggrid' + (cols.length === 1 ? ' one' : '') + '">' + cols.join('') + '</div>';
    if (g.near && g.near.length) h += '<div class="agnb"><h4>Nearby, for a day out</h4><div class="nbl">' + g.near.map(function (n) { return '<div class="nbr">' + (n[0] ? '<span class="nbt">' + esc(n[0]) + '</span>' : '') + '<div><b class="nbn">' + esc(n[1]) + '</b>' + (n[2] ? '<span class="nbd">' + esc(n[2]) + '</span>' : '') + '</div></div>'; }).join('') + '</div></div>';
    return h + '</div>';
  }

  /* swipe through mode for package quotes: intro, one option at a time (stay, things to do, weather, extras, pay), then decide */
  function deck() {
    function A() { return Array.prototype.slice.call(document.querySelectorAll('#hotelList article.hotel')); }
    if (!A().length) return;
    var N = A().length, view = 0, tab = 'stay', body = document.body, LAST = N + 2;
    function sync() { N = A().length; LAST = N + 2; }
    body.classList.add('deck');
    function hIndex(art) { var id = art.id.replace(/^h-/, ''), r = 0; hotels.forEach(function (h, i) { if (h.id === id) r = i; }); return r; }
    var bar = document.createElement('div'); bar.id = 'dbar';
    bar.innerHTML = '<button type="button" class="dback" id="dBack"></button><div class="dmid" id="dMid"></div><button type="button" class="dnext" id="dNext"></button>';
    document.body.appendChild(bar);
    var tabs = document.createElement('div'); tabs.className = 'dtabs'; tabs.id = 'dTabs';
    tabs.innerHTML = [['stay', 'Stay and flights'], ['about', 'About this holiday'], ['extras', 'Extras'], ['more', 'More info'], ['pay', 'Price and payments']].map(function (t) { return '<button type="button" data-dt="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    var KNOWN = ['compare', 'hotels', 'trip', 'weather', 'todo', 'extras', 'next'];
    Array.prototype.forEach.call(document.querySelectorAll('#app > section'), function (s) { if (KNOWN.indexOf(s.id) < 0 && !s.querySelector('.custom .ag')) s.classList.add('xsec'); });
    var hasMore = !!document.querySelector('.xsec');
    var hs = document.getElementById('hotels'); hs.parentNode.insertBefore(tabs, hs);
    var prog = document.createElement('div'); prog.className = 'dprog'; prog.id = 'dProg'; bar.insertBefore(prog, bar.firstChild);
    /* about the resort panel: the hotel's own write up, resort information and things to do */
    var about = document.createElement('div'); about.id = 'aboutR'; about.className = 'aboutr';
    var todo = document.getElementById('weather') || document.getElementById('todo'); if (todo) todo.parentNode.insertBefore(about, todo);
    var areaG = document.createElement('div'); areaG.id = 'areaG'; areaG.className = 'areag';
    var cg = document.querySelector('.custom .ag'), cgs = cg ? cg.closest('section') : null;
    if (cgs) { cgs.classList.add('areag'); areaG = cgs; }
    var anchor = document.getElementById('todo') || document.getElementById('weather') || about;
    if (!cgs || anchor) anchor.parentNode.insertBefore(areaG, anchor.nextSibling);
    function has(id) { var s = document.getElementById(id); return !!s && !s.hidden; }
    function aboutHtml(x) {
      var bs = x.variantOf ? hotel(x.variantOf) : null, r = x.resort || (bs && bs.resort) || {}, h = '<div class="abt"><h3>About ' + esc(String(x.name).replace(/,\s*\d+ nights from.*$/, '')) + '</h3><p>' + esc(x.about || (bs && bs.about) || x.why || '') + '</p>';
      if (x.feats && x.feats.length) h += '<div class="feat">' + x.feats.map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</div>';
      if (x.rooms) h += '<div class="pkgr"><b>Your room</b><span>' + esc(x.rooms) + (x.board ? ', ' + esc(x.board) : '') + '</span></div>';
      return h + '</div>';
    }
    function render() {
      sync();
      var isOpt = view >= 2 && view <= N + 1;
      body.setAttribute('data-v', view === 0 ? 'welcome' : view === 1 ? 'glance' : isOpt ? 'opt' : 'final');
      body.setAttribute('data-tab', tab);
      if (isOpt) {
        var art = A()[view - 2], x = hotels[hIndex(art)];
        A().forEach(function (a, i) { a.hidden = i !== view - 2; });
        hIdx = hIndex(art); var c = document.getElementById('cHotel'); if (c) c.value = String(hIdx); calc();
        about.innerHTML = aboutHtml(x);
        if (!cgs) { var rs = x.resort || (x.variantOf && hotel(x.variantOf) ? hotel(x.variantOf).resort : null); areaG.innerHTML = areaGuideHtml(rs && rs.town ? areaGuideFromResort(x, rs) : areaGuideFor(x.variantOf && hotel(x.variantOf) ? hotel(x.variantOf) : x)); areaG.hidden = !areaG.innerHTML; }
        var wsec = document.getElementById('weather'); if (wsec) wsec.classList.toggle('wxnone', !document.querySelector('#wxList > *:not([hidden])'));
        /* custom area guides: show only the one for this option's hotel (hotel areaId, or its id) */
        var akey = 'ag-' + (x.areaId || x.variantOf || x.id), ags = document.querySelectorAll('.custom .ag[id^="ag-"]'), hit = !!document.getElementById(akey);
        Array.prototype.forEach.call(ags, function (g) { g.hidden = hit && g.id !== akey; });
        Array.prototype.forEach.call(document.querySelectorAll('.custom .agjump'), function (j) { j.hidden = hit; });
        var lk = art.querySelector('.links'), mb = art.querySelector('[data-tog=more]'); if (lk && mb && mb.parentNode !== lk) lk.appendChild(mb);
        wxPlaces.forEach(function (w) { var el = document.querySelector('[data-wx="' + w.key.replace(/"/g, '') + '"]'); if (el) el.hidden = w.hotels.indexOf(x.name) < 0; });
        var avail = { stay: true, about: true, extras: has('extras'), more: hasMore, pay: true };
        if (!avail[tab]) tab = 'stay'; body.setAttribute('data-tab', tab);
        Array.prototype.forEach.call(tabs.children, function (b) { b.hidden = !avail[b.dataset.dt]; b.classList.toggle('on', b.dataset.dt === tab); });
      }
      prog.innerHTML = Array.apply(null, Array(LAST + 1)).map(function (_, i) { return '<i class="' + (i === view ? 'on' : i < view ? 'done' : '') + '" data-go="' + i + '"></i>'; }).join('');
      var back = document.getElementById('dBack'), next = document.getElementById('dNext'), mid = document.getElementById('dMid');
      back.hidden = view === 0; next.hidden = view === LAST;
      back.innerHTML = '&#8249; ' + (view === 1 ? 'Welcome' : view === 2 ? 'All options' : view === LAST ? 'Options' : view === 0 ? '' : 'Option ' + (view - 2));
      next.innerHTML = (view === 0 ? (N === 1 ? 'See your holiday' : 'See your options') : view === 1 ? 'Option 1' : view === N + 1 ? 'Decide' : 'Option ' + (view - 0)) + ' &#8250;';
      mid.textContent = view === 0 ? '' : view === 1 ? 'At a glance' : view === LAST ? '' : (N === 1 ? 'Your holiday' : 'Option ' + (view - 1) + ' of ' + N);
    }
    /* make the photo as big as the screen allows so the whole card fits above the bottom bar */
    function fitPhoto() {
      if (view < 2 || view > N + 1 || tab !== 'stay') return;
      var art = A()[view - 2]; if (!art) return; var im = art.querySelector('.track img'); if (!im) return;
      art.style.setProperty('--ph', '150px');
      var top = art.getBoundingClientRect().top + window.scrollY - window.scrollY, avail = bar.getBoundingClientRect().top - top - 10;
      var rest = art.getBoundingClientRect().height - art.querySelector('.slider').getBoundingClientRect().height;
      art.style.setProperty('--ph', Math.max(150, Math.min(340, Math.floor(avail - rest))) + 'px');
    }
    window.addEventListener('resize', fitPhoto);
    /* keep the bottom bar on the visible screen when the browser bars hide */
    function dockBar() {
      var vv = window.visualViewport; if (!vv) return;
      var d = Math.round(vv.offsetTop + vv.height - document.documentElement.clientHeight);
      bar.style.transform = Math.abs(d) > 2 ? 'translateY(' + d + 'px)' : '';
    }
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', dockBar); window.visualViewport.addEventListener('scroll', dockBar); }
    window.addEventListener('scroll', dockBar, { passive: true }); window.addEventListener('resize', dockBar);
    setTimeout(dockBar, 300);
    /* open like an app when saved to the home screen */
    (function () {
      function meta(n, c) { if (document.querySelector('meta[name="' + n + '"]')) return; var m = document.createElement('meta'); m.name = n; m.content = c; document.head.appendChild(m); }
      meta('apple-mobile-web-app-capable', 'yes'); meta('mobile-web-app-capable', 'yes'); meta('apple-mobile-web-app-status-bar-style', 'black-translucent'); meta('apple-mobile-web-app-title', 'Your holiday quote'); meta('theme-color', '#004AAD');
      var vp = document.querySelector('meta[name="viewport"]'); if (vp && vp.content.indexOf('viewport-fit') < 0) vp.content += ', viewport-fit=cover';
      try {
        if (!document.querySelector('link[rel="manifest"]')) {
          var mf = { name: (Q.title || 'Your holiday quote'), short_name: 'Holiday quote', start_url: location.href.split('#')[0], scope: location.origin + '/', display: 'standalone', background_color: '#004AAD', theme_color: '#004AAD' };
          var l = document.createElement('link'); l.rel = 'manifest'; l.href = URL.createObjectURL(new Blob([JSON.stringify(mf)], { type: 'application/manifest+json' })); document.head.appendChild(l);
        }
      } catch (e) {}
    })();
    /* things to do: two columns on desktop, so show an even number (the last one drops out if the count is odd) */
    function evenTodo() {
      var cs = document.querySelectorAll('#todo .areacard'), wide = window.innerWidth > 900;
      Array.prototype.forEach.call(cs, function (c) { c.classList.remove('evenhide'); });
      if (wide && cs.length % 2) cs[cs.length - 1].classList.add('evenhide');
    }
    window.addEventListener('resize', evenTodo); evenTodo();
    var stage = document.getElementById('app');
    function go(v, dir) {
      v = Math.max(0, Math.min(LAST, v)); dir = dir || (v > view ? 1 : -1);
      if (v === 1 && N === 1) v = dir > 0 ? 2 : 0; view = v; tab = 'stay';
      stage.classList.remove('dgor', 'dgol'); void stage.offsetWidth; stage.classList.add(dir > 0 ? 'dgor' : 'dgol');
      render(); window.scrollTo(0, 0); fitPhoto();
    }
    function setTab(t) { tab = t; render(); window.scrollTo(0, 0); fitPhoto(); }
    document.getElementById('dBack').addEventListener('click', function () { go(view - 1); });
    document.getElementById('dNext').addEventListener('click', function () { go(view + 1); });
    tabs.addEventListener('click', function (e) { var b = e.target.closest('[data-dt]'); if (b) setTab(b.dataset.dt); });
    prog.addEventListener('click', function (e) { var d = e.target.closest('[data-go]'); if (d) go(Number(d.dataset.go)); });
    var toast = document.createElement('div'); toast.id = 'dtoast'; toast.hidden = true; document.body.appendChild(toast); var toastT = null;
    function showToast(msg, undoId) {
      toast.innerHTML = '<span>' + esc(msg) + '</span>' + (undoId ? '<button type="button" data-undo="' + esc(undoId) + '">Undo</button>' : '');
      toast.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { toast.hidden = true; }, 5000);
    }
    function refreshAll(toView) {
      renderTable(); renderHotels(); sync(); fixTitle();
      var rl = document.getElementById('rmNote');
      var n = Object.keys(removed).length;
      if (rl) { rl.hidden = !n; rl.innerHTML = n ? n + ' option' + (n > 1 ? 's' : '') + ' removed. <button type="button" data-restore="1">Show them again</button>' : ''; }
      view = Math.max(0, Math.min(LAST, toView)); render(); fitPhoto(); window.scrollTo(0, 0);
    }
    function fixTitle() { var W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'], t = document.querySelector('#compare .h2'); if (t && N >= 1 && N < 9) t.textContent = t.textContent.replace(/\b(one|two|three|four|five|six|seven|eight)\b/, W[N]); }
    var rmNote = document.createElement('p'); rmNote.id = 'rmNote'; rmNote.className = 'rmnote'; rmNote.hidden = true;
    var cmpWrap = document.querySelector('#compare .wrap'); if (cmpWrap) cmpWrap.appendChild(rmNote);
    document.addEventListener('click', function (e) {
      var rb = e.target.closest('[data-rm]'), ub = e.target.closest('[data-undo]'), rs = e.target.closest('[data-restore]');
      if (rb) {
        if (N <= 1) { showToast('You need to keep at least one option.'); return; }
        var id = rb.dataset.rm; removed[id] = 1; saveRm(); toast.hidden = true;
        refreshAll(view); showToast('Option removed', id); return;
      }
      if (ub) { delete removed[ub.dataset.undo]; saveRm(); refreshAll(1); toast.hidden = true; return; }
      if (rs) { removed = {}; saveRm(); refreshAll(1); return; }
    }, true);
    fixTitle(); var n0 = Object.keys(removed).length; if (n0) { var rl0 = rmNote; rl0.hidden = false; rl0.innerHTML = n0 + ' option' + (n0 > 1 ? 's' : '') + ' removed. <button type="button" data-restore="1">Show them again</button>'; }
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]'); var p = e.target.closest('[data-pick]'); var ab = e.target.closest('[data-tog=more]');
      if (ab) { e.stopImmediatePropagation(); setTab('about'); return; }
      if (p) { setTimeout(function () { go(LAST, 1); }, 0); return; }
      if (!a) return; var h = a.getAttribute('href') || '';
      if (/^#h-/.test(h)) { e.preventDefault(); var id = h.slice(3), k = -1; A().forEach(function (r, i) { if (r.id === 'h-' + id) k = i; }); if (k >= 0) go(k + 2, 1); }
      else if (h === '#extras') { e.preventDefault(); if (view >= 2 && view <= N + 1) setTab('extras'); }
      else if (h === '#fullCost') { e.preventDefault(); if (view >= 2 && view <= N + 1) setTab('pay'); }
      else if (h === '#feedback') { e.preventDefault(); go(LAST, 1); }
    }, true);
    document.addEventListener('keydown', function (e) { if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return; if (e.key === 'ArrowRight') go(view + 1); else if (e.key === 'ArrowLeft') go(view - 1); });
    var sx = null, sy = null;
    document.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; if (e.target.closest('.track,.areas,.lb,select,input,textarea,table,.dtabs,.pkgfl')) sx = null; }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (sx == null) return; var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) go(view + (dx < 0 ? 1 : -1));
    }, { passive: true });
    deckRefresh = function () { render(); fitPhoto(); };
    render(); fitPhoto();
  }
  var deckRefresh = null;
  if (pkgAll) deck();

  /* lightbox */
  var lbH = null, lbI = 0;
  function hotel(id) { for (var i = 0; i < hotels.length; i++) if (hotels[i].id === id) return hotels[i]; }
  var lbG = null; /* custom photo galleries (area guides) use their own list */
  function lbShow() { if (lbG) { var g = lbG[lbI], gi = document.getElementById('lbImg'); gi.src = g.src; gi.alt = g.cap; document.getElementById('lbCap').textContent = g.cap + '  ' + (lbI + 1) + ' / ' + lbG.length; return; } var x = hotel(lbH); var im = document.getElementById('lbImg'); im.src = img(x.imgs[lbI], 1800); im.alt = x.name + ' photo ' + (lbI + 1); document.getElementById('lbCap').textContent = x.name + '  ' + (lbI + 1) + ' / ' + x.imgs.length; }
  function lbOpen(id, i) { lbG = null; lbH = id; lbI = i || 0; lbShow(); document.getElementById('lb').classList.add('on'); document.body.style.overflow = 'hidden'; }
  function lbClose() { document.getElementById('lb').classList.remove('on'); document.body.style.overflow = ''; }
  function lbStep(d) { var n = lbG ? lbG.length : hotel(lbH).imgs.length; lbI = (lbI + d + n) % n; lbShow(); }
  var list = document.getElementById('hotelList');
  function upgSync() { Array.prototype.forEach.call(document.querySelectorAll('[data-upgadd]'), function (b) { var on = !!sel[b.dataset.upgadd]; b.classList.toggle('on', on); b.textContent = on ? 'Added, tap to remove' : 'Add to my holiday'; }); }
  if (list) list.addEventListener('click', function (e) {
    var tg = e.target.closest('[data-tog]');
    if (tg) { var art = tg.closest('.hotel'), cl = tg.dataset.tog === 'pkg' ? 'xpkg' : 'xmore'; art.classList.toggle(cl); tg.setAttribute('aria-expanded', String(art.classList.contains(cl))); return; }
  });
  if (list) list.addEventListener('click', function (e) {
    var ub = e.target.closest('[data-upg]');
    if (ub) { var box = document.getElementById('upg-' + ub.dataset.upg); if (box) { box.hidden = !box.hidden; ub.setAttribute('aria-expanded', String(!box.hidden)); } return; }
    var ua = e.target.closest('[data-upgadd]');
    if (ua) {
      var hi = -1; hotels.forEach(function (h, i) { if (h.id === ua.dataset.hid) hi = i; });
      if (hi >= 0) { hIdx = hi; var ch = document.getElementById('cHotel'); if (ch) ch.value = hi; }
      var cb = document.querySelector('[data-x="' + ua.dataset.upgadd + '"]');
      if (cb) { cb.checked = !sel[ua.dataset.upgadd]; cb.dispatchEvent(new Event('change')); }
      upgSync(); return;
    }
  });
  document.addEventListener('change', function (e) { if (e.target && e.target.dataset && e.target.dataset.x) upgSync(); });
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

  /* photo strips inside custom sections (area guides): arrows to flick through, tap a photo for full screen */
  Array.prototype.forEach.call(document.querySelectorAll('.custom .agstrip'), function (st) {
    var wrap = document.createElement('div'); wrap.className = 'agwrap'; st.parentNode.insertBefore(wrap, st); wrap.appendChild(st);
    ['l', 'r'].forEach(function (side) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'arr ' + side; b.setAttribute('aria-label', side === 'l' ? 'Previous photo' : 'Next photo'); b.innerHTML = side === 'l' ? '&#8249;' : '&#8250;';
      b.addEventListener('click', function () {
        var f = st.querySelector('figure'), w = f ? f.offsetWidth + 10 : 300, max = st.scrollWidth - st.clientWidth, nx = st.scrollLeft + (side === 'l' ? -w : w);
        if (nx > max + 5) nx = 0; else if (nx < -5) nx = max;
        st.scrollTo({ left: nx, behavior: 'smooth' });
      });
      wrap.appendChild(b);
    });
    var pics = Array.prototype.map.call(st.querySelectorAll('img'), function (im) { return { src: im.currentSrc || im.src, cap: im.alt }; });
    Array.prototype.forEach.call(st.querySelectorAll('img'), function (im, i) {
      im.style.cursor = 'zoom-in';
      im.addEventListener('click', function () { lbG = pics; lbI = i; lbShow(); document.getElementById('lb').classList.add('on'); document.body.style.overflow = 'hidden'; });
    });
  });

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
