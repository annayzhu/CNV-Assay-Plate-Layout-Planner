import { AlertTriangle, Beaker, Clipboard, FileSpreadsheet, Info, ShieldCheck, Trash2, X } from "lucide-react";
import type { PlannerController, Translate } from "@/app/usePlannerController";
import {
  formatWellId,
  getPlateDimensions,
  rowLabel,
  sampleTypeLabel,
  type PlannerPlate,
  type PlateType,
  type SampleType,
} from "@/lib/cnvPlanner";
import { exportOnePlate } from "@/lib/exportWorkbook";

interface PlateWorkspaceProps {
  controller: PlannerController;
}

function sampleTone(type: SampleType | "") {
  if (type === "ntc") return "ntc";
  if (type === "calibrator") return "calibrator";
  if (type.startsWith("qc-")) return "qc";
  return "unknown";
}

function shortLabel(value: string, maximum: number) {
  const normalized = value.trim();
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, Math.max(1, maximum - 1))}…`;
}

function wellSampleLabel(sample: string, type: SampleType, compact: boolean) {
  if (type === "ntc") return "NTC";
  if (type === "calibrator") return compact ? "CAL" : shortLabel(sample, 8);
  if (type.startsWith("qc-")) return `QC${type.slice(3)}`;
  const numberedUnknown = sample.match(/^unknown[\s_-]*(\d+)$/i);
  if (numberedUnknown) return `U${numberedUnknown[1].slice(compact ? -3 : -5)}`;
  return shortLabel(sample, compact ? 4 : 8);
}

function PlateGrid({
  plate,
  plateType,
  selectedWell,
  interleaved,
  tr,
  onSelect,
}: {
  plate: PlannerPlate;
  plateType: PlateType;
  selectedWell: string | null;
  interleaved: boolean;
  tr: Translate;
  onSelect: (wellId: string) => void;
}) {
  const dimensions = getPlateDimensions(plateType);
  return (
    <div className={`plate-scroll plate-${plateType}`}>
      <div className={`plate-grid plate-${plateType}`}>
        <div className="corner-cell" />
        {Array.from({ length: dimensions.columns }, (_, index) => <div className="column-header" key={`column-${index}`}>{index + 1}</div>)}
        {Array.from({ length: dimensions.rows }, (_, row) => (
          <div className="plate-row" key={`row-${row}`} style={{ display: "contents" }}>
            <div className={`row-header ${interleaved ? "with-route" : ""}`}>
              <span>{rowLabel(row)}</span>
              {interleaved && <span className={`row-route-marker ${row % 2 === 0 ? "pass-one" : "pass-two"}`} title={row % 2 === 0 ? tr("第 1 轮上样", "Pass 1") : tr("第 2 轮上样", "Pass 2")} aria-label={row % 2 === 0 ? tr("第 1 轮上样", "Pass 1") : tr("第 2 轮上样", "Pass 2")}>{row % 2 === 0 ? "①" : "②"}</span>}
            </div>
            {Array.from({ length: dimensions.columns }, (_, column) => {
              const well = plate.wells[row * dimensions.columns + column];
              return (
                <button
                  key={well.id}
                  className={`well ${well.sample ? "occupied" : "empty"} ${well.sampleType ? sampleTone(well.sampleType) : ""} ${selectedWell === well.id ? "selected" : ""} ${well.source === "manual" ? "manual" : ""}`}
                  onClick={() => onSelect(well.id)}
                  title={well.sample ? `${well.id} · ${well.sample} · ${well.reactionSet} · R${well.replicate}` : well.id}
                >
                  <span className="well-id">{formatWellId(row, column, plateType)}</span>
                  {well.sample && well.sampleType && <span className="well-content"><strong>{wellSampleLabel(well.sample, well.sampleType, plateType === 384)}</strong><small>{shortLabel(well.reactionSet || well.targets.join("+"), plateType === 384 ? 5 : 9)} · R{well.replicate}</small></span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlateWorkspace({ controller }: PlateWorkspaceProps) {
  const {
    tr,
    input,
    reactionSystem,
    layoutEnabled,
    plan,
    planError,
    plate,
    activePlate,
    selection,
    selected,
    issues,
    reactionErrors,
  } = controller;
  const planUsesInterleaved = Boolean(
    plan && plan.input.plateType === 384 && plan.input.loadingPattern === "interleaved-8-channel",
  );
  const errorCount = issues.filter((issue) => issue.severity === "error").length + reactionErrors.length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  if (!plan || !plate) {
    return (
      <div className="empty-state qpcr-empty-state card">
        <div className="empty-state-inner">
          <div className="ghost-plate" aria-hidden="true">
            {Array.from({ length: 96 }).map((_, index) => <span className="ghost-well" key={index} />)}
          </div>
          <h2>{layoutEnabled && planError ? tr("实验设置需要修正", "Review the experiment setup") : tr("先添加样本和 CNV Assay", "Add samples and CNV assays first")}</h2>
          <p>{layoutEnabled && planError ? planError : tr("系统会计算孔板数，并生成可点选和编辑的布局。", "The planner will calculate the plate count and generate a selectable, editable layout.")}</p>
          {!layoutEnabled && <button className="button button-soft load-example-button" type="button" onClick={controller.loadExample}><Beaker size={16} />{tr("载入示例", "Load example")}</button>}
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="card plate-card">
        <div className="plate-toolbar">
          <div><span className="eyebrow">PLATE LAYOUT</span><h3>{plate.name}</h3></div>
          <div className="plate-actions">
            <span className="copy-tooltip copy-tooltip-start">
              <button className="button" aria-describedby="copy-with-header-tip" onClick={() => controller.copyCurrentPlate(true)}><Clipboard size={15} />{tr("复制含表头", "Copy with headers")}</button>
              <span className="copy-tooltip-content" id="copy-with-header-tip" role="tooltip">{tr("适用于QS1/QS3/QS5/QS6/QS7/QSDX/ViiA7机型的软件", "For software used with QS1/QS3/QS5/QS6/QS7/QSDX/ViiA7 instruments")}</span>
            </span>
            <span className="copy-tooltip copy-tooltip-end">
              <button className="button" aria-describedby="copy-without-header-tip" onClick={() => controller.copyCurrentPlate(false)}><Clipboard size={15} />{tr("复制无表头", "Copy without headers")}</button>
              <span className="copy-tooltip-content" id="copy-without-header-tip" role="tooltip">{tr("适用于7300 Plus/7500/7500 Fast/StepOnePlus机型的软件（V2.X版本以上）", "For software used with 7300 Plus/7500/7500 Fast/StepOnePlus instruments (version 2.X or later)")}</span>
            </span>
            <button className="button" onClick={() => exportOnePlate(plan, plate, reactionSystem)}><FileSpreadsheet size={15} />{tr("本板 Excel", "Plate Excel")}</button>
          </div>
        </div>
        <p className="copy-helper"><Info size={12} />{tr("“含表头”复制 Well 与 Sample 两列及列名；“无表头”只复制数据行。两者都用于将当前板的样本列表直接粘贴到 QuantStudio/SDS。", "With headers copies the Well and Sample column names plus data; without headers copies data rows only. Both formats paste the current plate sample list directly into QuantStudio/SDS.")}</p>

        <div className="plate-tabs">
          {plan.plates.map((item, index) => (
            <button key={item.plateNumber} className={activePlate === index ? "active" : ""} onClick={() => controller.choosePlate(index)}>
              P{String(item.plateNumber).padStart(2, "0")}<span>{item.wells.reduce((count, well) => count + Number(Boolean(well.sample)), 0)} wells</span>
            </button>
          ))}
        </div>

        {planUsesInterleaved && (
          <div className="loading-route-guide" aria-label={tr("八道排枪隔行上样路径", "Interleaved 8-channel loading route")}>
            <span className="loading-route-guide-title">{tr("上样路径", "Loading route")}</span>
            <span className="loading-route-pass pass-one"><b aria-hidden="true">①</b><span>{tr("第 1 轮", "Pass 1")} · A/C/E/G/I/K/M/O</span></span>
            <span className="loading-route-pass pass-two"><b aria-hidden="true">②</b><span>{tr("第 2 轮", "Pass 2")} · B/D/F/H/J/L/N/P</span></span>
            <span className="loading-route-note">{tr("先铺满第 1 轮全部列块，再开始第 2 轮", "Fill all Pass 1 column blocks before starting Pass 2")}</span>
          </div>
        )}

        {plan.input.plateType === 96 && (
          <div className="loading-route-guide" aria-label={tr("96 孔八道排枪上样方向", "96-well 8-channel loading direction")}>
            <span className="loading-route-guide-title">{tr("上样方向", "Loading direction")}</span>
            <span className="loading-route-pass pass-one"><b aria-hidden="true">↓</b><span>A → H</span></span>
            <span className="loading-route-note">{tr("每组 8 个样本纵向排列；复孔向右连续", "Eight samples fill vertically per group; replicates remain contiguous to the right")}</span>
          </div>
        )}

        <PlateGrid
          plate={plate}
          plateType={input.plateType}
          selectedWell={selection?.wellId ?? null}
          interleaved={planUsesInterleaved}
          tr={tr}
          onSelect={controller.selectWell}
        />

        <div className="plate-legend">
          <span><i className="dot unknown" />Unknown</span><span><i className="dot calibrator" />Calibrator</span><span><i className="dot ntc" />NTC</span><span><i className="dot qc" />0/1/2-copy QC</span><span><i className="dot manual" />{tr("手工", "Manual")}</span>
        </div>
      </section>

      {selected && selection && (
        <section className="card well-editor">
          <div className="editor-title">
            <div><span>{tr("手工编辑孔", "Manual well edit")}</span><strong>{selected.id}</strong></div>
            <button className="icon-button" aria-label={tr("关闭", "Close")} onClick={controller.closeSelection}><X size={16} /></button>
          </div>
          <div className="field-row three editor-fields">
            <label><span>{tr("样本", "Sample")}</span><select value={selection.sampleId} onChange={(event) => controller.updateSelection({ sampleId: event.target.value })}><option value="">{tr("请选择", "Select")}</option>{input.samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.name} · {sampleTypeLabel(sample.type)}</option>)}</select></label>
            <label><span>{tr("反应组", "Reaction set")}</span><select value={selection.reactionSetId} onChange={(event) => controller.updateSelection({ reactionSetId: event.target.value })}>{plan.reactionSets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
            <label><span>{tr("复孔编号", "Replicate number")}</span><input type="number" min={1} max={input.replicates} value={selection.replicate} onChange={(event) => controller.updateSelection({ replicate: Number(event.target.value) })} /></label>
          </div>
          <div className="editor-actions"><button className="button danger-outline" onClick={() => controller.applyManualWell(true)}><Trash2 size={15} />{tr("清空此孔", "Clear well")}</button><button className="button button-primary" onClick={() => controller.applyManualWell(false)}>{tr("应用并标记手工复核", "Apply and mark for manual review")}</button></div>
        </section>
      )}

      <section className="card qa-card">
        <div className="qa-summary">
          <div className={errorCount ? "qa-badge error" : "qa-badge success"}><ShieldCheck size={19} /><strong>{errorCount ? tr(`${errorCount} 个错误`, `${errorCount} error(s)`) : tr("结构校验通过", "Structural checks passed")}</strong></div>
          <div className="qa-badge warning"><AlertTriangle size={18} /><strong>{tr(`${warningCount} 个提醒`, `${warningCount} warning(s)`)}</strong></div>
          <span>{tr("排板规则、同板对照、复孔数与反应总体积", "Layout rules, plate-level controls, replicates, and total reaction volume")}</span>
        </div>
        {(issues.length > 0 || reactionErrors.length > 0) && <div className="issue-list">
          {reactionErrors.map((issue) => <div className="issue error" key={issue.code}><AlertTriangle size={15} />{controller.language === "zh" ? issue.message : issue.messageEn}</div>)}
          {issues.map((issue, index) => <div className={`issue ${issue.severity}`} key={`${issue.code}-${index}`}><AlertTriangle size={15} />{issue.plateNumber ? `P${String(issue.plateNumber).padStart(2, "0")} · ` : ""}{issue.wellId ? `${issue.wellId} · ` : ""}{controller.language === "zh" ? issue.message : issue.messageEn ?? issue.message}</div>)}
        </div>}
      </section>
    </>
  );
}
