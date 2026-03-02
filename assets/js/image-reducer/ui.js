// /assets/js/image-reducer/ui.js
import { bytesToHuman } from './helpers.js';

export function createUI(dom, config) {
  function countThumbs() {
    return dom.thumbsGrid.querySelectorAll('.ir-thumb').length;
  }

  function setMsg(text, warn = false) {
    dom.irMsg.textContent = text;
    dom.irMsg.classList.toggle('warn', !!warn);
  }

  function setMeta({ w, h, bytes, ok }) {
    if (dom.metaDims) dom.metaDims.textContent = (w && h) ? `${w}×${h}` : '—';
    if (dom.metaSize) dom.metaSize.textContent = bytes ? bytesToHuman(bytes) : '—';

    if (dom.metaStatusPill) {
      dom.metaStatusPill.classList.remove('ok', 'bad');
      dom.metaStatusPill.classList.add(ok ? 'ok' : 'bad');

      const icon = dom.metaStatusPill.querySelector('i');
      if (icon) icon.className = ok ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark';
    }

    if (dom.metaStatusText) dom.metaStatusText.textContent = ok ? 'Compatível' : 'Fora do padrão';

    setMsg(
      ok ? 'Imagem compatível com as regras.'
         : 'A imagem está fora do padrão. Ajuste (corte/resize/compressão).',
      !ok
    );
  }

  function resetMeta() {
    if (dom.metaDims) dom.metaDims.textContent = '—';
    if (dom.metaSize) dom.metaSize.textContent = '—';

    if (dom.metaStatusPill) {
      dom.metaStatusPill.classList.remove('ok', 'bad');
      const icon = dom.metaStatusPill.querySelector('i');
      if (icon) icon.className = 'fa-solid fa-circle-info';
    }

    if (dom.metaStatusText) dom.metaStatusText.textContent = '—';
  }

 function updateUIControls() {
  const n = countThumbs();

  dom.irCountSpan.textContent = `${n}/${config.maxImages}`;

  const sel = dom.thumbsGrid.querySelector('.ir-thumb.is-selected');
  const hasSelected = !!sel;
  const hasAny = n > 0;


  dom.btnRemove.disabled = !hasSelected;
  dom.btnCrop.disabled   = !hasSelected;
  if (dom.btnFix) dom.btnFix.disabled = !hasSelected;
  dom.btnSave.disabled   = !hasAny;
  if (dom.btnRotateL) dom.btnRotateL.disabled = !hasSelected;
  if (dom.btnRotateR) dom.btnRotateR.disabled = !hasSelected;

  if (!hasAny) {
    dom.emptyState.style.display = 'flex';
    dom.mainPreview.style.display = 'none';
    dom.mainPreview.removeAttribute('src');
    dom.previewMeta.style.display = 'none';
    setMsg('Clique no preview para adicionar imagens.', false);
  } else {
    dom.previewMeta.style.display = 'flex';
  }
}

  return { countThumbs, setMsg, setMeta, resetMeta, updateUIControls };
}