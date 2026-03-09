/**
 * Scene Serializer — handles import/export of scene data
 * All dimensions in FEET.
 */

const CURRENT_VERSION = "2.0";

export function exportScene(components, sceneNotes) {
    return JSON.stringify({
        version: CURRENT_VERSION,
        exportedAt: new Date().toISOString(),
        units: "feet",
        scene: { notes: sceneNotes },
        components,
    }, null, 2);
}

export function downloadScene(components, sceneNotes) {
    const json = exportScene(components, sceneNotes);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scene-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importScene(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (!data.components) throw new Error("Invalid scene file");

        // Handle v1 format (pixel-based) by converting
        const components = data.components.map(c => {
            if (c.w !== undefined) {
                // v1 format — convert from pixels
                return {
                    ...c,
                    width: c.w ? c.w / 20 : 10,
                    length: c.h ? c.h / 20 : 8,
                    height: c.depth || 8,
                    x: c.x ? c.x / 20 : 0,
                    y: c.y ? c.y / 20 : 0,
                    refImages: c.refImage ? [c.refImage] : (c.refImages || []),
                    visible: c.visible !== false,
                };
            }
            return c;
        });

        return { components, sceneNotes: data.scene?.notes || "" };
    } catch (err) {
        throw new Error(`Import failed: ${err.message}`);
    }
}

export function exportSVG(components) {
    const scale = 8; // px per foot for SVG
    const maxX = Math.max(...components.map(c => (c.x + c.width) * scale)) + 40;
    const maxY = Math.max(...components.map(c => (c.y + c.length) * scale)) + 40;

    const rects = components.map(c => {
        const sx = c.x * scale;
        const sy = c.y * scale;
        const sw = c.width * scale;
        const sh = c.length * scale;
        return `<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="${c.color}44" stroke="${c.color}" stroke-width="1.5"/>
  <text x="${sx + sw / 2}" y="${sy + sh / 2}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="10" font-family="monospace">${c.name}</text>
  <text x="${sx + sw / 2}" y="${sy + sh / 2 + 12}" text-anchor="middle" dominant-baseline="middle" fill="#888" font-size="8" font-family="monospace">${c.width}×${c.length}×${c.height}ft</text>`;
    }).join("\n  ");

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
