const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE_ID = "bm-lampe-torche";
const GLOBAL_API_KEY = "BmLampeTorche";

export class ControlPanelLight extends HandlebarsApplicationMixin(ApplicationV2) {
  static get PARTS() {
    return {
      body: {
        template: `modules/${MODULE_ID}/templates/control-panel-light.hbs`
      }
    };
  }

  static get DEFAULT_OPTIONS() {
    return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      id: `${MODULE_ID}-control-panel-light`,
      window: {
        resizable: true,
        autoResize: false
      }
    });
  }

  get title() {
    return game.i18n.localize("agnostic-light.controlPanel.title");
  }

  _prepareContext(context) {
    const api = window[GLOBAL_API_KEY] || { models: {} };
    const models = Object.entries(api.models || {}).map(([key, model]) => ({
      key,
      ...model
    }));

    const selectedLightKey = this.options.selectedLightKey || "torchLight";
    const selectedModelRaw = models.find(model => model.key === selectedLightKey) || models[0] || {};
    const selectedModel = {
      intensity: 0.5,
      dim: 0,
      bright: 0,
      angle: 360,
      color: "#ffffff",
      ...selectedModelRaw
    };

    return {
      ...context,
      models,
      selectedLightKey,
      selectedModel
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);

    if (!this._alSizedOnce) {
      this._alSizedOnce = true;
      queueMicrotask(() => {
        try { this.setPosition({ width: 560, height: 470 }); } catch (_error) {}
      });
    }

    requestAnimationFrame(() => {
      const content = this.element.querySelector(".window-content");
      if (content) {
        content.classList.add("bm-lampe-torche-panel-content");
        this.activateListeners(content);
      }
    });
  }

  activateListeners(html) {
    html.querySelector("#light-select")?.addEventListener("change", event => {
      const api = window[GLOBAL_API_KEY] || { models: {} };
      const selectedKey = event.target.value;
      const model = api.models?.[selectedKey];
      if (!model) return;

      html.querySelector("#al-color").value = model.color || "#ffffff";
      html.querySelector("#al-dim").value = model.dim ?? 0;
      html.querySelector("#al-bright").value = model.bright ?? 0;
      html.querySelector("#al-angle").value = model.angle ?? 360;
      html.querySelector("#al-intensity").value = model.intensity ?? 0.5;
      html.querySelector("#al-intensity-value").textContent = String(model.intensity ?? 0.5);

      const animationSelect = html.querySelector("#al-animation");
      if (animationSelect) {
        animationSelect.value = model.animation?.type || "none";
      }
    });

    html.querySelectorAll("input[type='range']").forEach(input => {
      input.addEventListener("input", event => {
        const target = event.target;
        const display = html.querySelector(`#${target.id}-value`);
        if (display) display.textContent = target.value;
      });
    });

    html.querySelector(".al-submit-button")?.addEventListener("click", async () => {
      const api = window[GLOBAL_API_KEY] || { models: {} };
      const form = this.element.querySelector("form");
      if (!form) return;

      const formData = new FormData(form);
      const flatData = Object.fromEntries(formData.entries());
      const data = foundry.utils.expandObject(flatData);

      const lightSelect = form.querySelector("#light-select");
      const selectedKey = lightSelect?.value;
      const modelData = foundry.utils.duplicate(api.models?.[selectedKey] ?? {});

      if (!selectedKey || !modelData) {
        ui.notifications.error("BM Lampe Torche | Modele introuvable.");
        return;
      }

      const updatedLight = {
        color: data.color,
        intensity: Number.parseFloat(data.intensity),
        dim: Number.parseInt(data.dim, 10),
        bright: Number.parseInt(data.bright, 10),
        angle: Number.parseInt(data.angle, 10),
        animation: {
          type: data.animation,
          speed: modelData.animation?.speed ?? 3,
          intensity: modelData.animation?.intensity ?? 3
        }
      };

      api.models[selectedKey] = foundry.utils.mergeObject(modelData, updatedLight, { overwrite: true });

      try {
        await saveLightModels(api.models);

        const windowEl = this.element;
        if (windowEl) {
          windowEl.classList.add("flash-save");
          setTimeout(() => windowEl.classList.remove("flash-save"), 300);
        }
      } catch (error) {
        console.error("BM Lampe Torche | Erreur lors de la sauvegarde :", error);
        ui.notifications.error("BM Lampe Torche | Echec de la sauvegarde.");
      }
    });

    const animationSelect = html.querySelector("#al-animation");
    if (animationSelect) {
      const animations = Object.keys(CONFIG.Canvas.lightAnimations || {});
      animationSelect.innerHTML = "";
      animationSelect.append(new Option("None", "none"));
      for (const animation of animations) {
        const label = game.i18n.localize(CONFIG.Canvas.lightAnimations[animation]?.label || animation);
        animationSelect.append(new Option(label, animation));
      }

      const selectedKey = html.querySelector("#light-select")?.value;
      const api = window[GLOBAL_API_KEY] || { models: {} };
      const selectedModel = api.models?.[selectedKey];
      if (selectedModel?.animation?.type) {
        animationSelect.value = selectedModel.animation.type;
      }
    }
  }
}

async function saveLightModels(models) {
  await game.settings.set(MODULE_ID, "lightModels", models);
}
