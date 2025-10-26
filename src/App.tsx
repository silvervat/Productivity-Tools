import { useEffect, useState } from 'react';
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import type { ObjectProperties } from "trimble-connect-workspace-api";
import DragDropMarkupBuilder from './components/DragDropMarkupBuilder';
import '@trimbleinc/modus-bootstrap/dist/modus.min.css';
import '@trimble-oss/modus-icons/dist/modus-outlined/fonts/modus-icons.css';
import './App.css';

type Language = "et" | "en";

function App() {
  const [tcApi, setTcApi] = useState<WorkspaceAPI.WorkspaceAPI>();
  const [language, setLanguage] = useState<Language>("et");
  const [selectedObjects, setSelectedObjects] = useState<ObjectProperties[]>([]);

  useEffect(() => {
    async function connectWithTcAPI() {
      const api = await WorkspaceAPI.connect(window.parent, (_event: any, _data: any) => {
        console.log("🔌 Trimble event:", _event);
      });
      setTcApi(api);
      console.log("✅ Connected to API");
    }
    connectWithTcAPI().catch(console.error);
  }, []);

  useEffect(() => {
    if (!tcApi) return;

    console.log("🔄 Starting viewer selection monitoring...");

    const handleSelectionChange = async () => {
      try {
        // Kasuta viewer.getSelection() - see on õige meetod!
        const viewer = (tcApi as any).viewer;
        if (!viewer) {
          console.log("❌ viewer pole saadaval");
          return;
        }

        const selection = await viewer.getSelection?.();
        console.log("👁️ Viewer selection:", selection);

        if (selection && selection.length > 0) {
          const firstSelection = selection[0];
          console.log("📍 Selected item:", firstSelection);

          // Hangi properties selle objekti jaoks
          if (firstSelection.objectRuntimeIds && firstSelection.modelId) {
            try {
              // Hangi object properties
              const props = await viewer.getObjectProperties?.(
                firstSelection.modelId,
                firstSelection.objectRuntimeIds
              );
              console.log("📊 Object properties:", props);

              if (props && props.length > 0) {
                // Konverteeri properties ObjectProperties formaadiks
                const objectProperties: ObjectProperties[] = props.map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  properties: p.properties || p.props || {}
                }));
                
                setSelectedObjects(objectProperties);
                console.log("✅ Got", objectProperties.length, "objects with properties");
              }
            } catch (e) {
              console.error("❌ Error getting object properties:", e);
            }
          }
        } else {
          console.log("⚠️ No selection");
          setSelectedObjects([]);
        }
      } catch (error) {
        console.error("❌ Error in selection handler:", error);
      }
    };

    // Poll iga 500ms
    const interval = setInterval(handleSelectionChange, 500);
    
    // Initial check
    handleSelectionChange();

    return () => clearInterval(interval);
  }, [tcApi]);

  return (
    <div className='app-wrapper'>
      <div className='app-header'>
        <h1 className='title'>🎨 Markup Builder</h1>
        <select 
          value={language} 
          onChange={(e) => setLanguage(e.target.value as Language)}
          className='language-select'
        >
          <option value="et">Eesti</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className='components-grid'>
        {tcApi ? (
          <DragDropMarkupBuilder 
            api={tcApi}
            selectedObjects={selectedObjects}
            language={language}
          />
        ) : (
          <div className='loading'>Laen Trimble Connect API-d...</div>
        )}
      </div>
    </div>
  );
}

export default App;
