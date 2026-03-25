(function () {
  'use strict';

  /* ── Configurable knobs ─────────────────────────────────────────── */
  var CONFIG = {
    maxOnScreen:     5,            // max simultaneous visible words
    spawnIntervalMs: 2500,         // ms between spawn attempts
    sizeRange:       [14, 34],     // font-size bounds (px)
    weightOptions:   [300, 400, 500, 600, 700], // font-weight choices
    durationRange:   [7000, 14000],// total lifecycle bounds (ms)
    driftRange:      [30, 80],     // max drift distance bounds (px)
    fadeMs:          1200,         // fade-in / fade-out duration (ms)
    maxOpacity:      0.55,         // ceiling for per-word target opacity
    poolSize:        8,            // DOM elements to pre-create
    edgePadding:     60            // px inset from viewport edges
  };

  /* ── Helpers ────────────────────────────────────────────────────── */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t)    { return a + (b - a) * clamp(t, 0, 1); }
  function rand(lo, hi)     { return lo + Math.random() * (hi - lo); }
  function pickRandom(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ── State ──────────────────────────────────────────────────────── */
  var words       = window.__floatingWords || [];
  var pool        = [];
  var activeCount = 0;
  var container   = null;
  var spawnTimer  = null;
  var resizeTimer = null;
  var vpWidth, vpHeight;

  /* ── Object pool ────────────────────────────────────────────────── */
  function createPool() {
    container = document.createElement('div');
    container.className = 'floating-words-container';
    container.setAttribute('aria-hidden', 'true');
    document.body.appendChild(container);

    for (var i = 0; i < CONFIG.poolSize; i++) {
      var el = document.createElement('span');
      el.className = 'floating-word';
      container.appendChild(el);
      pool.push({ el: el, active: false, timer1: null, timer2: null });
    }
  }

  function getAvailable() {
    for (var i = 0; i < pool.length; i++) {
      if (!pool[i].active) return pool[i];
    }
    return null;
  }

  /* ── Spawn logic ────────────────────────────────────────────────── */
  function spawnWord() {
    if (activeCount >= CONFIG.maxOnScreen) return;
    var item = getAvailable();
    if (!item) return;

    var wordData = pickRandom(words);
    var text     = wordData.text;
    var weight   = clamp(wordData.weight || 3, 1, 5);

    // Normalise weight 1-5 → 0-1
    var wt = (weight - 1) / 4;

    // Visual properties: weight biases toward larger/longer, randomness adds variety
    var fontSize   = lerp(CONFIG.sizeRange[0], CONFIG.sizeRange[1],
                          wt * 0.6 + Math.random() * 0.4);
    var fontWeight = CONFIG.weightOptions[
                       Math.floor(lerp(0, CONFIG.weightOptions.length - 1,
                                       wt * 0.5 + Math.random() * 0.5))];
    var duration   = lerp(CONFIG.durationRange[0], CONFIG.durationRange[1],
                          wt * 0.5 + Math.random() * 0.5);
    var driftDist  = lerp(CONFIG.driftRange[0], CONFIG.driftRange[1],
                          wt * 0.3 + Math.random() * 0.7);

    // Random drift angle
    var angle  = Math.random() * Math.PI * 2;
    var driftX = Math.cos(angle) * driftDist;
    var driftY = Math.sin(angle) * driftDist;

    // Random position inside safe zone
    var pad = CONFIG.edgePadding;
    var x   = rand(pad, vpWidth  - pad);
    var y   = rand(pad, vpHeight - pad);

    // Per-word opacity target
    var targetOpacity = rand(0.25, CONFIG.maxOpacity);

    /* ── Apply to DOM element ──────────────────────────────────── */
    var el = item.el;
    el.textContent    = text;
    el.style.fontSize   = fontSize + 'px';
    el.style.fontWeight = fontWeight;
    el.style.left       = x + 'px';
    el.style.top        = y + 'px';
    el.style.opacity    = '0';
    el.style.transform  = 'translate(0px, 0px)';
    el.style.transition = 'none';
    el.style.display    = '';

    item.active = true;
    activeCount++;

    // Force reflow so the browser registers the starting values
    void el.offsetHeight;

    // Promote to compositing layer only while animating
    el.style.willChange = 'transform, opacity';

    // Kick off CSS transitions
    el.style.transition =
      'opacity ' + CONFIG.fadeMs + 'ms ease, ' +
      'transform ' + duration + 'ms linear';
    el.style.opacity   = String(targetOpacity);
    el.style.transform = 'translate(' + driftX + 'px, ' + driftY + 'px)';

    // Schedule fade-out
    var fadeOutDelay = Math.max(0, duration - CONFIG.fadeMs);
    item.timer1 = setTimeout(function () {
      el.style.opacity = '0';
    }, fadeOutDelay);

    // Schedule recycle (slight buffer after fade-out ends)
    item.timer2 = setTimeout(function () {
      el.style.willChange = 'auto';
      el.style.display = 'none';
      item.active = false;
      activeCount--;
    }, duration + 100);
  }

  /* ── Lifecycle ──────────────────────────────────────────────────── */
  function startSpawning() {
    spawnWord();
    spawnTimer = setInterval(spawnWord, CONFIG.spawnIntervalMs);
  }

  function stopSpawning() {
    if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
    // Clear all pending timers for active pool items
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].timer1) { clearTimeout(pool[i].timer1); pool[i].timer1 = null; }
      if (pool[i].timer2) { clearTimeout(pool[i].timer2); pool[i].timer2 = null; }
      if (pool[i].active) {
        pool[i].el.style.willChange = 'auto';
        pool[i].el.style.display = 'none';
        pool[i].el.style.opacity = '0';
        pool[i].active = false;
        activeCount--;
      }
    }
  }

  function handleVisibility() {
    if (document.hidden) { stopSpawning(); }
    else if (!spawnTimer) { startSpawning(); }
  }

  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      vpWidth  = window.innerWidth;
      vpHeight = window.innerHeight;
    }, 200);
  }

  function init() {
    if (!words.length) return;

    vpWidth  = window.innerWidth;
    vpHeight = window.innerHeight;

    createPool();
    startSpawning();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('resize', handleResize);
  }

  /* ── Entry point (respect prefers-reduced-motion) ───────────────── */
  if (window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
