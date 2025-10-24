# 🎯 DragDropMarkupBuilder - Detailne kasutusjuhis

## Komponendi ülevaade

`DragDropMarkupBuilder` on Trimble Connect laienduse komponent, mis võimaldab:

1. **Objektide propertside automaatset avastamist**
2. **Drag-and-drop kasutajaliidest** omaduste valimiseks
3. **Live eelvaate genereerimist** markup tekstile
4. **Markupi batch rakendamist** korraga mitmele objektile

## Integratioon App.tsx-sse

```typescript
import DragDropMarkupBuilder from './components/DragDropMarkupBuilder';
import ElementSearch from './components/ElementSearch';

function App() {
  const [selectedObjects, setSelectedObjects] = useState<ObjectProperties[]>([]);

  return (
    <>
      <ElementSearch 
        api={tcApi}
        onSelectionChange={setSelectedObjects}
        language="et"
      />
      
      <DragDropMarkupBuilder 
        api={tcApi}
        selectedObjects={selectedObjects}
        language="et"
      />
    </>
  );
}
```

## Prop-id

### `api: WorkspaceAPI`
- Trimble Connect API ühendus
- Vajatav: **JAH**
- Allikas: `await WorkspaceAPI.connect(window.parent, ...)`

### `selectedObjects: ObjectProperties[]`
- Valitud objektide massiiv
- Vajatav: **JAH**
- Allikas: `ElementSearch` komponent via `onSelectionChange`
- Näide: `[{ id: "guid1", properties: [...] }, { id: "guid2", properties: [...] }]`

### `language: "et" | "en"`
- Kasutajafiili keel
- Vajatav: **JAH**
- Default: `"et"`

## Samm-sammuline voog

### 1️⃣ Omaduste avastamine

Kui `selectedObjects` muutub:

```typescript
useEffect(() => {
  fetchProperties();
}, [selectedObjects]);
```

**Mis juhtub:**
- Loob esimesest objektist kõik omadused
- Teeb property flattening: `PropertySet.Name = Value`
- Filtreerib välja tühjad väärtused
- Salvestab `availableProperties` state-sse

### 2️⃣ Drag & Drop

Kasutaja lohistab omadusi vasakult paremale:

```typescript
<div
  className="ddb-properties-list selected"
  onDragOver={handleDragOver}
  onDrop={handleDropOnSelected}
>
  {selectedProperties.map(...)}
</div>
```

**Omaduste liikumine:**
1. Kasutaja haarab omaduse (`onDragStart`) vasakult kastist
2. Lohistab paremasse kasti
3. Langeb kastile (`onDrop`)
4. Omadus lisatakse `selectedProperties` massiivile
5. Parem kast värskendatakse

**Omaduste eemaldamine:**
- Kasutaja klõpsab ✕ nupul
- Omadus eemaldatakse `selectedProperties`-ist
- Omadus jääb ikka `availableProperties`-sse

### 3️⃣ Live eelvaade

Iga kord, kui `selectedProperties`, `additionalText` või `separator` muutub:

```typescript
useEffect(() => {
  updatePreview();
}, [selectedProperties, additionalText, separator]);

const updatePreview = () => {
  const sepString = separator === 'comma' ? ' | ' : '\n';
  let preview = selectedProperties.map((p) => p.value).join(sepString);
  
  if (additionalText) {
    preview = `${additionalText} | ${preview}`;
  }
  
  setPreviewText(preview);
};
```

**Näited:**

```
Näide 1: Comma separator
Valik omadused: "SC1001", "Height: 3000 mm"
Täiendav tekst: "TÄHELEPANU"
Eelvaade: "TÄHELEPANU | SC1001 | Height: 3000 mm"

Näide 2: Newline separator
Valik omadused: "SC1001", "Height: 3000 mm"
Täiendav tekst: "TÄHELEPANU"
Eelvaade: 
  TÄHELEPANU | SC1001
  Height: 3000 mm
```

### 4️⃣ Markupi rakendamine

Klõps "LISA MARKEERING" nupul:

```typescript
const applyMarkup = async () => {
  const guids = selectedObjects.map((obj) => obj.id);
  
  const markups = guids.map((guid, index) => ({
    id: `markup_${guid}_${Date.now()}_${index}`,
    text: previewText,
    color: markupColor,
    position: { x: 0, y: 0, z: 0 },
  }));
  
  await api.viewer.addOrUpdateTextMarkups?.(markups);
};
```

**Tulemused:**
- Iga valitud objekti peal kuvatakse tekstimarkup
- Markupi tekst: eelvaates näidatav tekst
- Markupi värv: valitud värvivalijas
- Markupi positsioon: objekti keskele (0, 0, 0)

## State Management

| State | Tüüp | Kirjeldus |
|-------|------|-----------|
| `availableProperties` | `Property[]` | Kõik omadused esimesest objektist |
| `selectedProperties` | `Property[]` | Kasutaja valitud omadused |
| `additionalText` | `string` | Prefix markupile |
| `markupColor` | `string` | Hex värv (#FF0000) |
| `separator` | `"comma" \| "newline"` | Eraldaja omaduste vahel |
| `previewText` | `string` | Lõplik markupi tekst |
| `loading` | `boolean` | Omaduste laadimise olek |
| `message` | `string` | Kasutajateatis (edu/viga) |

## Property Flattening algoritm

```typescript
const flattenProperties = (obj: ObjectProperties, prefix = ''): Property[] => {
  const result: Property[] = [];

  const processValue = (value: any, key: string) => {
    if (value === null || value === undefined || value === '') {
      return; // Skip empty values
    }

    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        processValue(nestedValue, `${fullKey}.${nestedKey}`);
      }
    } else if (!Array.isArray(value)) {
      // Add to results
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
```

**Näide:**

Sisend:
```
Object {
  properties: [
    {
      name: "Tekla_Assembly",
      properties: [
        { name: "AssemblyCast_unit_Mark", value: "SC1001" },
        { name: "AssemblyCast_unit_position_code", value: "123" }
      ]
    }
  ]
}
```

Väljund:
```
[
  { key: "Tekla_Assembly.AssemblyCast_unit_Mark", value: "SC1001" },
  { key: "Tekla_Assembly.AssemblyCast_unit_position_code", value: "123" }
]
```

## Vigadetegemine

### Viga: "Omadusi ei leitud"

**Põhjused:**
1. `selectedObjects` on tühi
2. Objektil pole `properties` väljas
3. Property set pole `properties`-ga

**Lahendus:**
```typescript
// Check console:
console.log("Selected objects:", selectedObjects);
console.log("First object properties:", selectedObjects[0]?.properties);

// Veenduge, et includeHidden: true on seadistatud:
const props = await api.getObjectProperties({
  objectId: object.id,
  includeHidden: true, // OLULINE!
});
```

### Viga: "Markup ei rakendunud"

**Põhjused:**
1. `previewText` on tühi
2. API ühendus pole aktiivne
3. GUID format pole õige

**Lahendus:**
```typescript
console.log("Preview text:", previewText);
console.log("Selected objects:", selectedObjects);
console.log("API:", api);

// Test markup creation:
const testMarkup = {
  id: `test_${Date.now()}`,
  text: "TEST",
  color: "#FF0000",
  position: { x: 0, y: 0, z: 0 },
};
await api.viewer.addOrUpdateTextMarkups?.([testMarkup]);
```

### Viga: "Drag & Drop pole tööle"

**Põhjused:**
1. CSS konflikt
2. Brauseril puudub tugi
3. Event listener pole korralikult seadistatud

**Lahendus:**
```typescript
// Check CSS:
.ddb-property-item {
  cursor: move; // Peab olema!
  user-select: none;
  draggable: true;
}

// Check browser:
console.log("Drag support:", 'draggable' in HTMLElement.prototype);

// Test drag:
<div draggable="true" onDragStart={handleDragStart}>
  Drag me!
</div>
```

## Performance optimiseerimine

### Suurte andmekogustega objektid

```typescript
// Piirange omaduste arvu
const MAX_PROPERTIES = 1000;

const limitedProperties = availableProperties
  .sort((a, b) => b.value.length - a.value.length)
  .slice(0, MAX_PROPERTIES);
```

### Drag & Drop optimiseerimine

```typescript
// Kasutage virtual scrolling suurte loenditena
// Näiteks react-window või react-virtualized

const VirtualList = ({items}) => (
  <FixedSizeList
    height={320}
    itemCount={items.length}
    itemSize={35}
    width="100%"
  >
    {({index, style}) => (
      <div style={style}>
        {/* Render item */}
      </div>
    )}
  </FixedSizeList>
);
```

## Näide: Täielik kasutamine

```typescript
import { useState, useEffect } from 'react';
import * as WorkspaceAPI from 'trimble-connect-workspace-api';
import ElementSearch from './components/ElementSearch';
import DragDropMarkupBuilder from './components/DragDropMarkupBuilder';
import type { ObjectProperties } from 'trimble-connect-workspace-api';

export default function App() {
  const [api, setApi] = useState<WorkspaceAPI.WorkspaceAPI>();
  const [selected, setSelected] = useState<ObjectProperties[]>([]);

  useEffect(() => {
    const connect = async () => {
      const api = await WorkspaceAPI.connect(window.parent, (_e, _d) => {
        console.log("Event:", _e, _d);
      });
      setApi(api);
    };
    connect();
  }, []);

  return (
    <div>
      <ElementSearch 
        api={api!}
        onSelectionChange={setSelected}
        language="et"
      />
      
      {selected.length > 0 && (
        <DragDropMarkupBuilder 
          api={api!}
          selectedObjects={selected}
          language="et"
        />
      )}
    </div>
  );
}
```

## Export formaadid

Komponendis pole veel integreeritud, kuid tulevikus saab lisada:

```typescript
// Clipboard
const copyToClipboard = () => {
  navigator.clipboard.writeText(previewText);
};

// CSV
const exportCSV = () => {
  const csv = selectedObjects
    .map(obj => `${obj.id},${previewText}`)
    .join('\n');
  downloadFile(csv, 'markups.csv', 'text/csv');
};

// Excel
const exportExcel = () => {
  // Kasutage xlsx library-d
};
```

## Järgmised sammud

1. ✅ Komponent on funktsionaalne
2. 🔄 Lisa virtual scrolling suurte loenditena
3. 🔄 Lisa export funktsioonid (CSV, Excel)
4. 🔄 Undo/Redo funktsioonid
5. 🔄 Markupi template-id
6. 🔄 Batch import/export

---

**Küsimused?** Kontrollige console'i ja veast.
