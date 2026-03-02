// /assets/js/image-reducer/reducer.js
import { createConfig } from './config.js';
import { cacheDom } from './dom.js';
import { createState } from './state.js';
import { createUI } from './ui.js';
import { createThumbs } from './thumbs.js';
import { openCropperForSelected } from './cropper.js';
import { rotateSelected } from './rotate.js';
import { normalizeSelected } from './normalize.js';
import { undo, redo } from './history.js';

export function createImageReducer(options = {}) {
  const config = createConfig(options);
  const dom = cacheDom();
  const state = createState();
  const ui = createUI(dom, config);
  const thumbs = createThumbs(dom, config, state, ui);
  const history = state.history;

  const ctx = { dom, config, state, ui, history };

  function bindEvents() {
    dom.previewClickable.addEventListener('click', () => {
      if (state.isCropping) return;

      if (ui.countThumbs() >= config.maxImages) {
        ui.setMsg(`Limite de ${config.maxImages} imagens atingido.`, true);
        return;
      }
      dom.fileInput.click();
    });

    dom.fileInput.addEventListener('change', async () => {
      const files = Array.from(dom.fileInput.files || []);
      dom.fileInput.value = '';
      await thumbs.addFiles(files);
    });

    dom.modal.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');

        if (action === 'remove') return thumbs.removeSelected();

        if (action === 'crop') {
          if (state.isCropping) return;
          return openCropperForSelected(ctx); // aqui é ctx direto
        }

        if (action === 'fix') {
          if (state.isCropping) return;
          return normalizeSelected(ctx, {
            strategy: 'contain',
            type: 'image/jpeg',
            qualityMin: 0.45
          });
        }

        if (action === 'rotateL') {
          if (state.isCropping) return;
          return rotateSelected(ctx, -90);
        }

        if (action === 'rotateR') {
          if (state.isCropping) return;
          return rotateSelected(ctx, 90);
        }

        if (action === 'undo') return undo(ctx);
        if (action === 'redo') return redo(ctx);

        if (action === 'save') return alert('Salvar (exemplo). Aqui você chamaria seu upload + salvar no banco.');
      });
    });

    dom.modal.addEventListener('shown.bs.modal', () => ui.updateUIControls());
  }

  function init() {
    bindEvents();
    ui.updateUIControls();
  }

  return { init, api: { config, dom, state, ui, thumbs, history } };
}