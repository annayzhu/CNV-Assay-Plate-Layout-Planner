import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyWellOverrides,
  buildReactionSets,
  defaultLoadingPattern,
  findDuplicateReporters,
  planCnvLayout,
  validatePlan,
  type AssayMode,
  type LayoutPreset,
  type LoadingPattern,
  type PlanInput,
  type PlateType,
  type ReferenceAssay,
  type SampleInput,
  type TargetAssay,
  type WellOverride,
} from "@/lib/cnvPlanner";
import { instrumentTsv } from "@/lib/exportWorkbook";
import {
  calculateReactionRequirements,
  validateReactionSystem,
  type ReactionSystem,
} from "@/lib/reactionCalculator";
import {
  createDocument,
  createPersistedState,
  normalizePlanInput,
  parseNames,
  PLANNER_STORAGE_KEY,
  restoreState,
  type Language,
  type PlannerDocument,
  type Translate,
} from "@/app/plannerDocument";

export type { Language, Translate } from "@/app/plannerDocument";

interface WellSelection {
  wellId: string;
  sampleId: string;
  reactionSetId: string;
  replicate: number;
}

const EXAMPLE_SAMPLES: SampleInput[] = [
  { id: "sample-unknown-1", name: "Unknown_001", type: "unknown" },
  { id: "sample-calibrator", name: "Calibrator_2copy", type: "calibrator" },
  { id: "sample-ntc", name: "NTC", type: "ntc" },
];

const EXAMPLE_TARGETS: TargetAssay[] = [
  { id: "target-gstm1", name: "GSTM1", assayId: "", reporter: "FAM", volumeUl: 0.5 },
  { id: "target-gstt1", name: "GSTT1", assayId: "", reporter: "CY5", volumeUl: 0.5 },
];

const EXAMPLE_REFERENCE: ReferenceAssay = {
  name: "RNase P",
  assayId: "",
  reporter: "VIC",
  volumeUl: 0.5,
};

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function usePlannerController() {
  const [restored] = useState(() => restoreState(typeof window === "undefined" ? null : window.localStorage));
  const [documentState, setDocumentState] = useState(restored.document);
  const [savedAt, setSavedAt] = useState(restored.savedAt);
  const [isDirty, setIsDirty] = useState(false);
  const [requestedPlate, setRequestedPlate] = useState(0);
  const [selection, setSelection] = useState<WellSelection | null>(null);
  const [toast, setToast] = useState("");
  const lastSavedSnapshot = useRef(JSON.stringify(restored.document));

  const { language, input, reactionSystem, bulkText, layoutEnabled, overrides } = documentState;
  const tr: Translate = (zh, en) => (language === "zh" ? zh : en);
  const normalizedInput = useMemo(() => normalizePlanInput(input), [input]);
  const bulkNames = useMemo(() => parseNames(bulkText), [bulkText]);
  const reactionSets = useMemo(() => buildReactionSets(normalizedInput), [normalizedInput]);
  const duplicateReporters = useMemo(
    () => findDuplicateReporters(normalizedInput),
    [normalizedInput],
  );
  const planning = useMemo(() => {
    if (!layoutEnabled) return { plan: null, error: "" };
    try {
      return {
        plan: applyWellOverrides(planCnvLayout(normalizedInput), overrides),
        error: "",
      };
    } catch (error) {
      return {
        plan: null,
        error: error instanceof Error ? error.message : "排板失败，请检查输入。 / Planning failed.",
      };
    }
  }, [layoutEnabled, normalizedInput, overrides]);
  const plan = planning.plan;
  const issues = useMemo(() => (plan ? validatePlan(plan) : []), [plan]);
  const reactionErrors = useMemo(
    () => (plan ? validateReactionSystem(plan, reactionSystem) : []),
    [plan, reactionSystem],
  );
  const requirements = useMemo(
    () => (plan ? calculateReactionRequirements(plan, reactionSystem) : null),
    [plan, reactionSystem],
  );
  const canGenerate =
    normalizedInput.samples.length > 0 &&
    normalizedInput.targets.length > 0 &&
    Boolean(normalizedInput.reference.name) &&
    duplicateReporters.size === 0;
  const activePlate = Math.min(requestedPlate, Math.max(0, (plan?.plates.length ?? 1) - 1));
  const plate = plan?.plates[activePlate] ?? null;
  const selected = plate?.wells.find((well) => well.id === selection?.wellId) ?? null;

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  useEffect(() => {
    const snapshot = JSON.stringify(documentState);
    if (snapshot === lastSavedSnapshot.current) return;
    setIsDirty(true);
    const timer = window.setTimeout(() => {
      try {
        const nextSavedAt = new Date().toISOString();
        const stored = createPersistedState(documentState, nextSavedAt);
        localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(stored));
        lastSavedSnapshot.current = snapshot;
        setSavedAt(nextSavedAt);
        setIsDirty(false);
      } catch {
        setToast(language === "zh" ? "自动保存失败，请使用顶部“保存”重试。" : "Autosave failed. Use Save in the top bar to retry.");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [documentState, language]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function updateDocument(update: (current: PlannerDocument) => PlannerDocument) {
    setDocumentState(update);
  }

  function updateInput(update: (current: PlanInput) => PlanInput) {
    if (overrides.length > 0) {
      setToast(tr("实验设置已变化，原有手工改单已清除。", "Setup changed; previous manual well edits were cleared."));
    }
    updateDocument((current) => ({ ...current, input: update(current.input), overrides: [] }));
    setSelection(null);
  }

  function setLanguage(next: Language) {
    updateDocument((current) => ({ ...current, language: next }));
  }

  function setPlateType(plateType: PlateType) {
    if (plateType === input.plateType) return;
    const loadingPattern = defaultLoadingPattern(plateType);
    updateInput((current) => ({
      ...current,
      plateType,
      loadingPattern,
      layoutPreset: loadingPattern === "interleaved-8-channel" ? "assay-major" : current.layoutPreset,
    }));
    setRequestedPlate(0);
  }

  function setAssayMode(assayMode: AssayMode) {
    updateInput((current) => ({ ...current, assayMode }));
  }

  function setReplicates(replicates: number) {
    updateInput((current) => ({ ...current, replicates }));
  }

  function setLayoutPreset(layoutPreset: LayoutPreset) {
    updateInput((current) => ({ ...current, layoutPreset }));
  }

  function setLoadingPattern(loadingPattern: LoadingPattern) {
    updateInput((current) => ({
      ...current,
      loadingPattern,
      layoutPreset: loadingPattern === "interleaved-8-channel" ? "assay-major" : current.layoutPreset,
    }));
    if (loadingPattern === "interleaved-8-channel") {
      setToast(tr("已切换为推荐的隔行上样，并采用按反应组排列。", "Switched to the recommended interleaved route with reaction-set-major layout."));
    }
  }

  function setBulkText(next: string) {
    updateDocument((current) => ({ ...current, bulkText: next }));
  }

  function updateSample(index: number, patch: Partial<SampleInput>) {
    updateInput((current) => ({
      ...current,
      samples: current.samples.map((sample, sampleIndex) =>
        sampleIndex === index ? { ...sample, ...patch } : sample,
      ),
    }));
  }

  function addSample() {
    updateInput((current) => ({
      ...current,
      samples: [...current.samples, { id: makeId("sample"), name: "", type: "unknown" }],
    }));
  }

  function removeSample(index: number) {
    updateInput((current) => ({
      ...current,
      samples: current.samples.filter((_, sampleIndex) => sampleIndex !== index),
    }));
  }

  function importSamples() {
    const existing = new Set(input.samples.map((sample) => sample.name.trim().toLocaleLowerCase()));
    const additions = bulkNames
      .filter((name) => !existing.has(name.toLocaleLowerCase()))
      .map((name) => ({ id: makeId("sample"), name, type: "unknown" as const }));
    updateInput((current) => ({ ...current, samples: [...current.samples, ...additions] }));
    setBulkText("");
    setToast(tr(`已导入 ${additions.length} 个样本名称。`, `Imported ${additions.length} sample name(s).`));
  }

  function clearSamples() {
    updateDocument((current) => ({
      ...current,
      input: { ...current.input, samples: [] },
      bulkText: "",
      layoutEnabled: false,
      overrides: [],
    }));
    setRequestedPlate(0);
    setSelection(null);
    setToast(tr("样本录入区已清空。", "Sample entry cleared."));
  }

  function updateTarget(index: number, patch: Partial<TargetAssay>) {
    updateInput((current) => ({
      ...current,
      targets: current.targets.map((target, targetIndex) =>
        targetIndex === index ? { ...target, ...patch } : target,
      ),
    }));
  }

  function addTarget() {
    updateInput((current) => ({
      ...current,
      targets: [...current.targets, { id: makeId("target"), name: "", assayId: "", reporter: "", volumeUl: 0.5 }],
    }));
  }

  function removeTarget(index: number) {
    updateInput((current) => ({
      ...current,
      targets: current.targets.filter((_, targetIndex) => targetIndex !== index),
    }));
  }

  function updateReference(patch: Partial<ReferenceAssay>) {
    updateInput((current) => ({
      ...current,
      reference: { ...current.reference, ...patch },
    }));
  }

  function updateReactionSystem(patch: Partial<ReactionSystem>) {
    updateDocument((current) => ({
      ...current,
      reactionSystem: { ...current.reactionSystem, ...patch },
    }));
  }

  function loadExample() {
    updateDocument((current) => ({
      ...createDocument(current.language),
      input: {
        ...createDocument(current.language).input,
        samples: EXAMPLE_SAMPLES.map((sample) => ({ ...sample })),
        targets: EXAMPLE_TARGETS.map((target) => ({ ...target })),
        reference: { ...EXAMPLE_REFERENCE },
      },
    }));
    setRequestedPlate(0);
    setSelection(null);
    setToast(tr("示例样本与 CNV Assay 已载入；确认后再生成板布局。", "Example samples and CNV assays loaded. Review them before generating the layout."));
  }

  function generatePlan() {
    try {
      const nextPlan = planCnvLayout(normalizedInput);
      updateDocument((current) => ({ ...current, layoutEnabled: true, overrides: [] }));
      setRequestedPlate(0);
      setSelection(null);
      setToast(tr(`已生成 ${nextPlan.plates.length} 块板，共 ${nextPlan.occupiedWells} 个反应孔。`, `Generated ${nextPlan.plates.length} plate(s) with ${nextPlan.occupiedWells} reaction wells.`));
    } catch (error) {
      setToast(error instanceof Error ? error.message : "排板失败，请检查输入。 / Planning failed.");
    }
  }

  function saveNow() {
    try {
      const nextSavedAt = new Date().toISOString();
      const stored = createPersistedState(documentState, nextSavedAt);
      localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(stored));
      lastSavedSnapshot.current = JSON.stringify(documentState);
      setSavedAt(nextSavedAt);
      setIsDirty(false);
      setToast(tr("已保存到本浏览器。", "Saved in this browser."));
    } catch {
      setToast(tr("保存失败，请检查浏览器的本地存储权限。", "Save failed. Check this browser's local-storage permission."));
    }
  }

  function resetTool() {
    if (!window.confirm(tr("确认清空本工具中保存的样本、assay 与板图？此操作不可撤销。", "Clear all saved samples, assays, and plate layouts? This cannot be undone."))) return;
    const next = createDocument(language);
    localStorage.removeItem(PLANNER_STORAGE_KEY);
    lastSavedSnapshot.current = JSON.stringify(next);
    setDocumentState(next);
    setSavedAt("");
    setIsDirty(false);
    setRequestedPlate(0);
    setSelection(null);
    setToast(tr("工具已重置。", "Reset complete."));
  }

  function choosePlate(index: number) {
    setRequestedPlate(index);
    setSelection(null);
  }

  function selectWell(wellId: string) {
    const well = plate?.wells.find((candidate) => candidate.id === wellId);
    if (!well) return;
    setSelection({
      wellId,
      sampleId: well.sampleId,
      reactionSetId: well.reactionSetId || reactionSets[0]?.id || "",
      replicate: well.replicate || 1,
    });
  }

  function updateSelection(patch: Partial<WellSelection>) {
    setSelection((current) => current ? { ...current, ...patch } : current);
  }

  function closeSelection() {
    setSelection(null);
  }

  function applyManualWell(clear = false) {
    if (!plate || !selection) return;
    const sample = input.samples.find((candidate) => candidate.id === selection.sampleId);
    const reactionSet = reactionSets.find((candidate) => candidate.id === selection.reactionSetId);
    if (!clear && (!sample || !reactionSet)) {
      setToast(tr("请选择样本和反应组。", "Select a sample and reaction set."));
      return;
    }
    const override: WellOverride = {
      plateNumber: plate.plateNumber,
      wellId: selection.wellId,
      sampleId: clear ? null : selection.sampleId,
      reactionSetId: clear ? null : selection.reactionSetId,
      replicate: clear ? null : selection.replicate,
    };
    updateDocument((current) => ({
      ...current,
      overrides: [
        ...current.overrides.filter(
          (candidate) => candidate.plateNumber !== override.plateNumber || candidate.wellId !== override.wellId,
        ),
        override,
      ],
    }));
    setToast(clear ? tr(`${selection.wellId} 已清空。`, `${selection.wellId} cleared.`) : tr(`${selection.wellId} 已手工更新；请查看质控提示。`, `${selection.wellId} updated manually; review the QC messages.`));
  }

  async function copyCurrentPlate(includeHeader: boolean) {
    if (!plan || !plate) return;
    try {
      await copyText(instrumentTsv(plan, plate, includeHeader));
      setToast(includeHeader ? tr("已复制 Well + Sample（含表头）。", "Copied Well + Sample with headers.") : tr("已复制 Well + Sample（无表头）。", "Copied Well + Sample without headers."));
    } catch {
      setToast(tr("复制失败，请检查浏览器剪贴板权限。", "Copy failed. Check clipboard permission."));
    }
  }

  return {
    language,
    tr,
    input,
    reactionSystem,
    bulkText,
    bulkNames,
    reactionSets,
    duplicateReporters,
    canGenerate,
    layoutEnabled,
    plan,
    planError: planning.error,
    plate,
    activePlate,
    selection,
    selected,
    issues,
    reactionErrors,
    requirements,
    savedAt,
    isDirty,
    toast,
    setToast,
    setLanguage,
    setPlateType,
    setAssayMode,
    setReplicates,
    setLayoutPreset,
    setLoadingPattern,
    setBulkText,
    updateSample,
    addSample,
    removeSample,
    importSamples,
    clearSamples,
    updateTarget,
    addTarget,
    removeTarget,
    updateReference,
    updateReactionSystem,
    loadExample,
    generatePlan,
    saveNow,
    resetTool,
    choosePlate,
    selectWell,
    updateSelection,
    closeSelection,
    applyManualWell,
    copyCurrentPlate,
  };
}

export type PlannerController = ReturnType<typeof usePlannerController>;
