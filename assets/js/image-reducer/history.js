// /assets/js/image-reducer/history.js
function getAllThumbUrls(dom) {
  return Array.from(dom.thumbsGrid.querySelectorAll(".ir-thumb"))
    .map(t => t.dataset.full || "")
    .filter(Boolean);
}

function getAllHistoryUrls(history) {
  const urls = [];
  for (const it of history.undo) {
    if (it.before?.full) urls.push(it.before.full);
    if (it.after?.full) urls.push(it.after.full);
  }
  for (const it of history.redo) {
    if (it.before?.full) urls.push(it.before.full);
    if (it.after?.full) urls.push(it.after.full);
  }
  return urls;
}

export function createHistory(limit = 30) {
  return { limit, undo: [], redo: [] };
}

// coleta lixo: revoga só URLs que não estão em uso na tela nem no histórico
export function gcObjectUrls(ctx) {
  const { dom, state } = ctx;
  if (!state?.objectUrls) return;

  const keep = new Set([
    ...getAllThumbUrls(dom),
    ...getAllHistoryUrls(ctx.history)
  ]);

  for (const url of Array.from(state.objectUrls)) {
    if (!keep.has(url)) {
      try { URL.revokeObjectURL(url); } catch {}
      state.objectUrls.delete(url);
    }
  }
}

export function snapshotThumb(thumbEl) {
  if (!thumbEl) return null;
  return {
    id: thumbEl.dataset.id,
    full: thumbEl.dataset.full || "",
    w: Number(thumbEl.dataset.w || 0),
    h: Number(thumbEl.dataset.h || 0),
    bytes: Number(thumbEl.dataset.bytes || 0),
    ok: thumbEl.dataset.ok || "0",
  };
}

export function findThumbById(dom, id) {
  if (!id) return null;
  return dom.thumbsGrid.querySelector(`.ir-thumb[data-id="${CSS.escape(id)}"]`);
}

export function applySnapshot(ctx, snap) {
  const { dom } = ctx;
  if (!snap?.id) return false;

  const t = findThumbById(dom, snap.id);
  if (!t) return false;

  t.dataset.full = snap.full;
  t.dataset.w = String(snap.w || 0);
  t.dataset.h = String(snap.h || 0);
  t.dataset.bytes = String(snap.bytes || 0);
  t.dataset.ok = snap.ok || "0";

  const img = t.querySelector("img");
  if (img) img.src = snap.full;

  // atualiza preview
  dom.mainPreview.src = snap.full;
  dom.mainPreview.style.display = "block";
  dom.emptyState.style.display = "none";

  // força revalidar (usa seu fluxo)
  t.click();
  return true;
}

// Transação para ações reversíveis (crop/rotate/fix)
export function beginTxn(ctx, name) {
  const { dom } = ctx;
  const sel = dom.thumbsGrid.querySelector(".ir-thumb.is-selected");
  if (!sel) return null;
  return { name, id: sel.dataset.id, before: snapshotThumb(sel) };
}

export function commitTxn(ctx, txn) {
  const { history, dom, ui } = ctx;
  if (!txn?.id) return false;

  const el = findThumbById(dom, txn.id);
  if (!el) return false;

  const after = snapshotThumb(el);

  // se nada mudou, não registra
  if (after.full === txn.before.full && after.bytes === txn.before.bytes && after.w === txn.before.w && after.h === txn.before.h) {
    return false;
  }

  history.undo.push({ name: txn.name, before: txn.before, after });
  history.redo = [];

  // limita e faz GC
  if (history.undo.length > history.limit) history.undo.shift();
  gcObjectUrls(ctx);

  ui?.setMsg?.("Ação registrada. Você pode desfazer.", false);
  return true;
}

export function undo(ctx) {
  const { history, ui } = ctx;
  const it = history.undo.pop();
  if (!it) { ui.setMsg("Nada para desfazer.", true); return false; }

  const ok = applySnapshot(ctx, it.before);
  history.redo.push(it);

  gcObjectUrls(ctx);
  ui.setMsg(ok ? "Desfeito." : "Não consegui desfazer (item não encontrado).", !ok);
  ui.updateUIControls();
  return ok;
}

export function redo(ctx) {
  const { history, ui } = ctx;
  const it = history.redo.pop();
  if (!it) { ui.setMsg("Nada para refazer.", true); return false; }

  const ok = applySnapshot(ctx, it.after);
  history.undo.push(it);

  gcObjectUrls(ctx);
  ui.setMsg(ok ? "Refeito." : "Não consegui refazer (item não encontrado).", !ok);
  ui.updateUIControls();
  return ok;
}