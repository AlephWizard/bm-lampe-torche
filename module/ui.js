const MODULE_ID = "bm-lampe-torche";
const GLOBAL_API_KEY = "BmLampeTorche";
const DEFAULT_LIGHT_MODEL_SETTING = "defaultLightModel";
const TOKEN_TOGGLE_PENDING = new Set();

Hooks.on("renderTokenHUD", (hud, html, data) => {
  const tokenButtonEnabled = game.settings.get(MODULE_ID, "tokenButton");
  if (!tokenButtonEnabled && !game.user.isGM) return;

  const lightIcon = game.settings.get(MODULE_ID, "lightIcon");
  const tokenId = resolveTokenId(hud, data);
  const token = canvas.tokens.get(tokenId) || hud?.object;
  if (!token?.document || !tokenId) return;

  const state = token.document.getFlag(MODULE_ID, "lightIconState") || "off";
  const offDisplay = state === "off" ? "initial" : "none";
  const onDisplay = state === "off" ? "none" : "initial";

  let onButton;
  let offButton;

  if (lightIcon === "lampe") {
    onButton = createHudButton("fa-solid fa-flashlight", offDisplay);
    offButton = createHudButton("fa-solid fa-lightbulb-slash", onDisplay);
  } else {
    onButton = createHudButton("fa-regular fa-fire", offDisplay);
    offButton = createHudButton("fa-solid fa-moon", onDisplay);
  }

  onButton.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    await runTokenToggleAction(tokenId, async () => {
      await lightson(tokenId);
    });
  });

  offButton.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    await runTokenToggleAction(tokenId, async () => {
      await lightsoff(tokenId);
    });
  });

  const hudElement = toHtmlElement(html);
  if (!hudElement) return;

  const leftCol = hudElement.querySelector(".col.left");
  if (!leftCol) return;
  leftCol.querySelectorAll("[data-bm-lampe-torche-hud='1']").forEach(el => el.remove());
  leftCol.appendChild(onButton);
  leftCol.appendChild(offButton);
});

function createHudButton(iconClass, displayStyle) {
  const div = document.createElement("div");
  div.className = "control-icon al-icon";
  div.dataset.bmLampeTorcheHud = "1";
  div.style.display = displayStyle;

  const icon = document.createElement("i");
  icon.className = iconClass;
  div.appendChild(icon);
  return div;
}

async function backupTokensLight(token) {
  const state = token.document.getFlag(MODULE_ID, "lightIconState") || "off";
  if (state !== "off") return;
  if (token.document.getFlag(MODULE_ID, "base_light")) return;

  const currentLight = token.document.light ?? {};
  const oldLight = {
    bright: currentLight.bright,
    dim: currentLight.dim,
    angle: currentLight.angle,
    color: currentLight.color,
    alpha: currentLight.alpha,
    intensity: currentLight.intensity,
    animation: {
      type: currentLight.animation?.type
    }
  };
  await token.document.setFlag(MODULE_ID, "base_light", oldLight);
}

async function lightsoff(tokenId) {
  const token = canvas.tokens.get(tokenId);
  if (!token) {
    console.error(`${MODULE_ID} | Token with ID ${tokenId} not found.`);
    return;
  }

  try {
    const api = window[GLOBAL_API_KEY];
    if (!api?.resetLight) {
      console.warn(`${MODULE_ID} | API resetLight indisponible.`);
      return;
    }
    await api.resetLight(token);
    console.log(`${MODULE_ID} | light off`);
  } catch (error) {
    console.error(`${MODULE_ID} | Error resetting light for token:`, error);
  }
}

async function lightson(tokenId) {
  const token = canvas.tokens.get(tokenId);
  if (!token) {
    console.error(`${MODULE_ID} | Token with ID ${tokenId} not found.`);
    return;
  }

  try {
    const api = window[GLOBAL_API_KEY];
    if (!api?.applyLight) {
      console.warn(`${MODULE_ID} | API applyLight indisponible.`);
      return;
    }
    const models = api.models || {};
    let chosenModel = String(token.document.getFlag(MODULE_ID, "chosenModel") || "").trim();
    if (!chosenModel || !models[chosenModel]) {
      chosenModel = getPreferredDefaultLightModel(models);
    }
    if (!chosenModel || !models[chosenModel]) {
      console.warn(`${MODULE_ID} | Aucun modele de lumiere valide configure.`);
      return;
    }

    await backupTokensLight(token);
    if (token.document.getFlag(MODULE_ID, "chosenModel") !== chosenModel) {
      await token.document.setFlag(MODULE_ID, "chosenModel", chosenModel);
    }

    await api.applyLight(token, chosenModel);
    console.log(`${MODULE_ID} | light on with settings from ${chosenModel}`);
  } catch (error) {
    console.error(`${MODULE_ID} | Error applying light for token:`, error);
  }
}

async function runTokenToggleAction(tokenId, action) {
  const key = String(tokenId || "").trim();
  if (!key || typeof action !== "function") return;
  if (TOKEN_TOGGLE_PENDING.has(key)) return;

  TOKEN_TOGGLE_PENDING.add(key);
  try {
    await action();
  } finally {
    TOKEN_TOGGLE_PENDING.delete(key);
  }
}

function resolveTokenId(hud, data) {
  return String(
    data?._id
    || data?.id
    || hud?.object?.id
    || hud?.object?.document?.id
    || ""
  ).trim();
}

function toHtmlElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

function getPreferredDefaultLightModel(models = {}) {
  const configured = String(game.settings.get(MODULE_ID, DEFAULT_LIGHT_MODEL_SETTING) || "").trim();
  if (configured && Object.prototype.hasOwnProperty.call(models, configured)) return configured;
  if (Object.prototype.hasOwnProperty.call(models, "torchLight")) return "torchLight";
  return Object.keys(models).find(Boolean) || "";
}
