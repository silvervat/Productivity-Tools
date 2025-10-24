import { useCallback, useEffect, useState } from 'react';
import * as WorkspaceAPI from "trimble-connect-workspace-api";
import type { ObjectProperties } from "trimble-connect-workspace-api";
import ElementSearch from './components/ElementSearch';
import DragDropMarkupBuilder from './components/DragDropMarkupBuilder';
import '@trimbleinc/modus-bootstrap/dist/modus.min.css';
import '@trimble-oss/modus-icons/dist/modus-outlined/fonts/modus-icons.css';
import './App.css';

type Language = "et" | "en";

function App() {
  const [tcApi, setTcApi] = useState<WorkspaceAPI.WorkspaceAPI>();
  const [language, setLanguage] = useState<Language>("et");
  const [selectedObjects, setSelectedObjects] = useState<ObjectProperties[]>([]);

  const addLog = useCallback((message: string) => {
    console.log(message);
  }, []);

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

  return (
    <div className='app-wrapper'>
      <div className='app-header'>
        <h1 className='title'>🎨 Markup Builder Pro</h1>
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
        <section className='component-section'>
          <ElementSearch 
            api={tcApi as WorkspaceAPI.WorkspaceAPI}
            onSelectionChange={setSelectedObjects}
            language={language}
          />
        </section>

        <section className='component-section'>
          <DragDropMarkupBuilder 
            api={tcApi as WorkspaceAPI.WorkspaceAPI}
            selectedObjects={selectedObjects}
            language={language}
          />
        </section>
      </div>
    </div>
  );
}

export default App;
