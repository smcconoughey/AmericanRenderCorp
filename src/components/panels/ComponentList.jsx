import { useState } from "react";

const btnSmall = {
    padding: "3px 10px", fontSize: 11, background: "transparent",
    border: "1px solid var(--border-default)", color: "var(--text-secondary)",
    borderRadius: "var(--radius-sm)", cursor: "pointer", whiteSpace: "nowrap",
    transition: "all var(--transition-fast)",
};

export default function ComponentList({ components, selected, onSelect, onAdd, onDelete, onToggleVis }) {
    const [search, setSearch] = useState("");

    const filtered = search
        ? components.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
        : components;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 6, padding: "0 2px"
            }}>
                <span style={{
                    fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5,
                    textTransform: "uppercase", fontWeight: 600
                }}>
                    Scene Graph
                </span>
                <button onClick={onAdd} style={btnSmall}>+ Add</button>
            </div>

            <div style={{ padding: "0 2px", marginBottom: 6 }}>
                <input
                    type="text"
                    placeholder="Search components..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: "100%", padding: "4px 8px", fontSize: 11,
                        background: "var(--bg-deep)", border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)", color: "var(--text-primary)",
                        outline: "none", boxSizing: "border-box",
                    }}
                />
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
                {filtered.map((c) => (
                    <div
                        key={c.id}
                        onClick={() => onSelect(c.id)}
                        style={{
                            padding: "6px 8px",
                            background: selected === c.id ? "var(--bg-hover)" : "transparent",
                            borderLeft: selected === c.id ? "2px solid var(--accent)" : "2px solid transparent",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12,
                            borderRadius: 2,
                            transition: "background var(--transition-fast)",
                            opacity: c.visible === false ? 0.4 : 1,
                        }}
                    >
                        <div style={{
                            width: 10, height: 10, background: c.color, borderRadius: 2,
                            flexShrink: 0, border: "1px solid rgba(255,255,255,0.1)"
                        }} />
                        <span style={{
                            flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            color: "var(--text-primary)",
                        }}>
                            {c.name}
                        </span>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {c.locked && <span style={{ fontSize: 9 }} title="Locked">🔒</span>}
                            {c.refImages?.length > 0 && (
                                <span style={{ fontSize: 9, color: "var(--accent)" }} title={`${c.refImages.length} ref image(s)`}>
                                    📷{c.refImages.length > 1 ? c.refImages.length : ""}
                                </span>
                            )}
                            <button
                                onClick={e => { e.stopPropagation(); onToggleVis(c.id); }}
                                style={{
                                    background: "none", border: "none", cursor: "pointer",
                                    fontSize: 10, padding: 0, color: "var(--text-ghost)",
                                    opacity: 0.6,
                                }}
                                title={c.visible === false ? "Show" : "Hide"}
                            >
                                {c.visible === false ? "👁️‍🗨️" : "👁️"}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{
                padding: "6px 4px", borderTop: "1px solid var(--border-subtle)",
                fontSize: 10, color: "var(--text-ghost)", textAlign: "center",
            }}>
                {components.length} component{components.length !== 1 ? "s" : ""}
            </div>
        </div>
    );
}
