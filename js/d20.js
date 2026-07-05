/*
 * A little D20 at the very bottom of the page. Grab it and fling — it tumbles
 * and rolls to a stop. Numbered faces, colored to match the logo palette
 * (green faces, chartreuse edges). three.js is lazy-loaded only once the die
 * scrolls near the viewport, so it costs nothing for visitors who never reach
 * the bottom. Rendering pauses when the die is off-screen or the tab is hidden.
 */
(function () {
    "use strict";
    var mount = document.getElementById("d20");
    if (!mount) return;

    // Lazy-load three.js on first approach.
    var started = false;
    var gate = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !started) {
            started = true;
            gate.disconnect();
            import("https://unpkg.com/three@0.160.0/build/three.module.js")
                .then(function (THREE) { init(THREE); })
                .catch(function (err) { console.error("d20: three.js failed to load", err); });
        }
    }, { rootMargin: "300px" });
    gate.observe(mount);

    function init(THREE) {
        var SIZE = 128;
        var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(SIZE, SIZE);
        renderer.domElement.style.touchAction = "none";
        mount.appendChild(renderer.domElement);

        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
        camera.position.set(0, 0, 3.3);

        scene.add(new THREE.AmbientLight(0x6a7a6a, 0.9));
        var key = new THREE.DirectionalLight(0xe6ffb0, 1.15);
        key.position.set(2, 3, 2);   // top-right, echoing the palette anchor
        scene.add(key);
        var fill = new THREE.DirectionalLight(0x66aaff, 0.35);
        fill.position.set(-2, -1, 1);
        scene.add(fill);

        var die = new THREE.Group();
        scene.add(die);

        var geo = new THREE.IcosahedronGeometry(1, 0);
        die.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(100 / 360, 0.5, 0.32),
            flatShading: true, metalness: 0.15, roughness: 0.55
        })));
        die.add(new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: new THREE.Color().setHSL(80 / 360, 0.85, 0.6) })
        ));

        // A number on each of the 20 faces.
        function numberTexture(n) {
            var c = document.createElement("canvas");
            c.width = c.height = 64;
            var g = c.getContext("2d");
            g.fillStyle = "#eaf3ec";
            g.font = 'bold 40px "JetBrains Mono", monospace';
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.fillText(String(n), 32, 34);
            var t = new THREE.CanvasTexture(c);
            t.anisotropy = 4;
            return t;
        }
        var logoTex = new THREE.TextureLoader().load("/assets/logo.png");
        logoTex.colorSpace = THREE.SRGBColorSpace;
        logoTex.anisotropy = 4;

        var pos = geo.attributes.position;
        var v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
        var Z = new THREE.Vector3(0, 0, 1);
        for (var f = 0; f < pos.count / 3; f++) {
            v0.fromBufferAttribute(pos, f * 3);
            v1.fromBufferAttribute(pos, f * 3 + 1);
            v2.fromBufferAttribute(pos, f * 3 + 2);
            var centroid = new THREE.Vector3().add(v0).add(v1).add(v2).multiplyScalar(1 / 3);
            var normal = new THREE.Vector3().subVectors(v1, v0)
                .cross(new THREE.Vector3().subVectors(v2, v0)).normalize();
            // The 20 face wears the logo instead of a number.
            var isLogo = (f + 1) === 20;
            var s = isLogo ? 0.50 : 0.62;
            var num = new THREE.Mesh(
                new THREE.PlaneGeometry(s, s),
                new THREE.MeshBasicMaterial({
                    map: isLogo ? logoTex : numberTexture(f + 1),
                    transparent: true, depthWrite: false
                })
            );
            num.position.copy(centroid).addScaledVector(normal, 0.02);
            num.quaternion.setFromUnitVectors(Z, normal);
            die.add(num);
        }

        // --- Pull to roll ---
        var av = new THREE.Vector3(); // angular velocity: 0 at rest, set by a throw
        var dragging = false, lastX = 0, lastY = 0;
        var q = new THREE.Quaternion(), axis = new THREE.Vector3();

        function spin(x, y, z) {
            axis.set(x, y, z);
            var a = axis.length();
            if (a < 1e-6) return;
            die.quaternion.premultiply(q.setFromAxisAngle(axis.normalize(), a));
        }

        var el = renderer.domElement;
        el.addEventListener("pointerdown", function (e) {
            dragging = true; lastX = e.clientX; lastY = e.clientY;
            av.set(0, 0, 0);
            el.setPointerCapture(e.pointerId);
            loop(); // wake the render loop for the drag
        });
        el.addEventListener("pointermove", function (e) {
            if (!dragging) return;
            var dx = e.clientX - lastX, dy = e.clientY - lastY;
            lastX = e.clientX; lastY = e.clientY;
            spin(dy * 0.01, dx * 0.01, 0);   // drag maps to rotation
            av.set(dy * 0.01, dx * 0.01, 0);  // remember it as the throw
        });
        function release() {
            if (!dragging) return;
            dragging = false;
            if (av.length() < 0.02) { // a gentle tug still rolls
                av.set((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.22, 0);
            }
        }
        el.addEventListener("pointerup", release);
        el.addEventListener("pointercancel", release);

        // --- Render loop: runs only while dragging or rolling, then stops.
        //     No idle spin — the die sits still until you pull it. ---
        var visible = false, running = false;
        function loop() {
            if (!running && visible && !document.hidden) { running = true; requestAnimationFrame(tick); }
        }
        function tick() {
            if (!visible || document.hidden) { running = false; return; }
            if (!dragging) {
                spin(av.x, av.y, av.z);
                av.multiplyScalar(0.95);        // damping: the roll slows to a stop
                if (av.length() < 0.0005) av.set(0, 0, 0);
            }
            renderer.render(scene, camera);
            if (dragging || av.lengthSq() > 0) {
                requestAnimationFrame(tick);    // keep going while there's motion
            } else {
                running = false;                // settled: no wasted frames
            }
        }
        new IntersectionObserver(function (entries) {
            visible = entries[0].isIntersecting;
            if (visible) loop();
        }, { threshold: 0.01 }).observe(mount);
        document.addEventListener("visibilitychange", function () { if (!document.hidden) loop(); });

        renderer.render(scene, camera);
    }
})();
