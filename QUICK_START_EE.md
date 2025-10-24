# 🚀 QUICK START - Alusta Siin!

## 📦 Paigaldamine

### 1. Failide ekstraktimine

Ekstraheerige `Markup-Builder-Clean.zip` oma arvutisse.

### 2. Sõltuvuste paigaldamine

```bash
cd Markup-Builder-Cleaned
npm install
```

### 3. Arendusserver käivitamine

```bash
npm run dev
```

**Väljund:**
```
  VITE v5.0.0  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

Avaage brauseris: **http://localhost:5173**

## 🎯 Kuidas Kasutada

### Samm 1: Objektide Otsing

1. Vasakul pool näete "🔍 Otsing" paneeli
2. Sisestage otsingu fraas (nt "SC1001", "Height", "Mark")
3. Klõpsake objektile (või see valitakse automaatselt 3D-s)

### Samm 2: Omaduste Valik

1. Paremal pool näete "🎨 Markup Builder"
2. **Vasak kast**: Saadaolevad omadused
3. **Parem kast**: Valitud omadused
4. **Lohistage** vasaku kasti omadusi paremasse kasti

### Samm 3: Seadistused

1. **Täiendav tekst**: Lisage prefix (nt "TÄHELEPANU")
2. **Markupi värv**: Valige värvivalijas
3. **Eraldaja**: Valige "Koma" (|) või "Uus rida" (\n)

### Samm 4: Eelvaade ja Rakendamine

1. **Eelvaade** - Näitab kuidas markup välja näeb
2. **LISA MARKEERING** - Rakendab markupi objektidele

## 📁 Projekti Struktuur

```
Markup-Builder-Cleaned/
├── src/
│   ├── components/
│   │   ├── DragDropMarkupBuilder.tsx     ← PEAKOMPONENT
│   │   ├── DragDropMarkupBuilder.css     ← Styling
│   │   └── ElementSearch.tsx             ← Otsing
│   ├── App.tsx                           ← Peaapp
│   └── main.tsx                          ← Entry point
├── package.json                          ← Dependencies
├── vite.config.ts                        ← Vite config
├── README_MARKUP_BUILDER.md              ← Dokumentatsioon
├── KASUTUSJUHIS_EE.md                    ← Detailne juhis
└── KOKKUVOTE.md                          ← Kokkuvõte
```

## 🔑 Peamised Failid

### `src/components/DragDropMarkupBuilder.tsx`
Peakomponent - drag-and-drop markup builder

### `src/components/ElementSearch.tsx`
Objektide otsing ning valik

### `src/App.tsx`
Peaapp - integreerib mõlemad komponendid

## 💡 Näited

### Näide 1: Lihtne Markup

**Otsing**: "SC1001"  
**Valitud omadused**: "Product_Code", "Position"  
**Täiendav tekst**: "TÄHELEPANU"  
**Separator**: Koma (|)  

**Eelvaade**: 
```
TÄHELEPANU | SC1001 | Position 123
```

### Näide 2: Mitmerealised Markup

**Otsing**: "Height"  
**Valitud omadused**: "Height", "Width", "Length"  
**Separator**: Uus rida (\n)  

**Eelvaade**:
```
Height: 3000 mm
Width: 2000 mm
Length: 5000 mm
```

## 🛠️ Arendamine

### Komponendi Lisamine

Looge uus fail `src/components/MyComponent.tsx`:

```typescript
interface MyComponentProps {
  api: WorkspaceAPI;
  language: "et" | "en";
}

export default function MyComponent({ api, language }: MyComponentProps) {
  return <div>My Component</div>;
}
```

Lisage App.tsx-sse:

```typescript
import MyComponent from './components/MyComponent';

// App.tsx-s:
<section className='component-section'>
  <MyComponent api={tcApi} language={language} />
</section>
```

### CSS Muudatused

Muutke `src/components/DragDropMarkupBuilder.css`:

```css
.ddb-container {
  padding: 2rem;  /* Muutke 1.5rem → 2rem */
  /* ... */
}
```

### Tõlgete Lisamine

Muutke `src/components/DragDropMarkupBuilder.tsx`:

```typescript
const translations = {
  et: {
    title: "🎨 Markup Builder - Drag & Drop",
    // ... lisage uued tõlked
  },
  en: {
    title: "🎨 Markup Builder - Drag & Drop",
    // ... lisage uued tõlked
  },
};
```

## 🐛 Debugimine

### Console Output

```bash
# Brauseris: F12 → Console
Connected to Trimble Connect API
Selected objects: [...]
Properties: [...]
```

### Vead

```typescript
// Otsige error-i console-is:
console.error("Error fetching properties:", error);
console.error("Error applying markup:", error);
```

## ✨ Tavapärased Muudatused

### Värvide Muutmine

`DragDropMarkupBuilder.css`:
```css
.ddb-title {
  color: #0a3a67;  /* Muutke värvi */
}

.ddb-apply-button {
  background: linear-gradient(135deg, #ff9800, #f57c00);  /* Muutke */
}
```

### Fondi Muutmine

```css
.ddb-prop-key {
  font-family: 'Courier New', monospace;  /* Muutke */
}
```

### Keele Muutmine (Default)

`src/App.tsx`:
```typescript
const [language, setLanguage] = useState<Language>("en");  // "et" → "en"
```

## 📚 Rohkem Teavet

- 📖 Lugege `README_MARKUP_BUILDER.md`
- 📖 Lugege `KASUTUSJUHIS_EE.md` (detailne)
- 📖 Lugege `KOKKUVOTE.md` (ülevaade)

## 🎉 Edu!

Kui näete:
1. ✅ "Connected to Trimble Connect API"
2. ✅ Otsing töötab
3. ✅ Drag & Drop töötab
4. ✅ Markup rakendub

**Siis on kõik õige!** 🚀

## 🆘 Abi

### Probleem: Port 5173 on juba kasutuses

Lahendus:
```bash
npm run dev -- --port 5174
```

### Probleem: node_modules pole installitud

Lahendus:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Probleem: Komponendid pole näha

Kontrollige:
1. Kas `selectedObjects` pole tühi?
2. Kas API ühendus on aktiivne?
3. Kas brauseris ei ole errore?

### Probleem: Drag & Drop pole tööle

Lahendus:
1. Vahetage brauserit (Chrome, Firefox)
2. Puhastage cache (Ctrl+Shift+Delete)
3. Kontrollige CSS-i

## 📞 Contact

Kui teil on küsimusi:
1. Kontrollige console'i (F12)
2. Lugege dokumentatsiooni
3. Küsige team-ilt

---

**Õnne alustamisega!** 🎨✨

**Next Step**: Lugege `README_MARKUP_BUILDER.md` läbivaatamiseks!
