// Vista 2D della configurazione: i componenti si trascinano in orizzontale; al rilascio il nuovo valore va a .NET (MoveComponent).
(function () {
    var dotnet = null, drag = null;
    window.configvista = { init: function (ref) { dotnet = ref; } };
    document.addEventListener('pointerdown', function (e) {
        var g = e.target.closest && e.target.closest('.vista-config .trascina');
        if (!g || !dotnet) return;
        var svg = g.ownerSVGElement, r = svg.getBoundingClientRect();
        drag = { g: g, x0: e.clientX, k: parseFloat(svg.getAttribute('data-k')) || 1, upp: svg.viewBox.baseVal.width / r.width, dx: 0 };
        g.setPointerCapture(e.pointerId);
        g.classList.add('afferrato');
        e.preventDefault();
    });
    document.addEventListener('pointermove', function (e) {
        if (!drag) return;
        drag.dx = (e.clientX - drag.x0) * drag.upp;
        drag.g.setAttribute('transform', 'translate(' + drag.dx + ' 0)');
    });
    function fine() {
        if (!drag) return;
        var d = drag; drag = null;
        d.g.classList.remove('afferrato');
        var mm = d.dx / d.k;
        if (d.g.classList.contains('fisso')) { d.g.removeAttribute('transform'); dotnet.invokeMethodAsync('SelectComponent', d.g.getAttribute('data-k'), d.g.getAttribute('data-id')); return; }
        if (Math.abs(mm) < 5) { d.g.removeAttribute('transform'); dotnet.invokeMethodAsync('SelectComponent', d.g.getAttribute('data-k'), d.g.getAttribute('data-id')); return; }
        dotnet.invokeMethodAsync('MoveComponent', d.g.getAttribute('data-k'), d.g.getAttribute('data-id'), mm);
        // se il valore non cambia (limite raggiunto) il disegno non viene rifatto: si rimette a posto la figura
        setTimeout(function () { if (d.g.isConnected) d.g.removeAttribute('transform'); }, 400);
    }
    document.addEventListener('pointerup', fine);
    document.addEventListener('pointercancel', fine);
})();
