const canvas = document.getElementById('gridCanvas');
const ctx = canvas.getContext('2d');
const stepDisplay = document.getElementById('stepDisplay');
const gridSizeInput = document.getElementById('gridSize');
const gridSizeVal = document.getElementById('gridSizeVal');

let steps = []; 
let currentStep = 0;
let cellSize = 20;

function init() {
    setupCanvas();
    processPath();
}

function setupCanvas() {
    cellSize = parseInt(gridSizeInput.value);
    gridSizeVal.innerText = cellSize;
    canvas.width = 600;
    canvas.height = 600;
}

// Seu Algoritmo de Midpoint ver. Inteira
function rasterArcSteps(xo, yo, r) {
    steps = [];

    let x = 0;
    let y = -r;
    let h = 1 - r;

    // Função auxiliar para popular o array de steps
    const recordStep = (xc, yc, hc, points) => {
        steps.push({
            x: xc,
            y: yc,
            h: hc,
            points: points.map(p => ({ x: p.x, y: p.y }))
        });
    };

    // Pontos iniciais
    const initPoints = [
        { x: xo, y: yo + r },
        { x: xo, y: yo - r },
        { x: xo + r, y: yo },
        { x: xo - r, y: yo },
    ];
    recordStep(x, y, h, initPoints);

    while (x < -(y + 1)) {
        if (h < 0) {
            h = h + 2 * x + 3;
        } else {
            h = h + 2 * x + 2 * y + 5;
            y++;
        }
        x++;

        const iterPoints = [
            { x: xo + x, y: yo + y },
            { x: xo + x, y: yo - y },
            { x: xo - x, y: yo + y },
            { x: xo - x, y: yo - y },
            { x: xo + y, y: yo + x },
            { x: xo + y, y: yo - x },
            { x: xo - y, y: yo + x },
            { x: xo - y, y: yo - x },
        ];
        recordStep(x, y, h, iterPoints);
    }
}

function processPath() {
    const pathInput = document.getElementById('svgPath');
    if (!pathInput) return;
    
    const pathStr = pathInput.value;
    const tokens = pathStr.split(/\s+/);
    steps = [];
    
    let xc = 0, yc = 0;

    for (let i = 0; i < tokens.length; i++) {
        const cmd = tokens[i].toUpperCase();
        if (cmd === 'M') {
            xc = parseInt(tokens[++i]);
            yc = parseInt(tokens[++i]);
        } else if (cmd === 'R') {
            const r = parseInt(tokens[++i]);
            rasterArcSteps(xc, yc, r);
        }
    }

    currentStep = 0;
    updateUI();
    render();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    if (steps.length === 0) return;

    // Desenha passos anteriores
    for (let i = 0; i < currentStep; i++) {
        drawPoints(steps[i].points, "#bdc3c7");
    }

    // Desenha o passo atual
    drawPoints(steps[currentStep].points, "#e74c3c");
}

function drawPoints(points, color) {
    ctx.fillStyle = color;
    points.forEach(p => {
        // Centraliza o desenho no meio do canvas
        const screenX = (canvas.width / 2) + (p.x * cellSize);
        const screenY = (canvas.height / 2) - (p.y * cellSize);
        // Ajuste para preencher o quadrado do grid corretamente
        ctx.fillRect(screenX, screenY, cellSize, cellSize);
    });
}

function drawGrid() {
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 1;
    for (let i = 0; i <= canvas.width; i += cellSize) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }
    // Eixos Centrais (Plano Cartesiano)
    ctx.strokeStyle = "#ff000044";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(canvas.width/2, 0); ctx.lineTo(canvas.width/2, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height/2); ctx.stroke();
}

function updateUI() {
    if (steps.length === 0) {
        stepDisplay.innerText = "0 / 0";
        return;
    }

    const state = steps[currentStep];
    stepDisplay.innerText = `${currentStep + 1} / ${steps.length}`;

    const debugD = document.getElementById('valD');
    const debugXY = document.getElementById('valXY');
    
    if (debugD) debugD.innerText = state.h;
    if (debugXY) debugXY.innerText = `${state.x}, ${state.y}`;
}

// Event Listeners
document.getElementById('btnRun').onclick = processPath;

document.getElementById('btnNext').onclick = () => {
    if (currentStep < steps.length - 1) { 
        currentStep++;
        updateUI(); 
        render(); 
    }
};

document.getElementById('btnPrev').onclick = () => {
    if (currentStep > 0) { 
        currentStep--; 
        updateUI(); 
        render(); 
    }
};

gridSizeInput.oninput = () => {
    setupCanvas();
    render();
};

init();