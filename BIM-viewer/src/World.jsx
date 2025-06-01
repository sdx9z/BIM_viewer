import { onMount, createSignal } from "solid-js";
import * as THREE from "three"; // 3D-движок Three.js 
import * as WEBIFC from "web-ifc"; // Библиотека для работы с IFC-моделями.
import * as BUI from "@thatopen/ui"; // Пользовательский UI-компоненты BIM-интерфейса.
import * as OBC from "@thatopen/components"; // Основные BIM-компоненты от That Open Company, под псевдонимом OBC.
import * as OBCF from "@thatopen/components-front"; // Для поддержки выделения
import * as BUIC from "@thatopen/ui-obc"; // Пользовательский UI-компоненты

export default function World() {
  onMount(async () => {
    // Получаем контейнер для рендеринга
    const container = document.getElementById("container");

    // Инициализируем компоненты из OBC
    const components = new OBC.Components();
    const worlds = components.get(OBC.Worlds);

    // Создаем сцену, камеру и рендерер 
    const world = worlds.create(
      OBC.SimpleScene,
      OBC.SimpleCamera,
      OBC.SimpleRenderer
    );

    // Переопределяем созданные объекты
    world.scene = new OBC.SimpleScene(components);
    world.renderer = new OBC.SimpleRenderer(components, container);
    world.camera = new OBC.SimpleCamera(components);

    // Инициализация всех компонентов
    components.init();
    world.scene.setup(); // Установка сцены
    world.scene.three.background = null;  // Прозрачный фон

    // Настройка камеры, смотрит в центр
    world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

    // Создаем и добавляем сетку на сцену
    const grids = components.get(OBC.Grids);
    const grid = grids.create(world);

    // Загрузка и управление фрагментами
    const fragments = components.get(OBC.FragmentsManager);
    const fragmentIfcLoader = components.get(OBC.IfcLoader);
    await fragmentIfcLoader.setup(); 

    // Исключаем определенные категории IFC при загрузке, чтобы ускорить загрузку и рендеринг
    const excludedCats = [
      WEBIFC.IFCTENDONANCHOR,
      WEBIFC.IFCREINFORCINGBAR,
      WEBIFC.IFCREINFORCINGELEMENT,
    ];
    for (const cat of excludedCats) {
      fragmentIfcLoader.settings.excludedCategories.add(cat);
    }

    // Привязка модели к началу координат
    fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;

    // Загрузка IFC-файла из локального хранилища
    async function loadIfcFromLocalFile(file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const buffer = new Uint8Array(event.target.result);
        const model = await fragmentIfcLoader.load(buffer);
        model.name = file.name;
        world.scene.three.add(model); //Добавдение модели на сцену

        // Обработка свойств и отображение в таблице
        const indexer = components.get(OBC.IfcRelationsIndexer);
        await indexer.process(model);
        updatePropertiesTable({ fragmentIdMap: {} });
      };
      reader.readAsArrayBuffer(file);
    }

    // Очистка сцены
    function disposeFragments() {
      fragments.dispose(); // Удаление всех загруженных моделей
    }

    // Инициализация BIM UI
    BUI.Manager.init();

    // Список моделей
    const [modelsList] = BUIC.tables.modelsList({
      components,
      tags: { schema: true, viewDefinition: false },
      actions: { download: false },
    });

  // Создаем дерево элементов
    const [relationsTree] = BUIC.tables.relationsTree({
      components,
      models: [],
    });
    relationsTree.preserveStructureOnFilter = true;

    // Создание таблицы свойств элемента
    const [propertiesTable, updatePropertiesTable] = BUIC.tables.elementProperties({
      components,
      fragmentIdMap: {},
    });
    propertiesTable.preserveStructureOnFilter = true;
    propertiesTable.indentationInText = false;

    // Настройка выделения и обновления таблицы
    const highlighter = components.get(OBCF.Highlighter);
    highlighter.setup({ world });


   // Обработчики для переключения между деревом и свойствами
    highlighter.events.select.onHighlight.add((fragmentIdMap) => {
      updatePropertiesTable({ fragmentIdMap });
      document.getElementById("properties-section").style.display = "block";
      document.getElementById("tree-section").style.display = "none";
    });
    
    highlighter.events.select.onClear.add(() => {
      updatePropertiesTable({ fragmentIdMap: {} });
      document.getElementById("properties-section").style.display = "none";
      document.getElementById("tree-section").style.display = "block";
    });

    // Объединённая панель управления и свойств
    const panel = BUI.Component.create(() => {
      const [loadIfcBtn] = BUIC.buttons.loadIfc({ components });

      const onTextInput = (e) => {
        const input = e.target;
        propertiesTable.queryString = input.value !== "" ? input.value : null;
      };

      const onTreeSearch = (e) => {
        const input = e.target;
        relationsTree.queryString = input.value;
      };


      const expandTable = (e) => {
        const button = e.target;
        propertiesTable.expanded = !propertiesTable.expanded;
        button.label = propertiesTable.expanded ? "Свернуть" : "Развернуть";
      };

      const copyAsTSV = async () => await navigator.clipboard.writeText(propertiesTable.tsv);

      return BUI.html`
    <bim-panel label="Управление моделями">
      <bim-panel-section label="Настройки">
        <bim-color-input 
          label="Цвет фона" color="#202932" 
          @input="${({ target }) => {
          world.scene.config.backgroundColor = new THREE.Color(target.color);
        }}">
        </bim-color-input>

        <bim-number-input 
          slider step="0.1" label="Направленный свет" value="1.5" min="0.1" max="10"
          @change="${({ target }) => {
          world.scene.config.directionalLight.intensity = target.value;
        }}">
        </bim-number-input>

        <bim-number-input 
          slider step="0.1" label="Рассеянный свет" value="1" min="0.1" max="5"
          @change="${({ target }) => {
          world.scene.config.ambientLight.intensity = target.value;
        }}">
        </bim-number-input>

        <bim-checkbox label="Показать сетку" checked 
          @change="${({ target }) => {
          grid.config.visible = target.value;
        }}">
        </bim-checkbox>

        <bim-color-input 
          label="Цвет сетки" color="#bbbbbb" 
          @input="${({ target }) => {
          grid.config.color = new THREE.Color(target.color);
        }}">
        </bim-color-input>

        <bim-number-input 
          slider step="0.1" label="Размер основной сетки" value="1" min="0" max="10"
          @change="${({ target }) => {
          grid.config.primarySize = target.value;
          grid.config.secondarySize = target.value + 10;
        }}">
        </bim-number-input>

        <bim-button label="Загрузить модель" @click="${() => document.getElementById('file-input').click()}"></bim-button>
        <input id="file-input" type="file" accept=".ifc" style="display: none"
          @change="${(event) => {
          const file = event.target.files[0];
          if (file) loadIfcFromLocalFile(file);
        }}"
        />
        <bim-button label="Очистить сцену" @click="${() => disposeFragments()}"></bim-button>
      </bim-panel-section>

      <bim-panel-section label="Загруженные модели">
        ${modelsList}
      </bim-panel-section>

      
      <bim-panel-section id="tree-section" label="Дерево элементов">
        <bim-text-input @input=${onTreeSearch} placeholder="Поиск в дереве" debounce="250"></bim-text-input>
        ${relationsTree}
      </bim-panel-section>

          <bim-panel-section id="properties-section" label="Свойства элемента" style="display: none">
            <div style="display: flex; gap: 0.5rem;">
              <bim-button @click=${expandTable} label=${propertiesTable.expanded ? "Свернуть" : "Развернуть"}></bim-button>
              <bim-button @click=${copyAsTSV} label="Скопировать как TSV"></bim-button>
            </div>
            <bim-text-input @input=${onTextInput} placeholder="Поиск в свойствах" debounce="250"></bim-text-input>
            ${propertiesTable}
          </bim-panel-section>
        </bim-panel>
      `;
    });

// Создаем контейнер для панели
    const panelContainer = document.createElement("div");
    panelContainer.appendChild(panel);

    // Кнопка переключения видимости панели
    const toggleButton = document.createElement("button");
    toggleButton.textContent = "◄";
    
    toggleButton.onclick = () => {
      const isVisible = panelContainer.style.left === "0px";
      panelContainer.style.left = isVisible ? "-350px" : "0px";
      toggleButton.style.left = isVisible ? "0px" : "350px";
      toggleButton.textContent = isVisible ? "►" : "◄";
    };
    //Добавление на страницу
    document.body.appendChild(panelContainer);
    document.body.appendChild(toggleButton);
    
    // По умолчанию показываем дерево элементов
    document.getElementById("tree-section").style.display = "block";
    document.getElementById("properties-section").style.display = "none";
  });

  return null;
}