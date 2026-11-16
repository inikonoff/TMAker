// Тонкий прокси для Groq API на Cloudflare Workers — на случай, если браузер блокирует CORS.
// Деплой: dash.cloudflare.com → Workers → Create → вставить этот файл → Deploy.
// Затем в TMA Builder: ИИ → настройки → Base URL = https://<имя>.<аккаунт>.workers.dev/openai/v1
//
// Ключ Groq по-прежнему передаёт браузер в заголовке Authorization; прокси его не хранит и не логирует.
// ALLOWED_ORIGIN — адрес вашего TMA Builder (например, https://you.github.io). "*" — разрешить всем.

const UPSTREAM = "https://api.groq.com";
const ALLOWED_ORIGIN = "*";

function cors(origin) {
  const allow = ALLOWED_ORIGIN === "*" ? "*" : origin === ALLOWED_ORIGIN ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") ?? "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/openai/v1/")) return new Response("Not found", { status: 404, headers: cors(origin) });
    const upstream = await fetch(UPSTREAM + url.pathname + url.search, {
      method: request.method,
      headers: {
        Authorization: request.headers.get("Authorization") ?? "",
        "Content-Type": request.headers.get("Content-Type") ?? "application/json",
      },
      body: request.method === "GET" ? undefined : request.body,
    });
    const headers = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors(origin))) headers.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
