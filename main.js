/* Trịnh Văn Thắng — portfolio
   Plain JS, no dependencies. Four small parts:
   1. theme toggle          2. timeline expand/collapse
   3. figures in view       4. the hero schematic (canvas)
*/
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------------------------------------------------------------
     1. Theme
     --------------------------------------------------------------- */
  const root = document.documentElement;
  const themeBtn = document.querySelector(".theme");
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  } catch (_) { /* storage unavailable */ }

  const currentTheme = () =>
    root.dataset.theme ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  themeBtn?.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (_) {}
    schematic?.refreshColors();
  });
  window.matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => schematic?.refreshColors());

  /* ---------------------------------------------------------------
     2. Timeline
     --------------------------------------------------------------- */
  document.querySelectorAll(".job-toggle").forEach((btn) => {
    const job = btn.closest(".job");
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      job.classList.toggle("open", !open);
      panel.setAttribute("aria-hidden", String(open));
    });
  });

  /* ---------------------------------------------------------------
     3. Figures: bars grow and numbers count when they scroll in
     --------------------------------------------------------------- */
  const figures = document.querySelectorAll(".figure");
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function countUp(el) {
    const target = Number(el.dataset.count);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    if (!Number.isFinite(target) || reduceMotion.matches) return;
    const dur = 900;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = prefix + Math.round(target * easeOut(p)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in-view");
        e.target.querySelectorAll("[data-count]").forEach(countUp);
        io.unobserve(e.target);
      }
    }, { threshold: 0.35 });
    figures.forEach((f) => io.observe(f));
  } else {
    figures.forEach((f) => f.classList.add("in-view"));
  }

  /* Reveal-on-scroll for headings, timeline entries and stack rows */
  const revealables = document.querySelectorAll(".section-head, .about-grid, .job, .stack-row");
  if ("IntersectionObserver" in window) {
    const ioR = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in-view");
        ioR.unobserve(e.target);
      }
    }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
    revealables.forEach((el) => ioR.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("in-view"));
  }

  /* Current section in the nav */
  const navLinks = [...document.querySelectorAll(".nav a")];
  if ("IntersectionObserver" in window && navLinks.length) {
    const byId = new Map(navLinks.map((a) => [a.getAttribute("href").slice(1), a]));
    const io2 = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const a = byId.get(e.target.id);
        if (!a) continue;
        if (e.isIntersecting) {
          navLinks.forEach((l) => l.removeAttribute("aria-current"));
          a.setAttribute("aria-current", "true");
        }
      }
    }, { rootMargin: "-40% 0px -55% 0px" });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io2.observe(s); });
  }

  /* ---------------------------------------------------------------
     4. Schematic: chain events → NATS → workers → storage → API → users
     --------------------------------------------------------------- */
  const canvas = document.getElementById("schematic");
  const schematic = canvas ? buildSchematic(canvas) : null;

  function buildSchematic(cv) {
    const ctx = cv.getContext("2d");
    let W = 0, H = 0, dpr = 1;
    let colors = readColors();
    let t0 = performance.now();
    let running = true;
    let raf = 0;
    const mouse = { x: -1e4, y: -1e4 };

    /* --- graph definition: columns of nodes, fractional positions --- */
    const columns = [
      { key: "src",   nodes: ["Ethereum", "Solana", "Base"] },
      { key: "bus",   nodes: ["NATS"] },
      { key: "work",  nodes: ["indexer", "enricher", "matcher"] },
      { key: "store", nodes: ["TiDB", "MongoDB", "ScyllaDB", "ClickHouse", "OpenSearch", "PostgreSQL"] },
      { key: "api",   nodes: ["API"] },
      { key: "users", nodes: ["50K users"] },
    ];
    const links = [
      // src → bus
      ["Ethereum", "NATS"], ["Solana", "NATS"], ["Base", "NATS"],
      // bus → workers
      ["NATS", "indexer"], ["NATS", "enricher"], ["NATS", "matcher"],
      // workers → storage
      ["indexer", "TiDB"], ["indexer", "MongoDB"], ["indexer", "ScyllaDB"],
      ["enricher", "ClickHouse"], ["enricher", "OpenSearch"],
      ["matcher", "ScyllaDB"],
      // storage → api
      ["TiDB", "API"], ["MongoDB", "API"], ["ScyllaDB", "API"], ["ClickHouse", "API"], ["OpenSearch", "API"],
      // api ↔ PostgreSQL: users, balances and money movements only
      ["API", "PostgreSQL"],
      // api → users
      ["API", "50K users"],
    ];

    const nodes = new Map();
    const edges = [];
    const packets = [];

    let vertical = false;

    function layout() {
      vertical = W < 900;
      // Wide: the flow runs left to right on the right half of the hero.
      // Narrow: the flow runs top to bottom across the full width.
      const area = vertical
        ? { x0: 24, x1: W - 24, y0: 18, y1: H - 34 }
        : { x0: W * 0.46, x1: W * 0.905, y0: H * 0.12, y1: H * 0.86 };

      nodes.clear();
      const colCount = columns.length;
      columns.forEach((col, ci) => {
        const along = ci / (colCount - 1);
        const n = col.nodes.length;
        col.nodes.forEach((label, ni) => {
          const f = n === 1 ? 0.5 : (ni + 0.5) / n;
          const big = col.key === "bus" || col.key === "api";
          const x = vertical ? area.x0 + (area.x1 - area.x0) * f
                             : area.x0 + (area.x1 - area.x0) * along;
          const y = vertical ? area.y0 + (area.y1 - area.y0) * along
                             : area.y0 + (area.y1 - area.y0) * f;
          nodes.set(label, {
            label, x, y, col: col.key,
            w: big ? (vertical ? 44 : 14) : 10,
            h: big ? (vertical ? 14 : 44) : 10,
            glow: 0,
          });
        });
      });

      edges.length = 0;
      links.forEach(([a, b], i) => {
        const A = nodes.get(a), B = nodes.get(b);
        edges.push({ a: A, b: B, i, len: Math.hypot(B.x - A.x, B.y - A.y) });
      });

      // packets: a few per edge, phase-offset so the flow looks continuous
      packets.length = 0;
      edges.forEach((e) => {
        const count = e.a.col === "src" || e.b.col === "users" ? 3 : 2;
        for (let k = 0; k < count; k++) {
          packets.push({
            e,
            p: (k / count + Math.random() * 0.3) % 1,
            speed: 0.10 + Math.random() * 0.08, // fraction of edge per second
            size: 1.6 + Math.random() * 1.2,
          });
        }
      });
    }

    function readColors() {
      const s = getComputedStyle(document.documentElement);
      const get = (n) => s.getPropertyValue(n).trim();
      return {
        ink: get("--ink"), inkSoft: get("--ink-soft"), rule: get("--rule"),
        paper: get("--paper"), signal: get("--signal"), hot: get("--hot"),
      };
    }

    function resize() {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      if (reduceMotion.matches) drawStatic();
    }

    /* cubic bezier between two nodes, horizontal tangents */
    function curve(a, b) {
      if (vertical) {
        const dy = (b.y - a.y) * 0.5;
        return { c1x: a.x, c1y: a.y + dy, c2x: b.x, c2y: b.y - dy };
      }
      const dx = (b.x - a.x) * 0.5;
      return { c1x: a.x + dx, c1y: a.y, c2x: b.x - dx, c2y: b.y };
    }
    function pointOn(e, t) {
      const { a, b } = e; const c = curve(a, b);
      const u = 1 - t;
      const x = u*u*u*a.x + 3*u*u*t*c.c1x + 3*u*t*t*c.c2x + t*t*t*b.x;
      const y = u*u*u*a.y + 3*u*u*t*c.c1y + 3*u*t*t*c.c2y + t*t*t*b.y;
      return { x, y };
    }

    function drawEdge(e, progress, alpha) {
      const { a, b } = e; const c = curve(a, b);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1;
      if (progress < 1) {
        // reveal along the path using dash offset
        const L = e.len * 1.2;
        ctx.setLineDash([L, L]);
        ctx.lineDashOffset = L * (1 - progress);
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.bezierCurveTo(c.c1x, c.c1y, c.c2x, c.c2y, b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }

    function drawNode(n, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      const big = n.col === "bus" || n.col === "api";
      // glow when the mouse is near
      if (n.glow > 0.01) {
        ctx.fillStyle = colors.hot;
        ctx.globalAlpha = alpha * 0.18 * n.glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 18 + 10 * n.glow, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
      }
      ctx.fillStyle = colors.paper;
      ctx.strokeStyle = n.glow > 0.5 ? colors.hot : colors.ink;
      ctx.lineWidth = 1.25;
      if (big) {
        ctx.beginPath();
        roundRect(ctx, n.x - n.w / 2, n.y - n.h / 2, n.w, n.h, 3);
        ctx.fill(); ctx.stroke();
        // ticks on the bus to suggest many subjects
        ctx.strokeStyle = colors.inkSoft;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          if (vertical) { ctx.moveTo(n.x + k * 10, n.y - 3); ctx.lineTo(n.x + k * 10, n.y + 3); }
          else { ctx.moveTo(n.x - 3, n.y + k * 10); ctx.lineTo(n.x + 3, n.y + k * 10); }
          ctx.stroke();
        }
      } else if (n.col === "users") {
        // a fan of small dots for users
        ctx.fillStyle = colors.ink;
        for (let k = 0; k < 7; k++) {
          const ang = (vertical ? 0 : -Math.PI / 2) + (k / 6) * Math.PI;
          const px = vertical ? n.x + Math.cos(ang) * 11 : n.x + Math.cos(ang) * 7;
          const py = vertical ? n.y + Math.sin(ang) * 7 : n.y + Math.sin(ang) * 11;
          ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill();
        }
      } else if (n.col === "store") {
        // a tiny cylinder
        ctx.beginPath();
        ctx.ellipse(n.x, n.y - 5, 6, 2.4, 0, 0, Math.PI * 2);
        ctx.moveTo(n.x - 6, n.y - 5); ctx.lineTo(n.x - 6, n.y + 5);
        ctx.moveTo(n.x + 6, n.y - 5); ctx.lineTo(n.x + 6, n.y + 5);
        ctx.ellipse(n.x, n.y + 5, 6, 2.4, 0, 0, Math.PI, false);
        ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5.5, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }

      // label
      ctx.fillStyle = n.glow > 0.5 ? colors.ink : colors.inkSoft;
      ctx.font = `500 11px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
      ctx.textBaseline = "middle";
      if (vertical) {
        ctx.font = `500 10px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
        if (n.col === "src") { ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y - 14); }
        else if (big) { ctx.textAlign = "left"; ctx.fillText(n.label, n.x + n.w / 2 + 8, n.y); }
        else if (n.col === "users") { ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y + 20); }
        else if (n.col === "store") {
          const idx = columns.find((c) => c.key === "store").nodes.indexOf(n.label);
          ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y + (idx % 2 ? 28 : 16));
        }
        else { ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y + 16); }
      } else if (n.col === "src") { ctx.textAlign = "right"; ctx.fillText(n.label, n.x - 12, n.y); }
      else if (n.col === "users") { ctx.textAlign = "left"; ctx.fillText(n.label, n.x + 16, n.y); }
      else if (big) { ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y - n.h / 2 - 10); }
      else { ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y + 16); }
      ctx.restore();
    }

    function roundRect(c, x, y, w, h, r) {
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function drawPacket(pk, alpha) {
      const pt = pointOn(pk.e, pk.p);
      ctx.save();
      ctx.globalAlpha = alpha;
      // short trail
      const back = pointOn(pk.e, Math.max(0, pk.p - 0.06));
      ctx.strokeStyle = colors.hot;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = alpha * 0.45;
      ctx.beginPath(); ctx.moveTo(back.x, back.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colors.hot;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pk.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function frame(now) {
      if (!running) return;
      const elapsed = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      // intro: edges draw column by column over ~1.8s, nodes fade with them
      const intro = Math.min(1, elapsed / 1.8);
      const colIndex = (n) => columns.findIndex((c) => c.key === n.col);

      // mouse glow
      nodes.forEach((n) => {
        const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
        const target = d < 60 ? 1 - d / 60 : 0;
        n.glow += (target - n.glow) * 0.15;
      });

      edges.forEach((e) => {
        const start = colIndex(e.a) / (columns.length - 1) * 0.75;
        const p = Math.max(0, Math.min(1, (intro - start) / 0.25));
        if (p <= 0) return;
        const hot = e.a.glow > 0.4 || e.b.glow > 0.4;
        drawEdge(e, p, hot ? 0.85 : 0.35);
      });

      nodes.forEach((n) => {
        const start = colIndex(n) / (columns.length - 1) * 0.75;
        const a = Math.max(0, Math.min(1, (intro - start) / 0.2));
        if (a > 0) drawNode(n, a);
      });

      if (intro >= 0.6) {
        const flowAlpha = Math.min(1, (intro - 0.6) / 0.4);
        const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
        packets.forEach((pk) => {
          const boost = (pk.e.a.glow > 0.4 || pk.e.b.glow > 0.4) ? 2.2 : 1;
          pk.p += pk.speed * boost * dt;
          if (pk.p > 1) pk.p -= 1;
          const start = colIndex(pk.e.a) / (columns.length - 1) * 0.75;
          if (intro - start < 0.25) return;
          drawPacket(pk, flowAlpha);
        });
      }
      lastFrame = now;
      raf = requestAnimationFrame(frame);
    }
    let lastFrame = 0;

    function drawStatic() {
      ctx.clearRect(0, 0, W, H);
      edges.forEach((e) => drawEdge(e, 1, 0.35));
      nodes.forEach((n) => drawNode(n, 1));
      packets.forEach((pk) => drawPacket(pk, 1));
    }

    /* --- events --- */
    const hero = cv.closest(".hero") || cv;
    hero.addEventListener("pointermove", (ev) => {
      const r = cv.getBoundingClientRect();
      mouse.x = ev.clientX - r.left; mouse.y = ev.clientY - r.top;
    });
    hero.addEventListener("pointerleave", () => { mouse.x = -1e4; mouse.y = -1e4; });

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 80);
    });

    // pause when the hero is off screen or the tab is hidden
    function start() {
      if (reduceMotion.matches) { drawStatic(); return; }
      if (running && raf) return;
      running = true; lastFrame = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : stop())),
        { threshold: 0.05 }).observe(cv);
    }
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    reduceMotion.addEventListener("change", () => { stop(); t0 = performance.now(); start(); });

    resize();
    start();

    return {
      refreshColors() { colors = readColors(); if (reduceMotion.matches) drawStatic(); },
    };
  }
})();
