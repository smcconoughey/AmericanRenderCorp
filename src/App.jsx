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

    const selectedComp = components.find(c => c.id === selected);

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
        <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Top bar */}
            <div style={{
                height: 40, background: "var(--bg-deepest)", borderBottom: "1px solid var(--border-subtle)",
                display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0,
            }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--accent)", letterSpacing: 1 }}>
                    ◆ SCENE COMPOSER
                </span>
                <span style={{ fontSize: 10, color: "var(--text-ghost)", fontStyle: "italic" }}>American Render Corp</span>

                <div style={{ width: 1, height: 18, background: "var(--border-subtle)" }} />

                {/* View toggle */}
                <div style={{ display: "flex", gap: 2 }}>
                    {toolbarBtn("Top-Down", canvasMode === "topdown", () => setCanvasMode("topdown"))}
                    {toolbarBtn("Isometric", canvasMode === "isometric", () => setCanvasMode("isometric"))}
                </div>

                <div style={{ width: 1, height: 18, background: "var(--border-subtle)" }} />

                {/* Tools */}
                <div style={{ display: "flex", gap: 2 }}>
                    {toolbarBtn("📏 Ruler", showRuler, () => setShowRuler(!showRuler))}
                    {toolbarBtn("📐 Dims", showDimensions, () => setShowDimensions(!showDimensions))}
                    {toolbarBtn("📏 Measure", measureMode, () => setMeasureMode(!measureMode))}
                </div>

                <div style={{ flex: 1 }} />

                {/* Zoom display in ft */}
                <div style={{
                    fontSize: 10, color: "var(--text-ghost)", fontFamily: "var(--font-mono)",
                    padding: "2px 8px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)",
                }}>
                    {zoom.toFixed(1)} px/ft · All dimensions in feet
                </div>

                <span style={{ fontSize: 10, color: "var(--text-ghost)", fontFamily: "var(--font-mono)" }}>
                    {components.length} parts · {components.filter(c => c.refImages?.length).length} refs
                </span>

                <div style={{ display: "flex", gap: 4 }}>
                    {toolbarBtn("📸 CAD Import", false, () => setShowCadImport(true), "Import from CAD screenshot")}
                    {toolbarBtn("Import", false, handleImport)}
                    {toolbarBtn("Export", false, () => downloadScene(components, sceneNotes))}
                    {toolbarBtn("SVG", false, () => exportSVG(components))}
                    {toolbarBtn("⚙", false, () => setShowSettings(true))}
                </div>
            </div>

            {/* Main */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* Left — Scene graph */}
                <div style={{ width: 210, borderRight: "1px solid var(--border-subtle)", padding: 8, flexShrink: 0, background: "var(--bg-deep)", display: "flex", flexDirection: "column" }}>
                    <ComponentList components={components} selected={selected} onSelect={setSelected} onAdd={addComponent} onDelete={deleteComponent} onToggleVis={toggleVisibility} onNewScene={newScene} onBulkDelete={bulkDelete} />
                </div>

                {/* Center */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "var(--bg-deepest)" }}>
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
                            position: "absolute", top: 8, left: 8, background: "var(--bg-deepest)",
                            borderRadius: "var(--radius-sm)", padding: "4px 10px", fontSize: 10,
                            color: "var(--text-ghost)", fontFamily: "var(--font-mono)",
                            backdropFilter: "blur(8px)", border: "1px solid var(--border-subtle)", opacity: 0.8,
                        }}>
                            {canvasMode === "topdown"
                                ? "Drag components · Alt+Drag to pan · Scroll to zoom · All units in feet"
                                : "Rotate and zoom the 3D preview"}
                        </div>
                    </div>

                    <div onMouseDown={onResizeStart} style={{ height: 5, background: "var(--border-subtle)", cursor: "ns-resize", flexShrink: 0 }}
                        onMouseEnter={e => e.target.style.background = "var(--accent-dim)"}
                        onMouseLeave={e => e.target.style.background = "var(--border-subtle)"} />

                    <div style={{ height: bottomHeight, display: "flex", flexDirection: "column", flexShrink: 0, background: "var(--bg-deep)" }}>
                        <RenderPipeline components={components} sceneNotes={sceneNotes} onSceneNotesChange={setSceneNotes} />
                    </div>
                </div>

                {/* Right — Properties */}
                <div style={{ width: 290, borderLeft: "1px solid var(--border-subtle)", overflowY: "auto", flexShrink: 0, background: "var(--bg-deep)" }}>
                    <DetailPanel component={selectedComp} onChange={updateComponent} onDelete={deleteComponent} />
                </div>
            </div>

            {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
            {showCadImport && <CadImport onImport={handleCadImport} onClose={() => setShowCadImport(false)} />}
        </div>
    );
}
