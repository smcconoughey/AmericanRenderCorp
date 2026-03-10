/**
 * AI Renderer Service — Full-scene rendering via Gemini generateContent
 * 
 * Sends the scene layout as a reference image + text prompt to Gemini,
 * which transforms it into a photorealistic render while preserving the layout.
 */

const STORAGE_KEY = "arc_ai_config";

export function getAIConfig() {
    const defaults = {
        provider: "gemini",
        apiKey: "",
        model: "gemini-3-pro-image-preview",
        resolution: "16:9",
        quality: "high",
    };
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const config = { ...defaults, ...JSON.parse(stored) };
            // Migrate deprecated model names
            const deprecated = [
                "imagen-3.0-generate-002", "imagen-3.0-generate-001",
                "imagen-3.0-fast-generate-001", "imagen-4.0-generate-001",
                "gemini-2.0-flash-exp",
                "gemini-2.5-flash-preview-native-audio-dialog",
                "gemini-2.0-flash-exp-image-generation",
            ];
            if (deprecated.includes(config.model)) {
                config.model = defaults.model;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
            }
            return config;
        }
    } catch (e) { /* ignore */ }
    return defaults;
}

export function saveAIConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * Build scene prompt — describes what to render
 * When a reference image is provided, the prompt tells the model to
 * transform the layout image into a photorealistic scene.
 */
export function buildScenePrompt(components, sceneNotes, hasReferenceImage = false) {
    if (!components.length) return "Generate a photorealistic outdoor environment with flat terrain and clear sky.";

    const visibleComps = components.filter(c => c.visible !== false);

    // Build detailed component descriptions with exact positions and sizes
    const compDescs = visibleComps
        .map(c => {
            let desc = `• "${c.name}" — ${c.width}ft wide × ${c.length}ft deep × ${c.height}ft tall, at position (${c.x}, ${c.y})`;
            if (c.material && c.material !== "Custom") desc += `, material: ${c.material}`;
            if (c.notes) desc += `. ${c.notes}`;
            return desc;
        }).join("\n");

    // Calculate scene extents for context
    const minX = Math.min(...visibleComps.map(c => c.x));
    const minY = Math.min(...visibleComps.map(c => c.y));
    const maxX = Math.max(...visibleComps.map(c => c.x + c.width));
    const maxY = Math.max(...visibleComps.map(c => c.y + c.length));
    const sceneW = (maxX - minX).toFixed(0);
    const sceneD = (maxY - minY).toFixed(0);

    if (hasReferenceImage) {
        return `You are an architectural visualization renderer. The attached image is a STRICT LAYOUT BLUEPRINT showing the exact positions and sizes of all components from an elevated isometric angle.

YOUR #1 PRIORITY: Every object in your output MUST be in THE SAME POSITION, at THE SAME RELATIVE SIZE, and in THE SAME ARRANGEMENT as shown in the blueprint image. Do NOT rearrange, reposition, resize, or omit any object. The spatial layout is sacred — match it exactly.

SCENE CONTEXT:
${sceneNotes || "Outdoor test facility on flat cleared terrain, natural daylight."}

TOTAL SITE BOUNDARY: approximately ${sceneW}ft × ${sceneD}ft (this is the outer boundary of the site — the ground is natural terrain: grass, dirt, or sandy soil UNLESS a component explicitly specifies a paved/concrete/gravel surface)

EXACT COMPONENT COUNT: ${visibleComps.length}. There are EXACTLY ${visibleComps.length} distinct objects in this scene. Each object below appears EXACTLY ONCE — do NOT duplicate any of them. If a component appears in this list only once, render it only once.

COMPONENTS (each appears exactly once):
${compDescs}

RENDERING RULES:
1. COUNT ENFORCEMENT: Render EXACTLY ${visibleComps.length} objects — one for each component listed above. Never duplicate a component.
2. LAYOUT FIDELITY: Match the reference image layout EXACTLY. Same camera angle, same relative positions, same proportions. If a component is in the top-left of the blueprint, it must be in the top-left of your render.
3. COMPONENT DETAILS: Each component's name describes what it is. Honor the name — a "Blast Plate" is a single large vertical blast deflector wall, a "Gravel Area" is a flat gravel surface at ground level, etc. Use the component notes when provided.
4. MATERIALS: Replace the solid-colored blocks with photorealistic versions — real concrete, real steel, real gravel, real materials with weathering and texture.
5. LIGHTING: Natural outdoor daylight with soft shadows. Golden-hour or midday feel.
6. ENVIRONMENT: Appropriate terrain and vegetation around the site. Do not let vegetation obscure the components.
7. CAMERA: Match the elevated isometric perspective from the reference image. Show the full site.
8. NO TEXT: Do not add any text, labels, dimensions, annotations, or watermarks.
9. NO EXTRAS: Do not add objects, vehicles, or structures that are not in the component list above.`;
    }

    // No reference image — text-only prompt
    return `Generate a photorealistic architectural visualization of this facility.

${sceneNotes || "Outdoor test facility on flat terrain, clear sky, natural daylight."}

Scene footprint: approximately ${sceneW}ft × ${sceneD}ft

The scene contains:
${compDescs}

Camera: Elevated perspective, 30-40° angle, showing the full layout.
Lighting: Natural daylight with soft shadows.
Style: Photorealistic architectural visualization.
IMPORTANT: DO NOT add any text, labels, dimensions, or annotations. Render only the physical scene.`;
}

/**
 * Build full prompt document for copy-paste
 */
export function buildFullPromptDocument(components, sceneNotes) {
    return buildScenePrompt(components, sceneNotes, false);
}

/**
 * Build iteration prompt for refining an existing render.
 * Image 1 (caller provides): spatial layout blueprint
 * Image 2 (caller provides): the current render to correct
 */
function buildIterationPrompt(feedback) {
    return `You are refining an existing architectural render.
Image 1: spatial layout blueprint (correct positions/sizes)
Image 2: the CURRENT RENDER to correct

Apply ONLY these corrections:
${feedback}

Keep everything else identical — camera angle, lighting, materials, composition. Only modify what is stated above.`;
}

/**
 * Generate a scene render via Gemini generateContent API.
 * Optionally accepts a reference image (base64 data URL) that the model
 * will use as a layout guide. Seed enables reproducible renders.
 *
 * @param {string} prompt - Scene description prompt
 * @param {object} config - AI config (apiKey, model, etc.)
 * @param {string|null} referenceImageDataUrl - Layout blueprint image (Image 1)
 * @param {number|null} seed - Reproducibility seed
 * @param {AbortSignal|null} signal - AbortController signal for cancellation
 * @param {string|null} baseRenderDataUrl - Current render to refine (Image 2, iteration mode)
 * @param {string|null} iterationFeedback - Correction instructions (iteration mode)
 */
export async function generateSceneRender(
    prompt, config, referenceImageDataUrl = null, seed = null,
    signal = null, baseRenderDataUrl = null, iterationFeedback = null
) {
    if (!config.apiKey) {
        throw new Error("API key not configured. Go to Settings to add your Gemini API key.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;

    const isIteration = !!(baseRenderDataUrl && iterationFeedback);

    // Build parts array:
    // Normal mode:    [refImage?, text]
    // Iteration mode: [refImage (blueprint), currentRender, iterationText]
    const parts = [];

    if (referenceImageDataUrl) {
        const match = referenceImageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
            parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
    }

    if (isIteration) {
        const match = baseRenderDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
            parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
    }

    parts.push({ text: isIteration ? buildIterationPrompt(iterationFeedback) : prompt });

    const generationConfig = {
        responseModalities: ["IMAGE", "TEXT"],
        temperature: 0,
    };
    if (seed !== null && seed !== undefined) {
        generationConfig.seed = seed;
    }

    const body = {
        contents: [{ parts }],
        generationConfig,
        systemInstruction: {
            parts: [{
                text: "You are a precision architectural renderer. When given a layout blueprint image and a component list, you MUST reproduce the EXACT spatial arrangement — same positions, same sizes, same camera perspective. CRITICAL: Each object in the component list appears EXACTLY ONCE. Never duplicate a component. Never add objects not in the list. Your output should look like a photograph taken from the same angle as the blueprint, with every object in its correct location and appearing exactly the number of times specified. Layout accuracy and object count accuracy are more important than artistic creativity."
            }]
        },
    };

    const fetchOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": config.apiKey,
        },
        body: JSON.stringify(body),
    };
    if (signal) fetchOptions.signal = signal;

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error?.message || `API request failed (${response.status})`;
        throw new Error(msg);
    }

    const data = await response.json();

    // Extract image from response
    const responseParts = data.candidates?.[0]?.content?.parts || [];
    let imageData = null;
    let textResponse = "";

    for (const part of responseParts) {
        if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || "image/png";
            imageData = `data:${mimeType};base64,${part.inlineData.data}`;
        }
        if (part.text) {
            textResponse += part.text;
        }
    }

    if (!imageData) {
        throw new Error(textResponse || "No image generated. The model may have refused the request.");
    }

    return { image: imageData, text: textResponse };
}
