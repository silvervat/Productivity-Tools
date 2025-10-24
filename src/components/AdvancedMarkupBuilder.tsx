import { useRef, useState, useCallback } from "react";
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import "./AdvancedMarkupBuilder.css";

const VERSION = "3.0.1"; // Full Assembly Exporter integration

type Language = "et" | "en";
type Tab = "markup" | "debug";

interface MarkupResult {
  text: string;
  count: number;
}

interface PropertyField {
  name: string;
  value: string;
  selected: boolean;
}

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  source?: string;
}

const translations = {
  et: {
    title: "MARKUP KOOSTE EHITAJA",
    version: "Versioon",
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
    debug: "🔧 DEBUG",
    debugLogs: "DEBUG LOGID",
    clearLogs: "Tühjenda logid",
    copyLogs: "Kopeeri logid (Share)",
    exportLogs: "Laadi alla LOG fail",
    noLogs: "Pole logisid.",
    logLevel: "Logi tase:",
    allLevels: "Kõik",
    infoOnly: "Info",
    warnsOnly: "Hoiatused",
    errorsOnly: "Vead",
  },
  en: {
    title: "ADVANCED MARKUP BUILDER",
    version: "Version",
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
    debug: "🔧 DEBUG",
    debugLogs: "DEBUG LOGS",
    clearLogs: "Clear logs",
    copyLogs: "Copy logs (Share)",
    exportLogs: "Download LOG file",
    noLogs: "No logs.",
    logLevel: "Log level:",
    allLevels: "All",
    infoOnly: "Info",
    warnsOnly: "Warnings",
    errorsOnly: "Errors",
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

// Logger class
class DebugLogger {
  private logs: LogEntry[] = [];

  log(message: string, level: "info" | "warn" | "error" | "debug" = "info", source: string = "AMB") {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString("et-EE"),
      level,
      message,
      source,
    };
    this.logs.push(entry);

    const prefix = `[${VERSION}] [${source}] ${level.toUpperCase()}`;
    if (level === "error") console.error(prefix, message);
    else if (level === "warn") console.warn(prefix, message);
    else if (level === "debug") console.debug(prefix, message);
    else console.log(prefix, message);
  }

  getLogs(filter: "all" | "info" | "warn" | "error" = "all"): LogEntry[] {
    if (filter === "all") return this.logs;
    return this.logs.filter((l) => l.level === filter);
  }

  clear() {
    this.logs = [];
  }

  export(): string {
    return this.logs
      .map((l) => `[${l.timestamp}] [${l.source}] ${l.level.toUpperCase()}: ${l.message}`)
      .join("\n");
  }

  downloadAsFile() {
    const content = this.export();
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(content));
    element.setAttribute("download", `AMB-Debug-${new Date().toISOString()}.log`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
}

const debugLogger = new DebugLogger();

// Helper functions
function sanitizeKey(s: string) {
  return String(s).replace(/\s+/g, "_").replace(/[^\w.-]/g, "").replace(/\+/g, ".").trim();
}

function normalizeGuid(s: string): string {
  return s.replace(/^urn:(uuid:)?/i, "").trim();
}

function classifyGuid(val: string): "IFC" | "MS" | "UNKNOWN" {
  const s = normalizeGuid(val.trim());
  if (/^[0-9A-Za-z_$]{22}$/.test(s)) return "IFC";
  if (/^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(s) || /^[0-9A-Fa-f]{32}$/.test(s)) return "MS";
  return "UNKNOWN";
}

// Assembly Exporter async fallback functions
async function getPresentationLayerString(api: any, modelId: string, runtimeId: number, addLog?: Function): Promise<string> {
  try {
    const layers = (await api?.viewer?.getObjectLayers?.(modelId, [runtimeId])) ?? (await api?.viewer?.getPresentationLayers?.(modelId, [runtimeId]));
    if (Array.isArray(layers) && layers.length) {
      const first = Array.isArray(layers[0]) ? layers[0] : layers;
      const result = first.filter(Boolean).map(String).join(", ");
      if (result) addLog?.(`Got presentation layers: ${result}`, "debug");
      return result;
    }
  } catch (err: any) {
    addLog?.(`getPresentationLayers error: ${err.message}`, "warn");
  }
  return "";
}

async function getReferenceObjectInfo(
  api: any,
  modelId: string,
  runtimeId: number,
  addLog?: Function
): Promise<{ fileName?: string; fileFormat?: string; commonType?: string; guidIfc?: string; guidMs?: string }> {
  const out: any = {};
  try {
    const meta = (await api?.viewer?.getObjectMetadata?.(modelId, [runtimeId])) ?? (await api?.viewer?.getObjectInfo?.(modelId, runtimeId));
    const m = Array.isArray(meta) ? meta[0] : meta;
    if (m?.file?.name) {
      out.fileName = String(m.file.name);
      if (addLog) addLog(`Got fileName: ${out.fileName}`, "debug");
    }
    if (m?.file?.format) {
      out.fileFormat = String(m.file.format);
      if (addLog) addLog(`Got fileFormat: ${out.fileFormat}`, "debug");
    }
    if (m?.commonType) {
      out.commonType = String(m.commonType);
      if (addLog) addLog(`Got commonType: ${out.commonType}`, "debug");
    }
    if (m?.globalId) {
      out.guidMs = String(m.globalId);
      if (addLog) addLog(`Got GUID_MS: ${out.guidMs}`, "debug");
    }
    if (!out.guidIfc) {
      try {
        const ext = await api?.viewer?.convertToObjectIds?.(modelId, [runtimeId]);
        if (ext && ext[0]) {
          out.guidIfc = String(ext[0]);
          if (addLog) addLog(`Got GUID_IFC: ${out.guidIfc}`, "debug");
        }
      } catch (err: any) {
        if (addLog) addLog(`convertToObjectIds fallback error: ${err.message}`, "warn");
      }
    }
  } catch (err: any) {
    if (addLog) addLog(`getReferenceObjectInfo error: ${err.message}`, "warn");
  }
  return out;
}

async function getProjectName(api: any, addLog?: Function): Promise<string> {
  try {
    const proj = typeof api?.project?.getProject === "function" ? await api.project.getProject() : api?.project || {};
    return String(proj?.name || "");
  } catch {
    return "";
  }
}

async function buildModelNameMap(api: any, modelIds: string[], addLog?: Function) {
  const map = new Map<string, string>();
  try {
    const list: any[] = await api?.viewer?.getModels?.();
    for (const m of list || []) {
      if (m?.id && m?.name) {
        map.set(String(m.id), String(m.name));
        addLog?.(`Model: ${m.id} = ${m.name}`, "debug");
      }
    }
  } catch (err: any) {
    addLog?.(`getModels error: ${err.message}`, "warn");
  }
  for (const id of new Set(modelIds)) {
    if (map.has(id)) continue;
    try {
      const f = await api?.viewer?.getLoadedModel?.(id);
      const n = f?.name || f?.file?.name;
      if (n) {
        map.set(id, String(n));
        addLog?.(`Loaded model: ${id} = ${n}`, "debug");
      }
    } catch (err: any) {
      addLog?.(`getLoadedModel fallback error: ${err.message}`, "warn");
    }
  }
  return map;
}

// TÄIELIK flattenProps - Assembly Exporter koopia!
async function flattenProps(
  obj: any,
  modelId: string,
  projectName: string,
  modelNameById: Map<string, string>,
  api: any,
  addLog?: Function
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
  const propMap = new Map<string, string>();
  const keyCounts = new Map<string, number>();

  const push = (group: string, name: string, val: unknown) => {
    const g = sanitizeKey(group);
    const n = sanitizeKey(name);
    const baseKey = g ? `${g}.${n}` : n;
    let key = baseKey;
    const count = keyCounts.get(baseKey) || 0;
    if (count > 0) key = `${baseKey}_${count}`;
    keyCounts.set(baseKey, count + 1);
    let v: unknown = val;
    if (Array.isArray(v)) v = v.map((x) => (x == null ? "" : String(x))).join(" | ");
    else if (typeof v === "object" && v !== null) v = JSON.stringify(v);
    const s = v == null ? "" : String(v);
    propMap.set(key, s);
    out[key] = s;
  };

  // Property sets
  if (Array.isArray(obj?.properties)) {
    obj.properties.forEach((propSet: any) => {
      const setName = propSet?.name || "Unknown";
      const setProps = propSet?.properties || [];
      if (Array.isArray(setProps)) {
        setProps.forEach((prop: any) => {
          const value = (prop?.displayValue ?? prop?.value) || "";
          const name = prop?.name || "Unknown";
          push(setName, name, value);
          addLog?.(`Found: ${setName}.${name} = ${String(value).substring(0, 50)}`, "debug");
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
        if (/product[_\s]?name/i.test(p?.name) && !out.ProductName) {
          out.ProductName = String(p?.value || p?.displayValue || "");
          addLog?.(`Fallback ProductName: ${out.ProductName}`, "debug");
        }
        if (/product[_\s]?description/i.test(p?.name) && !out.ProductDescription) {
          out.ProductDescription = String(p?.value || p?.displayValue || "");
          addLog?.(`Fallback ProductDescription: ${out.ProductDescription}`, "debug");
        }
        if (/product[_\s]?object[_\s]?type/i.test(p?.name) && !out.ProductType) {
          out.ProductType = String(p?.value || p?.displayValue || "");
          addLog?.(`Fallback ProductType: ${out.ProductType}`, "debug");
        }
      }
    }
  }

  // GUIDs from props
  let guidIfc = "";
  let guidMs = "";
  Object.entries(propMap).forEach(([k, v]) => {
    if (!/guid|globalid|tekla_guid|id_guid/i.test(k)) return;
    const cls = classifyGuid(v);
    if (cls === "IFC" && !guidIfc) {
      guidIfc = normalizeGuid(v);
      addLog?.(`Detected GUID_IFC from props: ${guidIfc}`, "debug");
    }
    if (cls === "MS" && !guidMs) {
      guidMs = normalizeGuid(v);
      addLog?.(`Detected GUID_MS from props: ${guidMs}`, "debug");
    }
  });

  // ReferenceObject fallback - async!
  if (obj?.runtimeId && api?.viewer) {
    const refInfo = await getReferenceObjectInfo(api, modelId, obj.runtimeId, addLog);
    if (refInfo.fileName && !out.FileName) out.FileName = refInfo.fileName;
    if (refInfo.fileFormat) out.FileFormat = refInfo.fileFormat;
    if (refInfo.commonType) out.CommonType = refInfo.commonType;
    if (refInfo.guidIfc && !guidIfc) {
      guidIfc = normalizeGuid(refInfo.guidIfc);
      addLog?.(`Got GUID_IFC from ReferenceObject: ${guidIfc}`, "debug");
    }
    if (refInfo.guidMs && !guidMs) {
      guidMs = normalizeGuid(refInfo.guidMs);
      addLog?.(`Got GUID_MS from ReferenceObject: ${guidMs}`, "debug");
    }
  }

  // PresentationLayers fallback - async!
  if (obj?.runtimeId && api?.viewer) {
    const layerStr = await getPresentationLayerString(api, modelId, obj.runtimeId, addLog);
    if (layerStr) out.PresentationLayers = layerStr;
  }

  // Final GUID assignment
  if (guidIfc) out.GUID_IFC = guidIfc;
  if (guidMs) out.GUID_MS = guidMs;
  if (guidIfc || guidMs) out.GUID = guidIfc || guidMs;

  return out;
}

export default function AdvancedMarkupBuilder({ api, language = "et" }: AdvancedMarkupBuilderProps) {
  const t = translations[language];
  const [tab, setTab] = useState<Tab>("markup");
  const [discoveredFields, setDiscoveredFields] = useState<{ [key: string]: PropertyField }>({});
  const [orderedFields, setOrderedFields] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [markupPrefix, setMarkupPrefix] = useState("");
  const [markupSeparator, setMarkupSeparator] = useState(" | ");
  const [useLineBreak, setUseLineBreak] = useState(false);
  const [markupResults, setMarkupResults] = useState<MarkupResult[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "info" | "warn" | "error">("all");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const previousMarkupIds = useRef<string[]>([]);

  const updateLogs = useCallback(() => {
    setLogs(debugLogger.getLogs(logFilter));
  }, [logFilter]);

  const addLog = useCallback(
    (message: string, level: "info" | "warn" | "error" | "debug" = "info", source = "AMB") => {
      debugLogger.log(message, level, source);
      updateLogs();
    },
    [updateLogs]
  );

  // Drag handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newOrder = [...orderedFields];
    const [draggedField] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedField);

    setOrderedFields(newOrder);
    setDraggedIndex(null);
    addLog(`Field reordered: ${draggedField}`, "debug");
  };

  // Discover fields - täielik, nagu Assembly Exporter
  const discoverFields = useCallback(async () => {
    addLog(`🔍 Starting field discovery...`, "info");

    if (!api?.viewer) {
      const msg = "API viewer not available";
      setDiscoveryError(msg);
      addLog(msg, "error");
      return;
    }

    setIsDiscovering(true);
    setDiscoveryError("");

    try {
      const selection = await api.viewer.getSelection();
      addLog(`Selection received: ${selection?.length || 0} items`, "info");

      if (!selection || selection.length === 0) {
        const msg = t.selectObjects;
        setDiscoveryError(msg);
        addLog(msg, "warn");
        setIsDiscovering(false);
        return;
      }

      const allFlattened: Record<string, string>[] = [];
      let totalObjs = 0;
      let processedObjects = 0;

      // Calculate total
      for (const sel of selection) {
        totalObjs += sel.objectRuntimeIds?.length || 0;
      }
      addLog(`Processing ${totalObjs} total objects`, "info");

      const projectName = await getProjectName(api, addLog);
      const modelIds = selection.map((item: any) => item.modelId).filter(Boolean);
      const nameMap = await buildModelNameMap(api, modelIds, addLog);

      for (const selectionItem of selection) {
        if (!selectionItem.objectRuntimeIds) {
          addLog("No objectRuntimeIds in selection item", "warn");
          continue;
        }

        const objectRuntimeIds = Array.isArray(selectionItem.objectRuntimeIds)
          ? selectionItem.objectRuntimeIds
          : [selectionItem.objectRuntimeIds];

        addLog(`Processing model: ${selectionItem.modelId}, ${objectRuntimeIds.length} objects`, "info");

        if (objectRuntimeIds.length === 0) continue;

        try {
          const fullProperties = await (api.viewer as any).getObjectProperties?.(
            selectionItem as any,
            objectRuntimeIds,
            { includeHidden: true }
          );

          if (fullProperties) {
            addLog(`Got properties for ${objectRuntimeIds.length} objects`, "debug");
            const fullObjects = Array.isArray(fullProperties) ? fullProperties : [fullProperties];

            const flattened = await Promise.all(
              fullObjects.map((o: any) =>
                flattenProps(o, selectionItem.modelId || "", projectName, nameMap, api, addLog)
              )
            );
            allFlattened.push(...flattened);
            processedObjects += objectRuntimeIds.length;
            addLog(`Processed ${processedObjects}/${totalObjs} objects`, "debug");
          } else {
            addLog(`No properties returned for ${objectRuntimeIds.length} objects`, "warn");
          }
        } catch (err: any) {
          addLog(`Property fetch error: ${err.message}`, "error");
        }
      }

      // Extract unique fields - 20-ni piir!
      const allKeys = Array.from(new Set(allFlattened.flatMap((r) => Object.keys(r)))).filter(
        (k) => k !== "ObjectId" && k !== "Project" && k !== "ModelId" && k !== "FileName"
      );

      addLog(`Found ${allKeys.length} unique fields, limiting to 20`, "info");

      const fieldsMapTemp: { [key: string]: PropertyField } = {};
      let fieldCount = 0;

      for (const key of allKeys.slice(0, 20)) {
        const sampleValue = allFlattened.find((r) => r[key] && r[key].trim().length > 0)?.[key] || `(${key})`;
        if (sampleValue && sampleValue.trim().length > 0) {
          fieldsMapTemp[key] = {
            name: key,
            value: String(sampleValue).substring(0, 100),
            selected: fieldCount < 5,
          };
          addLog(`Field: ${key} = ${String(sampleValue).substring(0, 40)}`, "debug");
          fieldCount++;
        }
      }

      if (fieldCount === 0) {
        addLog(`No fields found, using defaults`, "warn");
        const defaultFields = ["Name", "Type", "GUID", "GUID_IFC", "GUID_MS"];
        defaultFields.forEach((field) => {
          fieldsMapTemp[field] = { name: field, value: `(${field})`, selected: fieldCount < 3 };
          fieldCount++;
        });
      }

      setDiscoveredFields(fieldsMapTemp);
      setOrderedFields(Object.keys(fieldsMapTemp).filter((key) => fieldsMapTemp[key].selected));
      addLog(`✅ Discovery complete: ${fieldCount} fields from ${allFlattened.length} objects!`, "info");
      setSuccessMessage(`✅ ${fieldCount} välja leitud ${allFlattened.length} objektist!`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: any) {
      const msg = `Discover error: ${err.message}`;
      setDiscoveryError(msg);
      addLog(msg, "error");
    } finally {
      setIsDiscovering(false);
    }
  }, [api, t, addLog]);

  const toggleFieldSelection = (fieldName: string) => {
    setDiscoveredFields((prev) => {
      const newMap = { ...prev, [fieldName]: { ...prev[fieldName], selected: !prev[fieldName].selected } };
      const newOrder = Object.keys(newMap).filter((key) => newMap[key].selected);
      setOrderedFields(newOrder);
      addLog(`Field toggled: ${fieldName}`, "debug");
      return newMap;
    });
  };

  const applyMarkup = useCallback(async () => {
    if (!api?.viewer || orderedFields.length === 0) {
      setDiscoveryError(t.noFieldsSelected);
      addLog(t.noFieldsSelected, "warn");
      return;
    }

    setIsApplying(true);
    setDiscoveryError("");
    setSuccessMessage("");
    addLog(`Starting markup application with ${orderedFields.length} fields`, "info");

    try {
      const selection = await api.viewer.getSelection();
      if (!selection || selection.length === 0) {
        setDiscoveryError(t.selectObjects);
        addLog(t.selectObjects, "warn");
        setIsApplying(false);
        return;
      }

      const results: MarkupResult[] = [];
      const newMarkupIds: string[] = [];
      const projectName = await getProjectName(api, addLog);
      const modelIds = selection.map((item: any) => item.modelId).filter(Boolean);
      const nameMap = await buildModelNameMap(api, modelIds, addLog);

      for (const selectionItem of selection) {
        if (!selectionItem.objectRuntimeIds) continue;

        const objectRuntimeIds = selectionItem.objectRuntimeIds
          .map((id: any) => (typeof id === "string" ? parseInt(id) : id))
          .filter((n: number) => Number.isFinite(n));

        if (objectRuntimeIds.length === 0) continue;

        try {
          const fullProperties = await (api.viewer as any).getObjectProperties?.(
            selectionItem as any,
            objectRuntimeIds,
            { includeHidden: true }
          );

          if (!fullProperties) {
            addLog(`No properties for model ${selectionItem.modelId}`, "warn");
            continue;
          }

          for (let idx = 0; idx < objectRuntimeIds.length; idx++) {
            const props = Array.isArray(fullProperties) ? fullProperties[idx] : fullProperties;
            if (!props) continue;

            const flattened = await flattenProps(
              props,
              selectionItem.modelId || "",
              projectName,
              nameMap,
              api,
              addLog
            );
            const values = orderedFields
              .map((fieldName) => flattened[fieldName] || "")
              .filter((v) => v.length > 0);

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
                results.push({ text: markupText, count: 1 });
                addLog(`✅ Markup added: ${markupText}`, "debug");
              }
            } catch (err: any) {
              addLog(`Failed to add markup: ${err.message}`, "error");
              continue;
            }
          }
        } catch (err: any) {
          addLog(`Markup error: ${err.message}`, "error");
          continue;
        }
      }

      previousMarkupIds.current = newMarkupIds;
      setMarkupResults(results);
      if (results.length > 0) {
        const msg = `✅ Markup lisatud ${results.length} objektile!`;
        setSuccessMessage(msg);
        addLog(msg, "info");
      } else {
        setDiscoveryError(t.noDataDiscovered);
        addLog(t.noDataDiscovered, "warn");
      }
    } catch (err: any) {
      const msg = `Apply markup error: ${err.message}`;
      setDiscoveryError(msg);
      addLog(msg, "error");
    } finally {
      setIsApplying(false);
    }
  }, [api, orderedFields, useLineBreak, markupSeparator, markupPrefix, t, addLog]);

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
      addLog("Results copied to clipboard", "info");
      setTimeout(() => setSuccessMessage(""), 3000);
    });
  }, [markupResults, addLog]);

  const clearLogs = useCallback(() => {
    debugLogger.clear();
    setLogs([]);
    addLog("Logs cleared", "info");
  }, [addLog]);

  const copyLogs = useCallback(() => {
    const logText = debugLogger.export();
    navigator.clipboard.writeText(logText).then(() => {
      setSuccessMessage("✅ Logid kopeeritud!");
      setTimeout(() => setSuccessMessage(""), 2000);
    });
  }, []);

  const downloadLogs = useCallback(() => {
    debugLogger.downloadAsFile();
    addLog("Logs downloaded", "info");
  }, [addLog]);

  const selectedCount = orderedFields.length;

  return (
    <div className="amb-container">
      <div className="amb-header">
        <h2>{t.title}</h2>
        <span style={{ fontSize: "12px", opacity: 0.6 }}>
          {t.version} {VERSION}
        </span>
      </div>

      {/* TAB NAVIGATION */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: "1px solid #ccc" }}>
        <button
          onClick={() => setTab("markup")}
          style={{
            padding: "8px 16px",
            background: tab === "markup" ? "#0066cc" : "transparent",
            color: tab === "markup" ? "white" : "inherit",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px 4px 0 0",
            fontWeight: tab === "markup" ? "600" : "normal",
          }}
        >
          Markup
        </button>
        <button
          onClick={() => setTab("debug")}
          style={{
            padding: "8px 16px",
            background: tab === "debug" ? "#0066cc" : "transparent",
            color: tab === "debug" ? "white" : "inherit",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px 4px 0 0",
            fontWeight: tab === "debug" ? "600" : "normal",
          }}
        >
          {t.debug}
        </button>
      </div>

      {/* MARKUP TAB */}
      {tab === "markup" && (
        <>
          <div className="amb-section">
            <button className="amb-button amb-button-primary" onClick={discoverFields} disabled={isDiscovering}>
              {isDiscovering ? t.discovering : t.discoverFields}
            </button>

            {discoveryError && <div className="amb-error">{discoveryError}</div>}

            {Object.keys(discoveredFields).length > 0 && (
              <div className="amb-fields">
                <label className="amb-label">
                  {t.selectedFields} ({selectedCount}) <small>{t.dragHint}</small>
                </label>
                <div className="amb-fields-grid" onDragOver={handleDragOver}>
                  {orderedFields.map((key, index) => (
                    <div
                      key={key}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`amb-field-item ${draggedIndex === index ? "dragging" : ""}`}
                    >
                      <label className="amb-checkbox-label">
                        <input
                          type="checkbox"
                          checked={discoveredFields[key]?.selected || false}
                          onChange={() => toggleFieldSelection(key)}
                          className="amb-checkbox"
                        />
                        <span className="amb-field-name">{key}</span>
                        <span className="amb-field-value" title={discoveredFields[key]?.value}>
                          {discoveredFields[key]?.value.substring(0, 20)}
                          {discoveredFields[key]?.value.length > 20 ? "..." : ""}
                        </span>
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

              <button className="amb-button amb-button-success" onClick={applyMarkup} disabled={isApplying || selectedCount === 0}>
                {isApplying ? t.applying : t.applyMarkup}
              </button>
            </div>
          )}

          {markupResults.length > 0 && (
            <div className="amb-section">
              <div className="amb-results-header">
                <h3>{t.results}</h3>
                <button className="amb-button amb-button-secondary" onClick={condenseAndCopy}>
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

          {successMessage && <div className="amb-success">{successMessage}</div>}
        </>
      )}

      {/* DEBUG TAB */}
      {tab === "debug" && (
        <div className="amb-section">
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            <button className="amb-button amb-button-primary" onClick={copyLogs}>
              📋 {t.copyLogs}
            </button>
            <button className="amb-button amb-button-primary" onClick={downloadLogs}>
              💾 {t.exportLogs}
            </button>
            <button className="amb-button amb-button-ghost" onClick={clearLogs}>
              🗑️ {t.clearLogs}
            </button>
          </div>

          <div className="amb-setting">
            <label>{t.logLevel}</label>
            <select value={logFilter} onChange={(e) => setLogFilter(e.target.value as any)} className="amb-select">
              <option value="all">{t.allLevels}</option>
              <option value="info">{t.infoOnly}</option>
              <option value="warn">{t.warnsOnly}</option>
              <option value="error">{t.errorsOnly}</option>
            </select>
          </div>

          <div
            style={{
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "12px",
              maxHeight: "500px",
              overflow: "auto",
              background: "#0a0e27",
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#00ff00",
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: "#666" }}>{t.noLogs}</div>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    color:
                      log.level === "error"
                        ? "#ff4444"
                        : log.level === "warn"
                          ? "#ffaa00"
                          : log.level === "debug"
                            ? "#4488ff"
                            : "#00ff00",
                    marginBottom: "4px",
                    fontFamily: "Courier New, monospace",
                  }}
                >
                  [{log.timestamp}] [{log.source}] {log.level.toUpperCase()}: {log.message}
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: "12px", fontSize: "11px", opacity: 0.7 }}>
            💡 {t.debugLogs} - {logs.length} entries | Copy to share with developer
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{ marginTop: "12px", fontSize: "10px", opacity: 0.4, textAlign: "center", borderTop: "1px solid #eee", paddingTop: "8px" }}>
        AdvancedMarkupBuilder v{VERSION} | Full Assembly Exporter integration with async fallbacks
      </div>
    </div>
  );
}
