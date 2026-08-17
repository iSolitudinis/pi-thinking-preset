# pi-thinking-preset

Remember pi thinking levels per model.

## What it does

`pi-thinking-preset` stores thinking levels changed while a model is active and restores them when you switch back to that model.

The extension acts in UI-capable sessions. It preserves pi's initial thinking level, including a level restored from a session or supplied with `--thinking`.

Presets are saved to `thinking-presets.json` in your pi agent directory. When you switch to a model without a preset, the extension does nothing: pi's current effective thinking level is kept and no preset is created. When a preset is restored, pi handles clamping it to the levels supported by the selected model.

## Install

```bash
pi install npm:pi-thinking-preset
```

Or try it without installing:

```bash
pi -e npm:pi-thinking-preset
```

## Usage

1. Start pi.
2. Select a model.
3. Change the thinking level.
4. Switch models and come back; the previous thinking level is restored automatically.
