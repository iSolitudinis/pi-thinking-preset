# pi-thinking-preset

Remember pi thinking levels per model.

## What it does

`pi-thinking-preset` stores the selected thinking level for each model and restores it when you switch back to that model.

The extension only acts in TUI mode. It preserves pi's initial thinking level, including a level restored from a session or supplied with `--thinking`. Presets are applied only after a manual model switch through `/model` or Ctrl+P.

Presets are saved to `thinking-presets.json` in your pi agent directory. When a model without a preset is reached by a model switch, it starts from `medium`, clamped to the levels supported by that model. The effective level is saved as the model's preset.

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
