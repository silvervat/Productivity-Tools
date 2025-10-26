import React, { useEffect, useState } from "react";
import { WorkspaceAPI } from "trimble-connect-workspace-api";
import MarkupBlockBuilder from "./components/MarkupBlockBuilder";

export default function App() {
  const [api, setApi] = useState<WorkspaceAPI | null>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const w = (window as any);
        const getApi = w?.tc?.api?.getWorkspaceAPI;
        if (typeof getApi !== "function") {
          setErr("Trimble Connect Workspace API ei ole lehel saadaval (window.tc.api.getWorkspaceAPI puudub).");
          return;
        }
        const _api = await getApi();
        setApi(_api);
      } catch (e) {
        setErr("TC API laadimine ebaõnnestus.");
      }
    })();
  }, []);

  if (err) return <div style={{ padding: 16, color: "crimson" }}>{err}</div>;
  if (!api) return <div style={{ padding: 16 }}>Laen TC API…</div>;
  return (
    <div style={{ padding: 12 }}>
      <MarkupBlockBuilder api={api} />
    </div>
  );
}
