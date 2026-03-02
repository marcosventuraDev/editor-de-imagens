// /assets/js/image-reducer/rotate.js
import { beginTxn, commitTxn } from "./history.js";

async function imageFromUrl(url) {
  const img = new Image();
  img.decoding = "async";
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

export async function rotateSelected(ctx, degrees = 90, {
  type = "image/jpeg",
  quality = 0.92,
  background = "#ffffff"
} = {}) {
  const { dom, state, ui } = ctx;

  const selected = dom.thumbsGrid.querySelector(".ir-thumb.is-selected");
  if (!selected) {
    ui.setMsg("Selecione uma miniatura antes de rotacionar.", true);
    return;
  }

  const txn = beginTxn(ctx, "rotate"); //  snapshot antes
  if (!txn) return;

  const url = selected.dataset.full;
  if (!url) return;

  let img;
  try { img = await imageFromUrl(url); }
  catch (e) { console.error(e); ui.setMsg("Não consegui carregar a imagem.", true); return; }

  let deg = Number(degrees) || 0;
  deg = ((deg % 360) + 360) % 360;
  if (![0, 90, 180, 270].includes(deg) || deg === 0) return;

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const swap = (deg === 90 || deg === 270);
  const outW = swap ? srcH : srcW;
  const outH = swap ? srcW : srcH;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;

  const c = canvas.getContext("2d");

  if (type === "image/jpeg") {
    c.fillStyle = background;
    c.fillRect(0, 0, outW, outH);
  }

  c.translate(outW / 2, outH / 2);
  c.rotate((deg * Math.PI) / 180);
  c.drawImage(img, -srcW / 2, -srcH / 2);

  try {
    const blob = await canvasToBlob(canvas, type, quality);
    const newUrl = URL.createObjectURL(blob);
    state.objectUrls.add(newUrl);

    // NÃO revoga a antiga (precisa pro undo)
    selected.dataset.full = newUrl;
    selected.dataset.w = String(outW);
    selected.dataset.h = String(outH);
    selected.dataset.bytes = String(blob.size);

    const thumbImg = selected.querySelector("img");
    if (thumbImg) thumbImg.src = newUrl;

    dom.mainPreview.src = newUrl;
    dom.mainPreview.style.display = "block";
    dom.emptyState.style.display = "none";

    selected.click();

    commitTxn(ctx, txn); // registra undo/redo

    ui.setMsg(`Rotacionado ${deg}°`, false);
    ui.updateUIControls();
  } catch (e) {
    console.error(e);
    ui.setMsg("Falha ao rotacionar a imagem.", true);
  }
}