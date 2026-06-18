import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

type ThinkingLevel = ReturnType<ExtensionAPI["getThinkingLevel"]>;

const PRESETS_PATH = join(getAgentDir(), "thinking-presets.json");

function loadPresets(): Record<string, ThinkingLevel> {
  if (!existsSync(PRESETS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(PRESETS_PATH, "utf-8"));
  } catch (error) {
    console.warn(
      `Failed to load thinking presets from ${PRESETS_PATH}:`,
      error,
    );
    return {};
  }
}

function savePresets(presets: Record<string, ThinkingLevel>) {
  writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2) + "\n");
}

function getKey(model: { provider: string; id: string }) {
  return `${model.provider}/${model.id}`;
}

export default function (pi: ExtensionAPI) {
  pi.on("model_select", (event, ctx) => {
    const key = getKey(event.model);
    const level = loadPresets()[key];
    if (level && pi.getThinkingLevel() !== level) {
      pi.setThinkingLevel(level);
    }
  });

  pi.on("thinking_level_select", (event, ctx) => {
    const model = ctx.model;
    if (!model) return;

    const key = getKey(model);
    const presets = loadPresets();
    if (presets[key] !== event.level) {
      presets[key] = event.level;
      savePresets(presets);
    }
  });
}
