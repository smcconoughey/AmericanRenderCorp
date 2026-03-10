import { useState } from "react";
import {
    buildScenePrompt, buildFullPromptDocument,
    generateSceneRender, getAIConfig
} from "../../services/aiRenderer.js";

const inputStyle = {
    background: "var(--bg-deepest)", border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-sm)", padding: "5px 8px", color: "var(--text-primary)",
    fontSize: 12, width: "100%", boxSizing: "border-box", outline: "none",
    fontFamily: "var(--font-sans)",
};

const btnSmall = {
    padding: "4px 12px", fontSize: 11, background: "transparent",
    border: "1px solid var(--border-default)", color: "var(--text-secondary)",
    borderRadius: "var(--radius-sm)", cursor: "pointer", whiteSpace: "nowrap",
    transition: "all 0.15s ease", fontFamily: "var(--font-condensed)", fontWeight: 500,
    letterSpacing: 0.3, textTransform: "uppercase",
};

/**
 * Full-screen image lightbox for viewing renders and references at actual size.
 */
function ImageLightbox({ src, label, onClose }) {
    if (!src) return null;
    return (
        <div onClick={onClose} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 2000, cursor: "zoom-out", backdropFilter: "blur(6px)",
        }}>
            <div style={{ maxWidth: "92vw", maxHeight: "92vh", position: "relative" }} onClick={e => e.stopPropagation()}>
                <img src={src} alt={label || "Image"} style={{
                    maxWidth: "92vw", maxHeight: "88vh", display: "block",
                    borderRadius: 6, boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
                    objectFit: "contain",
                }} />
                <div style={{
                    position: "absolute", bottom: -28, left: 0, right: 0,
                    textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 11,
                    fontFamily: "var(--font-condensed)", letterSpacing: 0.5,
                }}>
                    {label} — Click outside to close
                </div>
                <button onClick={onClose} style={{
                    position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)",
                    border: "none", color: "#fff", fontSize: 16, cursor: "pointer",
                    borderRadius: 4, padding: "4px 10px", fontWeight: 600,
                }}>x</button>
            </div>
        </div>
    );
}

export default function RenderPipeline({ components, sceneNotes, onSceneNotesChange, captureCanvas }) {
    const [mode, setMode] = useState("render");
    const [loading, setLoading] = useState(false);
    const [renders, setRenders] = useState([]);
    const [error, setError] = useState(null);
    const [promptText, setPromptText] = useState("");
    const [editedPrompt, setEditedPrompt] = useState("");
    const [refPreview, setRefPreview] = useState(null);
    const [useReference, setUseReference] = useState(true);
    const [seed, setSeed] = useState(42);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [lightboxLabel, setLightboxLabel] = useState("");

    const visibleComponents = components.filter(c => c.visible !== false);

    const previewRef = () => {
        if (!captureCanvas) return;
        const dataUrl = captureCanvas();
        if (dataUrl) setRefPreview(dataUrl);
    };

    const generatePrompt = () => {
        const prompt = buildScenePrompt(visibleComponents, sceneNotes, useReference);
        setPromptText(prompt);
        setEditedPrompt(prompt);
    };

    const renderScene = async (customPrompt) => {
        const config = getAIConfig();
        if (!config.apiKey) {
            setError("No API key configured. Open Settings to add your Gemini API key.");
            return;
        }
        if (visibleComponents.length === 0 && !sceneNotes) {
            setError("Add components or scene notes before rendering.");
            return;
        }

        setLoading(true);
        setError(null);

        let refImage = null;
        if (useReference && captureCanvas) {
            refImage = captureCanvas();
            if (refImage) setRefPreview(refImage);
        }

        const hasRef = !!refImage;
        const prompt = customPrompt || buildScenePrompt(visibleComponents, sceneNotes, hasRef);

        try {
            const result = await generateSceneRender(prompt, config, refImage, seed);
            setRenders(prev => [{
                image: result.image,
                text: result.text,
                prompt: prompt.slice(0, 200) + "...",
                time: new Date().toLocaleTimeString(),
                model: config.model,
                hadReference: hasRef,
                seed,
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
            ...btnSmall, fontSize: 10, padding: "3px 10px",
            background: mode === key ? "var(--accent-light)" : "transparent",
            borderColor: mode === key ? "var(--accent)" : "var(--border-default)",
            color: mode === key ? "var(--accent)" : "var(--text-muted)",
        }}>
            {label}
        </button>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Lightbox */}
            <ImageLightbox src={lightboxSrc} label={lightboxLabel} onClose={() => setLightboxSrc(null)} />

            {/* Tab bar */}
            <div style={{
                padding: "5px 12px", borderBottom: "1px solid var(--border-default)",
                display: "flex", gap: 6, alignItems: "center",
            }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, fontFamily: "var(--font-condensed)" }}>
                    Render
                </span>
                <div style={{ flex: 1 }} />
                {tabBtn("render", "Render")}
                {tabBtn("prompt", "Prompt")}
                {tabBtn("gallery", "Gallery")}
            </div>

            <div style={{ flex: 1, overflow: "auto", display: "flex" }}>
                {/* ONE-SHOT RENDER MODE */}
                {mode === "render" && (
                    <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        {/* Scene notes */}
                        <label style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-condensed)", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            Scene Description
                            <textarea value={sceneNotes} onChange={e => onSceneNotesChange(e.target.value)} rows={2}
                                placeholder="Describe the environment, e.g. 'Rocket test facility in open desert, concrete pads, gravel areas...'"
                                style={{ ...inputStyle, resize: "vertical", marginTop: 4, lineHeight: 1.5, textTransform: "none", letterSpacing: 0, fontWeight: 400 }} />
                        </label>

                        {/* Controls row */}
                        <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                            {/* Reference toggle */}
                            <button onClick={() => { setUseReference(!useReference); if (!useReference) previewRef(); }}
                                style={{
                                    ...btnSmall, padding: "4px 10px", fontSize: 10,
                                    background: useReference ? "var(--accent-light)" : "transparent",
                                    borderColor: useReference ? "var(--accent)" : "var(--border-default)",
                                    color: useReference ? "var(--accent)" : "var(--text-ghost)",
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                                    minWidth: 60,
                                }}>
                                <span style={{ fontSize: 10, fontWeight: 600 }}>{useReference ? "REF" : "TEXT"}</span>
                                <span style={{ fontSize: 8, textTransform: "none", letterSpacing: 0 }}>{useReference ? "Layout" : "Only"}</span>
                            </button>

                            {/* Preview reference button */}
                            {useReference && (
                                <button onClick={previewRef} style={{ ...btnSmall, padding: "4px 8px", fontSize: 9, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 50 }}>
                                    <span style={{ fontSize: 10, fontWeight: 600 }}>PRV</span>
                                    <span style={{ fontSize: 8, textTransform: "none", letterSpacing: 0 }}>Preview</span>
                                </button>
                            )}

                            {/* Seed input */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 70 }}>
                                <span style={{ fontSize: 9, color: "var(--text-ghost)", fontFamily: "var(--font-condensed)", textTransform: "uppercase", letterSpacing: 0.5 }}>Seed</span>
                                <input type="number" value={seed} onChange={e => setSeed(parseInt(e.target.value) || 0)}
                                    style={{ ...inputStyle, width: 70, fontSize: 11, padding: "3px 6px", textAlign: "center", fontFamily: "var(--font-mono)" }} />
                            </div>

                            {/* Component summary */}
                            <div style={{
                                flex: 1, padding: "4px 8px", background: "var(--bg-base)", borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--border-subtle)", fontSize: 10, color: "var(--text-secondary)", overflow: "hidden",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontWeight: 600, fontFamily: "var(--font-condensed)", textTransform: "uppercase", letterSpacing: 0.5 }}>{visibleComponents.length} components</span>
                                    <span style={{ color: "var(--text-ghost)", fontFamily: "var(--font-mono)", fontSize: 9 }}>
                                        {getAIConfig().model}
                                    </span>
                                </div>
                                {visibleComponents.slice(0, 3).map((c) => (
                                    <div key={c.id} style={{ color: "var(--text-muted)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 9 }}>
                                        {c.name}{c.material && c.material !== "Custom" ? ` (${c.material})` : ""}
                                    </div>
                                ))}
                                {visibleComponents.length > 3 && (
                                    <div style={{ color: "var(--text-ghost)", fontSize: 9 }}>+{visibleComponents.length - 3} more</div>
                                )}
                            </div>
                        </div>

                        {/* Reference image preview — LARGE, clickable for full-screen */}
                        {refPreview && useReference && (
                            <div style={{
                                borderRadius: "var(--radius-sm)", overflow: "hidden",
                                border: "1px solid var(--border-default)", position: "relative",
                                cursor: "zoom-in",
                            }} onClick={() => { setLightboxSrc(refPreview); setLightboxLabel("Clean Reference Image"); }}>
                                <img src={refPreview} alt="Reference layout" style={{
                                    width: "100%", display: "block", objectFit: "contain",
                                    maxHeight: 280,
                                }} />
                                <div style={{
                                    position: "absolute", top: 4, left: 6, fontSize: 9, color: "var(--accent)",
                                    background: "rgba(255,255,255,0.85)", padding: "1px 6px", borderRadius: 3,
                                    fontFamily: "var(--font-condensed)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
                                }}>
                                    Clean reference — click to enlarge
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setRefPreview(null); }} style={{
                                    position: "absolute", top: 4, right: 6, background: "rgba(255,255,255,0.85)",
                                    border: "1px solid var(--border-subtle)", color: "var(--text-muted)", fontSize: 10, cursor: "pointer", borderRadius: 3, padding: "1px 5px",
                                }}>x</button>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div style={{
                                padding: "6px 10px", background: "rgba(197,48,48,0.08)", border: "1px solid rgba(197,48,48,0.25)",
                                borderRadius: "var(--radius-sm)", color: "var(--error)", fontSize: 11, lineHeight: 1.5,
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Render button */}
                        <button onClick={() => renderScene()} disabled={loading}
                            style={{
                                padding: "8px 16px", fontSize: 13, fontWeight: 600,
                                fontFamily: "var(--font-condensed)", letterSpacing: 0.8, textTransform: "uppercase",
                                background: loading ? "var(--bg-base)" : "var(--accent-light)",
                                border: `1px solid ${loading ? "var(--border-default)" : "var(--accent)"}`,
                                color: loading ? "var(--text-ghost)" : "var(--accent)",
                                borderRadius: "var(--radius-md)", cursor: loading ? "wait" : "pointer",
                                transition: "all 0.2s ease",
                            }}>
                            {loading ? "Generating..." : useReference ? "Render from Layout" : "Render Scene"}
                        </button>

                        {/* Latest render — clickable for full-screen view */}
                        {renders.length > 0 && (
                            <div style={{
                                borderRadius: "var(--radius-md)", overflow: "hidden",
                                border: "1px solid var(--border-default)", position: "relative",
                                cursor: "zoom-in",
                            }} onClick={() => { setLightboxSrc(renders[0].image); setLightboxLabel(`Render | ${renders[0].model} | seed:${renders[0].seed}`); }}>
                                <img src={renders[0].image} alt="Scene render" style={{ width: "100%", display: "block" }} />
                                <div style={{
                                    position: "absolute", bottom: 0, left: 0, right: 0,
                                    padding: "6px 10px", background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                }}>
                                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontFamily: "var(--font-mono)" }}>
                                        {renders[0].time} | seed:{renders[0].seed}
                                        {renders[0].hadReference ? " | ref" : ""} — click to view full
                                    </span>
                                    <button onClick={(e) => { e.stopPropagation(); downloadImage(renders[0].image, 0); }}
                                        style={{ ...btnSmall, fontSize: 9, padding: "2px 8px", color: "rgba(255,255,255,0.9)", borderColor: "rgba(255,255,255,0.4)" }}>
                                        Save
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
                            <button onClick={generatePrompt} style={btnSmall}>Generate</button>
                            <button onClick={() => { navigator.clipboard.writeText(editedPrompt || promptText); }}
                                style={btnSmall} disabled={!editedPrompt && !promptText}>Copy</button>
                            <div style={{ flex: 1 }} />
                            <button onClick={() => renderScene(editedPrompt || promptText)}
                                disabled={loading || (!editedPrompt && !promptText)}
                                style={{
                                    ...btnSmall,
                                    background: "var(--accent-light)", color: "var(--accent)", borderColor: "var(--accent)",
                                    opacity: loading || (!editedPrompt && !promptText) ? 0.5 : 1,
                                }}>
                                {loading ? "..." : "Render"}
                            </button>
                        </div>
                        <textarea
                            value={editedPrompt || promptText}
                            onChange={e => setEditedPrompt(e.target.value)}
                            placeholder='Click "Generate" to build the prompt, then edit and render.'
                            style={{ ...inputStyle, flex: 1, resize: "none", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6 }} />
                    </div>
                )}

                {/* GALLERY */}
                {mode === "gallery" && (
                    <div style={{ flex: 1, padding: 12 }}>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8, fontFamily: "var(--font-condensed)" }}>
                            Render History ({renders.length})
                        </div>
                        {renders.length === 0 ? (
                            <div style={{ color: "var(--text-ghost)", fontSize: 12, textAlign: "center", marginTop: 40 }}>
                                No renders yet. Use the Render tab to generate.
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                {renders.map((r, i) => (
                                    <div key={i} style={{
                                        borderRadius: "var(--radius-sm)", overflow: "hidden",
                                        border: "1px solid var(--border-default)", background: "var(--bg-surface)",
                                        cursor: "zoom-in",
                                    }} onClick={() => { setLightboxSrc(r.image); setLightboxLabel(`Render ${i + 1} | seed:${r.seed}`); }}>
                                        <img src={r.image} alt={`Render ${i + 1}`} style={{ width: "100%", display: "block" }} />
                                        <div style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--font-mono)" }}>
                                            <span>{r.time} | seed:{r.seed}{r.hadReference ? " | ref" : ""}</span>
                                            <button onClick={(e) => { e.stopPropagation(); downloadImage(r.image, i); }}
                                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 9, color: "var(--accent)", fontFamily: "var(--font-condensed)", fontWeight: 600 }}>
                                                Save
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
