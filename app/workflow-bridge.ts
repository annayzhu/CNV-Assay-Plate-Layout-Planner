import { useEffect, useRef } from "react";

export type WorkflowContext = {
  sessionId: string;
  state?: unknown;
  samples?: Array<{ id: string; name: string; kind: "sample" }>;
  language?: "zh" | "en";
};

// Inside LabNest the host provides the title row, so the tool drops its own name.
if (typeof window !== "undefined" && window.parent !== window) document.documentElement.dataset.labnestHosted = "true";

export const isHosted = () => typeof window !== "undefined" && window.parent !== window;

/** LabNest's tool bridge: the record opens this tool, and what it saves goes back to that record. */
export function useWorkflowBridge(state: unknown, restore: (context: WorkflowContext) => void, output: () => unknown) {
  const latest = useRef({ state, restore, output });
  latest.current = { state, restore, output };
  const session = useRef("");
  useEffect(() => {
    if (!isHosted()) return;
    const send = (message: object) => window.parent.postMessage({ protocol: "labnest-tool-v1", sessionId: session.current, ...message }, window.location.origin);
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.protocol !== "labnest-tool-v1") return;
      const message = event.data;
      if (message.type === "CONTEXT_INIT") {
        session.current = message.sessionId;
        document.documentElement.dataset.labnestEmbedded = "true";
        try {
          latest.current.restore(message);
          send({ type: "CONTEXT_READY" });
        } catch (error) {
          send({ type: "SAVE_ERROR", error: error instanceof Error ? error.message : "方案读取失败" });
        }
      } else if (message.sessionId !== session.current) return;
      else if (message.type === "REQUEST_DRAFT") send({ type: "DRAFT_FLUSH", state: latest.current.state });
      else if (message.type === "REQUEST_OUTPUT") {
        try {
          send({ type: "OUTPUT_SUBMIT", state: latest.current.state, output: latest.current.output() });
        } catch (error) {
          send({ type: "SAVE_ERROR", error: error instanceof Error ? error.message : "请检查当前输入" });
        }
      }
    };
    window.addEventListener("message", receive);
    send({ type: "TOOL_READY" });
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    if (!session.current) return;
    const timer = setTimeout(() => window.parent.postMessage({ protocol: "labnest-tool-v1", type: "DRAFT_CHANGED", sessionId: session.current, state }, window.location.origin), 250);
    return () => clearTimeout(timer);
  }, [state]);
}
