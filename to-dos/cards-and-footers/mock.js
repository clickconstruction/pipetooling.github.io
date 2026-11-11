/* Cards and footers: what makes the mock-up pages live (design spike). It fills every marked holder from kit.js,
   so a preview is the real template drawn from a made-up person's facts, and it redraws when a field, the zoom or a
   drag on the ring changes. Nothing is saved and nothing is sent. */
(function () {
  'use strict';
  var K = window.ClickKit;
  var people = {};
  K.PEOPLE.forEach(function (p) { people[p.id] = p; });
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function draw() {
    all('[data-footer]').forEach(function (el) { el.innerHTML = K.footer(people[el.dataset.footer]); });
    all('[data-back]').forEach(function (el) { el.innerHTML = K.cardBack(people[el.dataset.back], { guides: el.hasAttribute('data-guides') }); });
    all('[data-front]').forEach(function (el) { el.innerHTML = K.cardFront({ guides: el.hasAttribute('data-guides') }); });
    /* a look's piece: data-look="look:footer|back|front:person" */
    all('[data-look]').forEach(function (el) {
      var parts = el.dataset.look.split(':');
      el.innerHTML = K.draw(K.LOOKS[parts[0]][parts[1]], parts[2] ? people[parts[2]] : null);
    });
    /* any layout by name: data-draw="layout:person", or "layout" alone for a piece with no person on it */
    all('[data-draw]').forEach(function (el) {
      var parts = el.dataset.draw.split(':');
      el.innerHTML = K.draw(parts[0], parts[1] ? people[parts[1]] : null, { guides: el.hasAttribute('data-guides') });
      /* data-box="x y w h" shows only that part of the drawing, larger */
      if (el.dataset.box && el.firstChild) el.firstChild.setAttribute('viewBox', el.dataset.box);
    });
    all('[data-printpage]').forEach(function (el) {
      el.innerHTML = K.printPage(el.dataset.printpage === 'front' ? K.cardFront() : K.cardBack(people[el.dataset.printpage]));
    });
    all('[data-sheet]').forEach(function (el) {
      el.innerHTML = K.sheetOfTen(el.dataset.sheet === 'front' ? K.cardFront() : K.cardBack(people[el.dataset.sheet]));
    });
    all('[data-html]').forEach(function (el) {
      var p = people[el.dataset.html];
      el.innerHTML = K.htmlFooter(p, { photoUrl: p.photo ? p.photo.href : '' });
    });
    all('[data-ring]').forEach(function (el) {
      var p = people[el.dataset.ring];
      el.innerHTML = p.photo ? '<img alt="" src="' + p.photo.href + '">' : p.name.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('');
    });
    all('[data-text]').forEach(function (el) {
      var parts = el.dataset.text.split('.');
      el.textContent = people[parts[0]][parts[1]] || '';
    });
    all('[data-crop]').forEach(placeCrop);
  }

  /* the ring: drag the picture, slide to zoom */
  function placeCrop(stage) {
    var p = people[stage.dataset.crop], ph = p.photo, img = stage.querySelector('img');
    if (!ph) { stage.classList.add('empty'); return; }
    var S = stage.clientWidth || 240;
    var s = (S / Math.min(ph.w, ph.h)) * (ph.zoom || 1), w = ph.w * s, h = ph.h * s;
    var x = Math.min(0, Math.max(S - w, S / 2 - ph.fx * w)), y = Math.min(0, Math.max(S - h, S / 2 - ph.fy * h));
    img.style.width = w + 'px'; img.style.height = h + 'px';
    img.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }
  function wireCrop(stage) {
    var p = people[stage.dataset.crop];
    if (!p.photo) { stage.textContent = 'No photo yet. Add a photo to fill the ring.'; return; }
    var img = document.createElement('img'); img.alt = ''; img.src = p.photo.href; stage.appendChild(img);
    var last = null;
    stage.addEventListener('pointerdown', function (e) { last = [e.clientX, e.clientY]; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', function (e) {
      if (!last) return;
      var ph = p.photo, S = stage.clientWidth, s = (S / Math.min(ph.w, ph.h)) * (ph.zoom || 1);
      ph.fx = Math.min(1, Math.max(0, ph.fx - (e.clientX - last[0]) / (ph.w * s)));
      ph.fy = Math.min(1, Math.max(0, ph.fy - (e.clientY - last[1]) / (ph.h * s)));
      last = [e.clientX, e.clientY]; draw();
    });
    stage.addEventListener('pointerup', function () { last = null; });
  }

  function start() {
    all('[data-crop]').forEach(wireCrop);
    all('[data-zoom]').forEach(function (el) {
      var p = people[el.dataset.zoom];
      if (!p.photo) { el.disabled = true; return; }
      el.value = p.photo.zoom || 1;
      el.addEventListener('input', function () { p.photo.zoom = parseFloat(el.value); draw(); });
    });
    all('[data-bind]').forEach(function (el) {
      var parts = el.dataset.bind.split('.');
      el.value = people[parts[0]][parts[1]] || '';
      el.addEventListener('input', function () {
        people[parts[0]][parts[1]] = el.value;
        all('[data-bind="' + el.dataset.bind + '"]').forEach(function (o) { if (o !== el) o.value = el.value; });
        draw();
      });
    });
    var t = document.getElementById('theme');
    if (t) t.addEventListener('click', function () {
      var r = document.documentElement, dark = r.dataset.theme === 'dark';
      r.dataset.theme = dark ? 'light' : 'dark'; t.textContent = dark ? 'Dark' : 'Light';
    });
    draw();
    /* the fit of a long name is measured in the real font, so draw again once it has loaded */
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load("700 40px Lexend"), document.fonts.load("300 40px Lexend")]).then(draw, function () {});
    }
  }
  /* a page's own script may change the brand or a layout and ask for a redraw */
  window.ClickMock = { draw: draw, people: people };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
