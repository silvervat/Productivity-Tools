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
        console.log("🔌 Event from Trimble Connect:", _event, _data);
        
        // Kui event on selection muutus
        if (_event === 'selectionChanged') {
          console.log("📍 Selection changed event!");
          handleSelectionChange();
        }
      });
      setTcApi(api);
      console.log("✅ Connected to Trimble Connect API");
    }
    connectWithTcAPI().catch(console.error);
  }, []);

  const handleSelectionChange = async () => {
    if (!tcApi) {
      console.log("❌ tcApi pole saadaval");
      return;
    }

    try {
      console.log("🔄 Fetching selected objects...");
      
      // Kasuta optional chaining
      const selector = { output: { loadProperties: true } };
      const result = await (tcApi as any).getSelectedObjects?.(selector);
      
      if (result && result.length > 0) {
        setSelectedObjects(result);
        console.log("✅ Got", result.length, "selected objects");
        console.log("📊 First object:", result[0]);
      } else {
        console.log("⚠️ No objects in result");
        setSelectedObjects([]);
      }
    } catch (error) {
      console.error("❌ Error getting selected objects:", error);
      
      // Proovi alternative meetod
      try {
        console.log("🔄 Trying alternative method...");
        const viewer = (tcApi as any).viewer;
        if (viewer && viewer.getSelection) {
          const selection = await viewer.getSelection();
          console.log("📍 Viewer selection:", selection);
        }
      } catch (e) {
        console.error("❌ Alternative method also failed:", e);
      }
      
      setSelectedObjects([]);
    }
  };

  // Poll selection iga 500ms
  useEffect(() => {
    if (!tcApi) return;

    console.log("✅ Setting up selection polling");
    const interval = setInterval(() => {
      handleSelectionChange();
    }, 500);

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
