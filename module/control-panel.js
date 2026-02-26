import { ControlPanelLight } from "./light-settings.js";

const MODULE_ID = "bm-lampe-torche";
const GLOBAL_API_KEY = "BmLampeTorche";
const LIGHT_MODELS_SETTING = "lightModels";
const TOKEN_BUTTON_SETTING = "tokenButton";
const LIGHT_ICON_SETTING = "lightIcon";
const MAX_LIGHT_RADIUS_SETTING = "maxLightRadius";

export const DEFAULT_LIGHT_MODELS = {
  torchLight: {
    name: "agnostic-light.ui.torchLight",
    dim: 12,
    bright: 6,
    color: "#fab87a",
    angle: 360,
    alpha: 0.5,
    animation: { type: "flame", speed: 5, intensity: 5 }
  },
  lamp: {
    name: "agnostic-light.ui.lamp",
    dim: 12,
    bright: 9,
    color: "#ffa200",
    angle: 360,
    alpha: 0.5,
    animation: { type: "torch", speed: 3, intensity: 3 }
  },
  bullseye: {
    name: "agnostic-light.ui.bullseye",
    dim: 24,
    bright: 18,
    color: "#ffa200",
    angle: 45,
    alpha: 0.5,
    animation: { type: "torch", speed: 3, intensity: 3 },
    intensity: 0.5
  },
  hoodedOpen: {
    name: "agnostic-light.ui.hoodedOpen",
    dim: 24,
    bright: 10,
    color: "#ffa200",
    angle: 360,
    alpha: 0.5,
    animation: { type: "torch", speed: 3, intensity: 3 },
    intensity: 0.5
  },
  hoodedClosed: {
    name: "agnostic-light.ui.hoodedClosed",
    dim: 5,
    bright: 0,
    color: "#ffa200",
    angle: 360,
    alpha: 0.5,
    animation: { type: "torch", speed: 3, intensity: 3 },
    intensity: 0.5
  },
  lightcantrip: {
    name: "agnostic-light.ui.lightcantrip",
    dim: 14,
    bright: 7,
    color: "#fffab8",
    angle: 360,
    alpha: 0.5,
    animation: { type: "torch", speed: 2, intensity: 1 },
    intensity: 0.5
  },
  moontouched: {
    name: "agnostic-light.ui.moontouched",
    dim: 30,
    bright: 15,
    color: "#38c0f3",
    angle: 360,
    alpha: 0.5,
    animation: { type: "torch", speed: 1, intensity: 1 },
    intensity: 0.5
  },
  sunlight: {
    name: "agnostic-light.ui.sunlight",
    dim: 60,
    bright: 30,
    color: "#fff45c",
    angle: 360,
    alpha: 0.6,
    animation: { type: "torch", speed: 1, intensity: 5 },
    intensity: 0.5
  }
};

if (typeof Handlebars !== "undefined" && !Handlebars.helpers?.eq) {
  Handlebars.registerHelper("eq", (a, b) => a === b);
}

Hooks.once("init", async function () {
  console.log(`${MODULE_ID} | registering torch-only settings`);

  async function resetTorchPresets() {
    const lm = clampAllLightModels(foundry.utils.duplicate(DEFAULT_LIGHT_MODELS));
    await game.settings.set(MODULE_ID, LIGHT_MODELS_SETTING, lm);

    if (window[GLOBAL_API_KEY]) {
      window[GLOBAL_API_KEY].models = foundry.utils.duplicate(lm);
    }

    Hooks.callAll(`${MODULE_ID}:presetsReset`, { light: lm });
    ui.notifications.info(game.i18n.localize("agnostic-light.notifications.resetDone"));
  }

  class BmLampeTorcheResetNow extends FormApplication {
    async render(force, options) {
      await resetTorchPresets();
      return this;
    }
  }

  game.settings.register(MODULE_ID, LIGHT_MODELS_SETTING, {
    name: "Torch Light Models",
    hint: "Stores the configuration for torch light presets.",
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_LIGHT_MODELS
  });

  game.settings.register(MODULE_ID, TOKEN_BUTTON_SETTING, {
    name: game.i18n.localize("agnostic-light.controlPanel.tokenButton"),
    hint: game.i18n.localize("agnostic-light.controlPanel.tokenButtonhint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, LIGHT_ICON_SETTING, {
    name: game.i18n.localize("agnostic-light.controlPanel.lightIcon"),
    hint: game.i18n.localize("agnostic-light.controlPanel.lightIcon"),
    scope: "world",
    config: true,
    type: String,
    choices: {
      feu: game.i18n.localize("agnostic-light.controlPanel.lightIconfeu"),
      lampe: game.i18n.localize("agnostic-light.controlPanel.lightIconlampe")
    },
    default: "feu"
  });

  game.settings.register(MODULE_ID, MAX_LIGHT_RADIUS_SETTING, {
    name: "Rayon maximal de torche",
    hint: "Plafond applique aux rayons Tamise/Lumineux (en unites de scene). Mettre 0 pour aucune limite.",
    scope: "world",
    config: false,
    type: Number,
    default: 60
  });

  game.settings.registerMenu(MODULE_ID, "openControlPanel", {
    name: game.i18n.localize("agnostic-light.controlPanel.torchSettings"),
    label: game.i18n.localize("agnostic-light.controlPanel.config"),
    hint: game.i18n.localize("agnostic-light.controlPanel.confighint"),
    icon: "fa-solid fa-flashlight",
    type: ControlPanelLight,
    restricted: true
  });

  game.settings.registerMenu(MODULE_ID, "resetPresets", {
    name: game.i18n.localize("agnostic-light.controlPanel.resetPresetsName"),
    label: game.i18n.localize("agnostic-light.controlPanel.resetPresetsLabel"),
    hint: game.i18n.localize("agnostic-light.controlPanel.resetPresetsHint"),
    icon: "fas fa-undo",
    type: BmLampeTorcheResetNow,
    restricted: true
  });
});

Hooks.once("ready", async () => {
  const savedLight = foundry.utils.duplicate(game.settings.get(MODULE_ID, LIGHT_MODELS_SETTING) || {});
  const fixedLight = clampAllLightModels(sanitizeModels(savedLight, DEFAULT_LIGHT_MODELS, { strict: true }));

  if (!objectsEqual(savedLight, fixedLight)) {
    await game.settings.set(MODULE_ID, LIGHT_MODELS_SETTING, fixedLight);
    ui.notifications.info(game.i18n.localize("agnostic-light.notifications.lightReset"));
  }

  window[GLOBAL_API_KEY] = {
    models: fixedLight,

    openControlPanel(options = {}) {
      const app = new ControlPanelLight(options);
      app.render(true);
      return app;
    },

    async applyLight(token, lightKey) {
      const preset = this.models[lightKey];
      if (!preset) return;
      const normalizedPreset = clampLightPreset(preset);
      await token.document.update({
        light: {
          dim: normalizedPreset.dim,
          bright: normalizedPreset.bright,
          color: normalizedPreset.color,
          angle: normalizedPreset.angle,
          alpha: normalizedPreset.alpha,
          intensity: normalizedPreset.intensity,
          animation: normalizedPreset.animation
        }
      });
      await token.document.setFlag(MODULE_ID, "lightIconState", "on");
    },

    async resetLight(token) {
      const oldLight = token.document.getFlag(MODULE_ID, "base_light");
      await token.document.update({ light: oldLight ?? {} });
      await token.document.setFlag(MODULE_ID, "lightIconState", "off");
    }
  };
});

function objectsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sanitizeModels(saved, defaults, { strict = true } = {}) {
  const result = {};
  for (const [key, defModel] of Object.entries(defaults)) {
    const candidate = saved?.[key];
    if (!candidate) {
      result[key] = foundry.utils.duplicate(defModel);
      continue;
    }

    if (strict) {
      const mismatch = Object.entries(defModel).some(([k, v]) => {
        if (!(k in candidate)) return true;
        if (v !== null && typeof v === "object") return typeof candidate[k] !== "object";
        return (candidate[k] !== null && typeof candidate[k] !== typeof v);
      });
      result[key] = mismatch
        ? foundry.utils.duplicate(defModel)
        : foundry.utils.mergeObject(defModel, candidate, {
            inplace: false,
            insertKeys: true,
            insertValues: true,
            overwrite: true,
            enforceTypes: true
          });
    } else {
      result[key] = foundry.utils.mergeObject(defModel, candidate, {
        inplace: false,
        insertKeys: true,
        insertValues: true,
        overwrite: true,
        enforceTypes: true
      });
    }
  }
  return result;
}

function getConfiguredMaxLightRadius() {
  const raw = Number(game.settings?.get?.(MODULE_ID, MAX_LIGHT_RADIUS_SETTING));
  if (!Number.isFinite(raw)) return null;
  if (raw <= 0) return null;
  return raw;
}

function clampLightRadius(value, maxRadius = null) {
  const numeric = Number(value);
  const clampedMin = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  if (!(Number.isFinite(maxRadius) && maxRadius > 0)) return clampedMin;
  return Math.min(clampedMin, maxRadius);
}

function clampLightPreset(preset = {}) {
  const maxRadius = getConfiguredMaxLightRadius();
  const dim = clampLightRadius(preset.dim, maxRadius);
  const bright = clampLightRadius(preset.bright, maxRadius);
  return {
    ...preset,
    dim: Math.max(dim, bright),
    bright
  };
}

function clampAllLightModels(models = {}) {
  const next = {};
  for (const [key, model] of Object.entries(models)) {
    next[key] = clampLightPreset(model);
  }
  return next;
}
