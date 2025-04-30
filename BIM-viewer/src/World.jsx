import { onMount } from "solid-js"; 
import * as THREE from "three"; // 3D-движок Three.js 
import * as WEBIFC from "web-ifc"; // Библиотека для работы с IFC-моделями.
import * as BUI from "@thatopen/ui"; // Пользовательский UI-компоненты BIM-интерфейса.
import Stats from "stats.js"; // FPS-панель для отображения производительности.
import * as OBC from "@thatopen/components"; // Основные BIM-компоненты от That Open Company, под псевдонимом OBC.

export default function World() {
  onMount(() => {
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
    world.scene.three.background = null; // Прозрачный фон

    // Настройка камеры, смотрит в центр
    world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

    // Создаем и добавляем сетку на сцену
    const grids = components.get(OBC.Grids);
    const grid = grids.create(world);

    // Инициализация FPS-панели
    const stats = new Stats();
    stats.showPanel(2); // Панель с задержками рендеринга
    document.body.appendChild(stats.dom);
    stats.dom.style.left = "0px";
    stats.dom.style.zIndex = "unset";

    // Начало и завершение отслеживания рендер-циклов
    world.renderer.onBeforeUpdate.add(() => stats.begin());
    world.renderer.onAfterUpdate.add(() => stats.end());

    // Загрузка и управление фрагментами
    const fragments = components.get(OBC.FragmentsManager);
    const fragmentIfcLoader = components.get(OBC.IfcLoader);
    fragmentIfcLoader.setup();

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
        model.name = "local-model";
        world.scene.three.add(model); // Добавление модели в сцену
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

    // Экспорт фрагментов и свойств (будет нужно, когда реализуем объединение моделей)
    async function exportFragments() {
      if (!fragments.groups.size) return;
      const group = Array.from(fragments.groups.values())[0];
      const data = fragments.export(group); 
      download(new File([new Blob([data])], "model.frag"));

      const properties = group.getLocalProperties();
      if (properties) {
        download(new File([JSON.stringify(properties)], "model.json"));
      }
    }

    // Очистка сцены
    function disposeFragments() {
      fragments.dispose(); // Удаление всех загруженных моделей
    }

    // Инициализация BIM UI
    BUI.Manager.init();

    // Создание панели интерфейса
    const panel = BUI.Component.create(() => {
      return BUI.html`
        <bim-panel label="Настройки отображения" class="options-menu">
          <bim-panel-section collapsed label="Управление">

            <!-- Изменение цвета фона сцены -->
            <bim-color-input 
              label="Цвет фона" color="#202932" 
              @input="${({ target }) => {
                world.scene.config.backgroundColor = new THREE.Color(target.color);
              }}">
            </bim-color-input>

            <!-- Интенсивность направленного света -->
            <bim-number-input 
              slider step="0.1" label="Настройка направленного света" value="1.5" min="0.1" max="10"
              @change="${({ target }) => {
                world.scene.config.directionalLight.intensity = target.value;
              }}">
            </bim-number-input>

            <!-- Интенсивность рассеянного света -->
            <bim-number-input 
              slider step="0.1" label="Настройка рассеянного света" value="1" min="0.1" max="5"
              @change="${({ target }) => {
                world.scene.config.ambientLight.intensity = target.value;
              }}">
            </bim-number-input>

            <!-- Переключатель видимости сетки -->
            <bim-checkbox label="Включить отображение сетки" checked 
              @change="${({ target }) => {
                grid.config.visible = target.value;
              }}">
            </bim-checkbox>

            <!-- Изменение цвета сетки -->
            <bim-color-input 
              label="Цвет сетки" color="#bbbbbb" 
              @input="${({ target }) => {
                grid.config.color = new THREE.Color(target.color);
              }}">
            </bim-color-input>

            <!-- Размер ячеек сетки -->
            <bim-number-input 
              slider step="0.1" label="Размер основной сетки" value="1" min="0" max="10"
              @change="${({ target }) => {
                grid.config.primarySize = target.value;
                grid.config.secondarySize = target.value + 10;
              }}">
            </bim-number-input>

            <!-- Загрузка IFC-файла -->
            <input type="file" accept=".ifc" 
              @change="${(event) => {
                const file = event.target.files[0];
                if (file) loadIfcFromLocalFile(file);
              }}">

            <!-- Экспорт фрагментов -->
            <bim-button label="Экспорт фрагментов"
              @click="${() => exportFragments()}">
            </bim-button>

            <!-- Очистка сцены -->
            <bim-button label="Очистить сцену"
              @click="${() => disposeFragments()}">
            </bim-button>

          </bim-panel-section>
        </bim-panel>
      `;
    });

    // Добавление панели на страницу
    document.body.appendChild(panel);

  });

  return null; 
}
