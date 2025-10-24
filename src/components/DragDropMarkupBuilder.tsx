import { useEffect, useState, useCallback } from 'react';
import type { ObjectProperties, WorkspaceAPI } from 'trimble-connect-workspace-api';
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
    noObjects: 'Palun valige objektid otsingust',
    available: 'Saadaolevad omadused',
    selected: 'Valitud omadused',
    dragHint: 'Lohistage omadused siia',
    settings: '⚙️ Seadistused',
    additionalText: 'Täiendav tekst:',
    additionalPlaceholder: 'Nt: "TÄHELEPANU" või "KONTROLL"',
    markupColor: 'Markupi värv:',
    separator: 'Eraldaja:',
    separatorComma: 'Koma',
    separatorNewline: 'Uus rida',
    preview: '👁️ Eelvaade:',
    empty: '(Tühi)',
    applyButton: 'LISA MARKEERING',
    applying: 'Lisatakse...',
    success: '✓ Markup lisatud {count} objektile',
    error: 'Viga markupi lisamisel',
    loading: 'Omaduste laadimine...',
    noProperties: 'Omadusi ei leitud',
  },
  en: {
    title: '🎨 Markup Builder - Drag & Drop',
    noObjects: 'Please select objects from search',
    available: 'Available properties',
    selected: 'Selected properties',
    dragHint: 'Drag properties here',
    settings: '⚙️ Settings',
    additionalText: 'Additional text:',
    additionalPlaceholder: 'E.g. "ATTENTION" or "CHECK"',
    markupColor: 'Markup color:',
    separator: 'Separator:',
    separatorComma: 'Comma',
    separatorNewline: 'New line',
    preview: '👁️ Preview:',
    empty: '(Empty)',
    applyButton: 'ADD MARKUP',
    applying: 'Adding...',
    success: '✓ Markup added to {count} objects',
    error: 'Error adding markup',
    loading: 'Loading properties...',
    noProperties: 'No properties found',
  },
};

const t = (key: keyof typeof translations.et, language: 'et' | 'en') => {
  return translations[language][key];
};

export default function DragDropMarkupBuilder({
  api,
  selectedObjects,
  language,
}: DragDropMarkupBuilderProps) {
  const [availableProperties, setAvailableProperties] = useState<Property[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);
  const [additionalText, setAdditionalText] = useState('');
  const [markupColor, setMarkupColor] = useState('#FF0000');
  const [separator, setSeparator] = useState<'comma' | 'newline'>('comma');
  const [previewText, setPreviewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch properties when selected objects change
  useEffect(() => {
    fetchProperties();
  }, [selectedObjects]);

  // Update preview when properties, text, or separator change
  useEffect(() => {
    updatePreview();
  }, [selectedProperties, additionalText, separator]);

  const fetchProperties = async () => {
    if (!selectedObjects || selectedObjects.length === 0) {
      setAvailableProperties([]);
      return;
    }

    setLoading(true);
    try {
      const firstObject = selectedObjects[0];
      const flattened = flattenProperties(firstObject);
      setAvailableProperties(flattened);
    } catch (error) {
      console.error('Error fetching properties:', error);
      setMessage(t('error', language));
    } finally {
      setLoading(false);
    }
  };

  const flattenProperties = (obj: ObjectProperties, prefix = ''): Property[] => {
    const result: Property[] = [];

    const processValue = (value: any, key: string) => {
      if (value === null || value === undefined || value === '') {
        return;
      }

      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && !Array.isArray(value)) {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          processValue(nestedValue, `${fullKey}.${nestedKey}`);
        }
      } else if (!Array.isArray(value)) {
        result.push({
          key: fullKey,
          value: String(value).trim(),
        });
      }
    };

    if (obj.properties) {
      for (const propSet of obj.properties) {
        const setName = (propSet as any).name || 'Unknown';
        if ((propSet as any).properties) {
          for (const prop of (propSet as any).properties) {
            const propName = (prop as any).name || 'Unknown';
            const propValue = (prop as any).value;
            processValue(propValue, setName);
          }
        }
      }
    }

    return result;
  };

  const updatePreview = () => {
    if (selectedProperties.length === 0) {
      setPreviewText(additionalText);
      return;
    }

    const sepString = separator === 'comma' ? ' | ' : '\n';
    let preview = selectedProperties.map((p) => p.value).join(sepString);

    if (additionalText) {
      preview = `${additionalText} | ${preview}`;
    }

    setPreviewText(preview);
  };

  const handleDragStart = (
    e: React.DragEvent,
    property: Property,
    source: 'available' | 'selected'
  ) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('property', JSON.stringify(property));
    e.dataTransfer.setData('source', source);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnSelected = (e: React.DragEvent) => {
    e.preventDefault();
    const property = JSON.parse(e.dataTransfer.getData('property'));
    const source = e.dataTransfer.getData('source');

    if (
      source === 'available' &&
      !selectedProperties.find((p) => p.key === property.key)
    ) {
      setSelectedProperties([...selectedProperties, property]);
    }
  };

  const handleDropOnAvailable = (e: React.DragEvent) => {
    e.preventDefault();
    const property = JSON.parse(e.dataTransfer.getData('property'));

    if (e.dataTransfer.getData('source') === 'selected') {
      removeProperty(property.key);
    }
  };

  const removeProperty = (key: string) => {
    setSelectedProperties(selectedProperties.filter((p) => p.key !== key));
  };

  const applyMarkup = async () => {
    if (!previewText) {
      setMessage(t('error', language));
      return;
    }

    if (!selectedObjects || selectedObjects.length === 0) {
      setMessage(t('noObjects', language));
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Get GUIDs from selected objects
      const guids = selectedObjects.map((obj) => obj.id);

      // Create text markups
      const markups = guids.map((guid, index) => ({
        id: `markup_${guid}_${Date.now()}_${index}`,
        text: previewText,
        color: markupColor,
        position: {
          x: 0,
          y: 0,
          z: 0,
        },
      }));

      // Apply markups via API
      await (api.viewer as any).addOrUpdateTextMarkups?.(markups);

      setMessage(
        t('success', language).replace('{count}', selectedObjects.length.toString())
      );

      // Reset after success
      setTimeout(() => {
        setSelectedProperties([]);
        setAdditionalText('');
        setMessage('');
      }, 2000);
    } catch (error) {
      console.error('Error applying markup:', error);
      setMessage(t('error', language));
    } finally {
      setLoading(false);
    }
  };

  if (!selectedObjects || selectedObjects.length === 0) {
    return (
      <div className="ddb-container">
        <h3 className="ddb-title">{t('title', language)}</h3>
        <div className="ddb-empty">{t('noObjects', language)}</div>
      </div>
    );
  }

  return (
    <div className="ddb-container">
      <div className="ddb-header">
        <h3 className="ddb-title">{t('title', language)}</h3>
        <span className="ddb-badge">
          {selectedObjects.length} {language === 'et' ? 'objekti' : 'objects'}
        </span>
      </div>

      {message && <div className={`ddb-message ${message.includes('✓') ? 'success' : 'error'}`}>{message}</div>}

      {/* Properties Grid */}
      <div className="ddb-grid">
        {/* Available Properties */}
        <div className="ddb-section">
          <h4 className="ddb-section-title">{t('available', language)}</h4>
          <div
            className="ddb-properties-list available"
            onDragOver={handleDragOver}
            onDrop={handleDropOnAvailable}
          >
            {loading ? (
              <div className="ddb-placeholder">{t('loading', language)}</div>
            ) : availableProperties.length === 0 ? (
              <div className="ddb-placeholder">{t('noProperties', language)}</div>
            ) : (
              availableProperties.map((prop, idx) => (
                <div
                  key={`avail-${prop.key}-${idx}`}
                  className="ddb-property-item"
                  draggable
                  onDragStart={(e) => handleDragStart(e, prop, 'available')}
                  title={`${prop.key}: ${prop.value}`}
                >
                  <div className="ddb-prop-key">{prop.key}</div>
                  <div className="ddb-prop-value">{prop.value}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Properties */}
        <div className="ddb-section">
          <h4 className="ddb-section-title">{t('selected', language)}</h4>
          <div
            className="ddb-properties-list selected"
            onDragOver={handleDragOver}
            onDrop={handleDropOnSelected}
          >
            {selectedProperties.length === 0 ? (
              <div className="ddb-placeholder">{t('dragHint', language)}</div>
            ) : (
              selectedProperties.map((prop, idx) => (
                <div key={`sel-${prop.key}-${idx}`} className="ddb-property-item selected">
                  <div className="ddb-prop-content">
                    <div className="ddb-prop-key">{prop.key}</div>
                    <div className="ddb-prop-value">{prop.value}</div>
                  </div>
                  <button
                    className="ddb-remove-btn"
                    onClick={() => removeProperty(prop.key)}
                    title="Remove"
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
      <div className="ddb-settings">
        <h4 className="ddb-section-title">{t('settings', language)}</h4>

        <div className="ddb-setting-group">
          <label htmlFor="additional-text">{t('additionalText', language)}</label>
          <input
            id="additional-text"
            type="text"
            value={additionalText}
            onChange={(e) => setAdditionalText(e.target.value)}
            placeholder={t('additionalPlaceholder', language)}
            className="ddb-input"
          />
        </div>

        <div className="ddb-setting-group">
          <label htmlFor="markup-color">{t('markupColor', language)}</label>
          <div className="ddb-color-picker">
            <input
              id="markup-color"
              type="color"
              value={markupColor}
              onChange={(e) => setMarkupColor(e.target.value)}
            />
            <span className="ddb-color-value">{markupColor}</span>
          </div>
        </div>

        <div className="ddb-setting-group">
          <label>{t('separator', language)}</label>
          <div className="ddb-radio-group">
            <label className="ddb-radio">
              <input
                type="radio"
                name="separator"
                value="comma"
                checked={separator === 'comma'}
                onChange={(e) => setSeparator(e.target.value as 'comma' | 'newline')}
              />
              {t('separatorComma', language)}
            </label>
            <label className="ddb-radio">
              <input
                type="radio"
                name="separator"
                value="newline"
                checked={separator === 'newline'}
                onChange={(e) => setSeparator(e.target.value as 'comma' | 'newline')}
              />
              {t('separatorNewline', language)}
            </label>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="ddb-preview">
        <h4 className="ddb-section-title">{t('preview', language)}</h4>
        <div className="ddb-preview-box" style={{ borderLeftColor: markupColor }}>
          <pre>{previewText || t('empty', language)}</pre>
        </div>
      </div>

      {/* Apply Button */}
      <button
        className="ddb-apply-button"
        onClick={applyMarkup}
        disabled={loading || !previewText}
      >
        {loading ? t('applying', language) : t('applyButton', language)}
      </button>
    </div>
  );
}
