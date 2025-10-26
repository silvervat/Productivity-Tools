import React, { useEffect, useState } from 'react';
import { WorkspaceAPI } from 'trimble-connect-workspace-api';
import ElementSearch from './components/ElementSearch';
import DragDropMarkupBuilder from './components/DragDropMarkupBuilder';
import './App.css';

function App() {
  const [api, setApi] = useState<WorkspaceAPI | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<any[]>([]);
  const [language] = useState<'et' | 'en'>('et');

  useEffect(() => {
    const initApi = async () => {
      try {
        const workspaceApi = await (window as any).WorkspaceAPI.getInstance();
        setApi(workspaceApi);
        console.log('Workspace API laetud!');
      } catch (error) {
        console.error('API laadimise viga:', error);
      }
    };
    initApi();
  }, []);

  if (!api) {
    return <div>Laen Trimble Connect API-d...</div>;
  }

  return (
    <div className="app">
      <h1>Markup Extension (MARKUP teema)</h1>
      <ElementSearch api={api} onSelectionChange={setSelectedObjects} language={language} />
      <DragDropMarkupBuilder api={api} selectedObjects={selectedObjects} language={language} />
    </div>
  );
}

export default App;
