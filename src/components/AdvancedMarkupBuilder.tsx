import { useEffect, useRef, useState, useCallback, memo } from "react";
import * as XLSX from "xlsx";
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import "./AdvancedMarkupBuilder.css";

type Language = "et" | "en";
type MarkupLayout = "inline" | "lines";
type MarkupResult = { text: string; count: number; status: "found" | "partial" | "notfound" };

interface PropertyField {
  name: string;
  value: string;
  selected: boolean;
}

const translations = {
  et: {
    title: "MARKUP KOOSTE EHITAJA",
    discoverFields: "🔍 TUVASTA ANDME VÄLJAD",
    selectedFields: "Valitud väljad:",
    noFieldsSelected: "❌ Palun vali vähemalt üks väli!",
    separator: "Eraldaja:",
    prefix: "Eesliide:",
    layout: "Ridade asetamine:",
    layoutInline: "Inline (eraldajaga)",
    layoutLines: "Read üksteise all",
    useLineBreak: "Kasuta reavahte",
    applyMarkup: "➕ LISA MARKUP",
    condenseResults: "🔗 KOONDA JA KOPEERI",
    results: "Tulemused:",
    noResults: "Tulemusi pole",
    notFound: "Ei leitud:",
    selectObjects: "⚠️ Palun vali objektid 3D vaates",
    discovering: "Tuvastan väljasid...",
    applying: "Lisastan markup...",
    success: "✅ Markup lisatud",
    error: "❌ Viga",
    fieldCount: "{count} väli",
    resultCount: "{count} tulemust",
  },
  en: {
    title: "ADVANCED MARKUP BUILDER",
    discoverFields: "🔍 DISCOVER FIELDS",
    selectedFields: "Selected fields:",
    noFieldsSelected: "❌ Please select at least one field!",
    separator: "Separator:",
    prefix: "Prefix:",
    layout: "Row layout:",
    layoutInline: "Inline (with separator)",
    layoutLines: "Lines (stacked)",
    useLineBreak: "Use line breaks",
    applyMarkup: "➕ ADD MARKUP",
    condenseResults: "🔗 CONDENSE & COPY",
    results: "Results:",
    noResults: "No results",
    notFound: "Not found:",
    selectObjects: "⚠️ Please select objects in 3D view",
    discovering: "Discovering fields...",
    applying: "Applying markup...",
    success: "✅ Markup applied",
    error: "❌ Error",
    fieldCount: "{count} field",
    resultCount: "{count} results",
  },
};

const SEPARATORS = [
  { label: " | ", value: " | " },
  { label: " - ", value: " - " },
  { label: " , ", value: " , " },
  { label: " . ", value: " . " },
  { label: " : ", value: " : " },
  { label: " / ", value: " / " },
  { label: " | ", value: " | " },
  { label: "\\n (new line)", value: "\n" },
];

export default function AdvancedMarkupBuilder({
  api,
  language = "et",
}: {
  api: WorkspaceAPI.WorkspaceAPI | undefined;
  language?: Language;
}) {
  const t = translations[language];
  const [discoveredFields, setDiscoveredFields] = useState<{ [key: string]: PropertyField }>({});
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [markupPrefix, setMarkupPrefix] = useState("");
  const [markupSeparator, setMarkupSeparator] = useState(" | ");
  const [useLineBreak, setUseLineBreak] = useState(false);
  const [markupLayout, setMarkupLayout] = useState<MarkupLayout>("inline");
  const [markupResults, setMarkupResults] = useState<MarkupResult[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const previousMarkupIds = useRef<string[]>([]);

  const t_format = (template: string, values: { [key: string]: any }): string => {
    return template.replace(/{(\w+)}/g, (_, key) => String(values[key] ?? ""));
  };

  const discoverFields = useCallback(async () => {
    if (!api) {
      setDiscoveryError("API not available");
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

      const firstSelection = selection[0];
      if (!firstSelection.objectRuntimeIds || firstSelection.objectRuntimeIds.length === 0) {
        setDiscoveryError(t.selectObjects);
        setIsDiscovering(false);
        return;
      }

      // Hangi objekti andmed
      const objectId = firstSelection.objectRuntimeIds[0];
      const objects = await api.dataTable.getRows([objectId]);

      if (objects && objects.length > 0) {
        const obj = objects[0];
        const fields: { [key: string]: PropertyField } = {};

        // Lahenda kõik väljad
        Object.entries(obj).forEach(([key, value]) => {
          if (value && typeof value === "string" && value.trim().length > 0) {
            fields[key] = {
              name: key,
              value: String(value),
              selected: false,
            };
          }
        });

        setDiscoveredFields(fields);
        if (Object.keys(fields).length === 0) {
          setDiscoveryError("Väljasid ei leitud");
        }
      }
    } catch (err: any) {
      setDiscoveryError(err?.message || "Viga väljasid tuvastaes");
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
    if (!api) {
      setDiscoveryError("API not available");
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
    setMarkupResults([]);

    try {
      const selection = await api.viewer.getSelection();
      if (!selection || selection.length === 0) {
        setDiscoveryError(t.selectObjects);
        setIsApplying(false);
        return;
      }

      // Eemalda vanad markup'id
      if (previousMarkupIds.current.length > 0) {
        await api.markup.removeMarkups(previousMarkupIds.current);
        previousMarkupIds.current = [];
      }

      // Hangi kõik objektid
      const firstSelection = selection[0];
      const objectIds = firstSelection.objectRuntimeIds || [];

      const objects = await api.dataTable.getRows(objectIds);
      const results: MarkupResult[] = [];
      const newMarkupIds: string[] = [];

      for (const obj of objects) {
        // Konstrueeri markup tekst
        const values = selectedFields
          .map((field) => {
            const value = (obj as any)[field.name];
            return value ? String(value).trim() : "";
          })
          .filter((v) => v.length > 0);

        if (values.length === 0) continue;

        const separator = useLineBreak ? "\n" : markupSeparator;
        const markupText = markupPrefix + values.join(separator);

        // Lisa markup objektile
        const markupId = await api.markup.addMarkup({
          label: markupText,
          objectId: (obj as any).GUID || (obj as any).id,
        });

        if (markupId) {
          newMarkupIds.push(markupId);
          results.push({
            text: markupText,
            count: 1,
            status: "found",
          });
        }
      }

      previousMarkupIds.current = newMarkupIds;
      setMarkupResults(results);
      setSuccessMessage(
        t_format(t.success, { count: results.length })
      );
    } catch (err: any) {
      setDiscoveryError(err?.message || "Viga markup'i lisamisel");
    } finally {
      setIsApplying(false);
    }
  }, [api, discoveredFields, useLineBreak, markupSeparator, markupPrefix, t, t_format]);

  const condenseAndCopy = useCallback(() => {
    if (markupResults.length === 0) {
      setDiscoveryError("Tulemusi pole");
      return;
    }

    // Koonenda resultaate
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

    // Kopeeri clipboardi
    const text = condensed
      .map((r) => `${r.text} - ${r.count}tk`)
      .join("\n");

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
