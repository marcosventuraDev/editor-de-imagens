// /assets/js/image-reducer/normalize.js
import { beginTxn, commitTxn } from "./history.js";

async function imageFromUrl(url) {
  const img = new Image();
  img.decoding = "async";
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  return img;
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Falha ao gerar blob"));
      resolve(blob);
    }, type, quality);
  });
}

function drawToCanvas(img, outW, outH, {
  type = "image/jpeg",
  background = "#ffffff",
  strategy = "contain",
  maxW,
  maxH,
  noUpscale = true,
} = {}) {
  const canvas = document.createElement("canvas");

  if (strategy === "square-pad") {
    canvas.width = maxW;
    canvas.height = maxH;
  } else {
    canvas.width = outW;
    canvas.height = outH;
  }

  const c = canvas.getContext("2d", { alpha: true });
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";

  if (type === "image/jpeg") {
    c.fillStyle = background;
    c.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    c.clearRect(0, 0, canvas.width, canvas.height);
  }

  if (strategy === "square-pad") {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.min(maxW / iw, maxH / ih, noUpscale ? 1 : Infinity);
    const dw = Math.round(iw * scale);
    const dh = Math.round(ih * scale);
    const dx = Math.round((maxW - dw) / 2);
    const dy = Math.round((maxH - dh) / 2);
    c.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
  } else {
    c.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, outW, outH);
  }

  return canvas;
}

async function encodeUnderBytes(canvas, {
  type = "image/jpeg",
  maxBytes,
  qualityMax = 0.92,
  qualityMin = 0.45,
  steps = 7,
} = {}) {
  if (type === "image/png") {
    const blob = await canvasToBlob(canvas, type);
    return { blob, qualityUsed: null };
  }

  let lo = qualityMin;
  let hi = qualityMax;
  let best = null;

  for (let i = 0; i < steps; i++) {
    const q = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, type, q);

    if (blob.size <= maxBytes) {
      best = { blob, qualityUsed: q };
      lo = q;
    } else {
      hi = q;
    }
  }

  if (!best) {
    const blob = await canvasToBlob(canvas, type, qualityMin);
    return { blob, qualityUsed: qualityMin };
  }

  return best;
}

export async function normalizeSelected(ctx, options = {}) {
  const { dom, config, state, ui } = ctx;

  const selected = dom.thumbsGrid.querySelector(".ir-thumb.is-selected");
  if (!selected) {
    ui.setMsg("Selecione uma miniatura antes de ajustar.", true);
    return;
  }

  const url = selected.dataset.full;
  if (!url) return;

  // ✅ BEGIN UNDO TRANSACTION
  const txn = beginTxn(ctx, "fix");
  if (!txn) return;

  const rules = config.rules;
  const {
    strategy = "contain",
    type = "image/jpeg",
    background = "#ffffff",
    noUpscale = true,
    qualityMax = 0.92,
    qualityMin = 0.45,
    steps = 7,
  } = options;

  let img;
  try {
    img = await imageFromUrl(url);
  } catch (e) {
    console.error(e);
    ui.setMsg("Não consegui carregar a imagem para ajustar.", true);
    return;
  }

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  const scale = Math.min(rules.maxW / iw, rules.maxH / ih, noUpscale ? 1 : Infinity);
  let outW = Math.max(1, Math.round(iw * scale));
  let outH = Math.max(1, Math.round(ih * scale));

  let finalBlob = null;
  let finalW = outW;
  let finalH = outH;
  let finalQ = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = drawToCanvas(img, finalW, finalH, {
      type, background, strategy,
      maxW: rules.maxW, maxH: rules.maxH,
      noUpscale,
    });

    const { blob, qualityUsed } = await encodeUnderBytes(canvas, {
      type,
      maxBytes: rules.maxBytes,
      qualityMax,
      qualityMin,
      steps,
    });

    finalBlob = blob;
    finalQ = qualityUsed;

    if (blob.size <= rules.maxBytes) break;

    const factor = Math.sqrt(rules.maxBytes / blob.size) * 0.92;
    finalW = Math.max(1, Math.floor(finalW * factor));
    finalH = Math.max(1, Math.floor(finalH * factor));

    if (strategy === "square-pad") {
      ui.setMsg("Arquivo ainda grande; ajustando com redução extra…", true);
    }
  }

  if (!finalBlob) {
    ui.setMsg("Falha ao ajustar a imagem.", true);
    return;
  }

  const newUrl = URL.createObjectURL(finalBlob);
  state.objectUrls.add(newUrl);

  // ❌ NÃO revokeUrl(url, state)  -> isso mata o Undo

  const newW = (strategy === "square-pad") ? rules.maxW : finalW;
  const newH = (strategy === "square-pad") ? rules.maxH : finalH;

  selected.dataset.full = newUrl;
  selected.dataset.w = String(newW);
  selected.dataset.h = String(newH);
  selected.dataset.bytes = String(finalBlob.size);

  const thumbImg = selected.querySelector("img");
  if (thumbImg) thumbImg.src = newUrl;

  dom.mainPreview.src = newUrl;
  dom.mainPreview.style.display = "block";
  dom.emptyState.style.display = "none";

  selected.click();

  // ✅ COMMIT UNDO TRANSACTION
  commitTxn(ctx, txn);

  const qText = (finalQ == null) ? "" : ` (q=${finalQ.toFixed(2)})`;
  ui.setMsg(`Imagem ajustada para o padrão.${qText}`, false);
  ui.updateUIControls();
}