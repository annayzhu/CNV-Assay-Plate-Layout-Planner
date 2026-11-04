import assert from "node:assert/strict";
import test from "node:test";
import { planCnvLayout, type PlanInput } from "../lib/cnvPlanner";
import { calculateReactionRequirements, DEFAULT_REACTION_SYSTEM } from "../lib/reactionCalculator";
import { plannerWorkflowOutput } from "../lib/workflowOutput";

const input: PlanInput = {
  plateType: 96,
  assayMode: "duplex",
  samples: [{ id: "u", name: "U", type: "unknown" }, { id: "cal", name: "CAL", type: "calibrator" }, { id: "ntc", name: "NTC", type: "ntc" }],
  targets: [{ id: "t", name: "GSTM1", assayId: "A", reporter: "FAM", volumeUl: 0.5 }],
  reference: { name: "RNase P", assayId: "R", reporter: "VIC", volumeUl: 0.5 },
  replicates: 4,
  layoutPreset: "sample-major",
  loadingPattern: "sequential",
};

test("plates go back as data, with wells named as LabNest names them", () => {
  const output = plannerWorkflowOutput(planCnvLayout(input), DEFAULT_REACTION_SYSTEM, true);
  assert.equal(output.plates.length, 1);
  assert.equal(output.plates[0].plateSize, 96);
  const wells = Object.keys(output.plates[0].wells);
  assert.ok(wells.length >= 12, String(wells.length));
  assert.ok(wells.every((well) => /^[A-P]\d{1,2}$/.test(well) && !/^[A-P]0/.test(well)), wells.join());
  assert.ok(Object.values(output.plates[0].wells).some((well) => well.sample.sampleId === "u" && well.sample.label === "U"));
  assert.ok(output.mixTsv.includes("GSTM1"));
});

test("without a layout there is nothing to save", () => {
  assert.throws(() => plannerWorkflowOutput(null, DEFAULT_REACTION_SYSTEM, true), /请先生成板布局/);
});

// The same system as LabNest's calculator, the free planner and the qPCR planner (LabNest: mix-engines.test.ts).
test("the shared reaction system gives the shared volumes", () => {
  const samples = Array.from({ length: 24 }, (_, index) => ({ id: `s${index}`, name: `S${index}`, type: "unknown" as const }));
  const plan = planCnvLayout({ ...input, samples, replicates: 1, targets: [{ ...input.targets[0], volumeUl: 0.2 }], reference: { ...input.reference, volumeUl: 0.2 } });
  const [group] = calculateReactionRequirements(plan, { totalPerWellUl: 10, masterMixPerWellUl: 5, templatePerWellUl: 1, overagePercent: 12 }).groups;
  assert.equal(group.wells, 24);
  assert.deepEqual(group.components.map((component) => component.totalUl), [134.4, 5.376, 5.376, 96.768]);
});
