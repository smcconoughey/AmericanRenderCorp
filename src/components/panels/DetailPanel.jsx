const inputStyle = {
    background: "var(--bg-deep)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-sm)",
    padding: "5px 8px",
    color: "var(--text-primary)",
    fontSize: 12,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
};

const labelStyle = {
    display: "flex", flexDirection: "column", gap: 4,
    fontSize: 11, color: "var(--text-muted)", fontWeight: 500,
    fontFamily: "var(--font-condensed)", textTransform: "uppercase", letterSpacing: 0.5,
};

const btnSmall = {
    padding: "3px 10px", fontSize: 11, background: "transparent",
    border: "1px solid var(--border-default)", color: "var(--text-secondary)",
    borderRadius: "var(--radius-sm)", cursor: "pointer", whiteSpace: "nowrap",
};

const MATERIAL_PRESETS = [
    "Custom", "Concrete (weathered)", "Concrete (new)", "Steel (painted)",
    "Steel (galvanized)", "Steel (rusted)", "Aluminum", "Shipping Container",
    "Wood (treated)", "Gravel", "Asphalt", "Grass", "Sand/Dirt",
];

export default function DetailPanel({ component, onChange, onDelete }) {
    if (!component) return (
        <div style={{
            padding: 24, color: "var(--text-ghost)", fontSize: 13, textAlign: "center",
            marginTop: 60, lineHeight: 1.8
        }}>
            <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.3, color: "var(--text-ghost)" }}>---</div>
            Select a component to<br />edit its properties
        </div>
    );

    const update = (key, val) => onChange(component.id, { ...component, [key]: val });

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        Promise.all(files.map(file => new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.readAsDataURL(file);
        }))).then(results => {
            update("refImages", [...(component.refImages || []), ...results]);
        });
    };

    const removeImage = (index) => {
        const imgs = [...(component.refImages || [])];
        imgs.splice(index, 1);
        update("refImages", imgs);
    };

    return (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
                    Properties
                </span>
                <button onClick={() => onDelete(component.id)} style={{ ...btnSmall, color: "var(--error)", borderColor: "rgba(197,48,48,0.3)", fontFamily: "var(--font-condensed)", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Delete
                </button>
            </div>

            {/* Name */}
            <label style={labelStyle}>
                Name
                <input value={component.name} onChange={e => update("name", e.target.value)} style={inputStyle} />
            </label>

            {/* Real-world size badge — ALL IN FEET */}
            <div style={{
                background: "var(--accent-light)", border: "1px solid var(--accent)",
                borderRadius: "var(--radius-md)", padding: "8px 10px",
                textAlign: "center", fontFamily: "var(--font-mono)",
            }}>
                <div style={{ fontSize: 14, color: "var(--accent)", fontWeight: 600, letterSpacing: 0.5 }}>
                    {component.width}' x {component.length}' x {component.height}'
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    width x length x height (feet)
                </div>
            </div>

            {/* Dimensions in feet */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <label style={labelStyle}>
                    Width (ft)
                    <input type="number" step="0.5" value={component.width} onChange={e => update("width", +e.target.value)} style={inputStyle} />
                </label>
                <label style={labelStyle}>
                    Length (ft)
                    <input type="number" step="0.5" value={component.length} onChange={e => update("length", +e.target.value)} style={inputStyle} />
                </label>
                <label style={labelStyle}>
                    Height (ft)
                    <input type="number" step="0.5" value={component.height} onChange={e => update("height", +e.target.value)} style={inputStyle} />
                </label>
            </div>

            {/* Position in feet */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <label style={labelStyle}>
                    X (ft)
                    <input type="number" step="0.5" value={component.x} onChange={e => update("x", +e.target.value)} style={inputStyle} />
                </label>
                <label style={labelStyle}>
                    Y (ft)
                    <input type="number" step="0.5" value={component.y} onChange={e => update("y", +e.target.value)} style={inputStyle} />
                </label>
                <label style={labelStyle}>
                    Z-Layer
                    <input type="number" value={component.z} onChange={e => update("z", +e.target.value)} style={inputStyle} />
                </label>
            </div>

            {/* Color */}
            <label style={labelStyle}>
                Color
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={component.color} onChange={e => update("color", e.target.value)}
                        style={{ width: 32, height: 24, border: "none", background: "none", cursor: "pointer" }} />
                    <span style={{ fontSize: 11, color: "var(--text-ghost)", fontFamily: "var(--font-mono)" }}>{component.color}</span>
                </div>
            </label>

            {/* Material */}
            <label style={labelStyle}>
                Material Preset
                <select value={component.material || "Custom"} onChange={e => update("material", e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}>
                    {MATERIAL_PRESETS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </label>

            {/* Lock */}
            <label style={{ ...labelStyle, flexDirection: "row", gap: 8, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={component.locked} onChange={e => update("locked", e.target.checked)} style={{ accentColor: "var(--accent)" }} />
                Lock position
            </label>

            {/* Reference Images */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
                        Reference Images
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>{component.refImages?.length || 0}</span>
                </div>

                {component.refImages?.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                        {component.refImages.map((img, i) => (
                            <div key={i} style={{ position: "relative", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                                <img src={img} alt={`Ref ${i + 1}`} style={{ width: "100%", display: "block", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)" }} />
                                <button onClick={() => removeImage(i)} style={{ ...btnSmall, position: "absolute", top: 4, right: 4, background: "rgba(255,255,255,0.9)", padding: "2px 6px", fontSize: 10 }}>x</button>
                            </div>
                        ))}
                    </div>
                )}

                <label style={{
                    display: "flex", alignItems: "center", justifyContent: "center", height: 60,
                    border: "1px dashed var(--border-default)", borderRadius: "var(--radius-sm)",
                    cursor: "pointer", fontSize: 11, color: "var(--text-ghost)",
                }}>
                    + Add reference image(s)
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: "none" }} />
                </label>
            </div>

            {/* Rendering Notes */}
            <label style={labelStyle}>
                Rendering Notes
                <textarea value={component.notes} onChange={e => update("notes", e.target.value)} rows={4} placeholder="Describe materials, textures, specific details for this component..."
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
            </label>
        </div>
    );
}
