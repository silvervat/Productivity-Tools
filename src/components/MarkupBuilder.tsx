import { useCallback, useState } from "react";
import type { ObjectProperties, TextMarkup, WorkspaceAPI } from "trimble-connect-workspace-api";
import type { DiscoveredField } from "./MarkupFieldDiscovery";

interface Props {
  api: WorkspaceAPI;
  selectedObjects: ObjectProperties[];
  selectedFields: DiscoveredField[];
  separator: "comma" | "newline";
  position: "center" | "top";
  onComplete: (markupIds: number[], message: string) => void;
  onError: (error: string) => void;
  language: "et" | "en";
}

const translations = {
  et: {
    applying: "Rakendame markupi…",
    apply: "Rakenda Markup",
    success: "✅ Markup rakendatud {count} objektile",
    error: "❌ Viga markupi rakendamisel: {error}",
    noSelection: "⚠️ Vali väljad ja objektid",
    extracting: "Ekstraheeritakse andmeid…",
  },
  en: {
    applying: "Applying markup…",
    apply: "Apply Markup",
    success: "✅ Markup applied to {count} objects",
    error: "❌ Error applying markup: {error}",
    noSelection: "⚠️ Select fields and objects",
    extracting: "Extracting data…",
  },
};

const t = (key: keyof typeof translations.et, language: "et" | "en") =>
  translations[language][key];

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Box3 {
  min: Vector3;
  max: Vector3;
}

/**
 * Arvuta keskpunkt bounding box-st
 */
function getMidPoint(bBox: Box3): Vector3 {
  return {
    x: (bBox.min.x + bBox.max.x) / 2.0,
    y: (bBox.min.y + bBox.max.y) / 2.0,
    z: (bBox.min.z + bBox.max.z) / 2.0,
  };
}

/**
 * Pärgi property väärtust objektilt (teise arendaja loogika)
 */
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

export function MarkupBuilder({
  api,
  selectedObjects,
  selectedFields,
  separator,
  position,
  onComplete,
  onError,
  language,
}: Props) {
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

      // Iga objekti jaoks
      for (const obj of selectedObjects) {
        if (!obj.modelId) continue;

        // Pärgi bounding box
        const bBoxes = await api.viewer.getObjectBoundingBoxes(
          obj.modelId,
          [obj.id]
        );

        if (!bBoxes || bBoxes.length === 0) continue;

        const bBox = bBoxes[0].boundingBox;
        const midPoint = getMidPoint(bBox);

        // Kogume väljad
        const values: string[] = [];

        for (const field of selectedFields) {
          const value = await getPropertyValue(
            api,
            obj.modelId,
            obj.id,
            field.setName,
            field.propertyName
          );

          if (value) {
            values.push(value);
          }
        }

        // Kui väärtusi on, lisame markupi
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

      // Rakenda kõik markupit korraga
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
      const errorMsg =
        error instanceof Error ? error.message : String(error);
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

      {isApplying && (
        <div style={styles.loadingText}>{t("extracting", language)}</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 8,
  },
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
  loadingText: {
    fontSize: 10,
    opacity: 0.7,
    textAlign: "center",
  },
};

export default MarkupBuilder;
