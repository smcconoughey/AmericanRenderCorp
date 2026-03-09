import { useState } from "react";

const btnSmall = {
    padding: "3px 10px", fontSize: 11, background: "transparent",
    border: "1px solid var(--border-default)", color: "var(--text-secondary)",
    borderRadius: "var(--radius-sm)", cursor: "pointer", whiteSpace: "nowrap",
    transition: "all var(--transition-fast)",
};

export default function ComponentList({ components, selected, onSelect, onAdd, onDelete, onToggleVis, onNewScene, onBulkDelete }) {
    const [search, setSearch] = useState("");
    const [multiSelect, setMultiSelect] = useState(new Set());
    const [selectMode, setSelectMode] = useState(false);

    const filtered = search
        ? components.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
        : components;

    const toggleMulti = (id) => {
        setMultiSelect(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (multiSelect.size === filtered.length) {
            setMultiSelect(new Set());
        } else {
            setMultiSelect(new Set(filtered.map(c => c.id)));
        }
    };

    const handleBulkDelete = () => {
        if (multiSelect.size === 0) return;
        onBulkDelete([...multiSelect]);
        setMultiSelect(new Set());
        setSelectMode(false);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, padding: "0 2px" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
                    Scene Graph
                </span>
                <div style={{ display: "flex", gap: 3 }}>
                    <button onClick={onAdd} style={{ ...btnSmall, fontSize: 10, padding: "2px 6px" }}>+ Add</button>
                    <button onClick={onNewScene} style={{ ...btnSmall, fontSize: 10, padding: "2px 6px", color: "var(--text-ghost)" }} title="New empty scene">
                        ✦ New
                    </button>
                </div>
            </div>

            {/* Search */}
            <div style={{ padding: "0 2px", marginBottom: 4 }}>
                <input type="text" placeholder="Search components..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{
                        width: "100%", padding: "4px 8px", fontSize: 11,
                        background: "var(--bg-deep)", border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)", color: "var(--text-primary)",
                        outline: "none", boxSizing: "border-box",
                    }} />
            </div>

            {/* Bulk actions bar */}
            {components.length > 0 && (
                <div style={{ display: "flex", gap: 3, padding: "0 2px", marginBottom: 2 }}>
                    <button onClick={() => { setSelectMode(!selectMode); setMultiSelect(new Set()); }}
                        style={{
                            ...btnSmall, fontSize: 9, padding: "1px 6px",
                            background: selectMode ? "var(--accent-glow)" : "transparent",
                            color: selectMode ? "var(--accent)" : "var(--text-ghost)",
                            borderColor: selectMode ? "var(--accent-dim)" : "var(--border-subtle)",
                        }}>
                        {selectMode ? "Cancel" : "Select"}
                    </button>
                    {selectMode && (
                        <>
                            <button onClick={selectAll}
                                style={{ ...btnSmall, fontSize: 9, padding: "1px 6px", color: "var(--text-ghost)" }}>
                                {multiSelect.size === filtered.length ? "None" : "All"}
                            </button>
                            {multiSelect.size > 0 && (
                                <button onClick={handleBulkDelete}
                                    style={{ ...btnSmall, fontSize: 9, padding: "1px 6px", color: "var(--error)", borderColor: "rgba(239,68,68,0.3)" }}>
                                    Delete {multiSelect.size}
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Component list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
                {filtered.length === 0 && !search && (
                    <div style={{
                        padding: "20px 12px", textAlign: "center", color: "var(--text-ghost)", fontSize: 12, lineHeight: 1.6,
                    }}>
                        <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.4 }}>⬡</div>
                        Empty scene<br />
                        <span style={{ fontSize: 11 }}>
                            Use <strong>CAD Import</strong> to load your model<br />or <strong>+ Add</strong> to create components
                        </span>
                    </div>
                )}
                {filtered.map((c) => (
                    <div
                        key={c.id}
                        onClick={() => selectMode ? toggleMulti(c.id) : onSelect(c.id)}
                        style={{
                            padding: "6px 8px",
                            background: selectMode
                                ? multiSelect.has(c.id) ? "rgba(255,107,53,0.12)" : "transparent"
                                : selected === c.id ? "var(--bg-hover)" : "transparent",
                            borderLeft: selectMode
                                ? multiSelect.has(c.id) ? "2px solid var(--accent)" : "2px solid transparent"
                                : selected === c.id ? "2px solid var(--accent)" : "2px solid transparent",
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
                        {selectMode && (
                            <input type="checkbox" checked={multiSelect.has(c.id)} readOnly
                                style={{ accentColor: "var(--accent)", flexShrink: 0, pointerEvents: "none" }} />
                        )}
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
                        {!selectMode && (
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
                                        fontSize: 10, padding: 0, color: "var(--text-ghost)", opacity: 0.6,
                                    }}
                                    title={c.visible === false ? "Show" : "Hide"}
                                >
                                    {c.visible === false ? "👁️‍🗨️" : "👁️"}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div style={{
                padding: "6px 4px", borderTop: "1px solid var(--border-subtle)",
                fontSize: 10, color: "var(--text-ghost)", textAlign: "center",
            }}>
                {components.length} component{components.length !== 1 ? "s" : ""}
                {selectMode && multiSelect.size > 0 && ` · ${multiSelect.size} selected`}
            </div>
        </div>
    );
}
