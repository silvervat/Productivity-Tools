// ============================================
// ADVANCED MARKUP BUILDER - SINGLE FILE VERSION
// Kõik komponendid ühes failis - pole import errore
// ============================================

import { useCallback, useEffect, useState } from "react";
import type { ObjectProperties, WorkspaceAPI } from "trimble-connect-workspace-api";

// ====================
// TÜÜBID
// ====================
interface DiscoveredField {
  setName: string;
  propertyName: string;
  displayName: string;
  frequency: number;
  valueSamples: string[];
  objectsWithValue: number;
}

interface ExportTabProps {
  api: WorkspaceAPI;
  exportData: ObjectProperties[];
  language: "et" | "en";
  addLog: (message: string) => void;
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Box3 {
  min: Vector3;
  max: Vector3;
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

const t = (key: string, language: "et" | "en") =>
  translations[language][key as keyof typeof translations.et];

// ====================
// HELPER FUNKTSIOONID
// ====================
function getMidPoint(bBox: Box3): Vector3 {
  return {
    x: (bBox.min.x + bBox.max.x) / 2.0,
    y: (bBox.min.y + bBox.max.y) / 2.0,
    z: (bBox.min.z + bBox.max.z) / 2.0,
  };
}

// ====================
// CUSTOM HOOK: useMarkupFieldDiscovery
// ====================
function useMarkupFieldDiscovery(objects: ObjectProperties[]) {
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
            const setNameStr = (propSet as Record<string, unknown>).name as string;
            const propNameStr = (prop as Record<string, unknown>).name as string;
            const propValueStr = String(
              (prop as Record<string, unknown>).value || ""
            ).trim();

            const key = `${setNameStr}|${propNameStr}`;

            if (!fieldMap.has(key)) {
              fieldMap.set(key, {
                frequency: 0,
                samples: new Set(),
                objectsWithValue: 0,
              });
            }

            const field = fieldMap.get(key)!;
            field.frequency++;

            if (field.samples.size < 2 && propValueStr.length > 0) {
              field.samples.add(propValueStr);
            }

            if (propValueStr.length > 0) {
              field.objectsWithValue++;
            }
          }
        }
      }

      const discoveredFieldsArray: DiscoveredField[] = Array.from(
        fieldMap.entries()
      ).map(([key, data]) => {
        const [setName, propertyName] = key.split("|");
        const frequency = Math.round(
          (data.objectsWithValue / objects.length) * 100
        );

        return {
          setName,
          propertyName,
          displayName: `${setName} > ${propertyName}`,
          frequency,
          valueSamples: Array.from(data.samples),
          objectsWithValue: data.objectsWithValue,
        };
      });

      setFields(discoveredFieldsArray.sort((a, b) => b.frequency - a.frequency));
      setIsLoading(false);
    };

    discoverFields();
  }, [objects]);

  return { fields, isLoading };
}

// ====================
// KOMPONENT 1: MarkupFieldDiscovery
// ====================
interface MarkupFieldDiscoveryProps {
  fields: DiscoveredField[];
  isLoading: boolean;
  language: "et" | "en";
}

function MarkupFieldDiscovery({
  fields,
  isLoading,
  language,
}: MarkupFieldDiscoveryProps) {
  if (isLoading) {
    return (
      <div style={styles.discoveryLoadingText}>
        {t("discoveringFields", language)}
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div style={styles.emptyText}>{t("noFields", language)}</div>
    );
  }

  return (
    <div style={styles.discoveryFieldsList}>
      {fields.map((field, idx) => (
        <div key={idx} style={styles.fieldItem}>
          <div style={styles.fieldHeader}>
            <span style={styles.fieldName}>{field.displayName}</span>
            <span
              style={{
                ...styles.frequencyBadge,
                background: field.frequency > 75 ? "#4CAF50" : "#FFC107",
              }}
            >
              {field.frequency}%
            </span>
          </div>

          <div style={styles.samplesRow}>
            <span style={styles.sampleLabel}>
              {t("samples", language)}:
            </span>
            <div style={styles.samples}>
              {field.valueSamples.map((sample, sIdx) => (
                <span key={sIdx} style={styles.sample}>
                  {sample.substring(0, 25)}
                  {sample.length > 25 ? "…" : ""}
                </span>
              ))}
            </div>
          </div>

          <div style={styles.statsRow}>
            <span style={styles.stat}>
              {t("totalObjects", language)}: {field.objectsWithValue}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ====================
// KOMPONENT 2: MarkupFieldSelector
// ====================
interface MarkupFieldSelectorProps {
  discoveredFields: DiscoveredField[];
  onSelectionChange: (fields: DiscoveredField[]) => void;
  onSeparatorChange: (sep: "comma" | "newline") => void;
  onPositionChange: (pos: "center" | "top") => void;
  language: "et" | "en";
}

function MarkupFieldSelector({
  discoveredFields,
  onSelectionChange,
  onSeparatorChange,
  onPositionChange,
  language,
}: MarkupFieldSelectorProps) {
  const [selectedFields, setSelectedFields] = useState<DiscoveredField[]>([]);
  const [separator, setSeparator] = useState<"comma" | "newline">("comma");
  const [position, setPosition] = useState<"center" | "top">("center");

  const handleToggleField = useCallback(
    (field: DiscoveredField) => {
      const isSelected = selectedFields.some(
        (f) =>
          f.setName === field.setName && f.propertyName === field.propertyName
      );

      if (isSelected) {
        const updated = selectedFields.filter(
          (f) =>
            !(
              f.setName === field.setName &&
              f.propertyName === field.propertyName
            )
        );
        setSelectedFields(updated);
        onSelectionChange(updated);
      } else {
        const updated = [...selectedFields, field];
        setSelectedFields(updated);
        onSelectionChange(updated);
      }
    },
    [selectedFields, onSelectionChange]
  );

  const handleSelectAll = useCallback(() => {
    setSelectedFields(discoveredFields);
    onSelectionChange(discoveredFields);
  }, [discoveredFields, onSelectionChange]);

  const handleDeselectAll = useCallback(() => {
    setSelectedFields([]);
    onSelectionChange([]);
  }, [onSelectionChange]);

  const handleSeparatorChange = (newSep: "comma" | "newline") => {
    setSeparator(newSep);
    onSeparatorChange(newSep);
  };

  const handlePositionChange = (newPos: "center" | "top") => {
    setPosition(newPos);
    onPositionChange(newPos);
  };

  const previewSeparator = separator === "comma" ? ", " : "\n";
  const previewText = selectedFields
    .map((f) => f.valueSamples[0] || f.propertyName)
    .join(previewSeparator);

  return (
    <div style={styles.selectorContainer}>
      <div style={styles.controlsRow}>
        <button style={styles.smallBtn} onClick={handleSelectAll}>
          ✓ {t("selectAll", language)}
        </button>
        <button style={styles.smallBtn} onClick={handleDeselectAll}>
          ✗ {t("deselectAll", language)}
        </button>
      </div>

      <div style={styles.selectorFieldsList}>
        {discoveredFields.map((field, idx) => {
          const isSelected = selectedFields.some(
            (f) =>
              f.setName === field.setName &&
              f.propertyName === field.propertyName
          );

          return (
            <label
              key={idx}
              style={styles.checkRow}
              onClick={() => handleToggleField(field)}
            >
              <input
                type="checkbox"
                checked={isSelected}
                style={styles.checkbox}
                readOnly
              />
              <span style={styles.checkLabel}>{field.displayName}</span>
            </label>
          );
        })}
      </div>

      <div style={styles.configSection}>
        <div style={styles.configRow}>
          <label style={styles.configLabel}>{t("separator", language)}</label>
          <select
            value={separator}
            onChange={(e) =>
              handleSeparatorChange(e.target.value as "comma" | "newline")
            }
            style={styles.select}
          >
            <option value="comma">{t("comma", language)}</option>
            <option value="newline">{t("newline", language)}</option>
          </select>
        </div>

        <div style={styles.configRow}>
          <label style={styles.configLabel}>{t("position", language)}</label>
          <select
            value={position}
            onChange={(e) =>
              handlePositionChange(e.target.value as "center" | "top")
            }
            style={styles.select}
          >
            <option value="center">{t("center", language)}</option>
            <option value="top">{t("top", language)}</option>
          </select>
        </div>
      </div>

      <div style={styles.preview}>
        <label style={styles.previewLabel}>{t("previewLabel", language)}</label>
        <div style={styles.previewBox}>{previewText || "(tühi)"}</div>
      </div>
    </div>
  );
}

// ====================
// KOMPONENT 3: MarkupBuilder
// ====================
interface MarkupBuilderProps {
  api: WorkspaceAPI;
  selectedObjects: ObjectProperties[];
  selectedFields: DiscoveredField[];
  separator: "comma" | "newline";
  position: "center" | "top";
  onComplete: (markupIds: number[], message: string) => void;
  onError: (errorMessage: string) => void;
  language: "et" | "en";
}

function MarkupBuilder({
  api,
  selectedObjects,
  selectedFields,
  separator,
  onComplete,
  onError,
  language,
}: MarkupBuilderProps) {
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyMarkup = useCallback(async () => {
    if (selectedFields.length === 0 || selectedObjects.length === 0) {
      onError(t("noSelection", language));
      return;
    }

    setIsApplying(true);
    const appliedMarkupIds: number[] = [];

    try {
      const separatorStr = separator === "comma" ? ", " : "\n";

      for (const obj of selectedObjects) {
        try {
          const markupText = selectedFields
            .map((field) => {
              const propSet = (obj.properties || []).find(
                (p) => (p as Record<string, unknown>).name === field.setName
              );
              if (!propSet) return field.propertyName;

              const prop = (propSet.properties || []).find(
                (p) => (p as Record<string, unknown>).name === field.propertyName
              );
              return String((prop as Record<string, unknown>)?.value || "").trim();
            })
            .filter((v) => v.length > 0)
            .join(separatorStr);

          if (markupText) {
            // Trimble API kutse markup rakendamiseks
            // NB: Siin on placeholder - tegelik implementatsioon sõltub Trimble API-st
            console.log(`Markup for object: ${markupText}`);
            appliedMarkupIds.push(obj.id);
          }
        } catch (err) {
          console.error("Error applying markup to object:", err);
        }
      }

      const message = t("success", language).replace(
        "{count}",
        String(appliedMarkupIds.length)
      );
      onComplete(appliedMarkupIds, message);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      onError(
        t("error", language).replace("{error}", errorMsg)
      );
    } finally {
      setIsApplying(false);
    }
  }, [selectedObjects, selectedFields, separator, onComplete, onError, language]);

  return (
    <div style={styles.builderContainer}>
      <button
        onClick={handleApplyMarkup}
        disabled={isApplying || selectedFields.length === 0}
        style={{
          ...styles.applyBtn,
          opacity: isApplying || selectedFields.length === 0 ? 0.5 : 1,
          cursor:
            isApplying || selectedFields.length === 0
              ? "not-allowed"
              : "pointer",
        }}
      >
        {isApplying ? t("applying", language) : t("apply", language)}
      </button>
      {isApplying && (
        <div style={styles.builderLoadingText}>{t("extracting", language)}</div>
      )}
    </div>
  );
}

// ====================
// PEAMINE KOMPONENT: AdvancedMarkupBuilder
// ====================
export function AdvancedMarkupBuilder({
  api,
  exportData,
  language,
  addLog,
}: ExportTabProps) {
  const [showMarkupBuilder, setShowMarkupBuilder] = useState(false);
  const [selectedMarkupFields, setSelectedMarkupFields] = useState<
    DiscoveredField[]
  >([]);
  const [markupSeparator, setMarkupSeparator] = useState<"comma" | "newline">(
    "comma"
  );

  const { fields: discoveredFields, isLoading } =
    useMarkupFieldDiscovery(exportData);

  const handleToggleMarkupBuilder = useCallback(() => {
    setShowMarkupBuilder(!showMarkupBuilder);
    if (!showMarkupBuilder && exportData.length === 0) {
      addLog(t("noExportData", language));
    }
  }, [showMarkupBuilder, exportData, language, addLog]);

  const handleMarkupComplete = useCallback(
    (_markupIds: number[], message: string) => {
      addLog(message);
    },
    [addLog]
  );

  const handleMarkupError = useCallback(
    (errorMessage: string) => {
      addLog(errorMessage);
    },
    [addLog]
  );

  return (
    <div style={styles.container}>
      {/* Olemasolev export loogika (näide) */}
      <div style={styles.section}>
        <button
          style={styles.btn}
          onClick={() => addLog("📊 Uuendamine käivitas...")}
        >
          🔄 {t("refreshData", language)}
        </button>
      </div>
      <div style={styles.section}>
        <label style={styles.labelTop}>
          {language === "et" ? "Veerud:" : "Columns:"}
        </label>
        <div style={styles.columnsList}>
          <span style={styles.placeholder}>
            {language === "et"
              ? "Siin oleks veergude selector..."
              : "Your column selector here..."}
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
            <MarkupFieldDiscovery
              fields={discoveredFields}
              isLoading={isLoading}
              language={language}
            />
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
                onPositionChange={() => {
                  // Position handling here
                }}
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
                position="center"
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
        <button style={{ ...styles.btn, background: "#1E88E5" }}>
          📋 {language === "et" ? "Clipboard" : "Clipboard"}
        </button>
        <button style={{ ...styles.btn, background: "#4CAF50" }}>
          📄 CSV
        </button>
        <button style={{ ...styles.btn, background: "#FF9800" }}>
          📊 Excel
        </button>
      </div>
    </div>
  );
}

// ====================
// STIILE
// ====================
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 12,
    background: "#fff",
    borderRadius: 6,
  },
  section: { display: "flex", flexDirection: "column", gap: 8 },
  labelTop: { fontSize: 11, fontWeight: 500, opacity: 0.75 },
  columnsList: {
    border: "1px solid #e6eaf0",
    borderRadius: 6,
    padding: 8,
    background: "#fafbfc",
    minHeight: 60,
  },
  placeholder: { fontSize: 10, opacity: 0.5, fontStyle: "italic" },
  divider: { height: 1, background: "#e6eaf0", margin: "8px 0" },
  markupToggleBtn: {
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 500,
    background: "#ff9800",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  badge: {
    background: "rgba(255,255,255,0.3)",
    padding: "2px 8px",
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 600,
  },
  markupPanel: {
    border: "1px solid #ff9800",
    borderRadius: 6,
    padding: 12,
    background: "#fffbf0",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  step: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 8,
    border: "1px solid #e6eaf0",
    borderRadius: 4,
    background: "#fff",
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: 600,
    margin: 0,
    marginBottom: 4,
    color: "#0a3a67",
  },
  btn: {
    padding: "8px 12px",
    fontSize: 11,
    fontWeight: 500,
    background: "#0a3a67",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  discoveryLoadingText: { fontSize: 11, opacity: 0.7, marginTop: 4, marginBottom: 4 },
  emptyText: {
    fontSize: 11,
    opacity: 0.7,
    padding: "8px",
    color: "#f44336",
    marginTop: 4,
    marginBottom: 4,
  },
  discoveryFieldsList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    maxHeight: 320,
    overflow: "auto",
    border: "1px solid #e6eaf0",
    borderRadius: 6,
    padding: 8,
  },
  fieldItem: { padding: 8, border: "1px solid #eef1f6", borderRadius: 4, background: "#fafbfc" },
  fieldHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  fieldName: {
    fontSize: 11,
    fontWeight: 500,
    fontFamily: "monospace",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  frequencyBadge: {
    fontSize: 9,
    fontWeight: 600,
    color: "#fff",
    padding: "2px 6px",
    borderRadius: 3,
    marginLeft: 4,
    whiteSpace: "nowrap",
  },
  samplesRow: {
    display: "flex",
    gap: 4,
    alignItems: "flex-start",
    marginBottom: 4,
    fontSize: 10,
  },
  sampleLabel: { opacity: 0.7, whiteSpace: "nowrap", fontWeight: 500 },
  samples: { display: "flex", gap: 4, flexWrap: "wrap", flex: 1 },
  sample: {
    background: "#e7f3ff",
    padding: "2px 6px",
    borderRadius: 3,
    fontSize: 9,
    fontFamily: "monospace",
    color: "#0a3a67",
  },
  statsRow: { display: "flex", gap: 8, fontSize: 9, opacity: 0.7 },
  stat: { whiteSpace: "nowrap" },
  selectorContainer: { display: "flex", flexDirection: "column", gap: 8 },
  controlsRow: { display: "flex", gap: 4 },
  smallBtn: {
    padding: "4px 8px",
    fontSize: 10,
    border: "1px solid #cfd6df",
    borderRadius: 4,
    background: "#fff",
    cursor: "pointer",
    flex: 1,
  },
  selectorFieldsList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxHeight: 240,
    overflow: "auto",
    border: "1px solid #e6eaf0",
    borderRadius: 6,
    padding: 8,
    background: "#fafbfc",
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: 6,
    borderRadius: 4,
    border: "1px solid #eef1f6",
    background: "#fff",
    cursor: "pointer",
    fontSize: 11,
  },
  checkbox: { width: 16, height: 16, cursor: "pointer", flexShrink: 0 },
  checkLabel: {
    fontFamily: "monospace",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  configSection: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 8,
    border: "1px solid #e6eaf0",
    borderRadius: 6,
    background: "#f6f8fb",
  },
  configRow: { display: "flex", alignItems: "center", gap: 8 },
  configLabel: {
    fontSize: 11,
    fontWeight: 500,
    opacity: 0.75,
    width: 100,
    whiteSpace: "nowrap",
  },
  select: {
    fontSize: 10,
    padding: "4px 6px",
    border: "1px solid #cfd6df",
    borderRadius: 4,
    background: "#fff",
    flex: 1,
  },
  preview: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: 8,
    border: "1px solid #cfd6df",
    borderRadius: 6,
    background: "#f6f8fb",
  },
  previewLabel: { fontSize: 10, fontWeight: 500, opacity: 0.7 },
  previewBox: {
    fontSize: 10,
    fontFamily: "monospace",
    padding: 6,
    border: "1px solid #cfd6df",
    borderRadius: 4,
    background: "#fff",
    minHeight: 32,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
    color: "#0a3a67",
  },
  builderContainer: { display: "flex", flexDirection: "column", gap: 6, padding: 8 },
  applyBtn: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "none",
    background: "#ff9800",
    color: "#fff",
    fontWeight: 500,
    fontSize: 11,
    cursor: "pointer",
  },
  builderLoadingText: { fontSize: 10, opacity: 0.7, textAlign: "center" as const },
};

export default AdvancedMarkupBuilder;
