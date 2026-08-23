export function initTips(root = document) {
  let layer = document.getElementById("tip-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "tip-layer";
    layer.hidden = true;
    document.body.append(layer);
  }

  function hide() {
    layer.hidden = true;
  }

  function show(el) {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    layer.textContent = text;
    layer.hidden = false;
    const r = el.getBoundingClientRect();
    const pad = 8;
    requestAnimationFrame(() => {
      const w = layer.offsetWidth;
      const h = layer.offsetHeight;
      let left = r.left;
      let top = r.bottom + 8;
      if (left + w > window.innerWidth - pad) left = window.innerWidth - pad - w;
      if (left < pad) left = pad;
      if (top + h > window.innerHeight - pad) top = r.top - h - 8;
      if (top < pad) top = pad;
      layer.style.left = `${left}px`;
      layer.style.top = `${top}px`;
    });
  }

  root.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip]");
    if (!el || !root.contains(el)) return;
    show(el);
  });
  root.addEventListener("mouseout", (e) => {
    const el = e.target.closest("[data-tip]");
    if (!el) return;
    const next = e.relatedTarget;
    if (next && el.contains(next)) return;
    hide();
  });
  root.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
}
