import {
  CheckCircle2,
  Download,
  Languages,
  Layers3,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import { SetupPanel } from "@/app/components/SetupPanel";
import { PlateWorkspace } from "@/app/components/PlateWorkspace";
import { ReactionPanel } from "@/app/components/ReactionPanel";
import { usePlannerController } from "@/app/usePlannerController";
import { exportAllPlates } from "@/lib/exportWorkbook";

export function CnvPlanner() {
  const controller = usePlannerController();
  const {
    tr,
    language,
    input,
    reactionSystem,
    plan,
    reactionErrors,
    savedAt,
    isDirty,
    toast,
  } = controller;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Layers3 size={20} /></div>
          <div className="brand-copy">
            <p className="brand-title">{tr("CNV Analysis 板布局规划工具", "CNV Analysis Plate Layout Planner")}</p>
            <p className="brand-subtitle">{tr("96 / 384 孔 · 排板与反应用量", "96 / 384 wells · Layout & reaction planning")}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="language-switch" role="group" aria-label={tr("界面语言", "Interface language")}>
            <Languages size={14} aria-hidden="true" />
            <button type="button" className={language === "zh" ? "active" : ""} aria-pressed={language === "zh"} onClick={() => controller.setLanguage("zh")}>中文</button>
            <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => controller.setLanguage("en")}>EN</button>
          </div>
          <span className={`save-status ${isDirty ? "unsaved" : ""}`}>
            {isDirty
              ? tr("正在自动保存…", "Saving…")
              : savedAt
                ? tr(`已保存 ${new Date(savedAt).toLocaleString("zh-CN")}`, `Saved ${new Date(savedAt).toLocaleString("en")}`)
                : tr("本地就绪", "Ready")}
          </span>
          <button className="button button-clear" onClick={controller.resetTool}><RotateCcw size={16} />{tr("重置工具", "Reset tool")}</button>
          <button className="button" onClick={controller.saveNow}><Save size={16} />{tr("保存", "Save")}</button>
          <button className="button button-primary" disabled={!plan || reactionErrors.length > 0} onClick={() => plan && exportAllPlates(plan, reactionSystem)}><Download size={16} />{tr("全部导出", "Export all")}</button>
        </div>
      </header>

      <div className="workspace">
        <SetupPanel controller={controller} />

        <main className="main-area result-column">
          <section className={`hero-strip ${plan ? "" : "empty-preview"}`} aria-labelledby="planner-title">
            <div>
              <p className="eyebrow"><ShieldCheck size={13} />{tr("板布局预览", "Layout preview")}</p>
              <h1 className="hero-title" id="planner-title">{plan ? tr(`已生成 ${plan.plates.length} 块 CNV 实验板`, `${plan.plates.length} CNV plate(s) generated`) : tr("请先完成左侧实验设置", "Complete the setup on the left")}</h1>
              <p className="hero-copy">{tr(
                "支持 96/384 孔、官方 duplex 与自建 multiplex、横向连续复孔、同板对照重复、10.0 µL 体系计算，以及可直接粘贴到 QuantStudio/SDS 的 Well + Sample 列表。",
                "Supports 96/384-well plates, official duplex and custom multiplex assays, horizontally contiguous replicates, controls repeated on every plate, 10.0 µL reaction calculations, and Well + Sample lists ready to paste into QuantStudio/SDS.",
              )}</p>
            </div>
            {plan && (
              <div className="summary-grid" aria-label={tr("布局摘要", "Layout summary")}>
                <div className="metric"><span className="metric-label">{tr("预计孔板", "Plates")}</span><strong className="metric-value">{plan.plates.length}</strong><span className="metric-detail">{input.plateType}-well</span></div>
                <div className="metric"><span className="metric-label">{tr("反应孔", "Reactions")}</span><strong className="metric-value">{plan.occupiedWells}</strong><span className="metric-detail">{tr("含跨板重复", "Includes repeated controls")}</span></div>
                <div className="metric"><span className="metric-label">{tr("利用率", "Utilization")}</span><strong className="metric-value">{Math.round(plan.occupiedWells / (plan.plates.length * input.plateType) * 100)}%</strong><span className="metric-detail">{plan.occupiedWells} / {plan.plates.length * input.plateType}</span></div>
                <div className="metric"><span className="metric-label">{tr("排布方式", "Layout")}</span><strong className="metric-value metric-text">{input.layoutPreset === "sample-major" ? tr("按样本", "Sample") : tr("按反应组", "Reaction")}</strong><span className="metric-detail">{tr("复孔横向连续", "Horizontal replicates")}</span></div>
              </div>
            )}
          </section>

          <section className="result-content">
            <div className="layout-workbench">
              <div className="plate-stage"><PlateWorkspace controller={controller} /></div>
              <ReactionPanel controller={controller} />
            </div>
          </section>
        </main>
      </div>

      {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}<button aria-label={tr("关闭提示", "Dismiss message")} onClick={() => controller.setToast("")}><X size={14} /></button></div>}
      <footer><span>{tr("仅供科研使用 · 数据仅在当前浏览器处理", "Research Use Only · Data stays in this browser")}</span><span>Sources: Thermo Fisher TaqMan CNV Guide 4397425 · QuantStudio D&A Guide · Multiplex Optimization Guide</span></footer>
    </div>
  );
}
