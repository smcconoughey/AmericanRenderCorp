/**
 * STEP file parser — extracts product/body names and attempts to
 * compute bounding boxes from cartesian points in .step/.stp files.
 * 
 * STEP files are text-based (ISO 10303-21). We can extract:
 * - PRODUCT names (body/part names)
 * - CARTESIAN_POINT coordinates to estimate bounding boxes
 * - SHAPE_REPRESENTATION mappings to group points by body
 */

/**
 * Parse a STEP file and return extracted component data
 */
export function parseSTEP(text) {
    const lines = text.split("\n");
    const entities = {};

    // First pass: extract all entities
    let currentEntity = "";
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#")) {
            if (currentEntity) {
                parseEntity(currentEntity, entities);
            }
            currentEntity = trimmed;
        } else if (currentEntity && !trimmed.startsWith("/*") && trimmed !== "") {
            currentEntity += " " + trimmed;
        }
    }
    if (currentEntity) parseEntity(currentEntity, entities);

    // Extract products (body names)
    const products = [];
    for (const [id, entity] of Object.entries(entities)) {
        if (entity.type === "PRODUCT" && entity.params) {
            const name = extractQuotedString(entity.params);
            if (name && name !== "" && !name.startsWith("Open")) {
                products.push({ id, name });
            }
        }
    }

    // Extract all cartesian points
    const allPoints = [];
    for (const [id, entity] of Object.entries(entities)) {
        if (entity.type === "CARTESIAN_POINT" && entity.params) {
            const coords = extractCoords(entity.params);
            if (coords) allPoints.push(coords);
        }
    }

    // If we found products, try to group points by shape representation
    if (products.length > 0 && allPoints.length > 0) {
        // Try to find bounding boxes per product via shape representations
        const shapeReps = findShapeRepresentations(entities, products);

        if (shapeReps.length > 0) {
            return shapeReps;
        }

        // Fallback: assign overall bounding box divided among products
        const bbox = computeBoundingBox(allPoints);
        return products.map((p, i) => ({
            name: p.name,
            width: Math.max(1, bbox.width / products.length),
            length: bbox.length,
            height: bbox.height,
            x: bbox.minX + (bbox.width / products.length) * i,
            y: bbox.minY,
            z: 0,
            source: "step",
        }));
    }

    // If no products found, try SHAPE_DEFINITION_REPRESENTATION for names
    const shapes = [];
    for (const [id, entity] of Object.entries(entities)) {
        if (entity.type === "SHAPE_DEFINITION_REPRESENTATION") {
            const refs = extractRefs(entity.params);
            if (refs.length >= 2) {
                // First ref is the definition, second is the representation
                const defEntity = entities[refs[0]];
                if (defEntity) {
                    const nameRef = extractRefs(defEntity.params);
                    for (const nr of nameRef) {
                        const ne = entities[nr];
                        if (ne && ne.type === "PRODUCT_DEFINITION") {
                            const prodRef = extractRefs(ne.params);
                            for (const pr of prodRef) {
                                const pe = entities[pr];
                                if (pe && pe.type === "PRODUCT_DEFINITION_FORMATION") {
                                    const finalRef = extractRefs(pe.params);
                                    for (const fr of finalRef) {
                                        const fe = entities[fr];
                                        if (fe && fe.type === "PRODUCT") {
                                            const name = extractQuotedString(fe.params);
                                            if (name) shapes.push({ name });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (shapes.length > 0 && allPoints.length > 0) {
        const bbox = computeBoundingBox(allPoints);
        return shapes.map((s, i) => ({
            name: s.name,
            width: Math.max(1, bbox.width / shapes.length),
            length: bbox.length,
            height: bbox.height,
            x: bbox.minX + (bbox.width / shapes.length) * i,
            y: bbox.minY,
            z: 0,
            source: "step",
        }));
    }

    // Last resort: just return the overall bounding box
    if (allPoints.length > 0) {
        const bbox = computeBoundingBox(allPoints);
        return [{
            name: "Imported Body",
            ...bbox,
            x: bbox.minX,
            y: bbox.minY,
            z: 0,
            source: "step",
        }];
    }

    return [];
}

function parseEntity(line, entities) {
    const match = line.match(/^(#\d+)\s*=\s*(\w+)\s*\((.+)\)\s*;?\s*$/s);
    if (match) {
        entities[match[1]] = { type: match[2], params: match[3] };
    }
}

function extractQuotedString(params) {
    const match = params.match(/'([^']+)'/);
    return match ? match[1] : null;
}

function extractCoords(params) {
    const match = params.match(/\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)/);
    if (match) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        const z = parseFloat(match[3]);
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            return { x, y, z };
        }
    }
    return null;
}

function extractRefs(params) {
    const refs = [];
    const regex = /#(\d+)/g;
    let match;
    while ((match = regex.exec(params)) !== null) {
        refs.push("#" + match[1]);
    }
    return refs;
}

function computeBoundingBox(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const zs = points.map(p => p.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);

    // STEP files often use mm, convert to feet
    const scale = guessScale(maxX - minX, maxY - minY, maxZ - minZ);

    return {
        width: (maxX - minX) * scale,
        length: (maxY - minY) * scale,
        height: (maxZ - minZ) * scale,
        minX: minX * scale,
        minY: minY * scale,
    };
}

function guessScale(dx, dy, dz) {
    const maxDim = Math.max(dx, dy, dz);
    // If max dimension is > 1000, likely millimeters
    if (maxDim > 1000) return 1 / 304.8; // mm to feet
    // If > 100, likely centimeters
    if (maxDim > 100) return 1 / 30.48; // cm to feet
    // If > 10, likely inches
    if (maxDim > 10) return 1 / 12; // inches to feet
    // Already in feet or meters
    if (maxDim > 3) return 1; // assume feet
    return 3.28084; // assume meters
}

function findShapeRepresentations(entities, products) {
    // This is a simplified attempt to map products to their geometry
    // Full STEP traversal would require following the entire chain:
    // PRODUCT -> PRODUCT_DEFINITION -> SHAPE_DEFINITION_REPRESENTATION -> ADVANCED_BREP_SHAPE_REPRESENTATION

    const results = [];

    for (const product of products) {
        // Find all cartesian points that might belong to this product
        // by traversing the reference chain
        let pointsForProduct = [];

        // Try to find the shape representation for this product
        for (const [id, entity] of Object.entries(entities)) {
            if (entity.type === "PRODUCT_DEFINITION" && entity.params.includes(product.id)) {
                // Find the shape definition representation
                for (const [id2, entity2] of Object.entries(entities)) {
                    if (entity2.type === "SHAPE_DEFINITION_REPRESENTATION" && entity2.params.includes(id)) {
                        const refs = extractRefs(entity2.params);
                        // The second ref should be the shape representation
                        if (refs.length >= 2) {
                            const shapeRep = entities[refs[refs.length - 1]];
                            if (shapeRep) {
                                // Collect all cartesian points referenced by this shape
                                const shapeRefs = extractRefs(shapeRep.params);
                                for (const sr of shapeRefs) {
                                    collectPoints(sr, entities, pointsForProduct, 0);
                                }
                            }
                        }
                    }
                }
            }
        }

        if (pointsForProduct.length >= 2) {
            const bbox = computeBoundingBox(pointsForProduct);
            results.push({
                name: product.name,
                width: Math.max(0.5, bbox.width),
                length: Math.max(0.5, bbox.length),
                height: Math.max(0.5, bbox.height),
                x: bbox.minX,
                y: bbox.minY,
                z: 0,
                source: "step",
            });
        }
    }

    return results;
}

function collectPoints(ref, entities, points, depth) {
    if (depth > 5) return; // Prevent infinite recursion
    const entity = entities[ref];
    if (!entity) return;

    if (entity.type === "CARTESIAN_POINT") {
        const coords = extractCoords(entity.params);
        if (coords) points.push(coords);
    }

    // Follow references
    const refs = extractRefs(entity.params);
    for (const r of refs) {
        if (r !== ref) collectPoints(r, entities, points, depth + 1);
    }
}

/**
 * Parse an OBJ file and return components from groups
 */
export function parseOBJ(text) {
    const lines = text.split("\n");
    const groups = {};
    let currentGroup = "default";
    const vertices = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("v ")) {
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 4) {
                vertices.push({
                    x: parseFloat(parts[1]),
                    y: parseFloat(parts[2]),
                    z: parseFloat(parts[3]),
                });
            }
        } else if (trimmed.startsWith("g ") || trimmed.startsWith("o ")) {
            currentGroup = trimmed.substring(2).trim();
            if (!groups[currentGroup]) groups[currentGroup] = [];
        } else if (trimmed.startsWith("f ")) {
            const parts = trimmed.split(/\s+/).slice(1);
            for (const p of parts) {
                const idx = parseInt(p.split("/")[0]) - 1;
                if (idx >= 0 && idx < vertices.length) {
                    if (!groups[currentGroup]) groups[currentGroup] = [];
                    groups[currentGroup].push(vertices[idx]);
                }
            }
        }
    }

    const result = [];
    for (const [name, pts] of Object.entries(groups)) {
        if (pts.length < 2) continue;
        const bbox = computeBoundingBox(pts);
        result.push({
            name: name.replace(/_/g, " "),
            width: Math.max(0.5, bbox.width),
            length: Math.max(0.5, bbox.length),
            height: Math.max(0.5, bbox.height),
            x: bbox.minX,
            y: bbox.minY,
            z: 0,
            source: "obj",
        });
    }

    return result;
}
