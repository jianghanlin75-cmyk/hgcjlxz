const STATE_KEY = "default";
const MAX_STATE_CHARS = 900000;
const MAX_IMAGES_PER_SLOT = 4;

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });
}

function requireAdmin(request, env) {
  const expected = env.ADMIN_TOKEN;
  if (!expected) return new Response("ADMIN_TOKEN is not configured.", { status: 500 });
  const received = request.headers.get("x-admin-token") || "";
  if (received !== expected) return new Response("Unauthorized.", { status: 401 });
  return null;
}

async function ensureSchema(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS site_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

function isDataImageSrc(src) {
  return /^data:image\//i.test(String(src || "").trim());
}

function isBlobImageSrc(src) {
  return /^blob:/i.test(String(src || "").trim());
}

function isCloudSafeImageSrc(src) {
  const value = String(src || "").trim();
  return Boolean(value) && !isDataImageSrc(value) && !isBlobImageSrc(value);
}

function cleanImageList(images) {
  const seen = new Set();
  const clean = [];
  (Array.isArray(images) ? images : []).forEach((src) => {
    const value = String(src || "").trim();
    if (!isCloudSafeImageSrc(value) || seen.has(value)) return;
    seen.add(value);
    clean.push(value);
  });
  return clean.slice(-MAX_IMAGES_PER_SLOT);
}

function sanitizeImageValue(value) {
  const source = Array.isArray(value) ? value : (value ? [value] : []);
  const clean = cleanImageList(source);
  return Array.isArray(value) ? clean : (clean[0] || "");
}

function sanitizeImageStacks(stacks) {
  const result = {};
  if (!stacks || typeof stacks !== "object") return result;
  Object.entries(stacks).forEach(([slot, images]) => {
    const clean = cleanImageList(images);
    if (clean.length) result[String(slot)] = clean;
  });
  return result;
}

function sanitizeContent(content) {
  if (!content || typeof content !== "object") return null;
  return {
    ...content,
    sections: Array.isArray(content.sections) ? content.sections.map((section) => ({
      ...section,
      items: Array.isArray(section.items) ? section.items.map((item) => ({
        ...item,
        image: sanitizeImageValue(item.image)
      })) : []
    })) : [],
    qas: Array.isArray(content.qas) ? content.qas : [],
    settings: content.settings && typeof content.settings === "object" ? content.settings : {},
    pins: content.pins && typeof content.pins === "object" ? content.pins : {}
  };
}

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ cloud: false, error: "D1 binding DB is missing." }, { status: 500 });
  await ensureSchema(env);
  const row = await env.DB.prepare("SELECT value, updated_at FROM site_state WHERE key = ?").bind(STATE_KEY).first();
  if (!row) return json({ cloud: true, content: null, imageStacks: {}, updatedAt: null });
  try {
    const state = JSON.parse(row.value);
    return json({ cloud: true, updatedAt: row.updated_at, ...state });
  } catch (error) {
    return json({ cloud: false, error: "Saved state is not valid JSON." }, { status: 500 });
  }
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ ok: false, error: "D1 binding DB is missing." }, { status: 500 });
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ ok: false, error: "Request JSON is invalid." }, { status: 400 });
  }

  const state = {
    content: sanitizeContent(payload.content),
    imageStacks: sanitizeImageStacks(payload.imageStacks)
  };
  const serialized = JSON.stringify(state);
  if (serialized.length > MAX_STATE_CHARS) {
    return json({
      ok: false,
      error: "Saved content is too large. Do not save base64/data:image pictures into D1; use assets/images static paths instead."
    }, { status: 413 });
  }

  await ensureSchema(env);
  await env.DB.prepare(`
    INSERT INTO site_state (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).bind(STATE_KEY, serialized).run();
  return json({ ok: true, strippedLocalImages: true });
}
