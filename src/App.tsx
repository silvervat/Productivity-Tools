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
  const [selectionData, setSelectionData] = useState<any>(null);

  useEffect(() => {
    async function connectWithTcAPI() {
      const api = await WorkspaceAPI.connect(window.parent, (_event: any, _data: any) => {
        console.log("🔌 Event:", _event, _data);

        // Kuula viewer.onSelectionChanged eventi
        if (_event === 'viewer.onSelectionChanged' && _data?.data) {
          console.log("✅ Selection changed! Data:", _data.data);
          setSelectionData(_data.data);
          
          // Hangi propetised selle selection-i jaoks
          handleSelectionChanged(_data.data);
        }
      });
      setTcApi(api);
      console.log("✅ Connected to API");
    }
    connectWithTcAPI().catch(console.error);
  }, []);

  const handleSelectionChanged = async (selectionData: any[]) => {
    if (!tcApi || !selectionData || selectionData.length === 0) {
      console.log("❌ No selection data");
      setSelectedObjects([]);
      return;
    }

    try {
      console.log("📍 Processing selection data:", selectionData);

      // Esimene valitud item
      const firstItem = selectionData[0];
      console.log("📌 First item:", firstItem);

      if (firstItem.objectRuntimeIds) {
        console.log("🔍 Object Runtime IDs:", firstItem.objectRuntimeIds);
        console.log("🏗️ Model ID:", firstItem.modelId);

        // Hangi bounding box - see kinnistab et objekt on olemas
        const viewer = (tcApi as any).viewer;
        if (viewer) {
          try {
            const bboxes = await viewer.getObjectBoundingBoxes?.(
              firstItem.modelId,
              firstItem.objectRuntimeIds
            );
            console.log("📦 Bounding boxes:", bboxes);

            // Nüüd hangi properties
            const props = await viewer.getObjectProperties?.(
              firstItem.modelId,
              firstItem.objectRuntimeIds
            );
            console.log("📊 Object properties:", props);

            if (props && props.length > 0) {
              const objectProps: ObjectProperties[] = props.map((p: any) => ({
                id: p.id || firstItem.objectRuntimeIds[0],
                name: p.name,
                properties: p.properties || p.props || {}
              }));

              setSelectedObjects(objectProps);
              console.log("✅ Set selected objects:", objectProps.length);
            } else {
              console.log("⚠️ No properties found");
              setSelectedObjects([]);
            }
          } catch (e) {
            console.error("❌ Error getting properties:", e);
            setSelectedObjects([]);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error in selection handler:", error);
      setSelectedObjects([]);
    }
  };

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


