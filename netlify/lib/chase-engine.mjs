// GENERATED from js/chase-engine.js by scripts/sync_chase_engine.py. Do not edit this copy.
const __root = {};
/* Chase engine for the Travel Agent Jake dashboard (browser) and the hourly sweep (Netlify). One rulebook, used in both places.
   Built from published sales follow-up research (checked 27 Oct 2026; many of the figures are vendor studies, so treat them as direction, not gospel):
   - Speed to lead: the first vendor to respond wins roughly 35 to 50 per cent of sales and conversion is far higher in the first minutes (InsideSales/XANT, Velocify).
   - Most sales need five or more follow-ups, yet most people stop after one or two (RAIN Group, Cirrus Insight round up).
   - Best returning cadence is about six touches over about three weeks, spaced three to four days apart, and waiting more than four days loses momentum. Replies drop off after about six to seven touches and heavy persistence raises complaints (Woodpecker, Yesware, Belkins, Velocify).
   - Travel quotes: follow up day 1, day 3, week 1, week 2, then week 4, stress the hold or price expiring, offer to update the pricing (Vax Vacation Access).
   - Breakup message: send one only, three to four days after the last chase, short, calm, no pressure, and check for recent engagement first (Mixmax).
   - Best send window: midweek, late morning to early afternoon.
   The plan is: 6 chases over about 3 weeks, then close 4 days after the last one if there has been no reply and no sign of interest.
*/
(function (root) {
  var DAY = 86400000, MAX_CHASES = 6, CLOSE_AFTER_DAYS = 4;
  /* days to wait before chase n (1 to 6): after the quote was sent for chase 1, after the previous chase for the rest. Totals day 1, 4, 8, 12, 17, 21. */
  var GAPS = [1, 3, 4, 4, 5, 4];
  var PAY_GAPS = [0.85, 2, 3];            /* payment link chases: about 20 hours, then 2 days, then 3 days */
  var SEND_HOUR = 10;                      /* chases become due from 10am, the best window is 10am to 2pm */
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  var WEEKDAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  var NUMWORDS = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  var DAYNAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MONNAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function dayStart(ms) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  function addDays(ms, n) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); }
  function atHour(ms, h) { return dayStart(ms) + h * 3600000; }
  function mkDate(y, m, d) { var x = new Date(y, m, d); return (x.getMonth() === m && x.getDate() === d) ? x.getTime() : null; }
  function label(ms) { var d = new Date(ms); return DAYNAMES[d.getDay()] + ' ' + d.getDate() + ' ' + MONNAMES[d.getMonth()]; }

  /* UK average payday: the 28th, or the Friday before if the 28th is a weekend. Chase the day after, when the money has landed. */
  function paydayFor(y, m) {
    var d = new Date(y, m, 28); var wd = d.getDay();
    if (wd === 6) d = new Date(y, m, 27); else if (wd === 0) d = new Date(y, m, 26);
    return d.getTime();
  }
  function nextPayday(ref) {
    var r = new Date(ref), p = paydayFor(r.getFullYear(), r.getMonth());
    if (p < dayStart(ref)) p = paydayFor(r.getFullYear(), r.getMonth() + 1);
    return p;
  }
  function blackFriday(y) { var d = new Date(y, 10, 1), first = (5 - d.getDay() + 7) % 7; return new Date(y, 10, 1 + first + 21).getTime(); }

  /* the dates a note can mention. Returns { date, why } or null. refMs is when the note was written, so "monday" or "next week" mean the right day. */
  var CUES = /\b(book|booking|call|ring|chase|follow|chat|speak|message|text|contact|decide|decision|deposit|pay|payment|payday|paid|wages|wage|salary|bonus|back to me|get back|revisit|wait|waiting|until|after|touch base|remind|come back|confirm|check in|check back|hold off|next|try|ready|when)\b/i;
  function parseHold(text, refMs) {
    var s = String(text || '').toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
    if (!CUES.test(s)) return null;
    var ref = new Date(refMs), refDay = dayStart(refMs), m, t = null, why = '';
    var mon = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
    function withYear(mo, d, y) {
      if (y) { y = +y; if (y < 100) y += 2000; return mkDate(y, mo, d); }
      var c = mkDate(ref.getFullYear(), mo, d); if (c === null) return null;
      if (c < refDay) { if (refDay - c > 150 * DAY) c = mkDate(ref.getFullYear() + 1, mo, d); else return -1; }
      return c;
    }
    /* named moments first */
    if (/\bblack friday\b/.test(s)) { var bf = blackFriday(ref.getFullYear()); if (bf < refDay) bf = blackFriday(ref.getFullYear() + 1); t = bf; why = 'Black Friday'; }
    else if (/\bcyber monday\b/.test(s)) { var cm = addDays(blackFriday(ref.getFullYear()), 3); if (cm < refDay) cm = addDays(blackFriday(ref.getFullYear() + 1), 3); t = cm; why = 'Cyber Monday'; }
    else if (/\bpay ?day\b|\bget(s|ting)? paid\b|\bwhen (he|she|they|i|we) (is |are )?paid\b|\bwages?\b|\bsalary\b|\bend of (the )?month\b|\bmonth end\b/.test(s)) { t = addDays(nextPayday(refMs), 1); why = 'after payday'; }
    else if (/\b(after|post) christmas\b|\bboxing day\b|\bafter xmas\b/.test(s)) { var y1 = ref.getFullYear(), bx = mkDate(y1, 11, 27); if (bx < refDay) bx = mkDate(y1 + 1, 11, 27); t = bx; why = 'after Christmas'; }
    else if (/\bjanuary sales?\b|\bnew year\b|\bin january\b|\bafter new year\b|\bstart of (the )?year\b/.test(s)) { var y2 = ref.getFullYear(), jn = mkDate(y2 + (ref.getMonth() >= 1 ? 1 : 0), 0, 2); t = jn; why = 'New Year'; }
    else if (/\bthis weekend\b|\bover the weekend\b/.test(s)) { var add0 = (6 - ref.getDay() + 7) % 7; if (add0 === 0) add0 = 7; t = addDays(refDay, add0); why = 'the weekend'; }
    else if ((m = s.match(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?' + mon + '(?:\\s+(\\d{4}))?\\b')))) { t = withYear(MONTHS[m[2]], +m[1], m[3]); }
    else if ((m = s.match(new RegExp('\\b' + mon + '\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s+(\\d{4}))?')))) { t = withYear(MONTHS[m[1]], +m[2], m[3]); }
    else if ((m = s.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/)) && (m[0].indexOf('/') > -1 || m[3])) { t = withYear(+m[2] - 1, +m[1], m[3]); }
    else if (/\btomorrow\b/.test(s)) { t = addDays(refDay, 1); }
    else if ((m = s.match(/\bin (\d+|a|one|two|three|four|five|six) (day|week|fortnight|month)s?\b/))) {
      var n = isNaN(+m[1]) ? NUMWORDS[m[1]] : +m[1];
      if (m[2] === 'day') t = addDays(refDay, n); else if (m[2] === 'week') t = addDays(refDay, n * 7); else if (m[2] === 'fortnight') t = addDays(refDay, n * 14); else t = dayStart(new Date(ref.getFullYear(), ref.getMonth() + n, ref.getDate()).getTime());
    }
    else if (/\bin a fortnight\b/.test(s)) { t = addDays(refDay, 14); }
    else if (/\bnext week\b/.test(s)) { var toMonday = ((8 - ref.getDay()) % 7) || 7; t = addDays(refDay, toMonday); }
    else if (/\bnext month\b/.test(s)) { t = dayStart(new Date(ref.getFullYear(), ref.getMonth() + 1, 1).getTime()); }
    else if ((m = s.match(/\b(?:next |on |this )?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/)) && /\b(next|on|this)\s+(sun|mon|tue|wed|thu|fri|sat)|\b(sun|mon|tue|wed|thu|fri|sat)(day|sday|nesday|rsday|urday)\b/.test(s)) {
      var wd = WEEKDAYS[m[1]], add = (wd - ref.getDay() + 7) % 7; if (add === 0) add = 7;
      if (/\bnext (sun|mon|tue|wed|thu|fri|sat)/.test(s)) { var toMon = ((8 - ref.getDay()) % 7) || 7; add = toMon + ((wd + 6) % 7); }
      t = addDays(refDay, add);
    }
    else if ((m = s.match(/\bthe (\d{1,2})(?:st|nd|rd|th)\b/))) {
      var d = +m[1], c = mkDate(ref.getFullYear(), ref.getMonth(), d);
      if (c === null || c <= refDay) { var nx = new Date(ref.getFullYear(), ref.getMonth() + 1, d); c = (nx.getDate() === d) ? dayStart(nx.getTime()) : null; }
      t = c;
    }
    if (t === null || t === -1 || t <= refDay) return null;
    if (t - refDay > 400 * DAY) return null;
    return { date: t, why: why };
  }
  var LOST = /\b(booked (it )?(elsewhere|with|already|through|direct)|not interested|no longer (want|interested|going|looking)|cancel+ed|went with|decided against|not going|changed (our|their) mind|got a better|going with another|already booked)\b/i;
  var PRICE = /\b(too expensive|too much|cheaper|can'?t afford|over budget|price match|beat (the|that) price|better price|found (it )?for less)\b/i;

  function manualNotes(q) { return (q.notesLog || []).filter(function (n) { return !n.auto && n.text && !isNaN(Date.parse(n.t)); }).map(function (n) { return { t: Date.parse(n.t), text: String(n.text) }; }).sort(function (a, b) { return a.t - b.t; }); }
  function firstName(q) { return String(q.firstName || '').trim() || 'there'; }
  function depart(q) { var t = Date.parse(q.departDate || ''); return isNaN(t) ? null : t; }

  /* The one question the dashboard asks about each customer: what should Jake do about them today? */
  function plan(q, ctx, now) {
    now = now || Date.now(); ctx = ctx || {};
    var st = q.status || 'new';
    var res = { track: null, due: false, priority: 9, dueAt: null, n: 0, of: MAX_CHASES, headline: '', reason: '', hold: null, lost: null, closeAt: null, price: false, quotes: (ctx.quotes || []).length };
    if (st === 'booked' || st === 'done' || st === 'closed') return res;
    var ch = q.chase || {}, notes = manualNotes(q), lastNote = notes[notes.length - 1] || null;
    var created = Date.parse(q.createdAt) || now;
    var quotes = ctx.quotes || [], sentAt = ctx.sentAt || 0, views = ctx.views || 0, lastView = ctx.lastView || 0;
    var count = ch.count || 0, lastChase = ch.lastAt || 0, replied = ch.repliedAt || 0;

    /* 1. The customer has sent the booking form and is waiting for a payment link: the money chase comes first */
    if (q.wantsToBook && q.wantsToBook.at) {
      var wt = Date.parse(q.wantsToBook.at) || 0, pc = ch.pay || 0, pLast = ch.payAt || 0;
      if (pc < PAY_GAPS.length) {
        var pdue = (pLast || wt) + PAY_GAPS[pc] * DAY;
        res.track = 'pay'; res.n = pc + 1; res.of = PAY_GAPS.length; res.dueAt = pdue; res.due = now >= pdue; res.priority = 1;
        res.headline = pc === 0 ? 'Booking form in, check the payment link' : 'Payment still waiting';
        res.reason = 'They sent the booking form ' + ago(now - wt) + '. A quick check on the payment link is the highest value message you can send.';
        if (res.due) return res; else { res.priority = 8; return res; }
      }
    }
    /* 2. A brand new enquiry nobody has answered: speed wins */
    var hasQuote = quotes.length > 0 || sentAt > 0;
    if (!hasQuote && st === 'new' && !lastNote && !lastChase) {
      res.track = 'new'; res.due = true; res.priority = 1; res.dueAt = created; res.n = 0;
      res.headline = 'New enquiry, reply now';
      res.reason = 'Came in ' + ago(now - created) + '. The first person to reply wins around half of sales, and the first few minutes matter most.';
      return res;
    }
    /* 3. Enquiry answered but no quote sent yet: your side of the job */
    if (!hasQuote) {
      var lastTouchQ = Math.max(created, lastNote ? lastNote.t : 0, lastChase);
      var stale = now - Math.max(created, (lastNote && lastNote.t) || 0);
      res.track = 'quoteNeeded'; res.priority = 3; res.dueAt = created + 4 * 3600000;
      res.due = (now - created) >= 4 * 3600000 && !holdFuture(notes, now, res);
      res.headline = 'Quote needed'; res.reason = 'Enquiry came in ' + ago(now - created) + ' and no quote has gone out yet. Quotes sent within a day win more bookings.';
      if (res.hold) { res.due = false; res.priority = 8; }
      return res;
    }

    /* 4. A quote has been sent: the six chase plan */
    var restartAt = Math.max(sentAt, replied);
    var base = Math.max(restartAt, lastChase, lastNote ? lastNote.t : 0);
    var c = count;
    if (replied > lastChase) c = 0;                               /* they replied since the last chase, the plan starts again */
    res.track = 'quote'; res.n = Math.min(c + 1, MAX_CHASES);

    /* the latest note that names a future date puts the customer on hold, the latest hard no flags them as lost */
    var hold = null;
    for (var i = notes.length - 1; i >= 0 && !hold; i--) {
      var h = parseHold(notes[i].text, notes[i].t);
      if (h) hold = { date: h.date, why: h.why, noteT: notes[i].t, text: notes[i].text };
    }
    if (lastNote && LOST.test(lastNote.text) && lastNote.t > (lastChase || 0)) { res.lost = { text: lastNote.text, t: lastNote.t }; }
    if (lastNote && PRICE.test(lastNote.text)) res.price = true;
    if (res.lost) { res.track = 'lost'; res.due = false; res.priority = 5; res.headline = 'Looks lost, close it?'; res.reason = 'Your note on ' + label(res.lost.t) + ' says: ' + trunc(res.lost.text, 90); return res; }
    var holdAt = hold ? (hold.why === 'Black Friday' || hold.why === 'Cyber Monday' ? atHour(hold.date, 9) : atHour(hold.date, SEND_HOUR)) : null;
    res.hold = hold;

    /* final chase already sent: close after 4 quiet days */
    if (c >= MAX_CHASES) {
      res.closeAt = addDays(lastChase, CLOSE_AFTER_DAYS); res.n = MAX_CHASES; res.track = 'final';
      var interested = lastView > lastChase || (lastNote && lastNote.t > lastChase) || replied > lastChase;
      res.interested = !!interested;
      res.headline = interested ? 'Final chase sent, but they have come back to you' : 'Final chase sent, closes ' + label(res.closeAt);
      res.reason = interested ? 'They have been active since the last chase, so it is not closed. Reply to them.' : 'If there is no reply by then the quote link is closed and the enquiry moves to Closed.';
      res.due = !!interested; res.priority = interested ? 2 : 9; res.dueAt = lastChase;
      return res;
    }
    /* departure getting close: tighter gaps */
    var dep = depart(q), tight = dep && dep - now < 12 * 7 * DAY ? 0.7 : 1;
    var gapDays = GAPS[c] * tight;
    if (c === 0 && views > 0) gapDays = Math.max(gapDays, 2 * tight);       /* opened it already: give them a day to think before the first nudge */
    var dueAt = atHour(addDays(base, Math.floor(gapDays)) + (gapDays % 1) * DAY, SEND_HOUR);
    if (dueAt < base + gapDays * DAY - 2 * 3600000) dueAt = base + gapDays * DAY;
    res.dueAt = dueAt;

    /* on hold for a date in the future */
    if (hold && holdAt > now && hold.noteT >= (lastChase || 0)) {
      res.track = 'wait'; res.due = false; res.priority = 8; res.dueAt = holdAt;
      res.headline = 'On hold until ' + label(hold.date); res.reason = 'Your note says: ' + trunc(hold.text, 90);
      return res;
    }
    /* the hold date has arrived */
    if (hold && holdAt <= now && hold.noteT > (lastChase || 0)) {
      res.track = 'noted'; res.due = true; res.priority = 2; res.dueAt = holdAt;
      res.headline = 'Chase now, as you noted';
      res.reason = 'Your note on ' + label(hold.noteT) + ' said: ' + trunc(hold.text, 90) + (hold.why === 'Black Friday' || hold.why === 'Cyber Monday' ? ' Re-check the price first, deals can move.' : '');
      return res;
    }
    /* they have looked at the quote again since you last touched them */
    var lastTouch = Math.max(base, restartAt);
    if (views > 0 && lastView > lastTouch && now - lastView < 72 * 3600000 && now - lastChase > 6 * 3600000) {
      res.track = 'hot'; res.due = true; res.priority = 2; res.dueAt = lastView;
      var very = (ctx.recentViews || 0) >= 3;
      res.headline = very ? 'Very hot, they keep opening the quote' : 'Hot, they have looked at the quote again';
      res.reason = 'Last opened ' + ago(now - lastView) + (views > 1 ? ', ' + views + ' views in total' : '') + '. A friendly check in now is the best moment.';
      return res;
    }
    res.due = now >= dueAt;
    res.priority = res.due ? 4 : 8;
    var plural = quotes.length > 1;
    res.headline = res.due ? 'Chase ' + res.n + ' of ' + MAX_CHASES : 'Next: chase ' + res.n + ' on ' + label(dueAt);
    var sentAgo = sentAt ? 'Quote sent ' + ago(now - sentAt) : 'No quote date';
    res.reason = sentAgo + (views > 0 ? ', opened ' + views + (views === 1 ? ' time' : ' times') : ', not opened yet') + (res.n === MAX_CHASES ? '. This is the final message, a calm goodbye that often gets a reply.' : '.');
    /* the last message is a goodbye, so check they have not just been looking before sending it */
    if (res.n === MAX_CHASES && views > 0 && lastView > lastTouch) { res.track = 'hot'; res.priority = 2; res.headline = 'Hot, hold off the goodbye'; res.reason = 'They looked at the quote after your last chase, so talk to them rather than closing.'; }
    return res;
  }
  function holdFuture(notes, now, res) {
    for (var i = notes.length - 1; i >= 0; i--) { var h = parseHold(notes[i].text, notes[i].t); if (h) { if (atHour(h.date, SEND_HOUR) > now) { res.hold = { date: h.date, why: h.why, noteT: notes[i].t, text: notes[i].text }; return true; } return false; } }
    return false;
  }
  function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '...' : s; }
  function ago(ms) { var h = Math.floor(ms / 3600000); if (h < 1) return 'a few minutes ago'; if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago'); var d = Math.floor(h / 24); return d === 1 ? 'yesterday' : d + ' days ago'; }

  /* The WhatsApp message for the chase. Plain, warm and short, with one easy question, written in Jake's voice. No dashes. */
  function message(p, q, ctx) {
    ctx = ctx || {};
    var name = firstName(q), dest = (q.destination || '').trim(), where = dest ? ' ' + dest : '';
    var qs = ctx.quotes || [], many = qs.length > 1, url = (qs[qs.length - 1] || {}).url || '';
    var quote = many ? 'your ' + qs.length + ' quotes' : 'your' + where + ' quote';
    var it = many ? 'them' : 'it';
    var hi = 'Hi ' + name + ", it's Jake from Travel Agent Jake. ";
    var opened = (ctx.views || 0) > 0;
    var dep = depart(q), month = dep ? MONNAMES[new Date(dep).getMonth()] : '';
    var t = p.track, n = p.n;
    if (t === 'new') return hi + 'Thank you for your' + where + ' enquiry! I am putting your options together now and will have them over to you shortly. So I get it just right, is there anything that is a must have, like a particular hotel, an airport or a budget you would like me to stay within?';
    if (t === 'pay') {
      var hotel = (q.wantsToBook && q.wantsToBook.hotel) ? ' for ' + q.wantsToBook.hotel : '';
      if (n === 1) return hi + 'Thank you for sending your booking details' + hotel + '! Just checking the secure payment link came through OK? As soon as the payment is in I book everything and send your confirmation, receipt and ATOL certificate.';
      if (n === 2) return hi + 'Just a gentle nudge on the payment link' + hotel + '. Prices and availability can change until it is booked, so I would love to get it secured for you. Happy to resend the link or take payment another way if that is easier.';
      return hi + 'Is everything OK with the payment' + hotel + '? If anything has changed, or you would like to talk it through, just let me know and I will sort it. I can also give you a quick call.';
    }
    if (t === 'quoteNeeded') return '';
    if (t === 'noted') {
      var wh = p.hold && p.hold.why ? p.hold.why : '';
      var lead = wh === 'after payday' ? 'You mentioned you would be ready after payday, so I wanted to catch you at the right time. ' : wh === 'Black Friday' || wh === 'Cyber Monday' ? 'You mentioned waiting for ' + wh + ', so I have just re-checked your price. ' : wh ? 'You said to catch you ' + wh + ', so here I am. ' : 'You asked me to get back to you around now, so here I am. ';
      return hi + lead + 'Would you like me to go through ' + quote + ' with you, or update the price for today? ' + (url ? url : '');
    }
    if (t === 'hot') return hi + 'Hope you are well! Have you had any thoughts on ' + quote + '? I am around if you would like to chat anything through, or change the dates, hotel or flights.' + (url ? ' ' + url : '');
    if (t === 'final' && p.interested) return hi + 'Lovely to see you looking over ' + quote + '. Is there anything I can answer or change to make it just right?';
    /* the six chase quote sequence */
    var tail = url ? ' ' + url : '';
    if (p.price) return hi + 'I would be very happy to have another look at the price for you. Could you tell me roughly what you were hoping to spend? I can check other airports, dates and hotels and see what I can do.' + tail;
    if (n === 1) return opened
      ? hi + 'Hope you have had a good look through ' + quote + '. Any first thoughts? I can change the dates, hotel, board basis or airport in minutes if anything is not quite right.'
      : hi + 'I have sent over ' + quote + ' and wanted to check ' + (many ? 'they' : 'it') + ' reached you OK. Here is the link again:' + (url ? ' ' + url : '') + ' Shout if it will not open and I will send it another way.';
    if (n === 2) return hi + 'Just a quick one on ' + quote + '. Is there anything you would like me to change, such as dates, a different hotel or a cheaper airport? I can price up alternatives for you really quickly.' + (month ? ' Prices for ' + month + ' do move around, so it is worth keeping an eye on it.' : '');
    if (n === 3) return hi + 'Holiday prices and flights can change daily, and I would hate for you to miss the price I quoted. Would you like me to re-check ' + quote + ' today and let you know where it stands? A small deposit secures it and the rest can be spread out.';
    if (n === 4) return hi + 'To make this easy, which is closest? 1. Love it, ready to book. 2. Need a little more time. 3. Not quite right, I would like to tweak it. Just reply with a number and I will take it from there.';
    if (n === 5) return hi + 'I am tidying up my open quotes this week, so ' + (many ? 'your quotes' : 'your' + where + ' quote') + ' will close soon. If you would still like ' + it + ', just say the word and I will re-check the price and hold it for you.' + tail;
    return hi + 'No worries at all if the timing is not right. I will close ' + (many ? 'your quotes' : 'your quote') + ' now so you are not bothered, but you are always welcome to message me for a fresh one, any time. Wishing you a lovely year ahead!';
  }

  /* quick snooze choices for the dashboard: write a note the parser understands */
  function snoozeOptions(now) {
    now = now || Date.now();
    var out = [], t = dayStart(now);
    out.push({ key: 'tomorrow', label: 'Tomorrow', date: addDays(t, 1) });
    out.push({ key: '3days', label: 'In 3 days', date: addDays(t, 3) });
    var toMonday = ((8 - new Date(now).getDay()) % 7) || 7; out.push({ key: 'monday', label: 'Next Monday', date: addDays(t, toMonday) });
    out.push({ key: 'payday', label: 'After payday', date: addDays(nextPayday(now), 1) });
    var bf = blackFriday(new Date(now).getFullYear()); if (bf > t) out.push({ key: 'bf', label: 'Black Friday', date: bf });
    return out;
  }
  function holdNote(opt) { return 'Chase on ' + label(opt.date) + (opt.key === 'payday' ? ' (after payday)' : opt.key === 'bf' ? ' (Black Friday, re-check the price first)' : '') + '.'; }

  var api = { plan: plan, message: message, parseHold: parseHold, snoozeOptions: snoozeOptions, holdNote: holdNote, label: label, MAX_CHASES: MAX_CHASES, CLOSE_AFTER_DAYS: CLOSE_AFTER_DAYS, GAPS: GAPS, nextPayday: nextPayday, blackFriday: blackFriday, LOST: LOST };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TAJChase = api;
})(__root);

export default __root.TAJChase;
