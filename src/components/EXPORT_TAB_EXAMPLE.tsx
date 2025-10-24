// ============================================
// ASSEMBLY EXPORTER - EXPORT TAB NÄIDE
// Kuidas integreerida Markup Builder
// ============================================

import { useState, useRef, useCallback } from "react";
import { MarkupFieldDiscovery } from "./components/MarkupFieldDiscovery";
import { MarkupFieldSelector } from "./components/MarkupFieldSelector";
import { MarkupBuilder } from "./components/MarkupBuilder";
import type { DiscoveredField } from "./components/MarkupFieldDiscovery";
import type { ObjectProperties, WorkspaceAPI } from "trimble-connect-workspace-api";

interface ExportTabProps {
  api: WorkspaceAPI;
  exportData: ObjectProperties[];
  language: "et" | "en";
  addLog: (message: string) => void;
}

const translations = {
  et: {
    exportData: "Export Data",
    refreshData: "Uuenda andmeid",
    markupBuilder: "Markup Builder",
    step1Fields: "1️⃣ Väljad",
    step2Selection: "2️⃣ Valik",
    step3Apply: "3️⃣ Rakenda",
    noExportData: "Pole andmeid. Tee esmalt otsing ja vali objektid.",
  },
  en: {
    exportData: "Export Data",
    refreshData: "Refresh Data",
    markupBuilder: "Markup Builder",
    step1Fields: "1️⃣ Fields",
    step2Selection: "2️⃣ Selection",
    step3Apply: "3️⃣ Apply",
    noExportData: "No data. Do a search and select objects first.",
  },
};

const t = (key: keyof typeof translations.et, lang: "et" | "en") =>
  translations[lang][key];

/**
 * PEAMINE KOMPONENT
 * Näitab Export tabi uue Markup Builder sektsiooniga
 */
export function ExportTab({
  api,
  exportData,
  language,
  addLog,
}: ExportTabProps) {
  const [showMarkupBuilder, setShowMarkupBuilder] = useState(false);
  const [discoveredFields, setDiscoveredFields] = useState<DiscoveredField[]>([]);
  const [selectedMarkupFields, setSelectedMarkupFields] = useState<DiscoveredField[]>([]);
  const [markupSeparator, setMarkupSeparator] = useState<"comma" | "newline">("comma");
  const [markupPosition, setMarkupPosition] = useState<"center" | "top">("center");

  // Kui kasutaja avab Markup Builder ja on andmeid
  const handleToggleMarkupBuilder = useCallback(() => {
    setShowMarkupBuilder(!showMarkupBuilder);
    
    if (!showMarkupBuilder && exportData.length === 0) {
      addLog(`⚠️ ${t("noExportData", language)}`);
    }
  }, [showMarkupBuilder, exportData, language, addLog]);

  // Kutsutakse kui MarkupFieldDiscovery väljasid leiab
  const handleDiscoveredFields = useCallback((fields: DiscoveredField[]) => {
    setDiscoveredFields(fields);
  }, []);

  // Kutsutakse kui MarkupFieldSelector valikut muudab
  const handleFieldSelection = useCallback((fields: DiscoveredField[]) => {
    setSelectedMarkupFields(fields);
  }, []);

  // Kutsutakse kui MarkupBuilder edukalt lõpeb
  const handleMarkupComplete = useCallback(
    (markupIds: number[], message: string) => {
      addLog(message);
      // Valikuline: Lähtesta state
      // setShowMarkupBuilder(false);
    },
    [addLog]
  );

  // Kutsutakse kui MarkupBuilder error-ga lõpeb
  const handleMarkupError = useCallback(
    (errorMessage: string) => {
      addLog(errorMessage);
    },
    [addLog]
  );

  return (
    <div style={styles.container}>
      {/* ====== OLEMASOLEV EXPORT LOOGIKA ====== */}
      
      {/* Näiteks: Refresh Data nupp */}
      <div style={styles.section}>
        <button
          style={styles.btn}
          onClick={() => addLog("📊 Uuendamine käivitas...")}
        >
          🔄 {t("refreshData", language)}
        </button>
      </div>

      {/* Näiteks: Veergude valik (olemasolev) */}
      <div style={styles.section}>
        <label style={styles.labelTop}>
          {language === "et" ? "Veerud:" : "Columns:"}
        </label>
        <div style={styles.columnsList}>
          {/* Siin oleks teie olemasolev veergude selector */}
          <span style={styles.placeholder}>
            {language === "et"
              ? "Siin oleks veergude selector..."
              : "Your column selector here..."}
          </span>
        </div>
      </div>

      {/* ====== DIVIDER ====== */}
      <div style={styles.divider} />

      {/* ====== UUSS: MARKUP BUILDER ====== */}
      
      {/* Toggle nupp */}
      <button
        style={styles.markupToggleBtn}
        onClick={handleToggleMarkupBuilder}
        disabled={exportData.length === 0}
      >
        {showMarkupBuilder ? "🔽" : "▶️"} {t("markupBuilder", language)}
        <span style={styles.badge}>{selectedMarkupFields.length}</span>
      </button>

      {/* Markup Builder paneel (nähtav kui toggle ON) */}
      {showMarkupBuilder && exportData.length > 0 && (
        <div style={styles.markupPanel}>
          
          {/* STEP 1: Väljad avastamine (automaatne) */}
          <MarkupFieldDiscoveryWrapper
            exportData={exportData}
            language={language}
            onDiscovered={handleDiscoveredFields}
          />

          {/* STEP 2: Väljad valik (checkboxit-ega) */}
          {discoveredFields.length > 0 && (
            <div style={styles.step}>
              <h4 style={styles.stepTitle}>{t("step2Selection", language)}</h4>
              <MarkupFieldSelector
                discoveredFields={discoveredFields}
                onSelectionChange={handleFieldSelection}
                language={language}
              />
            </div>
          )}

          {/* STEP 3: Markup rakendamine */}
          {selectedMarkupFields.length > 0 && (
            <div style={styles.step}>
              <h4 style={styles.stepTitle}>{t("step3Apply", language)}</h4>
              <div style={styles.configRow}>
                <label style={styles.configLabel}>
                  {language === "et" ? "Eraldaja:" : "Separator:"}
                </label>
                <select
                  value={markupSeparator}
                  onChange={(e) => setMarkupSeparator(e.target.value as "comma" | "newline")}
                  style={styles.select}
                >
                  <option value="comma">
                    {language === "et" ? "Koma (\", \")" : "Comma (\", \")"}
                  </option>
                  <option value="newline">
                    {language === "et" ? "Uus rida (\"⏎\")" : "New line (\"⏎\")"}
                  </option>
                </select>
              </div>
              
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

      {/* ====== DIVIDER ====== */}
      <div style={styles.divider} />

      {/* ====== OLEMASOLEV EXPORT NUPUD ====== */}
      
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

/**
 * WRAPPER: MarkupFieldDiscovery
 * Kontrollib komponendi seisundit
 */
function MarkupFieldDiscoveryWrapper({
  exportData,
  language,
  onDiscovered,
}: {
  exportData: ObjectProperties[];
  language: "et" | "en";
  onDiscovered: (fields: DiscoveredField[]) => void;
}) {
  return (
    <div style={styles.step}>
      <h4 style={styles.stepTitle}>
        {language === "et" ? "1️⃣ Väljad" : "1️⃣ Fields"}
      </h4>
      {/* 
        MÄRKUS: MarkupFieldDiscovery on komponent, 
        kuid see loob internal state. 
        
        Soovituslik lahendus: Tee hook-ks useMarkupFieldDiscovery
        ja kutsu siit, et saada fields out-ist. 
        
        Alternatiiv: Kasuta ref + callback pattern
      */}
      <MarkupFieldDiscovery
        selectedObjects={exportData}
        language={language}
      />
    </div>
  );
}

/**
 * STYLED: Export Tab stiilid
 */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 12,
    background: "#fff",
    borderRadius: 6,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  labelTop: {
    fontSize: 11,
    fontWeight: 500,
    opacity: 0.75,
  },
  columnsList: {
    border: "1px solid #e6eaf0",
    borderRadius: 6,
    padding: 8,
    background: "#fafbfc",
    minHeight: 60,
  },
  placeholder: {
    fontSize: 10,
    opacity: 0.5,
    fontStyle: "italic",
  },
  divider: {
    height: 1,
    background: "#e6eaf0",
    margin: "8px 0",
  },
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
  configRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  configLabel: {
    fontSize: 11,
    fontWeight: 500,
    opacity: 0.75,
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
};

export default ExportTab;

// ============================================
// EXPORT TAB KASUTAMINE PEAMISES APPIS:
// ============================================

/*

import ExportTab from "./components/ExportTab";

export function App() {
  const [language, setLanguage] = useState<"et" | "en">("et");
  const [selectedTab, setSelectedTab] = useState<"search" | "export">("search");
  const [exportData, setExportData] = useState<ObjectProperties[]>([]);
  const apiRef = useRef(window.trimbleConnect?.api);

  const addLog = (message: string) => {
    console.log(message);
    // TODO: Näita kasutajale notifications-ega
  };

  return (
    <div>
      <div className="tabs">
        <button onClick={() => setSelectedTab("search")}>Search</button>
        <button onClick={() => setSelectedTab("export")}>Export</button>
      </div>

      {selectedTab === "export" && (
        <ExportTab
          api={apiRef.current}
          exportData={exportData}
          language={language}
          addLog={addLog}
        />
      )}
    </div>
  );
}

*/
