/**
 * AI Renderer Service — all dimensions in FEET
 * No pixel/scale conversion needed — components store real-world feet directly.
 */

const STORAGE_KEY = "arc_ai_config";

export function getAIConfig() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return {
        provider: "gemini",
        apiKey: "",
        model: "imagen-4.0-generate-001",
        resolution: "1024x1024",
        quality: "high",
    };
}

export function saveAIConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * Build environment prompt — describes the empty scene
 */
export function buildEnvironmentPrompt(sceneNotes, components) {
    const maxX = Math.max(...components.map(c => c.x + c.width));
    const maxY = Math.max(...components.map(c => c.y + c.length));

    return `Photorealistic architectural visualization of an outdoor environment.
Scene covers approximately ${maxX.toFixed(0)}ft wide by ${maxY.toFixed(0)}ft deep.
${sceneNotes || "Open terrain, clear sky, natural daylight."}
Camera: Elevated perspective, 30-45° angle, looking across the scene.
Lighting: Natural daylight with soft shadows.
Style: High-quality architectural visualization, photorealistic.
Render ONLY the empty environment — no structures or equipment.
Ground should show appropriate terrain textures.`;
}

/**
 * Build prompt for a single component — all dimensions in feet
 */
export function buildComponentPrompt(component) {
    let prompt = `Photorealistic render of: "${component.name}"
Real-world size: ${component.width}ft wide × ${component.length}ft deep × ${component.height}ft tall.
`;

    if (component.material && component.material !== "Custom") {
        prompt += `Material: ${component.material}\n`;
    }
    if (component.notes) {
        prompt += `Details: ${component.notes}\n`;
    }

    prompt += `
Render on a PLAIN or TRANSPARENT background for compositing.
Viewing angle: Elevated perspective, 30-45°, consistent with architectural visualization.
Lighting: Natural daylight from upper-left.
Style: Photorealistic, materials rendered accurately.
This is a real-world object — it is exactly ${component.width}ft × ${component.length}ft × ${component.height}ft.`;

    if (component.refImages?.length > 0) {
        prompt += `\n⚠ Reference image(s) provided — match the appearance closely while maintaining the specified dimensions.`;
    }

    return prompt;
}

/**
 * Build composite assembly instructions
 */
export function buildCompositeInstructions(components) {
    const sorted = [...components].sort((a, b) => a.z - b.z);

    const lines = sorted.map((c, i) =>
        `${i + 1}. "${c.name}" — ${c.width}ft × ${c.length}ft × ${c.height}ft tall, positioned at (${c.x}ft, ${c.y}ft from origin)`
    );

    return `COMPOSITE ASSEMBLY INSTRUCTIONS
================================
All dimensions in FEET. Place each rendered component at its scene position:

${lines.join("\n")}

The visual layout determines how large/small each component appears in the final render.
Components further from camera appear smaller. Maintain consistent perspective and lighting across all components.
Apply final color grading and atmospheric effects for cohesion.`;
}

/**
 * Build full prompt document for copy-paste into AI generators
 */
export function buildFullPromptDocument(components, sceneNotes, mode = "composite") {
    const compDescs = components.map((c, i) => {
        let desc = `[${i + 1}] "${c.name}" — ${c.width}ft wide × ${c.length}ft deep × ${c.height}ft tall, at position (${c.x}ft, ${c.y}ft)`;
        if (c.material && c.material !== "Custom") desc += `\n    Material: ${c.material}`;
        if (c.notes) desc += `\n    Details: ${c.notes}`;
        if (c.refImages?.length) desc += `\n    ⚠ Has ${c.refImages.length} reference image(s)`;
        return desc;
    }).join("\n\n");

    if (mode === "composite") {
        return `ARCHITECTURAL RENDER — COMPOSITE PIPELINE
==========================================
ALL DIMENSIONS IN FEET

SCENE OVERVIEW:
${sceneNotes || "Outdoor test facility, clear day, photorealistic rendering"}

CAMERA: Elevated perspective, 30-45° angle
LIGHTING: Natural daylight, soft shadows
STYLE: Photorealistic architectural visualization

COMPONENT MANIFEST:
${compDescs}

SCALE CONSTRAINTS:
- All components must maintain their specified real-world dimensions in feet
- A 20ft shipping container should appear to scale next to a 25ft tall test stand
- Maintain proper perspective — objects further away appear smaller naturally

VISUAL COMPOSITION:
- The spatial layout defines how the scene looks from the camera
- Relative positions and sizes create the depth and perspective
- Think of this as a film set — everything is positioned for the camera view

COMPOSITING PIPELINE:
1. Render background/environment (sky, vegetation, terrain)
2. For each component (sorted by distance from camera):
   a. Generate at correct real-world scale
   b. Match lighting direction and shadow angles
   c. Apply material/texture notes
3. Final composite: color grade, ambient occlusion, atmospheric haze`;
    }

    // Per-component mode
    const perComp = components.map((c, i) =>
        `--- COMPONENT ${i + 1}: "${c.name}" ---
Render ISOLATED on transparent background.
Size: ${c.width}ft wide × ${c.length}ft deep × ${c.height}ft tall
${c.material && c.material !== "Custom" ? `Material: ${c.material}` : ""}
${c.notes ? `Details: ${c.notes}` : ""}
${c.refImages?.length ? "Reference images provided — match closely." : ""}
Viewing angle: Elevated 30-45°, match main scene camera.
Lighting: Natural daylight from upper-left.`
    ).join("\n\n");

    return `ARCHITECTURAL RENDER — PER-COMPONENT PIPELINE
==============================================
ALL DIMENSIONS IN FEET

Render each component separately then composite.

${perComp}

COMPOSITE INSTRUCTIONS:
1. Start with environment/background render
2. Place each component at its scene position
3. Scale to match real-world dimensions
4. Unified shadow + color grading pass`;
}

/**
 * Generate render via Gemini Imagen API
 */
export async function generateRender(prompt, config, referenceImages = []) {
    if (!config.apiKey) {
        throw new Error("API key not configured. Go to Settings to add your Gemini API key.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:predict`;

    const body = {
        instances: [{ prompt }],
        parameters: {
            sampleCount: 1,
            aspectRatio: config.resolution === "1024x1024" ? "1:1" :
                config.resolution === "1536x1024" ? "3:2" : "16:9",
        },
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": config.apiKey,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const imageBytes = data.predictions?.[0]?.bytesBase64Encoded;
    if (!imageBytes) throw new Error("No image data in API response");

    return `data:image/png;base64,${imageBytes}`;
}
