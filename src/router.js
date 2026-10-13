// Router minimalista: router.get('/api/tasks/:id', handler, { auth: 'admin' })

export class Router {
  #routes = [];

  add(method, path, handler, options = {}) {
    const keys = [];
    const pattern = path.replace(/:([a-zA-Z_]+)/g, (_, key) => { keys.push(key); return '([^/]+)'; });
    this.#routes.push({ method, regex: new RegExp(`^${pattern}/?$`), keys, handler, options });
    return this;
  }

  get(path, handler, options) { return this.add('GET', path, handler, options); }
  post(path, handler, options) { return this.add('POST', path, handler, options); }
  put(path, handler, options) { return this.add('PUT', path, handler, options); }
  delete(path, handler, options) { return this.add('DELETE', path, handler, options); }

  /** @returns {{route, params} | {methodNotAllowed: true} | null} */
  match(method, pathname) {
    let pathMatched = false;
    for (const route of this.#routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params = {};
      route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}
