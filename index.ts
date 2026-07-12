import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clampThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

type ThinkingLevel = ReturnType<ExtensionAPI["getThinkingLevel"]>;
type ModelRef = { provider: string; id: string };

const DEFAULT_THINKING_LEVEL: ThinkingLevel = "medium";
const PRESETS_PATH = join(getAgentDir(), "thinking-presets.json");

function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return (
    value === "off" ||
    value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh" ||
    value === "max"
  );
}

function loadPresets(): Record<string, ThinkingLevel> {
  if (!existsSync(PRESETS_PATH)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(PRESETS_PATH, "utf-8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected an object");
    }

    const presets: Record<string, ThinkingLevel> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isThinkingLevel(value)) {
        presets[key] = value;
      }
    }
    return presets;
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

function getModelKey(model: ModelRef) {
  return `${model.provider}/${model.id}`;
}

export default function (pi: ExtensionAPI) {
  let currentModelKey: string | undefined;

  pi.on("session_start", (_event, ctx) => {
    currentModelKey =
      ctx.mode === "tui" && ctx.model ? getModelKey(ctx.model) : undefined;
  });

  pi.on("session_shutdown", () => {
    currentModelKey = undefined;
  });

  pi.on("model_select", (event, ctx) => {
    if (ctx.mode !== "tui") return;

    const modelKey = getModelKey(event.model);

    // Initial model selection and session restore must preserve pi's state.
    if (event.source === "restore" || event.previousModel === undefined) {
      currentModelKey = modelKey;
      return;
    }

    // Ignore duplicate notifications for the already active model.
    if (currentModelKey === modelKey) return;
    currentModelKey = modelKey;

    const presets = loadPresets();
    const storedLevel = presets[modelKey];
    const requestedLevel = storedLevel ?? DEFAULT_THINKING_LEVEL;
    const level = clampThinkingLevel(event.model, requestedLevel);

    // Persist the effective level, including a clamp or a first-time default.
    if (storedLevel !== level) {
      presets[modelKey] = level;
      savePresets(presets);
    }

    if (pi.getThinkingLevel() !== level) {
      pi.setThinkingLevel(level);
    }
  });

  pi.on("thinking_level_select", (event, ctx) => {
    if (ctx.mode !== "tui") return;

    const model = ctx.model;
    if (!model) return;

    const modelKey = getModelKey(model);

    // Ignore model-switch events that arrive before model_select, and stale
    // events whose level has already been replaced by a newer change.
    if (currentModelKey !== modelKey) return;
    if (event.level !== pi.getThinkingLevel()) return;

    const presets = loadPresets();
    if (presets[modelKey] !== event.level) {
      presets[modelKey] = event.level;
      savePresets(presets);
    }
  });
}
