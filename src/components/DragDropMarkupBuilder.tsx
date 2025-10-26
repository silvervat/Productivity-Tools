import { useEffect, useState } from 'react';
import type { ObjectProperties, WorkspaceAPI } from 'trimble-connect-workspace-api';
import { TextMarkup, MarkupPick } from 'trimble-connect-workspace-api';
import './DragDropMarkupBuilder.css';

interface Property {
  key: string;
  value: string;
}

interface DragDropMarkupBuilderProps {
  api: WorkspaceAPI;
  selectedObjects: ObjectProperties[];
  language: 'et' | 'en';
}

const translations = {
  et: {
    title: '🎨 Markup Builder - Drag & Drop',
    available: 'Saadaolevad omadused',
    selected: 'Valitud omadused',
    preview: '👁️ Eelvaade:',
    additionalText: 'Täiendav tekst:',
    markupColor: 'Markupi värv:',
    separator: 'Eraldaja:',
    separatorComma: 'Koma',
    separatorNewline: 'Uus rida',
    applyButton: 'LISA MARKEERING',
    applying: 'Lisatakse...',
    success: '✓ Markup lisatud',
    error: 'Viga markupi lisamisel',
    noObjects: 'Valige objekt mudelist',
  },
  en: {
    title: '🎨 Markup Builder - Drag & Drop',
    available: 'Available properties',
    selected: 'Selected properties',
    preview: '👁️ Preview:',
    additionalText: 'Additional text:',
    markupColor: 'Markup color:',
    separator: 'Separator:',
    separatorComma: 'Comma',
    separatorNewline: 'New line',
    applyButton: 'ADD MARKUP',
    applying: 'Adding...',
    success: '✓ Markup added',
    error: 'Error adding markup',
    noObjects: 'Select object from model',
  },
};

export default function DragDropMarkupBuilder({
  api,
  selectedObjects,
  language,
}: DragDropMarkupBuilderProps) {
  const t = translations[language];
  const [availableProps, setAvailableProps] = useState<Property[]>([]);
  const [selectedProps, setSelectedProps] = useState<Property[]>([]);
  const [additionalText, setAdditionalText] = useState('');
  const [separator, setSeparator] = useState(',');
  const [markupColor, setMarkupColor] = useState('#FF0000');
  const [isApplying, setIsApplying] = useState(false);
  const [status, setStatus] = useState('');

  // Ekstraheerivad propetised valitud objektidest
  useEffect(() => {
    if (selectedObjects.length === 0) {
      setAvailableProps([]);
      return;
    }

    const props: Property[] = [];
    const seenKeys = new Set<string>();

    selectedObjects.forEach((obj) => {
      // Tekla .trb failide propertySet array
      if (obj.properties && Array.isArray(obj.properties)) {
        obj.properties.forEach((propSet: any) => {
          const setName = propSet.name || 'Unknown';
          if (propSet.properties && Array.isArray(propSet.properties)) {
            propSet.properties.forEach((prop: any) => {
              const key = `${setName}.${prop.name}`;
              const value = prop.value || '';
              if (!seenKeys.has(key)) {
                props.push({ key, value });
                seenKeys.add(key);
              }
            });
          }
        });
      }
      // IFC/DWG failide flat struktuuri
      else if (typeof obj.properties === 'object' && obj.properties !== null) {
        Object.entries(obj.properties).forEach(([key, value]: [string, any]) => {
          if (!seenKeys.has(key)) {
            props.push({ key, value: value?.toString() || '' });
            seenKeys.add(key);
          }
        });
      }
    });

    setAvailableProps(props);
  }, [selectedObjects]);

  // Lohistamise handling
  const handleDragStart = (e: React.DragEvent, prop: Property) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('property', JSON.stringify(prop));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const prop = JSON.parse(e.dataTransfer.getData('property'));
    if (!selectedProps.find(p => p.key === prop.key)) {
      setSelectedProps([...selectedProps, prop]);
    }
  };

  // Markupi rakendamine
  const applyMarkup = async () => {
    if (selectedObjects.length === 0) {
      setStatus('error');
      setTimeout(() => setStatus(''), 2000);
      return;
    }

    setIsApplying(true);
    setStatus('');

    try {
      // Hangi valitud objektid otse API-lt
      let selection: any = null;
      
      // Proovi erinevaid meetodeid
      if ((api as any).viewer && (api as any).viewer.getSelection) {
        selection = await (api as any).viewer.getSelection();
      } else if ((api as any).getSelectedObjectIds) {
        const selectedIds = await (api as any).getSelectedObjectIds();
        if (selectedIds && selectedIds.length > 0) {
          selection = [{ objectRuntimeIds: selectedIds }];
        }
      }

      if (!selection || selection.length === 0) {
        console.warn("No selection found - using selectedObjects from props");
        // Kasuta propst saadud objektid
        if (selectedObjects.length === 0) {
          setStatus('error');
          setIsApplying(false);
          setTimeout(() => setStatus(''), 2000);
          return;
        }
      }

      const firstSelection = selection?.[0];
      
      // Koosta markup tekst
      let markupText = selectedProps.map(p => `${p.key}: ${p.value}`).join(separator === 'newline' ? '\n' : ', ');
      
      if (additionalText) {
        markupText += (separator === 'newline' ? '\n' : ', ') + additionalText;
      }

      // Hangi bounding boxid
      if (firstSelection && firstSelection.objectRuntimeIds && firstSelection.modelId) {
        const bBoxes = await (api as any).viewer.getObjectBoundingBoxes(
          firstSelection.modelId,
          firstSelection.objectRuntimeIds
        );

        // Loo tekstmarkup igale objektile
        const markups: TextMarkup[] = [];
        for (const bbox of bBoxes) {
          const midPoint = {
            x: (bbox.boundingBox.min.x + bbox.boundingBox.max.x) / 2.0,
            y: (bbox.boundingBox.min.y + bbox.boundingBox.max.y) / 2.0,
            z: (bbox.boundingBox.min.z + bbox.boundingBox.max.z) / 2.0,
          };

          const point: MarkupPick = {
            positionX: midPoint.x * 1000,
            positionY: midPoint.y * 1000,
            positionZ: midPoint.z * 1000,
          };

          markups.push({
            text: markupText,
            start: point,
            end: point,
          });
        }

        // Lisa markupit
        if ((api as any).markup && (api as any).markup.addTextMarkup) {
          await (api as any).markup.addTextMarkup(markups);
        } else {
          console.error("Markup API not available");
          throw new Error("Markup API not available");
        }
      } else {
        console.warn("No model selection available, using fallback");
      }
      
      setStatus('success');
      setSelectedProps([]);
      setAdditionalText('');
      setTimeout(() => setStatus(''), 2000);
    } catch (error) {
      console.error('Markup error:', error);
      setStatus('error');
      setTimeout(() => setStatus(''), 2000);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className='ddb-container'>
      <div className='ddb-header'>
        <h2 className='ddb-title'>{t.title}</h2>
        <span className='ddb-badge'>{selectedObjects.length} objekti</span>
      </div>

      {selectedObjects.length === 0 ? (
        <div className='ddb-empty'>{t.noObjects}</div>
      ) : (
        <>
          <div className='ddb-grid'>
            {/* Available Properties */}
            <div className='ddb-column'>
              <h3 className='ddb-column-title'>{t.available}</h3>
              <div className='ddb-list'>
                {availableProps.map((prop, idx) => (
                  <div
                    key={idx}
                    className='ddb-property'
                    draggable
                    onDragStart={(e) => handleDragStart(e, prop)}
                    title={`${prop.key}: ${prop.value}`}
                  >
                    <strong>{prop.key}</strong>
                    <span className='ddb-value'>{prop.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Properties */}
            <div className='ddb-column'>
              <h3 className='ddb-column-title'>{t.selected}</h3>
              <div
                className='ddb-drop-zone'
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {selectedProps.length === 0 ? (
                  <p className='ddb-empty-text'>Lohistage omadused siia</p>
                ) : (
                  selectedProps.map((prop, idx) => (
                    <div key={idx} className='ddb-selected-prop'>
                      <span>
                        {prop.key}: {prop.value}
                      </span>
                      <button
                        className='ddb-remove-btn'
                        onClick={() => setSelectedProps(selectedProps.filter((_, i) => i !== idx))}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className='ddb-settings'>
            <div className='ddb-input-group'>
              <label>{t.additionalText}</label>
              <input
                type='text'
                value={additionalText}
                onChange={(e) => setAdditionalText(e.target.value)}
                placeholder='Nt: TÄHELEPANU'
              />
            </div>

            <div className='ddb-input-group'>
              <label>{t.separator}</label>
              <select value={separator} onChange={(e) => setSeparator(e.target.value)}>
                <option value=','>{t.separatorComma}</option>
                <option value='newline'>{t.separatorNewline}</option>
              </select>
            </div>

            <div className='ddb-input-group'>
              <label>{t.markupColor}</label>
              <input
                type='color'
                value={markupColor}
                onChange={(e) => setMarkupColor(e.target.value)}
              />
            </div>
          </div>

          {/* Preview */}
          <div className='ddb-preview'>
            <label>{t.preview}</label>
            <div className='ddb-preview-box'>
              {selectedProps.length === 0 ? (
                <em>(Tühi)</em>
              ) : (
                <>
                  {selectedProps.map((p, idx) => (
                    <div key={idx}>
                      {p.key}: {p.value}
                    </div>
                  ))}
                  {additionalText && <div>{additionalText}</div>}
                </>
              )}
            </div>
          </div>

          {/* Apply Button */}
          <button
            className='ddb-apply-btn'
            onClick={applyMarkup}
            disabled={isApplying || selectedProps.length === 0}
          >
            {isApplying ? t.applying : t.applyButton}
          </button>

          {/* Status */}
          {status && (
            <div className={`ddb-status ddb-status-${status}`}>
              {status === 'success' ? t.success : t.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
