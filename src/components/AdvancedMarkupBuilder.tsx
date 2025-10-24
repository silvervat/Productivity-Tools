import { useRef, useState, useCallback } from "react";
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import "./AdvancedMarkupBuilder.css";

type Language = "et" | "en";
interface MarkupResult {
  text: string;
  count: number;
}
interface PropertyField {
  name: string;
  value: string;
  selected: boolean;
}
const translations = {
  et: {
    title: "MARKUP KOOSTE EHITAJA",
    discoverFields: "🔍 TUVASTA ANDMEVÄLJAD",
    selectedFields: "Valitud väljad:",
    noFieldsSelected: "❌ Palun vali vähemalt üks väli!",
    separator: "Eraldaja:",
    prefix: "Eesliide:",
    useLineBreak: "Kasuta reavahte",
    applyMarkup: "➕ LISA MARKUP",
    condenseResults: "📋 KOONDA JA KOPEERI",
    results: "Tulemused:",
    selectObjects: "⚠️ Palun vali objektid 3D vaates",
    discovering: "Tuvastan väljasid...",
    applying: "Lisastan markup...",
    success: "✅ Markup lisatud",
    noDataDiscovered: "⚠️ Objektidel puuduvad omadused",
    error: "❌ Viga:",
  },
  en: {
    title: "ADVANCED MARKUP BUILDER",
    discoverFields: "🔍 DISCOVER FIELDS",
    selectedFields: "Selected fields:",
    noFieldsSelected: "❌ Please select at least one field!",
    separator: "Separator:",
    prefix: "Prefix:",
    useLineBreak: "Use line breaks",
    applyMarkup: "➕ ADD MARKUP",
    condenseResults: "📋 CONDENSE & COPY",
    results: "Results:",
    selectObjects: "⚠️ Please select objects in 3D view",
    discovering: "Discovering fields...",
    applying: "Applying markup...",
    success: "✅ Markup applied",
    noDataDiscovered: "⚠️ Objects have no properties",
    error: "❌ Error:",
  },
};
const SEPARATORS = [
  { label: " | ", value: " | " },
  { label: " - ", value: " - " },
  { label: " , ", value: " , " },
  { label: " . ", value: " . " },
  { label: " : ", value: " : " },
  { label: " / ", value: " / " },
  { label: "\\n (new line)", value: "\n" },
];
interface AdvancedMarkupBuilderProps {
  api: WorkspaceAPI.WorkspaceAPI | undefined;
  language?: Language;
}

// UUS: Abifunktsioonid teise koodist GUID-ide jaoks
function normalizeGuid(s: string): string {
  return s.replace(/^urn:(uuid:)?/i, "").trim();
}
function classifyGuid(val: string): "IFC" | "MS" | "UNKNOWN" {
  const s = normalizeGuid(val.trim());
  if (/^[0-9A-Za-z_$]{22}$/.test(s)) return "IFC";
  if (/^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(s) || /^[0-9A-Fa-f]{32}$/.test(s)) return "MS";
  return "UNKNOWN";
}

// UUS: Fallback Presentation Layers
async function getPresentationLayerString(api: any, modelId: string, runtimeId: number): Promise<string> {
  try {
    const layers = (await api?.viewer?.getObjectLayers?.(modelId, [runtimeId])) ?? (await api?.viewer?.getPresentationLayers?.(modelId, [runtimeId]));
    if (Array.isArray(layers) && layers.length) {
      const first = Array.isArray(layers[0]) ? layers[0] : layers;
      return first.filter(Boolean).map(String).join(", ");
    }
  } catch {}
  return "";
}

// UUS: Reference Object info
async function getReferenceObjectInfo(
  api: any,
  modelId: string,
  runtimeId: number
): Promise<{ fileName?: string; fileFormat?: string; commonType?: string; guidIfc?: string; guidMs?: string }> {
  const out: any = {};
  try {
    const meta = (await api?.viewer?.getObjectMetadata?.(modelId, [runtimeId])) ?? (await api?.viewer?.getObjectInfo?.(modelId, runtimeId));
    const m = Array.isArray(meta) ? meta[0] : meta;
    if (m?.file?.name) out.fileName = String(m.file.name);
    if (m?.file?.format) out.fileFormat = String(m.file.format);
    if (m?.commonType) out.commonType = String(m.commonType);
    if (m?.globalId) out.guidMs = String(m.globalId);
    if (!out.guidIfc) {
      try {
        const ext = await api?.viewer?.convertToObjectIds?.(modelId, [runtimeId]);
        if (ext && ext[0]) out.guidIfc = String(ext[0]);
      } catch {}
    }
  } catch {}
  return out;
}

// UUS: Projekti nimi
async function getProjectName(api: any): Promise<string> {
  try {
    const proj = typeof api?.project?.getProject === "function" ? await api.project.getProject() : api?.project || {};
    return String(proj?.name || "");
  } catch {
    return "";
  }
}

// UUS: Mudelite nimede map
async function buildModelNameMap(api: any, modelIds: string[]) {
  const map = new Map<string, string>();
  try {
    const list: any[] = await api?.viewer?.getModels?.();
    for (const m of list || []) {
      if (m?.id && m?.name) map.set(String(m.id), String(m.name));
    }
  } catch {}
  for (const id of new Set(modelIds)) {
    if (map.has(id)) continue;
    try {
      const f = await api?.viewer?.getLoadedModel?.(id);
      const n = f?.name || f?.file?.name;
      if (n) map.set(id, String(n));
    } catch {}
  }
  return map;
}

// PARANDATUD: flattenObject, nüüd sarnane flattenProps'iga teise koodist
async function flattenObject(
  obj: any,
  modelId: string,
  projectName: string,
  modelNameById: Map<string, string>,
  api: any
): Promise<Record<string, string>> {
  const out: Record<string, string> = {
    GUID: "",
    GUID_IFC: "",
    GUID_MS: "",
    Project: String(projectName || ""),
    ModelId: String(modelId),
    FileName: modelNameById.get(modelId) || "",
    Name: "",
    Type: "Unknown",
  };
  const propMap: Record<string, string> = {};

  const push = (group: string, name: string, val: unknown) => {
    const g = sanitizeKey(group);
    const n = sanitizeKey(name);
    const key = g ? `${g}.${n}` : n;
    const v = val == null ? "" : String(val);
    propMap[key] = v;
    out[key] = v;
  };

  function sanitizeKey(s: string) {
    return String(s).replace(/\s+/g, "_").replace(/[^\w.-]/g, "").replace(/\+/g, ".").trim();
  }

  // Property sets
  if (Array.isArray(obj?.properties)) {
    obj.properties.forEach((propSet: any) => {
      const setName = propSet?.name || "Unknown";
      const setProps = propSet?.properties || [];
      if (Array.isArray(setProps)) {
        setProps.forEach((prop: any) => {
          const value = prop?.displayValue ?? prop?.value;
          const name = prop?.name || "Unknown";
          push(setName, name, value);
        });
      }
    });
  }
