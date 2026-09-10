import assert from "node:assert/strict";
import test from "node:test";
import {
  createDocument,
  createPersistedState,
  normalizePlanInput,
  PLANNER_STORAGE_KEY,
  restoreState,
} from "../app/plannerDocument";

function memoryStorage(initial = new Map<string, string>()) {
  return {
    getItem(key: string) { return initial.get(key) ?? null; },
    setItem(key: string, value: string) { initial.set(key, value); },
    removeItem(key: string) { initial.delete(key); },
    clear() { initial.clear(); },
    key(index: number) { return [...initial.keys()][index] ?? null; },
    get length() { return initial.size; },
  } satisfies Storage;
}

test("normalization ignores unfinished entry rows instead of creating empty wells", () => {
  const document = createDocument();
  const normalized = normalizePlanInput({
    ...document.input,
    samples: [
      { id: "s1", name: "  Sample 1  ", type: "unknown" },
      { id: "blank", name: "  ", type: "unknown" },
    ],
    targets: [
      { id: "t1", name: " GSTM1 ", assayId: "", reporter: "FAM", volumeUl: 0.5 },
      { id: "blank-target", name: "", assayId: "", reporter: "", volumeUl: 0.5 },
    ],
  });
  assert.deepEqual(normalized.samples.map((sample) => sample.name), ["Sample 1"]);
  assert.deepEqual(normalized.targets.map((target) => target.name), ["GSTM1"]);
});

test("version 6 persistence stores the compact document and restores it", () => {
  const storage = memoryStorage();
  const document = { ...createDocument("en"), layoutEnabled: true };
  const persisted = createPersistedState(document, "2026-09-10T12:00:00.000Z");
  storage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(persisted));
  const restored = restoreState(storage);
  assert.equal(restored.document.language, "en");
  assert.equal(restored.document.layoutEnabled, true);
  assert.equal(restored.savedAt, "2026-09-10T12:00:00.000Z");
  assert.equal("plan" in (persisted.document as object), false);
});
