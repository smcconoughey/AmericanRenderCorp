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

    const compDescs = visibleComps
        .map(c => {
            let desc = `• "${c.name}"`;
            if (c.material && c.material !== "Custom") desc += ` (${c.material})`;
            if (c.notes) desc += ` — ${c.notes}`;
            return desc;
        }).join("\n");

    if (hasReferenceImage) {
        return `Transform this layout diagram into a photorealistic architectural visualization.

The attached image shows the spatial layout and arrangement of components. Preserve the exact positions, sizes, and spatial relationships shown.

${sceneNotes || "This is an outdoor test facility with flat terrain, clear sky, and natural daylight."}

The scene contains these components:
${compDescs}

IMPORTANT INSTRUCTIONS:
- Keep the same layout, positions, and relative sizes as shown in the reference image
- Make everything photorealistic — real materials, textures, lighting, shadows
- DO NOT add any text, labels, dimensions, or annotations to the image
- DO NOT add measurement lines or dimension markers
- Natural outdoor environment with appropriate terrain and vegetation
- Elevated camera angle, looking across the full scene`;
    }

    // No reference image — text-only prompt
    return `Generate a photorealistic architectural visualization of this facility.

${sceneNotes || "Outdoor test facility on flat terrain, clear sky, natural daylight."}

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
 * Generate a scene render via Gemini generateContent API.
 * Optionally accepts a reference image (base64 data URL) that the model
 * will use as a layout guide. Seed enables reproducible renders.
 */
export async function generateSceneRender(prompt, config, referenceImageDataUrl = null, seed = null) {
    if (!config.apiKey) {
        throw new Error("API key not configured. Go to Settings to add your Gemini API key.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;

    // Build parts array — reference image first (if provided), then text
    const parts = [];

    if (referenceImageDataUrl) {
        // Extract base64 data and mime type from data URL
        const match = referenceImageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
            parts.push({
                inlineData: {
                    mimeType: match[1],
                    data: match[2],
                },
            });
        }
    }

    parts.push({ text: prompt });

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
