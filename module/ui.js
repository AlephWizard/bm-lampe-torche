const MODULE_ID = "bm-lampe-torche";
const GLOBAL_API_KEY = "BmLampeTorche";
const TOKEN_TOGGLE_PENDING = new Set();

Hooks.on("renderTokenHUD", (hud, html, data) => {
  const tokenButtonEnabled = game.settings.get(MODULE_ID, "tokenButton");
  if (!tokenButtonEnabled && !game.user.isGM) return;

  const lightIcon = game.settings.get(MODULE_ID, "lightIcon");
  const token = canvas.tokens.get(data._id);
  if (!token?.document) return;

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
    await runTokenToggleAction(data._id, async () => {
      await lightson(data._id);
    });
  });

  offButton.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    await runTokenToggleAction(data._id, async () => {
      await lightsoff(data._id);
    });
  });

  const openPanelFromHud = ev => {
    ev.preventDefault();
    ev.stopPropagation();
    openTorchControlPanelForToken(token);
  };
  onButton.addEventListener("contextmenu", openPanelFromHud);
  offButton.addEventListener("contextmenu", openPanelFromHud);

  const leftCol = html.querySelector(".col.left");
  if (!leftCol) return;
  leftCol.appendChild(onButton);
  leftCol.appendChild(offButton);
});

function createHudButton(iconClass, displayStyle) {
  const div = document.createElement("div");
  div.className = "control-icon al-icon";
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

async function lightson(tokenId, defaultModel = "torchLight") {
  const token = canvas.tokens.get(tokenId);
  if (!token) {
    console.error(`${MODULE_ID} | Token with ID ${tokenId} not found.`);
    return;
  }

  let chosenModel = token.document.getFlag(MODULE_ID, "chosenModel");
  if (!chosenModel) chosenModel = defaultModel;

  await backupTokensLight(token);

  try {
    const api = window[GLOBAL_API_KEY];
    if (!api?.applyLight) {
      console.warn(`${MODULE_ID} | API applyLight indisponible.`);
      return;
    }
    await api.applyLight(token, chosenModel);
    console.log(`${MODULE_ID} | light on with settings from ${chosenModel}`);
  } catch (error) {
    console.error(`${MODULE_ID} | Error applying light for token:`, error);
  }
}

function openTorchControlPanelForToken(token) {
  if (!token?.document) return;
  const selectedLightKey = String(token.document.getFlag(MODULE_ID, "chosenModel") || "torchLight").trim() || "torchLight";
  const tokenId = String(token.id || token.document.id || "").trim();
  try {
    const app = window[GLOBAL_API_KEY]?.openControlPanel?.({
      selectedLightKey,
      tokenId,
      applyOnSave: true
    });
    if (!app) {
      ui.notifications?.warn?.("BM Lampe Torche | Panneau de configuration indisponible.");
    }
  } catch (error) {
    console.error(`${MODULE_ID} | Error opening control panel for token:`, error);
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
