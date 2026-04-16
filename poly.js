const canvasP = document.getElementById('gridCanvasPoly');
const ctxP = canvasP.getContext('2d');
const stepDispP = document.getElementById('polyStepDisplay');

let pSteps = [];
let pCurrentStep = 0;

const Viewport = {
    scale: 1, offset: { x: 0, y: 0 }, padding: 40,
    calculateBounds(subject, clip) {
        const all = [...subject, ...clip];
        if (!all.length) return;
        const minX = Math.min(...all.map(p => p.x)), maxX = Math.max(...all.map(p => p.x));
        const minY = Math.min(...all.map(p => p.y)), maxY = Math.max(...all.map(p => p.y));
        const availW = canvasP.width - (this.padding * 2), availH = canvasP.height - (this.padding * 2);
        this.scale = Math.min(availW / (maxX - minX || 1), availH / (maxY - minY || 1));
        this.offset.x = (canvasP.width / 2) - ((minX + maxX) / 2) * this.scale;
        this.offset.y = (canvasP.height / 2) + ((minY + maxY) / 2) * this.scale;
    },
    toScreen(x, y) { return { x: this.offset.x + (x * this.scale), y: this.offset.y - (y * this.scale) }; }
};

const WA = {
    // Interseção de segmentos da janela com o polígono
    getIntersection(A, B, C, D) {
        const den = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);
        if (den === 0) return null;
        const t = ((D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x)) / den;
        const u = ((B.x - A.x) * (A.y - C.y) - (B.y - A.y) * (A.x - C.x)) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return { x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y), t: t };
        }
        return null;
    },

    // Verifica se um ponto está dentro do polígono de clipping
    isInside(p, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i].y > p.y) !== (polygon[j].y > p.y)) &&
                (p.x < (polygon[j].x - polygon[i].x) * (p.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
                inside = !inside;
            }
        }
        return inside;
    },

    run(subject, clip) {
        let steps = [];
        
        // Passo 1: Polígono e Janela
        steps.push({ msg: "1. Polígono (azul) e Janela de Clipping (verde) carregados.", draw: () => {
            PolyManager.drawShape(clip, "#2ecc71", false);
            PolyManager.drawShape(subject, "#3498db", false);
        }});

        // Passo 2: Interseções
        let sList = [];
        let intersections = [];
        for (let i = 0; i < subject.length; i++) {
            let p1 = subject[i], p2 = subject[(i + 1) % subject.length];
            sList.push({ ...p1, isIntersection: false });
            let segmentInters = [];
            for (let j = 0; j < clip.length; j++) {
                let c1 = clip[j], c2 = clip[(j + 1) % clip.length];
                let hit = this.getIntersection(p1, p2, c1, c2);
                if (hit) segmentInters.push({ ...hit, isIntersection: true });
            }
            segmentInters.sort((a, b) => a.t - b.t);
            sList.push(...segmentInters);
            intersections.push(...segmentInters);
        }

        steps.push({ msg: "2. Interseções calculadas (amarelo).", draw: () => {
            PolyManager.drawShape(clip, "#2ecc71", false);
            PolyManager.drawShape(subject, "#3498db", false);
            intersections.forEach(p => PolyManager.drawMarker(p, "#f1c40f"));
        }});

        // Passo 3: União de Pontos
        const allRelevantPoints = [
            ...sList.filter(p => p.isIntersection || this.isInside(p, clip)),
            ...clip.filter(cp => this.isInside(cp, subject))
        ];

        steps.push({ msg: "3. União (roxo): Vértices internos + Interseções.", draw: () => {
            PolyManager.drawShape(clip, "#2ecc7155", false);
            PolyManager.drawShape(subject, "#3498db55", false);
            allRelevantPoints.forEach(p => PolyManager.drawMarker(p, "#833fc2ff"));
        }});

        // Passo 4: Resultado Final
        const result = this.calculateClippedPolygon(sList, clip, subject);
        steps.push({ msg: "4. Resultado: Polígono resultante do clipping (rosa).", draw: () => {
            PolyManager.drawShape(clip, "#2ecc7155", false);
            PolyManager.drawShape(subject, "#3498db55", false);
            PolyManager.drawShape(result, "#eb579c", true);
        }});

        return steps;
    },

        calculateClippedPolygon(sList, clip, subject) {
        // Substituímos a ordenação por centroide pelo Algoritmo de Sutherland-Hodgman.
        // Ele "fatia" o polígono sujeito aresta por aresta do clip, preservando a ordem naturalmente.
        
        let outputList = subject;

        // 1. Determina a orientação geométrica da Janela de Clipping (Horário ou Anti-horário)
        // Isso é essencial porque as coordenadas do Canvas têm o eixo Y invertido.
        let clipArea = 0;
        for (let i = 0; i < clip.length; i++) {
            const j = (i + 1) % clip.length;
            clipArea += (clip[i].x * clip[j].y) - (clip[j].x * clip[i].y);
        }
        const isClockwise = clipArea > 0;

        // 2. Loop sobre cada aresta do polígono de Clipping
        for (let i = 0; i < clip.length; i++) {
            const c1 = clip[i];
            const c2 = clip[(i + 1) % clip.length];
            const inputList = outputList;
            outputList = [];

            if (inputList.length === 0) break; // Se o polígono sumiu, termina.

            // Helper para saber se um ponto está do lado "de dentro" da aresta do clip
            const isInsideEdge = (p) => {
                const cross = (c2.x - c1.x) * (p.y - c1.y) - (c2.y - c1.y) * (p.x - c1.x);
                return isClockwise ? cross >= 0 : cross <= 0;
            };

            // 3. Testa cada vértice do polígono Sujeito contra a aresta atual do Clip
            for (let j = 0; j < inputList.length; j++) {
                const s1 = inputList[(j - 1 + inputList.length) % inputList.length];
                const s2 = inputList[j];

                const s1Inside = isInsideEdge(s1);
                const s2Inside = isInsideEdge(s2);

                if (s2Inside) {
                    if (!s1Inside) {
                        // Entrou na área de clipping: calcula a interseção exata (Reta infinita vs Segmento)
                        const den = (c2.y - c1.y) * (s2.x - s1.x) - (c2.x - c1.x) * (s2.y - s1.y);
                        if (den !== 0) {
                            const t = ((c2.x - c1.x) * (s1.y - c1.y) - (c2.y - c1.y) * (s1.x - c1.x)) / den;
                            outputList.push({ x: s1.x + t * (s2.x - s1.x), y: s1.y + t * (s2.y - s1.y) });
                        }
                    }
                    outputList.push(s2); // Adiciona o ponto que está dentro
                } else if (s1Inside) {
                    // Saiu da área de clipping: calcula a interseção da saída
                    const den = (c2.y - c1.y) * (s2.x - s1.x) - (c2.x - c1.x) * (s2.y - s1.y);
                    if (den !== 0) {
                        const t = ((c2.x - c1.x) * (s1.y - c1.y) - (c2.y - c1.y) * (s1.x - c1.x)) / den;
                        outputList.push({ x: s1.x + t * (s2.x - s1.x), y: s1.y + t * (s2.y - s1.y) });
                    }
                }
            }
        }

        return outputList;
    }
};

const PolyManager = {
    parsePath(path) {
        const matches = path.match(/([-+]?\d*\.?\d+)/g);
        if (!matches) return [];
        const pts = [];
        for (let i = 0; i < matches.length; i += 2) pts.push({ x: parseFloat(matches[i]), y: parseFloat(matches[i+1]) });
        return pts;
    },

    drawShape(points, color, fill) {
        if (!points || points.length < 2) return;
        ctxP.beginPath(); ctxP.lineWidth = 3; ctxP.strokeStyle = color;
        const start = Viewport.toScreen(points[0].x, points[0].y);
        ctxP.moveTo(start.x, start.y);
        points.forEach(p => { const pos = Viewport.toScreen(p.x, p.y); ctxP.lineTo(pos.x, pos.y); });
        ctxP.closePath(); ctxP.stroke();
        if (fill) { ctxP.fillStyle = color + "44"; ctxP.fill(); }
    },

    drawMarker(p, color) {
        const pos = Viewport.toScreen(p.x, p.y);
        ctxP.fillStyle = color; ctxP.beginPath(); ctxP.arc(pos.x, pos.y, 5, 0, Math.PI * 2); ctxP.fill();
    },

    render() {
        ctxP.clearRect(0, 0, canvasP.width, canvasP.height);
        const origin = Viewport.toScreen(0, 0);
        ctxP.strokeStyle = "#ddd"; ctxP.setLineDash([5, 5]);
        ctxP.beginPath(); ctxP.moveTo(0, origin.y); ctxP.lineTo(canvasP.width, origin.y);
        ctxP.moveTo(origin.x, 0); ctxP.lineTo(origin.x, canvasP.height); ctxP.stroke();
        ctxP.setLineDash([]);
        if (pSteps[pCurrentStep]) {
            pSteps[pCurrentStep].draw();
            stepDispP.innerText = pSteps[pCurrentStep].msg;
        }
    }
};

// Eventos
document.getElementById('btnRenderPoly').onclick = () => {
    canvasP.width = 600; canvasP.height = 400;
    const s = PolyManager.parsePath(document.getElementById('polyPath').value);
    const c = PolyManager.parsePath(document.getElementById('clipPath').value);
    Viewport.calculateBounds(s, c);
    pSteps = [{ msg: "Polígonos prontos para clipping.", draw: () => {
        PolyManager.drawShape(c, "#2ecc71", false);
        PolyManager.drawShape(s, "#3498db", false);
    }}];
    pCurrentStep = 0; PolyManager.render();
};

document.getElementById('btnClip').onclick = () => {
    const s = PolyManager.parsePath(document.getElementById('polyPath').value);
    const c = PolyManager.parsePath(document.getElementById('clipPath').value);
    Viewport.calculateBounds(s, c);
    pSteps = WA.run(s, c);
    pCurrentStep = 0; PolyManager.render();
};

document.getElementById('btnNextPoly').onclick = () => { if (pCurrentStep < pSteps.length - 1) { pCurrentStep++; PolyManager.render(); } };
document.getElementById('btnPrevPoly').onclick = () => { if (pCurrentStep > 0) { pCurrentStep--; PolyManager.render(); } };