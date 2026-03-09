import { useRef, useEffect, useCallback, useState } from "react";

/**
 * 2.5D Isometric Preview — renders the scene as extruded blocks
 * based on component positions and depth values.
 */
export default function IsometricPreview({ components, selected, scaleSetting }) {
    const canvasRef = useRef(null);
    const [rotation, setRotation] = useState(45);
    const [elevation, setElevation] = useState(30);
    const [isoZoom, setIsoZoom] = useState(0.7);

    const parseScale = () => {
        const match = scaleSetting?.match(/1(ft|m)\s*=\s*(\d+)px/);
        if (!match) return { unit: "ft", pxPerUnit: 20 };
        return { unit: match[1], pxPerUnit: parseInt(match[2]) };
    };

    const project = useCallback((x, y, z) => {
        const rad = (rotation * Math.PI) / 180;
        const elRad = (elevation * Math.PI) / 180;

        // Rotate around Y axis
        const rx = x * Math.cos(rad) - y * Math.sin(rad);
        const ry = x * Math.sin(rad) + y * Math.cos(rad);
        const rz = z;

        // Project with elevation
        const px = rx * isoZoom;
        const py = (ry * Math.sin(elRad) - rz) * isoZoom;

        return { x: px, y: py };
    }, [rotation, elevation, isoZoom]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = "#06060f";
        ctx.fillRect(0, 0, W, H);

        const { pxPerUnit } = parseScale();
        const heightScale = pxPerUnit * 0.8;

        // Center the view
        const cx = W / 2;
        const cy = H / 2 + 50;

        // Sort components for painter's algorithm (back to front based on rotation)
        const rad = (rotation * Math.PI) / 180;
        const sorted = [...components]
            .filter(c => c.visible !== false)
            .sort((a, b) => {
                const da = (a.x + a.w / 2) * Math.sin(rad) + (a.y + a.h / 2) * Math.cos(rad);
                const db = (b.x + b.w / 2) * Math.sin(rad) + (b.y + b.h / 2) * Math.cos(rad);
                return da - db;
            });

        // Draw ground grid
        ctx.save();
        ctx.globalAlpha = 0.3;
        const gridSize = 50;
        const gridExtent = 400;
        ctx.strokeStyle = "#1a1a3e";
        ctx.lineWidth = 0.5;
        for (let i = -gridExtent; i <= gridExtent; i += gridSize) {
            const p1 = project(i, -gridExtent, 0);
            const p2 = project(i, gridExtent, 0);
            const p3 = project(-gridExtent, i, 0);
            const p4 = project(gridExtent, i, 0);
            ctx.beginPath();
            ctx.moveTo(cx + p1.x, cy + p1.y);
            ctx.lineTo(cx + p2.x, cy + p2.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx + p3.x, cy + p3.y);
            ctx.lineTo(cx + p4.x, cy + p4.y);
            ctx.stroke();
        }
        ctx.restore();

        // Draw each component as extruded box
        for (const comp of sorted) {
            const isSelected = selected === comp.id;
            const h = comp.depth * heightScale / pxPerUnit;

            // 8 corners of the box
            const corners = [
                { x: comp.x, y: comp.y, z: 0 },
                { x: comp.x + comp.w, y: comp.y, z: 0 },
                { x: comp.x + comp.w, y: comp.y + comp.h, z: 0 },
                { x: comp.x, y: comp.y + comp.h, z: 0 },
                { x: comp.x, y: comp.y, z: h },
                { x: comp.x + comp.w, y: comp.y, z: h },
                { x: comp.x + comp.w, y: comp.y + comp.h, z: h },
                { x: comp.x, y: comp.y + comp.h, z: h },
            ];

            // Center the geometry
            const centerX = Math.max(...components.map(c => c.x + c.w)) / 2;
            const centerY = Math.max(...components.map(c => c.y + c.h)) / 2;
            const projected = corners.map(c => project(c.x - centerX, c.y - centerY, c.z));

            const pts = projected.map(p => ({ x: cx + p.x, y: cy + p.y }));

            const baseColor = comp.color;
            const r = parseInt(baseColor.slice(1, 3), 16);
            const g = parseInt(baseColor.slice(3, 5), 16);
            const b = parseInt(baseColor.slice(5, 7), 16);

            // Top face
            ctx.beginPath();
            ctx.moveTo(pts[4].x, pts[4].y);
            ctx.lineTo(pts[5].x, pts[5].y);
            ctx.lineTo(pts[6].x, pts[6].y);
            ctx.lineTo(pts[7].x, pts[7].y);
            ctx.closePath();
            ctx.fillStyle = `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 0.85)`;
            ctx.fill();
            ctx.strokeStyle = isSelected ? "#ff6b35" : `rgba(${r}, ${g}, ${b}, 0.9)`;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.stroke();

            // Front face
            ctx.beginPath();
            ctx.moveTo(pts[1].x, pts[1].y);
            ctx.lineTo(pts[2].x, pts[2].y);
            ctx.lineTo(pts[6].x, pts[6].y);
            ctx.lineTo(pts[5].x, pts[5].y);
            ctx.closePath();
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
            ctx.fill();
            ctx.strokeStyle = isSelected ? "#ff6b35" : `rgba(${r}, ${g}, ${b}, 0.9)`;
            ctx.stroke();

            // Side face  
            ctx.beginPath();
            ctx.moveTo(pts[2].x, pts[2].y);
            ctx.lineTo(pts[3].x, pts[3].y);
            ctx.lineTo(pts[7].x, pts[7].y);
            ctx.lineTo(pts[6].x, pts[6].y);
            ctx.closePath();
            ctx.fillStyle = `rgba(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)}, 0.75)`;
            ctx.fill();
            ctx.strokeStyle = isSelected ? "#ff6b35" : `rgba(${r}, ${g}, ${b}, 0.9)`;
            ctx.stroke();

            // Label on top face
            const labelX = (pts[4].x + pts[5].x + pts[6].x + pts[7].x) / 4;
            const labelY = (pts[4].y + pts[5].y + pts[6].y + pts[7].y) / 4;
            ctx.font = `500 10px 'JetBrains Mono', monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#000000aa";
            ctx.fillText(comp.name, labelX + 0.5, labelY + 0.5);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(comp.name, labelX, labelY);

            // Selection highlight
            if (isSelected) {
                ctx.save();
                ctx.shadowColor = "#ff6b35";
                ctx.shadowBlur = 12;
                ctx.strokeStyle = "#ff6b3588";
                ctx.lineWidth = 2;
                // Outline the top face
                ctx.beginPath();
                ctx.moveTo(pts[4].x, pts[4].y);
                ctx.lineTo(pts[5].x, pts[5].y);
                ctx.lineTo(pts[6].x, pts[6].y);
                ctx.lineTo(pts[7].x, pts[7].y);
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }
        }

        // Info text
        ctx.fillStyle = "#555";
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(`Rotation: ${rotation}°  |  Elevation: ${elevation}°`, 8, H - 8);
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
            <canvas
                ref={canvasRef}
                style={{ width: "100%", height: "100%", display: "block" }}
            />
            {/* Camera controls overlay */}
            <div style={{
                position: "absolute", top: 8, right: 8, background: "#080814dd",
                borderRadius: 6, padding: "8px 12px", backdropFilter: "blur(8px)",
                border: "1px solid #1a1a2e", display: "flex", flexDirection: "column", gap: 6,
            }}>
                <label style={{ fontSize: 10, color: "#888", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 52 }}>Rotate</span>
                    <input type="range" min="0" max="360" value={rotation}
                        onChange={e => setRotation(+e.target.value)}
                        style={{ width: 80, accentColor: "#ff6b35" }} />
                    <span style={{ width: 28, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{rotation}°</span>
                </label>
                <label style={{ fontSize: 10, color: "#888", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 52 }}>Elevation</span>
                    <input type="range" min="10" max="80" value={elevation}
                        onChange={e => setElevation(+e.target.value)}
                        style={{ width: 80, accentColor: "#ff6b35" }} />
                    <span style={{ width: 28, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{elevation}°</span>
                </label>
                <label style={{ fontSize: 10, color: "#888", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 52 }}>Zoom</span>
                    <input type="range" min="30" max="200" value={isoZoom * 100}
                        onChange={e => setIsoZoom(+e.target.value / 100)}
                        style={{ width: 80, accentColor: "#ff6b35" }} />
                    <span style={{ width: 28, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{(isoZoom * 100).toFixed(0)}%</span>
                </label>
            </div>
        </div>
    );
}
