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

    // Начало и завершение отслеживания рендер-циклов
    world.renderer.onBeforeUpdate.add(() => stats.begin());
    world.renderer.onAfterUpdate.add(() => stats.end());

    // Загрузка и управление фрагментами
    const fragments = components.get(OBC.FragmentsManager);
    const fragmentIfcLoader = components.get(OBC.IfcLoader);
    await fragmentIfcLoader.setup(); // ПЕРЕНЕСЕНО В ASYNC

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

    // Функция для скачивания файлов (будет нужно, когда реализуем объединение моделей)
    function download(file) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
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
    highlighter.events.select.onHighlight.add((fragmentIdMap) => updatePropertiesTable({ fragmentIdMap }));
    highlighter.events.select.onClear.add(() => updatePropertiesTable({ fragmentIdMap: {} }));

    // Объединённая панель управления и свойств
    const panel = BUI.Component.create(() => {
      const [loadIfcBtn] = BUIC.buttons.loadIfc({ components });

      const onTextInput = (e) => {
        const input = e.target;
        propertiesTable.queryString = input.value !== "" ? input.value : null;
      };

      const expandTable = (e) => {
        const button = e.target;
        propertiesTable.expanded = !propertiesTable.expanded;
        button.label = propertiesTable.expanded ? "Collapse" : "Expand";
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

      <bim-panel-section label="Свойства элемента">
        <div style="display: flex; gap: 0.5rem;">
          <bim-button @click=${expandTable} label=${propertiesTable.expanded ? "Скрыть" : "Показать"}></bim-button>
          <bim-button @click=${copyAsTSV} label="Скопировать как TSV"></bim-button>
        </div>
        <bim-text-input @input=${onTextInput} placeholder="Поиск" debounce="250"></bim-text-input>
        ${propertiesTable}
      </bim-panel-section>

    </bim-panel>
    <div id="container"></div>
  `;
    });

    // Обёртка панели и кнопка переключения видимости
    const containerDiv = document.createElement("div");
    containerDiv.classList.add("panel-container", "visible");
    containerDiv.appendChild(panel);

    const toggleButton = document.createElement("div");
    toggleButton.id = "toggle-panel";
    toggleButton.textContent = "⮜";
    toggleButton.onclick = () => {
      const isVisible = containerDiv.classList.contains("visible");
      containerDiv.classList.toggle("visible", !isVisible);
      containerDiv.classList.toggle("hidden", isVisible);
      toggleButton.textContent = isVisible ? "⮞" : "⮜";
    };

    document.body.appendChild(containerDiv);
    document.body.appendChild(toggleButton);

    //Добавление на страницу
    document.body.appendChild(containerDiv);
    document.body.appendChild(toggleButton);
  });

  return null;
}