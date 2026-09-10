import { AlertTriangle, Plus, Sparkles, Trash2 } from "lucide-react";
import { getPlateDimensions, sampleTypeLabel, type LayoutPreset, type SampleType } from "@/lib/cnvPlanner";
import { SAMPLE_TYPES } from "@/app/plannerDocument";
import type { PlannerController } from "@/app/usePlannerController";

interface SetupPanelProps {
  controller: PlannerController;
}

export function SetupPanel({ controller }: SetupPanelProps) {
  const {
    tr,
    input,
    bulkText,
    bulkNames,
    reactionSets,
    duplicateReporters,
    canGenerate,
  } = controller;
  const reporterIsDuplicate = (reporter: string) =>
    duplicateReporters.has(reporter.trim().toLocaleUpperCase());
  const hasCompleteAssayDefinition =
    input.targets.some((target) => target.name.trim()) && Boolean(input.reference.name.trim());

  return (
    <aside className="sidebar control-column" aria-label={tr("实验设置", "Experiment setup")}>
      <section className="card section-card">
        <div className="section-heading">
          <span>01</span>
          <div>
            <h3>{tr("选择孔板与模式", "Plate & assay mode")}</h3>
            <p>{tr("选择本次上机板型", "Select the plate format")}</p>
          </div>
        </div>
        <div className="plate-picker">
          {([96, 384] as const).map((type) => {
            const size = getPlateDimensions(type);
            return (
              <button
                key={type}
                className={`plate-choice ${input.plateType === type ? "selected" : ""}`}
                onClick={() => controller.setPlateType(type)}
              >
                <span>
                  <span className="plate-choice-name">{tr(`${type} 孔板`, `${type}-well plate`)}</span>
                  <span className="plate-choice-meta">{tr(`${size.rows} 行 × ${size.columns} 列`, `${size.rows} rows × ${size.columns} columns`)}</span>
                </span>
                <span className="plate-mini" aria-hidden="true">
                  {Array.from({ length: 12 }).map((_, index) => <span key={index} />)}
                </span>
              </button>
            );
          })}
        </div>

        <label className="field-label">{tr("检测模式", "Detection mode")}</label>
        <div className="mode-cards">
          <button
            className={input.assayMode === "duplex" ? "mode-card active" : "mode-card"}
            onClick={() => controller.setAssayMode("duplex")}
          >
            <strong>Duplex</strong>
            <span>{tr("每个 target 分别与 reference 同孔", "Each target shares a well with the reference")}</span>
          </button>
          <button
            className={input.assayMode === "multiplex" ? "mode-card active" : "mode-card"}
            onClick={() => controller.setAssayMode("multiplex")}
          >
            <strong>Multiplex</strong>
            <span>{tr("多个 target + reference 同孔", "Multiple targets and the reference share one well")}</span>
          </button>
        </div>

        <div className="field-row two">
          <label>
            <span>{tr("复孔", "Replicates")}</span>
            <input type="number" min={1} max={8} value={input.replicates} onChange={(event) => controller.setReplicates(Number(event.target.value))} />
          </label>
          <label>
            <span>{tr("排序", "Layout")}</span>
            <select value={input.layoutPreset} onChange={(event) => controller.setLayoutPreset(event.target.value as LayoutPreset)}>
              <option value="sample-major">{tr("按样本", "By sample")}</option>
              <option value="assay-major">{tr("按反应组", "By reaction set")}</option>
            </select>
          </label>
        </div>

        <div className="loading-pattern-control">
          <div className="loading-pattern-heading">
            <span>{tr("加样方式", "Loading method")}</span>
            <small>{tr("物理孔位路径", "Physical well path")}</small>
          </div>
          {input.plateType === 96 ? (
            <div className="loading-pattern-option selected is-static">
              <span className="loading-pattern-radio" aria-hidden="true" />
              <span>
                <strong>{tr("八道排枪直接上样", "Direct 8-channel loading")}</strong>
                <small>{tr("A–H 纵向 · 复孔向右", "A–H vertical · replicates right")}</small>
              </span>
            </div>
          ) : (
            <div className="loading-pattern-options" role="radiogroup" aria-label={tr("选择 384 孔加样方式", "Choose the 384-well loading method")}>
              <button
                className={`loading-pattern-option ${input.loadingPattern === "interleaved-8-channel" ? "selected" : ""}`}
                type="button"
                role="radio"
                aria-checked={input.loadingPattern === "interleaved-8-channel"}
                onClick={() => controller.setLoadingPattern("interleaved-8-channel")}
              >
                <span className="loading-pattern-radio" aria-hidden="true" />
                <span><strong>{tr("9 mm 八道隔行", "9 mm interleaved 8-channel")}</strong><small>{tr("两轮 · 推荐", "Two passes · Recommended")}</small></span>
              </button>
              <button
                className={`loading-pattern-option ${input.loadingPattern === "sequential" ? "selected" : ""}`}
                type="button"
                role="radio"
                aria-checked={input.loadingPattern === "sequential"}
                onClick={() => controller.setLoadingPattern("sequential")}
              >
                <span className="loading-pattern-radio" aria-hidden="true" />
                <span><strong>{tr("连续孔位上样", "Sequential well loading")}</strong><small>{tr("4.5 mm / 自动化 / 单道", "4.5 mm / automation / single-channel")}</small></span>
              </button>
            </div>
          )}
          {input.plateType === 384 && input.loadingPattern === "interleaved-8-channel" && (
            <p className="loading-pattern-note">{tr(
              "先用 A/C/E/G/I/K/M/O 将全部复孔列块从左到右铺满，再从第 1 列开始 B/D/F/H/J/L/N/P。",
              "Fill every replicate column block from left to right using A/C/E/G/I/K/M/O, then restart at column 1 for B/D/F/H/J/L/N/P.",
            )}</p>
          )}
        </div>
        {input.replicates < 4 && <p className="micro-warning">{tr("官方 CNV 指南建议 4 个复孔；当前设置适合作为方法开发条件，需谨慎判读。", "The official CNV guide recommends four replicates; use fewer replicates only for carefully reviewed method development.")}</p>}
      </section>

      <section className="card section-card">
        <div className="section-heading">
          <span>02</span>
          <div><h3>{tr("样本与对照", "Samples & controls")}</h3><p>{tr("逐个输入或从 Excel 粘贴", "Enter individually or paste from Excel")}</p></div>
          <button className="button button-ghost section-heading-action" type="button" onClick={controller.clearSamples} disabled={input.samples.length === 0 && !bulkText.trim()}>
            <Trash2 size={13} />{tr("清空", "Clear")}
          </button>
        </div>
        <textarea className="bulk-input" value={bulkText} onChange={(event) => controller.setBulkText(event.target.value)} placeholder={tr("从 Excel 粘贴样本名称，每行一个…", "Paste sample names from Excel, one per line…")} />
        <button className="button button-soft full" onClick={controller.importSamples} disabled={bulkNames.length === 0}>
          <Plus size={16} />{tr(`导入 ${bulkNames.length} 个样本名称`, `Import ${bulkNames.length} sample name(s)`)}
        </button>
        <div className="editable-list sample-list">
          {input.samples.map((sample, index) => (
            <div className="editable-row" key={sample.id}>
              <input aria-label={tr("样本名称", "Sample name")} value={sample.name} onChange={(event) => controller.updateSample(index, { name: event.target.value })} />
              <select aria-label={tr("样本类型", "Sample type")} value={sample.type} onChange={(event) => controller.updateSample(index, { type: event.target.value as SampleType })}>
                {SAMPLE_TYPES.map((type) => <option key={type} value={type}>{sampleTypeLabel(type)}</option>)}
              </select>
              <button className="icon-button" aria-label={tr("删除样本", "Delete sample")} onClick={() => controller.removeSample(index)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button className="text-button" onClick={controller.addSample}><Plus size={14} />{tr("添加一行", "Add row")}</button>
      </section>

      <section className="card section-card">
        <div className="section-heading"><span>03</span><div><h3>{tr("Assay 与荧光", "Assays & reporters")}</h3><p>{tr("靶标、参照与染料", "Targets, reference & dyes")}</p></div></div>
        <div className="assay-header"><span>Target</span><span>Assay ID</span><span>Reporter</span><span className="unit-header">µL</span><span /></div>
        {input.targets.map((target, index) => (
          <div className="assay-row" key={target.id}>
            <input value={target.name} aria-label="Target name" onChange={(event) => controller.updateTarget(index, { name: event.target.value })} />
            <input value={target.assayId} placeholder={tr("可留空", "Optional")} aria-label="Target assay ID" onChange={(event) => controller.updateTarget(index, { assayId: event.target.value })} />
            <input className={reporterIsDuplicate(target.reporter) ? "reporter-error" : ""} aria-invalid={reporterIsDuplicate(target.reporter)} value={target.reporter} aria-label="Target reporter" onChange={(event) => controller.updateTarget(index, { reporter: event.target.value })} />
            <input type="number" min={0} step={0.1} value={target.volumeUl} aria-label="Target volume" onChange={(event) => controller.updateTarget(index, { volumeUl: Number(event.target.value) })} />
            <button className="icon-button" disabled={input.targets.length === 1} aria-label="删除 target" onClick={() => controller.removeTarget(index)}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="text-button" onClick={controller.addTarget}><Plus size={14} />{tr("添加 Target assay", "Add target assay")}</button>
        <div className="reference-block">
          <span className="reference-label">REFERENCE</span>
          <div className="assay-row no-delete">
            <input value={input.reference.name} aria-label="Reference name" onChange={(event) => controller.updateReference({ name: event.target.value })} />
            <input value={input.reference.assayId} placeholder={tr("可留空", "Optional")} aria-label="Reference assay ID" onChange={(event) => controller.updateReference({ assayId: event.target.value })} />
            <input className={reporterIsDuplicate(input.reference.reporter) ? "reporter-error" : ""} aria-invalid={reporterIsDuplicate(input.reference.reporter)} value={input.reference.reporter} aria-label="Reference reporter" onChange={(event) => controller.updateReference({ reporter: event.target.value })} />
            <input type="number" min={0} step={0.1} value={input.reference.volumeUl} aria-label="Reference volume" onChange={(event) => controller.updateReference({ volumeUl: Number(event.target.value) })} />
            <span />
          </div>
        </div>
        {hasCompleteAssayDefinition && (
          <div className="reaction-set-preview">
            <span>{tr(`将生成 ${reactionSets.length} 个反应组`, `${reactionSets.length} reaction set(s) will be generated`)}</span>
            {reactionSets.map((set) => <code key={set.id}>{set.name}</code>)}
          </div>
        )}
        {duplicateReporters.size > 0 && <p className="reporter-error-note"><AlertTriangle size={14} />{tr("Multiplex 同孔 Reporter 不可重复。", "Reporter channels must be distinct within a multiplex well.")}</p>}
      </section>

      <button className="button button-primary generate-button" disabled={!canGenerate} onClick={controller.generatePlan}>
        <Sparkles size={17} />{tr("生成 CNV 板布局", "Generate CNV layout")}
      </button>
    </aside>
  );
}
