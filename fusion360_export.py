#Author-American Render Corp
#Description-Exports all bodies with bounding boxes as JSON for Scene Composer import

import adsk.core, adsk.fusion, json, os

def run(context):
    """
    Run this script inside Fusion 360:
      1. Open your model
      2. Go to Utilities > Add-Ins > Scripts
      3. Click the green (+) to add a new script
      4. Paste this code
      5. Click Run
      
    It will export a JSON file to your Desktop with all body names
    and their bounding boxes in the document's current units (feet).
    """
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        design = adsk.fusion.Design.cast(app.activeProduct)
        
        if not design:
            ui.messageBox('No active Fusion 360 design found.')
            return

        # Get the units manager to convert to feet
        unitsMgr = design.unitsManager
        
        # Determine default length unit
        defaultUnit = unitsMgr.defaultLengthUnits  # e.g. "ft", "in", "cm", "mm"
        
        components_data = []
        root = design.rootComponent
        
        # Iterate all bodies in all components
        def process_component(component, parent_name=""):
            for body in component.bRepBodies:
                bb = body.boundingBox
                
                # Get bounding box corners in cm (Fusion internal unit)
                min_pt = bb.minPoint
                max_pt = bb.maxPoint
                
                # Convert cm to feet (Fusion stores internally in cm)
                cm_to_ft = 1.0 / 30.48
                
                width = abs(max_pt.x - min_pt.x) * cm_to_ft   # X extent
                length = abs(max_pt.y - min_pt.y) * cm_to_ft   # Y extent
                height = abs(max_pt.z - min_pt.z) * cm_to_ft   # Z extent
                
                # Center position in feet
                cx = (min_pt.x + max_pt.x) / 2.0 * cm_to_ft
                cy = (min_pt.y + max_pt.y) / 2.0 * cm_to_ft
                cz = min_pt.z * cm_to_ft  # Use bottom of bounding box for Z
                
                body_data = {
                    "name": body.name,
                    "width": round(width, 2),
                    "length": round(length, 2),
                    "height": round(height, 2),
                    "x": round(cx - width / 2, 2),  # Convert center to corner position
                    "y": round(cy - length / 2, 2),
                    "z": round(cz, 2),
                    "component": component.name if component.name != root.name else "",
                    "material": body.material.name if body.material else "",
                    "volume_ft3": round(body.volume * (cm_to_ft ** 3), 4),
                }
                
                components_data.append(body_data)
            
            # Recurse into sub-components
            for occurrence in component.occurrences:
                sub_comp = occurrence.component
                process_component(sub_comp, component.name)
        
        process_component(root)
        
        if not components_data:
            ui.messageBox('No bodies found in the design.')
            return
        
        # Build export data
        export_data = {
            "version": "2.0",
            "source": "fusion360",
            "units": "feet",
            "designName": design.rootComponent.name,
            "defaultUnits": defaultUnit,
            "bodyCount": len(components_data),
            "components": components_data,
        }
        
        # Save to Desktop
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        filepath = os.path.join(desktop, "scene-export.json")
        
        with open(filepath, 'w') as f:
            json.dump(export_data, f, indent=2)
        
        ui.messageBox(
            f'Exported {len(components_data)} bodies to:\n{filepath}\n\n'
            f'Open Scene Composer and use CAD Import to load this file.',
            'Export Complete'
        )

    except Exception as e:
        if ui:
            ui.messageBox(f'Error: {str(e)}')
