// /assets/js/image-reducer/thumbs.js
import { checkCompatibility, loadImageInfo } from './helpers.js';
import { gcObjectUrls } from './history.js';


export function createThumbs(dom, config, state, ui) {

  function makeId() {
  return (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  }

  function selectThumb(card) {
    dom.thumbsGrid.querySelectorAll('.ir-thumb').forEach(el => el.classList.remove('is-selected'));
    card.classList.add('is-selected');

    const full = card.dataset.full;
    if (full) {
      dom.mainPreview.src = full;
      dom.mainPreview.style.display = 'block';
      dom.emptyState.style.display = 'none';
    }

    const w = Number(card.dataset.w || 0);
    const h = Number(card.dataset.h || 0);
    const bytes = Number(card.dataset.bytes || 0);

    const compat = checkCompatibility({ w, h, bytes }, config.rules);
    card.dataset.ok = compat.ok ? '1' : '0';

    const st = card.querySelector('.ir-thumb-status');
    if (st) {
      st.classList.toggle('ok', compat.ok);
      st.classList.toggle('bad', !compat.ok);
      st.innerHTML = compat.ok
        ? '<i class="fa-solid fa-check"></i>'
        : '<i class="fa-solid fa-xmark"></i>';
    }

    ui.setMeta({ w, h, bytes, ok: compat.ok });
    ui.updateUIControls();
  }

  function createThumb({ url, width, height, bytes, ok }) {
    const col = document.createElement('div');
    col.className = 'col';

    const id = makeId();

    const statusClass = ok ? 'ok' : 'bad';
    const statusIcon = ok ? 'fa-check' : 'fa-xmark';

    col.innerHTML = `
      <button type="button"
        class="btn w-100 ir-thumb"
        data-id="${id}"
        data-full="${url}"
        data-w="${width}" data-h="${height}" data-bytes="${bytes}" data-ok="${ok ? 1 : 0}">
        <div class="ir-thumb-inner ratio ratio-1x1">
          <img src="${url}" alt="Thumb" class="w-100 h-100 object-fit-down">
        </div>
        <div class="ir-thumb-check"><i class="fa-solid fa-check"></i></div>
        <div class="ir-thumb-status ${statusClass}"><i class="fa-solid ${statusIcon}"></i></div>
      </button>
    `;

    const btn = col.querySelector('.ir-thumb');
    btn.addEventListener('click', () => selectThumb(btn));

    return col;
  }

  function removeSelected() {
    const sel = dom.thumbsGrid.querySelector('.ir-thumb.is-selected');
    if (!sel) return;

    const col = sel.closest('.col') || sel.parentElement;

    // define o "próximo" antes de remover
    const next = col?.nextElementSibling?.querySelector('.ir-thumb')
              || col?.previousElementSibling?.querySelector('.ir-thumb');

    // remove primeiro
    col?.remove();

    // seleciona alguém (ou reseta)
    const stillAny = !!dom.thumbsGrid.querySelector('.ir-thumb');
    if (!stillAny) {
      ui.resetMeta();
    } else if (next) {
      selectThumb(next);
    } else {
      const first = dom.thumbsGrid.querySelector('.ir-thumb');
      if (first) selectThumb(first);
    }

    ui.updateUIControls();

    // GC depois (agora o removido não está mais na tela)
    gcObjectUrls({ dom, state, history: state.history });
  }

  async function addFiles(files) {
  const current = ui.countThumbs();
  const remaining = config.maxImages - current;

  if (remaining <= 0) {
    ui.setMsg(`Limite de ${config.maxImages} imagens atingido.`, true);
    ui.updateUIControls();
    return;
  }

  const validImgs = files
    .filter(f => f.type && f.type.startsWith('image/'))
    .slice(0, remaining);

  const ignored = files.length - validImgs.length;

  let addedCount = 0;

  for (const f of validImgs) {
    try {
      const info = await loadImageInfo(f, state);
      const compat = checkCompatibility(
        { w: info.width, h: info.height, bytes: info.bytes },
        config.rules
      );

      // cria thumb
      const col = createThumb({
        url: info.url,
        width: info.width,
        height: info.height,
        bytes: info.bytes,
        ok: compat.ok
      });

      // INSERE NO INÍCIO (o mais recente fica primeiro)
      dom.thumbsGrid.insertBefore(col, dom.thumbsGrid.firstChild);

      addedCount++;
    } catch (err) {
      console.warn('Erro ao processar arquivo:', f.name, err);
    }
  }

  if (ignored > 0) ui.setMsg(`Algumas imagens foram ignoradas (limite: ${config.maxImages}).`, true);
  else ui.setMsg('Imagens adicionadas. A mais recente ficou em primeiro e foi selecionada.', false);

  // SEMPRE selecionar a mais recente (que agora é a primeira do grid)
  if (addedCount > 0) {
    const newest = dom.thumbsGrid.querySelector('.ir-thumb'); // primeira (mais recente)
    if (newest) selectThumb(newest);
  }

  ui.updateUIControls();
}

  return { selectThumb, createThumb, removeSelected, addFiles };
}