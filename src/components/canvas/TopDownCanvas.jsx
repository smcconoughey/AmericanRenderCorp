import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Top-Down Canvas — ALL UNITS IN FEET
 * 
 * Components have x, y positions in feet, width/length in feet.
 * The canvas maps feet to screen pixels via the zoom factor (px/ft).
 * Rulers show feet. Dimensions show feet. Everything is feet.
 */

export default function TopDownCanvas({
    components, selected, onSelect, onMove, viewOffset, zoom, onPan, onZoom,
    showRuler, showDimensions, measureMode,
}) {
    const canvasRef = useRef(null);
    const dragRef = useRef(null);
    const panRef = useRef(null);
    const measureRef = useRef(null);
    const [measurePoints, setMeasurePoints] = useState(null);
    const [hovered, setHovered] = useState(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.width / dpr;
        const H = canvas.height / dpr;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = "#080814";
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.translate(viewOffset.x, viewOffset.y);
        ctx.scale(zoom, zoom); // zoom = pixels per foot

        // Grid — every 1ft (minor) and every 5ft (major) and 10ft (accent)
        const gridStartX = Math.floor(-viewOffset.x / zoom) - 2;
        const gridStartY = Math.floor(-viewOffset.y / zoom) - 2;
        const gridEndX = gridStartX + W / zoom + 4;
        const gridEndY = gridStartY + H / zoom + 4;

        // Minor grid (1ft)
        if (zoom > 3) {
            ctx.strokeStyle = "#0e0e22";
            ctx.lineWidth = 0.3 / zoom;
            for (let x = Math.floor(gridStartX); x <= gridEndX; x++) {
                ctx.beginPath(); ctx.moveTo(x, gridStartY); ctx.lineTo(x, gridEndY); ctx.stroke();
            }
            for (let y = Math.floor(gridStartY); y <= gridEndY; y++) {
                ctx.beginPath(); ctx.moveTo(gridStartX, y); ctx.lineTo(gridEndX, y); ctx.stroke();
            }
        }

        // 5ft grid
        ctx.strokeStyle = "#14142e";
        ctx.lineWidth = 0.5 / zoom;
        for (let x = Math.floor(gridStartX / 5) * 5; x <= gridEndX; x += 5) {
            ctx.beginPath(); ctx.moveTo(x, gridStartY); ctx.lineTo(x, gridEndY); ctx.stroke();
        }
        for (let y = Math.floor(gridStartY / 5) * 5; y <= gridEndY; y += 5) {
            ctx.beginPath(); ctx.moveTo(gridStartX, y); ctx.lineTo(gridEndX, y); ctx.stroke();
        }

        // 10ft grid
        ctx.strokeStyle = "#1e1e42";
        ctx.lineWidth = 0.8 / zoom;
        for (let x = Math.floor(gridStartX / 10) * 10; x <= gridEndX; x += 10) {
            ctx.beginPath(); ctx.moveTo(x, gridStartY); ctx.lineTo(x, gridEndY); ctx.stroke();
        }
        for (let y = Math.floor(gridStartY / 10) * 10; y <= gridEndY; y += 10) {
            ctx.beginPath(); ctx.moveTo(gridStartX, y); ctx.lineTo(gridEndX, y); ctx.stroke();
        }

        // Origin crosshair
        ctx.strokeStyle = "#2a2a5e";
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath(); ctx.moveTo(gridStartX, 0); ctx.lineTo(gridEndX, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, gridStartY); ctx.lineTo(0, gridEndY); ctx.stroke();

        // Draw components sorted by z
        const sorted = [...components].sort((a, b) => a.z - b.z);
        for (const comp of sorted) {
            if (comp.visible === false) continue;
            const isSelected = selected === comp.id;
            const isHovered = hovered === comp.id;

            // Shadow
            const shadowOff = 0.3;
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.fillRect(comp.x + shadowOff, comp.y + shadowOff, comp.width, comp.length);

            // Fill with height-based opacity (taller = more opaque)
            const heightAlpha = Math.min(0.8, 0.3 + (comp.height / 30) * 0.5);
            ctx.fillStyle = comp.color + Math.floor(heightAlpha * 255).toString(16).padStart(2, "0");
            ctx.fillRect(comp.x, comp.y, comp.width, comp.length);

            // Border
            ctx.strokeStyle = isSelected ? "#ff6b35" : isHovered ? "#ff6b3588" : comp.color;
            ctx.lineWidth = isSelected ? 2 / zoom : isHovered ? 1.5 / zoom : 0.8 / zoom;
            ctx.strokeRect(comp.x, comp.y, comp.width, comp.length);

            // Selection glow
            if (isSelected) {
                ctx.save();
                ctx.shadowColor = "#ff6b35";
                ctx.shadowBlur = 6 / zoom;
                ctx.strokeStyle = "#ff6b3566";
                ctx.lineWidth = 0.8 / zoom;
                ctx.setLineDash([0.5, 0.5]);
                ctx.strokeRect(comp.x - 0.3, comp.y - 0.3, comp.width + 0.6, comp.length + 0.6);
                ctx.setLineDash([]);
                ctx.restore();
            }

            // Label  
            const labelSize = Math.max(0.8, Math.min(1.5, comp.width / 10));
            ctx.font = `500 ${labelSize}px 'JetBrains Mono', monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const label = comp.name.length > 20 ? comp.name.slice(0, 18) + "…" : comp.name;
            // text shadow
            ctx.fillStyle = "#000000bb";
            ctx.fillText(label, comp.x + comp.width / 2 + 0.04, comp.y + comp.length / 2 + 0.04);
            ctx.fillStyle = "#e8e8f0";
            ctx.fillText(label, comp.x + comp.width / 2, comp.y + comp.length / 2);

            // Dimension labels for selected/hovered
            if ((isSelected || isHovered) && showDimensions) {
                const dimSize = Math.max(0.6, labelSize * 0.7);
                ctx.font = `400 ${dimSize}px 'JetBrains Mono', monospace`;
                ctx.fillStyle = "#ff6b35cc";

                // Width label (below)
                ctx.textAlign = "center";
                ctx.fillText(`${comp.width}ft`, comp.x + comp.width / 2, comp.y + comp.length + dimSize * 1.5);

                // Length label (right side, rotated)
                ctx.save();
                ctx.translate(comp.x + comp.width + dimSize * 1.5, comp.y + comp.length / 2);
                ctx.rotate(Math.PI / 2);
                ctx.fillText(`${comp.length}ft`, 0, 0);
                ctx.restore();

                // Height label (above)
                ctx.fillStyle = "#ff6b3588";
                ctx.fillText(`↕${comp.height}ft`, comp.x + comp.width / 2, comp.y - dimSize);
            }

            // Ref image indicator
            if (comp.refImages?.length) {
                const indicatorSize = Math.max(0.8, labelSize * 0.8);
                ctx.font = `${indicatorSize}px sans-serif`;
                ctx.textAlign = "right";
                ctx.fillStyle = "#ff6b35";
                ctx.fillText("📷", comp.x + comp.width - 0.2, comp.y + indicatorSize * 0.8);
            }
        }

        // Measurement line
        if (measurePoints) {
            const dx = measurePoints.x2 - measurePoints.x1;
            const dy = measurePoints.y2 - measurePoints.y1;
            const dist = Math.sqrt(dx * dx + dy * dy);

            ctx.beginPath();
            ctx.moveTo(measurePoints.x1, measurePoints.y1);
            ctx.lineTo(measurePoints.x2, measurePoints.y2);
            ctx.strokeStyle = "#34d399";
            ctx.lineWidth = 1.5 / zoom;
            ctx.setLineDash([0.5, 0.3]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Endpoints
            [measurePoints.x1, measurePoints.x2].forEach((px, i) => {
                const py = i === 0 ? measurePoints.y1 : measurePoints.y2;
                ctx.beginPath();
                ctx.arc(px, py, 0.3, 0, Math.PI * 2);
                ctx.fillStyle = "#34d399";
                ctx.fill();
            });

            // Distance label
            const midX = (measurePoints.x1 + measurePoints.x2) / 2;
            const midY = (measurePoints.y1 + measurePoints.y2) / 2;
            const labelS = 1.0;
            ctx.font = `600 ${labelS}px 'JetBrains Mono', monospace`;
            ctx.textAlign = "center";
            ctx.fillStyle = "#080814cc";
            const textW = dist.toFixed(1).length * labelS * 0.6 + 2;
            ctx.fillRect(midX - textW / 2, midY - labelS * 0.6, textW, labelS * 1.2);
            ctx.fillStyle = "#34d399";
            ctx.fillText(`${dist.toFixed(1)}ft`, midX, midY + labelS * 0.15);
        }

        ctx.restore();

        // Scale ruler in feet
        if (showRuler) {
            drawFeetRuler(ctx, W, H, viewOffset, zoom);
        }

        // Status bar
        ctx.fillStyle = "#06060fcc";
        ctx.fillRect(0, H - 22, W, 22);
        ctx.fillStyle = "#666";
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(
            `Zoom: ${zoom.toFixed(1)} px/ft  |  Grid: 1ft / 5ft / 10ft  |  ${measureMode ? "📏 MEASURE (click+drag)" : ""}`,
            8, H - 7
        );

        ctx.restore();
    }, [components, selected, hovered, viewOffset, zoom, showRuler, showDimensions, measurePoints, measureMode]);

    function drawFeetRuler(ctx, W, H, offset, zoom) {
        const rulerH = 22;
        const rulerW = 22;

        // Determine tick interval based on zoom
        let tickInterval = 1; // 1ft
        if (zoom < 2) tickInterval = 20;
        else if (zoom < 4) tickInterval = 10;
        else if (zoom < 8) tickInterval = 5;
        else if (zoom < 15) tickInterval = 2;
        let majorEvery = 5;
        if (tickInterval >= 5) majorEvery = 2;
        if (tickInterval >= 10) majorEvery = 5;

        // Horizontal ruler
        ctx.fillStyle = "#0a0a18ee";
        ctx.fillRect(rulerW, 0, W - rulerW, rulerH);
        ctx.strokeStyle = "#1a1a3e";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(rulerW, rulerH); ctx.lineTo(W, rulerH); ctx.stroke();

        const startFt = Math.floor((-offset.x) / zoom / tickInterval) * tickInterval;
        const endFt = Math.ceil((-offset.x + W) / zoom / tickInterval) * tickInterval;

        ctx.fillStyle = "#666";
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        for (let ft = startFt; ft <= endFt; ft += tickInterval) {
            const screenX = offset.x + ft * zoom;
            if (screenX < rulerW || screenX > W) continue;

            const isMajor = ft % (tickInterval * majorEvery) === 0;
            if (isMajor) {
                ctx.beginPath(); ctx.moveTo(screenX, 0); ctx.lineTo(screenX, rulerH); ctx.strokeStyle = "#2a2a5e"; ctx.stroke();
                ctx.fillText(`${ft}'`, screenX, 12);
            } else {
                ctx.beginPath(); ctx.moveTo(screenX, rulerH - 6); ctx.lineTo(screenX, rulerH); ctx.strokeStyle = "#1a1a3e"; ctx.stroke();
            }
        }

        // Vertical ruler
        ctx.fillStyle = "#0a0a18ee";
        ctx.fillRect(0, rulerH, rulerW, H - rulerH);
        ctx.strokeStyle = "#1a1a3e";
        ctx.beginPath(); ctx.moveTo(rulerW, rulerH); ctx.lineTo(rulerW, H); ctx.stroke();

        for (let ft = startFt; ft <= endFt; ft += tickInterval) {
            const screenY = offset.y + ft * zoom;
            if (screenY < rulerH || screenY > H) continue;

            const isMajor = ft % (tickInterval * majorEvery) === 0;
            if (isMajor) {
                ctx.beginPath(); ctx.moveTo(0, screenY); ctx.lineTo(rulerW, screenY); ctx.strokeStyle = "#2a2a5e"; ctx.stroke();
                ctx.save();
                ctx.translate(11, screenY);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(`${ft}'`, 0, 0);
                ctx.restore();
            } else {
                ctx.beginPath(); ctx.moveTo(rulerW - 6, screenY); ctx.lineTo(rulerW, screenY); ctx.strokeStyle = "#1a1a3e"; ctx.stroke();
            }
        }

        // Corner
        ctx.fillStyle = "#0a0a18";
        ctx.fillRect(0, 0, rulerW, rulerH);
        ctx.strokeStyle = "#1a1a3e";
        ctx.strokeRect(0, 0, rulerW, rulerH);
        ctx.fillStyle = "#444";
        ctx.font = "7px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("ft", rulerW / 2, rulerH / 2 + 3);
    }

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + "px";
        canvas.style.height = rect.height + "px";
        draw();
    }, []);

    useEffect(() => { draw(); }, [draw]);

    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + "px";
            canvas.style.height = rect.height + "px";
            draw();
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [draw]);

    // Convert screen pixels to feet
    const screenToFeet = (sx, sy) => ({
        x: (sx - viewOffset.x) / zoom,
        y: (sy - viewOffset.y) / zoom,
    });

    const hitTest = (fx, fy) => {
        for (let i = components.length - 1; i >= 0; i--) {
            const c = components[i];
            if (c.visible === false) continue;
            if (fx >= c.x && fx <= c.x + c.width && fy >= c.y && fy <= c.y + c.length) return c.id;
        }
        return null;
    };

    const onMouseDown = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const ft = screenToFeet(sx, sy);

        if (measureMode) {
            measureRef.current = { x1: ft.x, y1: ft.y };
            setMeasurePoints(null);
            return;
        }

        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            panRef.current = { startX: e.clientX, startY: e.clientY, ox: viewOffset.x, oy: viewOffset.y };
            return;
        }

        const hit = hitTest(ft.x, ft.y);
        if (hit) {
            onSelect(hit);
            const comp = components.find(c => c.id === hit);
            if (comp && !comp.locked) {
                dragRef.current = { id: hit, startFx: ft.x, startFy: ft.y, origX: comp.x, origY: comp.y };
            }
        } else {
            onSelect(null);
            panRef.current = { startX: e.clientX, startY: e.clientY, ox: viewOffset.x, oy: viewOffset.y };
        }
    };

    const onMouseMove = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const ft = screenToFeet(e.clientX - rect.left, e.clientY - rect.top);

        // Hover detection
        if (!dragRef.current && !panRef.current && !measureRef.current) {
            setHovered(hitTest(ft.x, ft.y));
        }

        if (measureMode && measureRef.current) {
            setMeasurePoints({ x1: measureRef.current.x1, y1: measureRef.current.y1, x2: ft.x, y2: ft.y });
            return;
        }

        if (panRef.current) {
            const dx = e.clientX - panRef.current.startX;
            const dy = e.clientY - panRef.current.startY;
            onPan({ x: panRef.current.ox + dx, y: panRef.current.oy + dy });
            return;
        }
        if (dragRef.current) {
            const dx = ft.x - dragRef.current.startFx;
            const dy = ft.y - dragRef.current.startFy;
            // Snap to 0.5ft
            const snap = (v) => Math.round(v * 2) / 2;
            onMove(dragRef.current.id, snap(dragRef.current.origX + dx), snap(dragRef.current.origY + dy));
        }
    };

    const onMouseUp = () => {
        if (measureMode && measureRef.current) { measureRef.current = null; return; }
        dragRef.current = null;
        panRef.current = null;
    };

    const onWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        onZoom(Math.max(0.5, Math.min(40, zoom * delta)));
    };

    return (
        <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", cursor: measureMode ? "crosshair" : "default", display: "block" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { onMouseUp(); setHovered(null); }}
            onWheel={onWheel}
        />
    );
}
