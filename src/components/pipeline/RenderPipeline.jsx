import { useState } from "react";
import {
    buildFullPromptDocument, buildEnvironmentPrompt, buildComponentPrompt,
    buildCompositeInstructions, generateRender, getAIConfig
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

const btnAccent = {
    ...btnSmall, background: "var(--accent-glow)", color: "var(--accent)",
    borderColor: "var(--accent-dim)",
};

const PIPELINE_STEPS = [
    { key: "environment", label: "1. Environment", icon: "🌍", desc: "Generate base terrain/sky" },
    { key: "components", label: "2. Components", icon: "🏗️", desc: "Render each part individually" },
    { key: "composite", label: "3. Composite", icon: "🎨", desc: "Assemble all renders at scale" },
    { key: "refine", label: "4. Refine", icon: "✨", desc: "Re-render individual parts" },
];

export default function RenderPipeline({ components, sceneNotes, onSceneNotesChange }) {
    const [mode, setMode] = useState("pipeline");
    const [generated, setGenerated] = useState("");
    const [activeStep, setActiveStep] = useState("environment");
    const [loading, setLoading] = useState(false);
    const [renders, setRenders] = useState({});
    const [renderLog, setRenderLog] = useState([]);

    const addLog = (msg) => setRenderLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);

    const generateStructured = (promptMode) => {
        const text = buildFullPromptDocument(components, sceneNotes, promptMode);
        setGenerated(text);
    };

    const renderStep = async (step) => {
        const config = getAIConfig();
        if (!config.apiKey) {
            addLog("⚠ No API key configured. Go to Settings to add your Gemini API key.");
            return;
        }
        setLoading(true);
        try {
            if (step === "environment") {
                addLog("🌍 Generating environment render...");
                const prompt = buildEnvironmentPrompt(sceneNotes, components);
                const result = await generateRender(prompt, config);
                setRenders(prev => ({ ...prev, environment: result }));
                addLog("✓ Environment render complete");
            } else if (step === "components") {
                addLog("🏗️ Starting per-component renders...");
                for (const comp of components) {
                    addLog(`  → Rendering "${comp.name}"...`);
                    const prompt = buildComponentPrompt(comp);
                    try {
                        const result = await generateRender(prompt, config, comp.refImages);
                        setRenders(prev => ({ ...prev, [`comp_${comp.id}`]: result }));
                        addLog(`  ✓ "${comp.name}" complete`);
                    } catch (err) {
                        addLog(`  ✗ "${comp.name}" failed: ${err.message}`);
                    }
                }
                addLog("✓ All component renders complete");
            }
        } catch (err) {
            addLog(`✗ Error: ${err.message}`);
        }
        setLoading(false);
    };

    const renderSingleComponent = async (compId) => {
        const config = getAIConfig();
        if (!config.apiKey) { addLog("⚠ No API key configured."); return; }
        const comp = components.find(c => c.id === compId);
        if (!comp) return;
        setLoading(true);
        addLog(`✨ Re-rendering "${comp.name}"...`);
        try {
            const prompt = buildComponentPrompt(comp);
            const result = await generateRender(prompt, config, comp.refImages);
            setRenders(prev => ({ ...prev, [`comp_${comp.id}`]: result }));
            addLog(`✓ "${comp.name}" re-render complete`);
        } catch (err) {
            addLog(`✗ Error: ${err.message}`);
        }
        setLoading(false);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Tab bar */}
            <div style={{
                padding: "4px 12px", borderBottom: "1px solid var(--border-subtle)",
                display: "flex", gap: 6, alignItems: "center",
            }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
                    Render Pipeline
                </span>
                <div style={{ flex: 1 }} />
                {[
                    { key: "pipeline", label: "Pipeline" },
                    { key: "prompt", label: "Prompt Editor" },
                    { key: "gallery", label: "Gallery" },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setMode(tab.key)} style={{
                        ...btnSmall, fontSize: 10, padding: "2px 8px",
                        background: mode === tab.key ? "var(--bg-hover)" : "transparent",
                        borderColor: mode === tab.key ? "var(--accent-dim)" : "var(--border-default)",
                        color: mode === tab.key ? "var(--accent)" : "var(--text-muted)",
                    }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ flex: 1, overflow: "auto", display: "flex" }}>
                {mode === "pipeline" && (
                    <div style={{ flex: 1, display: "flex", gap: 0 }}>
                        {/* Steps */}
                        <div style={{ width: 240, borderRight: "1px solid var(--border-subtle)", padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                            {PIPELINE_STEPS.map(step => (
                                <button key={step.key} onClick={() => setActiveStep(step.key)} style={{
                                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                                    background: activeStep === step.key ? "var(--bg-hover)" : "transparent",
                                    border: activeStep === step.key ? "1px solid var(--accent-dim)" : "1px solid transparent",
                                    borderRadius: "var(--radius-sm)", cursor: "pointer", textAlign: "left",
                                    color: "var(--text-primary)", width: "100%",
                                }}>
                                    <span style={{ fontSize: 16 }}>{step.icon}</span>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 500 }}>{step.label}</div>
                                        <div style={{ fontSize: 10, color: "var(--text-ghost)" }}>{step.desc}</div>
                                    </div>
                                    {renders[step.key === "components" ? `comp_${components[0]?.id}` : step.key] && (
                                        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--success)" }}>✓</span>
                                    )}
                                </button>
                            ))}
                            <div style={{ marginTop: "auto", paddingTop: 8 }}>
                                <button onClick={() => renderStep(activeStep)} disabled={loading}
                                    style={{ ...btnAccent, width: "100%", padding: "6px 10px", opacity: loading ? 0.5 : 1 }}>
                                    {loading ? "⟳ Rendering..." : `▶ Run ${activeStep}`}
                                </button>
                            </div>
                        </div>

                        {/* Step content */}
                        <div style={{ flex: 1, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                            {activeStep === "environment" && (
                                <>
                                    <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                        Scene Notes
                                        <textarea value={sceneNotes} onChange={e => onSceneNotesChange(e.target.value)} rows={3}
                                            placeholder="Overall scene description..." style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", marginTop: 4 }} />
                                    </label>
                                    {renders.environment && (
                                        <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-default)" }}>
                                            <img src={renders.environment} alt="Environment" style={{ width: "100%", display: "block" }} />
                                        </div>
                                    )}
                                </>
                            )}

                            {activeStep === "components" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                        Each component renders individually with its reference images, notes, and real-world dimensions in feet.
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                        {components.map(comp => (
                                            <div key={comp.id} style={{
                                                border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
                                                overflow: "hidden", background: "var(--bg-surface)",
                                            }}>
                                                {renders[`comp_${comp.id}`] ? (
                                                    <img src={renders[`comp_${comp.id}`]} alt={comp.name} style={{ width: "100%", display: "block", aspectRatio: "1" }} />
                                                ) : (
                                                    <div style={{
                                                        aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                                                        background: comp.color + "22", color: "var(--text-ghost)", fontSize: 11,
                                                    }}>Not rendered</div>
                                                )}
                                                <div style={{ padding: "4px 8px", fontSize: 10, color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
                                                    <span>{comp.name}</span>
                                                    <span style={{ color: "var(--text-ghost)", fontFamily: "var(--font-mono)" }}>
                                                        {comp.width}×{comp.length}×{comp.height}ft
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeStep === "composite" && (
                                <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                                    <div style={{ marginBottom: 8 }}>
                                        Composites all rendered components into the scene at their visual positions and relative scales.
                                    </div>
                                    <pre style={{ ...inputStyle, fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", lineHeight: 1.5, padding: 10, maxHeight: 200, overflowY: "auto" }}>
                                        {buildCompositeInstructions(components)}
                                    </pre>
                                </div>
                            )}

                            {activeStep === "refine" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                        Re-render individual components without affecting others:
                                    </div>
                                    {components.map(comp => (
                                        <button key={comp.id} onClick={() => renderSingleComponent(comp.id)} disabled={loading}
                                            style={{ ...btnSmall, display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "6px 10px" }}>
                                            <div style={{ width: 10, height: 10, background: comp.color, borderRadius: 2 }} />
                                            <span style={{ flex: 1 }}>{comp.name}</span>
                                            <span style={{ fontSize: 9, color: "var(--text-ghost)", fontFamily: "var(--font-mono)" }}>
                                                {comp.width}×{comp.length}×{comp.height}ft
                                            </span>
                                            {renders[`comp_${comp.id}`] && <span style={{ color: "var(--success)", fontSize: 10 }}>✓</span>}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {renderLog.length > 0 && (
                                <div style={{ marginTop: "auto", borderTop: "1px solid var(--border-subtle)", paddingTop: 8, maxHeight: 100, overflowY: "auto" }}>
                                    <div style={{ fontSize: 10, color: "var(--text-ghost)", marginBottom: 4 }}>Render Log</div>
                                    {renderLog.map((entry, i) => (
                                        <div key={i} style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
                                            <span style={{ color: "var(--text-ghost)" }}>{entry.time}</span> {entry.msg}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {mode === "prompt" && (
                    <div style={{ flex: 1, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => generateStructured("composite")} style={btnSmall}>Composite Prompt</button>
                            <button onClick={() => generateStructured("percomp")} style={btnSmall}>Per-Component Prompt</button>
                            <button onClick={() => { navigator.clipboard.writeText(generated); }}
                                style={{ ...btnSmall, marginLeft: "auto" }} disabled={!generated}>📋 Copy</button>
                        </div>
                        <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Scene Notes
                            <textarea value={sceneNotes} onChange={e => onSceneNotesChange(e.target.value)} rows={2}
                                placeholder="Overall scene description..." style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", marginTop: 4 }} />
                        </label>
                        <textarea value={generated} onChange={e => setGenerated(e.target.value)}
                            placeholder="Generate a prompt above, then edit and copy for your AI image generator."
                            style={{ ...inputStyle, flex: 1, resize: "none", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6 }} />
                    </div>
                )}

                {mode === "gallery" && (
                    <div style={{ flex: 1, padding: 10 }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
                            Render Gallery
                        </div>
                        {Object.keys(renders).length === 0 ? (
                            <div style={{ color: "var(--text-ghost)", fontSize: 12, textAlign: "center", marginTop: 40 }}>
                                No renders yet. Use the Pipeline or Prompt Editor to generate renders.
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                                {Object.entries(renders).map(([key, src]) => (
                                    <div key={key} style={{ borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
                                        <img src={src} alt={key} style={{ width: "100%", display: "block" }} />
                                        <div style={{ padding: "4px 6px", fontSize: 9, color: "var(--text-ghost)" }}>{key.replace("comp_", "")}</div>
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
