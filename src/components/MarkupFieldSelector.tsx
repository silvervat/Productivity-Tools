import { useCallback, useState } from "react";
import type { DiscoveredField } from "./MarkupFieldDiscovery";

interface Props {
  discoveredFields: DiscoveredField[];
  onSelectionChange: (selectedFields: DiscoveredField[]) => void;
  language: "et" | "en";
}

const translations = {
  et: {
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

const t = (key: keyof typeof translations.et, language: "et" | "en") =>
  translations[language][key];

export function MarkupFieldSelector({
  discoveredFields,
  onSelectionChange,
  language,
}: Props) {
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const [separator, setSeparator] = useState<"comma" | "newline">("comma");
  const [position, setPosition] = useState<"center" | "top">("center");

  const handleToggleField = useCallback(
    (setName: string, propertyName: string) => {
      const key = `${setName}|${propertyName}`;
      const newSet = new Set(selectedSet);

      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }

      setSelectedSet(newSet);

      // Tagasta valitud fields
      const selected = discoveredFields.filter((f) =>
        newSet.has(`${f.setName}|${f.propertyName}`)
      );
      onSelectionChange(selected);
    },
    [selectedSet, discoveredFields, onSelectionChange]
  );

  const handleSelectAll = useCallback(() => {
    const allKeys = new Set(
      discoveredFields.map((f) => `${f.setName}|${f.propertyName}`)
    );
    setSelectedSet(allKeys);
    onSelectionChange(discoveredFields);
  }, [discoveredFields, onSelectionChange]);

  const handleDeselectAll = useCallback(() => {
    setSelectedSet(new Set());
    onSelectionChange([]);
  }, [onSelectionChange]);

  // Generaadi eelvaade
  const previewText = Array.from(selectedSet)
    .slice(0, 3)
    .map((key) => {
      const [setName, propName] = key.split("|");
      const field = discoveredFields.find(
        (f) => f.setName === setName && f.propertyName === propName
      );
      return field?.valueSamples[0] || "N/A";
    })
    .join(separator === "comma" ? ", " : "\n");

  return (
    <div style={styles.container}>
      {/* Nupud */}
      <div style={styles.controlsRow}>
        <button
          onClick={handleSelectAll}
          style={styles.smallBtn}
          title={t("selectAll", language)}
        >
          ✓ {t("selectAll", language)}
        </button>
        <button
          onClick={handleDeselectAll}
          style={styles.smallBtn}
          title={t("deselectAll", language)}
        >
          ✕ {t("deselectAll", language)}
        </button>
      </div>

      {/* Väljad */}
      <div style={styles.fieldsList}>
        {discoveredFields.map((field) => {
          const key = `${field.setName}|${field.propertyName}`;
          const isSelected = selectedSet.has(key);

          return (
            <label key={key} style={styles.checkRow}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() =>
                  handleToggleField(field.setName, field.propertyName)
                }
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

      {/* Konfiguraatsioon */}
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

      {/* Eelvaade */}
      {selectedSet.size > 0 && (
        <div style={styles.preview}>
          <div style={styles.previewLabel}>{t("previewLabel", language)}</div>
          <div style={styles.previewBox}>{previewText || "..."}</div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  controlsRow: {
    display: "flex",
    gap: 4,
  },
  smallBtn: {
    padding: "4px 8px",
    fontSize: 10,
    border: "1px solid #cfd6df",
    borderRadius: 4,
    background: "#fff",
    cursor: "pointer",
    flex: 1,
  },
  fieldsList: {
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
  checkbox: {
    width: 16,
    height: 16,
    cursor: "pointer",
    flexShrink: 0,
  },
  checkLabel: {
    fontFamily: "monospace",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  frequencyBadge: {
    fontSize: 9,
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: 3,
    whiteSpace: "nowrap",
    flexShrink: 0,
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
  configRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
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
  previewLabel: {
    fontSize: 10,
    fontWeight: 500,
    opacity: 0.7,
  },
  previewBox: {
    fontSize: 10,
    fontFamily: "monospace",
    padding: 6,
    border: "1px solid #cfd6df",
    borderRadius: 4,
    background: "#fff",
    minHeight: 32,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    color: "#0a3a67",
  },
};

export default MarkupFieldSelector;
