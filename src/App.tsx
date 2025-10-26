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

    // Handler for selection changes
    const handleSelectionChange = async () => {
      try {
        console.log("Selection changed");
        
        // Proovi erinevaid meetodeid propetiste saamiseks
        let objects: ObjectProperties[] = [];

        // MEETOD 1: Proovi viewer.selectionChanged event
        try {
          const selector = { output: { loadProperties: true } };
          const result = await (tcApi as any).getSelectedObjects?.(selector);
          if (result && result.length > 0) {
            objects = result;
            console.log("Got objects via getSelectedObjects");
          }
        } catch (e1) {
          console.log("getSelectedObjects not available, trying alternative...");
          
          // MEETOD 2: Proovi viewer API
          try {
            const selection = await (tcApi as any).viewer?.getSelection?.();
            if (selection && selection.length > 0) {
              const firstSelection = selection[0];
              if (firstSelection.objectRuntimeIds) {
                const bboxes = await (tcApi as any).viewer?.getObjectBoundingBoxes?.(
                  firstSelection.modelId,
                  firstSelection.objectRuntimeIds
                );
                if (bboxes) {
                  console.log("Got bboxes:", bboxes.length);
                }
              }
            }
          } catch (e2) {
            console.log("Alternative method also failed");
          }
        }

        if (objects.length > 0) {
          setSelectedObjects(objects);
          console.log("Selected objects count:", objects.length);
        } else {
          console.log("No objects found");
          setSelectedObjects([]);
        }
      } catch (error) {
        console.error("Error in selection handler:", error);
        setSelectedObjects([]);
      }
    };

    // Try to set up listener using available method
    let removeListener: (() => void) | null = null;

    if ((tcApi as any).on) {
      console.log("Using .on() method for listeners");
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
    } else {
      console.warn("No event listener method available on API");
    }

    // Initial check
    handleSelectionChange();

    // Cleanup
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
