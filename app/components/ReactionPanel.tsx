import { Beaker, Info } from "lucide-react";
import type { PlannerController } from "@/app/usePlannerController";

interface ReactionPanelProps {
  controller: PlannerController;
}

export function ReactionPanel({ controller }: ReactionPanelProps) {
  const { tr, reactionSystem, requirements } = controller;

  return (
    <aside className="reaction-column" aria-label={tr("反应体系与用量", "Reaction setup and volumes")}>
      <section className="card reaction-card reaction-panel">
        <div className="section-heading reaction-heading">
          <span>04</span>
          <div><h3>{tr("反应体系与用量", "Reaction setup & volumes")}</h3><p>{tr("每孔体积与配液余量", "Per-well volumes & overage")}</p></div>
        </div>
        <div className="field-row two reaction-input-grid">
          <label><span>{tr("总体积", "Total volume")} (µL)</span><input type="number" step={0.5} value={reactionSystem.totalPerWellUl} onChange={(event) => controller.updateReactionSystem({ totalPerWellUl: Number(event.target.value) })} /></label>
          <label><span>2X Master Mix (µL)</span><input type="number" step={0.5} value={reactionSystem.masterMixPerWellUl} onChange={(event) => controller.updateReactionSystem({ masterMixPerWellUl: Number(event.target.value) })} /></label>
          <label><span>gDNA / NTC water (µL)</span><input type="number" step={0.5} value={reactionSystem.templatePerWellUl} onChange={(event) => controller.updateReactionSystem({ templatePerWellUl: Number(event.target.value) })} /></label>
          <label><span>{tr("余量", "Overage")} (%)</span><input type="number" step={1} value={reactionSystem.overagePercent} onChange={(event) => controller.updateReactionSystem({ overagePercent: Number(event.target.value) })} /></label>
        </div>
        <p className="micro-note"><Info size={14} />{tr("水量按每个反应组自动补足；multiplex target 数或 assay 体积变化后会分别校验。", "Water is calculated per reaction set; multiplex target count and assay-volume changes are validated independently.")}</p>

        {requirements ? (
          <div className="reaction-results">
            <div className="reaction-results-heading">
              <div><span className="eyebrow">REACTION SETUP</span><h3>{tr(`${reactionSystem.totalPerWellUl.toFixed(1)} µL 配液需求`, `${reactionSystem.totalPerWellUl.toFixed(1)} µL mix requirements`)}</h3></div>
              <span className="pill"><Beaker size={14} />{reactionSystem.overagePercent}% overage</span>
            </div>
            <div className="mix-groups reaction-mix-groups">
              {requirements.groups.map((group) => (
                <article className="mix-group" key={group.reactionSet.id}>
                  <div className="mix-title">
                    <div><strong>{group.reactionSet.name}</strong><span>{tr(`${group.wells} 孔 · 配制 ${group.preparationReactions} 个反应`, `${group.wells} wells · prepare ${group.preparationReactions} reactions`)}</span></div>
                    <b>{group.mixDispensePerWellUl.toFixed(1)} µL/{tr("孔", "well")}</b>
                  </div>
                  <table>
                    <thead><tr><th>{tr("组分", "Component")}</th><th>{tr("每孔", "Per well")} (µL)</th><th>{tr("总量", "Total")} (µL)</th></tr></thead>
                    <tbody>{group.components.map((component) => <tr key={component.name}><td>{component.name}</td><td>{component.perWellUl.toFixed(2)}</td><td>{component.totalUl.toFixed(2)}</td></tr>)}</tbody>
                  </table>
                  <p>{tr("另加", "Add separately")} gDNA {tr("或", "or")} NTC water: {reactionSystem.templatePerWellUl.toFixed(1)} µL/{tr("孔", "well")}</p>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="reaction-awaiting"><Beaker size={18} /><span>{tr("生成板布局后，这里会立即显示各反应组的配液总量。", "Generate the plate layout to see preparation totals for every reaction set here.")}</span></div>
        )}
      </section>
    </aside>
  );
}
