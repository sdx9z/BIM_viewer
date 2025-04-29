import { onMount } from "solid-js";
import * as THREE from "three";
import * as WEBIFC from "web-ifc";
import * as BUI from "@thatopen/ui";
import Stats from "stats.js";
import * as OBC from "@thatopen/components";

export default function World() {
  onMount(() => {
    const container = document.getElementById("container");
    const components = new OBC.Components();
    const worlds = components.get(OBC.Worlds);

    const world = worlds.create(
      OBC.SimpleScene,
      OBC.SimpleCamera,
      OBC.SimpleRenderer
    );

    world.scene = new OBC.SimpleScene(components);
    world.renderer = new OBC.SimpleRenderer(components, container);
    world.camera = new OBC.SimpleCamera(components);

    components.init();
    world.scene.setup();
    world.scene.three.background = null;

    world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

    const grids = components.get(OBC.Grids);
    const grid = grids.create(world);

    const stats = new Stats();
    stats.showPanel(2);
    document.body.appendChild(stats.dom);
    stats.dom.style.left = "0px";
    stats.dom.style.zIndex = "unset";
    world.renderer.onBeforeUpdate.add(() => stats.begin());
    world.renderer.onAfterUpdate.add(() => stats.end());

    const fragments = components.get(OBC.FragmentsManager);
    const fragmentIfcLoader = components.get(OBC.IfcLoader);

    fragmentIfcLoader.setup();

    const excludedCats = [
      WEBIFC.IFCTENDONANCHOR,
      WEBIFC.IFCREINFORCINGBAR,
      WEBIFC.IFCREINFORCINGELEMENT,
    ];

    for (const cat of excludedCats) {
      fragmentIfcLoader.settings.excludedCategories.add(cat);
    }

    fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;

    async function loadIfcFromLocalFile(file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const buffer = new Uint8Array(event.target.result);
        const model = await fragmentIfcLoader.load(buffer);
        model.name = "local-model";
        world.scene.three.add(model);
      };
      reader.readAsArrayBuffer(file);
    }

    function download(file) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

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

    function disposeFragments() {
      fragments.dispose();
    }

    fragments.onFragmentsLoaded.add((model) => {
      console.log(model);
    });

    BUI.Manager.init();

    const panel = BUI.Component.create(() => {
      return BUI.html`
        <bim-panel label="Настройки отображения" class="options-menu">
          <bim-panel-section collapsed label="Управление">

            <bim-color-input 
              label="Цвет фона" color="#202932" 
              @input="${({ target }) => {
                world.scene.config.backgroundColor = new THREE.Color(target.color);
              }}">
            </bim-color-input>

            <bim-number-input 
              slider step="0.1" label="Настройка направленного света" value="1.5" min="0.1" max="10"
              @change="${({ target }) => {
                world.scene.config.directionalLight.intensity = target.value;
              }}">
            </bim-number-input>

            <bim-number-input 
              slider step="0.1" label="Настройка рассеянного света" value="1" min="0.1" max="5"
              @change="${({ target }) => {
                world.scene.config.ambientLight.intensity = target.value;
              }}">
            </bim-number-input>
            <bim-checkbox label="Включить отображение сетки" checked 
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

            <input type="file" accept=".ifc" 
              @change="${(event) => {
                const file = event.target.files[0];
                if (file) loadIfcFromLocalFile(file);
              }}">

            <bim-button label="Экспорт фрагментов"
              @click="${() => exportFragments()}">
            </bim-button>

            <bim-button label="Очистить сцену"
              @click="${() => disposeFragments()}">
            </bim-button>

          </bim-panel-section>
        </bim-panel>
      `;
    });

    document.body.appendChild(panel);

    const button = BUI.Component.create(() => {
      return BUI.html`
        <bim-button class="phone-menu-toggler" icon="solar:settings-bold"
          @click="${() => {
            if (panel.classList.contains("options-menu-visible")) {
              panel.classList.remove("options-menu-visible");
            } else {
              panel.classList.add("options-menu-visible");
            }
          }}">
        </bim-button>
      `;
    });

    document.body.append(button);
  });

  return null;
}