import { useState, useRef } from "react";
import {
    buildScenePrompt, buildFullPromptDocument,
    generateSceneRender, getAIConfig
} from "../../services/aiRenderer.js";

const inputStyle = {
    background: "var(--bg-deep)", border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-sm)", padding: "5px 8px", color: "var(--text-primary)",
    fontSize: 12, width: "100%", boxSizing: "border-box", outline: "none",
};

const btnSmall = {
    padding: "4px 12px", fontSize: 11, background: "transparent",
    border: "1px solid var(--border-default)", color: "var(--text-secondary)",
    borderRadius: "var(--radius-sm)", cursor: "pointer", whiteSpace: "nowrap",
    transition: "all 0.15s ease",
};

export default function RenderPipeline({ components, sceneNotes, onSceneNotesChange, captureCanvas }) {
    const [mode, setMode] = useState("render");
    const [loading, setLoading] = useState(false);
    const [renders, setRenders] = useState([]);
    const [error, setError] = useState(null);
    const [promptText, setPromptText] = useState("");
    const [editedPrompt, setEditedPrompt] = useState("");
    const [refPreview, setRefPreview] = useState(null);
    const [useReference, setUseReference] = useState(true);

    const visibleComponents = components.filter(c => c.visible !== false);

    const captureRef = () => {
        if (!captureCanvas) return null;
        const dataUrl = captureCanvas();
        if (dataUrl) setRefPreview(dataUrl);
        return dataUrl;
    };

    const generatePrompt = () => {
        const prompt = buildScenePrompt(visibleComponents, sceneNotes, useReference);
        setPromptText(prompt);
        setEditedPrompt(prompt);
    };

    const renderScene = async (customPrompt) => {
        const config = getAIConfig();
        if (!config.apiKey) {
            setError("No API key configured. Go to Settings (⚙) to add your Gemini API key.");
            return;
        }
        if (visibleComponents.length === 0 && !sceneNotes) {
            setError("Add components or scene notes before rendering.");
            return;
        }

        setLoading(true);
        setError(null);

        // Capture canvas as reference image
        let refImage = null;
        if (useReference && captureCanvas) {
            refImage = captureCanvas();
            if (refImage) setRefPreview(refImage);
        }

        const hasRef = !!refImage;
        const prompt = customPrompt || buildScenePrompt(visibleComponents, sceneNotes, hasRef);

        try {
            const result = await generateSceneRender(prompt, config, refImage);
            setRenders(prev => [{
                image: result.image,
                text: result.text,
                prompt: prompt.slice(0, 200) + "...",
                time: new Date().toLocaleTimeString(),
                model: config.model,
                hadReference: hasRef,
            }, ...prev]);
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    };

    const downloadImage = (dataUrl, index) => {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `scene-render-${index + 1}.png`;
        a.click();
    };

    const tabBtn = (key, label) => (
        <button onClick={() => setMode(key)} style={{
            ...btnSmall, fontSize: 10, padding: "2px 8px",
            background: mode === key ? "var(--bg-hover)" : "transparent",
            borderColor: mode === key ? "var(--accent-dim)" : "var(--border-default)",
            color: mode === key ? "var(--accent)" : "var(--text-muted)",
        }}>
            {label}
        </button>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Tab bar */}
            <div style={{
                padding: "4px 12px", borderBottom: "1px solid var(--border-subtle)",
                display: "flex", gap: 6, alignItems: "center",
            }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
                    Render
                </span>
                <div style={{ flex: 1 }} />
                {tabBtn("render", "⚡ One-Shot")}
                {tabBtn("prompt", "📝 Prompt")}
                {tabBtn("gallery", "🖼️ Gallery")}
            </div>

            <div style={{ flex: 1, overflow: "auto", display: "flex" }}>
                {/* ONE-SHOT RENDER MODE */}
                {mode === "render" && (
                    <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                        {/* Scene notes */}
                        <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Scene Description
                            <textarea value={sceneNotes} onChange={e => onSceneNotesChange(e.target.value)} rows={2}
                                placeholder="Describe the environment — e.g. 'Rocket test facility in Florida scrubland, concrete pads, gravel areas, chain-link fencing...'"
                                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", marginTop: 4, lineHeight: 1.5 }} />
                        </label>

                        {/* Reference image toggle + component summary */}
                        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                            {/* Reference toggle */}
                            <button onClick={() => setUseReference(!useReference)}
                                style={{
                                    ...btnSmall, padding: "6px 12px", fontSize: 10,
                                    background: useReference ? "rgba(52,211,153,0.1)" : "transparent",
                                    borderColor: useReference ? "rgba(52,211,153,0.3)" : "var(--border-default)",
                                    color: useReference ? "#34d399" : "var(--text-ghost)",
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                                    minWidth: 80,
                                }}>
                                <span style={{ fontSize: 16 }}>{useReference ? "🖼️" : "✏️"}</span>
                                <span>{useReference ? "Layout Ref" : "Text Only"}</span>
                                <span style={{ fontSize: 8, color: "var(--text-ghost)" }}>
                                    {useReference ? "Uses canvas" : "From scratch"}
                                </span>
                            </button>

                            {/* Component summary */}
                            <div style={{
                                flex: 1, padding: "6px 10px", background: "var(--bg-deep)", borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--border-subtle)", fontSize: 10, color: "var(--text-muted)", overflow: "hidden",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                    <span style={{ fontWeight: 600, fontSize: 11 }}>{visibleComponents.length} components</span>
                                    <span style={{ color: "var(--text-ghost)", fontFamily: "var(--font-mono)" }}>
                                        {getAIConfig().model}
                                    </span>
                                </div>
                                {visibleComponents.slice(0, 4).map((c) => (
                                    <div key={c.id} style={{ color: "var(--text-ghost)", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        • {c.name}{c.material && c.material !== "Custom" ? ` (${c.material})` : ""}
                                    </div>
                                ))}
                                {visibleComponents.length > 4 && (
                                    <div style={{ color: "var(--text-ghost)" }}>... +{visibleComponents.length - 4} more</div>
                                )}
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{
                                padding: "6px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                                borderRadius: "var(--radius-sm)", color: "var(--error)", fontSize: 11, lineHeight: 1.5,
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Render button */}
                        <button onClick={() => renderScene()} disabled={loading}
                            style={{
                                padding: "10px 20px", fontSize: 13, fontWeight: 600,
                                background: loading ? "var(--bg-deep)" : "linear-gradient(135deg, rgba(255,107,53,0.2), rgba(255,107,53,0.05))",
                                border: `1px solid ${loading ? "var(--border-default)" : "var(--accent-dim)"}`,
                                color: loading ? "var(--text-ghost)" : "var(--accent)",
                                borderRadius: "var(--radius-md)", cursor: loading ? "wait" : "pointer",
                                transition: "all 0.2s ease",
                            }}>
                            {loading ? "⟳ Generating render..." : useReference ? "⚡ Render from Layout" : "⚡ Render Full Scene"}
                        </button>

                        {/* Latest render */}
                        {renders.length > 0 && (
                            <div style={{
                                borderRadius: "var(--radius-md)", overflow: "hidden",
                                border: "1px solid var(--border-default)", position: "relative",
                            }}>
                                <img src={renders[0].image} alt="Scene render" style={{ width: "100%", display: "block" }} />
                                <div style={{
                                    position: "absolute", bottom: 0, left: 0, right: 0,
                                    padding: "6px 10px", background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                }}>
                                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>
                                        {renders[0].time} · {renders[0].model}
                                        {renders[0].hadReference ? " · from layout" : " · text only"}
                                    </span>
                                    <button onClick={() => downloadImage(renders[0].image, 0)}
                                        style={{ ...btnSmall, fontSize: 9, padding: "2px 6px", color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.3)" }}>
                                        ⬇ Save
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* PROMPT EDITOR */}
                {mode === "prompt" && (
                    <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button onClick={generatePrompt} style={btnSmall}>Generate Prompt</button>
                            <button onClick={() => { navigator.clipboard.writeText(editedPrompt || promptText); }}
                                style={{ ...btnSmall }} disabled={!editedPrompt && !promptText}>📋 Copy</button>
                            <div style={{ flex: 1 }} />
                            <button onClick={() => renderScene(editedPrompt || promptText)}
                                disabled={loading || (!editedPrompt && !promptText)}
                                style={{
                                    ...btnSmall,
                                    background: "var(--accent-glow)", color: "var(--accent)", borderColor: "var(--accent-dim)",
                                    opacity: loading || (!editedPrompt && !promptText) ? 0.5 : 1,
                                }}>
                                {loading ? "⟳ Rendering..." : "⚡ Render"}
                            </button>
                        </div>
                        <textarea
                            value={editedPrompt || promptText}
                            onChange={e => setEditedPrompt(e.target.value)}
                            placeholder='Click "Generate Prompt" to build, then edit and render.'
                            style={{ ...inputStyle, flex: 1, resize: "none", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6 }} />
                    </div>
                )}

                {/* GALLERY */}
                {mode === "gallery" && (
                    <div style={{ flex: 1, padding: 12 }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
                            Render History ({renders.length})
                        </div>
                        {renders.length === 0 ? (
                            <div style={{ color: "var(--text-ghost)", fontSize: 12, textAlign: "center", marginTop: 40 }}>
                                No renders yet. Use ⚡ One-Shot to generate your first render.
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                {renders.map((r, i) => (
                                    <div key={i} style={{
                                        borderRadius: "var(--radius-sm)", overflow: "hidden",
                                        border: "1px solid var(--border-default)", background: "var(--bg-surface)",
                                    }}>
                                        <img src={r.image} alt={`Render ${i + 1}`} style={{ width: "100%", display: "block" }} />
                                        <div style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-ghost)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span>{r.time} · {r.model}{r.hadReference ? " · ref" : ""}</span>
                                            <button onClick={() => downloadImage(r.image, i)}
                                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 9, color: "var(--text-ghost)" }}>
                                                ⬇ Save
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
