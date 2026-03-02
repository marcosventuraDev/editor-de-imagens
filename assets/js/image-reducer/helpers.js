// /assets/js/image-reducer/helpers.js
export function bytesToHuman(bytes) {
  const kb = bytes / 1024;
  if (!isFinite(kb) || kb <= 0) return '—';
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function checkCompatibility({ w, h, bytes }, rules) {
  const okDim = (w <= rules.maxW && h <= rules.maxH);
  const okSize = (bytes <= rules.maxBytes);
  const ok = okDim && okSize;

  const reasons = [];
  if (!okDim) reasons.push(`dimensões > ${rules.maxW}×${rules.maxH}`);
  if (!okSize) reasons.push(`tamanho > ${bytesToHuman(rules.maxBytes)}`);

  return { ok, reasons };
}

export async function loadImageInfo(file, state) {
  const url = URL.createObjectURL(file);
  state.objectUrls.add(url);

  const { width, height } = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = url;
  });

  return { url, width, height, bytes: file.size, name: file.name };
}

export function revokeUrl(url, state) {
  if (url && state.objectUrls.has(url)) {
    URL.revokeObjectURL(url);
    state.objectUrls.delete(url);
  }
}