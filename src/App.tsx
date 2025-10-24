import { useEffect, useState } from 'react'
import * as WorkspaceAPI from "trimble-connect-workspace-api"
import SectionPlanesCreator from './components/SectionPlanesCreator'
import MarkupAnnotations from './components/MarkupAnnotations'
import ElementSearch from './components/ElementSearch'
import AdvancedMarkupBuilder from './components/AdvancedMarkupBuilder'
import '@trimbleinc/modus-bootstrap/dist/modus.min.css';
import '@trimble-oss/modus-icons/dist/modus-outlined/fonts/modus-icons.css';
import './App.css'

type Language = "et" | "en";

function App() {
  const [tcApi, setTcApi] = useState<WorkspaceAPI.WorkspaceAPI>()
  const [language, setLanguage] = useState<Language>("et")

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
        <h1 className='title'>🛠️ Productivity Tools Pro</h1>
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
          <AdvancedMarkupBuilder api={tcApi as WorkspaceAPI.WorkspaceAPI} language={language} />
        </section>

        <section className='component-section'>
          <SectionPlanesCreator api={tcApi as WorkspaceAPI.WorkspaceAPI} />
        </section>

        <section className='component-section'>
          <MarkupAnnotations api={tcApi as WorkspaceAPI.WorkspaceAPI} />
        </section>

        <section className='component-section'>
          <ElementSearch api={tcApi as WorkspaceAPI.WorkspaceAPI} />
        </section>
      </div>
    </div>
  )
}

export default App
