/*
 * Hero Game of Life — the name emerges, then you arrive.
 *
 * Reveal sequence on load:
 *   1. Seed the grid from the FILLED letterforms of "Mehul Gangavelli", and
 *      hold the sim paused for ~1s so the name is legible, written in cells.
 *   2. Run the sim for ~2s: the name comes alive, sheds off its glyphs, frays.
 *   3. Fade the crisp logo + name overlay in on top (it starts transparent).
 *
 * The typographic overlay lives in the HTML, so the final name never depends on
 * the animation. Colors mirror Mehul's logo: hsl(80 + k*distance, ...) anchored
 * top-right, over a dark green-black field. The canvas fades toward the page
 * background as you scroll down; ticking pauses when faded or on a hidden tab;
 * prefers-reduced-motion skips the reveal (static frame, overlay shown at once).
 */
(function () {
    "use strict";

    var canvas = document.getElementById("gol");
    var ctx = canvas.getContext("2d");
    var hero = document.querySelector(".hero");
    var overlay = document.querySelector(".hero-overlay");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- Tunables ---
    var CELL = 7;              // px per cell (small enough to read the name)
    var STEP_MS = 240;         // ~4 generations/sec
    var SEED_DENSITY = 0.30;
    var PAD = 10;
    var HUE_BASE = 80, HUE_SPAN = 145;
    var RISE = 0.22, FALL = 0.06;
    var SETTLE_L = 42;
    var IGNITE_MS = 2600, CALM_MS = 4200;
    var SPRINKLE_STEPS = 40;   // drift new life in from the edges every N steps

    // Reveal timing:
    var HOLD_MS = 1000;        // paused: the name sits legible, written in cells
    var RUN_MS = 2000;         // then the sim runs this long before the overlay
    var SEED_SCALE = 1.0;      // seed size vs the overlay name (1.0 = aligned)
    var SEED_ALPHA = 50;       // min sampled alpha to call a cell alive

    // A live glider seeded to the left of the name; flies up-right when it runs.
    var GLIDER = [[1, 0], [2, 0], [0, 1], [2, 1], [2, 2]];
    var GLIDER_LEFT = 60;      // px to the left of the name's left edge

    var cols, rows, grid, next, bright, anchorX, anchorY, maxDist;
    var startTime = 0, lastStep = 0, sinceSprinkle = 0;
    var opacity = 1, hidden = false, revealed = false;

    function makeGrid() {
        cols = Math.ceil(canvas.width / CELL) + 2 * PAD;
        rows = Math.ceil(canvas.height / CELL) + 2 * PAD;
        grid = new Uint8Array(cols * rows);
        next = new Uint8Array(cols * rows);
        bright = new Float32Array(cols * rows);
    }

    function seedAll() {
        for (var i = 0; i < grid.length; i++) {
            grid[i] = Math.random() < SEED_DENSITY ? 1 : 0;
        }
    }

    function seedMargin() {
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                var edge = x < PAD || x >= cols - PAD || y < PAD || y >= rows - PAD;
                if (edge && Math.random() < SEED_DENSITY) grid[y * cols + x] = 1;
            }
        }
    }

    // Seed from the FILLED overlay name so it's readable, written in cells.
    // Falls back to random soup if the font/name isn't measurable.
    function seedFromName() {
        var h1 = document.querySelector(".hero h1");
        if (!h1) { seedAll(); return; }
        var cs = getComputedStyle(h1);
        var r = h1.getBoundingClientRect();
        var cr = canvas.getBoundingClientRect();

        var off = document.createElement("canvas");
        off.width = canvas.width;
        off.height = canvas.height;
        var octx = off.getContext("2d");
        octx.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
        octx.textAlign = "center";
        octx.textBaseline = "middle";
        octx.fillStyle = "#fff";
        octx.translate(r.left + r.width / 2 - cr.left, r.top + r.height / 2 - cr.top);
        octx.scale(SEED_SCALE, SEED_SCALE);
        octx.fillText(h1.textContent, 0, 0);

        var data = octx.getImageData(0, 0, off.width, off.height).data;
        grid.fill(0);
        var hit = 0;
        for (var gy = 0; gy < rows; gy++) {
            for (var gx = 0; gx < cols; gx++) {
                var px = (gx - PAD) * CELL + CELL / 2;
                var py = (gy - PAD) * CELL + CELL / 2;
                if (px < 0 || py < 0 || px >= off.width || py >= off.height) continue;
                if (data[(((py | 0) * off.width) + (px | 0)) * 4 + 3] > SEED_ALPHA) {
                    var i = gy * cols + gx;
                    grid[i] = 1;
                    bright[i] = 1;
                    hit++;
                }
            }
        }
        if (hit < 12) seedAll();

        // Park a glider just to the left of the name; it flies off on its own
        // once the sim un-pauses.
        var gx0 = Math.round((r.left - cr.left - GLIDER_LEFT) / CELL) + PAD;
        var gy0 = Math.round((r.top - cr.top + r.height / 2) / CELL) + PAD;
        for (var k = 0; k < GLIDER.length; k++) {
            var gcx = gx0 - 1 + GLIDER[k][0];
            var gcy = gy0 - 1 + GLIDER[k][1];
            if (gcx >= 0 && gcx < cols && gcy >= 0 && gcy < rows) {
                var gi = gcy * cols + gcx;
                grid[gi] = 1;
                bright[gi] = 1;
            }
        }
    }

    function size() {
        canvas.width = hero.clientWidth;
        canvas.height = hero.clientHeight;
        anchorX = canvas.width;
        anchorY = 0;
        maxDist = Math.hypot(canvas.width, canvas.height) || 1;
        makeGrid(); // starts empty; a seed function fills it
    }

    function step() {
        var alive = 0;
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                var n = 0;
                for (var dy = -1; dy <= 1; dy++) {
                    for (var dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        n += grid[((y + dy + rows) % rows) * cols + ((x + dx + cols) % cols)];
                    }
                }
                var i = y * cols + x;
                var live = grid[i] ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
                next[i] = live;
                alive += live;
            }
        }
        var tmp = grid; grid = next; next = tmp;
        return alive;
    }

    function igniteFactor(now) {
        var t = now - startTime;
        if (t <= IGNITE_MS) return 1;
        if (t >= IGNITE_MS + CALM_MS) return 0;
        return 1 - (t - IGNITE_MS) / CALM_MS;
    }

    function render(now) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var boost = igniteFactor(now);
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                var i = y * cols + x;
                var b = bright[i];
                var target = grid[i] ? 1 : 0;
                b += (target - b) * (target > b ? RISE : FALL);
                bright[i] = b;
                if (b < 0.03) continue;
                var px = (x - PAD) * CELL, py = (y - PAD) * CELL;
                if (px < -CELL || py < -CELL ||
                    px > canvas.width || py > canvas.height) continue;
                var dist = Math.hypot(px - anchorX, py - anchorY);
                var hue = HUE_BASE + (dist / maxDist) * HUE_SPAN;
                ctx.globalAlpha = Math.min(1, b);
                ctx.fillStyle = "hsl(" + hue + ", 82%, " + (SETTLE_L + boost * 22) + "%)";
                ctx.beginPath();
                ctx.arc(px + CELL / 2, py + CELL / 2, (CELL - 2) / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    function updateOpacity() {
        var o = 1 - window.scrollY / (hero.clientHeight || 1);
        opacity = o < 0 ? 0 : (o > 1 ? 1 : o);
        canvas.style.opacity = opacity;
    }

    function frame(now) {
        requestAnimationFrame(frame);
        if (hidden) return;
        updateOpacity();
        if (opacity < 0.1) return;

        var t = now - startTime;
        var running = t >= HOLD_MS; // hold paused first, then let it run

        if (running && now - lastStep >= STEP_MS) {
            lastStep = now;
            step();
            // Gently drift new life in from the hidden margins on a cadence.
            // (No full-grid reseed — that was the jarring flash of noise.)
            if (++sinceSprinkle >= SPRINKLE_STEPS) {
                seedMargin();
                sinceSprinkle = 0;
            }
        }

        if (!revealed && t >= HOLD_MS + RUN_MS) {
            revealed = true;
            if (overlay) overlay.style.opacity = "1"; // fade the name/logo in
        }

        render(now);
    }

    function staticFrame() {
        for (var i = 0; i < grid.length; i++) bright[i] = grid[i] ? 1 : 0;
        startTime = -1e9;
        render(0);
        updateOpacity();
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            size();
            seedFromName(); // re-seed from the name, not random noise
            if (reduce) staticFrame();
        }, 150);
    });
    document.addEventListener("visibilitychange", function () {
        hidden = document.hidden;
    });

    function begin() {
        startTime = performance.now();
        lastStep = startTime;
        seedFromName();
        requestAnimationFrame(frame);
    }

    size();
    if (reduce) {
        seedFromName();
        if (overlay) overlay.style.opacity = "1";
        staticFrame();
        window.addEventListener("scroll", updateOpacity, { passive: true });
    } else if (document.fonts && document.fonts.load) {
        document.fonts.load('700 ' + (CELL * 4) + 'px "JetBrains Mono"')
            .then(function () { return document.fonts.ready; })
            .then(begin, begin);
    } else {
        begin();
    }
})();
