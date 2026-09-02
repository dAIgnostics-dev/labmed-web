/* dAIgnostics — The Core Stack: interaction + leader lines */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var IDS = ['clarity', 'inference', 'datahub', 'edge'];
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var LIFT_SCREEN = 20 * Math.sin(55 * Math.PI / 180); // projected rise of translateZ(--lift) under rotateX(55deg) ≈ 16.4px

  var section = document.querySelector('.stack-viz');
  if (!section) return;

  var scene = section.querySelector('.scene');
  var svg = section.querySelector('.leaders');
  var pinEls = Array.prototype.slice.call(document.querySelectorAll('[data-pin]'));
  var intro = document.querySelector('.intro');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktop = window.matchMedia('(min-width: 1024px)');

  var els = {};
  IDS.forEach(function (id) {
    els[id] = {
      pos: scene.querySelector('.slab-pos[data-id="' + id + '"]'),
      slabBtn: document.getElementById('slab-' + id),
      card: section.querySelector('.card[data-id="' + id + '"]'),
      toggle: document.getElementById('trig-' + id),
      panel: document.getElementById('panel-' + id),
      anchor: null,
      leader: null,     // {g, path, dotStart, dotEnd}
      pts: null,        // {sx, sy, cx, cy}
      liftNow: 0,       // current animated line offset
      liftAnim: null
    };
    els[id].anchor = els[id].pos.querySelector('.anchor');
    // state-bearing ARIA only exists when the behavior does (no-JS keeps panels open)
    [els[id].slabBtn, els[id].toggle].forEach(function (btn) {
      btn.setAttribute('aria-controls', 'panel-' + id);
      btn.setAttribute('aria-expanded', 'false');
    });
  });

  var state = { hovered: null, pinned: null, opener: null };
  var enterTimer = null;
  var leaveTimer = null;
  var scrollTimer = null;
  var settleTimer = null;
  var reconcileTimer = null;
  var lastX = -1, lastY = -1;
  var suppress = null; // {id, until}: blocks immediate re-hover after a self-inflicted unhover

  function activeId() { return state.pinned || state.hovered; }

  function render() {
    var a = activeId();
    section.dataset.active = a || '';
    section.dataset.pinned = state.pinned ? 'true' : 'false';
    section.classList.toggle('has-active', !!a);

    IDS.forEach(function (id) {
      var on = id === a;
      var e = els[id];
      e.pos.classList.toggle('on', on);
      e.card.classList.toggle('is-active', on);
      e.card.classList.toggle('is-pinned', id === state.pinned);
      e.slabBtn.setAttribute('aria-expanded', String(on));
      e.toggle.setAttribute('aria-expanded', String(on));
      updateLeaderState(id, on);
    });

    // A state change moves the geometry (lift, panel growth): once the
    // transitions settle, re-verify the hover against the real pointer
    // position and retarget it if the stack moved under a stationary cursor.
    queueReconcile();
  }

  function reconcileHover() {
    if (state.pinned || lastX < 0) return;
    var hit = document.elementFromPoint(lastX, lastY);
    if (!hit || !hit.closest) return;
    var pos = hit.closest('.slab-pos');
    var card = pos ? null : hit.closest('.card');
    var under = pos ? pos.dataset.id : (card ? card.dataset.id : null);
    // retarget only — clearing is the job of real pointerleave events
    if (under && under !== state.hovered) {
      state.hovered = under;
      render();
    }
  }

  function queueReconcile() {
    window.clearTimeout(reconcileTimer);
    reconcileTimer = window.setTimeout(reconcileHover, 420);
  }

  /* ---------------- hover (mouse only, with intent + grace) ---------------- */

  function hoverEnter(id) {
    if (!section.classList.contains('is-settled')) return; // let the entrance finish
    if (suppress && suppress.id === id && Date.now() < suppress.until) return;
    window.clearTimeout(leaveTimer);
    window.clearTimeout(enterTimer);
    enterTimer = window.setTimeout(function () {
      if (state.pinned) return;
      state.hovered = id;
      render();
    }, 60);
  }

  function hoverLeave() {
    window.clearTimeout(enterTimer);
    window.clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(function () {
      state.hovered = null;
      render();
    }, 160);
  }

  /* ---------------- pin (click / tap / Enter / Space) ---------------- */

  function togglePin(id, opener) {
    ensureSettled(); // an explicit activation mid-entrance fast-forwards the choreography
    window.clearTimeout(scrollTimer);
    if (state.pinned === id) {
      state.pinned = null;
      state.opener = null;
    } else {
      state.pinned = id;
      state.hovered = null;
      state.opener = opener || null;
      if (!desktop.matches) {
        scrollTimer = window.setTimeout(function () {
          if (state.pinned !== id) return;
          els[id].panel.scrollIntoView({
            block: 'nearest',
            behavior: reduced.matches ? 'auto' : 'smooth'
          });
        }, 340);
      }
    }
    render();
  }

  function unpin(restoreFocus) {
    if (!state.pinned) return;
    window.clearTimeout(scrollTimer);
    var opener = state.opener;
    state.pinned = null;
    state.opener = null;
    render();
    if (restoreFocus && opener && typeof opener.focus === 'function') opener.focus();
  }

  /* ---------------- wire events ---------------- */

  // While a slab animates its lift, Chrome's pointer boundary events can
  // momentarily disagree with real geometry (3D hit-test quirk) and flip the
  // hover to a neighbouring layer. elementFromPoint stays correct throughout,
  // so slab enter/leave events are only trusted when it agrees.
  function slabUnderPoint(ev) {
    var hit = document.elementFromPoint(ev.clientX, ev.clientY);
    var pos = hit && hit.closest ? hit.closest('.slab-pos') : null;
    return pos ? pos.dataset.id : null;
  }

  section.addEventListener('pointermove', function (ev) {
    if (ev.pointerType === 'mouse') { lastX = ev.clientX; lastY = ev.clientY; }
  }, { passive: true });

  IDS.forEach(function (id) {
    var e = els[id];

    // listeners live on .slab-pos (not the button): the idle bob shifts the
    // button a few px inside its static wrappers, and a pointer in that sliver
    // must still count as being over the layer
    e.pos.addEventListener('pointerenter', function (ev) {
      if (ev.pointerType !== 'mouse') return;
      if (slabUnderPoint(ev) !== id) { queueReconcile(); return; } // spurious enter
      hoverEnter(id);
    });
    e.pos.addEventListener('pointerleave', function (ev) {
      if (ev.pointerType !== 'mouse') return;
      var under = slabUnderPoint(ev);
      if (under === id) { queueReconcile(); return; } // spurious: pointer still over this slab
      if (!under && state.hovered === id) {
        // The slab lifted itself out from under a stationary cursor (bottom
        // layer has nothing behind it to backfill). Reset as the user expects,
        // but briefly suppress re-hovering this slab so it can't bounce:
        // dropping back brings it under the cursor and re-fires enter.
        suppress = { id: id, until: Date.now() + 600 };
      }
      hoverLeave();
    });

    e.card.addEventListener('pointerenter', function (ev) {
      if (ev.pointerType !== 'mouse') return;
      hoverEnter(id);
    });
    e.card.addEventListener('pointerleave', function (ev) {
      if (ev.pointerType !== 'mouse') return;
      hoverLeave();
    });

    // click on .slab-pos catches the bob sliver too; button clicks (incl.
    // keyboard Enter/Space) bubble here, so one handler covers both
    e.pos.addEventListener('click', function () { togglePin(id, e.slabBtn); });
    e.toggle.addEventListener('click', function () { togglePin(id, e.toggle); });
  });

  document.addEventListener('click', function (ev) {
    if (!state.pinned) return;
    if (ev.target.closest && ev.target.closest('.scene, .card')) return;
    unpin(false);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      unpin(true);
      return;
    }
    var slabButtons = IDS.map(function (id) { return els[id].slabBtn; });
    var idx = slabButtons.indexOf(document.activeElement);
    if (idx === -1) return;
    var next = null;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') next = Math.min(idx + 1, slabButtons.length - 1);
    else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') next = Math.max(idx - 1, 0);
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = slabButtons.length - 1;
    if (next !== null) {
      ev.preventDefault();
      slabButtons[next].focus();
    }
  });

  /* ---------------- leader lines (desktop only) ---------------- */

  function buildLeaders() {
    IDS.forEach(function (id) {
      var g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'leader');
      var path = document.createElementNS(SVG_NS, 'path');
      var dotStart = document.createElementNS(SVG_NS, 'circle');
      dotStart.setAttribute('class', 'dot-start');
      dotStart.setAttribute('r', '2.5');
      var dotEnd = document.createElementNS(SVG_NS, 'circle');
      dotEnd.setAttribute('class', 'dot-end');
      dotEnd.setAttribute('r', '3');
      g.appendChild(path);
      g.appendChild(dotStart);
      g.appendChild(dotEnd);
      svg.appendChild(g);
      els[id].leader = { g: g, path: path, dotStart: dotStart, dotEnd: dotEnd };
    });
  }

  // Curtain scroll: each [data-pin] region (intro, stack panel) pins right
  // below the sticky header; one taller than the space under the header gets
  // a negative offset so it scrolls through first and pins with its bottom
  // at the viewport bottom.
  function updatePin() {
    var head = document.querySelector('.site-head');
    var headH = head ? head.offsetHeight : 0;
    pinEls.forEach(function (el) {
      var top = headH + Math.min(0, (window.innerHeight - headH) - el.offsetHeight);
      el.style.setProperty('--pin-top', top + 'px');
    });
  }

  // Hero photo recede: --hero-p goes 0 -> 1 as the intro scrolls from rest
  // to the point where it pins (bottom at the viewport bottom); CSS scales
  // and fades the sticky photo frame from it.
  var heroQueued = false;
  function updateHero() {
    heroQueued = false;
    if (!intro) return;
    if (reduced.matches) { intro.style.setProperty('--hero-p', '0'); return; }
    var head = document.querySelector('.site-head');
    var headH = head ? head.offsetHeight : 0;
    var travel = Math.max(intro.offsetHeight - (window.innerHeight - headH), Math.round(window.innerHeight * 0.5));
    var moved = Math.min(Math.max(headH - intro.getBoundingClientRect().top, 0), travel);
    intro.style.setProperty('--hero-p', (moved / travel).toFixed(4));
  }
  function queueHero() {
    if (heroQueued) return;
    heroQueued = true;
    window.requestAnimationFrame(updateHero);
  }
  window.addEventListener('scroll', queueHero, { passive: true });

  function measure() {
    updatePin();
    updateHero();
    if (!desktop.matches) return;
    var sr = section.getBoundingClientRect();
    if (sr.width === 0) return;
    svg.setAttribute('viewBox', '0 0 ' + sr.width + ' ' + sr.height);
    IDS.forEach(function (id) {
      var e = els[id];
      var ar = e.anchor.getBoundingClientRect();
      var tr = e.toggle.getBoundingClientRect();
      e.pts = {
        sx: ar.left + ar.width / 2 - sr.left + 10,
        sy: ar.top + ar.height / 2 - sr.top,
        cx: tr.left - sr.left - 14,
        cy: tr.top + tr.height / 2 - sr.top
      };
      drawLeader(id);
    });
  }

  function drawLeader(id) {
    var e = els[id];
    if (!e.pts || !e.leader) return;
    var sy = e.pts.sy - e.liftNow;
    var midX = e.pts.sx + (e.pts.cx - e.pts.sx) * 0.55;
    e.leader.path.setAttribute('d',
      'M ' + e.pts.sx + ' ' + sy +
      ' H ' + midX +
      ' L ' + e.pts.cx + ' ' + e.pts.cy);
    e.leader.dotStart.setAttribute('cx', e.pts.sx);
    e.leader.dotStart.setAttribute('cy', sy);
    e.leader.dotEnd.setAttribute('cx', e.pts.cx);
    e.leader.dotEnd.setAttribute('cy', e.pts.cy);
  }

  function updateLeaderState(id, on) {
    var e = els[id];
    if (!e.leader) return;
    e.leader.g.classList.toggle('on', on);
    tweenLift(id, on && !reduced.matches ? LIFT_SCREEN : 0);
  }

  function tweenLift(id, target) {
    var e = els[id];
    if (e.liftAnim) { window.cancelAnimationFrame(e.liftAnim); e.liftAnim = null; }
    if (reduced.matches || !desktop.matches) {
      e.liftNow = target;
      drawLeader(id);
      return;
    }
    var from = e.liftNow;
    if (from === target) return;
    var start = null;
    var DUR = 320;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min((ts - start) / DUR, 1);
      var k = 1 - Math.pow(1 - t, 3); // ease-out cubic
      e.liftNow = from + (target - from) * k;
      drawLeader(id);
      if (t < 1) e.liftAnim = window.requestAnimationFrame(step);
      else e.liftAnim = null;
    }
    e.liftAnim = window.requestAnimationFrame(step);
  }

  var measureQueued = false;
  function queueMeasure() {
    if (measureQueued) return;
    measureQueued = true;
    window.requestAnimationFrame(function () {
      measureQueued = false;
      measure();
    });
  }

  buildLeaders();
  updatePin();
  updateHero();

  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(queueMeasure);
    ro.observe(section);
    if (intro) ro.observe(intro); // its height sets the intro's pin offset and the hero travel
    ro.observe(section.querySelector('.scene-wrap')); // --slab is vh-bound: height-only resizes move anchors
    IDS.forEach(function (id) { ro.observe(els[id].card); });
  } else {
    window.addEventListener('resize', queueMeasure);
  }
  window.addEventListener('orientationchange', queueMeasure);

  // Cards animate transform on entrance (translateX) and on activation (translateY):
  // re-measure whenever one finishes so leader endpoints never use a stale rect.
  IDS.forEach(function (id) {
    els[id].card.addEventListener('transitionend', function (ev) {
      if (ev.propertyName === 'transform') queueMeasure();
    });
  });
  desktop.addEventListener ? desktop.addEventListener('change', queueMeasure)
                           : desktop.addListener(queueMeasure);

  /* ---------------- entrance ---------------- */

  var fontsReady = (document.fonts && document.fonts.ready)
    ? document.fonts.ready
    : Promise.resolve();
  var ready = Promise.race([
    fontsReady,
    new Promise(function (r) { window.setTimeout(r, 600); })
  ]);

  function settle() {
    window.clearTimeout(settleTimer);
    section.classList.add('is-in', 'is-settled');
    queueMeasure();
  }

  function ensureSettled() {
    if (!section.classList.contains('is-settled')) settle();
  }

  ready.then(function () {
    queueMeasure();

    if (reduced.matches) {
      settle();
      return;
    }

    if (!('IntersectionObserver' in window)) {
      section.classList.add('is-in');
      settleTimer = window.setTimeout(settle, 1600);
      return;
    }

    var entered = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !entered) {
          entered = true;
          section.classList.add('is-in');
          settleTimer = window.setTimeout(settle, 1600);
          io.disconnect();
        }
      });
    }, { threshold: 0.25 });
    io.observe(section);
  });

  /* ---------------- idle pause helpers ---------------- */

  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('page-hidden', document.hidden);
  });

  if ('IntersectionObserver' in window) {
    var offIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        section.classList.toggle('is-off', !entry.isIntersecting);
      });
    }, { threshold: 0 });
    offIo.observe(section);
  }

  /* dev sanity: preserve-3d must never silently flatten */
  if (window.console && console.assert) {
    console.assert(
      window.getComputedStyle(scene).transformStyle === 'preserve-3d',
      'Core Stack: .scene preserve-3d has been flattened — check FLATTENING RULES in style.css'
    );
  }
})();
