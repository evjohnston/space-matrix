/**
 * GitHub OAuth helper for the tracker's "Sign in with GitHub" button.
 *
 * GitHub's OAuth flow needs a client secret to exchange the login code for a
 * token, and a static site can't keep a secret, so this Worker does that one
 * step. It never stores tokens: it hands the token back to the site in the URL
 * fragment (which browsers don't send to servers) and forgets it.
 *
 * Environment (set in the Cloudflare dashboard or with `wrangler secret put`):
 *   GITHUB_CLIENT_ID      OAuth app client ID
 *   GITHUB_CLIENT_SECRET  OAuth app client secret  (secret)
 *   ALLOWED_ORIGINS       comma-separated site origins allowed to receive tokens,
 *                         e.g. "https://www.emersonjohnston.org,http://localhost:8000"
 *   SCOPE                 optional, default "public_repo" (use "repo" for a private repo)
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const okReturn = (u) => {
      try { return allowed.includes(new URL(u).origin); } catch { return false; }
    };

    if (url.pathname === "/login") {
      const ret = url.searchParams.get("return") || "";
      if (!okReturn(ret)) return new Response("Return URL not allowed", { status: 400 });
      const state = crypto.randomUUID();
      const gh = new URL("https://github.com/login/oauth/authorize");
      gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      gh.searchParams.set("redirect_uri", url.origin + "/callback");
      gh.searchParams.set("scope", env.SCOPE || "public_repo");
      gh.searchParams.set("state", state);
      gh.searchParams.set("allow_signup", "false");
      return new Response(null, {
        status: 302,
        headers: {
          Location: gh.toString(),
          // state + return URL ride in a short-lived, HttpOnly cookie to defeat CSRF
          "Set-Cookie": `oauth=${encodeURIComponent(JSON.stringify({ state, ret }))}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }

    if (url.pathname === "/callback") {
      const cookie = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)oauth=([^;]+)/);
      let saved = null;
      try { saved = cookie ? JSON.parse(decodeURIComponent(cookie[1])) : null; } catch { saved = null; }
      if (!saved || saved.state !== url.searchParams.get("state") || !okReturn(saved.ret)) {
        return new Response("Sign-in expired or invalid. Go back and try again.", { status: 400 });
      }
      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: url.searchParams.get("code"),
          redirect_uri: url.origin + "/callback",
        }),
      });
      const data = await res.json();
      if (!data.access_token) return new Response("GitHub did not return a token: " + (data.error_description || data.error || "unknown error"), { status: 400 });
      const back = new URL(saved.ret);
      back.hash = "gh_token=" + encodeURIComponent(data.access_token);
      return new Response(null, {
        status: 302,
        headers: { Location: back.toString(), "Set-Cookie": "oauth=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax", "Referrer-Policy": "no-referrer" },
      });
    }

    return new Response("Space tracker sign-in helper. Use /login.", { status: 404 });
  },
};
