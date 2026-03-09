import { useState, useRef, useCallback, useEffect } from "react";

const GRID_SIZE = 40;
const SCALE_OPTIONS = ["1ft = 10px", "1ft = 20px", "1ft = 40px", "1m = 10px", "1m = 20px", "1m = 40px"];

const DEFAULT_COMPONENTS = [
  { id: "c1", name: "Concrete Pad", x: 200, y: 200, w: 400, h: 300, z: 0, depth: 0.5, color: "#7a7a7a", notes: "Poured concrete foundation, weathered finish", refImage: null, locked: false },
  { id: "c2", name: "Vertical Test Stand", x: 350, y: 280, w: 60, h: 60, z: 0, depth: 25, color: "#c4c4c4", notes: "Steel frame tower with launch rail, painted white", refImage: null, locked: false },
  { id: "c3", name: "Test Control Container", x: 140, y: 220, w: 100, h: 50, z: 0, depth: 8, color: "#5a8f5a", notes: "Green shipping container, houses test control electronics", refImage: null, locked: false },
  { id: "c4", name: "Conex Box Test Stand", x: 480, y: 240, w: 100, h: 50, z: 0, depth: 8, color: "#6a8fa0", notes: "Blue shipping container with horizontal test stand inside", refImage: null, locked: false },
  { id: "c5", name: "Generator", x: 120, y: 300, w: 40, h: 30, z: 0, depth: 4, color: "#555", notes: "Portable diesel generator", refImage: null, locked: false },
  { id: "c6", name: "Gravel Down-range", x: 350, y: 420, w: 300, h: 80, z: 0, depth: 0.3, color: "#b0a890", notes: "Compacted gravel area extending behind test stand", refImage: null, locked: false },
];

let idCounter = 10;
const uid = () => `c${++idCounter}`;

function TopDownCanvas({ components, selected, onSelect, onMove, viewOffset, zoom, onPan, onZoom }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(viewOffset.x, viewOffset.y);
    ctx.scale(zoom, zoom);

    const gridStep = GRID_SIZE;
    const startX = Math.floor(-viewOffset.x / zoom / gridStep) * gridStep - gridStep;
    const startY = Math.floor(-viewOffset.y / zoom / gridStep) * gridStep - gridStep;
    const endX = startX + W / zoom + gridStep * 2;
    const endY = startY + H / zoom + gridStep * 2;

    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 0.5 / zoom;
    for (let x = startX; x < endX; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = startY; y < endY; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    ctx.strokeStyle = "#2a2a4e";
    ctx.lineWidth = 1 / zoom;
    for (let x = startX; x < endX; x += gridStep * 5) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = startY; y < endY; y += gridStep * 5) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    const sorted = [...components].sort((a, b) => a.z - b.z);
    for (const comp of sorted) {
      const isSelected = selected === comp.id;
      ctx.fillStyle = comp.color + "88";
      ctx.strokeStyle = isSelected ? "#ff6b35" : comp.color;
      ctx.lineWidth = isSelected ? 2.5 / zoom : 1.2 / zoom;

      ctx.fillRect(comp.x, comp.y, comp.w, comp.h);
      ctx.strokeRect(comp.x, comp.y, comp.w, comp.h);

      if (isSelected) {
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.strokeStyle = "#ff6b3566";
        ctx.strokeRect(comp.x - 3 / zoom, comp.y - 3 / zoom, comp.w + 6 / zoom, comp.h + 6 / zoom);
        ctx.setLineDash([]);
      }

      ctx.fillStyle = "#e0e0e0";
      const fontSize = Math.max(9, Math.min(12, comp.w / 8));
      ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = comp.name.length > 18 ? comp.name.slice(0, 16) + "…" : comp.name;
      ctx.fillText(label, comp.x + comp.w / 2, comp.y + comp.h / 2);
    }

    ctx.restore();

    ctx.fillStyle = "#888";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillText(`zoom: ${(zoom * 100).toFixed(0)}%  |  grid: ${GRID_SIZE}px`, 10, H - 10);
  }, [components, selected, viewOffset, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        draw();
      }
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
      if (wx >= c.x && wx <= c.x + c.w && wy >= c.y && wy <= c.y + c.h) return c.id;
    }
    return null;
  };

  const onMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);
    const hit = hitTest(world.x, world.y);

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      panRef.current = { startX: e.clientX, startY: e.clientY, ox: viewOffset.x, oy: viewOffset.y };
      return;
    }

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

  const onMouseUp = () => { dragRef.current = null; panRef.current = null; };

  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    onZoom(Math.max(0.2, Math.min(5, zoom * delta)));
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", cursor: "crosshair", display: "block" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    />
  );
}

function ComponentList({ components, selected, onSelect, onAdd, onDelete, onReorder }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Scene Graph</span>
        <button onClick={onAdd} style={btnSmall}>+ Add</button>
      </div>
      {components.map((c, i) => (
        <div
          key={c.id}
          onClick={() => onSelect(c.id)}
          style={{
            padding: "6px 8px",
            background: selected === c.id ? "#1a1a3a" : "transparent",
            borderLeft: selected === c.id ? "2px solid #ff6b35" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            borderRadius: 2,
            transition: "background 0.15s",
          }}
        >
          <div style={{ width: 10, height: 10, background: c.color, borderRadius: 2, flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
          {c.locked && <span style={{ fontSize: 10, color: "#666" }}>🔒</span>}
          {c.refImage && <span style={{ fontSize: 10, color: "#ff6b35" }}>📷</span>}
        </div>
      ))}
    </div>
  );
}

function DetailPanel({ component, onChange, onDelete }) {
  if (!component) return (
    <div style={{ padding: 16, color: "#555", fontSize: 13, textAlign: "center", marginTop: 40 }}>
      Select a component to edit its properties
    </div>
  );

  const update = (key, val) => onChange(component.id, { ...component, [key]: val });

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => update("refImage", ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Properties</span>
        <button onClick={() => onDelete(component.id)} style={{ ...btnSmall, color: "#e74c3c", borderColor: "#e74c3c44" }}>Delete</button>
      </div>

      <label style={labelStyle}>
        Name
        <input value={component.name} onChange={e => update("name", e.target.value)} style={inputStyle} />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={labelStyle}>X<input type="number" value={component.x} onChange={e => update("x", +e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Y<input type="number" value={component.y} onChange={e => update("y", +e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Width<input type="number" value={component.w} onChange={e => update("w", +e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Height<input type="number" value={component.h} onChange={e => update("h", +e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Z-Level<input type="number" value={component.z} onChange={e => update("z", +e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Real Depth (ft)<input type="number" value={component.depth} onChange={e => update("depth", +e.target.value)} style={inputStyle} /></label>
      </div>

      <label style={labelStyle}>
        Color
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="color" value={component.color} onChange={e => update("color", e.target.value)} style={{ width: 32, height: 24, border: "none", background: "none", cursor: "pointer" }} />
          <span style={{ fontSize: 11, color: "#666" }}>{component.color}</span>
        </div>
      </label>

      <label style={{ ...labelStyle, display: "flex", flexDirection: "row", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={component.locked} onChange={e => update("locked", e.target.checked)} />
        Lock position
      </label>

      <div style={{ borderTop: "1px solid #1a1a2e", paddingTop: 12 }}>
        <span style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Reference Image</span>
        {component.refImage ? (
          <div style={{ position: "relative" }}>
            <img src={component.refImage} style={{ width: "100%", borderRadius: 4, border: "1px solid #2a2a4e" }} />
            <button onClick={() => update("refImage", null)} style={{ ...btnSmall, position: "absolute", top: 4, right: 4, background: "#0d0d1aee" }}>✕</button>
          </div>
        ) : (
          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80, border: "1px dashed #2a2a4e", borderRadius: 4, cursor: "pointer", fontSize: 12, color: "#555" }}>
            Drop or click to add reference
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
          </label>
        )}
      </div>

      <label style={labelStyle}>
        Rendering Notes
        <textarea
          value={component.notes}
          onChange={e => update("notes", e.target.value)}
          rows={4}
          placeholder="Describe materials, textures, lighting, specific details for this component..."
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </label>
    </div>
  );
}

function PromptGenerator({ components, sceneNotes, onSceneNotesChange }) {
  const [generated, setGenerated] = useState("");
  const [mode, setMode] = useState("composite");
  const [loading, setLoading] = useState(false);

  const generateStructuredPrompt = () => {
    const compDescs = components.map((c, i) => {
      let desc = `[${i + 1}] "${c.name}" — position: (${c.x}, ${c.y}), footprint: ${c.w}×${c.h}, height: ${c.depth}ft`;
      if (c.notes) desc += `\n    Details: ${c.notes}`;
      if (c.refImage) desc += `\n    ⚠ Has reference image attached`;
      return desc;
    }).join("\n\n");

    if (mode === "composite") {
      setGenerated(
`ARCHITECTURAL RENDER — COMPOSITE PIPELINE
==========================================

SCENE OVERVIEW:
${sceneNotes || "Outdoor test facility, clear day, photorealistic rendering"}

CAMERA: Aerial perspective, 30-45° angle, looking north
LIGHTING: Natural daylight, soft shadows, golden hour optional
STYLE: Photorealistic architectural visualization

COMPONENT MANIFEST (render order, back to front):
${compDescs}

SCALE CONSTRAINTS:
- All components must maintain relative proportions as defined
- Grid unit = 1ft in real world
- Camera distance should show full scene with ~10% margin

COMPOSITING PIPELINE:
1. Render background/environment (sky, vegetation, terrain)
2. Render ground plane with gravel/concrete textures
3. For each component (sorted by Z, then Y):
   a. Generate component at correct scale relative to scene
   b. Match lighting direction and shadow angles
   c. Apply component-specific material/texture notes
4. Final composite: color grade, ambient occlusion, atmospheric haze
`);
    } else {
      const perComp = components.map((c, i) => (
`--- COMPONENT ${i + 1}: "${c.name}" ---
Render this component ISOLATED on transparent background.
Dimensions: ${c.w}×${c.h} footprint, ${c.depth}ft tall
Viewing angle: Match main scene camera (aerial 30-45°)
${c.notes ? `Details: ${c.notes}` : ""}
${c.refImage ? "Reference image provided — match this closely." : ""}
Lighting: Match scene lighting direction (sun from upper-left)
`)).join("\n");

      setGenerated(
`ARCHITECTURAL RENDER — PER-COMPONENT PIPELINE
==============================================

This workflow renders each component separately, then composites.
Each component prompt below should be sent individually.

SCENE CAMERA REFERENCE:
- Aerial perspective, 30-45° elevation
- Looking approximately north
- Scene width: ~${Math.max(...components.map(c => c.x + c.w))}px / height: ~${Math.max(...components.map(c => c.y + c.h))}px

${perComp}

FINAL COMPOSITE INSTRUCTIONS:
1. Start with environment/background render
2. Place each component render at its (x, y) position
3. Scale each to match footprint dimensions
4. Add unified shadow pass
5. Color grade for consistency
`);
    }
  };

  const generateWithAI = async () => {
    setLoading(true);
    try {
      const compList = components.map(c =>
        `"${c.name}": ${c.w}×${c.h} footprint, ${c.depth}ft tall, at (${c.x},${c.y}). Notes: ${c.notes || "none"}`
      ).join("\n");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are an expert architectural visualization prompt engineer. Given this scene graph of a rocket test site, generate an optimized prompt for an AI image generator (like Gemini Imagen) that will produce a photorealistic architectural render while maintaining accurate spatial relationships and scale.

Scene description: ${sceneNotes || "Outdoor rocket propulsion test facility"}

Components:
${compList}

Generate a single, detailed prompt optimized for Gemini/Imagen that:
1. Describes the scene from an aerial perspective
2. Specifies exact spatial relationships between components
3. Includes material/texture details for each component
4. Specifies photorealistic lighting and atmosphere
5. Emphasizes scale accuracy

Output ONLY the prompt text, no explanation.`
          }],
        }),
      });
      const data = await response.json();
      const text = data.content?.map(b => b.text || "").join("") || "Error generating prompt";
      setGenerated(text);
    } catch (err) {
      setGenerated("Error: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #1a1a2e", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Prompt Generator</span>
        <div style={{ flex: 1 }} />
        <select value={mode} onChange={e => setMode(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "2px 6px" }}>
          <option value="composite">Composite Pipeline</option>
          <option value="percomp">Per-Component</option>
        </select>
        <button onClick={generateStructuredPrompt} style={btnSmall}>Generate Structured</button>
        <button onClick={generateWithAI} disabled={loading} style={{ ...btnSmall, background: loading ? "#333" : "#ff6b3522", color: "#ff6b35", borderColor: "#ff6b3544" }}>
          {loading ? "Generating…" : "AI Optimize ✦"}
        </button>
      </div>
      <div style={{ padding: 12, flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={labelStyle}>
          Scene Notes
          <textarea
            value={sceneNotes}
            onChange={e => onSceneNotesChange(e.target.value)}
            rows={2}
            placeholder="Overall scene description, time of day, weather, environment..."
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
          />
        </label>
        <div style={{ flex: 1, position: "relative" }}>
          <textarea
            value={generated}
            onChange={e => setGenerated(e.target.value)}
            placeholder="Generated prompts will appear here. You can edit them before copying."
            style={{ ...inputStyle, width: "100%", height: "100%", resize: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.5, boxSizing: "border-box" }}
          />
          {generated && (
            <button
              onClick={() => { navigator.clipboard.writeText(generated); }}
              style={{ ...btnSmall, position: "absolute", top: 8, right: 8, background: "#0d0d1aee" }}
            >
              Copy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReferenceBoard({ components }) {
  const withRefs = components.filter(c => c.refImage);
  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", height: "100%" }}>
      <span style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Reference Board</span>
      {withRefs.length === 0 ? (
        <div style={{ color: "#555", fontSize: 13, textAlign: "center", marginTop: 40 }}>
          No reference images yet. Add them in the component properties panel.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {withRefs.map(c => (
            <div key={c.id} style={{ borderRadius: 4, overflow: "hidden", border: "1px solid #2a2a4e" }}>
              <img src={c.refImage} style={{ width: "100%", display: "block" }} />
              <div style={{ padding: "4px 6px", fontSize: 10, color: "#aaa", background: "#0d0d1a" }}>{c.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportPanel({ components, sceneNotes }) {
  const exportJSON = () => {
    const data = {
      version: "1.0",
      scene: { notes: sceneNotes },
      components: components.map(({ refImage, ...rest }) => ({
        ...rest,
        hasRefImage: !!refImage,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "scene-graph.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportSVG = () => {
    const maxX = Math.max(...components.map(c => c.x + c.w)) + 40;
    const maxY = Math.max(...components.map(c => c.y + c.h)) + 40;
    const rects = components.map(c =>
      `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${c.color}44" stroke="${c.color}" stroke-width="1.5"/>
  <text x="${c.x + c.w / 2}" y="${c.y + c.h / 2}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="10" font-family="monospace">${c.name}</text>`
    ).join("\n  ");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}">
  <rect width="100%" height="100%" fill="#0d0d1a"/>
  ${rects}
</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "scene-layout.svg"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 11, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>Export</span>
      <button onClick={exportJSON} style={{ ...btnSmall, width: "100%" }}>Export Scene Graph (JSON)</button>
      <button onClick={exportSVG} style={{ ...btnSmall, width: "100%" }}>Export Layout (SVG)</button>
      <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>
        The JSON export contains all component data, positions, and rendering notes.
        Import this into your rendering pipeline or use as structured context for AI prompts.
      </div>
    </div>
  );
}

const inputStyle = {
  background: "#0a0a1a",
  border: "1px solid #2a2a4e",
  borderRadius: 3,
  padding: "4px 8px",
  color: "#e0e0e0",
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11,
  color: "#888",
};

const btnSmall = {
  padding: "3px 10px",
  fontSize: 11,
  background: "transparent",
  border: "1px solid #2a2a4e",
  color: "#ccc",
  borderRadius: 3,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export default function SceneComposer() {
  const [components, setComponents] = useState(DEFAULT_COMPONENTS);
  const [selected, setSelected] = useState(null);
  const [viewOffset, setViewOffset] = useState({ x: 50, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [rightTab, setRightTab] = useState("properties");
  const [bottomTab, setBottomTab] = useState("prompts");
  const [sceneNotes, setSceneNotes] = useState("Outdoor rocket propulsion test facility in Central Florida. Flat sandy terrain with scrub pine vegetation. Clear sky, midday sun. Photorealistic architectural visualization quality.");
  const [bottomHeight, setBottomHeight] = useState(280);
  const resizeRef = useRef(null);

  const selectedComp = components.find(c => c.id === selected);

  const updateComponent = (id, updated) => {
    setComponents(prev => prev.map(c => c.id === id ? updated : c));
  };

  const moveComponent = (id, x, y) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, x, y } : c));
  };

  const addComponent = () => {
    const newComp = {
      id: uid(), name: "New Component", x: 300, y: 300, w: 80, h: 60,
      z: 0, depth: 8, color: "#" + Math.floor(Math.random() * 0xaaaaaa + 0x555555).toString(16),
      notes: "", refImage: null, locked: false,
    };
    setComponents(prev => [...prev, newComp]);
    setSelected(newComp.id);
  };

  const deleteComponent = (id) => {
    setComponents(prev => prev.filter(c => c.id !== id));
    if (selected === id) setSelected(null);
  };

  const onResizeStart = (e) => {
    const startY = e.clientY;
    const startH = bottomHeight;
    const onMove = (ev) => {
      const delta = startY - ev.clientY;
      setBottomHeight(Math.max(120, Math.min(500, startH + delta)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const tabBtn = (label, value, current, setter) => (
    <button
      onClick={() => setter(value)}
      style={{
        padding: "4px 12px", fontSize: 11, background: current === value ? "#1a1a3a" : "transparent",
        border: "none", borderBottom: current === value ? "2px solid #ff6b35" : "2px solid transparent",
        color: current === value ? "#ff6b35" : "#888", cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      width: "100vw", height: "100vh", background: "#0d0d1a", color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />

      <div style={{
        height: 36, background: "#080814", borderBottom: "1px solid #1a1a2e",
        display: "flex", alignItems: "center", padding: "0 16px", gap: 16, flexShrink: 0,
      }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: "#ff6b35", letterSpacing: 1 }}>
          ◆ SCENE COMPOSER
        </span>
        <span style={{ fontSize: 11, color: "#555" }}>CAD → Architectural Render Pipeline</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>
          {components.length} components | {components.filter(c => c.refImage).length} refs
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ width: 200, borderRight: "1px solid #1a1a2e", overflowY: "auto", padding: 8, flexShrink: 0 }}>
          <ComponentList
            components={components} selected={selected} onSelect={setSelected}
            onAdd={addComponent} onDelete={deleteComponent}
          />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <TopDownCanvas
              components={components} selected={selected} onSelect={setSelected}
              onMove={moveComponent} viewOffset={viewOffset} zoom={zoom}
              onPan={setViewOffset} onZoom={setZoom}
            />
            <div style={{
              position: "absolute", top: 8, left: 8, background: "#080814cc", borderRadius: 4,
              padding: "4px 8px", fontSize: 10, color: "#666", fontFamily: "'JetBrains Mono', monospace",
              backdropFilter: "blur(8px)",
            }}>
              Drag to move • Scroll to zoom • Click empty space to pan
            </div>
          </div>

          <div
            onMouseDown={onResizeStart}
            style={{ height: 4, background: "#1a1a2e", cursor: "ns-resize", flexShrink: 0 }}
          />

          <div style={{ height: bottomHeight, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ display: "flex", borderBottom: "1px solid #1a1a2e", flexShrink: 0 }}>
              {tabBtn("Prompt Generator", "prompts", bottomTab, setBottomTab)}
              {tabBtn("Reference Board", "refs", bottomTab, setBottomTab)}
              {tabBtn("Export", "export", bottomTab, setBottomTab)}
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              {bottomTab === "prompts" && <PromptGenerator components={components} sceneNotes={sceneNotes} onSceneNotesChange={setSceneNotes} />}
              {bottomTab === "refs" && <ReferenceBoard components={components} />}
              {bottomTab === "export" && <ExportPanel components={components} sceneNotes={sceneNotes} />}
            </div>
          </div>
        </div>

        <div style={{ width: 260, borderLeft: "1px solid #1a1a2e", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ display: "flex", borderBottom: "1px solid #1a1a2e" }}>
            {tabBtn("Properties", "properties", rightTab, setRightTab)}
          </div>
          <DetailPanel component={selectedComp} onChange={updateComponent} onDelete={deleteComponent} />
        </div>
      </div>
    </div>
  );
}
