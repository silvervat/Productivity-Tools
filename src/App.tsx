import React, { useEffect, useState } from "react";
import type { WorkspaceAPI } from "trimble-connect-workspace-api";
import DragDropMarkupBuilder from "./components/DragDropMarkupBuilder";

export default function App() {
  const [api, setApi] = useState<WorkspaceAPI | null>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const w = (window as any);
        const getApi = w?.tc?.api?.getWorkspaceAPI;
        if (typeof getApi !== "function") {
          setErr("Trimble Connect Workspace API puudub (window.tc.api.getWorkspaceAPI). Ava see TC kontekstis.");
          return;
        }
        const _api = await getApi();
        setApi(_api);
      } catch {
        setErr("TC API laadimine ebaõnnestus.");
      }
    })();
  }, []);

  if (err) return <div style={{ padding: 16, color: "crimson" }}>{err}</div>;
  if (!api) return <div style={{ padding: 16 }}>Laen TC API…</div>;

  return (
    <div style={{ padding: 12, maxWidth: 1000, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>Drag & Drop Markup Builder</h2>
      <DragDropMarkupBuilder api={api} />
    </div>
  );
}
