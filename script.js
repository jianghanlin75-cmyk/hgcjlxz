(function () {
  const data = window.HBEU_SITE_DATA;
  const CONTENT_VERSION = "editable-v3";
  const MAX_IMAGES_PER_SLOT = 6;
  const IMAGE_MAX_SIDE = 1080;
  const IMAGE_QUALITY = 0.72;
  let lastStorageErrorAt = 0;
  const state = {
    activeSection: data.sections[0].id,
    sectionFilters: {},
    activeMapElement: {},
    maps: {},
    markers: {},
    motion: localStorage.getItem("hbeu-motion") !== "off",
    content: null,
    editor: null,
    qaEditor: null,
    imageManager: null,
    AMap: null,
    amapLoading: null,
    cloud: {
      enabled: false,
      imageStacks: {},
      adminToken: "",
      saveTimer: null,
      lastErrorAt: 0,
      imageNoticeAt: 0
    },
    activeImageIndex: {},
    ownerUnlocked: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const storageKey = (slot) => `hbeu-image-${slot}`;
  const imageListStorageKey = (slot) => `hbeu-images-${slot}`;
  const contentStorageKey = "hbeu-editable-content-v1";
  const amapKeyStorageKey = "hbeu-amap-key";
  const amapSecurityStorageKey = "hbeu-amap-security-js-code";
  const pinStorageKey = (sectionId) => `hbeu-amap-pins-v1-${sectionId}`;
  const legacyPinStorageKey = (sectionId) => `hbeu-map-pins-${sectionId}`;

  const moduleNav = $("#moduleNav");
  const moduleStage = $("#moduleStage");
  const qaList = $("#qaList");
  const routeTabs = $("#routeTabs");
  const routeCard = $("#routeCard");
  const imageLab = $("#image-lab");
  const slotList = $("#slotList");
  const backTop = $("#backTop");
  const topbar = $(".topbar");
  const ownerButton = $("#toggleOwner");

  if (!state.motion) document.body.classList.add("reduce-motion");

  function safeSessionGet(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      console.warn("Session storage could not be read.", error);
      return null;
    }
  }

  function safeSessionSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn("Session storage could not be saved.", error);
      return false;
    }
  }

  function safeSessionRemove(key) {
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn("Session storage could not be cleared.", error);
      return false;
    }
  }

  function icon(name) {
    return `<i data-lucide="${name}"></i>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cssEscape(value) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function makeId(prefix) {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${Date.now().toString(36)}-${rand}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const sectionAccentPalette = ["#0f9f8f", "#e2553f", "#2f7fd4", "#c48700", "#7b61ff", "#3c8d40", "#c35b9d", "#576574"];

  function nextAccent() {
    return sectionAccentPalette[state.content ? state.content.sections.length % sectionAccentPalette.length : 0];
  }

  function cleanSectionId(label) {
    const text = String(label || "section").trim().toLowerCase();
    const basic = text
      .replace(/[^a-z0-9一-龥]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    return `${basic || "section"}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function ensureUniqueSectionId(id) {
    const base = id || makeId("section");
    let candidate = base;
    let index = 2;
    while (state.content && state.content.sections.some((section) => section.id === candidate)) {
      candidate = `${base}-${index}`;
      index += 1;
    }
    return candidate;
  }

  function normalizeItem(section, item) {
    return {
      id: item.id || makeId("card"),
      title: item.title || "未命名卡片",
      subtitle: item.subtitle || "",
      image: item.image || "",
      slot: item.slot || makeId("image"),
      tags: Array.isArray(item.tags) ? item.tags : [],
      facts: Array.isArray(item.facts) ? item.facts : [],
      gender: item.gender || "all",
      elementId: item.elementId || item.id || "",
      hidden: Boolean(item.hidden)
    };
  }

  function normalizeSection(section) {
    const items = (section.items || []).map((item) => normalizeItem(section, item));
    const elements = Array.isArray(section.elements) && section.elements.length
      ? section.elements.map((element) => ({ id: element.id || makeId("element"), label: element.label || "未命名元素" }))
      : items.map((item, index) => ({
        id: item.elementId || item.id,
        label: item.elementLabel || item.element || (section.filters && section.filters[index]) || item.title || `元素 ${index + 1}`
      }));

    const unique = [];
    const seen = new Set();
    elements.forEach((element) => {
      if (seen.has(element.id)) return;
      seen.add(element.id);
      unique.push(element);
    });

    items.forEach((item) => {
      if (!item.elementId || !unique.some((element) => element.id === item.elementId)) {
        const fallback = unique[0] || { id: makeId("element"), label: "默认元素" };
        if (!unique.length) unique.push(fallback);
        item.elementId = fallback.id;
      }
    });

    return {
      id: section.id,
      label: section.label,
      short: section.short,
      icon: section.icon,
      accent: section.accent,
      tone: section.tone,
      filters: section.filters || [],
      elements: unique,
      items
    };
  }

  function normalizeQaItem(item) {
    return {
      id: item.id || makeId("qa"),
      question: String(item.question || "").trim(),
      answer: String(item.answer || "").trim()
    };
  }

  function loadContent() {
    try {
      const saved = JSON.parse(localStorage.getItem(contentStorageKey) || "null");
      if (saved && saved.version === CONTENT_VERSION && Array.isArray(saved.sections)) {
        return {
          sections: saved.sections.map(normalizeSection),
          qas: Array.isArray(saved.qas) ? saved.qas.map(normalizeQaItem).filter((item) => item.question || item.answer) : []
        };
      }
    } catch (error) {
      console.warn("Editable content could not be read.", error);
    }
    return {
      sections: data.sections.map(normalizeSection),
      qas: Array.isArray(data.qas) ? data.qas.map(normalizeQaItem).filter((item) => item.question || item.answer) : []
    };
  }

  function showStorageError(label, error) {
    console.warn(`${label} could not be saved.`, error);
    const now = Date.now();
    if (now - lastStorageErrorAt < 1200) return;
    lastStorageErrorAt = now;
    alert(`${label}保存失败。常见原因是浏览器本地存储已满、无痕模式限制存储，或直接双击 file:// 打开导致权限不稳定。\n\n建议：\n1. 先点右上角"导出备份"保存当前内容；\n2. 删除不必要的大图，或把图片放进 assets/images 后在 site-data.js 写路径；\n3. 用 python -m http.server 5500 打开网站；\n4. 长期使用请接入云数据库/对象存储，不能只依赖浏览器本地存储。`);
  }

  function safeSetItem(key, value, label) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      showStorageError(label, error);
      return false;
    }
  }

  function safeRemoveItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Could not remove ${key}.`, error);
      return false;
    }
  }

  function saveContent() {
    const ok = safeSetItem(contentStorageKey, JSON.stringify({
      version: CONTENT_VERSION,
      sections: state.content.sections,
      qas: state.content.qas || []
    }), "网站内容");
    if (ok) scheduleCloudSave();
    return ok;
  }

  function getOwnerToken() {
    return state.cloud.adminToken || "";
  }

  function isCloudSafeImageSrc(src) {
    const value = String(src || "").trim();
    return Boolean(value) && !/^data:/i.test(value) && !/^blob:/i.test(value);
  }

  function cloudStatePayload() {
    // 收集所有板块的点位数据，纳入云端同步
    var allPins = {};
    (state.content.sections || []).forEach(function (section) {
      var pins = getPins(section.id);
      if (pins && pins.length) { allPins[section.id] = pins; }
    });
    const cloudImageStacks = {};
    Object.entries(state.cloud.imageStacks || {}).forEach(([slot, images]) => {
      const safeImages = Array.isArray(images) ? images.filter(isCloudSafeImageSrc) : [];
      if (safeImages.length) cloudImageStacks[slot] = safeImages;
    });
    return {
      content: {
        version: CONTENT_VERSION,
        sections: state.content.sections,
        qas: state.content.qas || []
      },
      imageStacks: cloudImageStacks,
      pins: allPins
    };
  }

  function showCloudError(message, error) {
    console.warn(message, error);
    const now = Date.now();
    if (now - state.cloud.lastErrorAt < 1800) return;
    state.cloud.lastErrorAt = now;
    alert(`${message}\n\n请确认 Cloudflare Pages 已绑定 D1、R2，并且环境变量 ADMIN_TOKEN 和你的主人口令一致。`);
  }

  async function saveCloudState() {
    if (!state.cloud.enabled || !state.ownerUnlocked) return false;
    // 安全阀：拒绝推送空内容到云端覆盖已有数据
    var sections = (state.content.sections || []);
    if (!sections.length || !sections.some(function (s) { return s.items && s.items.length; })) {
      console.warn("Cloud save blocked: content is empty, will not overwrite cloud data.");
      return false;
    }
    try {
      const response = await fetch("/api/content", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-admin-token": getOwnerToken()
        },
        body: JSON.stringify(cloudStatePayload())
      });
      if (!response.ok) throw new Error(`Cloud save failed: ${response.status}`);
      return true;
    } catch (error) {
      showCloudError("云端同步失败，当前修改已先保存在本机浏览器。", error);
      return false;
    }
  }

  function scheduleCloudSave() {
    if (!state.cloud.enabled || !state.ownerUnlocked) return;
    clearTimeout(state.cloud.saveTimer);
    state.cloud.saveTimer = setTimeout(() => saveCloudState(), 400);
  }

  async function loadCloudState() {
    try {
      const response = await fetch("/api/content", { headers: { "accept": "application/json" } });
      if (!response.ok) return false;
      const payload = await response.json();
      if (!payload || payload.cloud !== true) return false;
      state.cloud.enabled = true;
      state.cloud.imageStacks = payload.imageStacks || {};
      if (payload.content && Array.isArray(payload.content.sections)) {
        state.content = {
          sections: payload.content.sections.map(normalizeSection),
          qas: Array.isArray(payload.content.qas) ? payload.content.qas.map(normalizeQaItem).filter((item) => item.question || item.answer) : []
        };
      }
      // 恢复云端点位数据到本地存储
      if (payload.pins) {
        Object.keys(payload.pins).forEach(function (sectionId) {
          var pins = payload.pins[sectionId];
          if (Array.isArray(pins) && pins.length) {
            try { localStorage.setItem(pinStorageKey(sectionId), JSON.stringify(pins)); } catch (e) {}
          }
        });
      }
      document.body.classList.add("cloud-sync-enabled");
      return true;
    } catch (error) {
      console.warn("Cloud state is unavailable; using local browser state.", error);
      return false;
    }
  }

  function setOwnerUnlocked(value) {
    state.ownerUnlocked = Boolean(value);
    if (!state.ownerUnlocked) state.cloud.adminToken = "";
    refreshOwnerUi();
  }

  function refreshOwnerUi() {
    document.body.classList.toggle("owner-unlocked", state.ownerUnlocked);
    document.body.classList.toggle("visitor-mode", !state.ownerUnlocked);
    if (ownerButton) {
      ownerButton.classList.toggle("is-active", state.ownerUnlocked);
      ownerButton.setAttribute("aria-pressed", String(state.ownerUnlocked));
      ownerButton.setAttribute("aria-label", state.ownerUnlocked ? "退出开发者权限" : "进入开发者权限");
      ownerButton.title = state.ownerUnlocked ? "已进入开发者权限，点击退出" : "开发者权限";
      const label = $("span", ownerButton);
      if (label) label.textContent = state.ownerUnlocked ? "退出开发者" : "开发者权限";
      const iconNode = $("i", ownerButton);
      if (iconNode) iconNode.setAttribute("data-lucide", state.ownerUnlocked ? "unlock-keyhole" : "lock-keyhole");
    }
    applyFilters();
    refreshIcons();
  }

  async function unlockOwner() {
    const input = prompt("请输入开发者口令。", "");
    if (input === null) return false;
    const token = input.trim();
    if (!token) {
      alert("口令不能为空。页面保持访客浏览模式。");
      return false;
    }

    try {
      const response = await fetch("/api/verify", {
        method: "GET",
        headers: { "x-admin-token": token, "accept": "application/json" }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || (response.status === 401 ? "口令不正确。" : `验证失败（${response.status}）。`));
      }

      state.cloud.adminToken = token;
      state.cloud.enabled = true;
      setOwnerUnlocked(true);
      await loadCloudState();
      rerenderEditableArea();
      return true;
    } catch (error) {
      state.cloud.adminToken = "";
      setOwnerUnlocked(false);
      alert(`${error.message || "验证失败。"}\n\n页面保持访客浏览模式，请检查网络或 Cloudflare 的 ADMIN_TOKEN 配置。`);
      return false;
    }
  }

  async function toggleOwnerMode() {
    if (state.ownerUnlocked) {
      setOwnerUnlocked(false);
      closeCardEditor();
      closeImageLab();
      closeImageManager();
      alert("已退出开发者权限。现在是访客浏览模式。");
      return;
    }
    await unlockOwner();
  }

  function requireOwner(actionName = "这个操作") {
    if (state.ownerUnlocked) return true;
    alert(`${actionName}需要先进入开发者权限。\n\n请点击右上角"开发者权限"按钮，输入开发者口令后再操作。`);
    return false;
  }

  function getSection(sectionId) {
    return state.content.sections.find((section) => section.id === sectionId);
  }

  function getElement(section, elementId) {
    return section.elements.find((element) => element.id === elementId);
  }

  function getElementLabel(section, elementId) {
    const element = getElement(section, elementId);
    return element ? element.label : "未分配";
  }

  function normalizeConfiguredImages(configured) {
    if (Array.isArray(configured)) return configured.filter(Boolean);
    return configured ? [configured] : [];
  }

  function getImages(slot, configured) {
    const cloudImages = state.cloud.enabled && state.cloud.imageStacks && Array.isArray(state.cloud.imageStacks[slot])
      ? state.cloud.imageStacks[slot].filter(Boolean)
      : null;
    let localImages = [];
    try {
      const saved = JSON.parse(localStorage.getItem(imageListStorageKey(slot)) || "null");
      if (Array.isArray(saved)) localImages = saved.filter(Boolean);
    } catch (error) {
      console.warn("Image stack storage could not be read.", error);
    }
    if (cloudImages) {
      const localOnlyImages = localImages.filter((src) => !isCloudSafeImageSrc(src));
      return cloudImages.concat(localOnlyImages.filter((src) => !cloudImages.includes(src))).slice(-MAX_IMAGES_PER_SLOT);
    }
    if (localImages.length) return localImages;
    const legacy = localStorage.getItem(storageKey(slot));
    return legacy ? [legacy] : normalizeConfiguredImages(configured);
  }

  function saveImages(slot, images) {
    const clean = images.filter(Boolean).slice(-MAX_IMAGES_PER_SLOT);
    if (state.cloud.enabled) {
      state.cloud.imageStacks[slot] = clean;
      scheduleCloudSave();
    }

    // 只保存多图列表，不再重复保存 hbeu-image-xxx 首图。
    // 旧版同时保存"多图列表 + 首图副本"，会把 localStorage 空间吃得很快，
    // 用户上传几次图片后就会出现"浏览器本地存储满了"。
    safeRemoveItem(storageKey(slot));
    safeRemoveItem(imageListStorageKey(slot));

    const ok = safeSetItem(imageListStorageKey(slot), JSON.stringify(clean), "图片");
    if (!ok) return false;
    if (!clean.length) safeRemoveItem(imageListStorageKey(slot));
    return true;
  }

  function getImage(slot, configured) {
    return getImages(slot, configured)[0] || "";
  }

  function getActiveImageIndex(slot, total) {
    if (!total) return 0;
    const current = state.activeImageIndex[slot] || 0;
    return Math.max(0, Math.min(current, total - 1));
  }

  function setImages(slot, images) {
    const src = images[0] || "";
    $$(`[data-slot="${cssEscape(slot)}"]`).forEach((el) => {
      el.style.backgroundImage = src ? `url("${src}")` : "";
      el.classList.toggle("has-image", Boolean(src));
      el.dataset.empty = src ? "false" : "true";
    });
    $$(`[data-thumb-for="${cssEscape(slot)}"]`).forEach((el) => {
      el.style.backgroundImage = src ? `url("${src}")` : "";
    });
  }

  function renderImageStack(slot, configured, title) {
    const images = getImages(slot, configured);
    const active = getActiveImageIndex(slot, images.length);
    const hasMany = images.length > 1;
    const hasImages = images.length > 0;
    return `
      <div class="image-stack-frame" data-stack-frame="${escapeHtml(slot)}">
        ${images.length ? images.map((src, index) => {
          const isActive = index === active;
          const isPrev = images.length > 1 && index === (active - 1 + images.length) % images.length;
          const isNext = images.length > 1 && index === (active + 1) % images.length;
          const classes = ["image-slide", isActive ? "is-active" : "", isPrev ? "is-prev" : "", isNext ? "is-next" : ""].filter(Boolean).join(" ");
          return `<div class="${classes}" data-slide-index="${index}" data-full-src="${escapeHtml(src)}" style="background-image:url('${escapeHtml(src)}')" aria-label="${escapeHtml(title)} 图片 ${index + 1}"></div>`;
        }).join("") : ""}
      </div>
      ${images.length ? `<div class="image-expand-hint" aria-hidden="true">双击看大图</div>` : ""}
      ${hasImages ? `
        <div class="image-nav-bar">
          <button class="image-nav" type="button" data-image-slot="${escapeHtml(slot)}" data-image-step="-1" aria-label="上一张图片" ${hasMany ? "" : "disabled aria-disabled=\"true\""}>${icon("chevron-left")}</button>
          <span class="image-count" data-image-count="${escapeHtml(slot)}">${active + 1}/${images.length}</span>
          <button class="image-nav" type="button" data-image-slot="${escapeHtml(slot)}" data-image-step="1" aria-label="下一张图片" ${hasMany ? "" : "disabled aria-disabled=\"true\""}>${icon("chevron-right")}</button>
        </div>
      ` : ""}
    `;
  }

  function updateImageStack(slot) {
    const images = getImages(slot, "");
    const active = getActiveImageIndex(slot, images.length);
    $$(`[data-stack-frame="${cssEscape(slot)}"] .image-slide`).forEach((slide) => {
      const index = Number(slide.dataset.slideIndex);
      slide.classList.toggle("is-active", index === active);
      slide.classList.toggle("is-prev", images.length > 1 && index === (active - 1 + images.length) % images.length);
      slide.classList.toggle("is-next", images.length > 1 && index === (active + 1) % images.length);
    });
    $$(`[data-image-count="${cssEscape(slot)}"]`).forEach((count) => {
      count.textContent = images.length ? `${active + 1}/${images.length}` : "0/0";
    });
  }

  function cycleImage(slot, step) {
    const images = getImages(slot, "");
    if (images.length <= 1) return;
    const active = getActiveImageIndex(slot, images.length);
    state.activeImageIndex[slot] = (active + step + images.length) % images.length;
    updateImageStack(slot);
  }

  function buildRoutes() {
    routeTabs.innerHTML = data.routes.map((route, index) => `
      <button class="route-tab" type="button" role="tab" aria-selected="${index === 0}" data-route="${route.id}">
        ${icon(route.icon)}
        <span>${escapeHtml(route.label)}</span>
      </button>
    `).join("");
    renderRoute(data.routes[0].id);
  }

  function renderRoute(routeId) {
    const route = data.routes.find((item) => item.id === routeId) || data.routes[0];
    $$(".route-tab").forEach((button) => {
      button.setAttribute("aria-selected", String(button.dataset.route === route.id));
    });
    routeCard.innerHTML = `
      <h3>${escapeHtml(route.title)}</h3>
      <div class="route-steps">
        ${route.steps.map((step, index) => `
          <div class="route-step" data-number="${String(index + 1).padStart(2, "0")}">${escapeHtml(step)}</div>
        `).join("")}
      </div>
    `;
  }

  function buildNavigation() {
    moduleNav.innerHTML = `
      ${state.content.sections.map((section) => `
        <button class="nav-button" type="button" data-jump="${section.id}" style="--nav-color:${section.accent}">
          ${icon(section.icon)}
          <span>${escapeHtml(section.short)}</span>
        </button>
      `).join("")}
      <div class="rail-actions owner-only">
        <button class="tool-button rail-add-section" type="button" data-add-section>${icon("square-plus")}<span>新增板块</span></button>
      </div>
    `;
  }

  function buildPanels() {
    moduleStage.innerHTML = state.content.sections.map((section) => `
      <article class="module-panel" id="${section.id}" data-section="${section.id}" style="--accent:${section.accent}">
        <div class="module-top">
          <div>
            <div class="module-kicker">
              <span>${icon(section.icon)}</span>
              <strong>${escapeHtml(section.label)}</strong>
            </div>
            <h2 class="module-title">${escapeHtml(section.label)}</h2>
            <p class="module-tone">${escapeHtml(section.tone)}</p>
            <div class="section-admin owner-only">
              <button class="tool-button ghost" type="button" data-edit-section="${section.id}">${icon("settings-2")}<span>编辑板块</span></button>
              <button class="tool-button danger" type="button" data-delete-section="${section.id}">${icon("trash-2")}<span>删除板块</span></button>
            </div>
          </div>
          ${renderMap(section)}
        </div>
        <div class="panel-tools">
          ${renderElementTools(section)}
        </div>
        <p class="card-interaction-tip" data-card-tip="${section.id}">先单击上方元素或地图点位，再显示对应卡片；再次单击同一个元素可收起。</p>
        <div class="card-grid" data-card-grid="${section.id}">
          ${section.items.map((item) => renderCard(section, item)).join("")}
        </div>
        <div class="empty-state">请先单击一个元素，卡片会在这里出现。</div>
      </article>
    `).join("");
  }

  function renderElementTools(section) {
    return `
      <div class="element-tools" aria-label="${escapeHtml(section.label)}元素编辑">
        <div class="element-list">
          ${section.elements.map((element, index) => `
            <span class="element-token">
              <button class="filter-chip" type="button" data-section-filter="${section.id}" data-element="${escapeHtml(element.id)}">
                <span class="element-index">${index + 1}</span>${escapeHtml(element.label)}
              </button>
              <button class="chip-icon owner-only" type="button" data-edit-element="${escapeHtml(element.id)}" data-element-section="${section.id}" aria-label="编辑元素 ${escapeHtml(element.label)}">${icon("square-pen")}</button>
              <button class="chip-icon owner-only" type="button" data-delete-element="${escapeHtml(element.id)}" data-element-section="${section.id}" aria-label="删除元素 ${escapeHtml(element.label)}">${icon("trash-2")}</button>
            </span>
          `).join("")}
        </div>
        <div class="tool-actions owner-only">
          <button class="tool-button" type="button" data-add-element="${section.id}">${icon("plus")}<span>元素</span></button>
          <button class="tool-button" type="button" data-add-card="${section.id}">${icon("square-plus")}<span>卡片</span></button>
        </div>
      </div>
    `;
  }

  function renderMap(section) {
    return `
      <div class="satellite-card" data-map-card="${section.id}">
        <div class="map-head">
          <div>
            <strong>高德点位图</strong>
            <small>连续点选地图可追加点位</small>
          </div>
          <div class="map-actions owner-only">
            <button class="map-clear" type="button" data-open-map-key>${icon("key-round")}<span>Key</span></button>
            <button class="map-clear" type="button" data-clear-map="${section.id}">${icon("rotate-ccw")}<span>清空</span></button>
          </div>
        </div>
        <div class="pin-bank owner-only" aria-label="${escapeHtml(section.label)}待标注点位">
          ${section.elements.map((element, index) => `
            <button class="pin-choice" type="button" data-map-element="${escapeHtml(element.id)}" data-map-section="${section.id}">
              <span>${index + 1}</span>${escapeHtml(element.label)}
            </button>
          `).join("")}
        </div>
        <div class="map-stage satellite-map" id="map-${section.id}" data-map-section="${section.id}" aria-label="${escapeHtml(section.label)}高德点位图"></div>
        <div class="pin-list" data-pin-list="${section.id}">还没有标注点位</div>
      </div>
    `;
  }

  function renderCard(section, item) {
    const images = getImages(item.slot, item.image);
    return `
      <article class="place-card ${item.hidden ? "is-hidden-card" : ""}" data-card data-card-id="${escapeHtml(item.id)}" data-element="${escapeHtml(item.elementId)}" data-title="${escapeHtml(item.title)}" data-subtitle="${escapeHtml(item.subtitle)}" data-gender="${item.gender || "all"}" data-card-hidden="${item.hidden ? "true" : "false"}">
        ${item.hidden ? `<div class="hidden-ribbon owner-only">已隐藏，访客看不到</div>` : ""}
        <div class="image-slot image-channel image-stack ${images.length ? "has-image" : ""}" data-slot="${escapeHtml(item.slot)}" data-label="图片槽：${escapeHtml(item.slot)}" data-empty="${images.length ? "false" : "true"}">
          <input class="file-input" type="file" accept="image/*" multiple aria-label="上传 ${escapeHtml(item.title)} 图片">
          ${renderImageStack(item.slot, item.image, item.title)}
          <div class="card-upload owner-only">
            <button class="upload-mini" type="button">
              ${icon("image-plus")}
              <span>加图</span>
            </button>
          </div>
        </div>
        <div class="card-body">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.subtitle)}</p>
          <ul class="fact-list">
            ${item.facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}
          </ul>
          <div class="card-footer">
            <button class="detail-button ghost owner-only" type="button" data-edit-card="${escapeHtml(item.id)}" data-card-section="${section.id}">
              ${icon("square-pen")}
              <span>编辑</span>
            </button>
            <button class="detail-button ghost owner-only" type="button" data-manage-images="${escapeHtml(item.slot)}" data-manage-title="${escapeHtml(item.title)}">
              ${icon("images")}
              <span>管图</span>
            </button>
            <button class="detail-button ghost owner-only" type="button" data-toggle-card-hidden="${escapeHtml(item.id)}" data-card-section="${section.id}">
              ${icon(item.hidden ? "eye" : "eye-off")}
              <span>${item.hidden ? "恢复上架" : "下架"}</span>
            </button>
            <button class="detail-button" type="button" data-detail-toggle aria-expanded="false">
              ${icon("chevron-down")}
              <span>查看要点</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function getQas() {
    if (!Array.isArray(state.content.qas)) state.content.qas = [];
    return state.content.qas;
  }

  function buildQaList() {
    if (!qaList) return;
    const qas = getQas();
    qaList.innerHTML = qas.length ? qas.map((item, index) => `
      <article class="qa-card" data-qa-card="${escapeHtml(item.id)}">
        <div class="qa-number">${String(index + 1).padStart(2, "0")}</div>
        <div class="qa-copy">
          <div class="qa-question"><span>Q</span><h3>${escapeHtml(item.question || "未命名问题")}</h3></div>
          <div class="qa-answer"><span>A</span><p>${escapeHtml(item.answer || "这里还没有填写答案。")}</p></div>
        </div>
        <div class="qa-actions owner-only">
          <button class="upload-mini ghost" type="button" data-edit-qa="${escapeHtml(item.id)}">${icon("square-pen")}<span>编辑</span></button>
          <button class="upload-mini danger" type="button" data-delete-qa="${escapeHtml(item.id)}">${icon("trash-2")}<span>删除</span></button>
        </div>
      </article>
    `).join("") : `
      <div class="qa-empty">
        <strong>问答正在整理中</strong>
        <span class="owner-only">进入开发者权限后，可以添加任意数量的问题和答案。</span>
      </div>
    `;
  }

  function ensureQaEditorShell() {
    if ($("#qaEditor")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <aside class="content-editor" id="qaEditor" aria-hidden="true" aria-label="编辑问答">
        <form class="content-editor-panel" id="qaEditorForm">
          <div class="lab-header">
            <div>
              <p class="eyebrow">Q&A</p>
              <h2 id="qaEditorTitle">编辑问答</h2>
            </div>
            <button class="icon-button" type="button" data-close-qa-editor aria-label="关闭编辑">
              ${icon("x")}
            </button>
          </div>
          <div class="editor-fields">
            <label>问题<input name="question" required></label>
            <label>回答<textarea name="answer" rows="9" required></textarea></label>
          </div>
          <div class="editor-actions">
            <button class="tool-button" type="submit">${icon("save")}<span>保存</span></button>
          </div>
        </form>
      </aside>
    `);
  }

  function openQaEditor(qaId) {
    if (!requireOwner("编辑问答")) return;
    ensureQaEditorShell();
    const qas = getQas();
    const qa = qaId ? qas.find((item) => item.id === qaId) : null;
    state.qaEditor = { qaId: qa ? qa.id : null };
    $("#qaEditorTitle").textContent = qa ? "编辑问答" : "新增问答";
    const form = $("#qaEditorForm");
    form.question.value = qa ? qa.question : "";
    form.answer.value = qa ? qa.answer : "";
    const editor = $("#qaEditor");
    editor.classList.add("is-open");
    editor.setAttribute("aria-hidden", "false");
    form.question.focus();
    refreshIcons();
  }

  function closeQaEditor() {
    const editor = $("#qaEditor");
    if (!editor) return;
    editor.classList.remove("is-open");
    editor.setAttribute("aria-hidden", "true");
    state.qaEditor = null;
  }

  function saveQaFromEditor(form) {
    if (!requireOwner("保存问答")) return;
    const question = form.question.value.trim();
    const answer = form.answer.value.trim();
    if (!question || !answer) return;
    const qas = getQas();
    if (state.qaEditor && state.qaEditor.qaId) {
      const qa = qas.find((item) => item.id === state.qaEditor.qaId);
      if (qa) Object.assign(qa, { question, answer });
    } else {
      qas.push({ id: makeId("qa"), question, answer });
    }
    if (!saveContent()) return;
    closeQaEditor();
    buildQaList();
    refreshOwnerUi();
  }

  function deleteQa(qaId) {
    if (!requireOwner("删除问答")) return;
    const qas = getQas();
    const qa = qas.find((item) => item.id === qaId);
    if (!qa) return;
    if (!confirm(`删除这个问答？\n\n${qa.question}`)) return;
    state.content.qas = qas.filter((item) => item.id !== qaId);
    if (!saveContent()) return;
    buildQaList();
    refreshOwnerUi();
  }

  function buildImageLab() {
    const slots = [{ title: "首页大图", slot: data.university.heroSlot, section: "Hero" }];
    state.content.sections.forEach((section) => {
      section.items.forEach((item) => slots.push({ title: item.title, slot: item.slot, section: section.label }));
    });

    const totalImages = slots.reduce((sum, item) => sum + getImages(item.slot, "").length, 0);
    slotList.innerHTML = `
      <div class="lab-tools owner-only">
        <div>
          <strong>本地图片缓存</strong>
          <small>当前记录约 ${totalImages} 张图。上传失败时，先导出备份，再清理缓存。</small>
        </div>
        <button class="upload-mini danger" type="button" data-clear-image-cache>
          ${icon("trash-2")}
          <span>清空本地图片缓存</span>
        </button>
      </div>
      ${slots.map((item) => {
        const images = getImages(item.slot, "");
        const src = images[0] || "";
        return `
          <div class="slot-row">
            <div class="slot-thumb" data-thumb-for="${escapeHtml(item.slot)}" style="${src ? `background-image:url('${escapeHtml(src)}')` : ""}"></div>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.section)} / ${escapeHtml(item.slot)} / ${images.length} 张</small>
            </div>
            <div class="slot-actions owner-only">
              <button class="upload-mini" type="button" data-upload-slot="${escapeHtml(item.slot)}">
                ${icon("image-plus")}
                <span>加图</span>
              </button>
              <button class="upload-mini ghost" type="button" data-manage-images="${escapeHtml(item.slot)}" data-manage-title="${escapeHtml(item.title)}">
                ${icon("sliders-horizontal")}
                <span>编辑图片</span>
              </button>
              <button class="upload-mini ghost" type="button" data-clear-slot-images="${escapeHtml(item.slot)}" data-clear-slot-title="${escapeHtml(item.title)}" ${images.length ? "" : "disabled"}>
                ${icon("eraser")}
                <span>清此槽</span>
              </button>
            </div>
          </div>
        `;
      }).join("")}
    `;
  }

  function syncImagesFromData() {
    setImages(data.university.heroSlot, getImages(data.university.heroSlot, data.university.heroImage));
    state.content.sections.forEach((section) => {
      section.items.forEach((item) => setImages(item.slot, getImages(item.slot, item.image)));
    });
  }

  function applyFilters() {
    state.content.sections.forEach((section) => {
      const panel = $(`[data-section="${section.id}"]`);
      if (!panel) return;
      const cards = $$('[data-card]', panel);
      const selectedElement = state.sectionFilters[section.id] || '';
      const selectedLabel = selectedElement ? getElementLabel(section, selectedElement) : '';
      let visibleCount = 0;

      cards.forEach((card) => {
        const hasElement = Boolean(selectedElement) && card.dataset.element === selectedElement;
        const isHiddenCard = card.dataset.cardHidden === 'true';
        const visible = hasElement && (state.ownerUnlocked || !isHiddenCard);

        // 重要：不要只依赖 HTML hidden 属性。
        // 这个项目里的 .place-card 原本写了 display:flex，浏览器默认的 [hidden]{display:none}
        // 可能会被覆盖，结果就会变成"点一个元素，整个板块所有卡片都出现"。
        // 所以这里同时使用 hidden 属性 + CSS 专用类，双保险保证元素和卡片一一对应显示。
        card.hidden = !visible;
        card.setAttribute('aria-hidden', String(!visible));
        card.classList.toggle('is-filtered-out', !visible);
        card.classList.toggle('is-hidden-card', isHiddenCard);

        if (visible) {
          card.classList.add('is-visible');
          visibleCount += 1;
        } else {
          card.classList.remove('is-visible');
          card.classList.remove('is-expanded');
        }
      });

      panel.classList.toggle('has-empty', visibleCount === 0);
      panel.classList.toggle('has-picked-element', Boolean(selectedElement));
      const emptyState = $('.empty-state', panel);
      if (emptyState) {
        if (!selectedElement) {
          emptyState.textContent = '请先单击上方元素按钮或地图点位，属于这个元素的卡片会在这里出现。';
        } else {
          emptyState.textContent = state.ownerUnlocked
            ? `「${selectedLabel}」下面还没有卡片。`
            : `「${selectedLabel}」暂无可展示卡片，可能还没添加或已被主人隐藏。`;
        }
      }
      const tip = $('[data-card-tip]', panel);
      if (tip) {
        tip.textContent = selectedElement
          ? `当前显示：${selectedLabel}。再次单击同一个元素可收起卡片，单击其他元素可切换。`
          : '先单击上方元素或地图点位，再显示对应卡片；再次单击同一个元素可收起。';
      }
    });

    $$('[data-section-filter][data-element]').forEach((chip) => {
      const active = state.sectionFilters[chip.dataset.sectionFilter] || '';
      chip.classList.toggle('is-active', chip.dataset.element === active);
      chip.setAttribute('aria-pressed', String(chip.dataset.element === active));
    });

    $$('[data-pin-open]').forEach((pinRow) => {
      const active = state.sectionFilters[pinRow.dataset.pinSection] || '';
      pinRow.classList.toggle('is-active', pinRow.dataset.pinElement === active);
    });

    // 卡片过滤后 DOM 变动可能触发移动端 WebGL 上下文丢失，延迟 resize 修复灰屏
    Object.values(state.maps).forEach(function (m) {
      if (m && m.resize) { setTimeout(function () { m.resize(); }, 150); }
    });
  }

  function toggleElementCards(sectionId, elementId, options = {}) {
    const section = getSection(sectionId);
    if (!section || !getElement(section, elementId)) return;
    state.sectionFilters[sectionId] = state.sectionFilters[sectionId] === elementId ? '' : elementId;
    applyFilters();

    if (options.scroll) {
      const panel = $(`[data-section="${cssEscape(sectionId)}"]`);
      const target = panel && ($('[data-card-tip]', panel) || $('[data-card-grid]', panel) || panel);
      if (target && target.scrollIntoView) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  function showElementCards(sectionId, elementId, options = {}) {
    const section = getSection(sectionId);
    if (!section || !getElement(section, elementId)) return;
    state.sectionFilters[sectionId] = elementId;
    applyFilters();

    if (options.scroll) {
      const panel = $(`[data-section="${cssEscape(sectionId)}"]`);
      const target = panel && ($('[data-card-tip]', panel) || $('[data-card-grid]', panel) || panel);
      if (target && target.scrollIntoView) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  function updateActiveNav() {
    let active = state.activeSection;
    const panels = $$(".module-panel");
    const marker = window.innerHeight * 0.35;
    panels.forEach((panel) => {
      const rect = panel.getBoundingClientRect();
      if (rect.top <= marker && rect.bottom >= marker) active = panel.id;
    });
    state.activeSection = active;
    $$(".nav-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.jump === active);
    });
  }

  function wireImageChannel(channel) {
    const input = $(".file-input", channel);
    const button = $(".image-action, .upload-mini", channel);
    if (!input || !button) return;
    input.multiple = true;

    button.addEventListener("click", () => {
      if (!requireOwner("上传图片")) return;
      input.click();
    });
    input.addEventListener("change", () => {
      const files = input.files ? Array.from(input.files) : [];
      if (files.length && requireOwner("上传图片")) readImageFiles(channel.dataset.slot, files);
      input.value = "";
    });

    channel.addEventListener("dblclick", (event) => {
      if (event.target.closest("button, input, select, textarea, a")) return;
      const card = channel.closest("[data-card]");
      openImageViewer(channel.dataset.slot, card ? card.dataset.title : (channel.dataset.label || "图片预览"));
    });

    channel.addEventListener("dragover", (event) => {
      if (!state.ownerUnlocked) return;
      event.preventDefault();
      channel.classList.add("drag-over");
    });
    channel.addEventListener("dragleave", () => channel.classList.remove("drag-over"));
    channel.addEventListener("drop", (event) => {
      event.preventDefault();
      channel.classList.remove("drag-over");
      const files = Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith("image/"));
      if (files.length && requireOwner("上传图片")) readImageFiles(channel.dataset.slot, files);
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function compressImageFile(file) {
    if (file.type === "image/gif") return readFileAsDataUrl(file);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const outputType = file.type === "image/png" && file.size < 450 * 1024 ? "image/png" : "image/jpeg";
          resolve(canvas.toDataURL(outputType, outputType === "image/jpeg" ? IMAGE_QUALITY : undefined));
        };
        img.onerror = reject;
        img.src = String(reader.result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function readImageFiles(slot, files) {
    if (!requireOwner("上传图片")) return;
    const imageFiles = files.filter((file) => file && file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    const existing = getImages(slot, "");
    let incoming = [];
    try {
      incoming = await Promise.all(imageFiles.map(compressImageFile));
    } catch (error) {
      console.warn("Image compression failed; using original files.", error);
      incoming = await Promise.all(imageFiles.map(readFileAsDataUrl));
    }
    if (state.cloud.enabled) {
      const result = await uploadImagesToCloud(slot, incoming);
      incoming = result.images;
      if (result.failed > 0) notifyImageFallback();
      if (result.pending > 0) notifyImageDeploying();
    }
    const combined = existing.concat(incoming);
    const nextImages = combined.slice(-MAX_IMAGES_PER_SLOT);
    const trimmed = combined.length - nextImages.length;
    if (!saveImages(slot, nextImages)) {
      const fallback = incoming.slice(-2);
      if (!saveImages(slot, fallback)) return;
    }
    if (trimmed > 0) {
      alert(`已自动移除最早的 ${trimmed} 张（槽位上限 ${MAX_IMAGES_PER_SLOT} 张）。`);
    }
    state.activeImageIndex[slot] = Math.max(0, nextImages.length - incoming.length);
    rerenderEditableArea();
  }

  function notifyImageFallback() {
    const now = Date.now();
    if (now - state.cloud.imageNoticeAt < 12000) return;
    state.cloud.imageNoticeAt = now;
    alert("部分图片未能上传到云端，已压缩保存到当前浏览器。\n\n要让图片跨设备同步可见：\n① 配置 Cloudflare R2；或\n② 把图片放到仓库 assets/images/，再在「管图」中添加静态路径。\n\n本地图片不会写入 D1，避免撑爆数据库。");
  }

  function notifyImageDeploying() {
    const now = Date.now();
    if (now - state.cloud.imageNoticeAt < 12000) return;
    state.cloud.imageNoticeAt = now;
    alert("图片已上传到 GitHub，Cloudflare 正在自动部署。\n\n通常几十秒后即可跨设备显示；如果当前卡片暂时空白，请稍后刷新页面。");
  }

  async function uploadImagesToCloud(slot, dataUrls) {
    if (!state.cloud.enabled || !state.ownerUnlocked) return { images: dataUrls.slice(), failed: 0 };
    const images = [];
    let failed = 0;
    let pending = 0;
    for (const dataUrl of dataUrls) {
      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-admin-token": getOwnerToken()
          },
          body: JSON.stringify({ slot, dataUrl })
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `Upload failed: ${response.status}`);
        }
        const result = await response.json();
        if (result.ok && result.url) {
          images.push(result.url);
          if (result.pendingDeployment) pending += 1;
        } else {
          throw new Error(result.error || "Upload failed");
        }
      } catch (error) {
        failed += 1;
        images.push(dataUrl);
        console.warn("R2 upload failed, keeping image as local-only.", error);
      }
    }
    return { images, failed, pending };
  }

  function wireLabUploads() {
    $$("[data-upload-slot]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!requireOwner("图片通道上传")) return;
        const slot = button.dataset.uploadSlot;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.addEventListener("change", () => {
          const files = input.files ? Array.from(input.files) : [];
          if (files.length) readImageFiles(slot, files);
        });
        input.click();
      });
    });
  }

  function loadPins(sectionId) {
    try {
      const saved = JSON.parse(localStorage.getItem(pinStorageKey(sectionId)) || "null");
      if (Array.isArray(saved)) return saved;
    } catch (error) {
      console.warn("Map pin storage could not be read.", error);
    }

    try {
      const section = getSection(sectionId);
      const legacy = JSON.parse(localStorage.getItem(legacyPinStorageKey(sectionId)) || "[]");
      if (!Array.isArray(legacy) || !section) return [];
      return legacy.map((pin) => {
        const element = section.elements.find((entry) => entry.label === pin.label) || section.elements[0];
        return {
          id: makeId("pin"),
          elementId: element ? element.id : "",
          label: pin.label || (element && element.label) || "点位",
          lng: Number(pin.lng),
          lat: Number(pin.lat),
          updatedAt: pin.updatedAt || Date.now()
        };
      }).filter((pin) => Number.isFinite(pin.lng) && Number.isFinite(pin.lat));
    } catch (error) {
      console.warn("Legacy map pins could not be read.", error);
      return [];
    }
  }

  function getPins(sectionId) {
    return loadPins(sectionId);
  }

  function savePins(sectionId, pins) {
    var ok = safeSetItem(pinStorageKey(sectionId), JSON.stringify(pins), "地图点位");
    scheduleCloudSave();
    return ok;
  }

  function selectMapElement(sectionId, elementId) {
    if (!requireOwner("选择地图标注元素")) return;
    const section = getSection(sectionId);
    state.activeMapElement[sectionId] = elementId;
    updatePinBank(sectionId);
    updatePinList(sectionId, `已选择「${getElementLabel(section, elementId)}」。`);
  }

  function clearSectionPins(sectionId) {
    if (!requireOwner("清空地图点位")) return;
    savePins(sectionId, []);
    renderPins(sectionId);
    updatePinList(sectionId, "当前板块点位已清空。");
  }

  function placePin(sectionId, lngLat) {
    if (!requireOwner("新增地图点位")) return;
    const section = getSection(sectionId);
    const elementId = state.activeMapElement[sectionId];
    if (!section || !elementId) {
      updatePinList(sectionId, "先选择一个元素。");
      const card = $(`[data-map-card="${cssEscape(sectionId)}"]`);
      if (card) {
        card.animate([
          { transform: "translateX(0)" },
          { transform: "translateX(-5px)" },
          { transform: "translateX(5px)" },
          { transform: "translateX(0)" }
        ], { duration: 260, easing: "ease-out" });
      }
      return;
    }

    const label = getElementLabel(section, elementId);
    const pins = getPins(sectionId);
    pins.push({
      id: makeId("pin"),
      elementId,
      label,
      lng: Number(lngLat[0].toFixed(6)),
      lat: Number(lngLat[1].toFixed(6)),
      updatedAt: Date.now()
    });
    savePins(sectionId, pins);
    renderPins(sectionId);
    updatePinList(sectionId, `「${label}」已新增点位。`);
  }

  function deletePin(sectionId, pinId) {
    if (!requireOwner("删除地图点位")) return;
    savePins(sectionId, getPins(sectionId).filter((pin) => pin.id !== pinId));
    renderPins(sectionId);
  }

  function updatePinBank(sectionId) {
    const pins = getPins(sectionId);
    const elementIdsWithPins = new Set(pins.map((pin) => pin.elementId));
    $$(`[data-map-section="${cssEscape(sectionId)}"][data-map-element]`).forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mapElement === state.activeMapElement[sectionId]);
      button.classList.toggle("has-pin", elementIdsWithPins.has(button.dataset.mapElement));
    });
  }

  function updatePinList(sectionId, notice) {
    const list = $(`[data-pin-list="${cssEscape(sectionId)}"]`);
    const section = getSection(sectionId);
    if (!list || !section) return;
    const pins = getPins(sectionId);
    if (notice) {
      list.innerHTML = `<strong>${escapeHtml(notice)}</strong>${pins.length ? renderPinSummary(section, pins) : ""}`;
      refreshIcons();
      return;
    }
    list.innerHTML = pins.length ? renderPinSummary(section, pins) : "还没有标注点位";
    refreshIcons();
  }

  function renderPinSummary(section, pins) {
    return `
      <div class="pin-summary">
        ${pins.map((pin, index) => `
          <div class="pin-row" role="button" tabindex="0" data-pin-open="${escapeHtml(pin.id)}" data-pin-section="${section.id}" data-pin-element="${escapeHtml(pin.elementId)}" aria-label="显示 ${escapeHtml(getElementLabel(section, pin.elementId) || pin.label)} 的卡片">
            <b>${index + 1}</b>
            <span>
              <strong>${escapeHtml(getElementLabel(section, pin.elementId) || pin.label)}</strong>
              <small>单击显示卡片 · ${pin.lng}, ${pin.lat}</small>
            </span>
            <button class="pin-delete owner-only" type="button" data-delete-pin="${escapeHtml(pin.id)}" data-pin-section="${section.id}" aria-label="删除点位">${icon("trash-2")}</button>
          </div>
        `).join("")}
      </div>
    `;
  }

  function getAmapCredentials() {
    const config = data.university.campusMap || {};
    return {
      key: localStorage.getItem(amapKeyStorageKey) || config.apiKey || "",
      securityJsCode: localStorage.getItem(amapSecurityStorageKey) || config.securityJsCode || ""
    };
  }

  function openMapKeyEditor() {
    if (!requireOwner("设置高德地图 Key")) return;
    const current = getAmapCredentials();
    const key = prompt("粘贴高德 Web 端 JS API Key", current.key);
    if (key === null) return;
    if (!safeSetItem(amapKeyStorageKey, key.trim(), "高德地图 Key")) return;
    const code = prompt("安全密钥 securityJsCode，可留空", current.securityJsCode);
    if (code !== null && !safeSetItem(amapSecurityStorageKey, code.trim(), "高德地图安全密钥")) return;
    initAmapMaps(true);
  }

  function showMapNotice(message) {
    $$(".satellite-map").forEach((mapEl) => {
      mapEl.innerHTML = `
        <div class="map-notice">
          <strong>${escapeHtml(message)}</strong>
          <button class="tool-button owner-only" type="button" data-open-map-key>${icon("key-round")}<span>设置 Key</span></button>
        </div>
      `;
    });
    state.content.sections.forEach((section) => updatePinList(section.id));
    refreshIcons();
  }

  /* ================================================================
     MapInitQueue — 串行化 new AMap.Map()，防 WebGL Shader 竞争白屏
     ================================================================ */
  var _mapQueue = [];
  var _mapQueueRunning = 0;

  function mapQueueEnqueue(factory) {
    return new Promise(function (resolve, reject) {
      _mapQueue.push({ factory: factory, resolve: resolve, reject: reject });
      _mapQueueDrain();
    });
  }

  function _mapQueueDrain() {
    while (_mapQueueRunning < 1 && _mapQueue.length > 0) {
      var task = _mapQueue.shift();
      _mapQueueRunning++;
      try {
        var map = task.factory();
        Promise.resolve(map).then(function (m) {
          _waitMapComplete(m).then(function () { task.resolve(m); _mapQueueRunning--; _mapQueueDrain(); }).catch(task.reject);
        }).catch(task.reject);
      } catch (err) {
        task.reject(err);
        _mapQueueRunning--;
        _mapQueueDrain();
      }
    }
  }

  function _waitMapComplete(map) {
    return new Promise(function (resolve) {
      if (map._isComplete) { resolve(); return; }
      map.on('complete', function () { map._isComplete = true; resolve(); });
    });
  }

  /* ================================================================
     MapPreloader — 1×1px 隐形预热，确保首个正式地图不白屏
     ================================================================ */
  var _preloaderDone = false;
  var _preloaderPromise = null;

  // 全局持有预热实例引用，确保不被 GC 回收导致 WebGL 上下文丢失
  var _warmMapRef = null;

  function preheatAMap(AMap) {
    if (_preloaderDone) return Promise.resolve();
    if (_preloaderPromise) return _preloaderPromise;
    _preloaderPromise = new Promise(function (resolve) {
      var mapConfig = data.university.campusMap || {};
      var center = mapConfig.center || [113.920343, 30.936542];
      var zoom = mapConfig.zoom || 16;
      // 使用和正式地图相同的 center/zoom/layers，触发相同 Shader 编译
      var container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:200px;height:200px;pointer-events:none;';
      document.body.appendChild(container);
      var warmMap = new AMap.Map(container, { zoom: zoom, center: center, viewMode: '2D' });
      _warmMapRef = warmMap;
      warmMap.on('complete', function () {
        // 等 2.5 秒让移动端 Shader 完全编译并缓存到 HTTP
        // 不销毁预热实例 — 移动端销毁 WebGL 上下文会导致共享 Shader 缓存失效
        setTimeout(function () {
          _preloaderDone = true;
          resolve();
        }, 2500);
      });
      setTimeout(function () {
        _preloaderDone = true;
        resolve();
      }, 10000);
    });
    return _preloaderPromise;
  }

  function ensureAmapLoader() {
    if (window.AMapLoader) return Promise.resolve(window.AMapLoader);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-amap-loader="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.AMapLoader));
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://webapi.amap.com/loader.js";
      script.async = true;
      script.dataset.amapLoader = "true";
      script.addEventListener("load", () => resolve(window.AMapLoader));
      script.addEventListener("error", reject);
      document.head.appendChild(script);
    });
  }

  function destroyMaps() {
    Object.values(state.markers).flat().forEach((marker) => {
      if (marker && marker.setMap) marker.setMap(null);
    });
    Object.values(state.maps).forEach((map) => {
      if (map && map.destroy) map.destroy();
    });
    state.maps = {};
    state.markers = {};
  }

  // IntersectionObserver 懒加载：滚动到地图附近才创建，避免移动端多 WebGL 上下文冲突
  var _lazyObserver = null;

  function lazyInitMaps(AMap) {
    if (_lazyObserver) { _lazyObserver.disconnect(); }
    // 记录已入队但尚未完成的 section，避免重复入队
    var pending = {};
    _lazyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var sectionId = entry.target.dataset.sectionId;
        if (!sectionId || state.maps[sectionId] || pending[sectionId]) return;
        pending[sectionId] = true;
        _lazyObserver.unobserve(entry.target);
        var section = getSection(sectionId);
        if (!section) return;
        mapQueueEnqueue(function () {
          var m = initSectionMap(AMap, section);
          delete pending[sectionId];
          return m;
        });
      });
    }, { rootMargin: '500px 0px' });

    state.content.sections.forEach(function (section) {
      var el = $('#map-' + cssEscape(section.id));
      if (!el) return;
      el.dataset.sectionId = section.id;
      _lazyObserver.observe(el);
    });
  }

  function initAmapMaps(forceReload) {
    const mapConfig = data.university.campusMap || {};
    const credentials = getAmapCredentials();
    destroyMaps();
    if (!credentials.key) {
      showMapNotice("当前未设置高德地图 Key。");
      return;
    }
    if (credentials.securityJsCode) {
      window._AMapSecurityConfig = { securityJsCode: credentials.securityJsCode };
    }

    if (!state.amapLoading || forceReload) {
      state.amapLoading = ensureAmapLoader()
        .then((loader) => loader.load({
          key: credentials.key,
          version: mapConfig.version || "2.0",
          plugins: ["AMap.Scale", "AMap.ToolBar"]
        }))
        .then((AMap) => {
          state.AMap = AMap;
          // 预热：1×1px 隐形 map 确保 WebGL Shader 缓存就绪
          return preheatAMap(AMap).then(function () { return AMap; });
        });
    }

    state.amapLoading
      .then((AMap) => {
        // 懒加载：只创建视口附近的地图，避免移动端 WebGL 上下文竞争
        lazyInitMaps(AMap);
      })
      .catch((error) => {
        console.warn("AMap could not be loaded.", error);
        showMapNotice("高德地图加载失败，请检查 Key、网络或安全密钥。");
      });
  }

  function initSectionMap(AMap, section) {
    const mapConfig = data.university.campusMap || {};
    const mapEl = $(`#map-${cssEscape(section.id)}`);
    if (!mapEl) return null;
    mapEl.innerHTML = "";
    const center = mapConfig.center || [113.920343, 30.936542];
    const satellite = new AMap.TileLayer.Satellite();
    const roadNet = new AMap.TileLayer.RoadNet();
    const map = new AMap.Map(mapEl, {
      viewMode: mapConfig.viewMode || "2D",
      zoom: mapConfig.zoom || 16,
      center,
      resizeEnable: true,
      mapStyle: mapConfig.mapStyle || "amap://styles/normal",
      layers: [satellite, roadNet]
    });

    map.addControl(new AMap.Scale());
    map.addControl(new AMap.ToolBar({ position: "RT" }));
    map.on("click", (event) => {
      if (!state.ownerUnlocked) return;
      placePin(section.id, [event.lnglat.getLng(), event.lnglat.getLat()]);
    });

    state.maps[section.id] = map;
    state.markers[section.id] = [];
    renderPins(section.id);
    return map;
  }

  function renderPins(sectionId) {
    const section = getSection(sectionId);
    const AMap = state.AMap;
    const map = state.maps[sectionId];
    if (!section) return;
    if (!AMap || !map) {
      updatePinBank(sectionId);
      updatePinList(sectionId);
      return;
    }

    (state.markers[sectionId] || []).forEach((marker) => marker.setMap(null));
    state.markers[sectionId] = getPins(sectionId).map((pin, index) => {
      const marker = new AMap.Marker({
        map,
        position: [pin.lng, pin.lat],
        draggable: state.ownerUnlocked,
        cursor: "move",
        offset: new AMap.Pixel(-17, -34),
        content: `<div class="amap-campus-pin" style="--pin:${section.accent}"><span>${index + 1}</span></div>`
      });
      marker.setLabel({
        direction: "top",
        offset: new AMap.Pixel(0, -10),
        content: `<div class="amap-pin-label">${escapeHtml(getElementLabel(section, pin.elementId) || pin.label)}</div>`
      });
      marker.on("click", () => {
        showElementCards(sectionId, pin.elementId, { scroll: true });
      });
      marker.on("dragend", (event) => {
        if (!requireOwner("移动地图点位")) return;
        const pins = getPins(sectionId);
        const target = pins.find((item) => item.id === pin.id);
        if (!target) return;
        target.lng = Number(event.lnglat.getLng().toFixed(6));
        target.lat = Number(event.lnglat.getLat().toFixed(6));
        target.updatedAt = Date.now();
        savePins(sectionId, pins);
        updatePinList(sectionId);
      });
      return marker;
    });

    updatePinBank(sectionId);
    updatePinList(sectionId);
  }

  function addSection() {
    if (!requireOwner("新增板块")) return;
    const label = prompt("请输入新板块名称，例如：校内美食、校门交通、社团活动。", "新板块");
    if (!label || !label.trim()) return;
    const cleanLabel = label.trim();
    const short = prompt("请输入左侧导航简称，建议 2 到 4 个字。", cleanLabel.slice(0, 4)) || cleanLabel.slice(0, 4) || "板块";
    const iconName = prompt("请输入图标英文名。不懂就直接点确定，默认用 map-pinned。", "map-pinned") || "map-pinned";
    const tone = prompt("请输入这个板块的说明文字。", `这里整理「${cleanLabel}」相关的新生常用信息，可继续添加元素、卡片和图片。`) || `这里整理「${cleanLabel}」相关的新生常用信息，可继续添加元素、卡片和图片。`;
    const firstElementLabel = prompt("请输入这个板块里的第一个元素名称。\n例如：一食堂、南门、篮球场。", cleanLabel) || cleanLabel;
    const sectionId = ensureUniqueSectionId(cleanSectionId(cleanLabel));
    const elementId = makeId(`${sectionId}-element`);
    const cardId = makeId(`${sectionId}-card`);
    const slot = makeId(`${sectionId}-image`);
    const section = normalizeSection({
      id: sectionId,
      label: cleanLabel,
      short: short.trim() || cleanLabel.slice(0, 4) || "板块",
      icon: iconName.trim() || "map-pinned",
      accent: nextAccent(),
      tone: tone.trim(),
      filters: [firstElementLabel.trim()],
      elements: [{ id: elementId, label: firstElementLabel.trim() || cleanLabel }],
      items: [{
        id: cardId,
        title: firstElementLabel.trim() || cleanLabel,
        subtitle: "点击编辑按钮补充介绍、要点和图片。",
        image: "",
        slot,
        elementId,
        tags: [],
        facts: ["点击开发者权限后，可以编辑这张卡片。", "可以继续添加元素、卡片、图片和地图点位。"],
        gender: "all",
        hidden: false
      }]
    });
    state.content.sections.push(section);
    state.activeSection = section.id;
    state.sectionFilters[section.id] = elementId;
    state.activeMapElement[section.id] = elementId;
    if (!saveContent()) return;
    rerenderEditableArea();
    const panel = document.getElementById(section.id);
    if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function editSection(sectionId) {
    if (!requireOwner("编辑板块")) return;
    const section = getSection(sectionId);
    if (!section) return;
    const label = prompt("修改板块名称", section.label);
    if (!label || !label.trim()) return;
    const short = prompt("修改左侧导航简称", section.short || label.trim().slice(0, 4));
    if (short === null) return;
    const tone = prompt("修改板块说明", section.tone || "");
    if (tone === null) return;
    const iconName = prompt("修改图标英文名。不懂就保持原样。", section.icon || "map-pinned");
    if (iconName === null) return;
    const accent = prompt("修改主题颜色。格式示例：#0f9f8f。不懂就保持原样。", section.accent || nextAccent());
    if (accent === null) return;
    section.label = label.trim();
    section.short = short.trim() || section.label.slice(0, 4) || "板块";
    section.tone = tone.trim();
    section.icon = iconName.trim() || "map-pinned";
    section.accent = /^#[0-9a-fA-F]{3,8}$/.test(accent.trim()) ? accent.trim() : (section.accent || nextAccent());
    if (!saveContent()) return;
    rerenderEditableArea();
  }

  function deleteSection(sectionId) {
    if (!requireOwner("删除板块")) return;
    const section = getSection(sectionId);
    if (!section) return;
    if (state.content.sections.length <= 1) {
      alert("至少要保留一个板块，不能全部删除。");
      return;
    }
    if (!confirm(`确定删除整个板块「${section.label}」吗？\n\n这个操作会删除这个板块下的元素、卡片和地图点位。图片槽里的缓存图片会保留在浏览器里，你可以去图片通道清理。`)) return;
    state.content.sections = state.content.sections.filter((item) => item.id !== sectionId);
    delete state.sectionFilters[sectionId];
    delete state.activeMapElement[sectionId];
    safeRemoveItem(pinStorageKey(sectionId));
    safeRemoveItem(legacyPinStorageKey(sectionId));
    state.activeSection = state.content.sections[0].id;
    if (!saveContent()) return;
    rerenderEditableArea();
  }

  function addElement(sectionId) {
    if (!requireOwner("新增元素")) return;
    const section = getSection(sectionId);
    if (!section) return;
    const label = prompt("新元素名称", `新元素 ${section.elements.length + 1}`);
    if (!label || !label.trim()) return;
    const element = { id: makeId("element"), label: label.trim() };
    section.elements.push(element);
    state.sectionFilters[sectionId] = element.id;
    state.activeMapElement[sectionId] = element.id;
    if (!saveContent()) return;
    rerenderEditableArea();
  }

  function editElement(sectionId, elementId) {
    if (!requireOwner("编辑元素")) return;
    const section = getSection(sectionId);
    const element = section && getElement(section, elementId);
    if (!element) return;
    const label = prompt("修改元素名称", element.label);
    if (!label || !label.trim()) return;
    element.label = label.trim();
    if (!saveContent()) return;
    rerenderEditableArea();
  }

  function deleteElement(sectionId, elementId) {
    if (!requireOwner("删除元素")) return;
    const section = getSection(sectionId);
    if (!section || section.elements.length <= 1) {
      alert("每个板块至少保留一个元素。");
      return;
    }
    const element = getElement(section, elementId);
    const cardCount = section.items.filter((item) => item.elementId === elementId).length;
    if (!element) return;
    if (!confirm(`删除元素「${element.label}」？${cardCount ? `它下面的 ${cardCount} 张卡片会移到第一个元素。` : ""}`)) return;
    section.elements = section.elements.filter((item) => item.id !== elementId);
    const fallback = section.elements[0];
    section.items.forEach((item) => {
      if (item.elementId === elementId) item.elementId = fallback.id;
    });
    if (state.sectionFilters[sectionId] === elementId) delete state.sectionFilters[sectionId];
    if (state.activeMapElement[sectionId] === elementId) state.activeMapElement[sectionId] = fallback.id;
    const pins = getPins(sectionId).map((pin) => pin.elementId === elementId ? { ...pin, elementId: fallback.id, label: fallback.label } : pin);
    savePins(sectionId, pins);
    if (!saveContent()) return;
    rerenderEditableArea();
  }

  function createCard(sectionId) {
    if (!requireOwner("新增卡片")) return;
    const section = getSection(sectionId);
    if (!section) return;
    if (!section.elements.length) {
      section.elements.push({ id: makeId("element"), label: "默认元素" });
    }
    openCardEditor(sectionId, null);
  }

  function ensureEditorShell() {
    if ($("#contentEditor")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <aside class="content-editor" id="contentEditor" aria-hidden="true" aria-label="编辑卡片">
        <form class="content-editor-panel" id="contentEditorForm">
          <div class="lab-header">
            <div>
              <p class="eyebrow">Edit Card</p>
              <h2 id="contentEditorTitle">编辑卡片</h2>
            </div>
            <button class="icon-button" type="button" data-close-editor aria-label="关闭编辑">
              ${icon("x")}
            </button>
          </div>
          <div class="editor-fields">
            <label>标题<input name="title" required></label>
            <label>副标题<textarea name="subtitle" rows="3"></textarea></label>
            <label>所属元素<select name="elementId"></select></label>
            <label>图片槽名<input name="slot" required></label>
            <label>要点<textarea name="facts" rows="6" placeholder="每行一条"></textarea></label>
          </div>
          <div class="editor-actions">
            <button class="tool-button danger" type="button" data-delete-card>${icon("trash-2")}<span>删除</span></button>
            <button class="tool-button" type="submit">${icon("save")}<span>保存</span></button>
          </div>
        </form>
      </aside>
    `);
  }

  function openCardEditor(sectionId, cardId) {
    if (!requireOwner("编辑卡片")) return;
    ensureEditorShell();
    const section = getSection(sectionId);
    if (!section) return;
    const card = cardId ? section.items.find((item) => item.id === cardId) : null;
    state.editor = { sectionId, cardId };
    const editor = $("#contentEditor");
    const form = $("#contentEditorForm");
    $("#contentEditorTitle").textContent = card ? "编辑卡片" : "新增卡片";
    form.title.value = card ? card.title : "";
    form.subtitle.value = card ? card.subtitle : "";
    form.slot.value = card ? card.slot : makeId(`${section.id}-image`);
    form.facts.value = card ? card.facts.join("\n") : "";
    form.elementId.innerHTML = section.elements.map((element) => `
      <option value="${escapeHtml(element.id)}">${escapeHtml(element.label)}</option>
    `).join("");
    form.elementId.value = card ? card.elementId : (state.sectionFilters[sectionId] || section.elements[0].id);
    $("[data-delete-card]", form).hidden = !card;
    editor.classList.add("is-open");
    editor.setAttribute("aria-hidden", "false");
    refreshIcons();
  }

  function closeCardEditor() {
    const editor = $("#contentEditor");
    if (!editor) return;
    editor.classList.remove("is-open");
    editor.setAttribute("aria-hidden", "true");
    state.editor = null;
  }

  function saveCardFromEditor(form) {
    if (!requireOwner("保存卡片")) return;
    if (!state.editor) return;
    const section = getSection(state.editor.sectionId);
    if (!section) return;
    const facts = form.facts.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const payload = {
      title: form.title.value.trim() || "未命名卡片",
      subtitle: form.subtitle.value.trim(),
      slot: form.slot.value.trim() || makeId("image"),
      elementId: form.elementId.value,
      facts,
      gender: "all",
      image: ""
    };

    if (state.editor.cardId) {
      const card = section.items.find((item) => item.id === state.editor.cardId);
      if (!card) return;
      Object.assign(card, payload);
    } else {
      section.items.push({
        id: makeId("card"),
        tags: [],
        ...payload
      });
    }
    state.sectionFilters[section.id] = payload.elementId;
    if (!saveContent()) return;
    closeCardEditor();
    rerenderEditableArea();
  }

  function deleteCurrentCard() {
    if (!requireOwner("删除卡片")) return;
    if (!state.editor || !state.editor.cardId) return;
    const section = getSection(state.editor.sectionId);
    const card = section && section.items.find((item) => item.id === state.editor.cardId);
    if (!section || !card) return;
    if (!confirm(`删除卡片「${card.title}」？`)) return;
    section.items = section.items.filter((item) => item.id !== card.id);
    if (!saveContent()) return;
    closeCardEditor();
    rerenderEditableArea();
  }

  function toggleCardHidden(sectionId, cardId) {
    if (!requireOwner("隐藏或恢复卡片")) return;
    const section = getSection(sectionId);
    const card = section && section.items.find((item) => item.id === cardId);
    if (!section || !card) return;
    const nextHidden = !card.hidden;
    const message = nextHidden
      ? `隐藏卡片「${card.title}」？隐藏后访客模式看不到，主人模式仍能看到并恢复。`
      : `恢复显示卡片「${card.title}」？恢复后访客也能看到。`;
    if (!confirm(message)) return;
    card.hidden = nextHidden;
    if (!saveContent()) return;
    rerenderEditableArea();
  }

  function getAllSlots() {
    const slots = new Set([data.university.heroSlot]);
    state.content.sections.forEach((section) => {
      section.items.forEach((item) => slots.add(item.slot));
    });
    return Array.from(slots);
  }


  function cleanupDuplicateLegacyImageStorage() {
    // 旧版会把首图单独存一份 hbeu-image-xxx。新版只需要 hbeu-images-xxx。
    // 初始化时删除这些重复副本，可以立刻释放一部分浏览器本地存储。
    getAllSlots().forEach((slot) => {
      try {
        if (localStorage.getItem(imageListStorageKey(slot))) {
          localStorage.removeItem(storageKey(slot));
        }
      } catch (error) {
        console.warn("Could not compact duplicated image storage.", error);
      }
    });
  }

  function clearLocalImageCache() {
    if (!requireOwner("清空本地图片缓存")) return;
    const ok = confirm("清空本地图片缓存会删除这个浏览器里所有已上传图片。\n\n建议你先点右上角“导出备份”。如果已经因为存储满了无法继续上传，可以清空后重新上传图片。\n\n确定清空吗？");
    if (!ok) return;
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("hbeu-images-") || key.startsWith("hbeu-image-"))) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
      state.activeImageIndex = {};
      rerenderEditableArea();
      alert("本地图片缓存已清空。现在可以重新上传图片。\n\n注意：卡片文字、元素、点位没有被清空。只清空了浏览器里存的图片。");
    } catch (error) {
      console.warn("Image cache cleanup failed.", error);
      alert("清理失败。请按我给你的浏览器清理步骤，在浏览器设置里清理这个网站的数据。");
    }
  }

  function clearSlotImages(slot, title) {
    if (!requireOwner("清理这个图片槽")) return;
    if (!confirm(`清空「${title || slot}」这个图片槽里的图片？\n\n只会删除这个槽位的图片，不会删除卡片文字。`)) return;
    safeRemoveItem(imageListStorageKey(slot));
    safeRemoveItem(storageKey(slot));
    delete state.activeImageIndex[slot];
    rerenderEditableArea();
  }

  function exportBackup() {
    if (!requireOwner("导出备份")) return;
    const imageStacks = {};
    getAllSlots().forEach((slot) => {
      imageStacks[slot] = getImages(slot, "");
    });
    const pins = {};
    state.content.sections.forEach((section) => {
      pins[section.id] = getPins(section.id);
    });
    const backup = {
      app: "hbeu-freshman-site",
      version: CONTENT_VERSION,
      exportedAt: new Date().toISOString(),
      content: { version: CONTENT_VERSION, sections: state.content.sections, qas: getQas() },
      imageStacks,
      pins
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hbeu-site-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importBackupFile(file) {
    if (!requireOwner("导入备份")) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(String(reader.result));
        if (!backup || !backup.content || !Array.isArray(backup.content.sections)) {
          alert("这个文件不是有效的网站备份 JSON。");
          return;
        }
        if (!confirm("导入备份会覆盖当前浏览器里的卡片、图片和点位。确定继续？")) return;
        const contentOk = safeSetItem(contentStorageKey, JSON.stringify({
          version: CONTENT_VERSION,
          sections: backup.content.sections,
          qas: Array.isArray(backup.content.qas) ? backup.content.qas : (Array.isArray(backup.qas) ? backup.qas : [])
        }), "备份内容");
        if (!contentOk) return;
        Object.entries(backup.imageStacks || {}).forEach(([slot, images]) => {
          if (Array.isArray(images)) saveImages(slot, images);
        });
        Object.entries(backup.pins || {}).forEach(([sectionId, pins]) => {
          if (Array.isArray(pins)) savePins(sectionId, pins);
        });
        state.content = loadContent();
        rerenderEditableArea();
        // 强制启用云端同步并立即推送
        state.cloud.enabled = true;
        scheduleCloudSave();
        alert("备份导入完成，已同步到云端。建议刷新页面检查一次。");
      } catch (error) {
        console.warn("Backup import failed.", error);
        alert("导入失败：JSON 文件格式不正确，或文件内容过大。");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function ensureImageManagerShell() {
    if ($("#imageManager")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <aside class="image-manager" id="imageManager" aria-hidden="true" aria-label="编辑卡片图片">
        <div class="image-manager-panel">
          <div class="lab-header">
            <div>
              <p class="eyebrow">Image Manager</p>
              <h2 id="imageManagerTitle">编辑图片</h2>
            </div>
            <button class="icon-button" type="button" data-close-image-manager aria-label="关闭图片编辑器">${icon("x")}</button>
          </div>
          <p class="lab-copy">这里可以单张删除图片、调整顺序、把某张设为封面，也可以继续追加图片。第一张图片就是卡片封面。</p>
          <div class="image-manager-tools">
            <button class="tool-button" type="button" data-manager-add-images>${icon("image-plus")}<span>继续加图</span></button>
            <button class="tool-button danger" type="button" data-manager-clear-images>${icon("eraser")}<span>清空本卡图片</span></button>
          </div>
          <div class="image-manager-list" id="imageManagerList"></div>
        </div>
      </aside>
    `);
  }

  function openImageManager(slot, title) {
    if (!requireOwner("编辑卡片图片")) return;
    ensureImageManagerShell();
    state.imageManager = { slot, title: title || slot };
    renderImageManager();
    const manager = $("#imageManager");
    manager.classList.add("is-open");
    manager.setAttribute("aria-hidden", "false");
    refreshIcons();
  }

  function closeImageManager() {
    const manager = $("#imageManager");
    if (!manager) return;
    manager.classList.remove("is-open");
    manager.setAttribute("aria-hidden", "true");
    state.imageManager = null;
  }

  function renderImageManager() {
    if (!state.imageManager) return;
    const { slot, title } = state.imageManager;
    const images = getImages(slot, "");
    const titleNode = $("#imageManagerTitle");
    const list = $("#imageManagerList");
    if (!list || !titleNode) return;
    titleNode.textContent = `编辑图片：${title}`;
    if (!images.length) {
      list.innerHTML = `
        <div class="image-manager-empty">
          <strong>这个卡片还没有图片。</strong>
          <span>点上面的"继续加图"，选择电脑里的图片即可。</span>
        </div>
      `;
      refreshIcons();
      return;
    }
    list.innerHTML = images.map((src, index) => `
      <div class="image-manager-item" data-manager-index="${index}">
        <div class="manager-thumb" style="background-image:url('${escapeHtml(src)}')"></div>
        <div class="manager-info">
          <strong>${index === 0 ? "封面图片" : `第 ${index + 1} 张`}</strong>
          <small>${index + 1}/${images.length}</small>
        </div>
        <div class="manager-actions">
          <button class="upload-mini ghost" type="button" data-manager-cover="${index}" ${index === 0 ? "disabled" : ""}>${icon("star")}<span>设封面</span></button>
          <button class="upload-mini ghost" type="button" data-manager-move="${index}" data-manager-step="-1" ${index === 0 ? "disabled" : ""}>${icon("arrow-up")}<span>前移</span></button>
          <button class="upload-mini ghost" type="button" data-manager-move="${index}" data-manager-step="1" ${index === images.length - 1 ? "disabled" : ""}>${icon("arrow-down")}<span>后移</span></button>
          <button class="upload-mini danger" type="button" data-manager-delete="${index}">${icon("trash-2")}<span>删除</span></button>
        </div>
      </div>
    `).join("");
    refreshIcons();
  }

  function saveManagedImages(images, activeIndex = 0) {
    if (!state.imageManager) return false;
    const slot = state.imageManager.slot;
    if (!saveImages(slot, images)) return false;
    state.activeImageIndex[slot] = Math.min(Math.max(activeIndex, 0), Math.max(images.length - 1, 0));
    rerenderEditableArea();
    ensureImageManagerShell();
    state.imageManager = state.imageManager || { slot, title: slot };
    renderImageManager();
    const manager = $("#imageManager");
    if (manager) {
      manager.classList.add("is-open");
      manager.setAttribute("aria-hidden", "false");
    }
    return true;
  }

  function addImagesFromManager() {
    if (!state.imageManager || !requireOwner("继续加图")) return;
    const slot = state.imageManager.slot;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.addEventListener("change", () => {
      const files = input.files ? Array.from(input.files) : [];
      if (files.length) {
        const title = state.imageManager ? state.imageManager.title : slot;
        readImageFiles(slot, files).then(() => {
        state.imageManager = { slot, title };
        ensureImageManagerShell();
        renderImageManager();
        const manager = $("#imageManager");
        if (manager) {
          manager.classList.add("is-open");
          manager.setAttribute("aria-hidden", "false");
        }
        });
      }
    });
    input.click();
  }

  function clearManagedImages() {
    if (!state.imageManager || !requireOwner("清空本卡图片")) return;
    const { slot, title } = state.imageManager;
    if (!confirm(`清空「${title}」的所有图片？\n\n只会清空这个卡片图片，不会删除卡片文字。`)) return;
    saveManagedImages([], 0);
  }

  function deleteManagedImage(index) {
    if (!state.imageManager || !requireOwner("删除单张图片")) return;
    const images = getImages(state.imageManager.slot, "");
    if (index < 0 || index >= images.length) return;
    if (!confirm(`删除第 ${index + 1} 张图片？`)) return;
    images.splice(index, 1);
    saveManagedImages(images, Math.min(index, images.length - 1));
  }

  function moveManagedImage(index, step) {
    if (!state.imageManager || !requireOwner("调整图片顺序")) return;
    const images = getImages(state.imageManager.slot, "");
    const nextIndex = index + step;
    if (index < 0 || index >= images.length || nextIndex < 0 || nextIndex >= images.length) return;
    const [item] = images.splice(index, 1);
    images.splice(nextIndex, 0, item);
    saveManagedImages(images, nextIndex);
  }

  function setManagedImageCover(index) {
    if (!state.imageManager || !requireOwner("设置封面图")) return;
    const images = getImages(state.imageManager.slot, "");
    if (index <= 0 || index >= images.length) return;
    const [item] = images.splice(index, 1);
    images.unshift(item);
    saveManagedImages(images, 0);
  }

  function ensureImageViewerShell() {
    if ($("#imageViewer")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <aside class="image-viewer" id="imageViewer" aria-hidden="true" aria-label="图片预览">
        <div class="image-viewer-toolbar">
          <strong id="imageViewerTitle">图片预览</strong>
          <span id="imageViewerCount"></span>
          <button class="icon-button" type="button" data-image-viewer-close aria-label="关闭图片预览">${icon("x")}</button>
        </div>
        <button class="image-viewer-nav prev" type="button" data-image-viewer-step="-1" aria-label="上一张图片">${icon("chevron-left")}</button>
        <img id="imageViewerImg" alt="展开后的图片">
        <button class="image-viewer-nav next" type="button" data-image-viewer-step="1" aria-label="下一张图片">${icon("chevron-right")}</button>
      </aside>
    `);
  }

  function getImagesFromDom(slot) {
    return $$(`[data-stack-frame="${cssEscape(slot)}"] .image-slide`).map((slide) => slide.dataset.fullSrc).filter(Boolean);
  }

  function openImageViewer(slot, title) {
    ensureImageViewerShell();
    const images = getImages(slot, "").length ? getImages(slot, "") : getImagesFromDom(slot);
    if (!images.length) return;
    const viewer = $("#imageViewer");
    const current = getActiveImageIndex(slot, images.length);
    viewer.dataset.viewerSlot = slot;
    viewer.dataset.viewerTitle = title || "图片预览";
    state.activeImageIndex[slot] = current;
    updateImageViewer();
    viewer.classList.add("is-open");
    viewer.setAttribute("aria-hidden", "false");
    refreshIcons();
  }

  function updateImageViewer() {
    const viewer = $("#imageViewer");
    if (!viewer || !viewer.dataset.viewerSlot) return;
    const slot = viewer.dataset.viewerSlot;
    const images = getImages(slot, "").length ? getImages(slot, "") : getImagesFromDom(slot);
    if (!images.length) return;
    const active = getActiveImageIndex(slot, images.length);
    $("#imageViewerImg").src = images[active];
    $("#imageViewerTitle").textContent = viewer.dataset.viewerTitle || "图片预览";
    $("#imageViewerCount").textContent = `${active + 1}/${images.length}`;
    $$("[data-image-viewer-step]").forEach((button) => {
      button.hidden = images.length <= 1;
    });
  }

  function closeImageViewer() {
    const viewer = $("#imageViewer");
    if (!viewer) return;
    viewer.classList.remove("is-open");
    viewer.setAttribute("aria-hidden", "true");
    const img = $("#imageViewerImg");
    if (img) img.removeAttribute("src");
  }

  function wireEvents() {
    routeTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-route]");
      if (button) renderRoute(button.dataset.route);
    });

    moduleNav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-jump]");
      if (!button) return;
      document.getElementById(button.dataset.jump).scrollIntoView({ behavior: "smooth", block: "start" });
    });

    moduleStage.addEventListener("click", (event) => {
      const filterButton = event.target.closest("[data-section-filter][data-element]");
      const pinChoice = event.target.closest("[data-map-element]");
      const clearMap = event.target.closest("[data-clear-map]");
      const addElementButton = event.target.closest("[data-add-element]");
      const editElementButton = event.target.closest("[data-edit-element]");
      const deleteElementButton = event.target.closest("[data-delete-element]");
      const addCardButton = event.target.closest("[data-add-card]");
      const editCardButton = event.target.closest("[data-edit-card]");
      const toggleHiddenButton = event.target.closest("[data-toggle-card-hidden]");
      const detailToggle = event.target.closest("[data-detail-toggle]");
      const deletePinButton = event.target.closest("[data-delete-pin]");
      const pinOpen = event.target.closest("[data-pin-open]");
      const imageButton = event.target.closest("[data-image-step][data-image-slot]");
      const manageImagesButton = event.target.closest("[data-manage-images]");
      const editSectionButton = event.target.closest("[data-edit-section]");
      const deleteSectionButton = event.target.closest("[data-delete-section]");

      if (imageButton) {
        cycleImage(imageButton.dataset.imageSlot, Number(imageButton.dataset.imageStep));
        return;
      }
      if (manageImagesButton) {
        openImageManager(manageImagesButton.dataset.manageImages, manageImagesButton.dataset.manageTitle || "卡片图片");
        return;
      }
      if (editSectionButton) {
        editSection(editSectionButton.dataset.editSection);
        return;
      }
      if (deleteSectionButton) {
        deleteSection(deleteSectionButton.dataset.deleteSection);
        return;
      }
      if (filterButton) {
        toggleElementCards(filterButton.dataset.sectionFilter, filterButton.dataset.element, { scroll: true });
        return;
      }
      if (pinChoice) {
        selectMapElement(pinChoice.dataset.mapSection, pinChoice.dataset.mapElement);
        return;
      }
      if (clearMap) clearSectionPins(clearMap.dataset.clearMap);
      if (addElementButton) addElement(addElementButton.dataset.addElement);
      if (editElementButton) editElement(editElementButton.dataset.elementSection, editElementButton.dataset.editElement);
      if (deleteElementButton) deleteElement(deleteElementButton.dataset.elementSection, deleteElementButton.dataset.deleteElement);
      if (addCardButton) createCard(addCardButton.dataset.addCard);
      if (editCardButton) openCardEditor(editCardButton.dataset.cardSection, editCardButton.dataset.editCard);
      if (toggleHiddenButton) toggleCardHidden(toggleHiddenButton.dataset.cardSection, toggleHiddenButton.dataset.toggleCardHidden);
      if (deletePinButton) {
        deletePin(deletePinButton.dataset.pinSection, deletePinButton.dataset.deletePin);
        return;
      }
      if (pinOpen) {
        toggleElementCards(pinOpen.dataset.pinSection, pinOpen.dataset.pinElement, { scroll: true });
        return;
      }
      if (detailToggle) {
        const card = detailToggle.closest(".place-card");
        const expanded = !card.classList.contains("is-expanded");
        card.classList.toggle("is-expanded", expanded);
        detailToggle.setAttribute("aria-expanded", String(expanded));
        $("span", detailToggle).textContent = expanded ? "收起要点" : "查看要点";
      }
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-open-map-key]")) openMapKeyEditor();
      if (event.target.closest("[data-add-section]")) addSection();
      if (event.target.closest("[data-add-qa]")) openQaEditor(null);
      if (event.target.closest("[data-close-editor]")) closeCardEditor();
      if (event.target.closest("[data-close-qa-editor]")) closeQaEditor();
      if (event.target.closest("[data-close-image-manager]")) closeImageManager();
      if (event.target.closest("[data-image-viewer-close]")) closeImageViewer();
      const editQa = event.target.closest("[data-edit-qa]");
      if (editQa) {
        openQaEditor(editQa.dataset.editQa);
        return;
      }
      const deleteQaButton = event.target.closest("[data-delete-qa]");
      if (deleteQaButton) {
        deleteQa(deleteQaButton.dataset.deleteQa);
        return;
      }
      const qaCard = event.target.closest("[data-qa-card]");
      if (qaCard && !event.target.closest("button, a, input, textarea, select")) {
        qaCard.classList.toggle("is-picked");
      }
      const viewerStep = event.target.closest("[data-image-viewer-step]");
      if (viewerStep) {
        const viewer = $("#imageViewer");
        const slot = viewer && viewer.dataset.viewerSlot;
        if (slot) {
          const images = getImages(slot, "").length ? getImages(slot, "") : getImagesFromDom(slot);
          const active = getActiveImageIndex(slot, images.length);
          state.activeImageIndex[slot] = (active + Number(viewerStep.dataset.imageViewerStep) + images.length) % images.length;
          updateImageStack(slot);
          updateImageViewer();
        }
      }
      const editor = $("#contentEditor");
      if (editor && event.target === editor) closeCardEditor();
      const qaEditor = $("#qaEditor");
      if (qaEditor && event.target === qaEditor) closeQaEditor();
      const manager = $("#imageManager");
      if (manager && event.target === manager) closeImageManager();
      if (event.target.closest("[data-manager-add-images]")) addImagesFromManager();
      if (event.target.closest("[data-manager-clear-images]")) clearManagedImages();
      const deleteManaged = event.target.closest("[data-manager-delete]");
      if (deleteManaged) deleteManagedImage(Number(deleteManaged.dataset.managerDelete));
      const moveManaged = event.target.closest("[data-manager-move]");
      if (moveManaged) moveManagedImage(Number(moveManaged.dataset.managerMove), Number(moveManaged.dataset.managerStep));
      const coverManaged = event.target.closest("[data-manager-cover]");
      if (coverManaged) setManagedImageCover(Number(coverManaged.dataset.managerCover));
      const viewer = $("#imageViewer");
      if (viewer && event.target === viewer) closeImageViewer();
    });

    document.addEventListener("submit", (event) => {
      if (event.target.matches("#contentEditorForm")) {
        event.preventDefault();
        saveCardFromEditor(event.target);
      }
      if (event.target.matches("#qaEditorForm")) {
        event.preventDefault();
        saveQaFromEditor(event.target);
      }
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-delete-card]")) deleteCurrentCard();
    });

    if (ownerButton) ownerButton.addEventListener("click", toggleOwnerMode);
    $("[data-open-image-lab]").addEventListener("click", openImageLab);
    $("#openImageLab").addEventListener("click", openImageLab);
    $("#closeImageLab").addEventListener("click", closeImageLab);
    imageLab.addEventListener("click", (event) => {
      if (event.target === imageLab) closeImageLab();
      const clearAll = event.target.closest("[data-clear-image-cache]");
      if (clearAll) {
        clearLocalImageCache();
        return;
      }
      const manageInLab = event.target.closest("[data-manage-images]");
      if (manageInLab) {
        openImageManager(manageInLab.dataset.manageImages, manageInLab.dataset.manageTitle || "图片槽");
        return;
      }
      const clearSlot = event.target.closest("[data-clear-slot-images]");
      if (clearSlot) {
        clearSlotImages(clearSlot.dataset.clearSlotImages, clearSlot.dataset.clearSlotTitle);
      }
    });

    const exportButton = $("#exportBackup");
    const importButton = $("#importBackup");
    const importInput = $("#importBackupInput");
    if (exportButton) exportButton.addEventListener("click", exportBackup);
    if (importButton && importInput) importButton.addEventListener("click", () => importInput.click());
    if (importInput) importInput.addEventListener("change", () => {
      const file = importInput.files && importInput.files[0];
      if (file) importBackupFile(file);
      importInput.value = "";
    });

    $("#toggleMotion").addEventListener("click", () => {
      state.motion = !state.motion;
      safeSetItem("hbeu-motion", state.motion ? "on" : "off", "动效设置");
      document.body.classList.toggle("reduce-motion", !state.motion);
    });

    backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

    window.addEventListener("scroll", () => {
      topbar.dataset.elevated = window.scrollY > 16 ? "true" : "false";
      backTop.classList.toggle("is-visible", window.scrollY > 680);
      updateActiveNav();
    }, { passive: true });

    document.addEventListener("keydown", (event) => {
      const pinOpen = event.target.closest && event.target.closest("[data-pin-open]");
      if (pinOpen && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        toggleElementCards(pinOpen.dataset.pinSection, pinOpen.dataset.pinElement, { scroll: true });
        return;
      }
      if (event.key === "Escape") {
        closeImageLab();
        closeCardEditor();
        closeImageManager();
        closeImageViewer();
      }
    });
  }

  function wireCards() {
    $$(".image-channel").forEach(wireImageChannel);

    $$(".place-card").forEach((card) => {
      card.addEventListener("mousemove", (event) => {
        if (!state.motion) return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        card.style.setProperty("--tilt-y", `${(x - .5) * 4}deg`);
        card.style.setProperty("--tilt-x", `${(.5 - y) * 4}deg`);
        card.style.setProperty("--spot-x", `${x * 100}%`);
        card.style.setProperty("--spot-y", `${y * 100}%`);
      });
      card.addEventListener("mouseleave", () => {
        card.style.setProperty("--tilt-y", "0deg");
        card.style.setProperty("--tilt-x", "0deg");
      });
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !entry.target.hidden && !entry.target.classList.contains('is-filtered-out')) {
          entry.target.classList.add("is-visible");
        }
      });
    }, { threshold: 0.12 });

    $$(".place-card").forEach((card) => observer.observe(card));
  }

  function openImageLab() {
    if (!requireOwner("打开图片通道")) return;
    imageLab.classList.add("is-open");
    imageLab.setAttribute("aria-hidden", "false");
  }

  function closeImageLab() {
    imageLab.classList.remove("is-open");
    imageLab.setAttribute("aria-hidden", "true");
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function rerenderEditableArea() {
    destroyMaps();
    buildNavigation();
    buildPanels();
    buildQaList();
    buildImageLab();
    syncImagesFromData();
    refreshOwnerUi();
    wireCards();
    wireLabUploads();
    initAmapMaps();
    applyFilters();
    updateActiveNav();
    refreshIcons();

    if (typeof window.renderMobileJournal === "function") window.renderMobileJournal();
  }

  function initCanvas() {
    const canvas = $("#campusCanvas");
    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let points = [];
    let pointer = { x: 0, y: 0, active: false };

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      points = Array.from({ length: Math.min(72, Math.floor(width / 18)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - .5) * .24,
        vy: (Math.random() - .5) * .24,
        r: Math.random() * 1.8 + .8
      }));
    }

    function tick() {
      ctx.clearRect(0, 0, width, height);
      if (!document.body.classList.contains("reduce-motion")) {
        points.forEach((point) => {
          point.x += point.vx;
          point.y += point.vy;
          if (point.x < 0 || point.x > width) point.vx *= -1;
          if (point.y < 0 || point.y > height) point.vy *= -1;
        });
      }

      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(21, 23, 24, .18)";
        ctx.fill();

        for (let j = i + 1; j < points.length; j += 1) {
          const b = points[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 126) {
            ctx.strokeStyle = `rgba(21, 23, 24, ${0.10 * (1 - dist / 126)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        if (pointer.active) {
          const dist = Math.hypot(a.x - pointer.x, a.y - pointer.y);
          if (dist < 180) {
            ctx.strokeStyle = `rgba(15, 159, 143, ${0.20 * (1 - dist / 180)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(tick);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", (event) => {
      pointer = { x: event.clientX, y: event.clientY, active: true };
    }, { passive: true });
    window.addEventListener("pointerleave", () => {
      pointer.active = false;
    });

    resize();
    tick();
  }

  async function init() {
    state.content = loadContent();
    await loadCloudState();
    cleanupDuplicateLegacyImageStorage();
    buildRoutes();
    buildNavigation();
    buildPanels();
    buildQaList();
    buildImageLab();
    ensureEditorShell();
    ensureQaEditorShell();
    syncImagesFromData();
    refreshOwnerUi();
    wireEvents();
    wireCards();
    wireLabUploads();
    initAmapMaps();
    applyFilters();
    updateActiveNav();
    refreshIcons();
    if (typeof window.renderMobileJournal === "function") window.renderMobileJournal();
    initCanvas();
  }

  window.addEventListener("DOMContentLoaded", init);

  /* Expose dynamic content snapshot for mobile journal */
  window.__journalGetSections = function() { return state.content.sections; };
  window.__journalGetQas = function() { return state.content.qas || []; };
  window.__journalGetRoutes = function() { return (window.HBEU_SITE_DATA && window.HBEU_SITE_DATA.routes) || []; };
})();
