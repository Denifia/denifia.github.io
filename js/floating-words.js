(function () {
  'use strict';

  /* -- Configurable knobs ------------------------------------------ */
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
    edgePadding:     60,           // px inset from viewport edges
    deadZonePadding: 40,           // px extra padding around the brain image
    maxPlacementAttempts: 30       // retries before skipping a spawn
  };

  /* -- Helpers ----------------------------------------------------- */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t)    { return a + (b - a) * clamp(t, 0, 1); }
  function rand(lo, hi)     { return lo + Math.random() * (hi - lo); }
  function pickRandom(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }

  function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left &&
           a.top < b.bottom && a.bottom > b.top;
  }

  /* -- Markdown parser (brain.md → [{text, weight}]) --------------- */
  function parseBrainMd(md) {
    if (!md) return [];
    var lines = md.split('\n');
    var result = [];
    var currentWeight = 3;
    var multiLineBuffer = null;
    var inComment = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // Handle multi-line HTML comments
      if (inComment) {
        if (line.indexOf('-->') !== -1) { inComment = false; }
        continue;
      }

      var trimmed = line.trim();

      // Check for HTML comment start
      if (trimmed.indexOf('<!--') === 0) {
        if (trimmed.indexOf('-->') !== -1) { continue; } // single-line comment
        inComment = true;
        continue;
      }

      // Skip empty lines
      if (trimmed === '') continue;

      // Skip top-level header (e.g. "# Brain")
      if (/^#[^#]/.test(trimmed)) continue;

      // Weight header (e.g. "## 5 - top of mind")
      var weightMatch = trimmed.match(/^##\s+(\d+)/);
      if (weightMatch) {
        currentWeight = parseInt(weightMatch[1], 10);
        continue;
      }

      // Multi-line entry continuation
      if (multiLineBuffer !== null) {
        if (trimmed.charAt(trimmed.length - 1) === '`') {
          multiLineBuffer += '\n' + trimmed.slice(0, -1);
        } else {
          multiLineBuffer += '\n' + trimmed;
          result.push({ text: multiLineBuffer, weight: currentWeight });
          multiLineBuffer = null;
        }
        continue;
      }

      // Trailing backtick starts a multi-line entry
      if (trimmed.charAt(trimmed.length - 1) === '`') {
        multiLineBuffer = trimmed.slice(0, -1);
        continue;
      }

      // Regular single-line entry
      result.push({ text: trimmed, weight: currentWeight });
    }

    // Flush any remaining multi-line buffer
    if (multiLineBuffer !== null) {
      result.push({ text: multiLineBuffer, weight: currentWeight });
    }

    return result;
  }

  /* -- State ------------------------------------------------------- */
  var words       = parseBrainMd(window.__floatingWordsMd);
  var pool        = [];
  var activeCount = 0;
  var activeWords = {};            // track visible word texts to prevent duplicates
  var container   = null;
  var spawnTimer  = null;
  var resizeTimer = null;
  var vpWidth, vpHeight;
  var deadZone    = null;          // cached brain exclusion rect

  /* -- Dead zone (brain image exclusion area) ---------------------- */
  function updateDeadZone() {
    var brain = document.querySelector('.brain-art');
    if (!brain) { deadZone = null; return; }
    var r   = brain.getBoundingClientRect();
    var pad = CONFIG.deadZonePadding;
    deadZone = {
      left:   r.left   - pad,
      top:    r.top    - pad,
      right:  r.right  + pad,
      bottom: r.bottom + pad
    };
  }

  /* -- Object pool ------------------------------------------------- */
  function createPool() {
    container = document.createElement('div');
    container.className = 'floating-words-container';
    container.setAttribute('aria-hidden', 'true');
    document.body.appendChild(container);

    for (var i = 0; i < CONFIG.poolSize; i++) {
      var el = document.createElement('span');
      el.className = 'floating-word';
      container.appendChild(el);
      pool.push({ el: el, active: false, timer1: null, timer2: null, wordText: null });
    }
  }

  function getAvailable() {
    for (var i = 0; i < pool.length; i++) {
      if (!pool[i].active) return pool[i];
    }
    return null;
  }

  /* -- Spawn logic ------------------------------------------------- */
  function spawnWord() {
    if (activeCount >= CONFIG.maxOnScreen) return;
    var item = getAvailable();
    if (!item) return;

    // Filter out words already visible on screen
    var available = words.filter(function (w) { return !activeWords[w.text]; });
    if (!available.length) return;

    var wordData = pickRandom(available);
    var text     = wordData.text;
    var weight   = clamp(wordData.weight || 3, 1, 5);

    // Normalise weight 1-5 to 0-1
    var wt = (weight - 1) / 4;

    // Visual properties: weight biases toward larger/longer
    var fontSize   = lerp(CONFIG.sizeRange[0], CONFIG.sizeRange[1],
                          wt * 0.6 + Math.random() * 0.4);
    var fontWeight = CONFIG.weightOptions[
                       Math.floor(lerp(0, CONFIG.weightOptions.length - 1,
                                        wt * 0.5 + Math.random() * 0.5))];
    var duration   = lerp(CONFIG.durationRange[0], CONFIG.durationRange[1],
                          wt * 0.5 + Math.random() * 0.5);
    var driftDist  = lerp(CONFIG.driftRange[0], CONFIG.driftRange[1],
                          wt * 0.3 + Math.random() * 0.7);

    /* -- Measure the word so we can validate placement ---------- */
    var el = item.el;
    el.textContent      = text;
    el.style.fontSize   = fontSize + 'px';
    el.style.fontWeight = fontWeight;
    el.style.left       = '0px';
    el.style.top        = '0px';
    el.style.opacity    = '0';
    el.style.transform  = 'translate(0px, 0px)';
    el.style.transition = 'none';
    el.style.display    = 'block';

    var wordW = el.offsetWidth;
    var wordH = el.offsetHeight;

    /* -- Find a valid position + drift -------------------------- */
    var pad   = CONFIG.edgePadding;
    var valid = false;
    var x, y, driftX, driftY;

    // Skip if viewport is too small to fit the word within the safe zone
    if (vpWidth - pad * 2 < wordW || vpHeight - pad * 2 < wordH) {
      el.style.display = 'none';
      return;
    }

    // Refresh the dead zone each spawn (cheap getBoundingClientRect call)
    updateDeadZone();

    for (var attempt = 0; attempt < CONFIG.maxPlacementAttempts; attempt++) {
      // Random drift direction
      var angle = Math.random() * Math.PI * 2;
      driftX = Math.cos(angle) * driftDist;
      driftY = Math.sin(angle) * driftDist;

      // Random start position (accounts for word size)
      x = rand(pad, vpWidth  - pad - wordW);
      y = rand(pad, vpHeight - pad - wordH);

      // Start and end bounding rects
      var startR = { left: x,          top: y,          right: x + wordW,          bottom: y + wordH };
      var endR   = { left: x + driftX, top: y + driftY, right: x + driftX + wordW, bottom: y + driftY + wordH };

      // Swept bounding box covers the entire linear drift path
      var swept = {
        left:   Math.min(startR.left,   endR.left),
        top:    Math.min(startR.top,    endR.top),
        right:  Math.max(startR.right,  endR.right),
        bottom: Math.max(startR.bottom, endR.bottom)
      };

      // Reject if any part of the swept path goes outside the safe zone
      if (swept.left < pad || swept.top < pad ||
          swept.right > vpWidth - pad || swept.bottom > vpHeight - pad) {
        continue;
      }

      // Reject if the swept path overlaps the brain dead zone
      if (deadZone && rectsOverlap(swept, deadZone)) {
        continue;
      }

      valid = true;
      break;
    }

    if (!valid) {
      el.style.display = 'none';
      return; // skip this spawn cycle
    }

    /* -- Apply validated position ------------------------------- */
    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    // Per-word opacity target
    var targetOpacity = rand(0.25, CONFIG.maxOpacity);

    item.active = true;
    item.wordText = text;
    activeWords[text] = true;
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
      delete activeWords[item.wordText];
      item.wordText = null;
      item.active = false;
      activeCount--;
    }, duration + 100);
  }

  /* -- Lifecycle --------------------------------------------------- */
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
        delete activeWords[pool[i].wordText];
        pool[i].wordText = null;
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
      updateDeadZone();
    }, 200);
  }

  function init() {
    if (!words.length) return;

    vpWidth  = window.innerWidth;
    vpHeight = window.innerHeight;

    createPool();
    updateDeadZone();
    setTimeout(startSpawning, 3000);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('resize', handleResize);
  }

  /* -- Entry point (respect prefers-reduced-motion) ---------------- */
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
