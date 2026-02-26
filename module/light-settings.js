const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE_ID = "bm-lampe-torche";
const GLOBAL_API_KEY = "BmLampeTorche";
const MAX_LIGHT_RADIUS_SETTING = "maxLightRadius";

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
    const maxRadius = getConfiguredMaxLightRadius();
    const maxRadiusValue = getRawConfiguredMaxLightRadius();

    const selectedLightKey = this.options.selectedLightKey || "torchLight";
    const selectedModelRaw = models.find(model => model.key === selectedLightKey) || models[0] || {};
    const selectedModel = clampLightPreset({
      intensity: 0.5,
      dim: 0,
      bright: 0,
      angle: 360,
      color: "#ffffff",
      ...selectedModelRaw
    }, maxRadius);

    return {
      ...context,
      models,
      selectedLightKey,
      selectedModel,
      effectiveMaxRadius: Number.isFinite(maxRadius) ? maxRadius : 9999,
      maxRadiusEnabled: Number.isFinite(maxRadius) && maxRadius > 0,
      maxLightRadiusValue: maxRadiusValue
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
    const syncRadiusUiConstraints = () => {
      const rawMax = normalizeMaxLightRadiusSettingValue(html.querySelector("#al-max-radius")?.value);
      const effectiveMax = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 9999;
      const dimInput = html.querySelector("#al-dim");
      const brightInput = html.querySelector("#al-bright");
      if (dimInput) dimInput.max = String(effectiveMax);
      if (brightInput) brightInput.max = String(effectiveMax);
      const note = html.querySelector(".al-form-note");
      if (note) {
        note.textContent = (rawMax > 0)
          ? `Rayon max applique : ${effectiveMax} (mettre 0 pour illimite)`
          : "Rayon max illimite (0)";
      }
    };

    html.querySelector("#light-select")?.addEventListener("change", event => {
      const api = window[GLOBAL_API_KEY] || { models: {} };
      const selectedKey = event.target.value;
      const model = api.models?.[selectedKey];
      if (!model) return;
      const normalized = clampLightPreset(model);

      html.querySelector("#al-color").value = normalized.color || "#ffffff";
      html.querySelector("#al-dim").value = normalized.dim ?? 0;
      html.querySelector("#al-bright").value = normalized.bright ?? 0;
      html.querySelector("#al-angle").value = normalized.angle ?? 360;
      html.querySelector("#al-intensity").value = normalized.intensity ?? 0.5;
      html.querySelector("#al-intensity-value").textContent = String(normalized.intensity ?? 0.5);

      const animationSelect = html.querySelector("#al-animation");
      if (animationSelect) {
        animationSelect.value = normalized.animation?.type || "none";
      }
    });

    html.querySelectorAll("input[type='range']").forEach(input => {
      input.addEventListener("input", event => {
        const target = event.target;
        const display = html.querySelector(`#${target.id}-value`);
        if (display) display.textContent = target.value;
      });
    });

    html.querySelector("#al-max-radius")?.addEventListener("change", () => {
      syncRadiusUiConstraints();
      const dimInput = html.querySelector("#al-dim");
      const brightInput = html.querySelector("#al-bright");
      const maxRadius = normalizeMaxLightRadiusSettingValue(html.querySelector("#al-max-radius")?.value);
      const normalized = normalizeLightRadii(dimInput?.value, brightInput?.value, normalizeMaxLightRadiusLimit(maxRadius));
      if (dimInput) dimInput.value = String(normalized.dim);
      if (brightInput) brightInput.value = String(normalized.bright);
    });

    html.querySelectorAll("#al-dim, #al-bright").forEach(input => {
      input.addEventListener("change", () => {
        const dimInput = html.querySelector("#al-dim");
        const brightInput = html.querySelector("#al-bright");
        const rawMax = normalizeMaxLightRadiusSettingValue(html.querySelector("#al-max-radius")?.value);
        const normalized = normalizeLightRadii(dimInput?.value, brightInput?.value, normalizeMaxLightRadiusLimit(rawMax));
        if (dimInput) dimInput.value = String(normalized.dim);
        if (brightInput) brightInput.value = String(normalized.bright);
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

      const requestedMaxRadius = normalizeMaxLightRadiusSettingValue(data.maxLightRadius);
      const effectiveMaxRadius = normalizeMaxLightRadiusLimit(requestedMaxRadius);
      const currentMaxRadiusRaw = getRawConfiguredMaxLightRadius();
      if (requestedMaxRadius !== currentMaxRadiusRaw) {
        await game.settings.set(MODULE_ID, MAX_LIGHT_RADIUS_SETTING, requestedMaxRadius);
      }

      const radii = normalizeLightRadii(data.dim, data.bright, effectiveMaxRadius);
      const updatedLight = {
        color: data.color,
        intensity: Number.parseFloat(data.intensity),
        dim: radii.dim,
        bright: radii.bright,
        angle: Number.parseInt(data.angle, 10),
        animation: {
          type: data.animation,
          speed: modelData.animation?.speed ?? 3,
          intensity: modelData.animation?.intensity ?? 3
        }
      };

      api.models[selectedKey] = foundry.utils.mergeObject(modelData, updatedLight, { overwrite: true });
      api.models = clampAllLightModels(api.models, effectiveMaxRadius);

      try {
        await saveLightModels(api.models);
        await applyPresetToTargetsOnSave.call(this, selectedKey);

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

    syncRadiusUiConstraints();
  }
}

async function saveLightModels(models) {
  await game.settings.set(MODULE_ID, "lightModels", models);
}

function getRawConfiguredMaxLightRadius() {
  const raw = Number(game.settings?.get?.(MODULE_ID, MAX_LIGHT_RADIUS_SETTING));
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, raw);
}

function getConfiguredMaxLightRadius() {
  return normalizeMaxLightRadiusLimit(getRawConfiguredMaxLightRadius());
}

function normalizeMaxLightRadiusSettingValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric * 100) / 100);
}

function normalizeMaxLightRadiusLimit(value) {
  const normalized = normalizeMaxLightRadiusSettingValue(value);
  return normalized > 0 ? normalized : null;
}

function clampLightRadius(value, maxRadius = null) {
  const numeric = Number(value);
  const base = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  if (!(Number.isFinite(maxRadius) && maxRadius > 0)) return base;
  return Math.min(base, maxRadius);
}

function normalizeLightRadii(dimValue, brightValue, maxRadius = null) {
  const dim = clampLightRadius(dimValue, maxRadius);
  const bright = clampLightRadius(brightValue, maxRadius);
  return {
    dim: Math.max(dim, bright),
    bright
  };
}

function clampLightPreset(model = {}, maxRadius = getConfiguredMaxLightRadius()) {
  const radii = normalizeLightRadii(model.dim, model.bright, maxRadius);
  return {
    ...model,
    dim: radii.dim,
    bright: radii.bright
  };
}

function clampAllLightModels(models = {}, maxRadius = getConfiguredMaxLightRadius()) {
  const next = {};
  for (const [key, model] of Object.entries(models)) {
    next[key] = clampLightPreset(model, maxRadius);
  }
  return next;
}

async function applyPresetToTargetsOnSave(selectedKey) {
  const api = window[GLOBAL_API_KEY];
  if (!api?.applyLight) return;

  const targetTokens = [];
  const seen = new Set();
  const optionTokenId = String(this?.options?.tokenId || "").trim();
  if (optionTokenId) {
    const token = canvas?.tokens?.get?.(optionTokenId);
    if (token?.document) {
      targetTokens.push(token);
      seen.add(String(token.id || token.document.id || ""));
    }
  }

  for (const token of canvas?.tokens?.controlled || []) {
    const tokenId = String(token?.id || token?.document?.id || "").trim();
    if (!token?.document || !tokenId || seen.has(tokenId)) continue;
    targetTokens.push(token);
    seen.add(tokenId);
  }

  if (!targetTokens.length) return;

  for (const token of targetTokens) {
    try {
      await token.document.setFlag(MODULE_ID, "chosenModel", selectedKey);
      await api.applyLight(token, selectedKey);
    } catch (error) {
      console.warn(`${MODULE_ID} | failed to apply preset "${selectedKey}" on save`, error);
    }
  }
}
