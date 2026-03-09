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
    transition: "border-color var(--transition-fast)",
};

const labelStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 11,
    color: "var(--text-muted)",
    fontWeight: 500,
};

const btnSmall = {
    padding: "3px 10px", fontSize: 11, background: "transparent",
    border: "1px solid var(--border-default)", color: "var(--text-secondary)",
    borderRadius: "var(--radius-sm)", cursor: "pointer", whiteSpace: "nowrap",
};

const MATERIAL_PRESETS = [
    "Custom", "Concrete (weathered)", "Steel (painted)", "Steel (galvanized)",
    "Aluminum", "Shipping Container", "Wood (treated)",
    "Gravel", "Asphalt", "Grass", "Sand/Dirt",
];

export default function DetailPanel({ component, onChange, onDelete, scaleSetting }) {
    if (!component) return (
        <div style={{
            padding: 24, color: "var(--text-ghost)", fontSize: 13, textAlign: "center",
            marginTop: 60, lineHeight: 1.8
        }}>
            <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>⬡</div>
            Select a component to<br />edit its properties
        </div>
    );

    const update = (key, val) => onChange(component.id, { ...component, [key]: val });

    const parseScale = () => {
        const match = scaleSetting?.match(/1(ft|m)\s*=\s*(\d+)px/);
        if (!match) return { unit: "ft", pxPerUnit: 20 };
        return { unit: match[1], pxPerUnit: parseInt(match[2]) };
    };

    const { unit, pxPerUnit } = parseScale();
    const realW = (component.w / pxPerUnit).toFixed(1);
    const realH = (component.h / pxPerUnit).toFixed(1);

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const readers = files.map(file => {
            return new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target.result);
                reader.readAsDataURL(file);
            });
        });

        Promise.all(readers).then(results => {
            const existing = component.refImages || [];
            update("refImages", [...existing, ...results]);
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
                <span style={{
                    fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5,
                    textTransform: "uppercase", fontWeight: 600
                }}>Properties</span>
                <button
                    onClick={() => onDelete(component.id)}
                    style={{ ...btnSmall, color: "var(--error)", borderColor: "rgba(239,68,68,0.3)" }}
                >
                    Delete
                </button>
            </div>

            {/* Name */}
            <label style={labelStyle}>
                Name
                <input value={component.name} onChange={e => update("name", e.target.value)} style={inputStyle} />
            </label>

            {/* Real-world dimensions badge */}
            <div style={{
                background: "var(--accent-glow)", border: "1px solid var(--accent-dim)",
                borderRadius: "var(--radius-md)", padding: "6px 10px",
                display: "flex", justifyContent: "center", gap: 12,
                fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent)",
            }}>
                <span>{realW} × {realH} × {component.depth}{unit}</span>
            </div>

            {/* Position & Size grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <label style={labelStyle}>
                    X (px)
                    <input type="number" value={component.x} onChange={e => update("x", +e.target.value)} style={inputStyle} />
                </label>
                <label style={labelStyle}>
                    Y (px)
                    <input type="number" value={component.y} onChange={e => update("y", +e.target.value)} style={inputStyle} />
                </label>
                <label style={labelStyle}>
                    Width (px)
                    <input type="number" value={component.w} onChange={e => update("w", +e.target.value)} style={inputStyle} />
                </label>
                <label style={labelStyle}>
                    Height (px)
                    <input type="number" value={component.h} onChange={e => update("h", +e.target.value)} style={inputStyle} />
                </label>
                <label style={labelStyle}>
                    Z-Level
                    <input type="number" value={component.z} onChange={e => update("z", +e.target.value)} style={inputStyle} />
                </label>
                <label style={labelStyle}>
                    Real Depth ({unit})
                    <input type="number" value={component.depth} onChange={e => update("depth", +e.target.value)} style={inputStyle} />
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

            {/* Material preset */}
            <label style={labelStyle}>
                Material Preset
                <select
                    value={component.material || "Custom"}
                    onChange={e => update("material", e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}
                >
                    {MATERIAL_PRESETS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </label>

            {/* Locked */}
            <label style={{ ...labelStyle, flexDirection: "row", gap: 8, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={component.locked} onChange={e => update("locked", e.target.checked)}
                    style={{ accentColor: "var(--accent)" }} />
                Lock position
            </label>

            {/* Reference Images */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
                        Reference Images
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>
                        {component.refImages?.length || 0}
                    </span>
                </div>

                {component.refImages?.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                        {component.refImages.map((img, i) => (
                            <div key={i} style={{ position: "relative", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                                <img src={img} alt={`Ref ${i + 1}`} style={{
                                    width: "100%", display: "block",
                                    border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)"
                                }} />
                                <button
                                    onClick={() => removeImage(i)}
                                    style={{
                                        ...btnSmall, position: "absolute", top: 4, right: 4,
                                        background: "var(--bg-deepest)", padding: "2px 6px", fontSize: 10,
                                        backdropFilter: "blur(4px)",
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <label style={{
                    display: "flex", alignItems: "center", justifyContent: "center", height: 60,
                    border: "1px dashed var(--border-default)", borderRadius: "var(--radius-sm)",
                    cursor: "pointer", fontSize: 11, color: "var(--text-ghost)",
                    transition: "border-color var(--transition-fast), background var(--transition-fast)",
                }}>
                    + Add reference image(s)
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: "none" }} />
                </label>
            </div>

            {/* Rendering Notes */}
            <label style={labelStyle}>
                Rendering Notes
                <textarea
                    value={component.notes}
                    onChange={e => update("notes", e.target.value)}
                    rows={4}
                    placeholder="Describe materials, textures, specific details for this component..."
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                />
            </label>
        </div>
    );
}
