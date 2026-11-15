/* Temporary holiday notice. While Jake is away, every WhatsApp button on the site is
   switched off and a short note points people to the enquiry form instead.
   It turns itself off at 2pm UK time on 20 November 2026. Safe to delete after that. */
(function () {
  var END = Date.parse('2026-11-20T14:00:00Z');
  if (!(Date.now() < END)) return;

  var NUM = '447899290262';
  var ENQ = 'https://travelagentjake.co.uk/enquiry.html';
  var SEL = 'a[href*="wa.me/' + NUM + '"], a[href*="phone=' + NUM + '"], a#skiQuizWhatsapp';
  var onEnquiry = /\/enquiry(\.html)?\/?$/.test(location.pathname);

  function addCss() {
    if (document.getElementById('taj-wa-css')) return;
    var s = document.createElement('style');
    s.id = 'taj-wa-css';
    s.textContent =
      '.taj-wa-off{opacity:.5!important;filter:grayscale(1)!important;cursor:not-allowed!important;pointer-events:none!important;text-decoration:none!important}' +
      '.taj-wa-note{display:block;margin:10px 0 0;padding:0;font-size:14.5px;line-height:1.45;font-weight:600;color:inherit;text-align:inherit;max-width:none}' +
      '.taj-wa-note a{color:inherit!important;text-decoration:underline!important;font-weight:700}' +
      'span.taj-wa-note{display:inline;margin:0 0 0 .3em}';
    document.head.appendChild(s);
  }

  function makeNote(inline) {
    var el = document.createElement(inline ? 'span' : 'div');
    el.className = 'taj-wa-note';
    el.setAttribute('role', 'note');
    if (onEnquiry) {
      el.appendChild(document.createTextNode((inline ? ' (' : '') + "I'm on holiday until 20th November, so WhatsApp is paused until then" + (inline ? ')' : '.')));
      return el;
    }
    var link = document.createElement('a');
    link.href = ENQ;
    link.textContent = 'send an enquiry form';
    if (inline) {
      el.appendChild(document.createTextNode(" (I'm on holiday until 20th November, so please "));
      el.appendChild(link);
      el.appendChild(document.createTextNode(' instead)'));
    } else {
      el.appendChild(document.createTextNode("I'm on holiday until 20th November, so WhatsApp is paused. Please "));
      el.appendChild(link);
      el.appendChild(document.createTextNode(' instead.'));
    }
    return el;
  }

  function pause(a) {
    if (a.getAttribute('data-taj-wa') === '1') {
      a.removeAttribute('href');
      return;
    }
    a.setAttribute('data-taj-wa', '1');
    a.removeAttribute('href');
    a.removeAttribute('target');
    a.setAttribute('aria-disabled', 'true');
    a.setAttribute('tabindex', '-1');
    a.classList.add('taj-wa-off');
    if (/\d{5}\s?\d{6}/.test(a.textContent)) a.textContent = 'WhatsApp paused until 20th November';

    var inline = !!(a.closest && a.closest('p'));
    var anchor = a;
    if (!inline && a.parentNode && a.parentNode.nodeType === 1) {
      var ps = window.getComputedStyle(a.parentNode);
      if (ps.display.indexOf('flex') !== -1 && ps.flexDirection.indexOf('row') === 0) anchor = a.parentNode;
    }
    var host = anchor.parentNode;
    if (!host) return;
    for (var i = 0; i < host.children.length; i++) {
      if (host.children[i].classList && host.children[i].classList.contains('taj-wa-note')) return;
    }
    host.insertBefore(makeNote(inline), anchor.nextSibling);
  }

  function apply() {
    addCss();
    var links = document.querySelectorAll(SEL);
    for (var i = 0; i < links.length; i++) pause(links[i]);
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var h = a.getAttribute('href') || '';
    if (a.getAttribute('data-taj-wa') === '1' || h.indexOf('wa.me/' + NUM) !== -1 || h.indexOf('phone=' + NUM) !== -1) {
      e.preventDefault();
      e.stopPropagation();
      addCss();
      pause(a);
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
  window.addEventListener('load', apply);
  setTimeout(apply, 1500);
})();
