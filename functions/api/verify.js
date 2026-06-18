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

export async function onRequestGet({ request, env }) {
  const expected = env.ADMIN_TOKEN;
  if (!expected) return json({ ok: false, error: "ADMIN_TOKEN is not configured." }, { status: 500 });
  const received = request.headers.get("x-admin-token") || "";
  if (received !== expected) return json({ ok: false, error: "Unauthorized." }, { status: 401 });
  return json({ ok: true });
}
