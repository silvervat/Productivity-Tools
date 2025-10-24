# 🎨 Markup Builder - Drag & Drop Edition

Trimble Connect laiendus drag-and-drop Markup Builder-iga. Otsige objektid, lohistage omadusi ja rakendage markuppe otse mudelile.

## 🌟 Põhifunktsioonid

✅ **Elementide otsimine** - Otsige objektide propertiste põhjal  
✅ **Drag & Drop** - Lohistage omadusi valikukasti  
✅ **Live eelvaade** - Näete kuidas markup välja näeb  
✅ **Arvutused** - Määrake eraldajad, värv ja täiendav tekst  
✅ **Mitmerahvusus** - Eesti ja inglise keele tugi  
✅ **Batch rakendamine** - Rakendage markup korraga mitmele objektile  

## 📁 Projekti struktuur

```
Markup-Builder-Cleaned/
├── src/
│   ├── components/
│   │   ├── ElementSearch.tsx           # Objektide otsing
│   │   ├── DragDropMarkupBuilder.tsx   # Peakomponent - drag & drop
│   │   ├── DragDropMarkupBuilder.css   # Stiilid
│   │   └── [eemaldatud: AdvancedMarkupBuilder, SectionPlanes, Annotations]
│   ├── App.tsx                         # Peaapp
│   ├── App.css                         # App stiilid
│   ├── main.tsx                        # Entry point
│   └── vite-env.d.ts
├── public/
│   ├── extension.json                  # Trimble Connect extension manifest
│   └── favicon.svg
├── package.json                        # Dependencies
├── vite.config.ts                      # Vite konfiguratsioon
└── README.md
```

## 🚀 Kiirstart

### 1. Sõltuvuste paigaldamine

```bash
npm install
```

### 2. Arendusserver

```bash
npm run dev
```

Server käivitub `http://localhost:5173`

### 3. Buildimine

```bash
npm run build
```

Väljund: `dist/` kaust

## 🎯 Kuidas kasutada

### 1. Elementide otsimine

- Sisestage otsingufraaas ("SC1001", "Height", jne)
- Süsteem filtreerib objektid otse mudelilt
- Valitud objektid säilitavad otsingus valitud olek

### 2. Omaduste valimine

- Vasak pool: **Saadaolevad omadused** (lihtsalt esimesest objektist)
- Parem pool: **Valitud omadused** (neid markupi peal kuvatakse)
- **Lohistage vasakust paremale** - omadused lisatakse
- Klõpsake **✕** nupul - omadused eemaldatakse

### 3. Seadistused

- **Täiendav tekst** - prefix markupile (nt "TÄHELEPANU")
- **Markupi värv** - valige värvivalija
- **Eraldaja** - "Koma" (|) või "Uus rida" (\n)

### 4. Eelvaade ja rakendamine

- **Eelvaade** - näitab kuidas markup välja näeb
- **LISA MARKEERING** - rakendab markupi kõikidele valitud objektidele

## 🔧 Komponendid

### `DragDropMarkupBuilder.tsx`

Peakomponent drag-and-drop Markup Builder-iga.

```tsx
<DragDropMarkupBuilder 
  api={tcApi}
  selectedObjects={selectedObjects}
  language="et"
/>
```

**Prop-id:**
- `api: WorkspaceAPI` - Trimble Connect API ühendus
- `selectedObjects: ObjectProperties[]` - Valitud objektid
- `language: "et" | "en"` - Keel

**Functionality:**
- Omaduste automaatne laadimine valitud objektidelt (`includeHidden: true`)
- Property flattening: "PropertySet" + "Name" → "PropertySet.Name"
- Drag-and-drop kasutajaliides
- Live preview
- Markup rakendamine via `addOrUpdateTextMarkups()`

### `ElementSearch.tsx`

Objektide otsingu komponent.

```tsx
<ElementSearch 
  api={tcApi}
  onSelectionChange={setSelectedObjects}
  language="et"
/>
```

**Prop-id:**
- `api: WorkspaceAPI` - Trimble Connect API
- `onSelectionChange: (objects: ObjectProperties[]) => void` - Callback valitud objektidele
- `language: "et" | "en"` - Keel

**Functionality:**
- Debounced search (1000ms)
- Tulemused grupeeritud väärtuste kaupa
- Valitud objektid saadetakse tagasi parent-komponentile

## 💾 API integratsiooni üksikasjad

### Omaduste päring

```typescript
// Omaduste laadimine
const props = await api.getObjectProperties({
  objectId: object.id,
  includeHidden: true, // OLULINE!
});

// Property flattening
"Tekla_Assembly" + "AssemblyCast_unit_Mark" → "Tekla_Assembly.AssemblyCast_unit_Mark"
```

### Markupi rakendamine

```typescript
const markups = selectedObjects.map((guid, index) => ({
  id: `markup_${guid}_${Date.now()}_${index}`,
  text: previewText,
  color: markupColor,
  position: { x: 0, y: 0, z: 0 },
}));

await api.viewer.addOrUpdateTextMarkups(markups);
```

## 🎨 Stiilid

Komponendid kasutavad:
- **Trimble Modus Bootstrap** CSS muutujaid värvide ja fontide jaoks
- **Inline CSS** AdvancedMarkupBuilder-is
- **DragDropMarkupBuilder.css** drag-drop komponendi jaoks

Värvid automatiseerivad tema/hele režiimi järgi.

## 📚 Tõlked

Projekt toetab kahte keelt:

```typescript
const translations = {
  et: { ... },  // Eesti keel
  en: { ... },  // English
};
```

Kasutage `t("key", language)` või `t("key", language).replace("{count}", value)`

## 🔍 Debugging

### Console output

Komponendid kasutavad `console.log()` debugimiseks:

```typescript
console.log("Connected to Trimble Connect API");
console.log("Event:", _event, _data);
console.error("Error fetching properties:", error);
```

### DevTools

1. Trimble Connect brauseris avage F12
2. Console tab
3. Otsige "DragDropMarkupBuilder" või "ElementSearch"

## 🐛 Tavapärased probleemid

### Omadusi ei leitud?

✓ Veenduge, et `includeHidden: true` on seadistatud  
✓ Kontrollige, kas objektid on valitud  
✓ Kontrollige console'i vead  

### Markup ei rakendunud?

✓ Veenduge, et eelvaade pole tühi  
✓ Kontrollige, kas API ühendus on aktiivne  
✓ Vaadake markupi GUIDe (peaks olema string)  

### Drag & Drop pole tööle?

✓ Kasutage tänapäevast brauserit (Chrome, Firefox, Edge)  
✓ Veenduge, et failis pole CSS ristkonflikt  

## 📝 Litsents

MIT License - vaba kasutamiseks

## 🤝 Kontakt

- **Autor**: Silver
- **Projekt**: Trimble Connect Markup Builder
- **Repositoorium**: GitHub

---

Nautige Markup Builderit! 🎉
