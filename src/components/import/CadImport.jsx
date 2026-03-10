import { useState, useRef } from "react";
import { parseSTEP, parseOBJ } from "../../services/cadParser.js";

/**
 * CAD Import — auto-imports geometry from:
 * 1. Fusion 360 JSON export (from our fusion360_export.py script)
 * 2. STEP/STP files (parses body names + bounding boxes)
 * 3. OBJ files (parses group names + bounding boxes)
 * 
 * No manual dimension entry needed — everything comes from the CAD file.
 */

const inputStyle = {
    background: "var(--bg-deep)", border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-sm)", padding: "5px 8px", color: "var(--text-primary)",
    fontSize: 12, width: "100%", boxSizing: "border-box", outline: "none",
};

const btnSmall = {
    padding: "4px 12px", fontSize: 11, background: "transparent",
    border: "1px solid var(--border-default)", color: "var(--text-secondary)",
    borderRadius: "var(--radius-sm)", cursor: "pointer",
};

const defaultColors = [
    "#7a7a7a", "#c4c4c4", "#5a8f5a", "#6a8fa0", "#4a4a5a",
    "#b0a890", "#555555", "#8a8a9a", "#7a5a4a", "#4a6a5a",
    "#9a6a8a", "#6a9a5a", "#5a5a9a",
];

function guessPresetMaterial(name) {
    const n = name.toLowerCase();
    if (n.includes("concrete")) return "Concrete (weathered)";
    if (n.includes("steel") || n.includes("blast")) return "Steel (painted)";
    if (n.includes("gravel")) return "Gravel";
    if (n.includes("shipping") || n.includes("container") || n.includes("conex")) return "Shipping Container";
    if (n.includes("generator")) return "Steel (painted)";
    if (n.includes("aluminum") || n.includes("aluminium")) return "Aluminum";
    if (n.includes("wood")) return "Wood (treated)";
    return "Custom";
}


export default function CadImport({ onImport, onClose }) {
    const [step, setStep] = useState("upload"); // upload | parsed | review
    const [bodies, setBodies] = useState([]);
    const [cadImage, setCadImage] = useState(null);
    const [fileInfo, setFileInfo] = useState(null);
    const [parseError, setParseError] = useState(null);
    const [replaceScene, setReplaceScene] = useState(false);

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setParseError(null);

        const ext = file.name.split(".").pop().toLowerCase();
        const reader = new FileReader();

        reader.onload = (ev) => {
            try {
                let parsed = [];

                if (ext === "json") {
                    // Fusion 360 export JSON
                    const data = JSON.parse(ev.target.result);
                    if (data.source === "fusion360" || data.components) {
                        parsed = (data.components || []).map(c => {
                            // Fusion 360 is Y-up: c.height = Y extent (vertical), c.length = Z extent (depth).
                            const width = c.width || 10;
                            const height = c.height || 8;
                            const length = c.length || 8;

                            return {
                                name: c.name,
                                width, length, height,
                                x: c.x || 0,
                                y: c.y || 0,
                                material: c.material ? guessPresetMaterial(c.material) : guessPresetMaterial(c.name),
                                source: "fusion360",
                                volume: c.volume_ft3,
                                cadComponent: c.component,
                            };
                        });
                        setFileInfo({
                            type: "Fusion 360 Export",
                            name: data.designName || file.name,
                            units: data.units || "feet",
                            bodyCount: parsed.length,
                        });
                    } else {
                        // Try as generic scene JSON
                        parsed = (data.components || []).map(c => ({
                            name: c.name,
                            width: c.width || c.w || 10,
                            length: c.length || c.h || 8,
                            height: c.height || c.depth || 8,
                            x: c.x || 0,
                            y: c.y || 0,
                            material: guessPresetMaterial(c.name),
                            source: "json",
                        }));
                        setFileInfo({ type: "Scene JSON", name: file.name, bodyCount: parsed.length });
                    }
                } else if (ext === "step" || ext === "stp") {
                    parsed = parseSTEP(ev.target.result);
                    setFileInfo({ type: "STEP File", name: file.name, bodyCount: parsed.length });
                } else if (ext === "obj") {
                    parsed = parseOBJ(ev.target.result);
                    setFileInfo({ type: "OBJ File", name: file.name, bodyCount: parsed.length });
                } else if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") {
                    // Screenshot — just store for reference, go to manual fallback
                    setCadImage(ev.target.result);
                    setStep("screenshot");
                    return;
                } else {
                    setParseError(`Unsupported file format: .${ext}. Use .json (Fusion 360 export), .step/.stp, .obj, or a screenshot.`);
                    return;
                }

                if (parsed.length === 0) {
                    setParseError("No bodies/components found in the file. Try exporting from Fusion 360 using the provided script.");
                    return;
                }

                // Assign colors and finalize
                const withColors = parsed.map((b, i) => ({
                    ...b,
                    color: defaultColors[i % defaultColors.length],
                    include: true,
                    notes: "",
                }));

                setBodies(withColors);
                setStep("parsed");
            } catch (err) {
                setParseError(`Failed to parse file: ${err.message}`);
            }
        };

        if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    };

    // Screenshot fallback — manual body names
    const [bulkText, setBulkText] = useState("");
    const parseBulkNames = () => {
        const names = bulkText.split("\n").map(s => s.trim()).filter(s => s.length > 0 && !s.toLowerCase().startsWith("sketch"));
        const newBodies = names.map((name, i) => ({
            name, width: 10, length: 8, height: 8,
            x: (i % 4) * 25, y: Math.floor(i / 4) * 20,
            color: defaultColors[i % defaultColors.length],
            material: guessPresetMaterial(name),
            include: true, notes: "", needsManualDims: true,
        }));
        setBodies(newBodies);
        setStep("parsed");
        setFileInfo({ type: "Manual Entry", name: "Screenshot", bodyCount: newBodies.length });
    };

    const updateBody = (index, key, val) => {
        setBodies(prev => prev.map((b, i) => i === index ? { ...b, [key]: val } : b));
    };

    const handleImport = () => {
        const selected = bodies.filter(b => b.include).map(b => ({
            name: b.name,
            width: b.width,
            length: b.length,
            height: b.height,
            x: b.x,
            y: b.y,
            z: b.height > 1 ? 1 : 0,
            color: b.color,
            material: b.material,
            notes: b.notes,
            refImages: [],
            locked: false,
            visible: true,
        }));
        onImport(selected, replaceScene);
    };

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, backdropFilter: "blur(4px)",
        }}>
            <div style={{
                background: "var(--bg-surface)", border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)", width: 720, maxHeight: "88vh",
                overflow: "auto", boxShadow: "0 20px 80px rgba(0,0,0,0.15)",
            }}>
                {/* Header */}
                <div style={{
                    padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                    <div>
                        <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-condensed)", textTransform: "uppercase", letterSpacing: 1 }}>CAD Import</span>
                        <span style={{ fontSize: 11, color: "var(--text-ghost)", marginLeft: 12 }}>
                            {step === "upload" ? "Select file" : step === "screenshot" ? "Enter body names" : step === "parsed" ? "Review extracted data" : "Confirm import"}
                        </span>
                    </div>
                    <button onClick={onClose} style={{ ...btnSmall, padding: "2px 8px" }}>Close</button>
                </div>

                <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* STEP 1: Upload */}
                    {step === "upload" && (
                        <>
                            {/* Primary: File import */}
                            <div style={{
                                padding: 16, border: "2px solid var(--accent)", borderRadius: "var(--radius-md)",
                                background: "var(--accent-light)",
                            }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 6, fontFamily: "var(--font-condensed)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    Recommended: Fusion 360 Export Script
                                </div>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 10 }}>
                                    Run <code style={{ background: "var(--bg-deep)", padding: "1px 4px", borderRadius: 2, fontSize: 11 }}>fusion360_export.py</code> in
                                    Fusion 360 (Utilities → Scripts → Run). It exports a JSON with exact body names, dimensions, and positions in feet.
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-ghost)", lineHeight: 1.5 }}>
                                    The script is in your project folder: <code style={{ background: "var(--bg-deep)", padding: "1px 4px", borderRadius: 2, fontSize: 10 }}>AmericanRenderCorp/fusion360_export.py</code>
                                </div>
                            </div>

                            <label style={{
                                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                height: 140, border: "2px dashed var(--border-default)", borderRadius: "var(--radius-md)",
                                cursor: "pointer", transition: "border-color 0.2s",
                            }}>
                                <span style={{ fontSize: 16, marginBottom: 6, color: "var(--text-ghost)", fontFamily: "var(--font-condensed)", fontWeight: 600 }}>FILE</span>
                                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                    Drop or click to import CAD file
                                </span>
                                <span style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 4 }}>
                                    Supports: <strong>.json</strong> (Fusion 360 export) · <strong>.step/.stp</strong> · <strong>.obj</strong> · Screenshots
                                </span>
                                <input type="file" accept=".json,.step,.stp,.obj,.png,.jpg,.jpeg,.webp" onChange={handleFileUpload} style={{ display: "none" }} />
                            </label>

                            {parseError && (
                                <div style={{
                                    padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                                    borderRadius: "var(--radius-sm)", color: "var(--error)", fontSize: 12, lineHeight: 1.5,
                                }}>
                                    {parseError}
                                </div>
                            )}
                        </>
                    )}

                    {/* Screenshot fallback */}
                    {step === "screenshot" && (
                        <div style={{ display: "flex", gap: 16 }}>
                            {cadImage && (
                                <div style={{ flex: 1, maxWidth: 300 }}>
                                    <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>
                                        CAD Screenshot
                                    </div>
                                    <img src={cadImage} alt="CAD" style={{ width: "100%", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)" }} />
                                </div>
                            )}
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{
                                    padding: "8px 12px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
                                    borderRadius: "var(--radius-sm)", color: "var(--warning)", fontSize: 11, lineHeight: 1.5,
                                }}>
                                    ⚠ Screenshots require manual body names. For auto-import, export from Fusion 360 using the script instead.
                                </div>
                                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                                    Paste body names from the browser panel, one per line:
                                </div>
                                <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={10}
                                    placeholder={`Concrete rectangle\nConex Box Test Stand\nVertical Test Stand with Rocket\n...`}
                                    style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 12, resize: "vertical", lineHeight: 1.6 }} />
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button onClick={() => { setStep("upload"); setCadImage(null); }} style={btnSmall}>← Back</button>
                                    <button onClick={parseBulkNames} disabled={!bulkText.trim()} style={{
                                        ...btnSmall, flex: 1,
                                        background: bulkText.trim() ? "var(--accent-light)" : "transparent",
                                        color: bulkText.trim() ? "var(--accent)" : "var(--text-ghost)",
                                        borderColor: bulkText.trim() ? "var(--accent)" : "var(--border-default)",
                                    }}>
                                        Parse Names → (you'll need to set dimensions manually)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Parsed results */}
                    {step === "parsed" && (
                        <>
                            {/* File info badge */}
                            {fileInfo && (
                                <div style={{
                                    display: "flex", gap: 16, padding: "10px 14px", background: "var(--bg-deep)",
                                    borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)",
                                    fontSize: 12, alignItems: "center",
                                }}>
                                    <div>
                                        <span style={{ color: "var(--text-ghost)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Source</span>
                                        <div style={{ color: "var(--accent)", fontWeight: 600 }}>{fileInfo.type}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--text-ghost)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>File</span>
                                        <div style={{ color: "var(--text-primary)" }}>{fileInfo.name}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: "var(--text-ghost)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Bodies</span>
                                        <div style={{ color: "var(--success)", fontWeight: 600 }}>{fileInfo.bodyCount}</div>
                                    </div>
                                    {fileInfo.units && (
                                        <div>
                                            <span style={{ color: "var(--text-ghost)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Units</span>
                                            <div style={{ color: "var(--text-primary)" }}>{fileInfo.units}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Bodies table */}
                            <div style={{ maxHeight: 400, overflowY: "auto" }}>
                                <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid var(--border-default)", position: "sticky", top: 0, background: "var(--bg-surface)" }}>
                                            {["", "", "Body Name", "W (ft)", "L (ft)", "H (ft)", "X", "Y", "Material"].map(h => (
                                                <th key={h} style={{
                                                    padding: "6px 6px", textAlign: h === "Body Name" ? "left" : "center",
                                                    color: "var(--text-muted)", fontWeight: 600, fontSize: 9,
                                                    textTransform: "uppercase", letterSpacing: 0.5,
                                                }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bodies.map((body, i) => (
                                            <tr key={i} style={{
                                                borderBottom: "1px solid var(--border-subtle)",
                                                opacity: body.include ? 1 : 0.35,
                                                background: body.include ? "transparent" : "var(--bg-deep)",
                                            }}>
                                                <td style={{ padding: "4px 4px", textAlign: "center" }}>
                                                    <input type="checkbox" checked={body.include}
                                                        onChange={e => updateBody(i, "include", e.target.checked)}
                                                        style={{ accentColor: "var(--accent)" }} />
                                                </td>
                                                <td style={{ padding: "4px 4px", textAlign: "center" }}>
                                                    <input type="color" value={body.color} onChange={e => updateBody(i, "color", e.target.value)}
                                                        style={{ width: 18, height: 18, border: "none", background: "none", cursor: "pointer" }} />
                                                </td>
                                                <td style={{ padding: "4px 6px" }}>
                                                    <input value={body.name} onChange={e => updateBody(i, "name", e.target.value)}
                                                        style={{ ...inputStyle, fontSize: 11, padding: "2px 6px" }} />
                                                </td>
                                                <td style={{ padding: "4px 2px", textAlign: "center" }}>
                                                    <input type="number" step="0.5" value={body.width}
                                                        onChange={e => updateBody(i, "width", +e.target.value)}
                                                        style={{
                                                            ...inputStyle, width: 52, fontSize: 10, padding: "2px 4px", textAlign: "center",
                                                            fontFamily: "var(--font-mono)",
                                                            background: body.needsManualDims ? "rgba(251,191,36,0.1)" : "var(--bg-deep)",
                                                            borderColor: body.needsManualDims ? "rgba(251,191,36,0.3)" : "var(--border-default)",
                                                        }} />
                                                </td>
                                                <td style={{ padding: "4px 2px", textAlign: "center" }}>
                                                    <input type="number" step="0.5" value={body.length}
                                                        onChange={e => updateBody(i, "length", +e.target.value)}
                                                        style={{
                                                            ...inputStyle, width: 52, fontSize: 10, padding: "2px 4px", textAlign: "center",
                                                            fontFamily: "var(--font-mono)",
                                                            background: body.needsManualDims ? "rgba(251,191,36,0.1)" : "var(--bg-deep)",
                                                            borderColor: body.needsManualDims ? "rgba(251,191,36,0.3)" : "var(--border-default)",
                                                        }} />
                                                </td>
                                                <td style={{ padding: "4px 2px", textAlign: "center" }}>
                                                    <input type="number" step="0.5" value={body.height}
                                                        onChange={e => updateBody(i, "height", +e.target.value)}
                                                        style={{
                                                            ...inputStyle, width: 52, fontSize: 10, padding: "2px 4px", textAlign: "center",
                                                            fontFamily: "var(--font-mono)",
                                                            background: body.needsManualDims ? "rgba(251,191,36,0.1)" : "var(--bg-deep)",
                                                            borderColor: body.needsManualDims ? "rgba(251,191,36,0.3)" : "var(--border-default)",
                                                        }} />
                                                </td>
                                                <td style={{ padding: "4px 2px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-ghost)" }}>
                                                    {body.x?.toFixed(1)}
                                                </td>
                                                <td style={{ padding: "4px 2px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-ghost)" }}>
                                                    {body.y?.toFixed(1)}
                                                </td>
                                                <td style={{ padding: "4px 4px" }}>
                                                    <select value={body.material} onChange={e => updateBody(i, "material", e.target.value)}
                                                        style={{ ...inputStyle, fontSize: 9, padding: "1px 4px", width: 90, cursor: "pointer" }}>
                                                        {["Custom", "Concrete (weathered)", "Steel (painted)", "Steel (galvanized)",
                                                            "Shipping Container", "Gravel", "Aluminum", "Wood (treated)", "Sand/Dirt"
                                                        ].map(m => <option key={m} value={m}>{m}</option>)}
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Import options */}
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
                                    <input type="checkbox" checked={replaceScene} onChange={e => setReplaceScene(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
                                    Replace existing scene (uncheck to add to current)
                                </label>
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <button onClick={() => { setStep("upload"); setBodies([]); setFileInfo(null); }} style={btnSmall}>← Back</button>
                                <button onClick={handleImport} style={{
                                    ...btnSmall, padding: "8px 20px",
                                    background: "var(--accent-light)", color: "var(--accent)", borderColor: "var(--accent)",
                                    fontWeight: 600, fontFamily: "var(--font-condensed)", textTransform: "uppercase", letterSpacing: 0.5,
                                }}>
                                    Import {bodies.filter(b => b.include).length} Bodies
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
