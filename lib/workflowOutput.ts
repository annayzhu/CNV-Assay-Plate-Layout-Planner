import { sampleTypeLabel, validatePlan, type PlanResult } from "./cnvPlanner";
import { calculateReactionRequirements, validateReactionSystem, type ReactionSystem } from "./reactionCalculator";

const number = (value: number) => String(Math.round(value * 1000) / 1000);

/** What a record keeps of this plan: plates as data, so LabNest can show them and fill in the samples' wells, and the mix. */
export function plannerWorkflowOutput(plan: PlanResult | null, system: ReactionSystem, zh: boolean) {
  const tr = (chinese: string, english: string) => (zh ? chinese : english);
  if (!plan) throw new Error(tr("请先生成板布局", "Generate the layout first"));
  const problem = [...validatePlan(plan).filter((issue) => issue.severity === "error"), ...validateReactionSystem(plan, system)][0];
  if (problem) throw new Error(tr(problem.message, problem.messageEn ?? problem.message));

  const { groups, samples } = calculateReactionRequirements(plan, system);
  const headers = [tr("反应组", "Reaction set"), tr("反应孔", "Wells"), tr("备液反应数", "Prepared for"), tr("组分", "Component"), tr("每孔 / µL", "Per well / µL"), tr("合计 / µL", "Total / µL")];
  // Each group's name and counts once, on its first line.
  const rows = groups.flatMap((group) => group.components.map((component, index) => [index ? "" : group.reactionSet.name, index ? "" : String(group.wells), index ? "" : number(group.preparationReactions), component.name, number(component.perWellUl), number(component.totalUl)]));
  const templateHeaders = [tr("样本", "Sample"), tr("类型", "Type"), tr("反应孔", "Wells"), tr("每孔模板 / µL", "Template per well / µL"), tr("模板备液 / µL", "Template to prepare / µL")];
  const templateRows = samples.map((sample) => [sample.sample, sampleTypeLabel(sample.sampleType as Parameters<typeof sampleTypeLabel>[0]), String(sample.wells), number(sample.templatePerWellUl), number(sample.requiredUl)]);
  const method = tr(
    `全部 ${plan.plates.length} 板 · ${plan.occupiedWells} 反应 · 每反应 ${system.totalPerWellUl} µL · 余量 ${system.overagePercent}%（已计入备液量）；模板单独加入，每孔 ${system.templatePerWellUl} µL。`,
    `${plan.plates.length} plate(s) · ${plan.occupiedWells} reactions · ${system.totalPerWellUl} µL each · ${system.overagePercent}% overage (included); template added separately, ${system.templatePerWellUl} µL per well.`,
  );

  const plates = plan.plates.map((plate) => ({
    id: `plate-${plate.plateNumber}`,
    name: plate.name.slice(0, 80),
    plateSize: plan.input.plateType,
    fields: [
      { id: "sample", name: tr("样本", "Sample") },
      { id: "assay", name: tr("反应组", "Reaction set") },
      { id: "replicate", name: tr("复孔", "Replicate") },
      { id: "type", name: tr("类型", "Type") },
    ],
    colorField: "assay",
    wells: Object.fromEntries(plate.wells.filter((well) => well.sample).map((well) => {
      const label = well.sample.slice(0, 200);
      return [`${String.fromCharCode(65 + well.row)}${well.column + 1}`, {
        // LabNest keeps the link only for samples it knows; the rest stay as names.
        sample: { sampleId: well.sampleId.slice(0, 64), label },
        assay: well.reactionSet.slice(0, 200),
        ...(well.replicate ? { replicate: String(well.replicate) } : {}),
        ...(well.sampleType ? { type: sampleTypeLabel(well.sampleType) } : {}),
      }];
    })),
  }));

  const tsv = (table: string[][]) => table.map((row) => row.join("\t")).join("\n");
  return {
    label: tr("CNV 板布局与配液", "CNV plate layout and mix"),
    images: [],
    plates,
    table: { headers, rows },
    tables: [{ title: tr("模板备液", "Template"), headers: templateHeaders, rows: templateRows }],
    fullTable: {
      headers: [tr("板", "Plate"), tr("孔位", "Well"), tr("样本", "Sample"), tr("反应组", "Reaction set"), tr("复孔", "Replicate")],
      rows: plan.plates.flatMap((plate) => plate.wells.filter((well) => well.sample).map((well) => [plate.name, well.id, well.sample, well.reactionSet, well.replicate ? String(well.replicate) : ""])),
    },
    method,
    mixTsv: [method, tsv([headers, ...rows]), tsv([templateHeaders, ...templateRows])].join("\n\n"),
  };
}
