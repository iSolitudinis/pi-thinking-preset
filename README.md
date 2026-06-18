# pi-thinking-preset

Remember pi thinking levels per model.

## What it does

`pi-thinking-preset` stores the selected thinking level for each model and restores it when you switch back to that model.

Presets are saved to `thinking-presets.json` in your pi agent directory.

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
