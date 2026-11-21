// Vista 3D della versione web. Disegna soltanto: posizioni e stati arrivano dai fotogrammi del motore (nessuna animazione propria).
// Assi: X lungo la linea (metri dall'inizio), Y in alto, Z verso il trasferitore.
(function () {
    'use strict';
    var S = null;                 // stato della scena corrente
    var ROLLER_TOP = 0.88;        // quota del piano rulli [m]

    function css(name, fallback) {
        var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
    }

    function box(w, h, d, material) {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    }

    function label(text) {
        var c = document.createElement('canvas');
        c.width = 256; c.height = 96;
        var g = c.getContext('2d');
        g.fillStyle = 'rgba(20,23,27,0.82)';
        g.fillRect(0, 0, 256, 96);
        g.fillStyle = '#ffffff';
        g.font = '600 56px system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, 128, 50);
        var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
        sprite.scale.set(1.6, 0.6, 1);
        sprite.renderOrder = 10;
        return sprite;
    }

    function dispose() {
        if (!S) return;
        S.alive = false;
        if (S.observer) S.observer.disconnect();
        S.canvas.removeEventListener('pointerdown', S.onDown);
        S.canvas.removeEventListener('pointermove', S.onMove);
        S.canvas.removeEventListener('pointerup', S.onUp);
        S.canvas.removeEventListener('pointercancel', S.onUp);
        S.canvas.removeEventListener('wheel', S.onWheel);
        S.renderer.dispose();
        S = null;
    }

    function placeCamera() {
        var c = S.cam, o = S.orbit;
        o.phi = Math.min(1.5, Math.max(0.08, o.phi));
        o.radius = Math.min(S.len * 3, Math.max(3, o.radius));
        c.position.set(
            o.target.x + o.radius * Math.sin(o.phi) * Math.cos(o.theta),
            o.target.y + o.radius * Math.cos(o.phi),
            o.target.z + o.radius * Math.sin(o.phi) * Math.sin(o.theta));
        c.lookAt(o.target);
        S.need = true;
    }

    // Allontana la camera finché tutti i punti dati stanno nell'inquadratura (con un po' di margine).
    function fit(points) {
        var o = S.orbit, v = new THREE.Vector3();
        for (var n = 0; n < 60; n++) {
            placeCamera();
            S.cam.updateMatrixWorld();
            var inside = points.every(function (p) {
                v.set(p[0], p[1], p[2]).project(S.cam);
                return Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.86 && v.z < 1;
            });
            if (inside) return;
            o.radius *= 1.07;
        }
    }

    function view(name) {
        if (!S) return;
        var o = S.orbit, L = S.layout, len = S.len;
        var lateral = L.strokeM + L.accM, t0 = L.transferStartM - L.startM, t1 = L.transferEndM - L.startM;
        if (name === 'legatura') {
            var first = L.strappers.length ? L.strappers[0] - L.startM : 0;
            var last = L.strappers.length ? L.strappers[L.strappers.length - 1] - L.startM : len * 0.3;
            o.target.set((first + last) / 2, 1, 0); o.radius = 8; o.theta = -1.15; o.phi = 1.0;
            fit([[first - 3, 0, -2], [last + 3, 0, -2], [first - 3, 3, 1], [last + 3, 3, 1]]);
        } else if (name === 'trasferitore') {
            o.target.set((t0 + t1) / 2, 0.5, lateral / 2); o.radius = 8; o.theta = -0.75; o.phi = 0.9;
            fit([[t0, 0, -1], [t1, 0, -1], [t0, 1.5, lateral], [t1, 1.5, lateral]]);
        } else if (name === 'alto') {
            o.target.set(len / 2, 0, lateral / 2); o.radius = 8; o.theta = -Math.PI / 2; o.phi = 0.09;
            fit([[0, 0, -1.5], [len, 0, -1.5], [0, 0, lateral], [len, 0, lateral]]);
        } else {
            o.target.set(len * 0.5, 0, lateral * 0.3); o.radius = 8; o.theta = -1.0; o.phi = 0.95;
            fit([[0, 0, -1.5], [len, 0, -1.5], [0, 3, 0], [len, 3, 0], [t0, 0, lateral], [t1, 0, lateral]]);
        }
        placeCamera();
    }

    function init(canvasId, L) {
        dispose();
        var canvas = document.getElementById(canvasId);
        if (!canvas || typeof THREE === 'undefined') return false;
        var renderer;
        try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); }
        catch (e) { return false; }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        var len = L.endM - L.startM;
        var col = {
            sfondo: css('--carta', '#ffffff'), rulli: css('--rulli', '#e3e6ea'), marcia: css('--rulli-marcia', '#9fd8b5'),
            lenta: css('--rulli-lenta', '#f2d28a'), pacco: css('--pacco', '#51606f'), lega: css('--lega', '#d97706'),
            intesta: css('--intesta', '#0b6bcb'), attesa: css('--attesa', '#8a939e'), trasf: css('--trasf', '#7c5cc4'),
            macchina: css('--macchina', '#2f3b47'), fc: css('--fc', '#b9c0c8'), fcOn: css('--fc-on', '#e2a100'),
            errore: css('--errore', '#c0262d'), bordo: css('--bordo', '#d9dde3')
        };
        var scene = new THREE.Scene();
        scene.background = new THREE.Color(col.sfondo);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f96, 0.95));
        var sun = new THREE.DirectionalLight(0xffffff, 0.55);
        sun.position.set(-len * 0.2, 30, -18);
        scene.add(sun);

        var lateral = L.strokeM + L.accM;
        var floor = new THREE.Mesh(new THREE.PlaneGeometry(len + 16, lateral + 16), new THREE.MeshLambertMaterial({ color: col.rulli }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(len / 2, -0.01, lateral / 2);
        scene.add(floor);
        var grid = new THREE.GridHelper(Math.ceil((len + 16) / 2) * 2, Math.ceil((len + 16) / 2), col.bordo, col.bordo);
        grid.position.set(len / 2, 0, lateral / 2);
        scene.add(grid);

        // vie a rulli: un telaio per inverter (cambia colore con la velocità) e i rulli
        var bandMats = [];
        var steel = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });
        L.bands.forEach(function (b) {
            var m = new THREE.MeshLambertMaterial({ color: col.rulli });
            bandMats.push(m);
            var l = b.endM - b.startM;
            [-0.48, 0.48].forEach(function (z) {
                var rail = box(Math.max(0.1, l - 0.06), 0.3, 0.1, m);
                rail.position.set((b.startM + b.endM) / 2 - L.startM, ROLLER_TOP - 0.2, z);
                scene.add(rail);
            });
            for (var x = b.startM + 0.6; x < b.endM - 0.2; x += 3) {
                var leg = box(0.12, ROLLER_TOP - 0.35, 0.9, steel);
                leg.position.set(x - L.startM, (ROLLER_TOP - 0.35) / 2, 0);
                scene.add(leg);
            }
        });
        var pitch = Math.max(0.3, L.pitchM);
        var count = Math.max(1, Math.floor(len / pitch));
        var rollers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.86, 14), new THREE.MeshLambertMaterial({ color: 0xb8c0c8 }), count);
        var dummy = new THREE.Object3D();
        for (var i = 0; i < count; i++) {
            dummy.position.set(pitch / 2 + i * pitch, ROLLER_TOP - 0.15, 0);
            dummy.rotation.set(Math.PI / 2, 0, 0);
            dummy.updateMatrix();
            rollers.setMatrixAt(i, dummy.matrix);
        }
        scene.add(rollers);

        // legatrici: portale attorno alla via e corpo macchina sul lato opposto al trasferitore
        var strapMats = [];
        L.strappers.forEach(function (pos, k) {
            var m = new THREE.MeshLambertMaterial({ color: col.macchina });
            strapMats.push(m);
            var x = pos - L.startM, g = new THREE.Group();
            var c1 = box(0.3, 2.3, 0.25, m); c1.position.set(0, 1.15, -0.8); g.add(c1);
            var c2 = box(0.3, 2.3, 0.25, m); c2.position.set(0, 1.15, 0.8); g.add(c2);
            var top = box(0.3, 0.25, 1.85, m); top.position.set(0, 2.3, 0); g.add(top);
            var body = box(1.0, 1.5, 0.9, m); body.position.set(0, 0.75, -1.45); g.add(body);
            var tag = label(L.strapperIds[k] || ('L' + (k + 1))); tag.position.set(0, 2.95, 0); g.add(tag);
            g.position.x = x;
            scene.add(g);
        });

        // fotocellule: colonnina con la lampada
        var fcMats = [];
        L.photocells.forEach(function (pos) {
            var m = new THREE.MeshBasicMaterial({ color: col.fc });
            fcMats.push(m);
            var post = box(0.06, 1.15, 0.06, steel); post.position.set(pos - L.startM, 0.575, -0.72); scene.add(post);
            var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), m); lamp.position.set(pos - L.startM, 1.2, -0.72); scene.add(lamp);
        });

        // fermi scomparenti (salgono e scendono) e fermo finale
        var red = new THREE.MeshLambertMaterial({ color: col.errore });
        var stops = L.stops.map(function (pos) {
            var plate = box(0.08, 0.5, 0.8, red);
            plate.position.set(pos - L.startM + 0.04, ROLLER_TOP - 0.3, 0);
            scene.add(plate);
            return plate;
        });
        var end = box(0.12, 0.75, 0.95, red);
        end.position.set(L.stopperM - L.startM + 0.06, ROLLER_TOP + 0.25, 0);
        scene.add(end);

        // trasferitore: travi trasversali tra i rulli, poi l'accumulo
        var beam = new THREE.MeshLambertMaterial({ color: 0x6f7a86 });
        var beamAcc = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });
        var tl = L.transferEndM - L.transferStartM, nb = Math.max(2, Math.round(tl / 3));
        for (var j = 0; j < nb; j++) {
            var bx = L.transferStartM - L.startM + (j + 0.5) * tl / nb;
            bx = (Math.round((bx - pitch) / pitch) + 1) * pitch;          // tra due rulli
            if (L.strokeM > 0) {
                var t1 = box(0.14, 0.35, L.strokeM + 0.6, beam); t1.position.set(bx, ROLLER_TOP - 0.3, L.strokeM / 2 + 0.1); scene.add(t1);
            }
            if (L.accM > 0) {
                var t2 = box(0.14, 0.5, L.accM, beamAcc); t2.position.set(bx, ROLLER_TOP - 0.27, L.strokeM + 0.4 + L.accM / 2); scene.add(t2);
            }
        }

        var cam = new THREE.PerspectiveCamera(38, 1, 0.5, len * 6 + 200);
        S = {
            alive: true, canvas: canvas, renderer: renderer, scene: scene, cam: cam, layout: L, len: len, col: col,
            bandMats: bandMats, strapMats: strapMats, fcMats: fcMats, stops: stops,
            packs: [], labels: {}, need: true,
            orbit: { target: new THREE.Vector3(), radius: len, theta: -0.6, phi: 1.05 },
            pointers: {}, pinch: 0, mid: null
        };

        function resize() {
            var w = canvas.clientWidth, h = canvas.clientHeight;
            if (!w || !h) return;
            renderer.setSize(w, h, false);
            cam.aspect = w / h;
            cam.updateProjectionMatrix();
            S.need = true;
        }
        if (typeof ResizeObserver !== 'undefined') { S.observer = new ResizeObserver(resize); S.observer.observe(canvas); }
        resize();

        // comandi: un dito ruota, due dita avvicinano e spostano, rotella avvicina
        function pts() { return Object.keys(S.pointers).map(function (k) { return S.pointers[k]; }); }
        function gesture() {
            var p = pts();
            if (p.length < 2) { S.pinch = 0; S.mid = null; return; }
            S.pinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
            S.mid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
        }
        S.onDown = function (e) {
            S.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
            try { canvas.setPointerCapture(e.pointerId); } catch (x) { }
            gesture();
        };
        S.onMove = function (e) {
            var p = S.pointers[e.pointerId];
            if (!p) return;
            var dx = e.clientX - p.x, dy = e.clientY - p.y, o = S.orbit;
            p.x = e.clientX; p.y = e.clientY;
            var all = pts();
            if (all.length === 1) {
                o.theta += dx * 0.008;
                o.phi -= dy * 0.008;
            } else if (all.length >= 2 && S.pinch > 0) {
                var d = Math.hypot(all[0].x - all[1].x, all[0].y - all[1].y);
                var mid = { x: (all[0].x + all[1].x) / 2, y: (all[0].y + all[1].y) / 2 };
                if (d > 1) o.radius *= S.pinch / d;
                var k = o.radius * 0.0016, mx = mid.x - S.mid.x, my = mid.y - S.mid.y;
                // destra e avanti della camera, proiettati sul pavimento
                var rx = -Math.sin(o.theta), rz = Math.cos(o.theta), fx = -Math.cos(o.theta), fz = -Math.sin(o.theta);
                o.target.x += (-mx * rx + my * fx) * k;
                o.target.z += (-mx * rz + my * fz) * k;
                S.pinch = d; S.mid = mid;
            }
            placeCamera();
            e.preventDefault();
        };
        S.onUp = function (e) { delete S.pointers[e.pointerId]; gesture(); };
        S.onWheel = function (e) { S.orbit.radius *= Math.exp(e.deltaY * 0.0012); placeCamera(); e.preventDefault(); };
        canvas.addEventListener('pointerdown', S.onDown);
        canvas.addEventListener('pointermove', S.onMove);
        canvas.addEventListener('pointerup', S.onUp);
        canvas.addEventListener('pointercancel', S.onUp);
        canvas.addEventListener('wheel', S.onWheel, { passive: false });

        view('insieme');
        var me = S;
        (function loop() {
            if (!me.alive) return;
            if (me.need) { me.need = false; me.renderer.render(me.scene, me.cam); }
            requestAnimationFrame(loop);
        })();
        return true;
    }

    // F: speeds[] per via, strappers[] in lavoro, photocells[] occupate, stops[] alzati, packs[] (7 numeri per pacco), ids[]
    function frame(F) {
        if (!S) return;
        var c = S.col, L = S.layout, i;
        for (i = 0; i < S.bandMats.length; i++) {
            var v = Math.abs(F.speeds[i] || 0);
            S.bandMats[i].color.set(v > 0.45 ? c.marcia : v > 0.005 ? c.lenta : c.rulli);
        }
        for (i = 0; i < S.strapMats.length; i++) S.strapMats[i].color.set(F.strappers[i] ? c.lega : c.macchina);
        for (i = 0; i < S.fcMats.length; i++) S.fcMats[i].color.set(F.photocells[i] ? c.fcOn : c.fc);
        for (i = 0; i < S.stops.length; i++) S.stops[i].position.y = F.stops[i] ? ROLLER_TOP + 0.2 : ROLLER_TOP - 0.3;

        var n = F.ids.length, stateColors = [c.pacco, c.lega, c.intesta, c.attesa, c.trasf];
        while (S.packs.length < n) {
            var mesh = box(1, 1, 1, new THREE.MeshLambertMaterial({ color: c.pacco }));
            mesh.userData.id = '';
            S.scene.add(mesh);
            S.packs.push(mesh);
        }
        for (i = 0; i < S.packs.length; i++) {
            var m = S.packs[i];
            if (i >= n) { m.visible = false; if (m.userData.tag) m.userData.tag.visible = false; continue; }
            var k = i * 7, head = F.packs[k], len = F.packs[k + 1], lat = F.packs[k + 2], lift = F.packs[k + 3];
            var w = F.packs[k + 5] || 0.6, h = F.packs[k + 6] || 0.4;
            m.visible = true;
            m.scale.set(len, h, w);
            m.position.set(head - len / 2 - L.startM, ROLLER_TOP + lift + h / 2, lat);
            m.material.color.set(stateColors[F.packs[k + 4]] || c.pacco);
            if (m.userData.id !== F.ids[i]) {
                if (m.userData.tag) S.scene.remove(m.userData.tag);
                m.userData.id = F.ids[i];
                m.userData.tag = S.labels[F.ids[i]] || (S.labels[F.ids[i]] = label(F.ids[i]));
                S.scene.add(m.userData.tag);
            }
            m.userData.tag.visible = true;
            m.userData.tag.position.set(m.position.x, m.position.y + h / 2 + 0.55, lat);
        }
        S.need = true;
    }

    window.scena3d = { init: init, frame: frame, view: view, dispose: dispose };
})();
