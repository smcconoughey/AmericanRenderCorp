/**
 * Scene Serializer — handles import/export of scene data
 */

const CURRENT_VERSION = "1.0";

/**
 * Export scene to JSON with full reference image data
 */
export function exportScene(components, sceneNotes, scaleSetting) {
    const data = {
        version: CURRENT_VERSION,
        exportedAt: new Date().toISOString(),
        scene: {
            notes: sceneNotes,
            scale: scaleSetting,
        },
        components: components.map(comp => ({
            ...comp,
            // Keep refImages as base64 data URIs for portability
        })),
    };
    return JSON.stringify(data, null, 2);
}

/**
 * Download scene as JSON file
 */
export function downloadScene(components, sceneNotes, scaleSetting) {
    const json = exportScene(components, sceneNotes, scaleSetting);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scene-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Import scene from JSON string
 */
export function importScene(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (!data.version || !data.components) {
            throw new Error("Invalid scene file format");
        }
        return {
            components: data.components,
            sceneNotes: data.scene?.notes || "",
            scaleSetting: data.scene?.scale || "1ft = 20px",
        };
    } catch (err) {
        throw new Error(`Failed to import scene: ${err.message}`);
    }
}

/**
 * Export scene layout as SVG
 */
export function exportSVG(components) {
    const maxX = Math.max(...components.map(c => c.x + c.w)) + 40;
    const maxY = Math.max(...components.map(c => c.y + c.h)) + 40;
    const rects = components.map(c =>
        `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${c.color}44" stroke="${c.color}" stroke-width="1.5"/>
  <text x="${c.x + c.w / 2}" y="${c.y + c.h / 2}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="10" font-family="monospace">${c.name}</text>`
    ).join("\n  ");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}">
  <rect width="100%" height="100%" fill="#0d0d1a"/>
  ${rects}
</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scene-layout.svg";
    a.click();
    URL.revokeObjectURL(url);
}
