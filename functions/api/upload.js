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
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { contentType, base64: match[2], bytes };
  } catch (error) {
    return null;
  }
}

function extensionFor(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

function cleanPart(value) {
  return String(value || "image").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "image";
}

async function uploadToGithub(env, key, parsed) {
  const owner = env.GITHUB_REPOSITORY_OWNER || "jianghanlin75-cmyk";
  const repo = env.GITHUB_REPOSITORY_NAME || "hgcjlxz";
  const branch = env.GITHUB_BRANCH || "main";
  const path = `assets/images/${key}`;
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "accept": "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "hbeu-site-image-uploader",
      "x-github-api-version": "2022-11-28"
    },
    body: JSON.stringify({
      message: `chore: add uploaded image ${key}`,
      content: parsed.base64,
      branch
    })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `GitHub upload failed: ${response.status}`);
  }
  return {
    storage: "github",
    url: `/${path}`,
    pendingDeployment: true
  };
}

export async function onRequestPost({ request, env }) {
  const authError = requireAdmin(request, env);
  if (authError) return authError;
  const payload = await request.json().catch(() => null);
  if (!payload) return json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  const parsed = parseDataUrl(payload.dataUrl);
  if (!parsed) return json({ ok: false, error: "Invalid image data." }, { status: 400 });
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowedTypes.has(parsed.contentType)) return json({ ok: false, error: "Unsupported image type." }, { status: 400 });
  if (parsed.bytes.byteLength > 3 * 1024 * 1024) return json({ ok: false, error: "Image is too large after compression." }, { status: 413 });

  const slot = cleanPart(payload.slot);
  const ext = extensionFor(parsed.contentType);
  const key = `${slot}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  try {
    if (env.IMAGES) {
      await env.IMAGES.put(key, parsed.bytes, {
        httpMetadata: {
          contentType: parsed.contentType,
          cacheControl: "public, max-age=31536000, immutable"
        }
      });
      return json({ ok: true, storage: "r2", key, url: `/api/image?key=${encodeURIComponent(key)}` });
    }
    if (env.GITHUB_TOKEN) {
      const result = await uploadToGithub(env, key, parsed);
      return json({ ok: true, key, ...result });
    }
    return json({ ok: false, error: "No cloud image storage is configured." }, { status: 503 });
  } catch (error) {
    console.error("Image upload failed.", error);
    return json({ ok: false, error: "Cloud image upload failed." }, { status: 502 });
  }
}
