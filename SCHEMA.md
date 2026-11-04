# Scene schema 3: optional presets and arbitrary articulation

Production generation requests version 3. Versions 1/absent and 2 retain their old validators, coordinate conventions and layout behavior; saved data is not migrated or rewritten on open. Schema version 3 is a data-format version, not the future manual-editing UI release.

Every participant MUST declare one explicit geometry mode. There is no guessing based on whether joints happen to be present, and custom mode does not require or imply any preset.

```json
{
  "schemaVersion": 3,
  "title": "An asymmetric crouch",
  "interpretation": "Sam crouches with one hand braced on the table and the other reaching upward.",
  "assumptions": [],
  "people": [{
    "id": "sam", "name": "Sam",
    "placement": {"x": 400, "y": 370, "depth": 260},
    "geometry": {
      "mode": "custom", "headFacing": -45,
      "joints": {
        "head": [-12,-92], "neck": [-8,-68], "hip": [0,0],
        "leftElbow": [-42,-26], "leftHand": [-70,-50],
        "rightElbow": [24,-91], "rightHand": [24,-124],
        "leftKnee": [-45,14], "leftFoot": [-66,50],
        "rightKnee": [42,-18], "rightFoot": [62,50]
      }
    }
  }],
  "props": [{"id":"table","name":"Bracing surface","type":"table","x":265,"y":320,"w":95,"h":100}]
}
```

## Explicit geometry modes

- **Preset:** `geometry:{mode:"preset",preset:"standing",overrides:{leftElbow:[-40,-40],leftHand:[-65,-60]}}`. The five existing presets remain optional starting geometry: standing, sitting, kneeling, reclining, lying. Partial overrides may name any subset of the eleven joints. No new posture names are needed to express a new configuration. `joints` is not allowed in this mode.
- **Custom:** `geometry:{mode:"custom",joints:{all eleven named pairs}}`. No preset or overrides field is allowed. Each elbow, hand, knee, foot, head, neck and hip may be positioned independently. A crouch, lunge, unusual arm combination or compound pose does not need to fit a named vocabulary. Custom mode does not pass through the old standing/resting normalizer.

Joint names/order are the same stable eleven used by the renderer: head, neck, hip, leftElbow, leftHand, rightElbow, rightHand, leftKnee, leftFoot, rightKnee, rightFoot. Near attachments refer to leftHand, far to rightHand; these retained names are projection roles rather than anatomical guarantees. The skeleton has one torso segment and no finger/toe/3D-twist model.

## Coordinates and explicit transforms

- Coordinates are **person-local**, x right, y down. `placement.x/y` is the world coordinate of local [0,0]. Hip [0,0] is convenient but not mandatory for custom mode. Presets are built with hip [0,0]. Standing feet are about local y=91, sitting/kneeling feet y=46, ground-seated feet y=0, lying feet y=0. A standing placement around y329 meets scene ground y420; placement y is not itself the ground level.
- Each local component must be a finite number within **±1000**, with exactly two numbers per point. Placement x/y and optional depth must be finite within **±2000**. Out-of-range or malformed values are rejected, never independently clamped. Structurally valid off-canvas geometry is framed as supplied. Counts remain 1–8 participants, at most 12 props, response at most 60,000 characters; existing bounded text and prop validation is reused.
- `geometry.transform:{mirrorX:true}` is the only supported transform. It explicitly negates local x **after** overrides. It also reflects the head direction. Omitted mirrorX means false. Unknown transforms error rather than being guessed. Rotation/scale of a custom body can be authored directly in its coordinates.
- `geometry.headFacing` is an independent local angle, finite within ±360 degrees: 0 right, 90 down, 180 left, -90 up; default 0. It rotates only the small facing mark, not the head position or body. Body `facing` metadata never implicitly mirrors custom joints. If omitted it defaults to the explicitly requested transform's left/right orientation; an explicitly supplied facing remains descriptive. A toward-facing relationship is diagnosed without silently turning a custom head/body.

## Order and precedence

1. Validate the discriminator, complete/partial joint map, numeric limits, mode combinations, placement, transforms, IDs and references.
2. For a preset, construct its local geometry with optional lean/arm/ground-seat modifiers. For custom mode, copy the supplied skeleton; there is no default pose construction.
3. Apply named preset overrides. Apply only the explicitly requested mirror. Apply placement as a whole-figure translation.
4. By default `placement.resolveRelations` is false: support/beside/ground relationships are checked, and mismatches are reported while the supplied pose and placement remain unchanged.
5. If `placement.resolveRelations:true`, layout may translate the entire figure to an on-support surface, compatible back boundary, ground seat, or beside position. It cannot rotate, mirror, stretch or rebuild limbs to satisfy a relationship. On-support checks the hip against the usable surface; back support uses the actual torso profile and must already lean compatibly. Conflicts keep explicit articulation and emit diagnostics. Circular beside constraints are not applied. On-support precedes back support; beside is not also applied when support is present.
6. Reach/point solvers operate only on **unlocked preset arms**. Overriding either joint of an arm locks that entire chain. Custom mode locks every joint. Solvers use final neck/target positions, cannot overwrite explicit joints, and report protected chains instead of substituting a standard pose. Other custom lean/arm modifiers are retained as intent but diagnosed as not shaping explicit geometry.
7. Attach props to final resolved hands using the shared attachment helper. Labels, bounds, SVG display and SVG export consume the final geometry. JSON metadata/export retains the original geometry, placement and transforms, not a reconstructed approximation.

The on-support convention anchors the hip to the top, not arbitrary hand contact. A braced hand can be drawn directly with custom coordinates at the surface. A semantic hip-support relation conflicting with that authored pose is reported; it does not move the hand unless whole-figure translation was explicitly enabled. These rules do not establish physical/anatomical validation or solve general contact.

## Validation and diagnostics

Unknown/missing joint names, missing custom joints, incompatible mode fields, invalid booleans/coordinates/transforms, or unknown preset/modifier values return an actionable error and keep the previous valid sketch. Use custom mode rather than replacing an unsupported posture with standing.

Unknown participant/geometry/placement/relationship fields are reported in collapsed diagnostics rather than silently disappearing. Extra fields are bounded (at most 16 unknown fields per object, at most 64 normalized validation messages). Invalid reference syntax errors; syntactically valid but missing referenced participants/props are diagnosed during layout. Unusual projected segment lengths are diagnostic only: structurally valid geometry still renders unchanged, including short/long/foreshortened limbs.

Existing props, bounded text, interpretation, assumptions, contact metadata, water anchoring and manual generation remain. There is no clothing-coverage renderer in this checkout; this correction adds none and does not claim to verify clothing following custom joints. Held cups do follow final custom and overridden hands.

## Views, persistence, and verification

Pose view uses actual custom coordinates. Overhead uses only placement x, separately supplied depth, descriptive facing, and schematic prop footprints. It is explicitly labeled **placement markers only**, never a reconstruction/projection of custom side-view limb geometry. Missing depth uses a diagnosed row at 250. This 2D skeleton cannot recover hidden space, perspective, or 3D torso twist.

Generated version-3 scenes retain mode, preset/overrides or complete custom map, headFacing, transform and placement through parsing, metadata, JSON export/reload and saved-panel opening. Repeated layout/render calls do not mutate that payload. The existing manual JSON editor remains local-only unless exported; no correction tools were added.

`articulated-fixtures.js` contains synthetic fixed-data examples for a non-preset asymmetric crouch, one-arm override, independent head direction, final-hand cup attachment, conflicting support, explicit mirroring and off-canvas framing. Tests also cover mock generation -> metadata -> JSON/SVG download -> saved-panel reload, invalid custom responses preserving the last valid sketch, and all older regression formats. These tests verify structural preservation, not live provider interpretation or anatomical plausibility.

---

# Previous scene schema 2 (compatibility reference)

The model returns one JSON object containing scene intent and a short interpretation. Local modules validate it, resolve relationships, construct poses, and render SVG. No model-supplied SVG, HTML, paths, styles, URLs, or executable values are used. Unknown fields are discarded. This is approximate schematic blocking, not physical/anatomical validation.

```json
{
  "schemaVersion": 2,
  "title": "Beside the stone",
  "interpretation": "Alex sits leaning against the stone while Sam kneels nearby and reaches toward Alex.",
  "assumptions": ["Reaching does not establish contact."],
  "people": [
    {"id":"alex","name":"Alex","pose":"sitting","seat":"ground","facing":"right","lean":"backward","arms":"resting","support":{"type":"against","target":"stone","side":"right"}},
    {"id":"sam","name":"Sam","pose":"kneeling","facing":"toward","target":"alex","arms":"reaching","beside":{"target":"alex","side":"right"}}
  ],
  "props": [{"id":"stone","name":"Stone","type":"stone","x":250,"y":340,"w":130,"h":80}]
}
```

## Text and counts

- Response: at most 60,000 characters; 1–8 people; at most 12 props.
- IDs: unique across people and props, starting with an ASCII letter, followed by at most 31 letters/digits/underscore/hyphen. Display names are separate. Relationships use IDs, never names.
- Title: up to 120 Unicode code points. Participant/prop names: up to 100. Names are required.
- Interpretation: required, nonempty, up to 600 code points. The prompt asks for 1–2 source-faithful sentences about the final moment, without dialogue or story continuation. It is the model's interpretation, not an SVG inspection.
- Assumptions: up to 8 nonempty strings, up to 600 code points each. They describe source uncertainty affecting the scene. Material layout changes add plain-language explanations to the visible Scene assumptions section. Validation fallback `warnings` are retained in JSON, while layout diagnostics are recomputed and shown under collapsed Advanced · Layout diagnostics. They do not enter the interpretation caption.
- Over-limit fields are rejected with a named error, not truncated. Existing valid diagrams and captions survive a failed request. XML-invalid control/surrogate characters are rejected. All UI text uses textContent; SVG text is escaped.

## Person intent

| Field | Values / rules |
| --- | --- |
| `pose` | `standing`, `sitting`, `kneeling`, `reclining`, `lying` |
| `facing` | `left`, `right`, `toward`; toward uses `target` |
| `lean` | `upright`, `forward`, `backward`; ignored for lying with an explanation |
| `arms` | `resting`, `reaching`, `raised`, `holding`, `pointing`; holding/pointing use one arm and leave the other resting |
| `target` | Optional participant ID for facing/reaching; no hand snapping or inferred contact |
| `targetRegion` | Optional `hand`, `forearm`, `shoulder`, `head`, only when source-specified; absent/invalid uses neutral mid-torso |
| `x` | Optional finite number, clamped 0–800; horizontal side/overhead anchor |
| `depth` | Optional finite number, clamped 0–500; overhead placement only |
| `seat` | Optional `"ground"`, for hips at the ground/bank, not a furniture-height seated pose |
| `support` | Optional `{ "type":"on" or "against", "target":"propId", "side":"left" or "right" }`; side is body side of the object, relevant to against |
| `backSupport` | Optional `{ "target":"propId", "side":"left" or "right" }`, can combine with on-seat support |
| `contact` | Optional `{ "type":"embrace", "target":"personId" }`, preserves explicit described contact; does not claim a solved wraparound hug |
| `beside` | Optional `{ "target":"personOrPropId", "side":"left" or "right" }` |

Default ground is y=420. Torso length is 66, arm segments 34/32, and leg segments 46/46 in schematic units. Kneeling uses one knee and a trailing shin at the ground plus a forward knee/foot. Ordinary sitting has a near-horizontal thigh and descending shin; a low explicit seat folds the legs while retaining segment lengths. Ground sitting keeps hips at y=416 (stroke clearance) with bent legs extending along the ground. A seated against-only relationship defaults to ground sitting, never to a seat on the supporting object. Reclining uses a diagonal torso, lying a horizontal torso with an elevated head. Construction happens in right-facing local space and is mirrored at the end.

Resting-arm targets are offset to either side of the hip/trunk in projection. Fixed 34/32 segments bend to those targets; hands and elbows remain separated rather than meeting at the pelvis. Near/far refer to drawing roles and are not anatomical left/right claims. Holding bends the attached cup's arm near chest height; pointing aims the near arm toward its target while the far arm rests. Reaching remains distinct from explicitly described contact.

Unknown poses/modifiers use documented defaults with warnings. Standard optional modifiers default to right-facing/upright/resting. No valid `x` or relationship means an ID-sorted fallback spread. Invalid numeric types are errors. New semantic scenes ignore arbitrary `joints`; custom geometry remains available only in the bounded legacy format.

## Relationships and deterministic layout

1. Validate the IDs and normalize allowlisted fields.
2. Sort participants and props by ID, then detect cycles in beside references.
3. Resolve anchors recursively through the resulting dependency graph. Cyclic participants use fallback anchors. Missing/invalid targets use fallback placement with explanations.
4. A valid on-support overrides beside and x. `on` supports only sitting/reclining/lying on solid objects: x is the usable visible surface center and the local pose is anchored to its top. Sitting requires at least 32 units of usable surface width; lying/reclining require 210. High seated supports leave feet hanging and state that ground contact is not implied. Explicit `seat:"ground"` wins over a contradictory on-seat relation with a plain-language notice.
5. Back support uses the same visible side/profile segments as the symbol. The torso is translated horizontally until tangent (3 units of stroke clearance). The tangent contact must lie 35–95% of the way from hip toward neck, excluding pelvis-only contact. The rest of the torso must remain outside the object too; contact is not forced by stretching or rotating limbs. A too-small/low prop falls back with a mid/upper-back diagnostic. Hip height is preserved. Ground seating remains at the ground; an on-seat plus backSupport combination must keep the hip inside the seat surface. A chair's `facing` chooses the back side. Missing objects, seat intersections, or incompatible constraints fall back with explanations.
6. Beside-person places anchors 140 units apart; beside-prop puts the anchor 100 units outside its boundary. Proximity alone never turns an object into a support. Pool and door are not valid supports.
7. Facing and bounded arm reach are resolved after anchors; mutual facing/reaching is safe because it adds no recursive position dependency. Region positions use resolved resting/raised geometry before reaching; mutual hand/forearm reaches do not form an IK loop. Unspecified reaching aims 55% of the way from neck to hip, not at the neck/head. Two fixed arm segments bend toward nearby targets, reach at most 62 units, and leave a small intent gap instead of claiming contact. Equal-x facing uses a deterministic right-facing fallback. Relationships are approximate; shared supports/crowds can still overlap.
8. When a support fails and no explicit x/beside position exists, a bounded candidate search prefers open ground outside prop footprints. It does not relocate explicitly positioned people, infer a precise shoreline, or solve general collisions. Technical details belong to diagnostics, material changes to plain-language assumptions.

## Props

Types: `box` (unknown fallback), `chair`, `table`, `bed` (also bench), `stone`, `pool`, `door`, `cup`, `campfire`. `props.js` returns allowlisted local primitives, actual bounds, usable top surface, back-contact segments, water/shoreline metadata, and a label anchor. Drawing, support resolution, framing, and label placement consume this shared geometry. Ground water is painted first, then solid props, then explicitly elevated water (so the basin fill cannot hide it), then people and labels. A chair's back extends 55 units above its seat. `facing:"right"` puts a chair's back at the left; `"left"` mirrors it and can mirror a stone's deterministic outline.

`x`=0–780, `y`=0–420, `w`=20–500, `h`=10–400; sizes are clamped to the 800×500 nominal envelope. All must be finite numbers; omitted w/h default to 100/60. For furniture, y is the support top (seat y=374 gives a standard shin to ground y=420). Stone is a flattened polygon resting at the nominal envelope bottom; its visible top/sides define support anchors. Door is an outlined opening. No support is inferred from overlap.

### Water anchoring

Ground-level pools/springs default to `waterLevel:"ground"`. In side view the shallow ellipse's **top** is y=420, its interior is below bank level, and short bank joins meet the ellipse's edges. `groundSegments` subtracts the resolved shoreline intervals from the ground line, merging overlapping intervals. Thus no uninterrupted solid ground runs through the pool. The old nominal y/h envelope no longer silently elevates water. Overhead still uses depth/footprint independently.

When the source explicitly establishes raised water (a basin, for example), use `waterLevel:"elevated"` plus optional `surfaceY` (finite 0–480). Its top is surfaceY, or nominal y if omitted. A supplied surfaceY different from 420 is itself explicit elevation and wins over the default ground mode. Elevated water leaves ground below uninterrupted and is drawn over solid basin props. This is not a fluid or terrain solver; exact shoreline geography remains approximate. People anchors are not moved by the water symbol.

### Small interaction extensions

A cup may use `heldBy:{"person":"id","hand":"near" or "far"}`; x/y may be omitted for an attached cup. The resolved hand fixes a 14×16 local cup symbol, and holding uses that hand's arm. An unavailable holder is diagnosed and the unlocated cup is omitted rather than invented at the origin. Other held object types are not supported. In overhead layout cups are owner-adjacent symbols, not articulated hand geometry. Attachments resolve after body/arm geometry and do not create a recursive pose dependency.

`arms:"pointing"` permits a participant or prop target (including a doorway); it bends one arm toward the target without claiming a touch or stretching the segments. A held-cup target uses its holder's base hand reference. Missing targets get a diagnosed default gesture.

`contact:{"type":"embrace","target":"id"}` preserves explicitly described contact separately from `arms:"reaching"`. The current skeleton does **not** reliably solve a wraparound embrace: supported close placement/directed arms are rendered and a plain-language limitation is shown. Never interpret the intent gap of ordinary reaching as evidence of actual contact. A generic reaching notice is shown only for non-contact reaching in pose view, not for resting, holding, pointing, overhead markers, or described embraces.

Campfire uses crossed log lines and a minimal flame triangle. Its bottom follows nominal y+h. Cup, fire, pool and door provide no seat/back surfaces. Side projection can overlap a rear participant with a fire despite supplied depth; this limitation is stated and overhead preserves the depth positions. No general physics, wrapping-contact, or depth/occlusion engine is added.

Natural aliases normalize silently and retain the display name: rock/boulder→stone; spring/natural spring/water/water area/pond→pool; seat/stool→chair; counter→table; bench→bed; opening/doorway/wall→door; unknown/object→box. Truly unknown values produce a generic box and an advanced diagnostic, not a narrative warning about supported prop vocabulary. No model-supplied drawing attributes are accepted.

Optional `depth` (0–500) is the overhead center; optional `footprint` (20–300) is overhead height. Without these, overhead uses a schematic row at depth=250 and footprint=60 (water defaults to half its width, clamped 60–160). The plain assumption says distances/shoreline are approximate; technical defaults are in diagnostics. Overhead symbols show positions and facing only, not articulated posture or newly inferred 3D geometry. Relationships propagate a support/neighbor depth when available.

## Rendering, framing and compatibility

Bounds include all figure segments, head circles/noses, feet, shared prop bounds and strokes, wrapped labels, and any leader lines. Labels are placed after geometry using eight nearby top/side/bottom/corner candidates. Candidate scoring uses text width, geometry/label overlap, and distance. Fixed textLength makes width estimates explicit. Displaced labels get a subtle leader; no repeated upward displacement is allowed. Dense scenes can still overlap, deliberately preferring nearby labels to detached ones. Bounds receive 24 units of padding and minimum 360×240 extents without stretching figures. Display and SVG download call the same renderer with the selected view. View switching is local; JSON exports retain intent and validation warnings, not renderer-generated joints or transient geometry/labels.

The new fields are optional schema-2 refinements: earlier schema-2 JSON without seat/backSupport/targetRegion remains loadable. Previously saved against-only sitting is now drawn as ground seated to fix the perched-on-edge interpretation, while original JSON remains untouched. The synthetic reproduction and preserved old fixtures cover this compatibility path.

Water anchoring, heldBy, contact, holding/pointing, cup and campfire are also optional schema-2 refinements. Earlier semantic pools default to ground level; to preserve a source-established elevation, supply the explicit elevation fields. No automatic metadata migration writes back. Legacy coordinate scenes remain untouched.

`regression-cases.js` records source, structured scene, expected visible relationships, and limitations separately for six varied synthetic scenarios and mirror/elevation variants. Fixed-data tests classify renderer behavior independently of whether a live model chooses the intended posture. Preview export includes source/expectations in its development-only HTML gallery and optional desktop/narrow raster versions. No captured original spring JSON was present; synthetic data is never described as actual provider output.

Saved scenes with absent schemaVersion or schemaVersion=1 continue through the legacy eleven-joint validator and common renderer. Their bounded joint data is retained and no migration writes back automatically. They lack interpretation/depth, so both view selections show the original geometry with an explicit notice. Their full notes are accepted up to 2,000 characters, replacing the old 160-character truncation. Explicitly generating a new sketch still replaces the latest snapshot by design; export JSON first to keep history.

No visual joint editor, dragging, undo, or general IK/physics engine is included. Manual visual correction tools are deferred to v3; the existing collapsed JSON editor is unchanged in scope.
