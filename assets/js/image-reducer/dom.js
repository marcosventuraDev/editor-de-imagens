// /assets/js/image-reducer/dom.js
export function cacheDom() {
  const fileInput = document.getElementById('irFileInput');
  const thumbsGrid = document.getElementById('thumbsGrid');
  const mainPreview = document.getElementById('mainPreview');
  const previewClickable = document.getElementById('previewClickable');
  const emptyState = document.getElementById('irEmptyState');
  const previewMeta = document.getElementById('irPreviewMeta');

  const metaDims = document.getElementById('metaDims')?.querySelector('span');
  const metaSize = document.getElementById('metaSize')?.querySelector('span');
  const metaStatusPill = document.getElementById('metaStatus');
  const metaStatusText = metaStatusPill?.querySelector('span');

  const irMsg = document.getElementById('irMsg');
  const irCountSpan = document.getElementById('irCount')?.querySelector('span');

  const btnCrop = document.getElementById('btnCrop');
  const btnFix = document.getElementById('btnFix');
  const btnRemove = document.getElementById('btnRemove');
  const btnSave = document.getElementById('btnSave');

  const modal = document.getElementById('imageReducerModal');

  const btnRotateL = document.getElementById('btnRotateL');
  const btnRotateR = document.getElementById('btnRotateR');


  // Falha cedo se algo essencial estiver faltando
  const required = { fileInput, thumbsGrid, mainPreview, previewClickable, emptyState, previewMeta, irMsg, irCountSpan, btnCrop, btnFix, btnRemove, btnSave, modal };
  for (const [k, v] of Object.entries(required)) {
    if (!v) throw new Error(`ImageReducer: elemento obrigatório não encontrado: ${k}`);
  }

  return {
    fileInput, thumbsGrid, mainPreview, previewClickable, emptyState, previewMeta,
    metaDims, metaSize, metaStatusPill, metaStatusText,
    irMsg, irCountSpan,
    btnRotateL, btnRotateR, btnFix, 
    btnCrop, btnRemove, btnSave,
    modal
  };
}