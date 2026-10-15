/* Service worker — met l'outil en cache pour un fonctionnement hors ligne.
   Aucune donnée patient ne transite ici : seuls les fichiers de l'application
   (page, icônes, manifeste) sont mis en cache. Les séances restent dans le
   localStorage du navigateur et ne sont jamais lues par ce script. */
const VERSION = "suivi-diabete75-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function store(req, resp) {
  if (resp && resp.status === 200 && resp.type === "basic") {
    const copy = resp.clone();
    caches.open(VERSION).then(c => c.put(req, copy));
  }
  return resp;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  /* Page : réseau d'abord (toujours la dernière version publiée),
     avec repli sur la copie locale si pas de réseau ou réseau trop lent (3 s). */
  if (req.mode === "navigate") {
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fallback = () => caches.match(req).then(h => h || caches.match("./index.html"));
      const timer = setTimeout(() => { if (!done) { done = true; resolve(fallback()); } }, 3000);
      fetch(req.url, { cache: "no-cache" })
        .then(resp => { store(req, resp); if (!done) { done = true; clearTimeout(timer); resolve(resp); } })
        .catch(() => { if (!done) { done = true; clearTimeout(timer); resolve(fallback()); } });
    }));
    return;
  }

  /* Icônes, manifeste : copie locale d'abord, rafraîchie en arrière-plan. */
  e.respondWith(
    caches.match(req).then(hit => {
      const live = fetch(req.url, { cache: "no-cache" }).then(r => store(req, r)).catch(() => hit);
      return hit || live;
    })
  );
});
