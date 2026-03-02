// /assets/js/image-reducer/cropper.js
import { beginTxn, commitTxn } from "./history.js";

// Se você NÃO tiver revokeUrl em helpers.js, use isso:
// const revokeUrl = (url, state) => { if (url && state.objectUrls.has(url)) { URL.revokeObjectURL(url); state.objectUrls.delete(url); } };

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// object-fit: scale-down (equivalente a contain, sem upscale)
function getFittedRect(containerW, containerH, imgW, imgH) {
  const scale = Math.min(containerW / imgW, containerH / imgH, 1);
  const w = imgW * scale;
  const h = imgH * scale;
  const x = (containerW - w) / 2;
  const y = (containerH - h) / 2;
  return { x, y, w, h, scale };
}

function px(n) { return `${Math.round(n)}px`; }

function createOverlay(container) {
  const overlay = document.createElement("div");
  overlay.addEventListener("pointerdown", (e) => e.stopPropagation());
  overlay.addEventListener("click", (e) => e.stopPropagation());
  overlay.className = "ir-crop-overlay";

  const rect = document.createElement("div");
  rect.className = "ir-crop-rect";

  const handles = ["n","s","e","w","ne","nw","se","sw"].map(h => {
    const el = document.createElement("div");
    el.className = "ir-crop-handle";
    el.dataset.h = h;
    rect.appendChild(el);
    return el;
  });

  const bar = document.createElement("div");
  bar.className = "ir-crop-bar";
  bar.innerHTML = `
    <button type="button" class="btn btn-light btn-sm" data-crop="cancel">Cancelar</button>
    <button type="button" class="btn btn-primary btn-sm" data-crop="apply">Aplicar corte</button>
  `;

  overlay.appendChild(rect);
  overlay.appendChild(bar);

  container.appendChild(overlay);
  return { overlay, rect, bar };
}

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

/**
 * ctx esperado:
 * {
 *   dom, config, state,
 *   ui: { setMsg, updateUIControls, ... }
 * }
 */
export async function openCropperForSelected(ctx) {
  const { dom, state, ui } = ctx;


  state.isCropping = true;    
   state._cropTxn = beginTxn(ctx, "crop");       // trava
  if (dom.fileInput) dom.fileInput.disabled = true; // garante que click não abre file picker

  // opcional: feedback visual
  dom.previewClickable.classList.add('is-cropping');

  const selected = dom.thumbsGrid.querySelector(".ir-thumb.is-selected");
  if (!selected) {
    ui.setMsg("Selecione uma miniatura antes de cortar.", true);
    return;
  }

  const url = selected.dataset.full;
  if (!url) return;

  // container do overlay: o mesmo do preview (tem position relative)
  const container = dom.previewClickable; // #previewClickable
  if (!container) return;

  // cria overlay 1x e reaproveita
  if (!state._cropper) {
    state._cropper = createOverlay(container);
  }
  const { overlay, rect, bar } = state._cropper;

  // pega dimensão do container em px
  const cw = container.clientWidth;
  const ch = container.clientHeight;

  // natural size vem do dataset (mais rápido); se faltar, lê da imagem
  let imgW = Number(selected.dataset.w || 0);
  let imgH = Number(selected.dataset.h || 0);

  let img;
  try {
    img = await imageFromUrl(url);
    if (!imgW || !imgH) {
      imgW = img.naturalWidth;
      imgH = img.naturalHeight;
      selected.dataset.w = String(imgW);
      selected.dataset.h = String(imgH);
    }
  } catch (e) {
    console.error(e);
    ui.setMsg("Não consegui carregar a imagem para cortar.", true);
    return;
  }

  const fit = getFittedRect(cw, ch, imgW, imgH);

  // inicia seleção (80% da área útil)
  const startW = fit.w * 0.8;
  const startH = fit.h * 0.8;
  let r = {
    x: fit.x + (fit.w - startW) / 2,
    y: fit.y + (fit.h - startH) / 2,
    w: startW,
    h: startH
  };

  // aplica no DOM
  function renderRect() {
    rect.style.left = px(r.x);
    rect.style.top = px(r.y);
    rect.style.width = px(r.w);
    rect.style.height = px(r.h);
  }

  function constrain() {
    // mantém dentro da área da imagem (fit.x/y/w/h)
    const minSize = 40;
    r.w = Math.max(minSize, r.w);
    r.h = Math.max(minSize, r.h);

    r.x = clamp(r.x, fit.x, fit.x + fit.w - r.w);
    r.y = clamp(r.y, fit.y, fit.y + fit.h - r.h);
  }

  constrain();
  renderRect();

  overlay.style.display = "block";
  ui.setMsg("Arraste para mover. Use as alças para cortar horizontal/vertical. (Shift = mantém proporção)", false);

  // interação (move/resize)
  let mode = null; // "move" ou handle tipo "e","nw"...
  let start = null;

  function onDown(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const t = ev.target;

    mode = t?.dataset?.h ? t.dataset.h : "move";
    start = { x: ev.clientX, y: ev.clientY, r: { ...r } };

    rect.setPointerCapture?.(ev.pointerId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  function onMove(ev) {
    const dx = ev.clientX - start.x;
    const dy = ev.clientY - start.y;

    // mantém proporção com shift
    const keepRatio = ev.shiftKey;
    const ratio = start.r.w / start.r.h;

    // coordenadas por cantos
    let x1 = start.r.x;
    let y1 = start.r.y;
    let x2 = start.r.x + start.r.w;
    let y2 = start.r.y + start.r.h;

    if (mode === "move") {
      r.x = start.r.x + dx;
      r.y = start.r.y + dy;
      constrain();
      renderRect();
      return;
    }

    // resize por handles (horizontal/vertical/cantos)
    if (mode.includes("e")) x2 += dx;
    if (mode.includes("w")) x1 += dx;
    if (mode.includes("s")) y2 += dy;
    if (mode.includes("n")) y1 += dy;

    // clamp dentro do fit
    x1 = clamp(x1, fit.x, fit.x + fit.w);
    x2 = clamp(x2, fit.x, fit.x + fit.w);
    y1 = clamp(y1, fit.y, fit.y + fit.h);
    y2 = clamp(y2, fit.y, fit.y + fit.h);

    // min size
    const minSize = 40;
    if (x2 - x1 < minSize) {
      if (mode.includes("w")) x1 = x2 - minSize;
      else x2 = x1 + minSize;
    }
    if (y2 - y1 < minSize) {
      if (mode.includes("n")) y1 = y2 - minSize;
      else y2 = y1 + minSize;
    }

    // mantém proporção (opcional)
    if (keepRatio) {
      const w = x2 - x1;
      const h = y2 - y1;
      const targetH = w / ratio;

      // ajusta verticalmente preservando a âncora do handle
      if (targetH <= fit.h) {
        if (mode.includes("n")) y1 = y2 - targetH;
        else y2 = y1 + targetH;

        // clamp de novo
        y1 = clamp(y1, fit.y, fit.y + fit.h);
        y2 = clamp(y2, fit.y, fit.y + fit.h);
      }
    }

    r.x = Math.min(x1, x2);
    r.y = Math.min(y1, y2);
    r.w = Math.abs(x2 - x1);
    r.h = Math.abs(y2 - y1);

    constrain();
    renderRect();
  }

  function cleanup() {
    window.removeEventListener("pointermove", onMove);
    rect.removeEventListener("pointerdown", onDown);
    bar.removeEventListener("click", onBarClick);
    overlay.style.display = "none";

    state.isCropping = false;               //libera
    state._cropTxn = null;
    if (dom.fileInput) dom.fileInput.disabled = false;
    dom.previewClickable.classList.remove('is-cropping');

    mode = null;
    start = null;
  }

  async function applyCrop() {
    // converte retângulo de tela para pixels reais
    const cropX = (r.x - fit.x) / fit.scale;
    const cropY = (r.y - fit.y) / fit.scale;
    const cropW = r.w / fit.scale;
    const cropH = r.h / fit.scale;

    const x = Math.round(clamp(cropX, 0, imgW - 1));
    const y = Math.round(clamp(cropY, 0, imgH - 1));
    const w = Math.round(clamp(cropW, 1, imgW - x));
    const h = Math.round(clamp(cropH, 1, imgH - y));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const c = canvas.getContext("2d");
    c.drawImage(img, x, y, w, h, 0, 0, w, h);

    // saída: jpeg (você pode trocar para image/png se quiser)
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    const newUrl = URL.createObjectURL(blob);
    state.objectUrls.add(newUrl);

   

    selected.dataset.full = newUrl;
    selected.dataset.w = String(w);
    selected.dataset.h = String(h);
    selected.dataset.bytes = String(blob.size);

    // atualiza a imagem do thumb
    const thumbImg = selected.querySelector("img");
    if (thumbImg) thumbImg.src = newUrl;

    // atualiza preview principal
    dom.mainPreview.src = newUrl;
    dom.mainPreview.style.display = "block";
    dom.emptyState.style.display = "none";

    // força “reselecionar” para recalcular status/ok/bad + meta
    selected.click();

    // registra no histórico o AFTER
    commitTxn(ctx, state._cropTxn);

    ui.setMsg("Corte aplicado.", false);
    ui.updateUIControls();
  }

  async function onBarClick(ev) {
    const btn = ev.target.closest("[data-crop]");
    if (!btn) return;

    const act = btn.dataset.crop;
    if (act === "cancel") {
      cleanup();
      ui.setMsg("Corte cancelado.", false);
      return;
    }
    if (act === "apply") {
      try {
        await applyCrop();
      } catch (e) {
        console.error(e);
        ui.setMsg("Falha ao aplicar o corte.", true);
      } finally {
        cleanup();
      }
    }
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
  }

  rect.addEventListener("pointerdown", onDown);
  bar.addEventListener("click", onBarClick);
}