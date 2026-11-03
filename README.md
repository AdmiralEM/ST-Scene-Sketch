# Scene Sketch

**Simple scene diagrams for SillyTavern, powered by your existing text model.**

Scene Sketch turns recent chat messages into labeled SVG stick-figure diagrams showing who is where, how people are posed, and how they relate to furniture and one another. Use it for conversations, action, or intimate scenes when you want a quick visual reference.

The model returns scene data as JSON, and the extension draws it locally. No image-generation model, ComfyUI workflow, or extra service is required.

> **Alpha: v0.1.0.** Core parser and renderer tests pass. Installation, live generation, and compatibility with individual SillyTavern builds and providers still require testing. Expect imperfect poses and occasional invalid model responses.

## Features

- Manual generation: one scene request when you click Generate.
- Select the latest 1–12 non-system messages; default: four.
- Named, colored stick figures with eleven joint positions each.
- Labeled rectangular props representing furniture and other objects.
- Side view and experimental top-down view.
- Assumption notes, posture descriptions, and facing descriptions.
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

Once this repository is published:

1. Open SillyTavern and select **Extensions** in the top bar.
2. Select **Install extension**.
3. Paste the HTTPS URL of **this repository**, copied from your browser address bar. Use the repository URL, not a ZIP or individual file link.
4. Choose your user or all users if prompted.
5. Complete installation and reload SillyTavern.
6. Open extension settings and find **Scene Sketch · Open**.

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
2. Open **Extensions settings → Scene Sketch · Open**.
3. Choose the number of **Recent messages** needed to understand the current scene.
4. Select **side** or **top-down**.
5. Click **Generate** and wait for the diagram.
6. Review the assumptions and character descriptions below it.

The prompt asks for the **final moment** in the excerpt, not a sequence of panels. Start with side view and four messages. Reduce the count for a self-contained response; increase it when earlier messages establish positions or participants. Including an unrelated earlier scene can confuse the result.

Only one Scene Sketch request runs at a time. Closing the dialog does not cancel a request. Failed requests are not automatically retried.

### Reading the diagram

Colored lines represent limbs and bodies; circles represent heads. Names appear above heads, and labeled rectangles represent props. Facing direction appears in the descriptions below the diagram rather than through facial indicators.

Positions are schematic, not measurements. Coordinates do not represent feet, meters, or combat-grid squares. The model can draw an impossible pose even when its output is valid JSON.

### Editing locally

Expand **Edit scene JSON (free local redraw)**, change the data, and click **Apply edits**. This does not contact your model.

The canvas is 800 × 500 units. X increases rightward; Y increases downward. Each person needs exactly eleven `[x, y]` pairs in this order:

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

Props use `name`, `x`, `y`, `w`, and `h`. X and Y locate the upper-left corner. Numeric fields are clamped to allowed ranges, but a whole prop can still extend beyond the canvas.

**Local edits are not saved back to chat metadata in this alpha.** Export edited JSON to keep it. Reopening restores the latest saved generated sketch. You can paste exported JSON into the editor and apply it again.

### Exporting

- **Download SVG:** saves `scene-sketch.svg` for a browser or compatible vector editor.
- **Download JSON:** saves `scene-sketch.json`, including local edits.

PNG export is not included.

## Model usage and cost

Generate uses your currently selected SillyTavern model and connection. There is no separate connection-profile selector in this version.

| Action | Additional model request? |
| --- | --- |
| Generate or manually retry | Yes |
| Open saved sketch | No |
| Apply JSON edits | No |
| Download SVG or JSON | No |

The source excerpt is capped at **12,000 characters**, keeping the end if it exceeds the limit. Instructions add tokens beyond this excerpt. Generation requests **1,800 output tokens**; backend behavior, reasoning usage, and output-limit handling can affect actual consumption. These settings are not a guaranteed cost ceiling.

No image-generation request is made. Your text provider's pricing and limits still apply; local models use your hardware. Failed or discarded results may still incur usage.

## Context, storage, and privacy

Scene Sketch explicitly builds context from the selected recent non-system messages and their speaker names. It does not deliberately include full history, character cards, lorebooks, or memory extensions. SillyTavern and your backend may apply their own generation formatting and settings.

The selected excerpt goes through your configured model connection. Remote providers receive that request. The workflow is local only when your model connection is local.

The extension saves the recent-message count in extension settings. It saves the latest generated scene **and its source excerpt** in chat metadata under `bluewaters_scene_sketch`. It does not append the diagram to narrative messages or implement a separate analytics service.

Saved sketches are snapshots and do not update automatically. They are labeled potentially stale when reopened. The extension attempts to discard generation results if the source chat changes while a request is running.

Exported SVG and JSON contain scene labels and information. Review them before sharing.

## Limitations

- Supports 1–8 people and up to 12 rectangular props; empty landscapes and larger crowds are outside the current format.
- Positioning depends on the model's interpretation. This is not an anatomy or continuity validator.
- Details outside the excerpt can be missing.
- Top-down view is experimental and uses the same skeleton renderer; projection depends on model-generated coordinates.
- No collision detection, automatic label layout, depth system, detailed appearance, or drag-and-drop posing. Colors repeat after six people.
- Intimate scenes use neutral positioning without graphic anatomy. The selected model's content restrictions apply.
- No per-message button, slash command, automatic generation, sketch history, or profile selector in v0.1.0.
- Generated sketches persist; local edits currently require export to preserve them.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Button missing | Check extension enablement, folder placement, and nesting. Restart SillyTavern and refresh. |
| `generateRaw` unavailable | Update SillyTavern; the required API is not exposed by your build. |
| No source messages | Open a chat containing at least one non-system message. |
| Invalid JSON or joint-count error | Try a smaller excerpt or a model better at structured output. Retrying makes another request. |
| Wrong people or poses | Adjust the context count, review assumption notes, or correct coordinates locally. |
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
| `style.css` | Styling |
| `scene.test.js` | Core unit tests |
| `package.json` | Development metadata and test command |

Keep runtime files at the repository root for direct SillyTavern installation.

### Tests

With Node.js 20 or newer:

```sh
npm test
```

No dependency installation is required for the current tests. They cover fenced JSON parsing, coordinate bounds, malformed skeleton rejection, oversized responses, markup escaping, and prompt boundaries. They do not verify live integration or pose accuracy.

### Integration checklist

- Install from a clean repository checkout and verify the settings button.
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
