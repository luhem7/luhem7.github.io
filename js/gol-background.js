/*
 * Ambient Game of Life background.
 *
 * Colors mirror Mehul's logo (gol-logo-generator): each live cell's hue is
 * hsl(80 + k*distance, 90%, L) anchored at the TOP-RIGHT corner, so color
 * sweeps chartreuse -> green -> teal -> blue outward, exactly like the logo's
 * rainbow_center. Dead field is a dark green-black; a translucent fade each
 * frame leaves a soft glowing decay trail ("warm June night", not physics demo).
 */
(function () {
    "use strict";

    var canvas = document.getElementById("gol");
    var ctx = canvas.getContext("2d");

    // --- Tunables (kept few, per the campsite principle) ---
    var CELL = 16;              // px per cell
    var STEP_MS = 110;          // sim tick interval
    var SEED_DENSITY = 0.28;    // fraction alive on a fresh soup
    var PAD = 12;               // hidden off-screen cell margin on every side
    var FADE = "rgba(9, 13, 12, 0.22)"; // dark green-black trail wash
    var HUE_BASE = 80;          // logo's starting hue (chartreuse)
    var HUE_SPAN = 145;         // degrees swept to the far corner -> ~blue

    var cols, rows, grid, next, anchorX, anchorY, maxDist;

    function makeGrid() {
        // Grid is PAD cells larger than the viewport on all sides. Those extra
        // cells live off-screen; we seed fresh noise there so it drifts INTO
        // view across the edge instead of popping in where visitors can see it.
        cols = Math.ceil(canvas.width / CELL) + 2 * PAD;
        rows = Math.ceil(canvas.height / CELL) + 2 * PAD;
        grid = new Uint8Array(cols * rows);
        next = new Uint8Array(cols * rows);
    }

    // Soup into the whole board (visible + hidden).
    function seedAll() {
        for (var i = 0; i < grid.length; i++) {
            if (Math.random() < SEED_DENSITY) grid[i] = 1;
        }
    }

    // Soup only into the hidden margin ring, never the visible interior, so
    // new life arrives from off-screen rather than appearing mid-view.
    function seedMargin() {
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                var hidden = x < PAD || x >= cols - PAD ||
                             y < PAD || y >= rows - PAD;
                if (hidden && Math.random() < SEED_DENSITY) grid[y * cols + x] = 1;
            }
        }
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Anchor hue at the top-right corner, like the logo's rainbow center.
        anchorX = canvas.width;
        anchorY = 0;
        maxDist = Math.hypot(canvas.width, canvas.height);
        makeGrid();
        seedAll();
        // Paint the dark field once so the first frames aren't transparent.
        ctx.fillStyle = "#090d0c";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function step() {
        var alive = 0;
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                var n = 0;
                // Toroidal neighborhood so gliders wrap instead of dying at edges.
                for (var dy = -1; dy <= 1; dy++) {
                    for (var dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        var nx = (x + dx + cols) % cols;
                        var ny = (y + dy + rows) % rows;
                        n += grid[ny * cols + nx];
                    }
                }
                var i = y * cols + x;
                var live = grid[i]
                    ? (n === 2 || n === 3) ? 1 : 0
                    : (n === 3) ? 1 : 0;
                next[i] = live;
                alive += live;
            }
        }
        var tmp = grid; grid = next; next = tmp;
        return alive;
    }

    function draw() {
        // Fade the previous frame toward the dark field -> glowing trails.
        ctx.fillStyle = FADE;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
                if (!grid[y * cols + x]) continue;
                // Shift by the hidden margin so grid cell (PAD,PAD) is the
                // top-left of the viewport; margin cells land off-canvas.
                var px = (x - PAD) * CELL, py = (y - PAD) * CELL;
                if (px < -CELL || py < -CELL ||
                    px > canvas.width || py > canvas.height) continue;
                var dist = Math.hypot(px - anchorX, py - anchorY);
                var hue = HUE_BASE + (dist / maxDist) * HUE_SPAN;
                ctx.fillStyle = "hsl(" + hue + ", 88%, 58%)";
                // Filled circle, echoing the dots in the logo.
                ctx.beginPath();
                ctx.arc(px + CELL / 2, py + CELL / 2, (CELL - 2) / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // --- Loop with stagnation guard so it stays alive forever ---
    var lastStep = 0;
    var history = [];      // recent populations, to detect a frozen board
    var sinceSprinkle = 0; // ticks since last liveliness injection

    function tick(now) {
        if (now - lastStep >= STEP_MS) {
            lastStep = now;
            var alive = step();
            draw();

            history.push(alive);
            if (history.length > 40) history.shift();
            sinceSprinkle++;

            // Reseed if the board died out or froze into a still life; also
            // periodically sprinkle a patch so oscillators don't get boring.
            var frozen = history.length === 40 &&
                history.every(function (v) { return v === history[0]; });
            if (alive < cols * rows * 0.005 || frozen) {
                seedAll();
                history.length = 0;
            } else if (sinceSprinkle > 120) { // ~13s at STEP_MS
                seedMargin();
                sinceSprinkle = 0;
            }
        }
        requestAnimationFrame(tick);
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 150);
    });

    resize();
    requestAnimationFrame(tick);
})();
