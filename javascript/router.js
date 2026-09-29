class Router {
  #routes = new Map();
  #dynamicRoutes = [];
  #cache = new Map();
  #inflight = new Map();
  #container;
  #basePath;
  #defaultTitle;
  #current = null;

  NOT_FOUND_FILE = "partials/404.html";
  NOT_FOUND_TITLE = "Vexec – 404";

  constructor({ container, defaultTitle } = {}) {
    this.#container = container || document.querySelector(".container");
    this.#basePath = this.#detectBasePath();
    this.#defaultTitle = defaultTitle || document.title;

    window.addEventListener("popstate", () => this.#resolve());
    window.addEventListener("click", (e) => this.#onClick(e));
  }

  #detectBasePath() {
    const meta = document.querySelector('meta[name="vexec-base-path"]');
    if (meta && meta.content) {
      return meta.content.replace(/\/+$/, "");
    }
    return "";
  }

  #normalize(path) {
    if (!path.startsWith("/")) path = `/${path}`;
    path = path.replace(/\/+$/, "");
    return path || "/";
  }

  get(path, file, title) {
    const normalized = this.#normalize(path);
    if (normalized.includes(":")) {
      const { regex, keys } = this.#patternToRegex(normalized);
      this.#dynamicRoutes.push({
        pattern: normalized,
        regex,
        keys,
        file,
        title,
      });
    } else {
      this.#routes.set(normalized, { file, title });
    }
    return this;
  }

  #patternToRegex(pattern) {
    const keys = [];
    const regexStr = pattern
      .split("/")
      .map((seg) => {
        if (seg.startsWith(":")) {
          keys.push(seg.slice(1));
          return "([^/]+)";
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("/");
    return { regex: new RegExp("^" + regexStr + "$"), keys };
  }

  #matchRoute(path) {
    if (this.#routes.has(path)) {
      return { route: this.#routes.get(path), params: {} };
    }
    for (const d of this.#dynamicRoutes) {
      const m = path.match(d.regex);
      if (m) {
        const params = {};
        d.keys.forEach((k, i) => {
          params[k] = decodeURIComponent(m[i + 1]);
        });
        return { route: d, params };
      }
    }
    return null;
  }

  #currentPath() {
    let path = window.location.pathname || "/";
    path = path.replace(/\/+$/, "") || "/";
    if (this.#basePath && path.startsWith(this.#basePath)) {
      path = path.slice(this.#basePath.length);
    }
    path = path.replace(/\/+$/, "") || "/";
    if (!path.startsWith("/")) path = `/${path}`;
    return path;
  }

  async #fetchPartial(file) {
    if (this.#cache.has(file)) return this.#cache.get(file);
    if (this.#inflight.has(file)) return this.#inflight.get(file);

    const url = `${this.#basePath}/${file}`;
    const promise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
        return r.text();
      })
      .then((html) => {
        this.#cache.set(file, html);
        this.#inflight.delete(file);
        return html;
      })
      .catch((err) => {
        this.#inflight.delete(file);
        console.error(`[router] ${err.message}`);
        return `<section class="route-error">
          <div class="route-error-icon"><i data-lucide="cloud-off"></i></div>
          <h1>Oops</h1>
          <p>Couldn't load <code>${file}</code>.</p>
        </section>`;
      });

    this.#inflight.set(file, promise);
    return promise;
  }

  async navigate(path, push = true) {
    path = this.#normalize(path);

    if (this.#current === path) return;

    const match = this.#matchRoute(path);

    /* ---------- Always fire loading:start ---------- */
    document.dispatchEvent(new CustomEvent("loading:start"));

    let html;
    let title;
    let params = {};

    if (match) {
      const { route, params: p } = match;
      html = await this.#fetchPartial(route.file);
      title =
        typeof route.title === "function" ? route.title(p) : route.title;
      params = p;
    } else {
      /* ---------- 404 fallback ---------- */
      html = await this.#fetchPartial(this.NOT_FOUND_FILE);
      title = this.NOT_FOUND_TITLE;
    }

    /* ---------- Render ---------- */
    const wrapper = document.createElement("div");
    wrapper.innerHTML = (html || "").trim();

    // If the 404 partial is empty (file missing), fall back to inline markup
    if (!wrapper.firstElementChild && !match) {
      wrapper.innerHTML = `
        <section class="route-error">
          <div class="route-error-icon"><i data-lucide="compass"></i></div>
          <h1>404 – Not Found</h1>
          <p>The path <code>${path}</code> doesn't lead anywhere.</p>
        </section>
      `;
    }

    this.#container.replaceChildren(...wrapper.childNodes);
    window.scrollTo(0, 0);

    document.title = title || this.#defaultTitle;

    /* ---------- Nav active state ---------- */
    const activeTab =
      path === "/" || !match ? "home" : path.slice(1).split("/")[0];
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.tab === activeTab);
    });

    if (window.lucide) window.lucide.createIcons();

    /* ---------- History ---------- */
    if (push) {
      const url =
        path === "/" ? `${this.#basePath}/` : `${this.#basePath}${path}`;
      if (window.location.pathname !== url) {
        history.pushState({ path, params }, "", url);
      }
    }

    this.#current = path;

    /* ---------- Fill 404 path if present ---------- */
    if (!match) {
      const pathEl = document.getElementById("pv-404-path");
      if (pathEl) pathEl.textContent = path;
    }

    /* ---------- Dispatch events ---------- */
    document.dispatchEvent(new CustomEvent("loading:end"));
    document.dispatchEvent(
      new CustomEvent("route:change", {
        detail: { path, params, route: match ? match.route : null, notFound: !match },
      }),
    );
  }

  #onClick(e) {
    const nav = e.target.closest(".nav-item[data-tab]");
    if (nav) {
      e.preventDefault();
      const tab = nav.dataset.tab;
      this.navigate(tab === "home" ? "/" : `/${tab}`);
      return;
    }
    const link = e.target.closest("[data-route]");
    if (link) {
      e.preventDefault();
      this.navigate(link.dataset.route);
    }
  }

  async #resolve() {
    await this.navigate(this.#currentPath(), false);
  }

  start() {
    const self = this;
    document.addEventListener("vexec:navigate", (e) => {
      if (e.detail && e.detail.path) self.navigate(e.detail.path);
    });

    window.router = this;

    this.#resolve();
    return this;
  }
}