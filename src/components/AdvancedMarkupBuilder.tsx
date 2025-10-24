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

// Helper function to flatten object properties (inspired by Assembly Exporter)
function flattenObject(obj: any, prefix: string = ""): Record<string, string> {
  const result: Record<string, string> = {};

  function flatten(o: any, p: string) {
    if (o === null || o === undefined) return;
    
    if (Array.isArray(o)) {
      o.forEach((item, i) => flatten(item, `${p}[${i}]`));
    } else if (typeof o === "object") {
      Object.entries(o).forEach(([key, val]) => {
        const newKey = p ? `${p}.${key}` : key;
        if (typeof val === "object" && val !== null) {
          flatten(val, newKey);
        } else {
          result[newKey] = String(val || "");
        }
      });
    } else {
      result[p] = String(o || "");
    }
  }

  flatten(obj, prefix);
  return result;
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
      // Get selected objects from 3D view
      const selection = await api.viewer.getSelection();
      if (!selection || selection.length === 0) {
        setDiscoveryError(t.selectObjects);
        setIsDiscovering(false);
        return;
      }

      const fieldsMap: { [key: string]: PropertyField } = {};
      let fieldCount = 0;

      // Process each selected item - similar to Assembly Exporter logic
      for (const selectionItem of selection) {
        if (!selectionItem.objectRuntimeIds) continue;

        const objectRuntimeIds = Array.isArray(selectionItem.objectRuntimeIds)
          ? selectionItem.objectRuntimeIds
          : [selectionItem.objectRuntimeIds];

        if (objectRuntimeIds.length === 0) continue;

        try {
          // Get full object properties using correct API (like Assembly Exporter does)
          const fullProperties = await (api.viewer as any).getObjectProperties?.(
            selectionItem as any, // Pass entire selection item as modelId
            objectRuntimeIds,
            { includeHidden: true }
          );

          if (fullProperties) {
            // Process first object as sample
            const firstProps = Array.isArray(fullProperties) 
              ? fullProperties[0] 
              : fullProperties;

            if (firstProps?.properties && typeof firstProps.properties === 'object') {
              const flattened = flattenObject(firstProps.properties);

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
        } catch (err: any) {
          console.warn(`Property fetch error:`, err.message);
          // Fallback: try simple getObjects
          try {
            const objects = await (api.viewer as any).getObjects?.({
              ids: objectRuntimeIds,
            });

            if (Array.isArray(objects) && objects.length > 0) {
              const firstObj = objects[0];
              const basicProps = ['name', 'type', 'guid', 'code', 'description'];

              for (const propName of basicProps) {
                const value = (firstObj as any)?.[propName];
                if (value && String(value).trim().length > 0) {
                  if (!fieldsMap[propName]) {
                    fieldsMap[propName] = {
                      name: propName,
                      value: String(value).substring(0, 100),
                      selected: fieldCount < 3,
                    };
                    fieldCount++;
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`Fallback failed:`, e);
          }
        }
      }

      // If no fields found, add some default ones
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

      // For each selected object
      for (const selectionItem of selection) {
        if (!selectionItem.objectRuntimeIds) continue;

        try {
          const objectRuntimeIds = selectionItem.objectRuntimeIds.map((id: any) =>
            typeof id === 'string' ? parseInt(id) : id
          ).filter((n: number) => Number.isFinite(n));

          if (objectRuntimeIds.length === 0) continue;

          // Get properties using correct API call
          const fullProperties = await (api.viewer as any).getObjectProperties?.(
            selectionItem as any,
            objectRuntimeIds,
            { includeHidden: true }
          );

          if (!fullProperties) continue;

          // Process each object
          for (let idx = 0; idx < objectRuntimeIds.length; idx++) {
            const props = Array.isArray(fullProperties) ? fullProperties[idx] : fullProperties;
            if (!props?.properties) continue;

            const flattened = flattenObject(props.properties);
            const values = selectedFields
              .map((field) => flattened[field.name] || field.value)
              .filter((v) => v && v.length > 0);

            if (values.length === 0) continue;

            const separator = useLineBreak ? "\n" : markupSeparator;
            const markupText = markupPrefix + values.join(separator);

            try {
              // Add markup to object
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
              // Silent fail - continue with next object
              continue;
            }
          }
        } catch (err: any) {
          console.warn(`Markup error:`, err.message);
          continue;
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

    // Condense results
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

    // Copy to clipboard
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
