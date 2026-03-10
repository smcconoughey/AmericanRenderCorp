import { useState, useRef, useEffect } from "react";
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
    // --- tab ---
    const [mode, setMode] = useState("render");

    // --- shared ---
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refPreview, setRefPreview] = useState(null);
    const [useReference, setUseReference] = useState(true);
    const [seed, setSeed] = useState(42);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [lightboxLabel, setLightboxLabel] = useState("");

    // --- prompt tab ---
    const [promptText, setPromptText] = useState("");
    const [editedPrompt, setEditedPrompt] = useState("");

    // --- pipeline ---
    const [numVariants, setNumVariants] = useState(1);
    const [genStatus, setGenStatus] = useState(null); // {current, total, elapsed}
    const [pendingVariants, setPendingVariants] = useState([]);
    const [selectedRender, setSelectedRender] = useState(null);
    const [iterFeedback, setIterFeedback] = useState("");
    const [showIter, setShowIter] = useState(false);
    const [gallery, setGallery] = useState([]);

    // --- refs (survive closures, no re-renders) ---
    const abortRef = useRef(null);
    const timerRef = useRef(null);

    const visibleComponents = components.filter(c => c.visible !== false);

    // Cleanup timer on unmount
    useEffect(() => () => clearInterval(timerRef.current), []);

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

    // ---- Main generation function ----
    const runGeneration = async (isIteration = false) => {
        const config = getAIConfig();
        if (!config.apiKey) {
            setError("No API key configured. Open Settings to add your Gemini API key.");
            return;
        }
        if (visibleComponents.length === 0 && !sceneNotes) {
            setError("Add components or scene notes before rendering.");
            return;
        }

        const ctrl = new AbortController();
        abortRef.current = ctrl;

        setLoading(true);
        setError(null);
        if (!isIteration) setPendingVariants([]);

        let refImage = null;
        if (useReference && captureCanvas) {
            refImage = captureCanvas();
            if (refImage) setRefPreview(refImage);
        }

        const hasRef = !!refImage;
        const prompt = buildScenePrompt(visibleComponents, sceneNotes, hasRef);
        const count = isIteration ? 1 : numVariants;

        // Start elapsed timer
        let elapsed = 0;
        setGenStatus({ current: 1, total: count, elapsed: 0 });
        timerRef.current = setInterval(() => {
            elapsed += 1;
            setGenStatus(s => s ? { ...s, elapsed } : null);
        }, 1000);

        const results = [];

        try {
            for (let i = 0; i < count; i++) {
                if (ctrl.signal.aborted) break;
                setGenStatus(s => s ? { ...s, current: i + 1 } : null);

                const iterImage = isIteration ? selectedRender?.image : null;
                const iterFbText = isIteration ? iterFeedback : null;

                try {
                    const result = await generateSceneRender(
                        prompt, config, refImage, seed,
                        ctrl.signal, iterImage, iterFbText
                    );
                    const render = {
                        image: result.image,
                        text: result.text,
                        prompt: prompt.slice(0, 200) + "...",
                        time: new Date().toLocaleTimeString(),
                        model: config.model,
                        hadReference: hasRef,
                        seed,
                    };
                    results.push(render);
                    if (isIteration) {
                        setSelectedRender(render);
                        setIterFeedback("");
                    } else {
                        setPendingVariants([...results]);
                    }
                } catch (err) {
                    if (err.name === "AbortError") break;
                    setError(err.message);
                    break;
                }
            }
        } finally {
            clearInterval(timerRef.current);
            setLoading(false);
            setGenStatus(null);
        }

        // Auto-select single result — skips pick grid
        if (!isIteration && results.length === 1) {
            setSelectedRender(results[0]);
            setPendingVariants([]);
        }
    };

    const cancelGeneration = () => {
        if (abortRef.current) abortRef.current.abort();
        clearInterval(timerRef.current);
        setLoading(false);
        setGenStatus(null);
    };

    // Clears stuck state, keeps selectedRender
    const resetPipeline = () => {
        if (abortRef.current) abortRef.current.abort();
        clearInterval(timerRef.current);
        setLoading(false);
        setGenStatus(null);
        setPendingVariants([]);
        setError(null);
    };

    const selectVariant = (render) => {
        setSelectedRender(render);
        setPendingVariants([]);
    };

    const acceptToGallery = () => {
        if (!selectedRender) return;
        setGallery(prev => [selectedRender, ...prev]);
        setSelectedRender(null);
        setIterFeedback("");
        setShowIter(false);
    };

    const discardSelected = () => {
        setSelectedRender(null);
        setIterFeedback("");
        setShowIter(false);
    };

    // Prompt tab: render directly to gallery (single, no variants)
    const renderFromPrompt = async (customPrompt) => {
        const config = getAIConfig();
        if (!config.apiKey) { setError("No API key configured."); return; }

        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        setError(null);

        let refImage = null;
        if (useReference && captureCanvas) refImage = captureCanvas();

        try {
            const result = await generateSceneRender(customPrompt, config, refImage, seed, ctrl.signal);
            const render = {
                image: result.image, text: result.text,
                prompt: customPrompt.slice(0, 200) + "...",
                time: new Date().toLocaleTimeString(),
                model: config.model, hadReference: !!refImage, seed,
            };
            setGallery(prev => [render, ...prev]);
        } catch (err) {
            if (err.name !== "AbortError") setError(err.message);
        }
        setLoading(false);
    };

    const downloadImage = (dataUrl, name) => {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = name || "render.png";
        a.click();
    };

    const openLightbox = (src, label) => { setLightboxSrc(src); setLightboxLabel(label); };

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
            <ImageLightbox src={lightboxSrc} label={lightboxLabel} onClose={() => setLightboxSrc(null)} />

            {/* Tab bar */}
            <div style={{
                padding: "5px 12px", borderBottom: "1px solid var(--border-default)",
                display: "flex", gap: 6, alignItems: "center",
            }}>
                <span style={{
                    fontSize: 11, color: "var(--text-muted)", letterSpacing: 1.5,
                    textTransform: "uppercase", fontWeight: 600, fontFamily: "var(--font-condensed)",
                }}>
                    Render
                </span>
                <div style={{ flex: 1 }} />
                {tabBtn("render", "Render")}
                {tabBtn("prompt", "Prompt")}
                {tabBtn("gallery", gallery.length > 0 ? `Gallery (${gallery.length})` : "Gallery")}
                <button onClick={resetPipeline} style={{
                    ...btnSmall, fontSize: 10, padding: "3px 10px",
                    borderColor: "rgba(197,48,48,0.4)", color: "var(--error)",
                }}>
                    Reset
                </button>
            </div>

            <div style={{ flex: 1, overflow: "auto", display: "flex" }}>

                {/* ── RENDER TAB ── */}
                {mode === "render" && (
                    <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>

                        {/* Scene notes */}
                        <label style={{
                            fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-condensed)",
                            fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5,
                        }}>
                            Scene Description
                            <textarea value={sceneNotes} onChange={e => onSceneNotesChange(e.target.value)} rows={2}
                                placeholder="Describe the environment, e.g. 'Rocket test facility in open desert, concrete pads, gravel areas...'"
                                style={{
                                    ...inputStyle, resize: "vertical", marginTop: 4,
                                    lineHeight: 1.5, textTransform: "none", letterSpacing: 0, fontWeight: 400,
                                }} />
                        </label>

                        {/* Controls row */}
                        <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                            {/* REF/TEXT toggle */}
                            <button
                                onClick={() => { setUseReference(!useReference); if (!useReference) previewRef(); }}
                                style={{
                                    ...btnSmall, padding: "4px 10px", fontSize: 10,
                                    background: useReference ? "var(--accent-light)" : "transparent",
                                    borderColor: useReference ? "var(--accent)" : "var(--border-default)",
                                    color: useReference ? "var(--accent)" : "var(--text-ghost)",
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 60,
                                }}>
                                <span style={{ fontSize: 10, fontWeight: 600 }}>{useReference ? "REF" : "TEXT"}</span>
                                <span style={{ fontSize: 8, textTransform: "none", letterSpacing: 0 }}>{useReference ? "Layout" : "Only"}</span>
                            </button>

                            {/* Preview reference */}
                            {useReference && (
                                <button onClick={previewRef} style={{
                                    ...btnSmall, padding: "4px 8px", fontSize: 9,
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 50,
                                }}>
                                    <span style={{ fontSize: 10, fontWeight: 600 }}>PRV</span>
                                    <span style={{ fontSize: 8, textTransform: "none", letterSpacing: 0 }}>Preview</span>
                                </button>
                            )}

                            {/* Variants selector */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                <span style={{
                                    fontSize: 9, color: "var(--text-ghost)", fontFamily: "var(--font-condensed)",
                                    textTransform: "uppercase", letterSpacing: 0.5,
                                }}>Variants</span>
                                <div style={{ display: "flex", gap: 2 }}>
                                    {[1, 2, 3].map(n => (
                                        <button key={n} onClick={() => setNumVariants(n)} style={{
                                            ...btnSmall, padding: "3px 8px", fontSize: 11, minWidth: 28,
                                            background: numVariants === n ? "var(--accent-light)" : "transparent",
                                            borderColor: numVariants === n ? "var(--accent)" : "var(--border-default)",
                                            color: numVariants === n ? "var(--accent)" : "var(--text-secondary)",
                                        }}>{n}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Seed */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 70 }}>
                                <span style={{
                                    fontSize: 9, color: "var(--text-ghost)", fontFamily: "var(--font-condensed)",
                                    textTransform: "uppercase", letterSpacing: 0.5,
                                }}>Seed</span>
                                <input type="number" value={seed} onChange={e => setSeed(parseInt(e.target.value) || 0)}
                                    style={{
                                        ...inputStyle, width: 70, fontSize: 11, padding: "3px 6px",
                                        textAlign: "center", fontFamily: "var(--font-mono)",
                                    }} />
                            </div>

                            {/* Component summary */}
                            <div style={{
                                flex: 1, padding: "4px 8px", background: "var(--bg-base)",
                                borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)",
                                fontSize: 10, color: "var(--text-secondary)", overflow: "hidden",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{
                                        fontWeight: 600, fontFamily: "var(--font-condensed)",
                                        textTransform: "uppercase", letterSpacing: 0.5,
                                    }}>{visibleComponents.length} components</span>
                                    <span style={{ color: "var(--text-ghost)", fontFamily: "var(--font-mono)", fontSize: 9 }}>
                                        {getAIConfig().model}
                                    </span>
                                </div>
                                {visibleComponents.slice(0, 3).map(c => (
                                    <div key={c.id} style={{
                                        color: "var(--text-muted)", lineHeight: 1.3,
                                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 9,
                                    }}>
                                        {c.name}{c.material && c.material !== "Custom" ? ` (${c.material})` : ""}
                                    </div>
                                ))}
                                {visibleComponents.length > 3 && (
                                    <div style={{ color: "var(--text-ghost)", fontSize: 9 }}>+{visibleComponents.length - 3} more</div>
                                )}
                            </div>
                        </div>

                        {/* Reference image preview */}
                        {refPreview && useReference && (
                            <div style={{
                                borderRadius: "var(--radius-sm)", overflow: "hidden",
                                border: "1px solid var(--border-default)", position: "relative", cursor: "zoom-in",
                            }} onClick={() => openLightbox(refPreview, "Clean Reference Image")}>
                                <img src={refPreview} alt="Reference layout" style={{
                                    width: "100%", display: "block", objectFit: "contain", maxHeight: 280,
                                }} />
                                <div style={{
                                    position: "absolute", top: 4, left: 6, fontSize: 9, color: "var(--accent)",
                                    background: "rgba(255,255,255,0.85)", padding: "1px 6px", borderRadius: 3,
                                    fontFamily: "var(--font-condensed)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
                                }}>
                                    Clean reference — click to enlarge
                                </div>
                                <button onClick={e => { e.stopPropagation(); setRefPreview(null); }} style={{
                                    position: "absolute", top: 4, right: 6, background: "rgba(255,255,255,0.85)",
                                    border: "1px solid var(--border-subtle)", color: "var(--text-muted)",
                                    fontSize: 10, cursor: "pointer", borderRadius: 3, padding: "1px 5px",
                                }}>x</button>
                            </div>
                        )}

                        {/* Error bar */}
                        {error && (
                            <div style={{
                                padding: "6px 10px", background: "rgba(197,48,48,0.08)",
                                border: "1px solid rgba(197,48,48,0.25)", borderRadius: "var(--radius-sm)",
                                color: "var(--error)", fontSize: 11, lineHeight: 1.5,
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Status bar — shown during generation */}
                        {genStatus && (
                            <div style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "6px 10px", background: "var(--bg-base)",
                                border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
                                fontSize: 11, color: "var(--text-secondary)",
                            }}>
                                <span style={{
                                    display: "inline-block", fontSize: 14,
                                    animation: "spin 1s linear infinite",
                                    color: "var(--accent)",
                                }}>⟳</span>
                                <span style={{ flex: 1, fontFamily: "var(--font-condensed)" }}>
                                    Generating variant {genStatus.current} of {genStatus.total}... {genStatus.elapsed}s
                                </span>
                                <button onClick={cancelGeneration} style={{
                                    ...btnSmall, fontSize: 10, padding: "2px 10px",
                                    borderColor: "rgba(197,48,48,0.4)", color: "var(--error)",
                                }}>
                                    Cancel
                                </button>
                            </div>
                        )}

                        {/* Render button — hidden while loading */}
                        {!loading && (
                            <button onClick={() => runGeneration(false)} style={{
                                padding: "8px 16px", fontSize: 13, fontWeight: 600,
                                fontFamily: "var(--font-condensed)", letterSpacing: 0.8, textTransform: "uppercase",
                                background: "var(--accent-light)", border: "1px solid var(--accent)",
                                color: "var(--accent)", borderRadius: "var(--radius-md)", cursor: "pointer",
                                transition: "all 0.2s ease",
                            }}>
                                {useReference ? "Render from Layout" : "Render Scene"}
                                {numVariants > 1 ? ` (×${numVariants})` : ""}
                            </button>
                        )}

                        {/* Pending variants grid — renders appear as they arrive */}
                        {pendingVariants.length > 0 && (
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: pendingVariants.length > 1 ? "1fr 1fr" : "1fr",
                                gap: 8,
                            }}>
                                {pendingVariants.map((r, i) => (
                                    <div key={i} style={{
                                        borderRadius: "var(--radius-sm)", overflow: "hidden",
                                        border: "1px solid var(--border-default)", background: "var(--bg-surface)",
                                    }}>
                                        <img
                                            src={r.image} alt={`Variant ${i + 1}`}
                                            style={{ width: "100%", display: "block", cursor: "zoom-in" }}
                                            onClick={() => openLightbox(r.image, `Variant ${i + 1}`)}
                                        />
                                        <div style={{ padding: "4px 6px", display: "flex", gap: 4, alignItems: "center" }}>
                                            <span style={{
                                                flex: 1, fontSize: 9, color: "var(--text-ghost)",
                                                fontFamily: "var(--font-mono)",
                                            }}>Variant {i + 1} | {r.time}</span>
                                            <button onClick={() => selectVariant(r)} style={{
                                                ...btnSmall, fontSize: 10, padding: "2px 10px",
                                                background: "var(--accent-light)", borderColor: "var(--accent)",
                                                color: "var(--accent)",
                                            }}>Select</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Selected / working render */}
                        {selectedRender && (
                            <div style={{
                                borderRadius: "var(--radius-md)", overflow: "hidden",
                                border: "1px solid var(--accent)",
                            }}>
                                {/* Header */}
                                <div style={{
                                    padding: "6px 10px", background: "var(--accent-light)",
                                    display: "flex", alignItems: "center", gap: 6,
                                    borderBottom: "1px solid var(--border-subtle)",
                                }}>
                                    <span style={{
                                        flex: 1, fontSize: 11, fontWeight: 600, color: "var(--accent)",
                                        fontFamily: "var(--font-condensed)", textTransform: "uppercase", letterSpacing: 0.5,
                                    }}>Working Render</span>
                                    <button onClick={() => openLightbox(selectedRender.image, "Working Render")}
                                        style={{ ...btnSmall, fontSize: 9, padding: "2px 8px" }}>Enlarge</button>
                                    <button onClick={() => downloadImage(selectedRender.image, "render.png")}
                                        style={{ ...btnSmall, fontSize: 9, padding: "2px 8px" }}>Save</button>
                                    <button onClick={acceptToGallery} style={{
                                        ...btnSmall, fontSize: 9, padding: "2px 8px",
                                        background: "var(--accent-light)", borderColor: "var(--accent)", color: "var(--accent)",
                                    }}>→ Gallery</button>
                                    <button onClick={discardSelected} style={{
                                        ...btnSmall, fontSize: 9, padding: "2px 8px",
                                        borderColor: "rgba(197,48,48,0.4)", color: "var(--error)",
                                    }}>Discard</button>
                                </div>

                                {/* Image */}
                                <img
                                    src={selectedRender.image} alt="Working render"
                                    style={{ width: "100%", display: "block", cursor: "zoom-in" }}
                                    onClick={() => openLightbox(selectedRender.image, "Working Render")}
                                />

                                {/* Iterate panel */}
                                <div style={{ padding: 8, background: "var(--bg-surface)", borderTop: "1px solid var(--border-subtle)" }}>
                                    <button onClick={() => setShowIter(!showIter)} style={{
                                        background: "none", border: "none", cursor: "pointer",
                                        fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-condensed)",
                                        fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, padding: 0,
                                    }}>
                                        {showIter ? "▾" : "▸"} Iterate — describe what to fix
                                    </button>
                                    {showIter && (
                                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                                            <textarea
                                                value={iterFeedback}
                                                onChange={e => setIterFeedback(e.target.value)}
                                                rows={3}
                                                placeholder="The blast plate should be single wall, not two. The gravel area needs more texture..."
                                                style={{
                                                    ...inputStyle, resize: "vertical", lineHeight: 1.5,
                                                    textTransform: "none", letterSpacing: 0, fontWeight: 400,
                                                }}
                                            />
                                            <button
                                                onClick={() => runGeneration(true)}
                                                disabled={loading || !iterFeedback.trim()}
                                                style={{
                                                    ...btnSmall, padding: "6px 14px", fontSize: 11,
                                                    background: loading || !iterFeedback.trim() ? "transparent" : "var(--accent-light)",
                                                    borderColor: loading || !iterFeedback.trim() ? "var(--border-default)" : "var(--accent)",
                                                    color: loading || !iterFeedback.trim() ? "var(--text-ghost)" : "var(--accent)",
                                                    cursor: loading || !iterFeedback.trim() ? "not-allowed" : "pointer",
                                                    alignSelf: "flex-start",
                                                }}>
                                                Generate Iteration
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── PROMPT TAB ── */}
                {mode === "prompt" && (
                    <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button onClick={generatePrompt} style={btnSmall}>Generate</button>
                            <button
                                onClick={() => navigator.clipboard.writeText(editedPrompt || promptText)}
                                style={btnSmall}
                                disabled={!editedPrompt && !promptText}>Copy</button>
                            <div style={{ flex: 1 }} />
                            <button
                                onClick={() => renderFromPrompt(editedPrompt || promptText)}
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
                            style={{
                                ...inputStyle, flex: 1, resize: "none",
                                fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6,
                            }} />
                    </div>
                )}

                {/* ── GALLERY TAB ── */}
                {mode === "gallery" && (
                    <div style={{ flex: 1, padding: 12 }}>
                        <div style={{
                            fontSize: 11, color: "var(--text-secondary)", letterSpacing: 1,
                            textTransform: "uppercase", fontWeight: 600, marginBottom: 8,
                            fontFamily: "var(--font-condensed)",
                        }}>
                            Accepted Renders ({gallery.length})
                        </div>
                        {gallery.length === 0 ? (
                            <div style={{ color: "var(--text-ghost)", fontSize: 12, textAlign: "center", marginTop: 40 }}>
                                No renders yet. Generate and accept renders to the gallery.
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                {gallery.map((r, i) => (
                                    <div key={i} style={{
                                        borderRadius: "var(--radius-sm)", overflow: "hidden",
                                        border: "1px solid var(--border-default)", background: "var(--bg-surface)",
                                        cursor: "zoom-in",
                                    }} onClick={() => openLightbox(r.image, `Gallery ${i + 1} | seed:${r.seed}`)}>
                                        <img src={r.image} alt={`Gallery ${i + 1}`} style={{ width: "100%", display: "block" }} />
                                        <div style={{
                                            padding: "4px 8px", fontSize: 9, color: "var(--text-muted)",
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            fontFamily: "var(--font-mono)",
                                        }}>
                                            <span>{r.time} | seed:{r.seed}{r.hadReference ? " | ref" : ""}</span>
                                            <div style={{ display: "flex", gap: 4 }}>
                                                <button onClick={e => { e.stopPropagation(); downloadImage(r.image, `render-${i + 1}.png`); }}
                                                    style={{
                                                        background: "none", border: "none", cursor: "pointer",
                                                        fontSize: 9, color: "var(--accent)", fontFamily: "var(--font-condensed)", fontWeight: 600,
                                                    }}>Save</button>
                                                <button onClick={e => {
                                                    e.stopPropagation();
                                                    setSelectedRender(r);
                                                    setMode("render");
                                                }} style={{
                                                    background: "none", border: "none", cursor: "pointer",
                                                    fontSize: 9, color: "var(--text-secondary)", fontFamily: "var(--font-condensed)", fontWeight: 600,
                                                }}>Iterate</button>
                                            </div>
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
