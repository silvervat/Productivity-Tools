import React, { useEffect, useRef, useState } from "react";
import type { WorkspaceAPI, Box3, Vector3, MarkupPick } from "trimble-connect-workspace-api";

/*
  DragDropMarkupBuilder – puhas React / HTML UI
  ---------------------------------------------
  - AVASTA: loeb valitud objektide pSetid -> propsi võtmete loend
  - Klotsid (properties) + separaatorid (+ reavahetus) -> kasutaja ladub mustri
  - Eelvaade esimese valitud objekti põhjal
  - LOO MARKUPID: joonistab tekstimarkupid bbox keskpunkti
  - Skaala lüliti: mm (1x) vs m (1000x)
  - Duplikaat-siltide vältimine
*/

// ---- Abi ----
function midPoint(b: Box3): Vector3 {
  return {
    x: (b.min.x + b.max.x) / 2,
    y: (b.min.y + b.max.y) / 2,
    z: (b.min.z + b.max.z) / 2,
  };
}

function toStr(v: any): string {
  return v == null ? "" : String(v);
}

async function flattenPropsForObject(
  api: WorkspaceAPI,
  modelId: string,
  runtimeId: number
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const [props] = await api.viewer.getObjectProperties(modelId, [runtimeId]);
    const psets = (props as any)?.properties ?? [];
    for (const pset of psets) {
      const setName = toStr((pset as any).name ?? "");
      const list = (pset as any)?.properties ?? [];
      for (const p of list) {
        const key = setName ? `${setName}.${toStr(p.name)}` : toStr(p.name);
        out[key] = toStr(p.value);
      }
    }
  } catch {
    // ignore
  }
  return out;
}

async function discoverKeys(
  api: WorkspaceAPI,
  selection: Array<{ modelId: string; objectRuntimeIds: number[] }>
): Promise<string[]> {
  const freq = new Map<string, number>();
  for (const g of selection) {
    for (const rid of g.objectRuntimeIds) {
      const flat = await flattenPropsForObject(api, g.modelId, rid);
      const seen = new Set<string>();
      for (const k of Object.keys(flat)) {
        if (!seen.has(k)) {
          seen.add(k);
          freq.set(k, (freq.get(k) ?? 0) + 1);
        }
      }
    }
  }
  return Array.from(freq.keys()).sort(
    (a, b) => (freq.get(b)! - freq.get(a)! || a.localeCompare(b))
  );
}

type Block =
  | { kind: "prop"; key: string }
  | { kind: "sep"; text: string }
  | { kind: "newline" };

const QUICK_SEPS: Array<{ label: string; text: string }> = [
  { label: "tühik", text: " " },
  { label: "–", text: " – " },
  { label: "|", text: " | " },
  { label: ",", text: ", " },
];

export default function DragDropMarkupBuilder({ api }: { api: WorkspaceAPI }) {
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [scaleIsMM, setScaleIsMM] = useState(true);
  const [dedupe, setDedupe] = useState(true);
  const [toast, setToast] = useState<string>("");

  const selectionRef = useRef<Array<{ modelId: string; objectRuntimeIds: number[] }>>([]);

  useEffect(() => {
    (async () => {
      selectionRef.current = await readSelection();
    })();
  }, []);

  async function readSelection() {
    const sel = await api.viewer.getSelection();
    const out: Array<{ modelId: string; objectRuntimeIds: number[] }> = [];
    for (const s of sel || []) {
      if (s?.objectRuntimeIds?.length)
        out.push({ modelId: s.modelId, objectRuntimeIds: s.objectRuntimeIds });
    }
    return out;
  }

  async function handleDiscover() {
    setLoading(true);
    try {
      const sel = await readSelection();
      selectionRef.current = sel;
      if (!sel.length) {
        setKeys([]);
        setToast("Valik on tühi.");
        return;
      }
      const discovered = await discoverKeys(api, sel);
      setKeys(discovered);
      setToast(`Leidsin ${discovered.length} välja.`);
    } catch {
      setToast("Avastamine ebaõnnestus.");
    } finally {
      setLoading(false);
      setTimeout(() => setToast(""), 2500);
    }
  }

  // Muster – lisamine/lohistamine/kustutamine
  function addProp(k: string) {
    setBlocks((b) => [...b, { kind: "prop", key: k }]);
  }
  function addSep(text: string) {
    setBlocks((b) => [...b, { kind: "sep", text }]);
  }
  function addNewline() {
    setBlocks((b) => [...b, { kind: "newline" }]);
  }
  function moveBlock(from: number, to: number) {
    setBlocks((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  }
  function removeBlock(idx: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  }

  // Drag support
  const dragIndex = useRef<number | null>(null);
  function onDragStart(idx: number) {
    dragIndex.current = idx;
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(idx: number) {
    if (dragIndex.current === null) return;
    moveBlock(dragIndex.current, idx);
    dragIndex.current = null;
  }

  // Render malli teksti konkreetsele objektile
  async function renderForObject(
    modelId: string,
    rid: number,
    seq: Block[]
  ): Promise<string> {
    const flat = await flattenPropsForObject(api, modelId, rid);

    const pickFirstBySuffix = (suffix: string) => {
      const k = Object.keys(flat).find((full) => full.endsWith(`.${suffix}`));
      return k ? toStr(flat[k]) : "";
    };

    const parts: string[] = [];
    for (const b of seq) {
      if (b.kind === "prop") {
        if (flat[b.key] !== undefined) parts.push(toStr(flat[b.key]));
        else parts.push(pickFirstBySuffix(b.key));
      } else if (b.kind === "sep") {
        parts.push(b.text);
      } else {
        parts.push("\n");
      }
    }
    return parts.join("").replace(/[ \t]+/g, " ").trim();
  }

  async function createTextMarkup(
    modelId: string,
    rid: number,
    text: string,
    scale: number
  ) {
    const [bbox] = await api.viewer.getObjectBoundingBoxes(modelId, [rid]);
    const p = midPoint(bbox.boundingBox);
    const pick: MarkupPick = {
      positionX: p.x * scale,
      positionY: p.y * scale,
      positionZ: p.z * scale,
    };
    await api.markup.addTextMarkup(text, pick);
  }

  const [preview, setPreview] = useState<string>("");
  useEffect(() => {
    (async () => {
      const sel = selectionRef.current;
      if (!sel.length || !sel[0].objectRuntimeIds.length) {
        setPreview("");
        return;
      }
      const g = sel[0];
      const rid = g.objectRuntimeIds[0];
      const txt = await renderForObject(g.modelId, rid, blocks);
      setPreview(txt);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  async function handleCreate() {
    setLoading(true);
    try {
      const sel =
        selectionRef.current.length > 0
          ? selectionRef.current
          : await readSelection();
      if (!sel.length) {
        setToast("Valik on tühi.");
        return;
      }
      const scale = scaleIsMM ? 1 : 1000;
      const seen = new Set<string>();
      let created = 0;

      for (const g of sel) {
        for (const rid of g.objectRuntimeIds) {
          const label = (await renderForObject(g.modelId, rid, blocks)).trim();
          if (!label) continue;
          const key = `${g.modelId}::${label}`;
          if (dedupe && seen.has(key)) continue;

          await createTextMarkup(g.modelId, rid, label, scale);
          created++;
          seen.add(key);
        }
      }
      setToast(`Loodud markupe: ${created}.`);
    } catch {
      setToast("Markuppide loomine ebaõnnestus.");
    } finally {
      setLoading(false);
      setTimeout(() => setToast(""), 2500);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Tööriistariba */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={handleDiscover} disabled={loading}>
          {loading ? "..." : "AVASTA omadused"}
        </button>

        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={scaleIsMM}
            onChange={(e) => setScaleIsMM(e.currentTarget.checked)}
          />
          Skaala = mm (API ootab mm)
        </label>

        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={dedupe}
            onChange={(e) => setDedupe(e.currentTarget.checked)}
          />
          Väldi duplikaat-silte
        </label>
      </div>

      {/* Klotsid */}
      {keys.length > 0 && (
        <div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
            Klõpsa või lohista klots mustrisse:
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              maxHeight: 220,
              overflow: "auto",
              border: "1px solid #e0e0e0",
              padding: 8,
              borderRadius: 8,
            }}
          >
            {keys.map((k) => (
              <button
                key={k}
                draggable
                onDragStart={() => {
                  // lihtsustatud – kasutame clicki lisamiseks
                }}
                onClick={() => addProp(k)}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 16,
                  padding: "4px 10px",
                  background: "white",
                  cursor: "pointer",
                }}
                title="Lisa mustrisse"
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Separaatorid */}
      <div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Eraldusklotsid:</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {QUICK_SEPS.map((s) => (
            <button
              key={s.label}
              onClick={() => addSep(s.text)}
              style={{
                border: "1px solid #ddd",
                borderRadius: 16,
                padding: "4px 10px",
                background: "white",
                cursor: "pointer",
              }}
              title="Lisa eraldaja"
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={addNewline}
            style={{
              border: "1px solid #ddd",
              borderRadius: 16,
              padding: "4px 10px",
              background: "white",
              cursor: "pointer",
            }}
            title="Lisa reavahetus"
          >
            reavahetus
          </button>
        </div>
      </div>

      {/* Muster – lohistatav järjekord */}
      <div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
          Muster (lohistatav järjekord):
        </div>
        <div
          style={{
            minHeight: 60,
            border: "1px dashed #bdbdbd",
            borderRadius: 8,
            padding: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
          onDragOver={onDragOver}
        >
          {blocks.length === 0 && (
            <div style={{ opacity: 0.5, fontSize: 12 }}>
              Lisa ülaltoodud klotsid siia…
            </div>
          )}
          {blocks.map((b, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDrop={() => onDrop(idx)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px",
                border: "1px solid #e0e0e0",
                borderRadius: 16,
                background: "#fff",
              }}
              title="Lohista ümber, × eemaldab"
            >
              <span style={{ fontFamily: "monospace" }}>
                {b.kind === "prop" ? `{${(b as any).key}}` : b.kind === "sep" ? (b as any).text : "\\n"}
              </span>
              <button
                onClick={() => removeBlock(idx)}
                style={{ border: 0, background: "transparent", cursor: "pointer", opacity: 0.6 }}
                aria-label="Eemalda"
                title="Eemalda"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Eelvaade */}
      <div style={{ fontSize: 12, opacity: 0.7 }}>Eelvaade (1. valitud objekt):</div>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#fafafa",
          border: "1px solid #eee",
          padding: 8,
          borderRadius: 6,
          maxHeight: 180,
          overflow: "auto",
        }}
      >
        {preview || "(tühi)"}
      </pre>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={handleCreate} disabled={loading || blocks.length === 0}>
          {loading ? "Töötlen…" : "LOO MARKUPID"}
        </button>
        <button onClick={() => setBlocks([])} disabled={loading}>
          Tühjenda muster
        </button>
      </div>

      {toast && (
        <div
          style={{
            background: "#333",
            color: "white",
            padding: "8px 12px",
            borderRadius: 6,
            position: "fixed",
            right: 12,
            bottom: 12,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
