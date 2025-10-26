import React, { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceAPI, Box3, Vector3, MarkupPick, TextMarkup } from "trimble-connect-workspace-api";
import { ModusButton, ModusCheckbox, ModusChip, ModusToast, ModusSpinner } from "@trimble-oss/modus-react-components";

/*
  DragDropMarkupBuilder – "klotsidega" markupite looja (kirjutamata)
  -----------------------------------------------------------------
  - AVASTA: loeb valitud objektide pSetid ning teeb neist klotsid (chips)
  - Lohista/kliki klotsid mustri-alale; järjekord = teksti järjekord
  - Kiirseparaatorid: " – ", " | ", tühik, reavahetus (nuppudena)
  - LOO MARKUPID: renderdab iga detaili jaoks teksti ning joonistab TextMarkup bbox keskpunkti
  - Skaala lüliti: mm (1x) vs m (1000x)
  - Duplikaat-siltide vältimine sama mudeli piires
*/

// ---- Abifunktsioonid ----
function midPoint(b: Box3): Vector3 {
  return {
    x: (b.min.x + b.max.x) / 2,
    y: (b.min.y + b.max.y) / 2,
    z: (b.min.z + b.max.z) / 2,
  };
}
function toStr(v: any): string { return v == null ? "" : String(v); }

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
) {
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

async function renderForObject(
  api: WorkspaceAPI,
  modelId: string,
  rid: number,
  blocks: Block[]
): Promise<string> {
  const flat = await flattenPropsForObject(api, modelId, rid);

  // Kui kasutaja valib {Mark} (ilma setita), proovi sobitada esimene ".Mark" lõppev võti
  const pickFirstBySuffix = (suffix: string) => {
    const k = Object.keys(flat).find((full) => full.endsWith(`.${suffix}`));
    return k ? toStr(flat[k]) : "";
  };

  const parts: string[] = [];
  for (const b of blocks) {
    if (b.kind === "prop") {
      if (flat[b.key] !== undefined) parts.push(toStr(flat[b.key]));
      else parts.push(pickFirstBySuffix(b.key));
    } else if (b.kind === "sep") {
      parts.push(b.text);
    } else if (b.kind === "newline") {
      parts.push("\n");
    }
  }
  return parts.join("").replace(/[ \t]+/g, " ").trim();
}

async function createTextMarkup(
  api: WorkspaceAPI,
  modelId: string,
  rid: number,
  text: string,
  scale: number
): Promise<TextMarkup | null> {
  if (!text) return null;
  const [bbox] = await api.viewer.getObjectBoundingBoxes(modelId, [rid]);
  const p = midPoint(bbox.boundingBox);
  const pick: MarkupPick = {
    positionX: p.x * scale,
    positionY: p.y * scale,
    positionZ: p.z * scale,
  };
  try {
    return (await api.markup.addTextMarkup(text, pick)) ?? null;
  } catch {
    return null;
  }
}

// ---- Klotsi tüübid ----
export type Block =
  | { kind: "prop"; key: string }
  | { kind: "sep"; text: string }
  | { kind: "newline" };

// Kiirseparaatorid – ilma kirjutamata
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
  const [toast, setToast] = useState("");
  const selectionRef = useRef<Array<{ modelId: string; objectRuntimeIds: number[] }>>([]);

  // Esmane valik mällu, et eelvaade saaks kohe töötada
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
    }
  }

  // Muster – lisamine/lohistamine/kustutamine
  function onChipClickAdd(k: string) {
    setBlocks((b) => [...b, { kind: "prop", key: k }]);
  }
  function addSep(text: string) {
    setBlocks((b) => [...b, { kind: "sep", text }]);
  }
  function addNewline() {
    setBlocks((b) => [...b, { kind: "newline" }]);
  }

  function onDragStart(e: React.DragEvent, idx: number) {
    e.dataTransfer.setData("text/plain", String(idx));
  }
  function onDrop(e: React.DragEvent, targetIdx: number) {
    const fromIdx = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(fromIdx)) return;
    setBlocks((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(targetIdx, 0, moved);
      return arr;
    });
  }
  function onDelete(idx: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  }

  // Eelvaade (esimese valitud objekti põhjal)
  async function buildPreview() {
    const sel = selectionRef.current;
    if (!sel.length || !sel[0].objectRuntimeIds.length) return "";
    const g = sel[0];
    const rid = g.objectRuntimeIds[0];
    return await renderForObject(api, g.modelId, rid, blocks);
  }
  const [livePreview, setLivePreview] = useState("");
  useEffect(() => {
    (async () => {
      setLivePreview(await buildPreview());
    })();
  }, [blocks]);

  async function handleCreate() {
    setLoading(true);
    try {
      const sel = selectionRef.current.length
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
          const text = await renderForObject(api, g.modelId, rid, blocks);
          const label = text.trim();
          if (!label) continue;

          const key = `${g.modelId}::${label}`;
          if (dedupe && seen.has(key)) continue;

          const mk = await createTextMarkup(api, g.modelId, rid, label, scale);
          if (mk) {
            created++;
            seen.add(key);
          }
        }
      }

      setToast(`Loodud markupe: ${created}.`);
    } catch {
      setToast("Markuppide loomine ebaõnnestus.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, padding: 12 }}>
      <h3 style={{ margin: 0 }}>Drag & Drop Markup Builder</h3>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <ModusButton onClick={handleDiscover} disabled={loading}>
          {loading ? <ModusSpinner size="s" /> : "AVASTA omadused"}
        </ModusButton>
        <ModusCheckbox
          label="Skaala = mm (API ootab mm)"
          checked={scaleIsMM}
          onValueChange={(e: any) => setScaleIsMM(Boolean(e?.detail?.checked))}
        />
        <ModusCheckbox
          label="Väldi duplikaat-silte"
          checked={dedupe}
          onValueChange={(e: any) => setDedupe(Boolean(e?.detail?.checked))}
        />
      </div>

      {/* Klotsid – avastatud väljad */}
      {keys.length > 0 && (
        <div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
            Lohista või kliki klotsil, et lisada mustrisse:
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
              <ModusChip
                key={k}
                label={k}
                onClick={() => onChipClickAdd(k)}
                draggable
                onDragStart={(e: any) => {
                  e.dataTransfer.setData("text/prop", k);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Kiirseparaatorid */}
      <div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
          Eraldusklotsid:
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {QUICK_SEPS.map((s) => (
            <ModusChip key={s.label} label={s.label} onClick={() => addSep(s.text)} />
          ))}
          <ModusChip label="reavahetus" onClick={addNewline} />
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
        >
          {blocks.length === 0 && (
            <div style={{ opacity: 0.5, fontSize: 12 }}>
              Lohista ülaltoodud klotsid siia…
            </div>
          )}
          {blocks.map((b, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={(e) => onDragStart(e, idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, idx)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px",
                border: "1px solid #e0e0e0",
                borderRadius: 16,
              }}
            >
              <span style={{ fontFamily: "monospace" }}>
                {b.kind === "prop"
                  ? `{${(b as any).key}}`
                  : b.kind === "sep"
                  ? toStr((b as any).text)
                  : "\\n"}
              </span>
              <button
                onClick={() => onDelete(idx)}
                style={{ border: 0, background: "transparent", cursor: "pointer", opacity: 0.6 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Eelvaade */}
      <div style={{ fontSize: 12, opacity: 0.7 }}>Eelvaade esimeselt valitud objektilt:</div>
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
        {livePreview || "(tühi)"}
      </pre>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <ModusButton color="primary" onClick={handleCreate} disabled={loading || blocks.length === 0}>
          {loading ? <ModusSpinner size="s" /> : "LOO MARKUPID"}
        </ModusButton>
        <ModusButton onClick={() => setBlocks([])} disabled={loading}>
          Tühjenda muster
        </ModusButton>
      </div>

      {toast && <ModusToast open text={toast} onClose={() => setToast("")} />}
    </div>
  );
}
