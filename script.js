// UI Elements
const vdsSlider = document.getElementById('vds-slider');
const vgsSlider = document.getElementById('vgs-slider');
const vdsVal = document.getElementById('vds-val');
const vgsVal = document.getElementById('vgs-val');
const efVal = document.getElementById('electric-field');
const tpVal = document.getElementById('tunneling-prob');
// Canvases
const simCanvas = document.getElementById('simCanvas');
const simCtx = simCanvas.getContext('2d');
const bandCanvas = document.getElementById('bandGraph');
const bandCtx = bandCanvas.getContext('2d');
// State
let V_DS = 0;
let V_GS = 0;
let electricField = 0;
let tunnelingProb = 0;
// Device Geometry (Sim Canvas)
const d = {
    w: 800, h: 600,
    s_x: 100, s_y: 200, s_w: 50, s_h: 200, // Source (Left)
    d_x: 650, d_y: 200, d_w: 50, d_h: 200, // Drain (Right)
    g_x: 150, g_y: 450, g_w: 500, g_h: 30, // Gate (Bottom)
    a_x: 150, a_y: 200, a_w: 500, a_h: 200, // Active Layer
    dielec_x: 150, dielec_y: 400, dielec_w: 500, dielec_h: 50 // Dielectric
};
// Particles
const ions = [];
const carriers = [];
const photons = [];
// Initialize Ions (Randomly distributed in active layer)
const numIons = 200;
for (let i = 0; i < numIons; i++) {
    ions.push({
        x: d.a_x + Math.random() * d.a_w,
        y: d.a_y + Math.random() * d.a_h,
        charge: Math.random() > 0.5 ? 1 : -1, // +1 Cation, -1 Anion
        vx: 0,
        vy: 0
    });
}
// Update State from Sliders
function updateState() {
    V_DS = parseFloat(vdsSlider.value);
    V_GS = parseFloat(vgsSlider.value);
    
    vdsVal.textContent = V_DS.toFixed(1);
    vgsVal.textContent = V_GS.toFixed(1);
    
    // Calculate simple Electric Field (approximate)
    // E = V / distance. In nm, d ~ 2nm for EDL.
    // Display value: E = (|V_DS| / 2) * 10^9 V/m
    const e_val = (Math.abs(V_DS) / 2);
    efVal.innerHTML = `${e_val.toFixed(2)} x 10<sup>9</sup> V/m`;
    
    // Tunneling prob increases exponentially with V_DS due to band bending
    // P = exp(-a / V) approx.
    if (Math.abs(V_DS) > 0.5) {
        tunnelingProb = Math.min(100, Math.exp(Math.abs(V_DS) - 3) * 100);
    } else {
        tunnelingProb = 0;
    }
    tpVal.textContent = `${tunnelingProb.toFixed(2)} %`;
}
vdsSlider.addEventListener('input', updateState);
vgsSlider.addEventListener('input', updateState);
updateState();
// Helper to draw rounded rects
function fillRoundRect(ctx, x, y, w, h, r, fillStyle) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.fillStyle = fillStyle;
    ctx.fill();
}
function drawDevice() {
    simCtx.clearRect(0, 0, d.w, d.h);
    
    // Draw Gate
    let gateColor = '#475569';
    if (V_GS > 0) gateColor = '#ef4444'; // Positive Gate
    if (V_GS < 0) gateColor = '#3b82f6'; // Negative Gate
    fillRoundRect(simCtx, d.g_x, d.g_y, d.g_w, d.g_h, 5, gateColor);
    
    // Draw Dielectric
    fillRoundRect(simCtx, d.dielec_x, d.dielec_y, d.dielec_w, d.dielec_h, 0, 'rgba(255,255,255,0.05)');
    
    // Draw Active Layer Background
    fillRoundRect(simCtx, d.a_x, d.a_y, d.a_w, d.a_h, 0, 'rgba(15, 23, 42, 0.8)');
    
    // Draw Source (Left)
    let sColor = '#94a3b8';
    if (V_DS < 0) sColor = '#ef4444'; // positive relative to drain
    else if (V_DS > 0) sColor = '#3b82f6';
    fillRoundRect(simCtx, d.s_x, d.s_y, d.s_w, d.s_h, 5, sColor);
    
    // Draw Drain (Right)
    let drColor = '#94a3b8';
    if (V_DS > 0) drColor = '#ef4444'; // positive relative to source
    else if (V_DS < 0) drColor = '#3b82f6';
    fillRoundRect(simCtx, d.d_x, d.d_y, d.d_w, d.d_h, 5, drColor);
}
function updateAndDrawParticles() {
    // Ions
    const targetEDL_S = d.a_x + 10;
    const targetEDL_D = d.a_x + d.a_w - 10;
    const targetAcc = d.a_y + d.a_h - 10; // Bottom accumulation
    
    ions.forEach(ion => {
        // Drift forces
        let fx = 0, fy = 0;
        
        // Horizontal Field (V_DS)
        if (V_DS > 0) {
            // Drain is (+), Source is (-). 
            // Cations (+) move to Source (-), Anions (-) move to Drain (+)
            if (ion.charge > 0) fx = -V_DS * 0.5;
            else fx = V_DS * 0.5;
        } else if (V_DS < 0) {
            if (ion.charge > 0) fx = -V_DS * 0.5;
            else fx = V_DS * 0.5;
        }
        
        // Vertical Field (V_GS)
        if (V_GS > 0) {
            // Gate is (+). Cations (-) move to Gate. Wait, Cations are +, Anions are -
            // Gate is (+). Anions (-) move to Gate. Cations (+) move away.
            if (ion.charge < 0) fy = V_GS * 0.5;
            else fy = -V_GS * 0.5;
        } else if (V_GS < 0) {
            if (ion.charge > 0) fy = -V_GS * 0.5;
            else fy = V_GS * 0.5;
        }
        
        // Add random thermal motion
        fx += (Math.random() - 0.5) * 2;
        fy += (Math.random() - 0.5) * 2;
        
        // Restore force to center if no field
        if (V_DS === 0) fx += (d.a_x + d.a_w/2 - ion.x) * 0.001;
        if (V_GS === 0) fy += (d.a_y + d.a_h/2 - ion.y) * 0.001;
        
        ion.vx = ion.vx * 0.9 + fx * 0.1;
        ion.vy = ion.vy * 0.9 + fy * 0.1;
        
        ion.x += ion.vx;
        ion.y += ion.vy;
        
        // Constrain to active layer
        ion.x = Math.max(d.a_x + 5, Math.min(d.a_x + d.a_w - 5, ion.x));
        ion.y = Math.max(d.a_y + 5, Math.min(d.a_y + d.a_h - 5, ion.y));
        
        // Draw Ion
        simCtx.beginPath();
        simCtx.arc(ion.x, ion.y, 3, 0, Math.PI * 2);
        if (ion.charge > 0) {
            simCtx.fillStyle = '#3b82f6'; // Cation +
            simCtx.shadowColor = '#3b82f6';
        } else {
            simCtx.fillStyle = '#ef4444'; // Anion -
            simCtx.shadowColor = '#ef4444';
        }
        simCtx.shadowBlur = 5;
        simCtx.fill();
        simCtx.shadowBlur = 0;
    });
    
    // Inject Carriers based on Tunneling Probability
    if (tunnelingProb > 1 && Math.random() < tunnelingProb / 100) {
        // Source injects one type, Drain injects the other based on V_DS polarity
        let electronStartX = V_DS > 0 ? d.s_x + d.s_w : d.d_x;
        let holeStartX = V_DS > 0 ? d.d_x : d.s_x + d.s_w;
        
        let startY = d.a_y + Math.random() * d.a_h;
        // If V_GS is strong, carriers accumulate near gate
        if (Math.abs(V_GS) > 1) {
            startY = d.a_y + d.a_h - 10 - Math.random() * 30;
        }
        
        // Inject Electron
        carriers.push({
            x: electronStartX, y: startY, type: -1, 
            vx: V_DS > 0 ? 5 : -5, vy: 0, life: 1
        });
        
        // Inject Hole
        carriers.push({
            x: holeStartX, y: startY, type: 1, 
            vx: V_DS > 0 ? -5 : 5, vy: 0, life: 1
        });
    }
    
    // Update Carriers
    for (let i = carriers.length - 1; i >= 0; i--) {
        let c = carriers[i];
        
        // Move
        c.x += c.vx;
        
        // Recombination (simple collision detection near center shifted by V_GS)
        let centerShift = V_GS * 50; 
        let targetRecombX = d.a_x + d.a_w/2 + centerShift;
        
        // If they pass the recombination zone, they recombine
        let distToRecomb = Math.abs(c.x - targetRecombX);
        if (distToRecomb < 10 && Math.random() < 0.2) {
            // Emits photon
            photons.push({
                x: c.x, y: c.y, radius: 1, alpha: 1
            });
            carriers.splice(i, 1);
            continue;
        }
        
        // Remove if out of bounds
        if (c.x < d.a_x || c.x > d.a_x + d.a_w) {
            carriers.splice(i, 1);
            continue;
        }
        
        // Draw Carrier
        simCtx.beginPath();
        simCtx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        if (c.type < 0) {
            simCtx.fillStyle = '#fbbf24'; // Electron
            simCtx.shadowColor = '#fbbf24';
        } else {
            simCtx.fillStyle = '#a855f7'; // Hole
            simCtx.shadowColor = '#a855f7';
        }
        simCtx.shadowBlur = 8;
        simCtx.fill();
        simCtx.shadowBlur = 0;
    }
    
    // Update Photons
    for (let i = photons.length - 1; i >= 0; i--) {
        let p = photons[i];
        p.radius += 2;
        p.alpha -= 0.05;
        
        if (p.alpha <= 0) {
            photons.splice(i, 1);
            continue;
        }
        
        simCtx.beginPath();
        simCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        simCtx.fillStyle = `rgba(16, 185, 129, ${p.alpha})`; // Glowing Green
        simCtx.shadowColor = '#10b981';
        simCtx.shadowBlur = 15;
        simCtx.fill();
        simCtx.shadowBlur = 0;
    }
}
function drawBandGraph() {
    bandCtx.clearRect(0, 0, bandCanvas.width, bandCanvas.height);
    
    const w = bandCanvas.width;
    const h = bandCanvas.height;
    
    const gap = 60;
    const lumoBaseY = 50;
    const homoBaseY = lumoBaseY + gap;
    
    // V_DS bends the bands. 
    // Left side (Source) is fixed reference if V_DS > 0.
    let leftBend = 0;
    let rightBend = V_DS * -20; 
    
    // Draw LUMO
    bandCtx.beginPath();
    bandCtx.moveTo(20, lumoBaseY - leftBend);
    
    // Schottky barrier thinning effect due to EDL
    // Strong bending right at the interfaces
    let edlWidth = 30; // visual representation of EDL width
    if (V_DS !== 0) edlWidth = Math.max(5, 30 - Math.abs(V_DS) * 8); // Thins as V_DS increases
    
    // Smooth curve
    bandCtx.bezierCurveTo(
        20 + edlWidth, lumoBaseY - leftBend, 
        w - 20 - edlWidth, lumoBaseY - rightBend, 
        w - 20, lumoBaseY - rightBend
    );
    
    bandCtx.strokeStyle = '#fbbf24'; // LUMO color
    bandCtx.lineWidth = 3;
    bandCtx.stroke();
    
    // Fill under LUMO to show electrons
    bandCtx.lineTo(w-20, 0);
    bandCtx.lineTo(20, 0);
    bandCtx.fillStyle = 'rgba(251, 191, 36, 0.1)';
    bandCtx.fill();
    
    // Draw HOMO
    bandCtx.beginPath();
    bandCtx.moveTo(20, homoBaseY - leftBend);
    bandCtx.bezierCurveTo(
        20 + edlWidth, homoBaseY - leftBend, 
        w - 20 - edlWidth, homoBaseY - rightBend, 
        w - 20, homoBaseY - rightBend
    );
    
    bandCtx.strokeStyle = '#a855f7'; // HOMO color
    bandCtx.lineWidth = 3;
    bandCtx.stroke();
    
    // Fill above HOMO to show holes
    bandCtx.lineTo(w-20, h);
    bandCtx.lineTo(20, h);
    bandCtx.fillStyle = 'rgba(168, 85, 247, 0.1)';
    bandCtx.fill();
    
    // Draw Electrodes (Fermi Levels)
    // Source Fermi
    bandCtx.beginPath();
    bandCtx.moveTo(0, (lumoBaseY + homoBaseY)/2 - leftBend);
    bandCtx.lineTo(20, (lumoBaseY + homoBaseY)/2 - leftBend);
    bandCtx.strokeStyle = '#94a3b8';
    bandCtx.lineWidth = 2;
    bandCtx.setLineDash([2, 2]);
    bandCtx.stroke();
    
    // Drain Fermi
    bandCtx.beginPath();
    bandCtx.moveTo(w-20, (lumoBaseY + homoBaseY)/2 - rightBend);
    bandCtx.lineTo(w, (lumoBaseY + homoBaseY)/2 - rightBend);
    bandCtx.stroke();
    bandCtx.setLineDash([]);
}
function animate() {
    drawDevice();
    updateAndDrawParticles();
    drawBandGraph();
    requestAnimationFrame(animate);
}
// Start
animate();
