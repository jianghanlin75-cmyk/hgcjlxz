export async function onRequestGet({ request, env }) {
  if (!env.IMAGES) return new Response("R2 binding IMAGES is missing.", { status: 500 });
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return new Response("Missing image key.", { status: 400 });
  const object = await env.IMAGES.get(key);
  if (!object) return new Response("Image not found.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", headers.get("cache-control") || "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
