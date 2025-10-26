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

    console.log("Setting up selection listener");

    const handleSelectionChange = async () => {
      try {
        console.log("Selection changed");
        
        let objects: ObjectProperties[] = [];

        try {
          const selector = { output: { loadProperties: true } };
          const result = await (tcApi as any).getSelectedObjects?.(selector);
          if (result && result.length > 0) {
            objects = result;
            console.log("Got objects via getSelectedObjects");
          }
        } catch (e1) {
          console.log("getSelectedObjects not available");
        }

        if (objects.length > 0) {
          setSelectedObjects(objects);
          console.log("Selected objects count:", objects.length);
        } else {
          setSelectedObjects([]);
        }
      } catch (error) {
        console.error("Error in selection handler:", error);
        setSelectedObjects([]);
      }
    };

    let removeListener: (() => void) | null = null;

    if ((tcApi as any).on) {
      console.log("Using .on() method");
      (tcApi as any).on("selectionChanged", handleSelectionChange);
      removeListener = () => {
        try {
          if ((tcApi as any).off) {
            (tcApi as any).off("selectionChanged", handleSelectionChange);
          }
        } catch (e) {
          console.error("Error removing listener:", e);
        }
      };
    } else if ((tcApi as any).addEventListener) {
      console.log("Using .addEventListener() method");
      (tcApi as any).addEventListener("selectionChanged", handleSelectionChange);
      removeListener = () => {
        try {
          if ((tcApi as any).removeEventListener) {
            (tcApi as any).removeEventListener("selectionChanged", handleSelectionChange);
          }
        } catch (e) {
          console.error("Error removing listener:", e);
        }
      };
    }

    handleSelectionChange();

    return () => {
      if (removeListener) {
        removeListener();
      }
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
