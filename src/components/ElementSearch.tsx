import { ModusButton, ModusTextInput, ModusTooltip, ModusTreeView, ModusTreeViewItem } from "@trimble-oss/modus-react-components";
import { useEffect, useRef, useState } from "react";
import { ObjectProperties, ObjectSelector, WorkspaceAPI } from "trimble-connect-workspace-api";
import * as _ from "lodash";

type ObjectWithValue = {
  properties: ObjectProperties,
  value: string
}

interface ElementSearchProps {
  api: WorkspaceAPI;
  onSelectionChange?: (objects: ObjectProperties[]) => void;
  language?: "et" | "en";
}

const translations = {
  et: {
    search: "Otsing",
    searchPhrase: "Otsingufraas",
    searchValue: "Väärtus",
    refresh: "Uuenda mudelit",
    results: "Tulemused",
  },
  en: {
    search: "Search",
    searchPhrase: "Search phrase",
    searchValue: "Value",
    refresh: "Refresh model",
    results: "Results",
  },
};

const t = (key: keyof typeof translations.et, language: string = "et") => {
  return translations[language as keyof typeof translations][key];
};

export default function ElementSearch({ api, onSelectionChange, language = "et" }: ElementSearchProps) {
  const [searchValue, setSearchValue] = useState<string>('');
  const [filteredObjects, setFilteredObjects] = useState<ObjectWithValue[]>([]);

  const modelId = useRef<string>('');
  const allModelObjects = useRef<ObjectProperties[]>([]);

  async function getObjectProperties() {
    const objectSelector: ObjectSelector = {
      output: { loadProperties: true }
    };

    if (api === undefined) return;

    const response = await api.viewer.getObjects(objectSelector);
    if (response.length == 0) return;

    modelId.current = response[0].modelId;
    allModelObjects.current = response[0].objects;
  }

  useEffect(() => {
    getObjectProperties();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {

      if (allModelObjects.current.length == 0 || searchValue === null || searchValue.length == 0) {
        setFilteredObjects([]);
        if (onSelectionChange) onSelectionChange([]);
        return;
      }

      const loweredSearch = searchValue.toLowerCase();

      const result: ObjectWithValue[] = [];
      for (const modelObject of allModelObjects.current) {
        if (modelObject.properties === undefined) continue;
        let value = '';

        const anyMeets = modelObject.properties.some(pSet => {
          if (pSet.properties === undefined) {

          }
          else {
            const foundProperty = pSet.properties.find(p =>
              p.value.toLocaleString().toLowerCase().includes(loweredSearch));

            if (foundProperty !== undefined) {
              value = foundProperty.value.toLocaleString();
              return true;
            }
          }
        }
        );

        if (anyMeets) {
          result.push({ properties: modelObject, value: value });
        }
      }

      const objectSelector: ObjectSelector = {
        modelObjectIds: [{ modelId: modelId.current, objectRuntimeIds: result.map(r => r.properties.id) }]
      };
      api.viewer.setSelection(objectSelector, "set");

      setFilteredObjects(result);

      // Send selected objects back to parent
      if (onSelectionChange) {
        onSelectionChange(result.map(r => r.properties));
      }
    }, 1000)

    return () => clearTimeout(delayDebounceFn)
  }, [searchValue, onSelectionChange]);

  return (
    <>
      <div className="content-panel">
        <div className="row align-items-center">
          <h3 className="col">{t("search", language)}</h3>
          <ModusTooltip text={t("refresh", language)}>
            <ModusButton className="col" size="small" buttonStyle="borderless" onClick={getObjectProperties}>
              <i className="modus-icons">refresh</i>
            </ModusButton>
          </ModusTooltip>
        </div>
        <ModusTextInput type="text"
          value={searchValue}
          label={t("searchPhrase", language)}
          placeholder={t("searchValue", language)}
          clearable={true}
          onValueChange={e => { setSearchValue(e.target.value) }} />

        <ModusTreeView className="filtered-objects" size="condensed">
          {
            _.map(_.groupBy(filteredObjects, (p => p.value)), (val, key) =>
              <ModusTreeViewItem
                key={key}
                nodeId={key}
                label={key}>
                {
                  val.map(o =>
                    <ModusTreeViewItem
                      key={o.properties.id.toString()}
                      nodeId={o.properties.id.toString()}
                      label={o.properties.id.toString()}>
                    </ModusTreeViewItem>
                  )
                }
              </ModusTreeViewItem>
            )
          }
        </ModusTreeView>
      </div>
    </>
  )

}