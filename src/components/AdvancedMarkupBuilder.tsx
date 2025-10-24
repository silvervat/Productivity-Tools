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
  } else if (typeof obj?.properties === "object" && obj.properties !== null) {
    Object.entries(obj.properties).forEach(([key, val]) => push("Properties", key, val));
  }

  // Standard fields
  if (obj?.id) out.ObjectId = String(obj.id);
  if (obj?.name) out.Name = String(obj.name);
  if (obj?.type) out.Type = String(obj.type);
  if (obj?.product?.name) out.ProductName = String(obj.product.name);
  if (obj?.product?.description) out.ProductDescription = String(obj.product.description);
  if (obj?.product?.type) out.ProductType = String(obj.product.type);

  // Fallback Product fields from property sets
  if (!out.ProductName || !out.ProductDescription || !out.ProductType) {
    const props: any[] = Array.isArray(obj?.properties) ? obj.properties : [];
    for (const set of props) {
      for (const p of set?.properties ?? []) {
        if (/product[_\s]?name/i.test(p?.name) && !out.ProductName) out.ProductName = String(p?.value || p?.displayValue || "");
        if (/product[_\s]?description/i.test(p?.name) && !out.ProductDescription) out.ProductDescription = String(p?.value || p?.displayValue || "");
        if (/product[_\s]?object[_\s]?type/i.test(p?.name) && !out.ProductType) out.ProductType = String(p?.value || p?.displayValue || "");
      }
    }
    console.log(`Lisasin Product fallback'id: Name=${out.ProductName}, Desc=${out.ProductDescription}, Type=${out.ProductType}`);
  }

  // GUIDs from props
  let guidIfc = "";
  let guidMs = "";
  Object.entries(propMap).forEach(([k, v]) => {
    if (!/guid|globalid|tekla_guid|id_guid/i.test(k)) return;
    const cls = classifyGuid(v);
    if (cls === "IFC" && !guidIfc) guidIfc = v;
    if (cls === "MS" && !guidMs) guidMs = v;
  });

  // Metadata for GUID_MS
  try {
    const metaArr = await api?.viewer?.getObjectMetadata?.(modelId, [obj?.id]);
    const metaOne = Array.isArray(metaArr) ? metaArr[0] : metaArr;
    if (metaOne?.globalId) {
      const g = String(metaOne.globalId);
      out.GUID_MS = out.GUID_MS || g;
      out["ReferenceObject.GlobalId"] = g;
      console.log(`Leidsin GUID_MS: ${g}`);
    }
  } catch (e) {
    console.warn("getObjectMetadata viga:", e);
  }

  // IFC GUID fallback
  if (!guidIfc && obj.id) {
    try {
      const externalIds = await api.viewer.convertToObjectIds(modelId, [obj.id]);
      const externalId = externalIds[0];
      if (externalId && classifyGuid(externalId) === "IFC") guidIfc = externalId;
      console.log(`Leidsin GUID_IFC fallback'ist: ${guidIfc}`);
    } catch (e) {
      console.warn("convertToObjectIds viga:", e);
    }
  }

  // Presentation Layers fallback
  if (!Object.keys(propMap).some(k => k.toLowerCase().startsWith("presentation_layers."))) {
    const rid = Number(obj?.id);
    if (Number.isFinite(rid)) {
      const layerStr = await getPresentationLayerString(api, modelId, rid);
      if (layerStr) {
        const key = "Presentation_Layers.Layer";
        propMap[key] = layerStr;
        out[key] = layerStr;
        console.log(`Leidsin Presentation Layers: ${layerStr}`);
      }
    }
  }

  // Reference Object fallback
  const hasRefBlock = Object.keys(propMap).some(k => k.toLowerCase().startsWith("referenceobject."));
  if (!hasRefBlock) {
    const rid = Number(obj?.id);
    if (Number.isFinite(rid)) {
      const ref = await getReferenceObjectInfo(api, modelId, rid);
      if (ref.fileName) out["ReferenceObject.File_Name"] = ref.fileName;
      if (ref.fileFormat) out["ReferenceObject.File_Format"] = ref.fileFormat;
      if (ref.commonType) out["ReferenceObject.Common_Type"] = ref.commonType;
      if (!guidIfc && ref.guidIfc) guidIfc = ref.guidIfc;
      if (!guidMs && ref.guidMs) guidMs = ref.guidMs;
      console.log(`Reference Object info: ${JSON.stringify(ref)}`);
    }
  }

  out.GUID_IFC = guidIfc;
  out.GUID_MS = guidMs;
  out.GUID = guidIfc || guidMs || "";
  return out;
}

export default function AdvancedMarkupBuilder({
  api,
  language = "et",
}: AdvancedMarkupBuilderProps) {
  const t = translations[language];
  const [discoveredFields, setDiscoveredFields] = useState<{ [key: string]: PropertyField }>({});
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [markupPrefix, setMarkupPrefix] = useState("");
  const [markupSeparator, setMarkupSeparator] = useState(" | ");
  const [useLineBreak, setUseLineBreak] = useState(false);
  const [markupResults, setMarkupResults] = useState<MarkupResult[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const previousMarkupIds = useRef<string[]>([]);

  const discoverFields = useCallback(async () => {
    if (!api?.viewer) {
      setDiscoveryError(t.selectObjects);
      return;
    }
    setIsDiscovering(true);
    setDiscoveryError("");
    try {
      const selection = await api.viewer.getSelection();
      if (!selection || selection.length === 0) {
        setDiscoveryError(t.selectObjects);
        setIsDiscovering(false);
        return;
      }
      const fieldsMap: { [key: string]: PropertyField } = {};
      let fieldCount = 0;
      const projectName = await getProjectName(api);
      const modelIds = selection.map((item: any) => item.modelId).filter(Boolean);
      const nameMap = await buildModelNameMap(api, modelIds);

      for (const selectionItem of selection) {
        if (!selectionItem.objectRuntimeIds) continue;
        const objectRuntimeIds = Array.isArray(selectionItem.objectRuntimeIds)
          ? selectionItem.objectRuntimeIds
          : [selectionItem.objectRuntimeIds];
        if (objectRuntimeIds.length === 0) continue;

        const fullProperties = await (api.viewer as any).getObjectProperties?.(
          selectionItem as any,
          objectRuntimeIds,
          { includeHidden: true }
        );
        if (fullProperties) {
          const firstProps = Array.isArray(fullProperties) ? fullProperties[0] : fullProperties;
          if (firstProps?.properties && typeof firstProps.properties === 'object') {
            const flattened = await flattenObject(firstProps, selectionItem.modelId, projectName, nameMap, api);
            Object.entries(flattened).forEach(([key, value]) => {
              if (value && value.trim().length > 0 && !fieldsMap[key]) {
                fieldsMap[key] = {
                  name: key,
                  value: String(value).substring(0, 100),
                  selected: fieldCount < 5,
                };
                fieldCount++;
              }
            });
          }
        } else {
          // Fallback nagu teises koodis
          console.warn("getObjectProperties failed, using fallback");
          const objects = await (api.viewer as any).getObjects?.({
            ids: objectRuntimeIds,
          });
          if (Array.isArray(objects) && objects.length > 0) {
            const firstObj = objects[0];
            const flattened = await flattenObject(firstObj, selectionItem.modelId, projectName, nameMap, api);
            Object.entries(flattened).forEach(([key, value]) => {
              if (value && value.trim().length > 0 && !fieldsMap[key]) {
                fieldsMap[key] = {
                  name: key,
                  value: String(value).substring(0, 100),
                  selected: fieldCount < 5,
                };
                fieldCount++;
              }
            });
          }
        }
      }

      if (fieldCount === 0) {
        const defaultFields = ['name', 'type', 'guid', 'code', 'description'];
        defaultFields.forEach((field) => {
          fieldsMap[field] = {
            name: field,
            value: `(${field})`,
            selected: fieldCount < 3,
          };
          fieldCount++;
        });
      }
      setDiscoveredFields(fieldsMap);
      setSuccessMessage(`✅ ${fieldCount} välja leitud!`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      setDiscoveryError(`${t.error} ${err.message}`);
      console.error("Discover error:", err);
    } finally {
      setIsDiscovering(false);
    }
  }, [api, t]);

  // Ülejäänud funktsioonid jäävad samaks, aga applyMarkup kasutab nüüd uuendatud flattenObject'i
  const toggleFieldSelection = (fieldName: string) => {
    setDiscoveredFields((prev) => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        selected: !prev[fieldName].selected,
      },
    }));
  };

  const applyMarkup = useCallback(async () => {
    if (!api?.viewer) {
      setDiscoveryError(t.selectObjects);
      return;
    }
    const selectedFields = Object.values(discoveredFields).filter((f) => f.selected);
    if (selectedFields.length === 0) {
      setDiscoveryError(t.noFieldsSelected);
      return;
    }
    setIsApplying(true);
    setDiscoveryError("");
    setSuccessMessage("");
    try {
      const selection = await api.viewer.getSelection();
      if (!selection || selection.length === 0) {
        setDiscoveryError(t.selectObjects);
        setIsApplying(false);
        return;
      }
      const results: MarkupResult[] = [];
      const newMarkupIds: string[] = [];
      const projectName = await getProjectName(api);
      const modelIds = selection.map((item: any) => item.modelId).filter(Boolean);
      const nameMap = await buildModelNameMap(api, modelIds);

      for (const selectionItem of selection) {
        if (!selectionItem.objectRuntimeIds) continue;
        const objectRuntimeIds = selectionItem.objectRuntimeIds.map((id: any) =>
          typeof id === 'string' ? parseInt(id) : id
        ).filter((n: number) => Number.isFinite(n));
        if (objectRuntimeIds.length === 0) continue;

        const fullProperties = await (api.viewer as any).getObjectProperties?.(
          selectionItem as any,
          objectRuntimeIds,
          { includeHidden: true }
        );
        if (!fullProperties) continue;

        for (let idx = 0; idx < objectRuntimeIds.length; idx++) {
          const props = Array.isArray(fullProperties) ? fullProperties[idx] : fullProperties;
          if (!props?.properties) continue;
          const flattened = await flattenObject(props, selectionItem.modelId, projectName, nameMap, api);
          const values = selectedFields
            .map((field) => flattened[field.name] || field.value)
            .filter((v) => v && v.length > 0);
          if (values.length === 0) continue;
          const separator = useLineBreak ? "\n" : markupSeparator;
          const markupText = markupPrefix + values.join(separator);
          try {
            const markupId = await (api.markup as any).add({
              label: markupText,
              objectId: objectRuntimeIds[idx],
            });
            if (markupId) {
              newMarkupIds.push(markupId);
              results.push({
                text: markupText,
                count: 1,
              });
            }
          } catch {
            continue;
          }
        }
      }
      previousMarkupIds.current = newMarkupIds;
      setMarkupResults(results);
      if (results.length > 0) {
        setSuccessMessage(`✅ Markup lisatud ${results.length} objektile!`);
      } else {
        setDiscoveryError(t.noDataDiscovered);
      }
    } catch (err: any) {
      setDiscoveryError(`${t.error} ${err.message}`);
      console.error("Apply markup error:", err);
    } finally {
      setIsApplying(false);
    }
  }, [api, discoveredFields, useLineBreak, markupSeparator, markupPrefix, t]);

  const condenseAndCopy = useCallback(() => {
    if (markupResults.length === 0) {
      setDiscoveryError("Tulemusi pole");
      return;
    }
    const condensed = markupResults.reduce(
      (acc, result) => {
        const existing = acc.find((r) => r.text === result.text);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ ...result });
        }
        return acc;
      },
      [] as MarkupResult[]
    );
    const text = condensed.map((r) => `${r.text} - ${r.count}tk`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setSuccessMessage("✅ Kopeeritud lõikelauale!");
      setTimeout(() => setSuccessMessage(""), 3000);
    });
  }, [markupResults]);

  const selectedCount = Object.values(discoveredFields).filter((f) => f.selected).length;
  return (
    <div className="amb-container">
      <div className="amb-header">
        <h2>{t.title}</h2>
      </div>
      {/* DISCOVER SECTION */}
      <div className="amb-section">
        <button
          className="amb-button amb-button-primary"
          onClick={discoverFields}
          disabled={isDiscovering}
        >
          {isDiscovering ? t.discovering : t.discoverFields}
        </button>
        {discoveryError && <div className="amb-error">{discoveryError}</div>}
        {Object.keys(discoveredFields).length > 0 && (
          <div className="amb-fields">
            <label className="amb-label">
              {t.selectedFields} ({selectedCount})
            </label>
            <div className="amb-fields-grid">
              {Object.entries(discoveredFields).map(([key, field]) => (
                <label key={key} className="amb-checkbox-label">
                  <input
                    type="checkbox"
                    checked={field.selected}
                    onChange={() => toggleFieldSelection(key)}
                    className="amb-checkbox"
                  />
                  <span className="amb-field-name">{field.name}</span>
                  <span className="amb-field-value" title={field.value}>
                    {field.value.substring(0, 20)}
                    {field.value.length > 20 ? "..." : ""}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* SETTINGS SECTION */}
      {selectedCount > 0 && (
        <div className="amb-section">
          <div className="amb-setting">
            <label>{t.prefix}</label>
            <input
              type="text"
              value={markupPrefix}
              onChange={(e) => setMarkupPrefix(e.target.value)}
              placeholder="Näit: [, ("
              className="amb-input"
            />
          </div>
          <div className="amb-setting">
            <label>{t.separator}</label>
            <select
              value={markupSeparator}
              onChange={(e) => setMarkupSeparator(e.target.value)}
              disabled={useLineBreak}
              className="amb-select"
            >
              {SEPARATORS.map((sep) => (
                <option key={sep.value} value={sep.value}>
                  {sep.label}
                </option>
              ))}
            </select>
          </div>
          <div className="amb-setting">
            <label className="amb-checkbox-label">
              <input
                type="checkbox"
                checked={useLineBreak}
                onChange={(e) => setUseLineBreak(e.target.checked)}
                className="amb-checkbox"
              />
              <span>{t.useLineBreak}</span>
            </label>
          </div>
          <button
            className="amb-button amb-button-success"
            onClick={applyMarkup}
            disabled={isApplying || selectedCount === 0}
          >
            {isApplying ? t.applying : t.applyMarkup}
          </button>
        </div>
      )}
      {/* RESULTS SECTION */}
      {markupResults.length > 0 && (
        <div className="amb-section">
          <div className="amb-results-header">
            <h3>{t.results}</h3>
            <button
              className="amb-button amb-button-secondary"
              onClick={condenseAndCopy}
            >
              {t.condenseResults}
            </button>
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
      {/* MESSAGES */}
      {successMessage && <div className="amb-success">{successMessage}</div>}
    </div>
  );
}
