# Scene Sketch

**Simple scene diagrams for SillyTavern, powered by your existing text model.**

Scene Sketch turns recent chat messages into labeled SVG stick-figure diagrams showing who is where, how people are posed, and how they relate to furniture and one another. Use it for conversations, action, or intimate scenes when you want a quick visual reference.

The model returns scene data as JSON, and the extension draws it locally. No image-generation model, ComfyUI workflow, or extra service is required.

> **Alpha: v0.1.0.** Core parser and renderer tests pass. Installation, live generation, and compatibility with individual SillyTavern builds and providers still require testing. Expect imperfect poses and occasional invalid model responses.

## Features

- Chat-input wand action: **Sketch Current Scene** opens the panel and makes one request using saved defaults.
- Settings entry point opens the panel without making a request; Generate/Regenerate stays inside the panel.
- Native collapsible settings drawer with saved default message count and view.
- Select the latest 1–12 non-system messages; default: four.
- Named, colored stick figures using optional presets, named joint overrides, or complete custom articulated skeletons.
- Simple chair, table, bed/bench, stone, pool, door, cup, campfire, and generic prop shapes.
- Automatically framed pose view and a local overhead position/facing layout.
- A short scene interpretation from the same generation response, scene assumptions, and separate collapsed layout diagnostics.
- Local JSON editing and redraw without another model request.
- SVG and JSON downloads.
- Latest generated sketch saved per chat.

## Requirements

- A working SillyTavern installation and active text-generation connection.
- A model capable of following JSON-output instructions.
- A modern browser supporting SVG and native HTML dialogs.
- Git for installation through SillyTavern's repository installer.

A minimum supported SillyTavern version has not yet been established through integration testing. The extension requires `generateRaw`, extension settings, and chat metadata APIs exposed by `SillyTavern.getContext()`.

There is no extension-specific build step, dependency installation, server plugin, separate API key, or Docker requirement. SillyTavern's own runtime requirements still apply.

## Installation

### Install from GitHub

Repository: https://github.com/AdmiralEM/ST-Scene-Sketch

1. Open SillyTavern and select **Extensions** in the top bar.
2. Select **Install extension**.
3. Paste `https://github.com/AdmiralEM/ST-Scene-Sketch`.
4. Choose your user or all users if prompted.
5. Complete installation and reload SillyTavern.
6. Open the **Scene Sketch** drawer in extension settings to configure defaults, or use **Sketch Current Scene** in the wand/extensions menu beside the chat input.

Leave the branch field at its default unless you intend to test another branch.

### Install from a ZIP

1. Download a release ZIP or use **Code → Download ZIP** on GitHub.
2. Extract it and rename the extracted extension folder to `scene-sketch` if needed.
3. Place the folder in the appropriate location relative to your SillyTavern installation:

| Target | Directory |
| --- | --- |
| Your user | `data/<your-user>/extensions/scene-sketch/` |
| All users | `public/scripts/extensions/third-party/scene-sketch/` |

For a standard default-user installation, `<your-user>` is usually `default-user`. If you configured a custom data root, use its corresponding user extensions directory.

4. Confirm that `manifest.json` is directly inside that folder. Avoid an extra nested folder such as `scene-sketch/scene-sketch/manifest.json`.
5. Restart SillyTavern and refresh the browser.
6. Check **Manage extensions** if the extension is disabled, then open its settings.

Install only one copy to avoid confusion between user and all-users installations.

## Usage

1. Open a character or group chat containing at least one non-system message.
2. Open the **wand/extensions menu beside the chat input → Sketch Current Scene** (pose/person icon). This immediately opens the panel and generates using your saved defaults.
3. Review the diagram, **Scene interpretation**, and expandable **Scene assumptions**. Technical details live under **Advanced · Layout diagnostics**. Change **View** to redraw the existing scene locally. Change **Recent messages** and click **Regenerate** when you want another model request.

To configure defaults or open without a request, expand **Extensions settings → Scene Sketch**. Set **Default recent messages (1–12)** and **Default view**, then use **Open Scene Sketch**. Both defaults are saved when changed. Panel options apply to that panel's requests and do not overwrite your defaults. Click **Generate** when ready.

The **Sketch Current Scene** entry shares the existing wand menu with Generate Image, Generate Caption, and Show Gallery. Its container, icon, spacing, typography, and hover behavior follow SillyTavern's captioning/translation convention; no separate send-toolbar button is added. Clicking it or activating it with Enter/Space dismisses the menu through SillyTavern's existing outside-click handler before opening the panel. The action is unavailable without a usable character/group chat or while a Scene Sketch request runs. Its pose icon becomes a spinner during generation. Loading the extension or switching chats never generates automatically.

The prompt asks for the **final moment** in the excerpt, not a sequence of panels. Start with pose view and four messages. Reduce the count for a self-contained response; increase it when earlier messages establish positions or participants. Including an unrelated earlier scene can confuse the result.

Only one Scene Sketch request runs at a time. Closing the dialog does not cancel a request. Failed requests are not automatically retried, and a failed regeneration leaves the previous sketch and its exports available. JSON editing stays in a collapsed **Advanced · Edit scene JSON** section. Errors appear in the panel status area.

### Reading the diagram

Colored lines represent limbs and bodies; circles represent heads, with a small nose showing facing. Short shoulder/hip marks, hand endpoints, and feet help separate poses. Names wrap at word boundaries where possible. Labels choose from a small set of nearby positions after geometry is resolved; a displaced label gets a subtle leader line rather than floating far above the scene. Crowded labels can still overlap. Props render behind people, with water behind solid props. The SVG viewBox includes figures, head circles, labels, leader lines, props, strokes, and the local ground reference with padding and a minimum 360 × 240 extent. Export uses exactly the displayed framing.

**Scene interpretation** is one or two sentences describing what the model understood from the selected excerpt. It comes in the same JSON response as the scene and does not mean a model inspected the rendered SVG. **Scene assumptions** contains source uncertainty and plain-language explanations of material changes. **Advanced · Layout diagnostics** separately contains missing targets, conflicting constraints, coordinate overrides, and other technical details. Both sections start collapsed. Caption and assumption fields allow up to 600 characters each; oversized fields produce a clear error while preserving the previous sketch, rather than silently chopping sentences.

Production generation now requests **schema version 3**, with an explicit `geometry.mode`: **preset** (optionally with named joint overrides) or **custom** (all eleven named joints, no preset required). Presets are starting points, not a catalog of depictable poses. A custom crouch can brace one hand, raise the other, fold each leg differently, position the head and torso independently, and use a separate head-facing angle. This restores arbitrary 2D articulation instead of forcing unsupported postures into standing/resting. See [SCHEMA.md](SCHEMA.md) for the exact format and examples.

Schema-3 coordinates are person-local, translated by explicit `placement.x/y`. Named overrides are applied after preset construction. Mirroring requires `geometry.transform.mirrorX:true`; body-facing metadata never implicitly mirrors explicit joints. Malformed custom coordinates or missing joints fail clearly and preserve the previous valid sketch. Valid unusual or off-canvas geometry is framed without per-joint clamping. Local coordinates are bounded to ±1000, placement coordinates to ±2000. Suspicious proportions produce diagnostics rather than a replacement pose.

Schema-3 support/interaction rules respect explicit articulation. Placement defaults to staying exactly where supplied; `placement.resolveRelations:true` permits whole-figure translation only. Solvers never reconstruct custom limbs or override a preset arm with explicit joints. Unresolved relationships are reported. Attached cups use the final resolved hands. The previous schema-2 automatic preset/semantic layout remains available for old saved scenes, without reinterpreting old coordinates.

Unspecified reaches aim toward the other person's mid-torso, not their head. A source-specified hand, forearm, shoulder, or head can be expressed with `targetRegion`. Arms bend for nearby targets and keep their fixed segment lengths for distant targets. A small gap conveys intention rather than confirmed contact; region targeting is approximate, not a contact solver.

Props use one shared local geometry definition for drawing, support surfaces, framing, and labels. Stones have stable flattened outlines; water has a shallow horizontal surface in pose view and a broader footprint overhead. Ground-level water starts at bank y=420 and interrupts the ground line, with short shoreline joins; it no longer uses the nominal box's center as an inferred elevation. Source-established elevated water can use `waterLevel:"elevated"` and `surfaceY` and is drawn over its basin. Chairs, tables, beds/benches, and openings use simple structural lines. Names such as **Natural spring**, **Boulder**, or **Counter** keep their source labels while silently mapping to the relevant symbol. Unknown types use a generic labeled box. Water does not become a seat or change people's positions when the view changes.

Back support checks the middle/upper torso, not just the hip. A prop too low to meet that zone is diagnosed. In schema 3, explicit articulation wins: back support never forces a backward lean or mirrored body. Preset resting arms use separate near/far offsets and bends to keep elbows and hands readable. These are side-projection roles, not anatomical left/right labels.

**Small interaction support:** `arms:"holding"` plus a cup's `heldBy` attaches the cup to the selected near/far hand; `arms:"pointing"` directs one arm toward a prop or participant and keeps the other resting. Cup grasp detail is omitted. Overhead cups appear beside their owner's marker, not as a reconstruction of articulated hands. `contact:{type:"embrace",target:...}` retains explicitly described contact separately from reaching intent, but a full wraparound embrace is **not reliably rendered**; the panel states that limitation. Campfires use a minimal symbol. A person behind a fire in depth may overlap it in pose view; overhead view distinguishes supplied depth. These features do not add API requests.

The reaching-intent notice appears only for an actual non-contact reaching scene in pose view. Scenes with resting, holding, pointing, or explicitly described embrace contact do not get that generic disclaimer. Scene interpretation, assumptions, diagnostics, and request status remain separate.

**Pose view (side)** shows articulated posture. **Overhead layout (positions)** shows placement/facing markers, not a valid overhead projection of a custom side-view skeleton. Separately supplied depth and footprints come from the same response; missing values use disclosed schematic defaults. Switching views cannot reveal spatial information the source/model never supplied, and never sends another request. The eleven-joint 2D skeleton does not fully represent 3D torso twist, fingers, or hidden depth.

Positions are schematic, not measurements. Presets improve routine skeleton geometry, but this is not a physics, contact, collision, or anatomy validator. Close people can overlap. High seats can leave feet hanging; small/incompatible supports fall back with an explanation. Labels in wide scenes shrink at narrow widths. Colors distinguish people but have no narrative meaning.

### Editing locally

Expand **Advanced · Edit scene JSON**, change the data, and click **Apply edits**. This does not contact your model.

Version 3 JSON supports both explicit geometry modes described in [SCHEMA.md](SCHEMA.md). The existing collapsed JSON editor remains available. No visual correction tools, draggable joints, or undo were added; schema version 3 is a data-format version, not a release of the deferred editing UI.

Old coordinate-based sketches (absent version or `1`) and semantic schema-2 sketches remain readable/exportable using their original coordinate and normalization rules. They are not automatically migrated or overwritten. Coordinate-only scenes have no interpretation or overhead depth, so both views retain their geometry with a compatibility notice. A new explicitly generated sketch replaces the latest saved snapshot, as before. New schema-3 saves and JSON exports retain the full original custom joint map or preset/overrides, placement, and transform rather than exporting a preset approximation.

For **legacy coordinate JSON only**, the coordinate envelope is 800 × 500 units. X increases rightward; Y increases downward. Each person has exactly eleven `[x, y]` pairs in this order:

| Index | Joint |
| --- | --- |
| 0 | Head |
| 1 | Neck |
| 2 | Hip |
| 3 | Left elbow |
| 4 | Left hand |
| 5 | Right elbow |
| 6 | Right hand |
| 7 | Left knee |
| 8 | Left foot |
| 9 | Right knee |
| 10 | Right foot |

Changing `[200, 100]` to `[220, 100]` moves that joint 20 units right. Move all joints to reposition a whole figure.

Props use `name`, `x`, `y`, `w`, and `h`. X and Y locate the upper-left corner. Numeric fields and prop extents are clamped to the canvas.

**Local edits are not saved back to chat metadata in this alpha.** Export edited JSON to keep it. Reopening restores the latest saved generated sketch. You can paste exported JSON into the editor and apply it again.

### Exporting

- **Download SVG:** saves `scene-sketch.svg` for a browser or compatible vector editor.
- **Download JSON:** saves `scene-sketch.json`, including local edits.

PNG export is not included.

## Model usage and cost

Generate uses your currently selected SillyTavern model and connection. There is no separate connection-profile selector in this version.

| Action | Additional model request? |
| --- | --- |
| Sketch Current Scene, Generate/Regenerate, or manually retry | Yes |
| Open Scene Sketch from settings | No |
| Open saved sketch | No |
| Apply JSON edits | No |
| Switch pose/overhead view | No |
| Download SVG or JSON | No |

The serialized source excerpt is capped at **12,000 characters**. Older selected messages are dropped first; an oversized final message retains its ending, speaker name, and valid JSON boundaries. Instructions add tokens beyond this excerpt. Generation requests **1,800 output tokens** with name trimming disabled; backend behavior, reasoning usage, and output-limit handling can affect actual consumption. These settings are not a guaranteed cost ceiling. Large scenes may exhaust this budget and return incomplete JSON; there is no automatic retry.

No image-generation request is made. Your text provider's pricing and limits still apply; local models use your hardware. Failed or discarded results may still incur usage.

## Context, storage, and privacy

Scene Sketch explicitly builds context from the selected recent non-system messages and their speaker names. It does not deliberately include full history, character cards, lorebooks, or memory extensions. SillyTavern and your backend may apply their own generation formatting and settings.

The selected excerpt goes through your configured model connection. Remote providers receive that request. The workflow is local only when your model connection is local.

The extension saves the default recent-message count and view in extension settings. It saves the latest generated scene **and its source excerpt** in chat metadata under `bluewaters_scene_sketch`. It does not append the diagram to narrative messages or implement a separate analytics service.

Saved sketches are snapshots and do not update automatically. They are labeled potentially stale when reopened. Chat switches close the dialog. Results are discarded when chat identity, source state, or tracked chat/message events change during generation, including a switch away and back or an edit followed by undo. Closing a dialog alone does not cancel the request. Generation requires a character or group chat with a chat ID. SillyTavern's `saveMetadata()` requests a chat save, but does not reliably report server persistence failures; verify persistence by reloading the chat.

Exported SVG and JSON contain scene labels and information. Review them before sharing.

## Limitations

- Supports 1–8 people and up to 12 schematic props; empty landscapes and larger crowds are outside the current format.
- Positioning depends on the model's interpretation. This is not an anatomy or continuity validator.
- Details outside the excerpt can be missing.
- Overhead layout is a position/facing aid with optional approximate depth, not a reconstruction of hidden space or an articulated top-down pose.
- No collision detection, physical depth/occlusion engine, detailed appearance, or visual manual correction tools. Label placement is approximate and can create taller layouts in crowded scenes.
- Intimate scenes use neutral positioning without graphic anatomy. The selected model's content restrictions apply.
- No per-message button, slash command, background generation, sketch history, or profile selector in v0.1.0. Generation only starts from an explicit action.
- Generated sketches persist; local edits currently require export to preserve them.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Button missing | Check extension enablement, folder placement, and nesting. Restart SillyTavern and refresh. |
| `generateRaw` unavailable | Update SillyTavern; the required API is not exposed by your build. |
| No source messages | Open a chat containing at least one non-system message. |
| Invalid JSON/schema error | Try a smaller excerpt or a model better at structured output. Retrying makes another request. Oversized text is rejected explicitly. |
| Wrong people or poses | Adjust the context count, review interpretation/assumptions, or correct semantic fields in the existing JSON editor. |
| Confusing top-down result | Switch to side view. |
| Result discarded | Generate again after settling on the intended chat and message state. |
| Old sketch displayed | Click Generate to update the snapshot. |
| Edits disappear on reopening | Export edited JSON; local edits are not persisted in this alpha. |
| Provider error | Verify the active model connection, model availability, and usage limits. |

For loading errors, inspect the browser developer console. Remove private chat content, identifying information, and credentials before sharing logs.

## Updating and removal

For Git installations, use SillyTavern's extension management update controls when available, then refresh. The alpha manifest does not enable automatic updates.

For ZIP installations, replace the extension files with the new version and restart. Avoid mixing release files.

Disable or remove the extension through extension management. For a manual installation, stop SillyTavern and remove only the installed extension folder. Removal does not intentionally purge existing settings or chat metadata.

## Development

Plain browser JavaScript modules and CSS; no bundler or third-party runtime dependencies.

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension metadata |
| `index.js` | UI, generation, exports, settings, and persistence |
| `scene.js` | Prompt, parsing, validation, and SVG rendering |
| `schema3.js`, `articulated.js`, `skeleton.js` | Explicit geometry modes, local transforms, protected articulation, and shared joint naming |
| `schema.js`, `legacy.js` | Version 2 validation and old coordinate-format compatibility |
| `layout.js`, `poses.js` | Relationships, ground/back support, semantic skeletons, and bounded reaching |
| `props.js`, `labels.js`, `svg.js` | Shared prop geometry, nearby labels/framing, and local SVG rendering |
| `fixtures.js`, `preview-fixtures.mjs` | Synthetic scenes and dependency-free SVG gallery export |
| `style.css` | Styling |
| `scene.test.js` | Core unit tests |
| `package.json` | Development metadata and test command |

Keep runtime files at the repository root for direct SillyTavern installation.

### Tests

With Node.js 20 or newer:

```sh
npm test
```

No dependency installation is required. `npm test` covers parser/renderer validation, bounded excerpts, pose geometry/mirroring, limb lengths, support placement, stable relationship resolution, invalid targets/cycles/conflicts, caption limits/escaping, framing, old-format compatibility, and mocked wand/settings lifecycle. The mocked UI also verifies that switching views makes no request and SVG export exactly matches displayed SVG. The mock DOM does not verify real browser layout, downloads, server persistence, provider behavior, or semantic source interpretation.

`node preview-fixtures.mjs` writes standalone SVGs and an HTML gallery to the system temporary directory. It uses no runtime dependency. An optional third argument can point to an already installed Sharp module for developer-only raster previews; Sharp is not required by the extension or tests. Fixtures A–H are preserved. `spatial-fixtures.js` adds a clearly labeled **synthetic** spring-bank reproduction, its mirror, combined chair/back support, bed, near/far and explicit-head reaches, compact long labels, invalid supports, and both old scene formats. No original exported spring-scene JSON was found in this checkout.

`regression-cases.js` adds a varied synthetic set: seated across a table, kneeling beside a lying person, an explicitly described embrace, cup holding plus pointing toward a doorway, a campfire group, and a spring scene without reaching, plus mirrored/elevated variants. Each case stores its source description, fixed structured scene, expected visible relationships, and limitations separately. Rendering tests cannot replace this fixed data with another model interpretation to hide a defect. Incorrect model-selected posture remains a separate provider/interpretation issue. Optional raster previews include 680-pixel desktop and 320-pixel narrow versions; this is development tooling, not an installed user flow.

`articulated-fixtures.js` adds `v3_custom`, `v3_override`, `v3_cup`, `v3_conflict`, `v3_mirror`, and `v3_offCanvas`. These exercise a complete non-preset asymmetric crouch, protected single-arm overrides, head-facing independent of body pose, a cup following the custom hand, unresolved support, explicit mirror and valid off-canvas coordinates. Mock UI tests run custom generation through metadata, JSON/SVG export, reload, and invalid-response recovery. No clothing-coverage renderer exists in this checkout, so no custom-joint clothing behavior is claimed or added.

### Free browser fixture and live checks

Open `test-fixture.html` through the installed extension's HTTP path, for example `http://127.0.0.1:8000/scripts/extensions/third-party/ST-Scene-Sketch/test-fixture.html` (adjust the folder name). Do not open it as a `file:` URL: browser module loading needs HTTP. The isolated page mocks SillyTavern in memory and never calls a provider or writes real chat metadata.

1. Expand the mock settings drawer, change both defaults, then Open Scene Sketch. Confirm no request starts. Close it and select Sketch Current Scene in the mock wand menu; confirm exactly one request starts. Choose **v3_custom** and Return valid scene. Check the asymmetric crouch, hand on the surface, raised other hand, different knees/feet, and head direction. Compare **v3_override**, **v3_cup**, **v3_conflict**, and **v3_mirror**. Explicit geometry must survive unresolved support. Switch views without generating: overhead should show only separately placed markers. Compare SVG export, JSON export and reopening the saved mock scene. Older **case_*** scenes remain development regressions, not production pose modes.
2. Apply valid and invalid JSON edits; check local redraw/error feedback. Download SVG and JSON and inspect them. Close and reopen to restore the mock generated scene.
3. Generate again and choose invalid JSON or Reject request; confirm controls recover without another request.
4. During a pending request, Edit message or Swipe message, then return a valid scene; confirm discard. Switch chat during a pending request; confirm the dialog closes and the result is not saved.
5. In real SillyTavern, reload and check the settings drawer and wand menu action. Confirm chat switches and initialization do not duplicate controls or generate. Check the action is disabled without a usable chat and during a request. Test saved sketch reopening in two different chats. Reload each chat to verify server persistence.
6. Only when ready to authorize provider usage, manually generate a small fictional scene. Check both views and the output-token limit with your chosen backend. Provider failures or discarded results can still incur usage.

Verification for the varied-scene iteration: automated geometry and mock UI checks cover ground/elevated water and line gaps, torso-only back support, separated resting arms, cup attachments, pointing, explicit-contact limitations, conditional notices, framing/export consistency, and previous scene formats. Desktop and 320-pixel raster previews of the six varied scenarios were visually inspected, along with mirrored support/interaction, elevated-water, and overhead fire cases. This caught an elevated-water layering defect, which was corrected. Narrow wide scenes have small labels; embraces and side-view depth remain limited. Raster inspection does not verify the live SillyTavern panel, browser font metrics, or provider interpretation. No live provider request was made by the coding agent. The wand/menu lifecycle safeguards remain covered by mocks; the revised prompt still needs provider testing.

Verification for the architecture correction: automated checks cover both geometry modes, explicit transform order, independent head-facing, unchanged custom joints, protected arm overrides, translation-only relations, reference errors, bounds/framing, attachments, repeated rendering, save/export/reload and older formats. Desktop/narrow raster previews of the custom crouch, override, cup, and mirrored pose were visually inspected. Those checks demonstrate fixed-data geometry preservation and visual plausibility, not that a live model will interpret every unusual posture correctly. No paid/provider call was made for this iteration.

### Integration checklist

- Verify the Scene Sketch settings drawer and chat-input wand action.
- Generate a conversation, seated scene, lying pose, and group scene.
- Verify saved sketches reopen in the correct chat.
- Switch chats, edit messages, and swipe during generation.
- Test provider failures and malformed model responses.
- Test JSON editing and both export formats.
- Check both views with the models you intend to support.

For bug reports, include extension and SillyTavern versions, browser, model/backend, reproduction steps, and sanitized errors. Prefer a short fictional reproduction over a private chat dump.

Reference: [SillyTavern UI extension documentation](https://docs.sillytavern.app/for-contributors/writing-extensions/).

## Credits

Inspired by [u/Deiomo's post about visualizing character poses with HTML and SVG](https://www.reddit.com/r/SillyTavernAI/comments/1xhgusb/i_had_a_shitty_idea_for_a_prompt_get_the_ai_to/).

Created by Emerson / Bluewaters. This is an independent third-party extension, not an official SillyTavern project.

## License

Copyright (c) 2026 Emerson / Bluewaters.

Licensed under the **GNU General Public License v3.0 only** (`GPL-3.0-only`). See [LICENSE](LICENSE) for the complete terms.

Contributions are accepted under the same license.
