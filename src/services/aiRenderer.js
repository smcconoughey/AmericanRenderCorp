/**
 * AI Renderer Service — handles communication with AI image generation APIs
 * Supports Google Gemini Imagen and can be extended for other providers.
 */

const STORAGE_KEY = "arc_ai_config";

/**
 * Get saved AI configuration from localStorage
 */
export function getAIConfig() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return {
        provider: "gemini",
        apiKey: "",
        model: "imagen-3.0-generate-002",
        resolution: "1024x1024",
        quality: "high",
    };
}

/**
 * Save AI configuration to localStorage  
 */
export function saveAIConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * Parse the scale setting string to get pixels-per-unit and unit name
 */
function parseScale(scaleSetting) {
    const match = scaleSetting?.match(/1(ft|m)\s*=\s*(\d+)px/);
    if (!match) return { unit: "ft", pxPerUnit: 20 };
    return { unit: match[1], pxPerUnit: parseInt(match[2]) };
}

/**
 * Build a structured prompt for the entire scene background/environment
 */
export function buildEnvironmentPrompt(sceneNotes, components, scaleSetting) {
    const { unit, pxPerUnit } = parseScale(scaleSetting);
    const sceneWidth = Math.max(...components.map(c => c.x + c.w));
    const sceneHeight = Math.max(...components.map(c => c.y + c.h));
    const realWidth = (sceneWidth / pxPerUnit).toFixed(0);
    const realHeight = (sceneHeight / pxPerUnit).toFixed(0);

    return `Photorealistic architectural visualization of an outdoor environment.
Scene dimensions: approximately ${realWidth}${unit} wide by ${realHeight}${unit} deep.
${sceneNotes || "Open terrain, clear sky, natural daylight."}
Camera: Aerial perspective, 30-45° elevation angle, looking north.
Lighting: Natural daylight with soft shadows.
Style: High-quality architectural visualization, photorealistic.
Do NOT include any structures or equipment — render ONLY the empty environment/terrain.
The ground should show appropriate textures (concrete pads, gravel areas, natural terrain).`;
}

/**
 * Build a structured prompt for a single component
 */
export function buildComponentPrompt(component, scaleSetting, sceneNotes) {
    const { unit, pxPerUnit } = parseScale(scaleSetting);
    const realW = (component.w / pxPerUnit).toFixed(1);
    const realH = (component.h / pxPerUnit).toFixed(1);
    const realDepth = component.depth;

    let prompt = `Photorealistic render of: "${component.name}"
Real-world dimensions: ${realW}${unit} wide × ${realH}${unit} deep × ${realDepth}${unit} tall.
`;

    if (component.notes) {
        prompt += `Description: ${component.notes}\n`;
    }

    prompt += `Render on a TRANSPARENT or PLAIN background for compositing.
Viewing angle: Aerial perspective, 30-45° elevation, consistent with architectural visualization.
Lighting: Natural daylight from upper-left, matching outdoor scene lighting.
Style: Photorealistic, materials rendered accurately.
Scale reference: This object is ${realW}${unit} × ${realH}${unit} × ${realDepth}${unit}.`;

    if (component.refImages && component.refImages.length > 0) {
        prompt += `\n⚠ Reference image(s) provided — match the visual style and details as closely as possible.`;
    }

    return prompt;
}

/**
 * Build composite assembly instructions
 */
export function buildCompositeInstructions(components, scaleSetting) {
    const { unit, pxPerUnit } = parseScale(scaleSetting);
    const sorted = [...components].sort((a, b) => a.z - b.z);

    const lines = sorted.map((c, i) => {
        const realX = (c.x / pxPerUnit).toFixed(1);
        const realY = (c.y / pxPerUnit).toFixed(1);
        return `${i + 1}. "${c.name}" — place at (${realX}${unit}, ${realY}${unit}), size ${(c.w / pxPerUnit).toFixed(1)}×${(c.h / pxPerUnit).toFixed(1)}${unit}, height ${c.depth}${unit}`;
    });

    return `COMPOSITE ASSEMBLY INSTRUCTIONS
================================
Place each rendered component onto the environment base at these positions:

${lines.join("\n")}

Ensure consistent perspective, lighting direction, and shadow angles across all components.
Apply final color grading and atmospheric effects for cohesion.`;
}

/**
 * Generate render via Gemini Imagen API
 * Returns a base64 data URI of the generated image
 */
export async function generateRender(prompt, config, referenceImages = []) {
    if (!config.apiKey) {
        throw new Error("API key not configured. Go to Settings to add your Gemini API key.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:predict?key=${config.apiKey}`;

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const imageBytes = data.predictions?.[0]?.bytesBase64Encoded;
    if (!imageBytes) {
        throw new Error("No image data in API response");
    }

    return `data:image/png;base64,${imageBytes}`;
}

/**
 * Build a full structured prompt document for manual use
 */
export function buildFullPromptDocument(components, sceneNotes, scaleSetting, mode = "composite") {
    const { unit, pxPerUnit } = parseScale(scaleSetting);

    const compDescs = components.map((c, i) => {
        const realW = (c.w / pxPerUnit).toFixed(1);
        const realH = (c.h / pxPerUnit).toFixed(1);
        let desc = `[${i + 1}] "${c.name}" — position: (${(c.x / pxPerUnit).toFixed(1)}${unit}, ${(c.y / pxPerUnit).toFixed(1)}${unit}), footprint: ${realW}×${realH}${unit}, height: ${c.depth}${unit}`;
        if (c.notes) desc += `\n    Details: ${c.notes}`;
        if (c.refImages?.length) desc += `\n    ⚠ Has ${c.refImages.length} reference image(s) attached`;
        return desc;
    }).join("\n\n");

    if (mode === "composite") {
        return `ARCHITECTURAL RENDER — COMPOSITE PIPELINE
==========================================

SCENE OVERVIEW:
${sceneNotes || "Outdoor test facility, clear day, photorealistic rendering"}

CAMERA: Aerial perspective, 30-45° angle, looking north
LIGHTING: Natural daylight, soft shadows, golden hour optional
STYLE: Photorealistic architectural visualization

COMPONENT MANIFEST (render order, back to front):
${compDescs}

SCALE CONSTRAINTS:
- All components must maintain relative proportions as defined
- 1${unit} = ${pxPerUnit}px in the layout
- Camera distance should show full scene with ~10% margin

COMPOSITING PIPELINE:
1. Render background/environment (sky, vegetation, terrain)
2. Render ground plane with gravel/concrete textures
3. For each component (sorted by Z, then Y):
   a. Generate component at correct scale relative to scene
   b. Match lighting direction and shadow angles
   c. Apply component-specific material/texture notes
4. Final composite: color grade, ambient occlusion, atmospheric haze`;
    }

    // Per-component mode
    const perComp = components.map((c, i) => {
        const realW = (c.w / pxPerUnit).toFixed(1);
        const realH = (c.h / pxPerUnit).toFixed(1);
        return `--- COMPONENT ${i + 1}: "${c.name}" ---
Render this component ISOLATED on transparent background.
Dimensions: ${realW}×${realH}${unit} footprint, ${c.depth}${unit} tall
Viewing angle: Match main scene camera (aerial 30-45°)
${c.notes ? `Details: ${c.notes}` : ""}
${c.refImages?.length ? `Reference images provided — match these closely.` : ""}
Lighting: Match scene lighting direction (sun from upper-left)`;
    }).join("\n\n");

    return `ARCHITECTURAL RENDER — PER-COMPONENT PIPELINE
==============================================

This workflow renders each component separately, then composites.
Each component prompt below should be sent individually.

SCENE CAMERA REFERENCE:
- Aerial perspective, 30-45° elevation
- Looking approximately north
- Scale: 1${unit} = ${pxPerUnit}px

${perComp}

FINAL COMPOSITE INSTRUCTIONS:
1. Start with environment/background render
2. Place each component render at its position
3. Scale each to match footprint dimensions
4. Add unified shadow pass
5. Color grade for consistency`;
}
