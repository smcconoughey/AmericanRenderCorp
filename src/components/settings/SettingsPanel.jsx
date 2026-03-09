import { useState } from "react";
import { getAIConfig, saveAIConfig } from "../../services/aiRenderer.js";

const inputStyle = {
    background: "var(--bg-deep)", border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-sm)", padding: "5px 8px", color: "var(--text-primary)",
    fontSize: 12, width: "100%", boxSizing: "border-box", outline: "none",
};

const labelStyle = {
    display: "flex", flexDirection: "column", gap: 4,
    fontSize: 11, color: "var(--text-muted)", fontWeight: 500,
};

const btnSmall = {
    padding: "4px 12px", fontSize: 11, background: "transparent",
    border: "1px solid var(--border-default)", color: "var(--text-secondary)",
    borderRadius: "var(--radius-sm)", cursor: "pointer",
};

export default function SettingsPanel({ onClose }) {
    const [config, setConfig] = useState(getAIConfig());
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        saveAIConfig(config);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const updateConfig = (key, val) => { setConfig(prev => ({ ...prev, [key]: val })); setSaved(false); };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", width: 420, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Settings</span>
                    <button onClick={onClose} style={{ ...btnSmall, padding: "2px 8px" }}>✕</button>
                </div>

                <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Units info */}
                    <div style={{ padding: "8px 12px", background: "var(--accent-glow)", border: "1px solid var(--accent-dim)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--accent)" }}>
                        All scene dimensions are in <strong>feet</strong>. No unit conversion needed.
                    </div>

                    {/* AI Config */}
                    <div>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
                            AI Rendering Configuration
                        </span>
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                            <label style={labelStyle}>
                                Provider
                                <select value={config.provider} onChange={e => updateConfig("provider", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                                    <option value="gemini">Google Gemini (Image Generation)</option>
                                    <option value="custom">Custom Endpoint</option>
                                </select>
                            </label>
                            <label style={labelStyle}>
                                API Key
                                <input type="password" value={config.apiKey} onChange={e => updateConfig("apiKey", e.target.value)} placeholder="Enter your Gemini API key..." style={inputStyle} />
                                <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>Get a key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>aistudio.google.com</a>. Stored in localStorage only.</span>
                            </label>
                            <label style={labelStyle}>
                                Model
                                <select value={config.model} onChange={e => updateConfig("model", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                                    <option value="gemini-2.0-flash-exp-image-generation">Gemini 2.0 Flash Image Gen</option>
                                    <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                                    <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image</option>
                                    <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image</option>
                                </select>
                                <span style={{ fontSize: 10, color: "var(--text-ghost)" }}>Uses generateContent with native image output — one prompt, one complete scene.</span>
                            </label>
                            <label style={labelStyle}>
                                Aspect Ratio
                                <select value={config.resolution} onChange={e => updateConfig("resolution", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                                    <option value="16:9">16:9 (Landscape)</option>
                                    <option value="3:2">3:2 (Photo)</option>
                                    <option value="1:1">1:1 (Square)</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
                        <button onClick={onClose} style={btnSmall}>Cancel</button>
                        <button onClick={handleSave} style={{
                            ...btnSmall,
                            background: saved ? "rgba(52,211,153,0.15)" : "var(--accent-glow)",
                            color: saved ? "var(--success)" : "var(--accent)",
                            borderColor: saved ? "rgba(52,211,153,0.3)" : "var(--accent-dim)",
                        }}>
                            {saved ? "✓ Saved" : "Save Settings"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
