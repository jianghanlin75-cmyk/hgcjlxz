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

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(String(dataUrl || ""));
  if (!match) return null;
  const contentType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { contentType, bytes };
}

function extensionFor(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function cleanPart(value) {
  return String(value || "image").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "image";
}

export async function onRequestPost({ request, env }) {
  if (!env.IMAGES) return json({ ok: false, error: "R2 binding IMAGES is missing." }, { status: 500 });
  const authError = requireAdmin(request, env);
  if (authError) return authError;
  const payload = await request.json();
  const parsed = parseDataUrl(payload.dataUrl);
  if (!parsed) return json({ ok: false, error: "Invalid image data." }, { status: 400 });
  if (!parsed.contentType.startsWith("image/")) return json({ ok: false, error: "Only images are allowed." }, { status: 400 });
  if (parsed.bytes.byteLength > 3 * 1024 * 1024) return json({ ok: false, error: "Image is too large after compression." }, { status: 413 });

  const slot = cleanPart(payload.slot);
  const ext = extensionFor(parsed.contentType);
  const key = `${slot}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  await env.IMAGES.put(key, parsed.bytes, {
    httpMetadata: {
      contentType: parsed.contentType,
      cacheControl: "public, max-age=31536000, immutable"
    }
  });
  return json({ ok: true, key, url: `/api/image?key=${encodeURIComponent(key)}` });
}
