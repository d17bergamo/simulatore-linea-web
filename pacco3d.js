// Vista 3D del pacco della versione web: pacco con le legature e catena di quote (distanze tra le legature) sopra il pacco,
// come nel programma Windows. Assi: X lungo il pacco (testa a destra), Y in alto, Z in larghezza. Misure in metri.
(function () {
    'use strict';
    var P = null;   // stato corrente

    function css(name, fallback) {
        var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
    }

    function label(text, dark) {
        var c = document.createElement('canvas');
        c.width = 192; c.height = 80;
        var g = c.getContext('2d');
        g.fillStyle = dark ? 'rgba(31,39,48,0.92)' : 'rgba(255,255,255,0.92)';
        g.fillRect(0, 0, 192, 80);
        g.strokeStyle = dark ? '#38424e' : '#c9d0d8';
        g.strokeRect(1, 1, 190, 78);
        g.fillStyle = dark ? '#e6ebf0' : '#1b2430';
        g.font = '600 46px "Segoe UI", system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, 96, 42);
        var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
        s.scale.set(0.62, 0.26, 1);
        s.renderOrder = 10;
        return s;
    }

    function box(sx, sy, sz, x, y, z, mat) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
        m.position.set(x, y, z);
        return m;
    }

    function dispose() {
        if (!P) return;
        P.alive = false;
        if (P.observer) P.observer.disconnect();
        P.canvas.removeEventListener('pointerdown', P.onDown);
        P.canvas.removeEventListener('pointermove', P.onMove);
        P.canvas.removeEventListener('pointerup', P.onUp);
        P.canvas.removeEventListener('wheel', P.onWheel);
        P.renderer.dispose();
        P = null;
    }

    function place() {
        var o = P.orbit, c = P.cam;
        o.phi = Math.min(1.5, Math.max(0.05, o.phi));
        c.position.set(
            o.target.x + o.radius * Math.sin(o.phi) * Math.cos(o.theta),
            o.target.y + o.radius * Math.cos(o.phi),
            o.target.z + o.radius * Math.sin(o.phi) * Math.sin(o.theta));
        c.lookAt(o.target);
        P.need = true;
    }

    function resize() {
        var w = P.canvas.clientWidth, h = P.canvas.clientHeight;
        if (w < 2 || h < 2) return;
        P.renderer.setSize(w, h, false);
        P.cam.aspect = w / h;
        P.cam.updateProjectionMatrix();
        P.need = true;
    }

    function fitRadius() {
        // distanza con cui il pacco e le quote stanno nell'inquadratura
        var half = P.half, aspect = P.cam.aspect || 1.6;
        var vf = P.cam.fov * Math.PI / 180;
        var needW = half * 2.25 / aspect, needH = P.height * 1.25;
        return Math.max(needW, needH) / (2 * Math.tan(vf / 2)) + 0.6;
    }

    function loop() {
        if (!P || !P.alive) return;
        if (P.need) { P.need = false; P.renderer.render(P.scene, P.cam); }
        requestAnimationFrame(loop);
    }

    function build(d, dark) {
        var scene = new THREE.Scene();
        scene.background = new THREE.Color(dark ? 0x0b1016 : 0xf4f6f8);
        scene.add(new THREE.AmbientLight(0xffffff, 0.85));
        var sun = new THREE.DirectionalLight(0xffffff, 0.6);
        sun.position.set(3, 8, 5);
        scene.add(sun);

        var L = d.lengthM, W = d.widthM, H = d.heightM;
        var packMat = new THREE.MeshLambertMaterial({ color: dark ? 0x6b7c8e : 0x9aa7b4 });
        var edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(L, H, W)),
            new THREE.LineBasicMaterial({ color: dark ? 0xb8c4d0 : 0x4a5563 }));
        var pack = box(L, H, W, 0, H / 2, 0, packMat);
        scene.add(pack);
        edge.position.set(0, H / 2, 0);
        scene.add(edge);

        var strapMat = new THREE.MeshLambertMaterial({ color: dark ? 0xf2a93b : 0xd97706 });
        var dimColor = dark ? 0xaab6c2 : 0x34465c;
        var dimMat = new THREE.MeshBasicMaterial({ color: dimColor });
        var pos = d.straps.slice().sort(function (a, b) { return a - b; });
        var meshes = [];
        pos.forEach(function (m) {
            var sm = box(0.05, H + 0.03, W + 0.03, L / 2 - m, H / 2, 0, strapMat);
            // zona di presa più larga della legatura (invisibile), per trascinarla con il dito
            var hit = box(0.22, H + 0.03, W + 0.03, 0, 0, 0, new THREE.MeshBasicMaterial({ visible: false }));
            sm.add(hit);
            sm.userData.hit = hit;
            scene.add(sm);
            meshes.push(sm);
        });
        scene.userData.straps = meshes;

        // catena di quote sopra il pacco: testa → legature → coda, richiami verticali
        if (pos.length) {
            var y = H + 0.55, marks = [0].concat(pos, [L]);
            scene.add(box(L, 0.012, 0.012, 0, y, 0, dimMat));
            marks.forEach(function (m) {
                var x = L / 2 - m;
                scene.add(box(0.012, 0.16, 0.012, x, y, 0, dimMat));
                scene.add(box(0.008, y - H - 0.02, 0.008, x, (y + H) / 2, 0, dimMat));
            });
            for (var i = 1; i < marks.length; i++) {
                var a = marks[i - 1], b = marks[i];
                if (b - a < 1e-6) continue;
                var s = label(String(Math.round((b - a) * 1000)), dark);
                s.position.set(L / 2 - (a + b) / 2, y + 0.2, 0);
                scene.add(s);
            }
        }
        // piano d'appoggio
        scene.add(box(L + 1.2, 0.02, W + 1.0, 0, -0.011, 0, new THREE.MeshLambertMaterial({ color: dark ? 0x1a222b : 0xdfe4ea })));
        return scene;
    }

    // posizione ammessa per la legatura idx: a passi di 50 mm, tra le vicine (almeno un passo) e dentro il pacco
    function clampStrap(d, idx, mm) {
        var pos = d.straps.map(function (v) { return Math.round(v * 1000); });
        var step = 50, L = d.lengthMm;
        var lo = idx > 0 ? pos[idx - 1] + step : step;
        var hi = idx < pos.length - 1 ? pos[idx + 1] - step : L - step;
        var v = Math.round(mm / step) * step;
        return Math.min(Math.max(v, lo), Math.max(lo, hi));
    }

    // Righello sotto il pacco: testa a destra come nel 3D; le legature si trascinano a passi di 50 mm
    function makeRuler(d) {
        var host = d.rulerId ? document.getElementById(d.rulerId) : null;
        if (!host) return { set: function () {} };
        var NS = 'http://www.w3.org/2000/svg', W = 1000, M = 24, L = d.lengthMm;
        var txt = css('--testo', '#1b2430'), mute = css('--tenue', '#5b6775'), acc = css('--lega', '#d97706');
        function X(mm) { return M + (1 - mm / L) * (W - 2 * M); }
        function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
        host.innerHTML = '';
        var svg = el('svg', { viewBox: '0 0 ' + W + ' 74', preserveAspectRatio: 'none' });
        svg.appendChild(el('line', { x1: M, y1: 40, x2: W - M, y2: 40, stroke: mute, 'stroke-width': 2 }));
        for (var t = 0; t <= L; t += 500) {
            var big = t % 1000 === 0;
            svg.appendChild(el('line', { x1: X(t), y1: big ? 32 : 36, x2: X(t), y2: 44, stroke: mute }));
            if (big) { var tt = el('text', { x: X(t), y: 62, 'text-anchor': 'middle', 'font-size': 14, fill: mute }); tt.textContent = (t / 1000) + ' m'; svg.appendChild(tt); }
        }
        var hs = [], ts = [];
        var cur = d.straps.map(function (v) { return Math.round(v * 1000); });
        cur.forEach(function (mm, i) {
            var g = el('g', { style: 'cursor:ew-resize' });
            var c = el('rect', { x: X(mm) - 9, y: 12, width: 18, height: 36, rx: 4, fill: acc, stroke: txt, 'stroke-width': 1 });
            var tx = el('text', { x: X(mm), y: 9, 'text-anchor': 'middle', 'font-size': 14, fill: txt }); tx.textContent = mm;
            g.appendChild(c); g.appendChild(tx); svg.appendChild(g);
            hs.push(c); ts.push(tx);
            var drag = null;
            g.addEventListener('pointerdown', function (e) { e.stopPropagation(); g.setPointerCapture(e.pointerId); drag = { mm: cur[i], moved: false }; });
            g.addEventListener('pointermove', function (e) {
                if (!drag) return;
                var r = svg.getBoundingClientRect();
                var px = (e.clientX - r.left) / r.width * W;
                var mm2 = clampStrap({ straps: cur.map(function (v) { return v / 1000; }), lengthMm: L }, i, (1 - (px - M) / (W - 2 * M)) * L);
                if (mm2 !== drag.mm) { drag.mm = mm2; drag.moved = true; api.set(i, mm2); if (P && P.scene) { P.scene.userData.straps[i].position.x = d.lengthM / 2 - mm2 / 1000; P.need = true; } }
            });
            g.addEventListener('pointerup', function () { if (drag && drag.moved && d.dotnet) d.dotnet.invokeMethodAsync('MoveStrap', d.id, i, drag.mm); drag = null; });
        });
        var api = {
            set: function (i, mm) { cur[i] = mm; hs[i].setAttribute('x', X(mm) - 9); ts[i].setAttribute('x', X(mm)); ts[i].textContent = mm; }
        };
        host.appendChild(svg);
        return api;
    }

    window.pacco3d = {
        // d = { lengthM, widthM, heightM, straps: [m dalla testa], dark }
        show: function (canvasId, d) {
            try {
                var canvas = document.getElementById(canvasId);
                if (!canvas || !window.THREE) return false;
                var keep = P && P.canvas === canvas ? { theta: P.orbit.theta, phi: P.orbit.phi, user: P.user } : null;
                dispose();
                var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                P = {
                    alive: true, canvas: canvas, renderer: renderer, need: true, half: d.lengthM / 2,
                    height: d.heightM + 1.0, user: keep ? keep.user : false,
                    cam: new THREE.PerspectiveCamera(35, 1.6, 0.05, 200),
                    orbit: { theta: keep ? keep.theta : Math.PI * 0.12, phi: keep ? keep.phi : 1.18, radius: 8, target: new THREE.Vector3(0, (d.heightM + 0.5) / 2, 0) }
                };
                var t = document.documentElement.getAttribute('data-tema');
                var dark = t === 'scuro' || (t !== 'chiaro' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
                P.scene = build(d, dark);
                var ruler = makeRuler(d);
                var down = null, drag = null;
                var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
                function setRay(e) {
                    var r = canvas.getBoundingClientRect();
                    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
                    ray.setFromCamera(ndc, P.cam);
                }
                function mmAt(e) {
                    setRay(e);
                    var pt = new THREE.Vector3();
                    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -d.heightM);
                    if (!ray.ray.intersectPlane(plane, pt)) return null;
                    return (d.lengthM / 2 - pt.x) * 1000;
                }
                P.onDown = function (e) {
                    canvas.setPointerCapture(e.pointerId);
                    setRay(e);
                    var hits = ray.intersectObjects(P.scene.userData.straps.map(function (m) { return m.userData.hit; }), false);
                    if (hits.length && d.dotnet) {
                        var idx = P.scene.userData.straps.indexOf(hits[0].object.parent);
                        drag = { idx: idx, mm: d.straps[idx] * 1000, moved: false };
                        return;
                    }
                    down = { x: e.clientX, y: e.clientY };
                };
                P.onMove = function (e) {
                    if (drag) {
                        var mm = mmAt(e);
                        if (mm == null) return;
                        mm = clampStrap(d, drag.idx, mm);
                        if (mm !== drag.mm) {
                            drag.mm = mm; drag.moved = true;
                            P.scene.userData.straps[drag.idx].position.x = d.lengthM / 2 - mm / 1000;
                            ruler.set(drag.idx, mm);
                            P.need = true;
                        }
                        return;
                    }
                    if (!down) return;
                    P.orbit.theta -= (e.clientX - down.x) * 0.008;
                    P.orbit.phi -= (e.clientY - down.y) * 0.008;
                    down = { x: e.clientX, y: e.clientY };
                    P.user = true;
                    place();
                };
                P.onUp = function () {
                    down = null;
                    if (drag) { var g = drag; drag = null; if (g.moved) d.dotnet.invokeMethodAsync('MoveStrap', d.id, g.idx, g.mm); }
                };
                P.onWheel = function (e) { e.preventDefault(); P.orbit.radius *= e.deltaY > 0 ? 1.1 : 0.9; place(); };
                canvas.addEventListener('pointerdown', P.onDown);
                canvas.addEventListener('pointermove', P.onMove);
                canvas.addEventListener('pointerup', P.onUp);
                canvas.addEventListener('wheel', P.onWheel, { passive: false });
                P.observer = new ResizeObserver(function () { if (P) { resize(); P.orbit.radius = fitRadius(); place(); } });
                P.observer.observe(canvas);
                resize();
                P.orbit.radius = fitRadius();
                place();
                loop();
                return true;
            } catch (e) { return false; }
        },
        view: function (name) {
            if (!P) return;
            if (name === 'alto') { P.orbit.theta = 0; P.orbit.phi = 0.05; }
            else if (name === 'lato') { P.orbit.theta = Math.PI / 2; P.orbit.phi = 1.5; }
            else { P.orbit.theta = Math.PI * 0.12; P.orbit.phi = 1.18; }
            P.orbit.radius = fitRadius();
            place();
        },
        dispose: dispose
    };
})();
