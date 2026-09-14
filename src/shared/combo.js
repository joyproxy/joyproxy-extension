import { t } from "./i18n.js";

export function bindCombo({ input, toggle, menu, getItems, onSelect }) {
  if (!input || !menu) {
    return { refresh() {}, open() {}, close() {}, sync() {} };
  }

  function items() {
    return Array.isArray(getItems?.()) ? getItems() : [];
  }

  function render() {
    const list = items();
    menu.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "combo-empty";
      empty.textContent = t("combo.empty");
      menu.append(empty);
      return;
    }
    for (const item of list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "combo-item";
      if (item.active) btn.classList.add("active");
      btn.textContent = item.label || item.value || "";
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        onSelect?.(item);
        close();
      });
      menu.append(btn);
    }
  }

  function place() {
    const rect = input.getBoundingClientRect();
    const pad = 8;
    menu.style.position = "fixed";
    menu.style.left = `${Math.max(pad, rect.left)}px`;
    menu.style.width = `${rect.width}px`;
    menu.style.right = "auto";
    menu.style.zIndex = "80";
    const spaceBelow = window.innerHeight - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const want = Math.min(220, menu.scrollHeight || 220);
    if (spaceBelow < Math.min(160, want) && spaceAbove > spaceBelow) {
      menu.style.top = "auto";
      menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
      menu.style.maxHeight = `${Math.max(120, spaceAbove)}px`;
    } else {
      menu.style.bottom = "auto";
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.maxHeight = `${Math.max(120, spaceBelow)}px`;
    }
  }

  function open() {
    if (input.disabled) return;
    render();
    document.body.append(menu);
    menu.hidden = false;
    menu.classList.add("is-open");
    place();
    toggle?.setAttribute("aria-expanded", "true");
  }

  function close() {
    menu.hidden = true;
    menu.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
  }

  function refresh() {
    if (!menu.hidden) {
      render();
      place();
    }
  }

  toggle?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (menu.hidden) open();
    else close();
  });

  input.addEventListener("click", () => {
    if (menu.hidden) open();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      open();
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (menu.hidden) return;
    if (menu.contains(e.target) || input === e.target || toggle?.contains(e.target)) return;
    close();
  });

  window.addEventListener("resize", () => {
    if (!menu.hidden) place();
  });

  return { refresh, open, close, sync: refresh };
}

export function bindSelect(select) {
  if (!select) return { sync() {} };
  if (select._combo) return select._combo;

  const wrap = document.createElement("div");
  wrap.className = "combo";
  const input = document.createElement("input");
  input.type = "text";
  input.readOnly = true;
  input.autocomplete = "off";
  input.spellcheck = false;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "combo-toggle";
  toggle.tabIndex = -1;
  const menu = document.createElement("div");
  menu.className = "combo-menu";
  menu.hidden = true;
  select.classList.add("combo-native");
  select.tabIndex = -1;
  select.parentNode.insertBefore(wrap, select);
  wrap.append(input, toggle, select);

  const combo = bindCombo({
    input,
    toggle,
    menu,
    getItems: () =>
      [...select.options].map((o) => ({
        id: o.value,
        value: o.value,
        label: o.textContent,
        active: o.value === select.value,
      })),
    onSelect: (item) => {
      if (select.disabled) return;
      select.value = item.value;
      input.value = item.label;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    },
  });

  function sync() {
    const hit = [...select.options].find((o) => o.value === select.value) || select.options[0];
    input.value = hit?.textContent || "";
    input.disabled = select.disabled;
    wrap.classList.toggle("is-disabled", select.disabled);
    combo.refresh();
  }

  const api = { sync, close: combo.close };
  select._combo = api;
  sync();
  return api;
}

export function bindSelects(root = document) {
  return [...root.querySelectorAll("select")].map((el) => bindSelect(el));
}
