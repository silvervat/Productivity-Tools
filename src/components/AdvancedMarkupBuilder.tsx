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
    selectedFields: "Valitud väljad (lohisemiseks):",
    noFieldsSelected: "❌ Palun vali vähemalt üks väli!",
    separator: "Eraldaja:",
    prefix: "Eesliide:",
    useLineBreak: "Kasuta reavahte (ühekaupa alla)",
    applyMarkup: "➕ LISA MARKUP",
    condenseResults: "📋 KOONDA & KOPEERI",
    results: "Tulemused:",
    selectObjects: "⚠️ Palun vali objektid 3D vaates",
    discovering: "Tuvastan väljasid...",
    applying: "Lisastan markup...",
    success: "✅ Markup lisatud",
    noDataDiscovered: "⚠️ Objektidel puuduvad omadused",
    error: "❌ Viga:",
    dragHint: "Lohista väljad soovitud järjekorda",
  },
  en: {
    title: "ADVANCED MARKUP BUILDER",
    discoverFields: "🔍 DISCOVER FIELDS",
    selectedFields: "Selected fields (drag to reorder):",
    noFieldsSelected: "❌ Please select at least one field!",
    separator: "Separator:",
    prefix: "Prefix:",
    useLineBreak: "Use line breaks (one per line)",
    applyMarkup: "➕ ADD MARKUP",
    condenseResults: "📋 CONDENSE & COPY",
    results: "Results:",
    selectObjects: "⚠️ Please select objects in 3D view",
    discovering: "Discovering fields...",
    applying: "Applying markup...",
    success: "✅ Markup applied",
    noDataDiscovered: "⚠️ Objects have no properties",
    error: "❌ Error:",
    dragHint: "Drag fields to reorder",
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

// Abifunktsioonid (sama kui eelmises paranduses, lühendatud)
function normalizeGuid(s: string): string { return s.replace(/^urn:(uuid:)?/i, "").trim(); }
function classifyGuid(val: string): "IFC" | "MS" | "UNKNOWN" {
  const s = normalizeGuid(val.trim());
  if (/^[0-9A-Za-z_$]{22}$/.test(s)) return "IFC";
  if (/^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(s) || /^[0-9A-Fa-f]{32}$/.test(s)) return "MS";
  return "UNKNOWN";
}
async function getProjectName(api: any): Promise<string> {
  try { const proj = typeof api?.project?.getProject === "function" ? await api.project.getProject() : api?.project || {}; return String(proj?.name || ""); } catch { return ""; }
}
async function buildModelNameMap(api: any, modelIds: string[]) {
  const map = new Map<string, string>();
  try { const list: any[] = await api?.viewer?.getModels?.(); for (const m of list || []) { if (m?.id && m?.name) map.set(String(m.id), String(m.name)); } } catch {}
  for (const id of new Set(modelIds)) { if (map.has(id)) continue; try { const f = await api?.viewer?.getLoadedModel?.(id); const n = f?.name || f?.file?.name; if (n) map.set(id, String(n)); } catch {} }
  return map;
}
async function flattenObject(obj: any, modelId: string, projectName: string, modelNameById: Map<string, string>, api: any): Promise<Record<string, string>> {
  const out: Record<string, string> = { GUID: "", GUID_IFC: "", GUID_MS: "", Project: String(projectName || ""), ModelId: String(modelId), FileName: modelNameById.get(modelId) || "", Name: "", Type: "Unknown" };
  const propMap: Record<string, string> = {};
  const push = (group: string, name: string, val: unknown) => { const g = String(group).replace(/\s+/g, "_").replace(/[^\w.-]/g, "").replace(/\+/g, ".").trim(); const n = String(name).replace(/\s+/g, "_").replace(/[^\w.-]/g, "").replace(/\+/g, ".").trim(); const key = g ? `${g}.${n}` : n; const v = val == null ? "" : String(val); propMap[key] = v; out[key] = v; };
  if (Array.isArray(obj?.properties)) { obj.properties.forEach((propSet: any) => { const setName = propSet?.name || "Unknown"; const setProps = propSet?.properties || []; if (Array.isArray(setProps)) { setProps.forEach((prop: any) => { const value = prop?.displayValue ?? prop?.value; const name = prop?.name || "Unknown"; push(setName, name, value); }); } }); }
  else if (typeof obj?.properties === "object" && obj.properties !== null) { Object.entries(obj.properties).forEach(([key, val]) => push("Properties", key, val)); }
  if (obj?.id) out.ObjectId = String(obj.id); if (obj?.name) out.Name = String(obj.name); if (obj?.type) out.Type = String(obj.type);
  if (obj?.product?.name) out.ProductName = String(obj.product.name); if (obj?.product?.description) out.ProductDescription = String(obj.product.description); if (obj?.product?.type) out.ProductType = String(obj.product.type);
  // Fallback Product
  if (!out.ProductName || !out.ProductDescription || !out.ProductType) { const props: any[] = Array.isArray(obj?.properties) ? obj.properties : []; for (const set of props) { for (const p of set?.properties ?? []) { if (/product[_\s]?name/i.test(p?.name) && !out.ProductName) out.ProductName = String(p?.value || p?.displayValue || ""); if (/product[_\s]?description/i.test(p?.name) && !out.ProductDescription) out.ProductDescription = String(p?.value || p?.displayValue || ""); if (/product[_\s]?object[_\s]?type/i.test(p?.name) && !out.ProductType) out.ProductType = String(p?.value || p?.displayValue || ""); } } console.log(`Fallback Product: Name=${out.ProductName}`); }
  // GUIDs
  let guidIfc = "", guidMs = ""; Object.entries(propMap).forEach(([k, v]) => { if (!/guid|globalid|tekla_guid|id_guid/i.test(k)) return; const cls = classifyGuid(v); if (cls === "IFC" && !guidIfc) guidIfc = v; if (cls === "MS" && !guidMs) guidMs = v; });
  try { const metaArr = await api?.viewer?.getObjectMetadata?.(modelId, [obj?.id]); const metaOne = Array.isArray(metaArr) ? metaArr[0] : metaArr; if (metaOne?.globalId) { const g = String(metaOne.globalId); out.GUID_MS = out.GUID_MS || g; out["ReferenceObject.GlobalId"] = g; console.log(`GUID_MS: ${g}`); } } catch (e) { console.warn("Metadata error:", e); }
  if (!guidIfc && obj.id) { try { const externalIds = await api.viewer.convertToObjectIds(modelId, [obj.id]); const externalId = externalIds[0]; if (externalId && classifyGuid(externalId) === "IFC") guidIfc = externalId; console.log(`GUID_IFC: ${guidIfc}`); } catch (e) { console.warn("Convert error:", e); } }
  out.GUID_IFC = guidIfc; out.GUID_MS = guidMs; out.GUID = guidIfc || guidMs || "";
  return out;
}

export default function AdvancedMarkupBuilder({ api, language = "et" }: AdvancedMarkupBuilderProps) {
  const t = translations[language];
  const [discoveredFields, setDiscoveredFields] = useState<{ [key: string]: PropertyField }>({});
  const [orderedFields, setOrderedFields] = useState<string[]>([]); // UUS: Järjekord lohistamiseks
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [markupPrefix, setMarkupPrefix] = useState("");
  const [markupSeparator, setMarkupSeparator] = useState(" | ");
  const [useLineBreak, setUseLineBreak] = useState(false);
  const [markupResults, setMarkupResults] = useState<MarkupResult[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null); // UUS: Lohistamise state
  const previousMarkupIds = useRef<string[]>([]);

  // UUS: Lohistamise handlers
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    const newOrder = [...orderedFields];
    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedItem);
    setOrderedFields(newOrder);
    setDraggedIndex(null);
  }, [draggedIndex, orderedFields]);

  const discoverFields = useCallback(async () => {
    if (!api?.viewer) { setDiscoveryError(t.selectObjects); return; }
    setIsDiscovering(true); setDiscoveryError("");
    try {
      const selection = await api.viewer.getSelection();
      if (!selection || selection.length === 0) { setDiscoveryError(t.selectObjects); setIsDiscovering(false); return; }
      const fieldsMap: { [key: string]: PropertyField } = {};
      let fieldCount = 0;
      const projectName = await getProjectName(api);
      const modelIds = selection.map((item: any) => item.modelId).filter(Boolean);
      const nameMap = await buildModelNameMap(api, modelIds);
      for (const selectionItem of selection) {
        if (!selectionItem.objectRuntimeIds) continue;
        const objectRuntimeIds = Array.isArray(selectionItem.objectRuntimeIds) ? selectionItem.objectRuntimeIds : [selectionItem.objectRuntimeIds];
        if (objectRuntimeIds.length === 0) continue;
        try {
          const fullProperties = await (api.viewer as any).getObjectProperties?.(selectionItem as any, objectRuntimeIds, { includeHidden: true });
          if (fullProperties) {
            const firstProps = Array.isArray(fullProperties) ? fullProperties[0] : fullProperties;
            if (firstProps?.properties) {
              const flattened = await flattenObject(firstProps, selectionItem.modelId || "", projectName, nameMap, api);
              Object.entries(flattened).forEach(([key, value]) => {
                if (value && value.trim().length > 0 && !fieldsMap[key]) {
                  fieldsMap[key] = { name: key, value: String(value).substring(0, 100), selected: fieldCount < 5 };
                  fieldCount++;
                }
              });
            }
          }
        } catch (err: any) { console.warn("Property fetch error:", err.message); }
      }
      if (fieldCount === 0) {
        const defaultFields = ['Name', 'Type', 'GUID', 'Code', 'Description'];
        defaultFields.forEach((field) => { fieldsMap[field] = { name: field, value: `(${field})`, selected: fieldCount < 3 }; fieldCount++; });
      }
      setDiscoveredFields(fieldsMap);
      setOrderedFields(Object.keys(fieldsMap).filter(key => fieldsMap[key].selected)); // UUS: Algne järjekord valitud väljadest
      setSuccessMessage(`✅ ${fieldCount} välja leitud!`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      setDiscoveryError(`${t.error} ${err.message}`);
      console.error("Discover error:", err);
    } finally { setIsDiscovering(false); }
  }, [api, t]);

  const toggleFieldSelection = (fieldName: string) => {
    setDiscoveredFields((prev) => {
      const newMap = { ...prev, [fieldName]: { ...prev[fieldName], selected: !prev[fieldName].selected } };
      const newOrder = Object.keys(newMap).filter(key => newMap[key].selected);
      setOrderedFields(newOrder); // UUS: Uuenda järjekorda valiku muutmisel
      return newMap;
    });
  };

  const applyMarkup = useCallback(async () => {
    if (!api?.viewer || orderedFields.length === 0) { setDiscoveryError(t.noFieldsSelected); return; }
    setIsApplying(true); setDiscoveryError(""); setSuccessMessage("");
    try {
      const selection = await api.viewer.getSelection();
      if (!selection || selection.length === 0) { setDiscoveryError(t.selectObjects); setIsApplying(false); return; }
      const results: MarkupResult[] = [];
      const newMarkupIds: string[] = [];
      const projectName = await getProjectName(api);
      const modelIds = selection.map((item: any) => item.modelId).filter(Boolean);
      const nameMap = await buildModelNameMap(api, modelIds);
      for (const selectionItem of selection) {
        if (!selectionItem.objectRuntimeIds) continue;
        const objectRuntimeIds = selectionItem.objectRuntimeIds.map((id: any) => typeof id === 'string' ? parseInt(id) : id).filter((n: number) => Number.isFinite(n));
        if (objectRuntimeIds.length === 0) continue;
        const fullProperties = await (api.viewer as any).getObjectProperties?.(selectionItem as any, objectRuntimeIds, { includeHidden: true });
        if (!fullProperties) continue;
        for (let idx = 0; idx < objectRuntimeIds.length; idx++) {
          const props = Array.isArray(fullProperties) ? fullProperties[idx] : fullProperties;
          if (!props?.properties) continue;
          const flattened = await flattenObject(props, selectionItem.modelId || "", projectName, nameMap, api);
          const values = orderedFields.map((fieldName) => flattened[fieldName] || "").filter((v) => v.length > 0);
          if (values.length === 0) continue;
          const separator = useLineBreak ? "\n" : markupSeparator;
          const markupText = markupPrefix + values.join(separator);
          try {
            const markupId = await (api.markup as any).add({ label: markupText, objectId: objectRuntimeIds[idx] });
            if (markupId) { newMarkupIds.push(markupId); results.push({ text: markupText, count: 1 }); }
          } catch { continue; }
        }
      }
      previousMarkupIds.current = newMarkupIds;
      setMarkupResults(results);
      if (results.length > 0) { setSuccessMessage(`✅ Markup lisatud ${results.length} objektile!`); } else { setDiscoveryError(t.noDataDiscovered); }
    } catch (err: any) {
      setDiscoveryError(`${t.error} ${err.message}`);
      console.error("Apply markup error:", err);
    } finally { setIsApplying(false); }
  }, [api, orderedFields, useLineBreak, markupSeparator, markupPrefix, t]);

  const condenseAndCopy = useCallback(() => {
    if (markupResults.length === 0) { setDiscoveryError("Tulemusi pole"); return; }
    const condensed = markupResults.reduce((acc, result) => { const existing = acc.find((r) => r.text === result.text); if (existing) { existing.count++; } else { acc.push({ ...result }); } return acc; }, [] as MarkupResult[]);
    const text = condensed.map((r) => `${r.text} - ${r.count}tk`).join("\n");
    navigator.clipboard.writeText(text).then(() => { setSuccessMessage("✅ Kopeeritud lõikelauale!"); setTimeout(() => setSuccessMessage(""), 3000); });
  }, [markupResults]);

  const selectedCount = orderedFields.length;
  return (
    <div className="amb-container">
      <div className="amb-header"><h2>{t.title}</h2></div>
      <div className="amb-section">
        <button className="amb-button amb-button-primary" onClick={discoverFields} disabled={isDiscovering}>
          {isDiscovering ? t.discovering : t.discoverFields}
        </button>
        {discoveryError && <div className="amb-error">{discoveryError}</div>}
        {Object.keys(discoveredFields).length > 0 && (
          <div className="amb-fields">
            <label className="amb-label">{t.selectedFields} ({selectedCount}) <small>{t.dragHint}</small></label>
            <div className="amb-fields-grid" onDragOver={handleDragOver}>
              {orderedFields.map((key, index) => (
                <div
                  key={key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`amb-field-item ${draggedIndex === index ? 'dragging' : ''}`}
                >
                  <label className="amb-checkbox-label">
                    <input type="checkbox" checked={discoveredFields[key]?.selected || false} onChange={() => toggleFieldSelection(key)} className="amb-checkbox" />
                    <span className="amb-field-name">{key}</span>
                    <span className="amb-field-value" title={discoveredFields[key]?.value}>{discoveredFields[key]?.value.substring(0, 20)}{discoveredFields[key]?.value.length > 20 ? "..." : ""}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {selectedCount > 0 && (
        <div className="amb-section">
          <div className="amb-setting">
            <label>{t.prefix}</label>
            <input type="text" value={markupPrefix} onChange={(e) => setMarkupPrefix(e.target.value)} placeholder="Näit: [, (" className="amb-input" />
          </div>
          <div className="amb-setting">
            <label>{t.separator}</label>
            <select value={markupSeparator} onChange={(e) => setMarkupSeparator(e.target.value)} disabled={useLineBreak} className="amb-select">
              {SEPARATORS.map((sep) => <option key={sep.value} value={sep.value}>{sep.label}</option>)}
            </select>
          </div>
          <div className="amb-setting">
            <label className="amb-checkbox-label">
              <input type="checkbox" checked={useLineBreak} onChange={(e) => setUseLineBreak(e.target.checked)} className="amb-checkbox" />
              <span>{t.useLineBreak}</span>
            </label>
          </div>
          <button className="amb-button amb-button-success" onClick={applyMarkup} disabled={isApplying || selectedCount === 0}>
            {isApplying ? t.applying : t.applyMarkup}
          </button>
        </div>
      )}
      {markupResults.length > 0 && (
        <div className="amb-section">
          <div className="amb-results-header">
            <h3>{t.results}</h3>
            <button className="amb-button amb-button-secondary" onClick={condenseAndCopy}>{t.condenseResults}</button>
          </div>
          <div className="amb-results-list">
            {markupResults.map((result, idx) => (
              <div key={idx} className="amb-result-item">
                <span className="amb-result-text">{result.text}</span>
                <span className="amb-result-count">× {result.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {successMessage && <div className="amb-success">{successMessage}</div>}
    </div>
  );
}
