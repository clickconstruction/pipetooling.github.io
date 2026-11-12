/* Cards and footers: the designs as code (design spike, nothing ships from here).
 *
 * Three layers, so a change later is a small edit in one place:
 *
 *   1. BRAND    the colours, the typeface, the two words of the wordmark, the mark.
 *   2. LAYOUTS  each piece (a footer, a card back, a card front) as data: its size, where the
 *               pipes run, where the logo, the ring and the words sit, and which lines it shows.
 *   3. PARTS    the functions that draw one thing each from that data: a pipe run, the logo,
 *               the photo in its ring, an icon, a stack of words.
 *
 * draw(layout, person) puts them together and returns one SVG string. Shapes are vectors and
 * words are live text in Lexend, an open font. Two pictures remain, and both wait on the
 * designer: the wrench-and-hand mark (mark.png, cut from the largest file on hand) and the
 * dark pipe photo behind the card front (card-front.jpg, which still has the designer's logo
 * baked into it under the logo drawn here).
 *
 * Every number was measured off the designer's flat files (EmailSignatures-01.png at
 * 2709 x 625, Back1.png and Front1.png at 1125 x 675) and checked by laying a render over each.
 *
 * To add a line to the card (a license number, a website): add one entry to the layout's rows
 * and give the person that fact. Nothing else moves by hand.
 *
 * A classic script on purpose: a mock-up opened from a folder cannot import a module.
 */
(function () {
  'use strict';

  /* ── 1. The brand ─────────────────────────────────────────────────────────────────────── */
  var BRAND = {
    font: "'Lexend', 'Lexend Deca', 'Outfit', system-ui, sans-serif",
    weights: { bold: 700, light: 300 },
    /* The orange is not one value in the designer's files: #e17232 on the footers, #e37334 on the
       cards, #e17235 in the app's own logo. Each layout below still carries the value its file
       used, so a render matches its file. One orange for all is the owner's call. */
    orange: '#e17232',
    white: '#ffffff',
    /* the logo: a picture of the mark, then two words set in the brand's own type */
    mark: { file: 'mark.png', width: 243.5, height: 248.4 },
    wordmark: [
      { text: 'CLICK', weight: 'bold', size: 113.58, tracking: 10, x: 277.5, y: 144.75 },
      { text: 'Plumbing', weight: 'light', size: 75.68, tracking: 0, x: 277.5, y: 221.75 },
    ],
  };

  /* ── 2. The layouts ───────────────────────────────────────────────────────────────────────
     A pipe is its width, the points it runs through and its couplings. A bend sits at each
     inner point: it leaves the straight `from` px before the corner and joins the next
     straight `to` px after it, and `ease` says how far before and after the corner the curve's
     two handles sit (small numbers make a tight corner). A coupling is [centre x, centre y,
     width, height].
     The words are rows, drawn top down from `start` (the first row's baseline). A row is left
     off when the person lacks that fact, and the rows under it close up. A row with an icon is
     a contact line: the first sits `firstLine` under the name or the title, and each later one
     steps down by `lineSteps` in turn (the last step repeats for any further line). */
  var LAYOUTS = {
    footer01: {
      size: [2709, 625],
      ground: '#000000',
      orange: '#e17232',
      pipes: [
        { width: 53, points: [[1736, -60], [1736, 170.5], [2703, 170.5]], bends: [{ from: 190, to: 250, ease: [130, 30] }], couplings: [[2018, 170.5, 28, 95], [2602, 170.5, 28, 95]] },
        { width: 53, points: [[1645, 541.5], [2703, 541.5]], couplings: [[1645, 539.5, 32, 95]] },
        { width: 54, points: [[5, 452.5], [441, 452.5], [441, 690]], bends: [{ from: 301, to: 237.5, ease: [42, 15.5] }], couplings: [[94, 454, 28, 96]] },
      ],
      logo: { x: 100, y: 89.75, scale: 1 },
      ring: { cx: 1187.5, cy: 312.5, photo: 227.5, ring: 251.5 },
      words: {
        x: 1520, start: 349,
        rows: [
          { fact: 'name', weight: 'bold', size: 69, tracking: 1, colour: 'white', fit: 1129 },
          { fact: 'email', weight: 'light', size: 56, tracking: 1.3, colour: 'white', fit: 1129, advance: 69 },
        ],
      },
    },

    cardBack1: {
      size: [1125, 675],
      ground: '#050708',
      orange: '#e37334',
      panels: [{ points: [[0, 0], [323, 0], [323, 675], [0, 675]], colour: 'orange' }],
      ring: { cx: 323, cy: 307, photo: 128.5, ring: 140 },
      words: {
        x: 515, start: 306,
        firstLine: { afterName: 76, afterTitle: 49 },
        lineSteps: [54, 63],
        /* a contact line: its icon, then its words. The designer set the email a hair right of
           the phones and its icon a hair higher; dx and rise keep that. */
        icons: { x: 564, size: 46, rise: 31, textX: 628 },
        rows: [
          { fact: 'name', weight: 'bold', size: 52, tracking: 1.1, colour: 'orange', fit: 530 },
          { fact: 'title', weight: 'light', size: 28, tracking: 0, colour: 'white', opacity: 0.85, x: 519, advance: 39, fit: 520 },
          { fact: 'email', icon: 'email', weight: 'light', size: 35, tracking: 0, colour: 'white', fit: 410, dx: 5, rise: 34 },
          { fact: 'mobile', icon: 'mobile', weight: 'light', size: 35, tracking: 0, colour: 'white', fit: 410 },
          { fact: 'office', icon: 'office', weight: 'light', size: 35, tracking: 0, colour: 'white', fit: 410 },
        ],
      },
    },

    cardFront1: {
      size: [1125, 675],
      ground: '#2f3339',
      orange: '#e37334',
      /* the dark pipe photo, full bleed, under everything */
      photo: 'card-front.jpg',
      /* the flat orange that cuts across it on a diagonal */
      panels: [{ points: [[618.8, 0], [1125, 0], [1125, 675], [346.8, 675]], colour: 'orange' }],
      logo: { x: 267.6, y: 239.6, scale: 0.8335 },
    },
  };

  /* ── The rework: candidates for the owner's pick ────────────────────────────────────────
     Each is a copy of the designer's layout with one change, so the designer's own stay as they
     are above. rework.html shows each beside what it changes. The owner took all five on
     2026-11-11 (the photo front kept, the drawn front as the fallback). */
  var ONE_ORANGE = '#e17232';
  function reworked(base, change) {
    var L = JSON.parse(JSON.stringify(LAYOUTS[base]));
    change(L);
    return L;
  }
  /* the footer's two extra rows */
  var FOOTER_TITLE = { fact: 'title', weight: 'light', size: 44, tracking: 0.8, colour: 'white', opacity: 0.85, fit: 1129, advance: 56 };
  var FOOTER_PHONE = { fact: 'mobile', or: 'office', weight: 'light', size: 56, tracking: 1.3, colour: 'white', fit: 1129, advance: 64 };
  function footerRows(L, withTitle, withPhone) {
    var name = L.words.rows[0], email = L.words.rows[1];
    email.advanceAfter = { title: 66 };
    L.words.rows = [name].concat(withTitle ? [FOOTER_TITLE] : [], [email], withPhone ? [FOOTER_PHONE] : []);
    /* the designer's two rows sit centred on 359; more rows keep that centre, and the last
       row never drops below 462, so four rows stay clear of the pipe under them */
    L.words.centre = 359;
    L.words.floor = 462;
  }
  function evenLines(L) {
    L.words.lineSteps = [58];
    L.words.firstLine = { afterName: 76, afterTitle: 52 };
    L.words.icons.rise = 32;
    L.words.rows.forEach(function (r) { delete r.dx; delete r.rise; });
  }
  /* 1. one orange for every piece */
  LAYOUTS.cardBackOneOrange = reworked('cardBack1', function (L) { L.orange = ONE_ORANGE; });
  /* 2. the card's contact lines on even steps, the email in line with the phones */
  LAYOUTS.cardBackEven = reworked('cardBack1', evenLines);
  /* 3. a title on the footer   4. a phone on the footer */
  LAYOUTS.footerTitle = reworked('footer01', function (L) { footerRows(L, true, false); });
  LAYOUTS.footerPhone = reworked('footer01', function (L) { footerRows(L, false, true); });
  /* 5. a card front with no photo: the same diagonal, black where the photo was, two pipe runs */
  LAYOUTS.cardFrontPipes = {
    size: [1125, 675],
    ground: '#050708',
    orange: ONE_ORANGE,
    panels: LAYOUTS.cardFront1.panels,
    pipes: [
      { width: 30, points: [[150, -40], [150, 132], [-40, 132]], bends: [{ from: 96, to: 96, ease: [40, 12] }], couplings: [[58, 132, 16, 54]] },
      { width: 30, points: [[-40, 560], [214, 560], [214, 720]], bends: [{ from: 150, to: 115, ease: [22, 9] }], couplings: [[70, 560, 16, 54]] },
    ],
    logo: LAYOUTS.cardFront1.logo,
  };
  /* all of it together */
  LAYOUTS.footerReworked = reworked('footer01', function (L) { footerRows(L, true, true); L.orange = ONE_ORANGE; });
  LAYOUTS.cardBackReworked = reworked('cardBack1', function (L) { evenLines(L); L.orange = ONE_ORANGE; });
  LAYOUTS.cardFrontReworked = reworked('cardFront1', function (L) { L.orange = ONE_ORANGE; });

  /* a look is one footer, one card back and one card front that go together. CHOSEN is the one
     the owner picked: footer(), cardBack() and cardFront() draw it, and so does the make command
     unless it is told another look. */
  var LOOKS = {
    designer: { footer: 'footer01', back: 'cardBack1', front: 'cardFront1' },
    reworked: { footer: 'footerReworked', back: 'cardBackReworked', front: 'cardFrontReworked' },
    'reworked-no-photo': { footer: 'footerReworked', back: 'cardBackReworked', front: 'cardFrontPipes' },
  };
  var CHOSEN = 'reworked';

  /* ── Alternative looks: candidates, none approved ─────────────────────────────────────────
     A look here is the chosen layouts in other colours: the ground, the accent (the pipes, the
     ring, the panels, the name on the card), the ink of the two words where they sit on the
     accent, and which mark. The bones do not move, so every look fits the same names and lines.
     looks.html draws them side by side. `classic` is the look in use. */
  var THEMES = {
    classic: { name: 'Classic', says: 'Black and orange, the look in use', ground: '#000000', cardGround: '#050708', accent: '#e17232', ink: '#ffffff', front: 'cardFrontReworked' },
    'navy-orange': { name: 'Navy and orange', says: 'Navy where the black was. The logo is untouched.', ground: '#16283c', cardGround: '#16283c', accent: '#e17232', ink: '#ffffff', front: 'cardFrontPipes' },
    'navy-yellow': { name: 'Navy and safety yellow', says: 'Yellow pipes, ring and panels, and a yellow hand in the logo.', ground: '#16283c', cardGround: '#16283c', accent: '#f6c700', ink: '#16283c', mark: 'mark-yellow.png', front: 'cardFrontPipes' },
    'navy-yellow-orange-hand': { name: 'Navy and yellow, the orange hand kept', says: 'Yellow pipes, ring and panels. The logo keeps its orange hand.', ground: '#16283c', cardGround: '#16283c', accent: '#f6c700', ink: '#16283c', front: 'cardFrontPipes' },
  };
  function themed(base, t, isCard) {
    return reworked(base, function (L) {
      L.ground = isCard ? t.cardGround : t.ground;
      L.orange = t.accent;
      delete L.photo;
      if (L.logo) {
        if (t.mark) L.logo.mark = t.mark;
        /* on the card front the two words sit on the accent panel */
        if (isCard) L.logo.ink = t.ink;
      }
    });
  }
  Object.keys(THEMES).forEach(function (id) {
    var t = THEMES[id];
    if (id === 'classic') { LOOKS[id] = LOOKS.reworked; return; }
    LAYOUTS['footer@' + id] = themed('footerReworked', t, false);
    LAYOUTS['back@' + id] = themed('cardBackReworked', t, true);
    LAYOUTS['front@' + id] = themed(t.front, t, true);
    LOOKS[id] = { footer: 'footer@' + id, back: 'back@' + id, front: 'front@' + id };
  });

  /* ── Card sizes: candidates, none approved ─────────────────────────────────────────────────
     The card is 3.5 x 2 in, and a photo and its words share the width: about 3.15 in between the
     safe margins. So a size is a trade. `photo` gives the ring the most room. `text` gives the
     words the most room, by moving the seam left. Both are larger than `standard` on both counts.
     Unlike a look, a size moves things, so each one carries its own numbers. The words are
     centred on the card's middle, so a person with fewer lines still sits right. sizes.html
     draws them. */
  function sized(change) {
    return function (L) {
      var w = L.words, rowOf = {};
      w.rows.forEach(function (r) { rowOf[r.fact] = r; });
      delete w.start;
      w.centre = 337.5;
      change(L, w, rowOf);
      rowOf.title.x = w.x + 3;
      ['email', 'mobile', 'office'].forEach(function (f) { rowOf[f].size = w.lineSize; rowOf[f].fit = 1050 - w.icons.textX; });
      rowOf.name.fit = 1050 - w.x;
      rowOf.title.fit = 1050 - w.x - 10;
    };
  }
  var SIZES = {
    standard: { name: 'Standard', says: 'The card as it is today.' },
    photo: {
      name: 'Larger photo', says: 'The ring grows by a third. The words grow a little.',
      change: sized(function (L, w, row) {
        L.panels[0].points = [[0, 0], [300, 0], [300, 675], [0, 675]];
        L.ring = { cx: 300, cy: 337.5, photo: 172, ring: 186 };
        w.x = 520; w.firstLine = { afterName: 84, afterTitle: 60 }; w.lineSteps = [62]; w.lineSize = 42;
        w.icons = { x: 520, size: 54, rise: 37, textX: 590 };
        row.name.size = 62; row.title.size = 34; row.title.advance = 44;
      }),
    },
    text: {
      name: 'Larger text', says: 'The words grow by a quarter. The ring grows a little, and the seam moves left to make room.',
      change: sized(function (L, w, row) {
        L.panels[0].points = [[0, 0], [230, 0], [230, 675], [0, 675]];
        L.ring = { cx: 230, cy: 337.5, photo: 150, ring: 163 };
        w.x = 420; w.firstLine = { afterName: 88, afterTitle: 62 }; w.lineSteps = [64]; w.lineSize = 44;
        w.icons = { x: 420, size: 56, rise: 38, textX: 492 };
        row.name.size = 66; row.title.size = 34; row.title.advance = 46;
      }),
    },
  };
  /* every size in every look: 'back/<size>@<look>' */
  Object.keys(SIZES).forEach(function (sid) {
    Object.keys(THEMES).forEach(function (lid) {
      var base = LOOKS[lid].back;
      LAYOUTS['back/' + sid + '@' + lid] = SIZES[sid].change ? reworked(base, SIZES[sid].change) : LAYOUTS[base];
    });
  });

  /* print: 300 units to the inch. The card is 3.5 x 2 in with an eighth-inch bleed all round,
     and nothing that matters goes within an eighth of an inch of the cut. */
  var CARD = { w: 1125, h: 675, bleed: 37.5, safe: 37.5 };

  /* ── 3. The parts ─────────────────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(n) { return +n.toFixed(2); }

  /* The pictures. A page that carries them inside itself (window.ClickKitAssets, written by
     inline.mjs or make.mjs) wins; otherwise they are the files beside this one. */
  function asset(name, opts) {
    var held = typeof window !== 'undefined' && window.ClickKitAssets;
    return held && held[name] ? held[name] : ((opts && opts.assets) || '') + name;
  }

  function colourOf(name, layout) {
    if (name === 'orange') return (layout && layout.orange) || BRAND.orange;
    return BRAND[name] || name;
  }

  /* Width of a line in the brand's own font, so a long name shrinks instead of running off.
     A canvas measures it when there is one; a per-letter guess stands in when there is not. */
  var measureCtx = null;
  function textWidth(text, weight, size) {
    try {
      if (typeof document !== 'undefined') {
        measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
        measureCtx.font = weight + ' ' + size + 'px ' + BRAND.font;
        return measureCtx.measureText(text).width;
      }
    } catch { /* fall through to the guess */ }
    return String(text).length * size * (weight >= 600 ? 0.62 : 0.56);
  }
  function fitSize(text, weight, size, maxWidth) {
    var w = textWidth(text, weight, size);
    return w <= maxWidth ? size : Math.max(size * 0.55, (size * maxWidth) / w);
  }

  /* one line of words */
  function textLine(text, x, y, row, layout) {
    var weight = BRAND.weights[row.weight] || row.weight;
    var tracking = row.tracking || 0;
    var size = row.fit ? fitSize(text, weight, row.size, row.fit - tracking * String(text).length) : row.size;
    return '<text x="' + num(x) + '" y="' + num(y) + '" font-family="' + BRAND.font + '" font-weight="' + weight + '" font-size="' + (row.fit ? size.toFixed(1) : size) + '"' +
      (tracking ? ' letter-spacing="' + tracking + '"' : '') + (row.opacity ? ' opacity="' + row.opacity + '"' : '') +
      ' fill="' + colourOf(row.colour, layout) + '">' + esc(text) + '</text>';
  }

  /* a pipe run with its bends and couplings */
  function pipe(p, layout) {
    var o = colourOf('orange', layout), pts = p.points, d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var bend = i < pts.length - 1 && p.bends && p.bends[i - 1];
      if (!bend) { d += ' L' + pts[i][0] + ' ' + pts[i][1]; continue; }
      var c = pts[i], a = unit(pts[i - 1], c), b = unit(c, pts[i + 1]);
      d += ' L' + num(c[0] - a[0] * bend.from) + ' ' + num(c[1] - a[1] * bend.from) +
        ' C' + num(c[0] - a[0] * bend.ease[0]) + ' ' + num(c[1] - a[1] * bend.ease[0]) +
        ' ' + num(c[0] + b[0] * bend.ease[1]) + ' ' + num(c[1] + b[1] * bend.ease[1]) +
        ' ' + num(c[0] + b[0] * bend.to) + ' ' + num(c[1] + b[1] * bend.to);
    }
    var out = '<path d="' + d + '" fill="none" stroke="' + o + '" stroke-width="' + p.width + '"/>';
    (p.couplings || []).forEach(function (k) {
      out += '<rect x="' + (k[0] - k[2] / 2) + '" y="' + (k[1] - k[3] / 2) + '" width="' + k[2] + '" height="' + k[3] + '" rx="' + Math.min(k[2], k[3]) / 2 + '" fill="' + o + '"/>';
    });
    return out;
  }
  function unit(from, to) {
    var dx = to[0] - from[0], dy = to[1] - from[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
    return [dx / len, dy / len];
  }

  /* a flat shape: the card back's side panel, the card front's diagonal */
  function panel(p, layout) {
    return '<polygon points="' + p.points.map(function (q) { return q[0] + ',' + q[1]; }).join(' ') + '" fill="' + colourOf(p.colour, layout) + '"/>';
  }

  /* the logo: the mark as a picture, the two words as type */
  function logo(at, opts) {
    /* a look may bring its own mark (a yellow hand), and its own ink for the two words where they sit on a light panel */
    var m = BRAND.mark, out = '<g transform="translate(' + at.x + ' ' + at.y + ') scale(' + (at.scale || 1) + ')">' +
      '<image href="' + asset(at.mark || m.file, opts) + '" width="' + m.width + '" height="' + m.height + '" preserveAspectRatio="none"/>';
    BRAND.wordmark.forEach(function (w) {
      out += textLine(w.text, w.x, w.y, { weight: w.weight, size: w.size, tracking: w.tracking, colour: at.ink || 'white' });
    });
    return out + '</g>';
  }

  /* The photo in its ring. photo = { href, w, h, fx, fy, zoom }: fx and fy name the point of the
     picture that sits in the middle of the ring (0 to 1), zoom 1 just covers the ring. The picture
     is never allowed to leave a gap inside the ring. */
  var clipSeq = 0;
  function ringPhoto(photo, r, layout) {
    var id = 'ring' + (++clipSeq), cx = r.cx, cy = r.cy, rPhoto = r.photo;
    var out = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r.ring + '" fill="' + colourOf('orange', layout) + '"/>';
    if (!photo || !photo.href) {
      return out + '<circle cx="' + cx + '" cy="' + cy + '" r="' + rPhoto + '" fill="#2b2f33"/>' +
        '<text x="' + cx + '" y="' + (cy + rPhoto * 0.12) + '" text-anchor="middle" font-family="' + BRAND.font + '" font-weight="300" font-size="' + rPhoto * 0.3 + '" fill="#9aa0a6">No photo yet</text>';
    }
    var zoom = Math.max(1, photo.zoom || 1);
    var s = ((2 * rPhoto) / Math.min(photo.w, photo.h)) * zoom;
    var w = photo.w * s, h = photo.h * s;
    var x = cx - (photo.fx == null ? 0.5 : photo.fx) * w;
    var y = cy - (photo.fy == null ? 0.5 : photo.fy) * h;
    x = Math.min(cx - rPhoto, Math.max(cx + rPhoto - w, x));
    y = Math.min(cy - rPhoto, Math.max(cy + rPhoto - h, y));
    return out +
      '<clipPath id="' + id + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + rPhoto + '"/></clipPath>' +
      '<image href="' + esc(photo.href) + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" preserveAspectRatio="none" clip-path="url(#' + id + ')"/>';
  }

  var ICONS = {
    /* three small marks drawn fresh in the designer's manner, each in a 48 x 48 box */
    email: '<path d="M4 12h40v24H4z" fill="currentColor"/><path d="M4 12l20 14 20-14" fill="none" stroke="#050708" stroke-width="3.2" stroke-linejoin="round"/>',
    mobile: '<rect x="13.5" y="4" width="21" height="40" rx="3" fill="none" stroke="currentColor" stroke-width="3.8"/><path d="M8.5 17.5q-3 6.5 0 13M3.5 15.5q-4 8.5 0 17M39.5 17.5q3 6.5 0 13M44.5 15.5q4 8.5 0 17" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    /* a badge, for a license number or any line the designer never drew */
    license: '<path d="M24 4l15 6v11c0 10-6.500 17.500-15 22-8.500-4.500-15-12-15-22V10z" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linejoin="round"/><path d="M17 23l5 5 9-10" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>',
    office: '<g transform="translate(-1 3) scale(1.08)"><path d="M10 6c-3 1-5 4-4 9 2 12 10 22 21 27 4 2 8 1 10-2l2-4c1-2 0-3-1-4l-7-4c-1-1-3 0-4 1l-2 2c-4-2-8-6-10-11l2-2c1-1 2-3 1-4L14 7c-1-1-3-2-4-1z" fill="currentColor"/></g><path d="M27 20q4.500 1 5.500 6M29 13.500q8.500 2 10.500 11.500M31 7q12.500 3 15.500 17.500" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  };
  function icon(kind, x, y, size, colour) {
    return '<svg x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" viewBox="0 0 48 48" color="' + colour + '">' + ICONS[kind] + '</svg>';
  }

  /* The stack of words: rows top down, a missing fact closes the gap. A row may name a second
     fact to fall back on (`or`), and a different step when it follows a certain row
     (`advanceAfter`). With `centre`, the whole stack is centred on that height instead of
     hanging from `start`, so it stays in the middle however many rows a person has. `floor`
     is the lowest the last row may sit: a tall stack moves up instead of running into what
     is under it. */
  function words(block, person, layout) {
    var placed = [], y = block.start || 0, last = null, lines = 0;
    block.rows.forEach(function (row) {
      var text = person[row.fact] || (row.or && person[row.or]);
      if (!text) return;
      if (last) {
        if (row.icon) {
          y += lines === 0
            ? (last === 'title' ? block.firstLine.afterTitle : block.firstLine.afterName)
            : block.lineSteps[Math.min(lines - 1, block.lineSteps.length - 1)];
        } else {
          y += (row.advanceAfter && row.advanceAfter[last]) || row.advance;
        }
      }
      if (row.icon) lines++;
      placed.push({ row: row, text: text, y: y });
      last = row.fact;
    });
    if (block.centre != null && placed.length) {
      /* from the top of the first row's capitals to the last row's baseline */
      var top = placed[0].y - 0.71 * placed[0].row.size, bottom = placed[placed.length - 1].y;
      var shift = block.centre - (top + bottom) / 2;
      if (block.floor != null && bottom + shift > block.floor) shift = block.floor - bottom;
      placed.forEach(function (q) { q.y += shift; });
    }
    var out = '';
    placed.forEach(function (q) {
      if (q.row.icon) {
        var ic = block.icons;
        /* the envelope's flap is cut out in the ground's own colour */
        out += icon(q.row.icon, ic.x, q.y - (q.row.rise || ic.rise), ic.size, colourOf('orange', layout)).replace(/#050708/g, layout.ground);
        out += textLine(q.text, ic.textX + (q.row.dx || 0), q.y, q.row, layout);
      } else {
        out += textLine(q.text, q.row.x || block.x, q.y, q.row, layout);
      }
    });
    return out;
  }

  /* Trim (where the knife cuts) and safe (nothing that matters goes outside it). */
  function guides() {
    var b = CARD.bleed, s = CARD.bleed + CARD.safe;
    return '<rect x="' + b + '" y="' + b + '" width="' + (CARD.w - 2 * b) + '" height="' + (CARD.h - 2 * b) + '" fill="none" stroke="#22d3ee" stroke-width="2" stroke-dasharray="10 8"/>' +
      '<rect x="' + s + '" y="' + s + '" width="' + (CARD.w - 2 * s) + '" height="' + (CARD.h - 2 * s) + '" fill="none" stroke="#a3e635" stroke-width="2" stroke-dasharray="4 8"/>';
  }

  /* ── One drawing from a layout and a person ───────────────────────────────────────────── */
  function draw(layoutName, person, opts) {
    var L = typeof layoutName === 'string' ? LAYOUTS[layoutName] : layoutName;
    opts = opts || {}; person = person || {};
    var W = L.size[0], H = L.size[1];
    var body = '<rect width="' + W + '" height="' + H + '" fill="' + L.ground + '"/>';
    if (L.photo) body += '<image href="' + asset(L.photo, opts) + '" width="' + W + '" height="' + H + '" preserveAspectRatio="none"/>';
    (L.panels || []).forEach(function (p) { body += panel(p, L); });
    (L.pipes || []).forEach(function (p) { body += pipe(p, L); });
    if (L.logo) body += logo(L.logo, opts);
    if (L.ring) body += ringPhoto(person.photo, L.ring, L);
    if (L.words) body += words(L.words, person, L);
    if (opts.guides) body += guides();
    var label = person.name ? esc(person.name) + ', Click Plumbing' : 'Click Plumbing';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + (opts.width || W) + '" role="img" aria-label="' + label + '">' + body + '</svg>';
  }
  function footer(person, opts) { return draw(LOOKS[CHOSEN].footer, person, opts); }
  function cardBack(person, opts) { return draw(LOOKS[CHOSEN].back, person, opts); }
  function cardFront(opts) { return draw(LOOKS[CHOSEN].front, null, opts); }

  /* One card on its own page with crop marks: what a print shop takes. The page is the bleed box
     plus a quarter inch of margin for the marks. */
  function printPage(inner) {
    var m = 75, W = CARD.w + 2 * m, H = CARD.h + 2 * m, b = CARD.bleed, len = 45, gap = 12;
    var x0 = m + b, x1 = m + CARD.w - b, y0 = m + b, y1 = m + CARD.h - b;
    var marks = '';
    [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]].forEach(function (c) {
      var x = c[0], y = c[1], dx = c[2], dy = c[3];
      marks += '<path d="M' + x + ' ' + (y + dy * (b + gap)) + 'v' + dy * len + 'M' + (x + dx * (b + gap)) + ' ' + y + 'h' + dx * len + '" stroke="#000" stroke-width="1.5" fill="none"/>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Card with crop marks">' +
      '<rect width="' + W + '" height="' + H + '" fill="#ffffff"/>' +
      '<svg x="' + m + '" y="' + m + '" width="' + CARD.w + '" height="' + CARD.h + '" viewBox="0 0 1125 675">' + inner.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</svg>' + marks + '</svg>';
  }

  /* Ten to a letter page for the office printer: two across, five down, each 3.5 x 2 in, the way
     card stock is scored (half-inch top, three-quarter-inch sides). The bleed is cropped off. */
  function sheetOfTen(inner) {
    var W = 2550, H = 3300, cw = 1050, ch = 600, left = 225, top = 150;
    var core = inner.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ten cards on a letter page"><rect width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    for (var r = 0; r < 5; r++) for (var c = 0; c < 2; c++) {
      out += '<svg x="' + (left + c * cw) + '" y="' + (top + r * ch) + '" width="' + cw + '" height="' + ch + '" viewBox="37.5 37.5 1050 600">' + core + '</svg>';
    }
    /* hairline cut ticks in the margins only */
    for (var i = 0; i <= 5; i++) out += '<path d="M150 ' + (top + i * ch) + 'h50M2350 ' + (top + i * ch) + 'h50" stroke="#000" stroke-width="1.5"/>';
    for (var j = 0; j <= 2; j++) out += '<path d="M' + (left + j * cw) + ' 75v50M' + (left + j * cw) + ' 3175v50" stroke="#000" stroke-width="1.5"/>';
    return out + '</svg>';
  }

  /* The footer as HTML with live words: a table, inline styles, two hosted pictures. The words can
     be selected, the email and the phones can be tapped, and a mail app that blocks pictures still
     shows the name. logoUrl and photoUrl must be public addresses when this is real. */
  function htmlFooter(person, urls) {
    urls = urls || {};
    var o = BRAND.orange, f = "font-family:Lexend,'Trebuchet MS',Arial,sans-serif;";
    var rows = '';
    if (person.title) rows += '<div style="' + f + 'font-size:13px;color:#d1d5db;">' + esc(person.title) + '</div>';
    rows += '<div style="' + f + 'font-size:14px;"><a href="mailto:' + esc(person.email) + '" style="color:#ffffff;text-decoration:none;">' + esc(person.email) + '</a></div>';
    if (person.mobile) rows += '<div style="' + f + 'font-size:13px;color:#d1d5db;">Mobile <a href="tel:' + esc(person.mobile.replace(/[^+\d]/g, '')) + '" style="color:#ffffff;text-decoration:none;">' + esc(person.mobile) + '</a></div>';
    if (person.office) rows += '<div style="' + f + 'font-size:13px;color:#d1d5db;">Office <a href="tel:' + esc(person.office.replace(/[^+\d]/g, '')) + '" style="color:#ffffff;text-decoration:none;">' + esc(person.office) + '</a></div>';
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000;border-collapse:collapse;border-bottom:6px solid ' + o + ';">' +
      '<tr><td style="padding:14px 16px 14px 18px;"><img src="' + esc(urls.logoUrl || asset('logo-on-dark.png')) + '" width="150" alt="Click Plumbing" style="display:block;border:0;"></td>' +
      '<td style="padding:10px 14px 10px 4px;"><img src="' + esc(urls.photoUrl || '') + '" width="76" height="76" alt="" style="display:block;border:3px solid ' + o + ';border-radius:50%;"></td>' +
      '<td style="padding:12px 22px 12px 2px;"><div style="' + f + 'font-size:18px;font-weight:700;color:#ffffff;line-height:1.25;">' + esc(person.name) + '</div>' + rows + '</td></tr></table>';
  }

  /* ── Made-up people. No real person's picture ever goes in this folder: each "photo" is a
     drawn bust on a tinted ground. ─────────────────────────────────────────────────────── */
  function bust(ground, skin, hair, shirt) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="' + ground + '"/>' +
      '<path d="M60 400c0-90 60-140 140-140s140 50 140 140z" fill="' + shirt + '"/>' +
      '<rect x="172" y="210" width="56" height="70" rx="24" fill="' + skin + '"/>' +
      '<ellipse cx="200" cy="160" rx="74" ry="86" fill="' + skin + '"/>' +
      '<path d="M122 150c-4-70 40-98 80-98s84 26 78 98c-14-40-40-58-78-58s-66 20-80 58z" fill="' + hair + '"/></svg>';
    return { href: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), w: 400, h: 400, fx: 0.5, fy: 0.45, zoom: 1 };
  }
  var PEOPLE = [
    { id: 'marisol', name: 'Marisol Vega', title: 'Office Manager', email: 'marisol@juniperplumbing.example', mobile: '(512) 555-0142', office: '(512) 555-0100', photo: bust('#8fa58e', '#c98f6b', '#2a1a12', '#31404f') },
    { id: 'dale', name: 'Dale Okafor', title: 'Master Plumber', email: 'dale@juniperplumbing.example', mobile: '(512) 555-0177', office: '(512) 555-0100', photo: bust('#9fb3c8', '#7a4f38', '#15100d', '#5b3a22') },
    { id: 'priya', name: 'Priya Ramanathan-Whitfield', title: 'Estimator', email: 'priya.ramanathan-whitfield@juniperplumbing.example', mobile: '(512) 555-0163', office: '(512) 555-0100', photo: bust('#c9b79a', '#b9805c', '#1c1410', '#2f4a3a') },
    { id: 'hank', name: 'Hank Brewer', title: 'Superintendent', email: 'hank@juniperplumbing.example', mobile: '(512) 555-0119', office: '(512) 555-0100', photo: null },
    { id: 'lucia', name: 'Lucia Ferrante', title: 'Controller', email: 'lucia@juniperplumbing.example', mobile: '', office: '(512) 555-0100', photo: bust('#b7a3c4', '#e0b08f', '#6b3d1e', '#22303c') },
    { id: 'tomas', name: 'Tomas Lindqvist', title: 'Journeyman Plumber', email: 'tomas@juniperplumbing.example', mobile: '(512) 555-0188', office: '(512) 555-0100', photo: bust('#a9b8a0', '#e3bc9c', '#b08a4a', '#40342c') },
    { id: 'renee', name: 'Renee Castillo', title: '', email: 'renee@juniperplumbing.example', mobile: '(512) 555-0131', office: '(512) 555-0100', photo: bust('#c4a59a', '#a8704f', '#241812', '#6a2f2a') },
  ];

  window.ClickKit = {
    BRAND: BRAND, LAYOUTS: LAYOUTS, LOOKS: LOOKS, THEMES: THEMES, SIZES: SIZES, CHOSEN: CHOSEN, CARD: CARD, FONT: BRAND.font, PEOPLE: PEOPLE,
    draw: draw, footer: footer, cardBack: cardBack, cardFront: cardFront,
    printPage: printPage, sheetOfTen: sheetOfTen, htmlFooter: htmlFooter, bust: bust, guides: guides,
  };
})();
