import { useState, useRef } from "react";
import TopDownCanvas from "./components/canvas/TopDownCanvas.jsx";
import IsometricPreview from "./components/canvas/IsometricPreview.jsx";
import ComponentList from "./components/panels/ComponentList.jsx";
import DetailPanel from "./components/panels/DetailPanel.jsx";
import RenderPipeline from "./components/pipeline/RenderPipeline.jsx";
import SettingsPanel from "./components/settings/SettingsPanel.jsx";
import CadImport from "./components/import/CadImport.jsx";
import { downloadScene, importScene, exportSVG } from "./services/sceneSerializer.js";

/*
 * All dimensions are in FEET. The canvas maps feet → pixels via a
 * configurable zoom/pan, but users only ever see feet in the UI.
 * 
 * The layout represents VISUAL composition — where things appear
 * from the camera's perspective. An AI image model sees small boxes
 * in the distance as small objects; it doesn't need geometric coordinates.
 */

let idCounter = 0;
const uid = () => `c${++idCounter}`;

export default function App() {
    const [components, setComponents] = useState([]);
    const [selected, setSelected] = useState(null);
    const [viewOffset, setViewOffset] = useState({ x: 120, y: 60 });
    const [zoom, setZoom] = useState(8); // pixels per foot
    const [sceneNotes, setSceneNotes] = useState("");

    // UI state
    const [canvasMode, setCanvasMode] = useState("topdown");
    const [bottomHeight, setBottomHeight] = useState(300);
    const [showSettings, setShowSettings] = useState(false);
    const [showCadImport, setShowCadImport] = useState(false);
    const [showRuler, setShowRuler] = useState(true);
    const [showDimensions, setShowDimensions] = useState(true);
    const [measureMode, setMeasureMode] = useState(false);
    const canvasAreaRef = useRef(null);

    const selectedComp = components.find(c => c.id === selected);

    /**
     * Render a CLEAN reference image for the AI on an offscreen canvas.
     * White background, solid colored 3D isometric blocks — NO text, NO grid, NO labels.
     * This gives the model a pure layout to transform into photorealism.
     */
    const captureCanvas = () => {
        const visible = components.filter(c => c.visible !== false);
        if (!visible.length) return null;

        const W = 1024, H = 768;
        const offscreen = document.createElement("canvas");
        offscreen.width = W;
        offscreen.height = H;
        const ctx = offscreen.getContext("2d");

        // Light background
        ctx.fillStyle = "#e8e0d4";
        ctx.fillRect(0, 0, W, H);

        // Compute FULL scene bounds (min and max)
        const minX = Math.min(...visible.map(c => c.x));
        const minY = Math.min(...visible.map(c => c.y));
        const maxX = Math.max(...visible.map(c => c.x + c.width));
        const maxY = Math.max(...visible.map(c => c.y + c.length));
        const maxH = Math.max(...visible.map(c => c.height));

        // Scene extents — full range from min to max
        const padding = 80;
        const sceneWidth = (maxX - minX) || 80;
        const sceneDepth = (maxY - minY) || 60;
        const sceneH = maxH || 20;

        // Scale to fit canvas — compute projected extents
        const isoW = (sceneWidth + sceneDepth) * 0.86;
        const isoH = (sceneWidth + sceneDepth) * 0.5 + sceneH;
        const scale = Math.min((W - padding * 2) / isoW, (H - padding * 2) / isoH);

        // Center of scene in world coordinates
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Isometric transform: centered on mid-point of all components
        const toScreen = (x, y, z) => ({
            sx: W / 2 + (x - centerX - (y - centerY)) * scale * 0.86,
            sy: H * 0.55 + ((x - centerX) + (y - centerY)) * scale * 0.5 - z * scale,
        });

        // Sort by depth (back to front)
        const sorted = [...visible].sort((a, b) => {
            return (a.x + a.y) - (b.x + b.y);
        });

        // Draw ground plane
        const g0 = toScreen(minX, minY, 0);
        const g1 = toScreen(maxX, minY, 0);
        const g2 = toScreen(maxX, maxY, 0);
        const g3 = toScreen(minX, maxY, 0);
        ctx.fillStyle = "#d4cfc7";
        ctx.beginPath();
        ctx.moveTo(g0.sx, g0.sy);
        ctx.lineTo(g1.sx, g1.sy);
        ctx.lineTo(g2.sx, g2.sy);
        ctx.lineTo(g3.sx, g3.sy);
        ctx.closePath();
        ctx.fill();

        // Draw each component as an isometric box
        for (const comp of sorted) {
            const x = comp.x;
            const y = comp.y;
            const w = comp.width;
            const d = comp.length;
            const h = comp.height;

            // 8 corners
            const p = [
                toScreen(x, y, 0),         // 0: front-left-bottom
                toScreen(x + w, y, 0),      // 1: front-right-bottom
                toScreen(x + w, y + d, 0),  // 2: back-right-bottom
                toScreen(x, y + d, 0),      // 3: back-left-bottom
                toScreen(x, y, h),          // 4: front-left-top
                toScreen(x + w, y, h),      // 5: front-right-top
                toScreen(x + w, y + d, h),  // 6: back-right-top
                toScreen(x, y + d, h),      // 7: back-left-top
            ];

            const baseColor = comp.color || "#6688aa";

            // Parse hex color to RGB for shading
            const r = parseInt(baseColor.slice(1, 3), 16);
            const g = parseInt(baseColor.slice(3, 5), 16);
            const b = parseInt(baseColor.slice(5, 7), 16);

            // Top face (lightest)
            ctx.fillStyle = `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)})`;
            ctx.beginPath();
            ctx.moveTo(p[4].sx, p[4].sy);
            ctx.lineTo(p[5].sx, p[5].sy);
            ctx.lineTo(p[6].sx, p[6].sy);
            ctx.lineTo(p[7].sx, p[7].sy);
            ctx.closePath();
            ctx.fill();

            // Right face (medium)
            ctx.fillStyle = `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)})`;
            ctx.beginPath();
            ctx.moveTo(p[1].sx, p[1].sy);
            ctx.lineTo(p[5].sx, p[5].sy);
            ctx.lineTo(p[6].sx, p[6].sy);
            ctx.lineTo(p[2].sx, p[2].sy);
            ctx.closePath();
            ctx.fill();

            // Left face (darkest)
            ctx.fillStyle = `rgb(${Math.max(0, r - 50)}, ${Math.max(0, g - 50)}, ${Math.max(0, b - 50)})`;
            ctx.beginPath();
            ctx.moveTo(p[0].sx, p[0].sy);
            ctx.lineTo(p[4].sx, p[4].sy);
            ctx.lineTo(p[7].sx, p[7].sy);
            ctx.lineTo(p[3].sx, p[3].sy);
            ctx.closePath();
            ctx.fill();

            // Edges
            ctx.strokeStyle = "rgba(0,0,0,0.15)";
            ctx.lineWidth = 1;
            // Top edges
            ctx.beginPath();
            ctx.moveTo(p[4].sx, p[4].sy); ctx.lineTo(p[5].sx, p[5].sy);
            ctx.lineTo(p[6].sx, p[6].sy); ctx.lineTo(p[7].sx, p[7].sy);
            ctx.closePath();
            ctx.stroke();
            // Vertical edges
            ctx.beginPath();
            ctx.moveTo(p[0].sx, p[0].sy); ctx.lineTo(p[4].sx, p[4].sy);
            ctx.moveTo(p[1].sx, p[1].sy); ctx.lineTo(p[5].sx, p[5].sy);
            ctx.moveTo(p[2].sx, p[2].sy); ctx.lineTo(p[6].sx, p[6].sy);
            ctx.stroke();
        }

        return offscreen.toDataURL("image/png");
    };

    const updateComponent = (id, updated) => {
        setComponents(prev => prev.map(c => c.id === id ? updated : c));
    };

    const moveComponent = (id, x, y) => {
        setComponents(prev => prev.map(c => c.id === id ? { ...c, x, y } : c));
    };

    const addComponent = () => {
        const newComp = {
            id: uid(), name: "New Component", width: 10, length: 8, height: 8,
            x: 15, y: 15, z: 1,
            color: "#" + Math.floor(Math.random() * 0xaaaaaa + 0x555555).toString(16).padStart(6, "0"),
            material: "Custom", notes: "", refImages: [], locked: false, visible: true,
        };
        setComponents(prev => [...prev, newComp]);
        setSelected(newComp.id);
    };

    const deleteComponent = (id) => {
        setComponents(prev => prev.filter(c => c.id !== id));
        if (selected === id) setSelected(null);
    };

    const toggleVisibility = (id) => {
        setComponents(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
    };

    const newScene = () => {
        if (components.length > 0 && !confirm("Clear all components and start a new scene?")) return;
        setComponents([]);
        setSelected(null);
        setSceneNotes("");
    };

    const bulkDelete = (ids) => {
        if (!confirm(`Delete ${ids.length} component${ids.length !== 1 ? "s" : ""}?`)) return;
        setComponents(prev => prev.filter(c => !ids.includes(c.id)));
        if (ids.includes(selected)) setSelected(null);
    };

    const handleCadImport = (importedComponents, replace = false) => {
        const withIds = importedComponents.map(c => ({ ...c, id: uid() }));
        if (replace) {
            setComponents(withIds);
            setSelected(null);
        } else {
            setComponents(prev => [...prev, ...withIds]);
        }
        setShowCadImport(false);
    };

    const handleImport = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const result = importScene(ev.target.result);
                    setComponents(result.components);
                    setSceneNotes(result.sceneNotes);
                } catch (err) {
                    alert("Import failed: " + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const onResizeStart = (e) => {
        const startY = e.clientY;
        const startH = bottomHeight;
        const onMove = (ev) => setBottomHeight(Math.max(140, Math.min(600, startH + (startY - ev.clientY))));
        const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const toolbarBtn = (label, active, onClick, title) => (
        <button onClick={onClick} title={title} style={{
            padding: "3px 10px", fontSize: 11, fontFamily: "var(--font-condensed)",
            fontWeight: 500, letterSpacing: 0.3, textTransform: "uppercase",
            background: active ? "var(--accent-light)" : "transparent",
            border: `1px solid ${active ? "var(--accent)" : "var(--border-subtle)"}`,
            color: active ? "var(--accent)" : "var(--text-muted)",
            borderRadius: "var(--radius-sm)", cursor: "pointer",
            transition: "all 0.12s ease",
        }}>
            {label}
        </button>
    );

    return (
        <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Top bar */}
            <div style={{
                height: 42, background: "var(--bg-deepest)", borderBottom: "1px solid var(--border-default)",
                display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0,
            }}>
                <span style={{ fontFamily: "var(--font-condensed)", fontSize: 15, fontWeight: 700, color: "var(--accent)", letterSpacing: 1.5, textTransform: "uppercase" }}>
                    Scene Composer
                </span>
                <span style={{ fontSize: 10, color: "var(--text-ghost)", fontFamily: "var(--font-condensed)", fontWeight: 400, letterSpacing: 0.5 }}>American Render Corp</span>

                <div style={{ width: 1, height: 20, background: "var(--border-default)" }} />

                {/* View toggle */}
                <div style={{ display: "flex", gap: 2 }}>
                    {toolbarBtn("Plan", canvasMode === "topdown", () => setCanvasMode("topdown"))}
                    {toolbarBtn("Isometric", canvasMode === "isometric", () => setCanvasMode("isometric"))}
                </div>

                <div style={{ width: 1, height: 20, background: "var(--border-default)" }} />

                {/* Tools */}
                <div style={{ display: "flex", gap: 2 }}>
                    {toolbarBtn("Ruler", showRuler, () => setShowRuler(!showRuler))}
                    {toolbarBtn("Dims", showDimensions, () => setShowDimensions(!showDimensions))}
                    {toolbarBtn("Measure", measureMode, () => setMeasureMode(!measureMode))}
                </div>

                <div style={{ flex: 1 }} />

                {/* Zoom display in ft */}
                <div style={{
                    fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)",
                    padding: "3px 10px", background: "var(--bg-base)", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)",
                }}>
                    {zoom.toFixed(1)} px/ft
                </div>

                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {components.length} parts
                </span>

                <div style={{ display: "flex", gap: 3 }}>
                    {toolbarBtn("CAD Import", false, () => setShowCadImport(true), "Import from CAD file")}
                    {toolbarBtn("Import", false, handleImport)}
                    {toolbarBtn("Export", false, () => downloadScene(components, sceneNotes))}
                    {toolbarBtn("SVG", false, () => exportSVG(components))}
                    {toolbarBtn("Settings", false, () => setShowSettings(true))}
                </div>
            </div>

            {/* Main */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* Left — Scene graph */}
                <div style={{ width: 220, borderRight: "1px solid var(--border-default)", padding: 8, flexShrink: 0, background: "var(--bg-deep)", display: "flex", flexDirection: "column" }}>
                    <ComponentList components={components} selected={selected} onSelect={setSelected} onAdd={addComponent} onDelete={deleteComponent} onToggleVis={toggleVisibility} onNewScene={newScene} onBulkDelete={bulkDelete} />
                </div>

                {/* Center */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div ref={canvasAreaRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: "var(--bg-deepest)" }}>
                        {canvasMode === "topdown" ? (
                            <TopDownCanvas
                                components={components} selected={selected} onSelect={setSelected}
                                onMove={moveComponent} viewOffset={viewOffset} zoom={zoom}
                                onPan={setViewOffset} onZoom={setZoom}
                                showRuler={showRuler} showDimensions={showDimensions} measureMode={measureMode}
                            />
                        ) : (
                            <IsometricPreview components={components} selected={selected} />
                        )}
                        <div style={{
                            position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,0.85)",
                            borderRadius: "var(--radius-sm)", padding: "4px 10px", fontSize: 10,
                            color: "var(--text-muted)", fontFamily: "var(--font-mono)",
                            backdropFilter: "blur(8px)", border: "1px solid var(--border-subtle)",
                        }}>
                            {canvasMode === "topdown"
                                ? "Drag to move / Alt+Drag to pan / Scroll to zoom / Units: ft"
                                : "Rotate and zoom the 3D preview"}
                        </div>
                    </div>

                    <div onMouseDown={onResizeStart} style={{ height: 4, background: "var(--border-default)", cursor: "ns-resize", flexShrink: 0 }}
                        onMouseEnter={e => e.target.style.background = "var(--accent)"}
                        onMouseLeave={e => e.target.style.background = "var(--border-default)"} />

                    <div style={{ height: bottomHeight, display: "flex", flexDirection: "column", flexShrink: 0, background: "var(--bg-deep)" }}>
                        <RenderPipeline components={components} sceneNotes={sceneNotes} onSceneNotesChange={setSceneNotes} captureCanvas={captureCanvas} />
                    </div>
                </div>

                {/* Right — Properties */}
                <div style={{ width: 290, borderLeft: "1px solid var(--border-default)", overflowY: "auto", flexShrink: 0, background: "var(--bg-deep)" }}>
                    <DetailPanel component={selectedComp} onChange={updateComponent} onDelete={deleteComponent} />
                </div>
            </div>

            {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
            {showCadImport && <CadImport onImport={handleCadImport} onClose={() => setShowCadImport(false)} />}
        </div>
    );
}
