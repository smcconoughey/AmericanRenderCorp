import { useRef, useEffect, useCallback, useState } from "react";

/**
 * Isometric preview — renders components as extruded 3D blocks
 * using their feet-based dimensions (width, length, height).
 */
export default function IsometricPreview({ components, selected }) {
    const canvasRef = useRef(null);
    const [rotation, setRotation] = useState(45);
    const [elevation, setElevation] = useState(30);
    const [isoZoom, setIsoZoom] = useState(3.5);

    const project = useCallback((x, y, z) => {
        const rad = (rotation * Math.PI) / 180;
        const elRad = (elevation * Math.PI) / 180;
        const rx = x * Math.cos(rad) - y * Math.sin(rad);
        const ry = x * Math.sin(rad) + y * Math.cos(rad);
        return {
            x: rx * isoZoom,
            y: (ry * Math.sin(elRad) - z) * isoZoom,
        };
    }, [rotation, elevation, isoZoom]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = "#f5f5f0";
        ctx.fillRect(0, 0, W, H);

        const cx = W / 2;
        const cy = H / 2 + 40;

        // Center geometry
        const allX = components.filter(c => c.visible !== false).map(c => c.x + c.width / 2);
        const allY = components.filter(c => c.visible !== false).map(c => c.y + c.length / 2);
        const centerX = allX.length ? (Math.min(...allX) + Math.max(...allX)) / 2 : 0;
        const centerY = allY.length ? (Math.min(...allY) + Math.max(...allY)) / 2 : 0;

        // Sort for painter's algorithm
        const rad = (rotation * Math.PI) / 180;
        const sorted = [...components]
            .filter(c => c.visible !== false)
            .sort((a, b) => {
                const da = (a.x + a.width / 2) * Math.sin(rad) + (a.y + a.length / 2) * Math.cos(rad);
                const db = (b.x + b.width / 2) * Math.sin(rad) + (b.y + b.length / 2) * Math.cos(rad);
                return da - db;
            });

        // Ground grid (in feet)
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = "#d0d0c8";
        ctx.lineWidth = 0.5;
        const gridExtent = 80;
        for (let i = -gridExtent; i <= gridExtent; i += 10) {
            const p1 = project(i - centerX, -gridExtent - centerY, 0);
            const p2 = project(i - centerX, gridExtent - centerY, 0);
            ctx.beginPath(); ctx.moveTo(cx + p1.x, cy + p1.y); ctx.lineTo(cx + p2.x, cy + p2.y); ctx.stroke();
            const p3 = project(-gridExtent - centerX, i - centerY, 0);
            const p4 = project(gridExtent - centerX, i - centerY, 0);
            ctx.beginPath(); ctx.moveTo(cx + p3.x, cy + p3.y); ctx.lineTo(cx + p4.x, cy + p4.y); ctx.stroke();
        }
        ctx.restore();

        // Draw components as extruded boxes
        for (const comp of sorted) {
            const isSelected = selected === comp.id;
            const bx = comp.x - centerX;
            const by = comp.y - centerY;

            const corners = [
                project(bx, by, 0), project(bx + comp.width, by, 0),
                project(bx + comp.width, by + comp.length, 0), project(bx, by + comp.length, 0),
                project(bx, by, comp.height), project(bx + comp.width, by, comp.height),
                project(bx + comp.width, by + comp.length, comp.height), project(bx, by + comp.length, comp.height),
            ].map(p => ({ x: cx + p.x, y: cy + p.y }));

            const r = parseInt(comp.color.slice(1, 3), 16);
            const g = parseInt(comp.color.slice(3, 5), 16);
            const b = parseInt(comp.color.slice(5, 7), 16);

            // Top face
            ctx.beginPath();
            ctx.moveTo(corners[4].x, corners[4].y); ctx.lineTo(corners[5].x, corners[5].y);
            ctx.lineTo(corners[6].x, corners[6].y); ctx.lineTo(corners[7].x, corners[7].y);
            ctx.closePath();
            ctx.fillStyle = `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 0.85)`;
            ctx.fill();
            ctx.strokeStyle = isSelected ? "#2b6cb0" : `rgba(${r}, ${g}, ${b}, 0.6)`;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.stroke();

            // Front face
            ctx.beginPath();
            ctx.moveTo(corners[1].x, corners[1].y); ctx.lineTo(corners[2].x, corners[2].y);
            ctx.lineTo(corners[6].x, corners[6].y); ctx.lineTo(corners[5].x, corners[5].y);
            ctx.closePath();
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
            ctx.fill(); ctx.stroke();

            // Side face
            ctx.beginPath();
            ctx.moveTo(corners[2].x, corners[2].y); ctx.lineTo(corners[3].x, corners[3].y);
            ctx.lineTo(corners[7].x, corners[7].y); ctx.lineTo(corners[6].x, corners[6].y);
            ctx.closePath();
            ctx.fillStyle = `rgba(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)}, 0.75)`;
            ctx.fill(); ctx.stroke();

            // Label on top
            const labelX = (corners[4].x + corners[5].x + corners[6].x + corners[7].x) / 4;
            const labelY = (corners[4].y + corners[5].y + corners[6].y + corners[7].y) / 4;
            const name = comp.name.length > 16 ? comp.name.slice(0, 14) + "..." : comp.name;
            ctx.font = "500 9px 'IBM Plex Mono', monospace";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillStyle = "#ffffffaa"; ctx.fillText(name, labelX + 0.5, labelY + 0.5);
            ctx.fillStyle = "#1a202c"; ctx.fillText(name, labelX, labelY);

            // Height annotation
            if (isSelected) {
                const topMid = { x: (corners[4].x + corners[5].x) / 2, y: (corners[4].y + corners[5].y) / 2 };
                const botMid = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 };
                ctx.beginPath(); ctx.moveTo(topMid.x, topMid.y); ctx.lineTo(botMid.x, botMid.y);
                ctx.strokeStyle = "#2b6cb088"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
                ctx.fillStyle = "#2b6cb0"; ctx.font = "600 10px 'IBM Plex Mono', monospace";
                ctx.fillText(`${comp.height}ft`, topMid.x + 15, (topMid.y + botMid.y) / 2);
            }
        }

        // Info
        ctx.fillStyle = "#888";
        ctx.font = "10px 'IBM Plex Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(`Rotation: ${rotation}  |  Elevation: ${elevation}  |  All dimensions in feet`, 8, H - 8);
    }, [components, selected, rotation, elevation, isoZoom, project]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        draw();
    }, [draw]);

    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            draw();
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [draw]);

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
            <div style={{
                position: "absolute", top: 8, right: 8, background: "rgba(255,255,255,0.9)",
                borderRadius: 6, padding: "8px 12px", backdropFilter: "blur(8px)",
                border: "1px solid var(--border-default)", display: "flex", flexDirection: "column", gap: 6,
            }}>
                {[
                    { label: "Rotate", min: 0, max: 360, value: rotation, set: setRotation, unit: "°" },
                    { label: "Elevation", min: 10, max: 80, value: elevation, set: setElevation, unit: "°" },
                    { label: "Zoom", min: 10, max: 100, value: isoZoom * 10, set: v => setIsoZoom(v / 10), unit: "" },
                ].map(s => (
                    <label key={s.label} style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-condensed)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        <span style={{ width: 52 }}>{s.label}</span>
                        <input type="range" min={s.min} max={s.max} value={s.value}
                            onChange={e => s.set(+e.target.value)} style={{ width: 80, accentColor: "#2b6cb0" }} />
                        <span style={{ width: 32, textAlign: "right", fontFamily: "var(--font-mono)", textTransform: "none" }}>
                            {typeof s.value === "number" ? (s.label === "Zoom" ? `${(s.value / 10).toFixed(1)}×` : `${s.value}${s.unit}`) : s.value}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
}
