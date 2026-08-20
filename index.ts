import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  getAgentDir,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

type ThinkingLevel = ReturnType<ExtensionAPI["getThinkingLevel"]>;
type ModelRef = { provider: string; id: string };

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

function loadPresets(): Record<string, ThinkingLevel> | undefined {
  if (!existsSync(PRESETS_PATH)) return {};

  try {
    const parsed: unknown = JSON.parse(readFileSync(PRESETS_PATH, "utf-8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected an object");
    }

    const presets: Record<string, ThinkingLevel> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isThinkingLevel(value)) {
        throw new Error(`Invalid thinking level for ${key}`);
      }
      presets[key] = value;
    }
    return presets;
  } catch (error) {
    console.warn(
      `Failed to load thinking presets from ${PRESETS_PATH}:`,
      error,
    );
    return undefined;
  }
}

function savePresets(presets: Record<string, ThinkingLevel>) {
  const tempPath = `${PRESETS_PATH}.${process.pid}.tmp`;

  try {
    writeFileSync(tempPath, JSON.stringify(presets, null, 2) + "\n");
    renameSync(tempPath, PRESETS_PATH);
  } catch (error) {
    rmSync(tempPath, { force: true });
    console.warn(
      `Failed to save thinking presets to ${PRESETS_PATH}:`,
      error,
    );
  }
}

function getModelKey(model: ModelRef) {
  return `${model.provider}/${model.id}`;
}

export default function (pi: ExtensionAPI) {
  let activeModelKey: string | undefined;
  let pendingRestore:
    | { modelKey: string; previousLevel: ThinkingLevel }
    | undefined;

  pi.on("session_start", (_event, ctx) => {
    activeModelKey =
      ctx.hasUI && ctx.model ? getModelKey(ctx.model) : undefined;
    pendingRestore = undefined;
  });

  pi.on("session_shutdown", () => {
    activeModelKey = undefined;
    pendingRestore = undefined;
  });

  pi.on("model_select", (event, ctx) => {
    if (!ctx.hasUI) return;

    const modelKey = getModelKey(event.model);

    // Initial model selection and session restore must preserve pi's state.
    if (event.source === "restore" || event.previousModel === undefined) {
      activeModelKey = modelKey;
      pendingRestore = undefined;
      return;
    }

    // Ignore duplicate notifications for the already active model.
    if (activeModelKey === modelKey) return;
    activeModelKey = modelKey;

    const presets = loadPresets();
    if (!presets) return;

    const storedLevel = presets[modelKey];
    if (storedLevel === undefined || pi.getThinkingLevel() === storedLevel) {
      return;
    }

    const previousLevel = pi.getThinkingLevel();
    pendingRestore = { modelKey, previousLevel };
    pi.setThinkingLevel(storedLevel);

    // setThinkingLevel emits only when the effective level changes.
    if (pi.getThinkingLevel() === previousLevel) {
      pendingRestore = undefined;
    }
  });

  pi.on("thinking_level_select", (event, ctx) => {
    if (!ctx.hasUI || !ctx.model) return;

    const modelKey = getModelKey(ctx.model);

    // Ignore model-switch changes that arrive before model_select.
    if (activeModelKey !== modelKey) return;

    // Ignore the event emitted by this extension while restoring a preset.
    if (
      pendingRestore?.modelKey === modelKey &&
      pendingRestore.previousLevel === event.previousLevel
    ) {
      pendingRestore = undefined;
      return;
    }

    // Ignore stale events whose level has already been replaced.
    if (event.level !== pi.getThinkingLevel()) return;

    const presets = loadPresets();
    if (!presets || presets[modelKey] === event.level) return;

    presets[modelKey] = event.level;
    savePresets(presets);
  });
}
