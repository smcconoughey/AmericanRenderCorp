import { useState, useRef, useCallback } from "react";
import TopDownCanvas from "./components/canvas/TopDownCanvas.jsx";
import IsometricPreview from "./components/canvas/IsometricPreview.jsx";
import ComponentList from "./components/panels/ComponentList.jsx";
import DetailPanel from "./components/panels/DetailPanel.jsx";
import RenderPipeline from "./components/pipeline/RenderPipeline.jsx";
import SettingsPanel from "./components/settings/SettingsPanel.jsx";
import { downloadScene, importScene, exportSVG } from "./services/sceneSerializer.js";

const DEFAULT_COMPONENTS = [
    { id: "c1", name: "Concrete Pad", x: 200, y: 200, w: 400, h: 300, z: 0, depth: 0.5, color: "#7a7a7a", material: "Concrete (weathered)", notes: "Poured concrete foundation, weathered finish", refImages: [], locked: false, visible: true },
    { id: "c2", name: "Vertical Test Stand", x: 350, y: 280, w: 60, h: 60, z: 1, depth: 25, color: "#c4c4c4", material: "Steel (painted)", notes: "Steel frame tower with launch rail, painted white", refImages: [], locked: false, visible: true },
    { id: "c3", name: "Test Control Container", x: 140, y: 220, w: 100, h: 50, z: 1, depth: 8, color: "#5a8f5a", material: "Shipping Container", notes: "Green shipping container, houses test control electronics", refImages: [], locked: false, visible: true },
    { id: "c4", name: "Conex Box Test Stand", x: 480, y: 240, w: 100, h: 50, z: 1, depth: 8, color: "#6a8fa0", material: "Shipping Container", notes: "Blue shipping container with horizontal test stand inside", refImages: [], locked: false, visible: true },
    { id: "c5", name: "Generator", x: 120, y: 300, w: 40, h: 30, z: 1, depth: 4, color: "#555555", material: "Steel (painted)", notes: "Portable diesel generator", refImages: [], locked: false, visible: true },
    { id: "c6", name: "Gravel Down-range", x: 350, y: 420, w: 300, h: 80, z: 0, depth: 0.3, color: "#b0a890", material: "Gravel", notes: "Compacted gravel area extending behind test stand", refImages: [], locked: false, visible: true },
];

let idCounter = 10;
const uid = () => `c${++idCounter}`;

const SCALE_OPTIONS = ["1ft = 10px", "1ft = 20px", "1ft = 40px", "1m = 10px", "1m = 20px", "1m = 40px"];

export default function App() {
    const [components, setComponents] = useState(DEFAULT_COMPONENTS);
    const [selected, setSelected] = useState(null);
    const [viewOffset, setViewOffset] = useState({ x: 50, y: 20 });
    const [zoom, setZoom] = useState(1);
    const [scaleSetting, setScaleSetting] = useState("1ft = 20px");
    const [sceneNotes, setSceneNotes] = useState("Outdoor rocket propulsion test facility in Central Florida. Flat sandy terrain with scrub pine vegetation. Clear sky, midday sun. Photorealistic architectural visualization quality.");

    // UI state
    const [canvasMode, setCanvasMode] = useState("topdown"); // topdown | isometric
    const [bottomHeight, setBottomHeight] = useState(300);
    const [showSettings, setShowSettings] = useState(false);
    const [showRuler, setShowRuler] = useState(true);
    const [showDimensions, setShowDimensions] = useState(true);
    const [measureMode, setMeasureMode] = useState(false);

    const selectedComp = components.find(c => c.id === selected);

    // Component operations
    const updateComponent = (id, updated) => {
        setComponents(prev => prev.map(c => c.id === id ? updated : c));
    };

    const moveComponent = (id, x, y) => {
        setComponents(prev => prev.map(c => c.id === id ? { ...c, x, y } : c));
    };

    const addComponent = () => {
        const newComp = {
            id: uid(), name: "New Component", x: 300, y: 300, w: 80, h: 60,
            z: 1, depth: 8, color: "#" + Math.floor(Math.random() * 0xaaaaaa + 0x555555).toString(16).padStart(6, "0"),
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
        setComponents(prev => prev.map(c => c.id === id ? { ...c, visible: c.visible === false ? true : false } : c));
    };

    // Import/Export
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
                    setScaleSetting(result.scaleSetting);
                } catch (err) {
                    alert("Import failed: " + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // Bottom panel resize
    const onResizeStart = (e) => {
        const startY = e.clientY;
        const startH = bottomHeight;
        const onMove = (ev) => {
            const delta = startY - ev.clientY;
            setBottomHeight(Math.max(140, Math.min(600, startH + delta)));
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    // Tab button helper
    const tabBtn = (label, value, current, setter, icon) => (
        <button
            onClick={() => setter(value)}
            style={{
                padding: "4px 12px", fontSize: 11,
                background: current === value ? "var(--bg-hover)" : "transparent",
                border: "none",
                borderBottom: current === value ? "2px solid var(--accent)" : "2px solid transparent",
                color: current === value ? "var(--accent)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                transition: "all 0.15s ease",
            }}
        >
            {icon && <span style={{ fontSize: 12 }}>{icon}</span>}
            {label}
        </button>
    );

    const toolbarBtn = (label, active, onClick, title) => (
        <button onClick={onClick} title={title} style={{
            padding: "2px 8px", fontSize: 10, fontFamily: "var(--font-mono)",
            background: active ? "var(--accent-glow)" : "transparent",
            border: `1px solid ${active ? "var(--accent-dim)" : "var(--border-subtle)"}`,
            color: active ? "var(--accent)" : "var(--text-ghost)",
            borderRadius: "var(--radius-sm)", cursor: "pointer",
            transition: "all 0.12s ease",
        }}>
            {label}
        </button>
    );

    return (
        <div style={{
            width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
            {/* Top bar */}
            <div style={{
                height: 40, background: "var(--bg-deepest)", borderBottom: "1px solid var(--border-subtle)",
                display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexShrink: 0,
            }}>
                {/* Logo */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
                        color: "var(--accent)", letterSpacing: 1
                    }}>
                        ◆ SCENE COMPOSER
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-ghost)", fontStyle: "italic" }}>
                        American Render Corp
                    </span>
                </div>

                <div style={{ width: 1, height: 18, background: "var(--border-subtle)" }} />

                {/* Canvas mode toggle */}
                <div style={{ display: "flex", gap: 2 }}>
                    {toolbarBtn("Top-Down", canvasMode === "topdown", () => setCanvasMode("topdown"), "2D layout view")}
                    {toolbarBtn("Isometric", canvasMode === "isometric", () => setCanvasMode("isometric"), "3D preview")}
                </div>

                <div style={{ width: 1, height: 18, background: "var(--border-subtle)" }} />

                {/* Canvas tools */}
                <div style={{ display: "flex", gap: 2 }}>
                    {toolbarBtn("📏 Ruler", showRuler, () => setShowRuler(!showRuler), "Toggle scale ruler")}
                    {toolbarBtn("📐 Dims", showDimensions, () => setShowDimensions(!showDimensions), "Toggle dimension labels")}
                    {toolbarBtn("📏 Measure", measureMode, () => setMeasureMode(!measureMode), "Measure distance tool")}
                </div>

                <div style={{ flex: 1 }} />

                {/* Scale indicator */}
                <div style={{
                    fontSize: 10, color: "var(--text-ghost)", fontFamily: "var(--font-mono)",
                    padding: "2px 8px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)",
                }}>
                    Scale: {scaleSetting}
                </div>

                {/* Stats */}
                <span style={{ fontSize: 10, color: "var(--text-ghost)", fontFamily: "var(--font-mono)" }}>
                    {components.length} comp · {components.filter(c => c.refImages?.length).length} refs
                </span>

                {/* Actions */}
                <div style={{ display: "flex", gap: 4 }}>
                    {toolbarBtn("Import", false, handleImport, "Import scene JSON")}
                    {toolbarBtn("Export", false, () => downloadScene(components, sceneNotes, scaleSetting), "Export scene JSON")}
                    {toolbarBtn("SVG", false, () => exportSVG(components), "Export layout SVG")}
                    {toolbarBtn("⚙", false, () => setShowSettings(true), "Settings")}
                </div>
            </div>

            {/* Main area */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* Left panel — Scene graph */}
                <div style={{
                    width: 200, borderRight: "1px solid var(--border-subtle)",
                    padding: 8, flexShrink: 0, display: "flex", flexDirection: "column",
                    background: "var(--bg-deep)",
                }}>
                    <ComponentList
                        components={components} selected={selected} onSelect={setSelected}
                        onAdd={addComponent} onDelete={deleteComponent} onToggleVis={toggleVisibility}
                    />
                </div>

                {/* Center — Canvas + Bottom panel */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {/* Canvas */}
                    <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "var(--bg-deepest)" }}>
                        {canvasMode === "topdown" ? (
                            <TopDownCanvas
                                components={components} selected={selected} onSelect={setSelected}
                                onMove={moveComponent} viewOffset={viewOffset} zoom={zoom}
                                onPan={setViewOffset} onZoom={setZoom}
                                scaleSetting={scaleSetting} showRuler={showRuler}
                                showDimensions={showDimensions} measureMode={measureMode}
                            />
                        ) : (
                            <IsometricPreview
                                components={components} selected={selected} scaleSetting={scaleSetting}
                            />
                        )}

                        {/* Canvas mode badge */}
                        <div style={{
                            position: "absolute", top: 8, left: 8, background: "var(--bg-deepest)",
                            borderRadius: "var(--radius-sm)", padding: "4px 10px", fontSize: 10,
                            color: "var(--text-ghost)", fontFamily: "var(--font-mono)",
                            backdropFilter: "blur(8px)", border: "1px solid var(--border-subtle)",
                            opacity: 0.8,
                        }}>
                            {canvasMode === "topdown"
                                ? "Drag to move · Alt+Drag to pan · Scroll to zoom"
                                : "Use sliders to adjust camera angle"
                            }
                        </div>
                    </div>

                    {/* Resize handle */}
                    <div
                        onMouseDown={onResizeStart}
                        style={{
                            height: 5, background: "var(--border-subtle)", cursor: "ns-resize", flexShrink: 0,
                            transition: "background 0.15s",
                        }}
                        onMouseEnter={e => e.target.style.background = "var(--accent-dim)"}
                        onMouseLeave={e => e.target.style.background = "var(--border-subtle)"}
                    />

                    {/* Bottom panel */}
                    <div style={{ height: bottomHeight, display: "flex", flexDirection: "column", flexShrink: 0, background: "var(--bg-deep)" }}>
                        <RenderPipeline
                            components={components}
                            sceneNotes={sceneNotes}
                            onSceneNotesChange={setSceneNotes}
                            scaleSetting={scaleSetting}
                        />
                    </div>
                </div>

                {/* Right panel — Properties */}
                <div style={{
                    width: 280, borderLeft: "1px solid var(--border-subtle)",
                    overflowY: "auto", flexShrink: 0, background: "var(--bg-deep)",
                }}>
                    <DetailPanel
                        component={selectedComp}
                        onChange={updateComponent}
                        onDelete={deleteComponent}
                        scaleSetting={scaleSetting}
                    />
                </div>
            </div>

            {/* Settings modal */}
            {showSettings && (
                <SettingsPanel
                    scaleSetting={scaleSetting}
                    onScaleChange={setScaleSetting}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    );
}
