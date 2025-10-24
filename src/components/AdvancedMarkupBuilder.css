import { useRef, useState, useCallback } from "react";
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import "./AdvancedMarkupBuilder.css";

const VERSION = "2.5.0"; // ← VERSION TRACKING

type Language = "et" | "en";
type Tab = "markup" | "logs";

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
  level: "info" | "warn" | "error";
  message: string;
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
    logs: "📋 LOGID",
    clearLogs: "Tühjenda logid",
    copyLogs: "Kopeeri logid",
    noLogs: "Pole logisid.",
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
    logs: "📋 LOGS",
    clearLogs: "Clear logs",
    copyLogs: "Copy logs",
    noLogs: "No logs.",
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

// Logger utility
class Logger {
  logs: LogEntry[] = [];

  log(message: string, level: "info" | "warn" | "error" = "info") {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    this.logs.push(entry);
    
    // Also log to browser console
    const prefix = `[${VERSION}] ${level.toUpperCase()}`;
    if (level === "error") console.error(prefix, message);
    else if (level === "warn") console.warn(prefix, message);
    else console.log(prefix, message);
  }

  clear() {
    this.logs = [];
  }

  export(): string {
    return this.logs
      .map((l) => `[${l.timestamp}] ${l.level.toUpperCase()}: ${l.message}`)
      .join("\n");
  }
}

const logger = new Logger();

// ... (rest of helper functions remain the same: normalizeGuid, classifyGuid, etc.)

export default function AdvancedMarkupBuilder({
  api,
  language = "et",
}: AdvancedMarkupBuilderProps) {
  const t = translations[language];
  const [tab, setTab] = useState<Tab>("markup");
  const [discoveredFields, setDiscoveredFields] = useState<{ [key: string]: PropertyField }>({});
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [markupPrefix, setMarkupPrefix] = useState("");
  const [markupSeparator, setMarkupSeparator] = useState(" | ");
  const [useLineBreak, setUseLineBreak] = useState(false);
  const [markupResults, setMarkupResults] = useState<MarkupResult[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const previousMarkupIds = useRef<string[]>([]);

  // Update logs in state
  const addLog = useCallback((message: string, level: "info" | "warn" | "error" = "info") => {
    logger.log(message, level);
    setLogs([...logger.logs]);
  }, []);

  const discoverFields = useCallback(async () => {
    addLog(`Starting field discovery...`, "info");
    
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

      const fieldsMap: { [key: string]: PropertyField } = {};
      let fieldCount = 0;

      for (const selectionItem of selection) {
        if (!selectionItem.objectRuntimeIds) {
          addLog("No objectRuntimeIds in selection item", "warn");
          continue;
        }

        const objectRuntimeIds = Array.isArray(selectionItem.objectRuntimeIds)
          ? selectionItem.objectRuntimeIds
          : [selectionItem.objectRuntimeIds];

        addLog(`Processing ${objectRuntimeIds.length} objects`, "info");

        if (objectRuntimeIds.length === 0) continue;

        try {
          const fullProperties = await (api.viewer as any).getObjectProperties?.(
            selectionItem as any,
            objectRuntimeIds,
            { includeHidden: true }
          );

          if (fullProperties) {
            addLog(`Got properties for ${objectRuntimeIds.length} objects`, "info");
            const firstProps = Array.isArray(fullProperties) ? fullProperties[0] : fullProperties;
            
            if (firstProps?.properties && Array.isArray(firstProps.properties)) {
              firstProps.properties.forEach((propSet: any) => {
                const setName = propSet?.name || "Unknown";
                const setProps = propSet?.properties || [];
                
                addLog(`Found property set: ${setName} with ${setProps.length} properties`, "info");
                
                if (Array.isArray(setProps)) {
                  setProps.forEach((prop: any) => {
                    const value = prop?.displayValue ?? prop?.value;
                    const name = prop?.name || "Unknown";
                    const key = `${setName}.${name}`;
                    
                    if (value !== null && value !== undefined && !fieldsMap[key]) {
                      fieldsMap[key] = {
                        name: key,
                        value: String(value).substring(0, 100),
                        selected: fieldCount < 8,
                      };
                      fieldCount++;
                    }
                  });
                }
              });
            } else {
              addLog("No properties found in first object", "warn");
            }
          } else {
            addLog("getObjectProperties returned no data", "warn");
          }
        } catch (err: any) {
          addLog(`Property fetch error: ${err.message}`, "error");
        }
      }

      // ❌ REMOVED default fields fallback - if no fields, show error only
      if (fieldCount === 0) {
        const msg = t.noDataDiscovered;
        setDiscoveryError(msg);
        addLog(msg, "warn");
        setDiscoveredFields({});
      } else {
        setDiscoveredFields(fieldsMap);
        addLog(`✅ Discovered ${fieldCount} fields`, "info");
        setSuccessMessage(`✅ ${fieldCount} välja leitud!`);
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (err: any) {
      const msg = `Discover error: ${err.message}`;
      setDiscoveryError(msg);
      addLog(msg, "error");
    } finally {
      setIsDiscovering(false);
    }
  }, [api, t, addLog]);

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
    addLog(`Starting markup application...`, "info");
    
    if (!api?.viewer) {
      const msg = t.selectObjects;
      setDiscoveryError(msg);
      addLog(msg, "error");
      return;
    }

    const selectedFields = Object.values(discoveredFields).filter((f) => f.selected);
    if (selectedFields.length === 0) {
      const msg = t.noFieldsSelected;
      setDiscoveryError(msg);
      addLog(msg, "warn");
      return;
    }

    addLog(`Applying markup with ${selectedFields.length} fields`, "info");
    setIsApplying(true);
    setDiscoveryError("");
    setSuccessMessage("");

    try {
      const selection = await api.viewer.getSelection();
      if (!selection || selection.length === 0) {
        const msg = t.selectObjects;
        setDiscoveryError(msg);
        addLog(msg, "warn");
        setIsApplying(false);
        return;
      }

      const results: MarkupResult[] = [];
      const newMarkupIds: string[] = [];

      for (const selectionItem of selection) {
        if (!selectionItem.objectRuntimeIds) continue;

        try {
          const objectRuntimeIds = selectionItem.objectRuntimeIds
            .map((id: any) => (typeof id === "string" ? parseInt(id) : id))
            .filter((n: number) => Number.isFinite(n));

          if (objectRuntimeIds.length === 0) continue;

          const fullProperties = await (api.viewer as any).getObjectProperties?.(
            selectionItem as any,
            objectRuntimeIds,
            { includeHidden: true }
          );

          if (!fullProperties) {
            addLog("No properties returned for objects", "warn");
            continue;
          }

          for (let idx = 0; idx < objectRuntimeIds.length; idx++) {
            const props = Array.isArray(fullProperties) ? fullProperties[idx] : fullProperties;
            if (!props) continue;

            // Extract values from properties
            const values: string[] = [];
            selectedFields.forEach((field) => {
              let value = "";
              
              if (Array.isArray(props.properties)) {
                props.properties.forEach((propSet: any) => {
                  if (value) return;
                  const setName = propSet?.name || "";
                  const setProps = propSet?.properties || [];
                  
                  setProps.forEach((prop: any) => {
                    const key = `${setName}.${prop?.name || ""}`;
                    if (key === field.name) {
                      value = String(prop?.displayValue ?? prop?.value || "");
                    }
                  });
                });
              }

              if (value) values.push(value);
            });

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
                addLog(`✅ Markup added: ${markupText}`, "info");
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
        const msg = t.noDataDiscovered;
        setDiscoveryError(msg);
        addLog(msg, "warn");
      }
    } catch (err: any) {
      const msg = `Apply markup error: ${err.message}`;
      setDiscoveryError(msg);
      addLog(msg, "error");
    } finally {
      setIsApplying(false);
    }
  }, [api, discoveredFields, useLineBreak, markupSeparator, markupPrefix, t, addLog]);

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
    logger.clear();
    setLogs([]);
    addLog("Logs cleared", "info");
  }, [addLog]);

  const copyLogs = useCallback(() => {
    const logText = logger.export();
    navigator.clipboard.writeText(logText).then(() => {
      setSuccessMessage("✅ Logid kopeeritud!");
      setTimeout(() => setSuccessMessage(""), 2000);
    });
  }, []);

  const selectedCount = Object.values(discoveredFields).filter((f) => f.selected).length;

  return (
    <div className="amb-container">
      <div className="amb-header">
        <h2>{t.title}</h2>
        <span style={{ fontSize: "12px", opacity: 0.6 }}>v{VERSION}</span>
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
          onClick={() => setTab("logs")}
          style={{
            padding: "8px 16px",
            background: tab === "logs" ? "#0066cc" : "transparent",
            color: tab === "logs" ? "white" : "inherit",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px 4px 0 0",
            fontWeight: tab === "logs" ? "600" : "normal",
          }}
        >
          {t.logs}
        </button>
      </div>

      {/* MARKUP TAB */}
      {tab === "markup" && (
        <>
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

          {successMessage && <div className="amb-success">{successMessage}</div>}
        </>
      )}

      {/* LOGS TAB */}
      {tab === "logs" && (
        <div className="amb-section">
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <button className="amb-button amb-button-primary" onClick={copyLogs}>
              {t.copyLogs}
            </button>
            <button className="amb-button amb-button-ghost" onClick={clearLogs}>
              {t.clearLogs}
            </button>
          </div>

          <div
            style={{
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "12px",
              maxHeight: "400px",
              overflow: "auto",
              background: "#f9f9f9",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: "#999" }}>{t.noLogs}</div>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    color: log.level === "error" ? "#d32f2f" : log.level === "warn" ? "#f57c00" : "#1976d2",
                    marginBottom: "4px",
                  }}
                >
                  [{log.timestamp}] {log.level.toUpperCase()}: {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{ marginTop: "12px", fontSize: "11px", opacity: 0.5, textAlign: "center" }}>
        AdvancedMarkupBuilder v{VERSION} | Trimble Connect
      </div>
    </div>
  );
}
