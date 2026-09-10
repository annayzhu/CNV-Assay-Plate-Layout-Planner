import type { PlanResult, ReactionSet } from "./cnvPlanner";

export interface ReactionSystem {
  totalPerWellUl: number;
  masterMixPerWellUl: number;
  templatePerWellUl: number;
  overagePercent: number;
}

export interface ReactionComponentTotal {
  name: string;
  role: "master-mix" | "target" | "reference" | "water";
  perWellUl: number;
  totalUl: number;
}

export interface ReactionGroupRequirement {
  reactionSet: ReactionSet;
  wells: number;
  preparationReactions: number;
  mixDispensePerWellUl: number;
  waterPerWellUl: number;
  components: ReactionComponentTotal[];
}

export interface SampleTemplateRequirement {
  sample: string;
  sampleType: string;
  wells: number;
  templatePerWellUl: number;
  requiredUl: number;
}

export interface ReactionValidationIssue {
  code: string;
  message: string;
  messageEn: string;
}

export const DEFAULT_REACTION_SYSTEM: ReactionSystem = {
  totalPerWellUl: 10,
  masterMixPerWellUl: 5,
  templatePerWellUl: 2,
  overagePercent: 10,
};

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function reactionSetWaterPerWell(
  reactionSet: ReactionSet,
  system: ReactionSystem,
) {
  const assayVolume = reactionSet.targets.reduce(
    (total, target) => total + target.volumeUl,
    reactionSet.reference.volumeUl,
  );
  return round(
    system.totalPerWellUl -
      system.masterMixPerWellUl -
      system.templatePerWellUl -
      assayVolume,
  );
}

export function validateReactionSystem(plan: PlanResult, system: ReactionSystem) {
  const errors: ReactionValidationIssue[] = [];
  if (system.totalPerWellUl <= 0) errors.push({ code: "total-volume", message: "总反应体积必须大于 0 µL。", messageEn: "Total reaction volume must be greater than 0 µL." });
  if (system.masterMixPerWellUl < 0 || system.templatePerWellUl < 0) {
    errors.push({ code: "negative-component", message: "Master Mix 与模板体积不可为负数。", messageEn: "Master Mix and template volumes cannot be negative." });
  }
  if (system.overagePercent < 0 || system.overagePercent > 50) {
    errors.push({ code: "overage-range", message: "配液余量建议设置为 0–50%。", messageEn: "Set preparation overage between 0% and 50%." });
  }
  for (const reactionSet of plan.reactionSets) {
    const water = reactionSetWaterPerWell(reactionSet, system);
    if (water < 0) {
      errors.push({
        code: `negative-water:${reactionSet.id}`,
        message: `${reactionSet.name} 的组分合计超过 ${system.totalPerWellUl} µL。`,
        messageEn: `Components in ${reactionSet.name} exceed ${system.totalPerWellUl} µL.`,
      });
    }
  }
  return errors;
}

export function calculateReactionRequirements(
  plan: PlanResult,
  system: ReactionSystem,
) {
  const factor = 1 + system.overagePercent / 100;
  const wellsByReactionSet = new Map<string, number>();
  const wellsBySample = new Map<string, number>();
  for (const plate of plan.plates) {
    for (const well of plate.wells) {
      if (!well.sample) continue;
      wellsByReactionSet.set(
        well.reactionSetId,
        (wellsByReactionSet.get(well.reactionSetId) ?? 0) + 1,
      );
      wellsBySample.set(well.sampleId, (wellsBySample.get(well.sampleId) ?? 0) + 1);
    }
  }
  const groups: ReactionGroupRequirement[] = plan.reactionSets.map((reactionSet) => {
    const wells = wellsByReactionSet.get(reactionSet.id) ?? 0;
    const preparationReactions = round(wells * factor);
    const waterPerWellUl = reactionSetWaterPerWell(reactionSet, system);
    const mixDispensePerWellUl = round(system.totalPerWellUl - system.templatePerWellUl);
    const components: ReactionComponentTotal[] = [
      {
        name: "2X TaqMan Genotyping Master Mix",
        role: "master-mix",
        perWellUl: system.masterMixPerWellUl,
        totalUl: round(system.masterMixPerWellUl * preparationReactions),
      },
      ...reactionSet.targets.map((target) => ({
        name: `${target.name} (${target.reporter || "Reporter 待确认"})`,
        role: "target" as const,
        perWellUl: target.volumeUl,
        totalUl: round(target.volumeUl * preparationReactions),
      })),
      {
        name: `${reactionSet.reference.name} (${reactionSet.reference.reporter || "Reporter 待确认"})`,
        role: "reference",
        perWellUl: reactionSet.reference.volumeUl,
        totalUl: round(reactionSet.reference.volumeUl * preparationReactions),
      },
      {
        name: "Nuclease-free water（公共反应液）",
        role: "water",
        perWellUl: waterPerWellUl,
        totalUl: round(waterPerWellUl * preparationReactions),
      },
    ];
    return {
      reactionSet,
      wells,
      preparationReactions,
      mixDispensePerWellUl,
      waterPerWellUl,
      components,
    };
  });

  const samples = plan.input.samples.map((sample) => {
    const wells = wellsBySample.get(sample.id) ?? 0;
    return {
      sample: sample.name,
      sampleType: sample.type,
      wells,
      templatePerWellUl: system.templatePerWellUl,
      requiredUl: round(wells * system.templatePerWellUl * factor),
    } satisfies SampleTemplateRequirement;
  });

  return { groups, samples };
}
