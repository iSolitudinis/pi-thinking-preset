import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clampThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

type ThinkingLevel = ReturnType<ExtensionAPI["getThinkingLevel"]>;
type ModelRef = { provider: string; id: string };

type PendingInternalChange = {
  modelKey: string;
  level: ThinkingLevel;
};

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

function getKey(model: ModelRef) {
  return `${model.provider}/${model.id}`;
}

export default function (pi: ExtensionAPI) {
  let initialized = false;
  let currentModelKey: string | undefined;
  let pendingInternalChange: PendingInternalChange | undefined;
  let pendingClearTimer: ReturnType<typeof setTimeout> | undefined;

  function clearPendingInternalChange() {
    pendingInternalChange = undefined;
    if (pendingClearTimer !== undefined) {
      clearTimeout(pendingClearTimer);
      pendingClearTimer = undefined;
    }
  }

  function deferPendingInternalChangeClear(change: PendingInternalChange) {
    if (pendingClearTimer !== undefined) {
      clearTimeout(pendingClearTimer);
    }
    pendingClearTimer = setTimeout(() => {
      if (pendingInternalChange === change) {
        pendingInternalChange = undefined;
      }
      pendingClearTimer = undefined;
    }, 0);
  }

  pi.on("session_start", (_event, ctx) => {
    clearPendingInternalChange();
    initialized = ctx.mode === "tui";
    currentModelKey = initialized && ctx.model ? getKey(ctx.model) : undefined;
  });

  pi.on("session_shutdown", () => {
    clearPendingInternalChange();
    initialized = false;
    currentModelKey = undefined;
  });

  pi.on("model_select", (event, ctx) => {
    if (ctx.mode !== "tui") return;

    const key = getKey(event.model);

    // Initial model selection and session restore must preserve pi's state.
    if (
      !initialized ||
      event.source === "restore" ||
      event.previousModel === undefined
    ) {
      currentModelKey = key;
      return;
    }

    // Ignore duplicate notifications for the already active model.
    if (currentModelKey === key) return;
    currentModelKey = key;

    const presets = loadPresets();
    const storedLevel = presets[key];
    const requestedLevel = storedLevel ?? DEFAULT_THINKING_LEVEL;
    const level = clampThinkingLevel(event.model, requestedLevel);

    // Persist the effective level, including a clamp or a first-time default.
    if (storedLevel !== level) {
      presets[key] = level;
      savePresets(presets);
    }

    // pi may emit thinking_level_select both for its model-switch adjustment
    // and for this extension's adjustment. Neither is a user preference.
    const change: PendingInternalChange = { modelKey: key, level };
    pendingInternalChange = change;
    if (pi.getThinkingLevel() !== level) {
      pi.setThinkingLevel(level);
    }
    deferPendingInternalChangeClear(change);
  });

  pi.on("thinking_level_select", (event, ctx) => {
    if (ctx.mode !== "tui") return;

    const model = ctx.model;
    if (!model) return;

    const key = getKey(model);

    // A model-switch event can arrive before model_select. The active model
    // key still points at the previous model in that case.
    if (currentModelKey !== key) return;

    if (pendingInternalChange?.modelKey === key) {
      // Ignore pi's automatic level and the level applied by this extension.
      // Keep waiting if the automatic level differs from our target.
      if (pendingInternalChange.level === event.level) {
        clearPendingInternalChange();
      }
      return;
    }

    const presets = loadPresets();
    if (presets[key] !== event.level) {
      presets[key] = event.level;
      savePresets(presets);
    }
  });
}
