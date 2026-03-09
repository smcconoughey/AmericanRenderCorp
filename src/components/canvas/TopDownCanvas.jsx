import { useState, useRef, useCallback, useEffect } from "react";

const GRID_SIZE = 40;

export default function TopDownCanvas({
    components, selected, onSelect, onMove, viewOffset, zoom, onPan, onZoom,
    scaleSetting, showRuler, showDimensions, measureMode, onMeasure
}) {
    const canvasRef = useRef(null);
    const dragRef = useRef(null);
    const panRef = useRef(null);
    const measureRef = useRef(null);
    const [measurePoints, setMeasurePoints] = useState(null);

    const parseScale = () => {
        const match = scaleSetting?.match(/1(ft|m)\s*=\s*(\d+)px/);
        if (!match) return { unit: "ft", pxPerUnit: 20 };
        return { unit: match[1], pxPerUnit: parseInt(match[2]) };
    };

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const W = canvas.width;
        const H = canvas.height;
        const { unit, pxPerUnit } = parseScale();
        ctx.clearRect(0, 0, W, H);

        // Fill background
        ctx.fillStyle = "#080814";
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.translate(viewOffset.x, viewOffset.y);
        ctx.scale(zoom, zoom);

        // Minor grid
        const gridStep = GRID_SIZE;
        const startX = Math.floor(-viewOffset.x / zoom / gridStep) * gridStep - gridStep;
        const startY = Math.floor(-viewOffset.y / zoom / gridStep) * gridStep - gridStep;
        const endX = startX + W / zoom + gridStep * 2;
        const endY = startY + H / zoom + gridStep * 2;

        ctx.strokeStyle = "#12122a";
        ctx.lineWidth = 0.5 / zoom;
        for (let x = startX; x < endX; x += gridStep) {
            ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
        }
        for (let y = startY; y < endY; y += gridStep) {
            ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
        }

        // Major grid
        ctx.strokeStyle = "#1e1e40";
        ctx.lineWidth = 1 / zoom;
        for (let x = startX; x < endX; x += gridStep * 5) {
            ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
        }
        for (let y = startY; y < endY; y += gridStep * 5) {
            ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
        }

        // Draw components sorted by z
        const sorted = [...components].sort((a, b) => a.z - b.z);
        for (const comp of sorted) {
            if (comp.visible === false) continue;
            const isSelected = selected === comp.id;

            // Shadow
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.fillRect(comp.x + 3 / zoom, comp.y + 3 / zoom, comp.w, comp.h);

            // Fill
            ctx.fillStyle = comp.color + "66";
            ctx.fillRect(comp.x, comp.y, comp.w, comp.h);

            // Border
            ctx.strokeStyle = isSelected ? "#ff6b35" : comp.color;
            ctx.lineWidth = isSelected ? 2.5 / zoom : 1.2 / zoom;
            ctx.strokeRect(comp.x, comp.y, comp.w, comp.h);

            // Selection glow
            if (isSelected) {
                ctx.save();
                ctx.shadowColor = "#ff6b35";
                ctx.shadowBlur = 8 / zoom;
                ctx.strokeStyle = "#ff6b3588";
                ctx.lineWidth = 1 / zoom;
                ctx.setLineDash([4 / zoom, 4 / zoom]);
                ctx.strokeRect(comp.x - 3 / zoom, comp.y - 3 / zoom, comp.w + 6 / zoom, comp.h + 6 / zoom);
                ctx.setLineDash([]);
                ctx.restore();
            }

            // Label
            ctx.fillStyle = "#e0e0e0";
            const fontSize = Math.max(8, Math.min(12, comp.w / 8));
            ctx.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const label = comp.name.length > 18 ? comp.name.slice(0, 16) + "…" : comp.name;

            // Text shadow
            ctx.fillStyle = "#000000aa";
            ctx.fillText(label, comp.x + comp.w / 2 + 0.5, comp.y + comp.h / 2 + 0.5);
            ctx.fillStyle = "#e8e8f0";
            ctx.fillText(label, comp.x + comp.w / 2, comp.y + comp.h / 2);

            // Dimension labels on hover/select
            if (isSelected && showDimensions) {
                const realW = (comp.w / pxPerUnit).toFixed(1);
                const realH = (comp.h / pxPerUnit).toFixed(1);
                const dimLabel = `${realW}×${realH}${unit}`;
                ctx.font = `400 ${Math.max(8, fontSize - 2)}px 'JetBrains Mono', monospace`;
                ctx.fillStyle = "#ff6b35cc";
                ctx.fillText(dimLabel, comp.x + comp.w / 2, comp.y + comp.h + 12 / zoom);

                // Height label
                const hLabel = `h: ${comp.depth}${unit}`;
                ctx.fillText(hLabel, comp.x + comp.w / 2, comp.y - 8 / zoom);
            }

            // Ref image indicator
            if (comp.refImages?.length) {
                ctx.fillStyle = "#ff6b35";
                ctx.font = `${10 / zoom > 14 ? 14 : Math.max(8, 10)}px sans-serif`;
                ctx.textAlign = "right";
                ctx.fillText("📷", comp.x + comp.w - 3 / zoom, comp.y + 12 / zoom);
            }
        }

        // Measurement line
        if (measurePoints) {
            ctx.beginPath();
            ctx.moveTo(measurePoints.x1, measurePoints.y1);
            ctx.lineTo(measurePoints.x2, measurePoints.y2);
            ctx.strokeStyle = "#34d399";
            ctx.lineWidth = 2 / zoom;
            ctx.setLineDash([6 / zoom, 3 / zoom]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Measurement dots
            [{ x: measurePoints.x1, y: measurePoints.y1 }, { x: measurePoints.x2, y: measurePoints.y2 }].forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4 / zoom, 0, Math.PI * 2);
                ctx.fillStyle = "#34d399";
                ctx.fill();
            });

            // Distance label
            const dx = measurePoints.x2 - measurePoints.x1;
            const dy = measurePoints.y2 - measurePoints.y1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const realDist = (dist / pxPerUnit).toFixed(1);
            const midX = (measurePoints.x1 + measurePoints.x2) / 2;
            const midY = (measurePoints.y1 + measurePoints.y2) / 2;
            ctx.font = `600 ${12}px 'JetBrains Mono', monospace`;
            ctx.textAlign = "center";
            ctx.fillStyle = "#0d0d1acc";
            ctx.fillRect(midX - 30 / zoom, midY - 10 / zoom, 60 / zoom, 16 / zoom);
            ctx.fillStyle = "#34d399";
            ctx.fillText(`${realDist}${unit}`, midX, midY + 2 / zoom);
        }

        ctx.restore();

        // Scale ruler overlay
        if (showRuler) {
            drawRuler(ctx, W, H, viewOffset, zoom, pxPerUnit, unit);
        }

        // Status bar
        ctx.fillStyle = "#44446688";
        ctx.fillRect(0, H - 24, W, 24);
        ctx.fillStyle = "#888";
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(
            `Zoom: ${(zoom * 100).toFixed(0)}%  |  Scale: 1${unit} = ${pxPerUnit}px  |  Grid: ${GRID_SIZE}px  |  ${measureMode ? "📏 MEASURE MODE" : ""}`,
            8, H - 7
        );
    }, [components, selected, viewOffset, zoom, scaleSetting, showRuler, showDimensions, measurePoints, measureMode]);

    function drawRuler(ctx, W, H, offset, zoom, pxPerUnit, unit) {
        const rulerH = 20;
        const rulerW = 20;

        // Horizontal ruler
        ctx.fillStyle = "#0a0a18ee";
        ctx.fillRect(rulerW, 0, W - rulerW, rulerH);
        ctx.strokeStyle = "#2a2a4e";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rulerW, rulerH);
        ctx.lineTo(W, rulerH);
        ctx.stroke();

        const step = pxPerUnit * zoom;
        const startUnit = Math.floor((-offset.x - rulerW) / step);
        const endUnit = Math.ceil((-offset.x + W) / step);

        ctx.fillStyle = "#666";
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        for (let u = startUnit; u <= endUnit; u++) {
            const x = offset.x + u * step + rulerW;
            if (x < rulerW || x > W) continue;

            // Major tick
            if (u % 5 === 0) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, rulerH);
                ctx.strokeStyle = "#3a3a5e";
                ctx.stroke();
                ctx.fillText(`${u}${unit}`, x, 12);
            } else {
                ctx.beginPath();
                ctx.moveTo(x, rulerH - 6);
                ctx.lineTo(x, rulerH);
                ctx.strokeStyle = "#2a2a4e";
                ctx.stroke();
            }
        }

        // Vertical ruler
        ctx.fillStyle = "#0a0a18ee";
        ctx.fillRect(0, rulerH, rulerW, H - rulerH);
        ctx.strokeStyle = "#2a2a4e";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rulerW, rulerH);
        ctx.lineTo(rulerW, H);
        ctx.stroke();

        const startUnitY = Math.floor((-offset.y - rulerH) / step);
        const endUnitY = Math.ceil((-offset.y + H) / step);

        ctx.textAlign = "right";
        for (let u = startUnitY; u <= endUnitY; u++) {
            const y = offset.y + u * step + rulerH;
            if (y < rulerH || y > H) continue;

            if (u % 5 === 0) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(rulerW, y);
                ctx.strokeStyle = "#3a3a5e";
                ctx.stroke();

                ctx.save();
                ctx.translate(12, y);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(`${u}${unit}`, 0, 0);
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.moveTo(rulerW - 6, y);
                ctx.lineTo(rulerW, y);
                ctx.strokeStyle = "#2a2a4e";
                ctx.stroke();
            }
        }

        // Corner box
        ctx.fillStyle = "#0a0a18";
        ctx.fillRect(0, 0, rulerW, rulerH);
        ctx.strokeStyle = "#2a2a4e";
        ctx.strokeRect(0, 0, rulerW, rulerH);
    }

    useEffect(() => {
        const canvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + "px";
        canvas.style.height = rect.height + "px";
        canvas.getContext("2d").scale(dpr, dpr);
        // We need to reset the scale each redraw since we save/restore
        draw();
    }, []);

    useEffect(() => {
        draw();
    }, [draw]);

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
            canvas.getContext("2d").scale(dpr, dpr);
            draw();
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [draw]);

    const screenToWorld = (sx, sy) => ({
        x: (sx - viewOffset.x) / zoom,
        y: (sy - viewOffset.y) / zoom,
    });

    const hitTest = (wx, wy) => {
        for (let i = components.length - 1; i >= 0; i--) {
            const c = components[i];
            if (c.visible === false) continue;
            if (wx >= c.x && wx <= c.x + c.w && wy >= c.y && wy <= c.y + c.h) return c.id;
        }
        return null;
    };

    const onMouseDown = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = screenToWorld(sx, sy);

        if (measureMode) {
            measureRef.current = { x1: world.x, y1: world.y };
            setMeasurePoints(null);
            return;
        }

        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            panRef.current = { startX: e.clientX, startY: e.clientY, ox: viewOffset.x, oy: viewOffset.y };
            return;
        }

        const hit = hitTest(world.x, world.y);
        if (hit) {
            onSelect(hit);
            const comp = components.find(c => c.id === hit);
            if (comp && !comp.locked) {
                dragRef.current = { id: hit, startWx: world.x, startWy: world.y, origX: comp.x, origY: comp.y };
            }
        } else {
            onSelect(null);
            panRef.current = { startX: e.clientX, startY: e.clientY, ox: viewOffset.x, oy: viewOffset.y };
        }
    };

    const onMouseMove = (e) => {
        if (measureMode && measureRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
            setMeasurePoints({
                x1: measureRef.current.x1, y1: measureRef.current.y1,
                x2: world.x, y2: world.y,
            });
            return;
        }

        if (panRef.current) {
            const dx = e.clientX - panRef.current.startX;
            const dy = e.clientY - panRef.current.startY;
            onPan({ x: panRef.current.ox + dx, y: panRef.current.oy + dy });
            return;
        }
        if (dragRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
            const dx = world.x - dragRef.current.startWx;
            const dy = world.y - dragRef.current.startWy;
            const snap = (v) => Math.round(v / 5) * 5;
            onMove(dragRef.current.id, snap(dragRef.current.origX + dx), snap(dragRef.current.origY + dy));
        }
    };

    const onMouseUp = () => {
        if (measureMode && measureRef.current) {
            measureRef.current = null;
            return;
        }
        dragRef.current = null;
        panRef.current = null;
    };

    const onWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        onZoom(Math.max(0.15, Math.min(6, zoom * delta)));
    };

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: "100%", height: "100%",
                cursor: measureMode ? "crosshair" : "default",
                display: "block"
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
        />
    );
}
