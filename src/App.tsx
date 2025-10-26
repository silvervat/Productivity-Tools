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
        console.log("Event:", _event, _data);
      });
      setTcApi(api);
      console.log("Connected to Trimble Connect API");
    }
    connectWithTcAPI().catch(console.error);
  }, []);

  useEffect(() => {
    if (!tcApi) return;

    // AUTOMAATNE: Kuulata mudelisse valitud objektide muudatusi
    const handleSelectionChange = async () => {
      console.log("Selection changed");
      try {
        const selection = await tcApi.viewer.getSelection();
        if (selection.length > 0) {
          const firstSelection = selection[0];
          if (firstSelection.objectRuntimeIds && firstSelection.objectRuntimeIds.length > 0) {
            const objectSelector = {
              output: { loadProperties: true }
            };
            
            const objects = await tcApi.getSelectedObjects(objectSelector);
            if (objects && objects.length > 0) {
              setSelectedObjects(objects);
              console.log("Selected objects with properties:", objects);
            }
          }
        }
      } catch (error) {
        console.error("Error getting selected objects:", error);
      }
    };

    // Kuula selektiooni muudatusi
    tcApi.addEventListener("selectionChanged", handleSelectionChange);

    // Initial check
    handleSelectionChange();

    return () => {
      tcApi.removeEventListener("selectionChanged", handleSelectionChange);
    };
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
