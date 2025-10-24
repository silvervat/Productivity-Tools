// ============================================
// EXPORT TAB WITH MARKUP BUILDER - ÜKS FAIL
// Sisaldab: Hook + 3 komponenti + Integratsioon
// ============================================

import { useCallback, useEffect, useState } from "react";
import type { ObjectProperties, TextMarkup, WorkspaceAPI } from "trimble-connect-workspace-api";

// ====================
// INTERFACE-ID (DiscoveredField jne)
// ====================
interface DiscoveredField {
  setName: string;
  propertyName: string;
  displayName: string;
  frequency: number;
  valueSamples: string[];
  objectsWithValue: number;
}

interface MarkupConfig {
  selectedFields: DiscoveredField[];
  separator: "comma" | "newline";
  position: "center" | "top";
}

interface ExportTabProps {
  api: WorkspaceAPI;
  exportData: ObjectProperties[];
  language: "et" | "en";
  addLog: (message: string) => void;
}

// ====================
// TÕLKED (Bilingual ET/EN)
// ====================
const translations = {
  et: {
    exportData: "Export Data",
    refreshData: "Uuenda andmeid",
    markupBuilder: "📌 Markup Builder",
    step1Fields: "1️⃣ Väljad",
    step2Selection: "2️⃣ Valik",
    step3Apply: "3️⃣ Rakenda",
    noExportData: "Pole andmeid. Tee esmalt otsing ja vali objektid.",
    applying: "Rakendame markupi…",
    apply: "Rakenda Markup",
    success: "✅ Markup rakendatud {count} objektile",
    error: "❌ Viga markupi rakendamisel: {error}",
    noSelection: "⚠️ Vali väljad ja objektid",
    extracting: "Ekstraheeritakse andmeid…",
    discoveringFields: "Väljasid otsitakse...",
    noFields: "Väljasid ei leitud valitud objektidest",
    frequency: "Objektide %",
    samples: "Näidis väärtused",
    totalObjects: "Objektid kokku",
    selectFields: "Vali väljad",
    selectAll: "Vali kõik",
    deselectAll: "Tühjenda",
    separator: "Eraldaja:",
    comma: "Koma",
    newline: "Uus rida",
    previewLabel: "Eelvaade:",
    position: "Markupi asukoht:",
    center: "Keskele",
    top: "Üles",
  },
  en: {
    exportData: "Export Data",
    refreshData: "Refresh Data",
    markupBuilder: "📌 Markup Builder",
    step1Fields: "1️⃣ Fields",
    step2Selection: "2️⃣ Selection",
    step3Apply: "3️⃣ Apply",
    noExportData: "No data. Do a search and select objects first.",
    applying: "Applying markup…",
    apply: "Apply Markup",
    success: "✅ Markup applied to {count} objects",
    error: "❌ Error applying markup: {error}",
    noSelection: "⚠️ Select fields and objects",
    extracting: "Extracting data…",
    discoveringFields: "Discovering fields...",
    noFields: "No fields found in selected objects",
    frequency: "Object %",
    samples: "Sample values",
    totalObjects: "Total objects",
    selectFields: "Select Fields",
    selectAll: "Select all",
    deselectAll: "Deselect all",
    separator: "Separator:",
    comma: "Comma",
    newline: "New line",
    previewLabel: "Preview:",
    position: "Markup position:",
    center: "Center",
    top: "Top",
  },
};

const t = (key: string, language: "et" | "en") => translations[language][key as keyof typeof translations.et];

// ====================
// HELPER FUNKTSIOONID
// ====================
interface Vector3 { x: number; y: number; z: number; }
interface Box3 { min: Vector3; max: Vector3; }

function getMidPoint(bBox: Box3): Vector3 {
  return {
    x: (bBox.min.x + bBox.max.x) / 2.0,
    y: (bBox.min.y + bBox.max.y) / 2.0,
    z: (bBox.min.z + bBox.max.z) / 2.0,
  };
}

async function getPropertyValue(
  api: WorkspaceAPI,
  modelId: string,
  objectId: number,
  setName: string,
  propertyName: string
): Promise<string> {
  try {
    const properties = await api.viewer.getObjectProperties(modelId, [objectId]);
    if (!properties || properties.length === 0) return "";

    const props = properties[0].properties;
    if (!props) return "";

    const propertySet = props.find((p) => (p as any).name === setName);
    if (!propertySet || !propertySet.properties) return "";

    const property = propertySet.properties.find((p) => p.name === propertyName);
    if (!property) return "";

    return String(property.value || "").trim();
  } catch (err) {
    console.error("Error getting property value:", err);
    return "";
  }
}

// ====================
// CUSTOM HOOK: useMarkupFieldDiscovery
// ====================
export function useMarkupFieldDiscovery(objects: ObjectProperties[]) {
  const [fields, setFields] = useState<DiscoveredField[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const discoverFields = async () => {
      if (!objects || objects.length === 0) {
        setFields([]);
        return;
      }

      setIsLoading(true);
      const fieldMap = new Map<
        string,
        { frequency: number; samples: Set<string>; objectsWithValue: number }
      >();

      for (const obj of objects) {
        if (!obj.properties) continue;

        for (const propSet of obj.properties) {
          if (!propSet.properties) continue;

          for (const prop of propSet.properties) {
            const key = `${propSet.name}|${prop.name}`;
            const value = String(prop.value || "").trim();

            if (!fieldMap.has(key)) {
              fieldMap.set(key, { frequency: 0, samples: new Set(), objectsWithValue: 0 });
            }

            const field = fieldMap.get(key)!;
            field.frequency++;

            if (field.samples.size < 2 && value.length > 0) {
              field.samples.add(value);
            }

            if (value.length > 0) {
              field.objectsWithValue++;
            }
          }
        }
      }

      const discovered: DiscoveredField[] = Array.from(fieldMap.entries())
        .map(([key, data]) => {
          const [setName, propertyName] = key.split("|");
          return {
            setName,
            propertyName,
            displayName: `${setName} → ${propertyName}`,
            frequency: Math.round((data.frequency / objects.length) * 100),
            valueSamples: Array.from(data.samples),
            objectsWithValue: data.objectsWithValue,
          };
        })
        .sort((a, b) => b.frequency - a.frequency);

      setFields(discovered);
      setIsLoading(false);
    };

    discoverFields();
  }, [objects]);

  return { fields, isLoading };
}

// ====================
// KOMPONENT: MarkupFieldDiscovery (näitab avastatud väljad)
// ====================
function MarkupFieldDiscovery({ fields, isLoading, language }: { fields: DiscoveredField[]; isLoading: boolean; language: "et" | "en"; }) {
  if (isLoading) {
    return <p style={styles.loadingText}>{t("discoveringFields", language)}</p>;
  }

  if (fields.length === 0) {
    return <p style={styles.emptyText}>{t("noFields", language)}</p>;
  }

  return (
    <div style={styles.fieldsList}>
      {fields.map((field) => (
        <div key={`${field.setName}|${field.propertyName}`} style={styles.fieldItem}>
          <div style={styles.fieldHeader}>
            <span style={styles.fieldName}>{field.displayName}</span>
            <span 
              style={{
                ...styles.frequencyBadge,
                background: field.frequency >= 80 ? "#4caf50" : field.frequency >= 50 ? "#ff9800" : "#f44336",
              }}
            >
              {field.frequency}%
            </span>
          </div>
          {field.valueSamples.length > 0 && (
            <div style={styles.samplesRow}>
              <span style={styles.sampleLabel}>{t("samples", language)}:</span>
              <div style={styles.samples}>
                {field.valueSamples.map((sample, i) => (
                  <span key={i} style={styles.sample}>{sample}</span>
                ))}
              </div>
            </div>
          )}
          <div style={styles.statsRow}>
            <span style={styles.stat}>
              {t("totalObjects", language)}: {field.objectsWithValue}/{fields.length}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ====================
// KOMPONENT: MarkupFieldSelector (valik ja konfig)
// ====================
function MarkupFieldSelector({
  discoveredFields,
  onSelectionChange,
  language,
  onSeparatorChange,
  onPositionChange,
}: {
  discoveredFields: DiscoveredField[];
  onSelectionChange: (fields: DiscoveredField[]) => void;
  language: "et" | "en";
  onSeparatorChange: (sep: "comma" | "newline") => void;
  onPositionChange: (pos: "center" | "top") => void;
}) {
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const [separator, setSeparator] = useState<"comma" | "newline">("comma");
  const [position, setPosition] = useState<"center" | "top">("center");

  const handleToggleField = useCallback((setName: string, propertyName: string) => {
    const key = `${setName}|${propertyName}`;
    const newSet = new Set(selectedSet);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedSet(newSet);
    const selected = discoveredFields.filter((f) => newSet.has(`${f.setName}|${f.propertyName}`));
    onSelectionChange(selected);
  }, [selectedSet, discoveredFields, onSelectionChange]);

  const handleSelectAll = useCallback(() => {
    const allKeys = new Set(discoveredFields.map((f) => `${f.setName}|${f.propertyName}`));
    setSelectedSet(allKeys);
    onSelectionChange(discoveredFields);
  }, [discoveredFields, onSelectionChange]);

  const handleDeselectAll = useCallback(() => {
    setSelectedSet(new Set());
    onSelectionChange([]);
  }, [onSelectionChange]);

  const previewText = Array.from(selectedSet)
    .slice(0, 3)
    .map((key) => {
      const [setName, propName] = key.split("|");
      const field = discoveredFields.find((f) => f.setName === setName && f.propertyName === propName);
      return field?.valueSamples[0] || "N/A";
    })
    .join(separator === "comma" ? ", " : "\n");

  useEffect(() => {
    onSeparatorChange(separator);
  }, [separator, onSeparatorChange]);

  useEffect(() => {
    onPositionChange(position);
  }, [position, onPositionChange]);

  return (
    <div style={styles.container}>
      <div style={styles.controlsRow}>
        <button onClick={handleSelectAll} style={styles.smallBtn} title={t("selectAll", language)}>
          ✓ {t("selectAll", language)}
        </button>
        <button onClick={handleDeselectAll} style={styles.smallBtn} title={t("deselectAll", language)}>
          ✕ {t("deselectAll", language)}
        </button>
      </div>
      <div style={styles.fieldsList}>
        {discoveredFields.map((field) => {
          const key = `${field.setName}|${field.propertyName}`;
          const isSelected = selectedSet.has(key);
          return (
            <label key={key} style={styles.checkRow}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggleField(field.setName, field.propertyName)}
                style={styles.checkbox}
              />
              <span style={styles.checkLabel}>{field.displayName}</span>
              <span
                style={{
                  ...styles.frequencyBadge,
                  background: isSelected ? "#0a3a67" : "#f0f0f0",
                  color: isSelected ? "#fff" : "#666",
                }}
              >
                {field.frequency}%
              </span>
            </label>
          );
        })}
      </div>
      <div style={styles.configSection}>
        <div style={styles.configRow}>
          <label style={styles.configLabel}>{t("separator", language)}</label>
          <select
            value={separator}
            onChange={(e) => setSeparator(e.target.value as "comma" | "newline")}
            style={styles.select}
          >
            <option value="comma">{t("comma", language)} (", ")</option>
            <option value="newline">{t("newline", language)} ("⏎")</option>
          </select>
        </div>
        <div style={styles.configRow}>
          <label style={styles.configLabel}>{t("position", language)}</label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as "center" | "top")}
            style={styles.select}
          >
            <option value="center">{t("center", language)}</option>
            <option value="top">{t("top", language)}</option>
          </select>
        </div>
      </div>
      {selectedSet.size > 0 && (
        <div style={styles.preview}>
          <div style={styles.previewLabel}>{t("previewLabel", language)}</div>
          <div style={styles.previewBox}>{previewText || "..."}</div>
        </div>
      )}
    </div>
  );
}

// ====================
// KOMPONENT: MarkupBuilder (rakendamine)
// ====================
function MarkupBuilder({
  api,
  selectedObjects,
  selectedFields,
  separator,
  position,
  onComplete,
  onError,
  language,
}: {
  api: WorkspaceAPI;
  selectedObjects: ObjectProperties[];
  selectedFields: DiscoveredField[];
  separator: "comma" | "newline";
  position: "center" | "top";
  onComplete: (markupIds: number[], message: string) => void;
  onError: (error: string) => void;
  language: "et" | "en";
}) {
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyMarkup = useCallback(async () => {
    if (!selectedObjects || selectedObjects.length === 0) {
      onError(t("noSelection", language));
      return;
    }
    if (!selectedFields || selectedFields.length === 0) {
      onError(t("noSelection", language));
      return;
    }

    setIsApplying(true);

    try {
      const markups: TextMarkup[] = [];
      const separatorStr = separator === "comma" ? ", " : "\n";

      for (const obj of selectedObjects) {
        if (!obj.modelId) continue;

        const bBoxes = await api.viewer.getObjectBoundingBoxes(obj.modelId, [obj.id]);
        if (!bBoxes || bBoxes.length === 0) continue;

        const bBox = bBoxes[0].boundingBox;
        const midPoint = getMidPoint(bBox);

        const values: string[] = [];
        for (const field of selectedFields) {
          const value = await getPropertyValue(api, obj.modelId, obj.id, field.setName, field.propertyName);
          if (value) values.push(value);
        }

        if (values.length > 0) {
          const markupText = values.join(separatorStr);
          const markup: TextMarkup = {
            text: markupText,
            start: {
              positionX: midPoint.x * 1000,
              positionY: midPoint.y * 1000,
              positionZ: midPoint.z * 1000,
            },
            end: {
              positionX: midPoint.x * 1000,
              positionY: midPoint.y * 1000,
              positionZ: midPoint.z * 1000,
            },
          };
          markups.push(markup);
        }
      }

      if (markups.length > 0) {
        const result = await api.markup.addTextMarkup(markups);
        const markupIds = result.map((m) => m.id as number);
        onComplete(
          markupIds,
          t("success", language).replace("{count}", String(markupIds.length))
        );
      } else {
        onError(t("noSelection", language));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      onError(t("error", language).replace("{error}", errorMsg));
    } finally {
      setIsApplying(false);
    }
  }, [selectedObjects, selectedFields, separator, api, onComplete, onError, language]);

  return (
    <div style={styles.container}>
      <button
        onClick={handleApplyMarkup}
        disabled={isApplying || selectedFields.length === 0}
        style={{
          ...styles.applyBtn,
          opacity: isApplying || selectedFields.length === 0 ? 0.5 : 1,
          cursor: isApplying || selectedFields.length === 0 ? "not-allowed" : "pointer",
        }}
      >
        {isApplying ? t("applying", language) : t("apply", language)}
      </button>
      {isApplying && <div style={styles.loadingText}>{t("extracting", language)}</div>}
    </div>
  );
}

// ====================
// PEAMINE KOMPONENT: ExportTab (integratsioon)
// ====================
export function ExportTab({ api, exportData, language, addLog }: ExportTabProps) {
  const [showMarkupBuilder, setShowMarkupBuilder] = useState(false);
  const [selectedMarkupFields, setSelectedMarkupFields] = useState<DiscoveredField[]>([]);
  const [markupSeparator, setMarkupSeparator] = useState<"comma" | "newline">("comma");
  const [markupPosition, setMarkupPosition] = useState<"center" | "top">("center");

  const { fields: discoveredFields, isLoading } = useMarkupFieldDiscovery(exportData);

  const handleToggleMarkupBuilder = useCallback(() => {
    setShowMarkupBuilder(!showMarkupBuilder);
    if (!showMarkupBuilder && exportData.length === 0) {
      addLog(t("noExportData", language));
    }
  }, [showMarkupBuilder, exportData, language, addLog]);

  const handleMarkupComplete = useCallback((markupIds: number[], message: string) => {
    addLog(message);
  }, [addLog]);

  const handleMarkupError = useCallback((errorMessage: string) => {
    addLog(errorMessage);
  }, [addLog]);

  return (
    <div style={styles.container}>
      {/* Olemasolev export loogika (näide) */}
      <div style={styles.section}>
        <button style={styles.btn} onClick={() => addLog("📊 Uuendamine käivitas...")}>
          🔄 {t("refreshData", language)}
        </button>
      </div>
      <div style={styles.section}>
        <label style={styles.labelTop}>{language === "et" ? "Veerud:" : "Columns:"}</label>
        <div style={styles.columnsList}>
          <span style={styles.placeholder}>
            {language === "et" ? "Siin oleks veergude selector..." : "Your column selector here..."}
          </span>
        </div>
      </div>

      <div style={styles.divider} />

      {/* UUS: Markup Builder */}
      <button
        style={styles.markupToggleBtn}
        onClick={handleToggleMarkupBuilder}
        disabled={exportData.length === 0}
      >
        {showMarkupBuilder ? "🔽" : "▶️"} {t("markupBuilder", language)}
        <span style={styles.badge}>{selectedMarkupFields.length}</span>
      </button>

      {showMarkupBuilder && exportData.length > 0 && (
        <div style={styles.markupPanel}>
          {/* Step 1: Väljad */}
          <div style={styles.step}>
            <h4 style={styles.stepTitle}>{t("step1Fields", language)}</h4>
            <MarkupFieldDiscovery fields={discoveredFields} isLoading={isLoading} language={language} />
          </div>

          {/* Step 2: Valik */}
          {discoveredFields.length > 0 && (
            <div style={styles.step}>
              <h4 style={styles.stepTitle}>{t("step2Selection", language)}</h4>
              <MarkupFieldSelector
                discoveredFields={discoveredFields}
                onSelectionChange={setSelectedMarkupFields}
                language={language}
                onSeparatorChange={setMarkupSeparator}
                onPositionChange={setMarkupPosition}
              />
            </div>
          )}

          {/* Step 3: Rakenda */}
          {selectedMarkupFields.length > 0 && (
            <div style={styles.step}>
              <h4 style={styles.stepTitle}>{t("step3Apply", language)}</h4>
              <MarkupBuilder
                api={api}
                selectedObjects={exportData}
                selectedFields={selectedMarkupFields}
                separator={markupSeparator}
                position={markupPosition}
                onComplete={handleMarkupComplete}
                onError={handleMarkupError}
                language={language}
              />
            </div>
          )}
        </div>
      )}

      <div style={styles.divider} />

      {/* Olemasolev export nupud (näide) */}
      <div style={styles.section}>
        <button style={{ ...styles.btn, background: "#1E88E5" }}>📋 {language === "et" ? "Clipboard" : "Clipboard"}</button>
        <button style={{ ...styles.btn, background: "#4CAF50" }}>📄 CSV</button>
        <button style={{ ...styles.btn, background: "#FF9800" }}>📊 Excel</button>
      </div>
    </div>
  );
}

// ====================
// STIILE (Kõik inline)
// ====================
const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 12, padding: 12, background: "#fff", borderRadius: 6 },
  section: { display: "flex", flexDirection: "column", gap: 8 },
  labelTop: { fontSize: 11, fontWeight: 500, opacity: 0.75 },
  columnsList: { border: "1px solid #e6eaf0", borderRadius: 6, padding: 8, background: "#fafbfc", minHeight: 60 },
  placeholder: { fontSize: 10, opacity: 0.5, fontStyle: "italic" },
  divider: { height: 1, background: "#e6eaf0", margin: "8px 0" },
  markupToggleBtn: {
    padding: "8px 12px", fontSize: 12, fontWeight: 500, background: "#ff9800", color: "#fff", border: "none", borderRadius: 6,
    cursor: "pointer", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between",
  },
  badge: { background: "rgba(255,255,255,0.3)", padding: "2px 8px", borderRadius: 3, fontSize: 10, fontWeight: 600 },
  markupPanel: { border: "1px solid #ff9800", borderRadius: 6, padding: 12, background: "#fffbf0", display: "flex", flexDirection: "column", gap: 12 },
  step: { display: "flex", flexDirection: "column", gap: 8, padding: 8, border: "1px solid #e6eaf0", borderRadius: 4, background: "#fff" },
  stepTitle: { fontSize: 12, fontWeight: 600, margin: 0, marginBottom: 4, color: "#0a3a67" },
  btn: { padding: "8px 12px", fontSize: 11, fontWeight: 500, background: "#0a3a67", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
  // MarkupFieldDiscovery stiilid
  loadingText: { fontSize: 11, opacity: 0.7, marginTop: 4, marginBottom: 4 },
  emptyText: { fontSize: 11, opacity: 0.7, padding: "8px", color: "#f44336", marginTop: 4, marginBottom: 4 },
  fieldsList: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflow: "auto", border: "1px solid #e6eaf0", borderRadius: 6, padding: 8 },
  fieldItem: { padding: 8, border: "1px solid #eef1f6", borderRadius: 4, background: "#fafbfc" },
  fieldHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  fieldName: { fontSize: 11, fontWeight: 500, fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  frequencyBadge: { fontSize: 9, fontWeight: 600, color: "#fff", padding: "2px 6px", borderRadius: 3, marginLeft: 4, whiteSpace: "nowrap" },
  samplesRow: { display: "flex", gap: 4, alignItems: "flex-start", marginBottom: 4, fontSize: 10 },
  sampleLabel: { opacity: 0.7, whiteSpace: "nowrap", fontWeight: 500 },
  samples: { display: "flex", gap: 4, flexWrap: "wrap", flex: 1 },
  sample: { background: "#e7f3ff", padding: "2px 6px", borderRadius: 3, fontSize: 9, fontFamily: "monospace", color: "#0a3a67" },
  statsRow: { display: "flex", gap: 8, fontSize: 9, opacity: 0.7 },
  stat: { whiteSpace: "nowrap" },
  // MarkupFieldSelector stiilid
  container: { display: "flex", flexDirection: "column", gap: 8 }, // Selector container
  controlsRow: { display: "flex", gap: 4 },
  smallBtn: { padding: "4px 8px", fontSize: 10, border: "1px solid #cfd6df", borderRadius: 4, background: "#fff", cursor: "pointer", flex: 1 },
  fieldsList: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflow: "auto", border: "1px solid #e6eaf0", borderRadius: 6, padding: 8, background: "#fafbfc" },
  checkRow: { display: "flex", alignItems: "center", gap: 6, padding: 6, borderRadius: 4, border: "1px solid #eef1f6", background: "#fff", cursor: "pointer", fontSize: 11 },
  checkbox: { width: 16, height: 16, cursor: "pointer", flexShrink: 0 },
  checkLabel: { fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  configSection: { display: "flex", flexDirection: "column", gap: 6, padding: 8, border: "1px solid #e6eaf0", borderRadius: 6, background: "#f6f8fb" },
  configRow: { display: "flex", alignItems: "center", gap: 8 },
  configLabel: { fontSize: 11, fontWeight: 500, opacity: 0.75, width: 100, whiteSpace: "nowrap" },
  select: { fontSize: 10, padding: "4px 6px", border: "1px solid #cfd6df", borderRadius: 4, background: "#fff", flex: 1 },
  preview: { display: "flex", flexDirection: "column", gap: 4, padding: 8, border: "1px solid #cfd6df", borderRadius: 6, background: "#f6f8fb" },
  previewLabel: { fontSize: 10, fontWeight: 500, opacity: 0.7 },
  previewBox: { fontSize: 10, fontFamily: "monospace", padding: 6, border: "1px solid #cfd6df", borderRadius: 4, background: "#fff", minHeight: 32, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#0a3a67" },
  // MarkupBuilder stiilid
  container: { display: "flex", flexDirection: "column", gap: 6, padding: 8 },
  applyBtn: { padding: "8px 12px", borderRadius: 6, border: "none", background: "#ff9800", color: "#fff", fontWeight: 500, fontSize: 11, cursor: "pointer" },
  loadingText: { fontSize: 10, opacity: 0.7, textAlign: "center" },
};

export default ExportTab;
