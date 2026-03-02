// /assets/js/image-reducer/index.js
import { createImageReducer } from './reducer.js';

function boot() {
  const reducer = createImageReducer({
    maxImages: 6,
    rules: { maxW: 736, maxH: 736, maxBytes: 1 * 1024 * 1024 }
  });

  reducer.init();
  window.ImageReducer = reducer; // opcional
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}