import type {
  AssayMode,
  LayoutPreset,
  LoadingPattern,
  PlanInput,
  PlanResult,
  PlateType,
  ReferenceAssay,
  SampleInput,
  SampleType,
  TargetAssay,
  WellOverride,
} from "@/lib/cnvPlanner";
import { DEFAULT_REACTION_SYSTEM, type ReactionSystem } from "@/lib/reactionCalculator";

export const PLANNER_STORAGE_KEY = "taqman-cnv-plate-planner:v1";
export const STORAGE_VERSION = 6;

const LEGACY_PRESET_ASSAY_IDS = new Set([
  "Ho_33001161_cn",
  "Ho_33001153_cn",
  "Ho_00021109_cn",
]);

export type Language = "zh" | "en";
export type Translate = (zh: string, en: string) => string;

export const SAMPLE_TYPES: SampleType[] = [
  "unknown",
  "calibrator",
  "ntc",
  "qc-0",
  "qc-1",
  "qc-2",
];

export interface PlannerDocument {
  language: Language;
  input: PlanInput;
  reactionSystem: ReactionSystem;
  bulkText: string;
  layoutEnabled: boolean;
  overrides: WellOverride[];
}

export interface PersistedState {
  version: typeof STORAGE_VERSION;
  document: PlannerDocument;
  savedAt: string;
}

interface LegacyState {
  version: number;
  language?: Language;
  plateType: PlateType;
  assayMode: AssayMode;
  samples: SampleInput[];
  targets: TargetAssay[];
  reference: ReferenceAssay;
  replicates: number;
  layoutPreset: LayoutPreset;
  loadingPattern: LoadingPattern;
  reactionSystem: ReactionSystem;
  plan: PlanResult | null;
  bulkText?: string;
  savedAt: string;
}

const EMPTY_REFERENCE: ReferenceAssay = {
  name: "",
  assayId: "",
  reporter: "",
  volumeUl: 0.5,
};

export function createDocument(language: Language = "zh"): PlannerDocument {
  return {
    language,
    input: {
      plateType: 96,
      assayMode: "multiplex",
      samples: [],
      targets: [],
      reference: { ...EMPTY_REFERENCE },
      replicates: 4,
      layoutPreset: "sample-major",
      loadingPattern: "sequential",
    },
    reactionSystem: { ...DEFAULT_REACTION_SYSTEM },
    bulkText: "",
    layoutEnabled: false,
    overrides: [],
  };
}

export function normalizePlanInput(input: PlanInput): PlanInput {
  return {
    ...input,
    samples: input.samples
      .map((sample) => ({ ...sample, name: sample.name.trim() }))
      .filter((sample) => sample.name),
    targets: input.targets
      .map((target) => ({ ...target, name: target.name.trim() }))
      .filter((target) => target.name),
    reference: { ...input.reference, name: input.reference.name.trim() },
  };
}

export function parseNames(value: string) {
  return value
    .split(/\r?\n|\t/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function legacyOverrides(plan: PlanResult | null): WellOverride[] {
  if (!plan) return [];
  const overrides: WellOverride[] = [];
  for (const plate of plan.plates) {
    for (const well of plate.wells) {
      if (well.source !== "manual") continue;
      overrides.push({
        plateNumber: plate.plateNumber,
        wellId: well.id,
        sampleId: well.sampleId || null,
        reactionSetId: well.reactionSetId || null,
        replicate: well.replicate,
      });
    }
  }
  return overrides;
}

export function restoreState(storage: Storage | null): { document: PlannerDocument; savedAt: string } {
  const fallback = { document: createDocument(), savedAt: "" };
  if (!storage) return fallback;
  const raw = storage.getItem(PLANNER_STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const stored = JSON.parse(raw) as PersistedState | LegacyState;
    if (stored.version === STORAGE_VERSION && "document" in stored) {
      return { document: stored.document, savedAt: stored.savedAt };
    }
    if (stored.version < 1 || stored.version > 5 || !("plateType" in stored)) return fallback;

    const targets = stored.targets.map((target) =>
      LEGACY_PRESET_ASSAY_IDS.has(target.assayId) ? { ...target, assayId: "" } : target,
    );
    const reference = LEGACY_PRESET_ASSAY_IDS.has(stored.reference.assayId)
      ? { ...stored.reference, assayId: "" }
      : stored.reference;
    const migrateLegacy384 =
      stored.version === 1 && stored.plateType === 384 && stored.loadingPattern === "sequential";
    const loadingPattern = migrateLegacy384
      ? "interleaved-8-channel"
      : stored.plateType === 96
        ? "sequential"
        : stored.loadingPattern;

    return {
      document: {
        language: stored.language ?? "zh",
        input: {
          plateType: stored.plateType,
          assayMode: stored.assayMode,
          samples: stored.samples,
          targets,
          reference,
          replicates: stored.replicates,
          layoutPreset: migrateLegacy384 ? "assay-major" : stored.layoutPreset,
          loadingPattern,
        },
        reactionSystem: stored.reactionSystem ?? { ...DEFAULT_REACTION_SYSTEM },
        bulkText: stored.bulkText ?? "",
        layoutEnabled: Boolean(stored.plan),
        overrides: stored.version === 5 ? legacyOverrides(stored.plan) : [],
      },
      savedAt: stored.savedAt,
    };
  } catch {
    storage.removeItem(PLANNER_STORAGE_KEY);
    return fallback;
  }
}

export function createPersistedState(document: PlannerDocument, savedAt: string): PersistedState {
  return { version: STORAGE_VERSION, document, savedAt };
}
