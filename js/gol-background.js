/*
 * Hero Game of Life.
 *
 * Lives inside the ~58vh hero band (not full-bleed anymore, so the prose below
 * sits on a solid, legible background). Colors mirror Mehul's logo: live cells
 * are hsl(80 + k*distance, ...) anchored top-right, sweeping chartreuse ->
 * green -> teal -> blue, over a dark green-black field.
 *
 * Behavior, per the hero-redesign brief:
 *   - cells fade in/out (no hard on/off), settling to a dim moss-green
 *   - a brighter/faster "ignite" flourish for the first few seconds, then calm
 *   - canvas fades toward the page background as you scroll down to read
 *   - ticking pauses once faded (battery) and on a hidden tab
 *   - prefers-reduced-motion: one static settled frame, no animation
 */
(function () {
    "use strict";

    var canvas = document.getElementById("gol");
    var ctx = canvas.getContext("2d");
    var hero = document.querySelector(".hero");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- Tunables ---
    var CELL = 15;             // px per cell
    var STEP_MS = 240;         // ~4 generations/sec: alive without flicker
    var SEED_DENSITY = 0.30;
    var PAD = 10;              // hidden off-screen margin; life drifts in from it
    var HUE_BASE = 80;         // logo's chartreuse
    var HUE_SPAN = 145;        // degrees swept to the far corner -> ~blue
    var RISE = 0.22, FALL = 0.06; // brightness ease per frame (fast in, slow out)
    var SETTLE_L = 42;         // dim moss-green lightness once settled (%)
    var IGNITE_MS = 2600;      // full-bright opening window
    var CALM_MS = 4200;        // ease-down duration after the ignite

    var cols, rows, grid, next, bright, anchorX, anchorY, maxDist;
    var startTime = 0, lastStep = 0, history = [], sinceSprinkle = 0;
    var opacity = 1, hidden = false;

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

    // Soup only into the hidden margin ring, so new life arrives from off-screen.
    function seedMargin() {
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                var edge = x < PAD || x >= cols - PAD || y < PAD || y >= rows - PAD;
                if (edge && Math.random() < SEED_DENSITY) grid[y * cols + x] = 1;
            }
        }
    }

    function size() {
        canvas.width = hero.clientWidth;
        canvas.height = hero.clientHeight;
        anchorX = canvas.width;   // hue anchored at the top-right, like the logo
        anchorY = 0;
        maxDist = Math.hypot(canvas.width, canvas.height) || 1;
        makeGrid();
        seedAll();
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

    // 1 during the opening ignite, easing to 0 as the world calms.
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
                var target = grid[i] ? 1 : 0;
                var b = bright[i];
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
        if (opacity < 0.1) return; // faded out of view: stop ticking (battery)

        if (now - lastStep >= STEP_MS) {
            lastStep = now;
            var alive = step();
            history.push(alive);
            if (history.length > 40) history.shift();
            sinceSprinkle++;
            var frozen = history.length === 40 &&
                history.every(function (v) { return v === history[0]; });
            if (alive < cols * rows * 0.004 || frozen) {
                seedAll();
                history.length = 0;
            } else if (sinceSprinkle > 150) {
                seedMargin();
                sinceSprinkle = 0;
            }
        }
        render(now);
    }

    // Static settled frame for reduced-motion: draw the seed once, dimly, no loop.
    function staticFrame() {
        for (var i = 0; i < grid.length; i++) bright[i] = grid[i] ? 1 : 0;
        startTime = -1e9; // forces igniteFactor -> 0, so it renders calm
        render(0);
        updateOpacity();
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            size();
            if (reduce) staticFrame();
        }, 150);
    });
    document.addEventListener("visibilitychange", function () {
        hidden = document.hidden;
    });

    size();
    if (reduce) {
        staticFrame();
        window.addEventListener("scroll", updateOpacity, { passive: true });
    } else {
        startTime = performance.now();
        lastStep = startTime;
        requestAnimationFrame(frame);
    }
})();
