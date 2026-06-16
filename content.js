const STATE_KEY = "default";

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
  const payload = await request.json();
  const state = {
    content: payload.content || null,
    imageStacks: payload.imageStacks || {}
  };
  await ensureSchema(env);
  await env.DB.prepare(`
    INSERT INTO site_state (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).bind(STATE_KEY, JSON.stringify(state)).run();
  return json({ ok: true });
}
