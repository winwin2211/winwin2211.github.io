/* Trịnh Văn Thắng — portfolio
   Plain JS, no dependencies:
   pointer spotlight and the Hanoi clock, then
   1. timeline expand/collapse   2. figures and sections in view
   3. the hero schematic (canvas)
   The page is dark only, so there is no theme code.
*/
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Pointer spotlight: two CSS vars, updated at most once per frame */
  if (window.matchMedia("(hover: hover)").matches && !reduceMotion.matches) {
    let px = 0, py = 0, queued = false;
    window.addEventListener("pointermove", (e) => {
      px = e.clientX; py = e.clientY;
      document.body.classList.add("has-pointer");
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        document.body.style.setProperty("--mx", px + "px");
        document.body.style.setProperty("--my", py + "px");
        queued = false;
      });
    }, { passive: true });
    window.addEventListener("pointerleave", () => document.body.classList.remove("has-pointer"));
  }

  /* Live Hanoi time in the status pill */
  const clock = document.getElementById("hanoi-time");
  if (clock) {
    const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
    const tick = () => { clock.textContent = "Hanoi " + fmt.format(new Date()); };
    tick(); setInterval(tick, 15000);
  }

  /* ---------------------------------------------------------------
     1. Timeline
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
     2. Figures: bars grow and numbers count when they scroll in
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
  const revealables = document.querySelectorAll(".section-head, .about-grid, .creds, .job, .stack-row");
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
     3. Schematic: chain events → NATS → workers → storage → API → users
     --------------------------------------------------------------- */
  const canvas = document.getElementById("schematic");
  if (canvas) buildSchematic(canvas);

  function buildSchematic(cv) {
    const ctx = cv.getContext("2d");
    let W = 0, H = 0, dpr = 1;
    let colors = readColors();
    let t0 = performance.now();
    let running = true;
    let raf = 0;
    const mouse = { x: -1e4, y: -1e4 };

    /* --- graph definition ---
       Every node carries a `kind`, and the kind picks the icon drawn for it,
       so a database looks like a database and a worker looks like a worker. */
    const columns = [
      { key: "src", nodes: [
        { label: "Ethereum", kind: "eth" },
        { label: "Solana",   kind: "sol" },
        { label: "Base",     kind: "base" },
      ] },
      { key: "bus", nodes: [{ label: "NATS", kind: "bus" }] },
      { key: "work", nodes: [
        { label: "indexer",  kind: "chip" },
        { label: "enricher", kind: "chip" },
        { label: "matcher",  kind: "chip" },
      ] },
      { key: "store", nodes: [
        { label: "TiDB",       kind: "db" },
        { label: "MongoDB",    kind: "db" },
        { label: "ScyllaDB",   kind: "db" },
        { label: "ClickHouse", kind: "columnar" },
        { label: "OpenSearch", kind: "search" },
        { label: "PostgreSQL", kind: "db" },
      ] },
      { key: "api",   nodes: [{ label: "API", kind: "api" }] },
      { key: "users", nodes: [{ label: "50K users", kind: "users" }] },
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
    let scale = 1;

    function layout() {
      vertical = W < 1200;
      scale = vertical ? 0.82 : 1;
      // Wide: the flow runs left to right on the right half of the hero.
      // Narrow: it runs top to bottom across the full width.
      // The threshold matches the hero's stacking breakpoint in styles.css.
      const area = vertical
        ? { x0: 28, x1: W - 28, y0: 30, y1: H - 42 }
        : { x0: W * 0.46, x1: W * 0.905, y0: H * 0.12, y1: H * 0.86 };

      nodes.clear();
      const colCount = columns.length;
      columns.forEach((col, ci) => {
        const along = ci / (colCount - 1);
        const count = col.nodes.length;
        col.nodes.forEach((def, ni) => {
          const f = count === 1 ? 0.5 : (ni + 0.5) / count;
          const x = vertical ? area.x0 + (area.x1 - area.x0) * f
                             : area.x0 + (area.x1 - area.x0) * along;
          const y = vertical ? area.y0 + (area.y1 - area.y0) * along
                             : area.y0 + (area.y1 - area.y0) * f;
          nodes.set(def.label, {
            label: def.label, kind: def.kind, col: col.key, row: ni,
            x, y, glow: 0, pulse: 0,
            hub: col.key === "bus" || col.key === "api",
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
            size: 1.9 + Math.random() * 1.1,
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

    /* --- glow, drawn as a cached sprite ---
       A radial gradient rebuilt every frame is expensive; the same gradient
       baked into a small canvas and stamped with drawImage is nearly free. */
    const sprites = new Map();
    function rgba(hex, a) {
      const h = hex.replace("#", "");
      const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
      const n = parseInt(full, 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }
    function glowSprite(color) {
      let s = sprites.get(color);
      if (s) return s;
      const size = 128;
      s = document.createElement("canvas");
      s.width = s.height = size;
      const g = s.getContext("2d");
      const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grd.addColorStop(0, rgba(color, 0.85));
      grd.addColorStop(0.42, rgba(color, 0.22));
      grd.addColorStop(1, rgba(color, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, size, size);
      sprites.set(color, s);
      return s;
    }
    function drawGlow(x, y, radius, color, alpha) {
      if (alpha <= 0.015) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
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

    /* cubic bezier between two nodes, tangents following the flow direction */
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
      ctx.lineCap = "round";
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

    /* --- icons ---
       Each one draws centred on the origin, using whatever fill and stroke
       the caller has set. `s` scales the whole glyph. */
    function roundRect(x, y, w, h, r) {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    const ICONS = {
      /* Ethereum: the stacked diamonds of the mark */
      eth(s) {
        const r = 11 * s;
        ctx.beginPath();
        ctx.moveTo(0, -r); ctx.lineTo(r * 0.62, r * 0.06);
        ctx.lineTo(0, r * 0.46); ctx.lineTo(-r * 0.62, r * 0.06);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.62, r * 0.28); ctx.lineTo(0, r); ctx.lineTo(r * 0.62, r * 0.28);
        ctx.stroke();
      },
      /* Solana: three offset bars */
      sol(s) {
        const w = 9 * s, d = 2.4 * s;
        ctx.lineWidth = 2.6 * s;
        for (let i = 0; i < 3; i++) {
          const y = (i - 1) * 5.2 * s;
          const o = i === 1 ? -d : d;
          ctx.beginPath();
          ctx.moveTo(-w + o, y); ctx.lineTo(w + o, y);
          ctx.stroke();
        }
      },
      /* Base: a circle with its left edge cut flat */
      base(s) {
        ctx.beginPath();
        ctx.arc(0, 0, 10 * s, -2.3, 2.3);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      },
      /* worker: a processor with pins */
      chip(s) {
        const a = 8.5 * s, pin = 3.4 * s;
        ctx.beginPath(); roundRect(-a, -a, a * 2, a * 2, 3 * s);
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); roundRect(-a * 0.4, -a * 0.4, a * 0.8, a * 0.8, 1.5 * s);
        ctx.stroke();
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          const o = i * a * 0.5;
          ctx.moveTo(o, -a); ctx.lineTo(o, -a - pin);
          ctx.moveTo(o, a);  ctx.lineTo(o, a + pin);
          ctx.moveTo(-a, o); ctx.lineTo(-a - pin, o);
          ctx.moveTo(a, o);  ctx.lineTo(a + pin, o);
        }
        ctx.stroke();
      },
      /* database: a cylinder */
      db(s) {
        const rx = 8.5 * s, ry = 3.1 * s, h = 11 * s;
        ctx.beginPath(); ctx.rect(-rx, -h / 2, rx * 2, h); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, h / 2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -h / 2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-rx, -h / 2); ctx.lineTo(-rx, h / 2);
        ctx.moveTo(rx, -h / 2);  ctx.lineTo(rx, h / 2);
        ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, h / 2, rx, ry, 0, 0, Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -h / 2, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.save(); ctx.globalAlpha *= 0.45;
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI); ctx.stroke();
        ctx.restore();
      },
      /* ClickHouse: columnar bars, one of them short */
      columnar(s) {
        const gap = 4.4 * s, h = 17 * s;
        ctx.lineWidth = 2.6 * s;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const x = (i - 1.5) * gap;
          ctx.moveTo(x, i === 3 ? -h * 0.16 : -h / 2);
          ctx.lineTo(x, h / 2);
        }
        ctx.stroke();
      },
      /* OpenSearch: a magnifier */
      search(s) {
        const r = 6.4 * s, cx = -1.6 * s;
        ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.lineWidth = 2.2 * s;
        ctx.moveTo(cx + r * 0.68, cx + r * 0.68); ctx.lineTo(7.6 * s, 7.6 * s);
        ctx.stroke();
      },
      /* NATS: a bus bar with subject slots */
      bus(s) {
        const w = 15 * s, h = 46 * s;
        ctx.beginPath(); roundRect(-w / 2, -h / 2, w, h, 4.5 * s);
        ctx.fill(); ctx.stroke();
        ctx.save(); ctx.globalAlpha *= 0.7;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(-w * 0.2, i * h * 0.2); ctx.lineTo(w * 0.2, i * h * 0.2);
        }
        ctx.stroke(); ctx.restore();
      },
      /* API: a gateway, with a chevron pointing the way out */
      api(s) {
        const w = 15 * s, h = 46 * s;
        ctx.beginPath(); roundRect(-w / 2, -h / 2, w, h, 4.5 * s);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-w * 0.15, -h * 0.09);
        ctx.lineTo(w * 0.17, 0);
        ctx.lineTo(-w * 0.15, h * 0.09);
        ctx.stroke();
      },
      /* users: a small crowd */
      users(s) {
        [[-7.5, -2.5], [0, 1], [7.5, -2.5]].forEach(([hx, hy]) => {
          ctx.beginPath();
          ctx.arc(hx * s, (hy - 3.5) * s, 2.5 * s, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          ctx.beginPath();
          ctx.arc(hx * s, (hy + 4.2) * s, 4.4 * s, Math.PI * 1.16, Math.PI * 1.84);
          ctx.stroke();
        });
      },
    };

    function drawNode(n, alpha) {
      const hot = n.glow > 0.45;
      const s = scale;

      // hubs sit in a permanent pool of light; hover and arrivals add to it
      const lift = Math.max(n.glow * 0.5, n.pulse * 0.6);
      drawGlow(n.x, n.y, (n.hub ? 48 : 30) * s,
               hot || n.pulse > 0.2 ? colors.hot : colors.signal,
               ((n.hub ? 0.2 : 0.05) + lift) * alpha);

      // a ring rides out from a node when a packet lands on it
      if (n.pulse > 0.04) {
        ctx.save();
        ctx.globalAlpha = alpha * n.pulse * 0.5;
        ctx.strokeStyle = colors.hot;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, (12 + (1 - n.pulse) * 18) * s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(n.x, n.y);
      if (n.hub && vertical) ctx.rotate(Math.PI / 2);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 1.4;
      ctx.fillStyle = colors.paper;
      ctx.strokeStyle = hot ? colors.hot : colors.ink;
      (ICONS[n.kind] || ICONS.chip)(s);
      ctx.restore();

      drawLabel(n, alpha, hot);
    }

    function drawLabel(n, alpha, hot) {
      const s = scale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = hot ? colors.ink : colors.inkSoft;
      ctx.font = `500 ${vertical ? 10 : 11}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
      ctx.textBaseline = "middle";
      if (vertical) {
        if (n.col === "src") { ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y - 21 * s); }
        else if (n.hub) { ctx.textAlign = "left"; ctx.fillText(n.label, n.x + 16 * s, n.y - 16 * s); }
        else if (n.col === "store") { ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y + (n.row % 2 ? 34 : 22) * s); }
        else { ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y + 23 * s); }
      } else if (n.col === "src") { ctx.textAlign = "right"; ctx.fillText(n.label, n.x - 19 * s, n.y); }
      else if (n.col === "users") { ctx.textAlign = "left"; ctx.fillText(n.label, n.x + 22 * s, n.y); }
      else if (n.hub) { ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y - 33 * s); }
      else { ctx.textAlign = "center"; ctx.fillText(n.label, n.x, n.y + 23 * s); }
      ctx.restore();
    }

    function drawPacket(pk, alpha) {
      const pt = pointOn(pk.e, pk.p);
      drawGlow(pt.x, pt.y, 10, colors.hot, alpha * 0.55);
      ctx.save();
      ctx.fillStyle = colors.hot;
      // a short tapering trail behind the head
      for (let i = 3; i >= 1; i--) {
        const t = pk.p - i * 0.022;
        if (t < 0) continue;
        const q = pointOn(pk.e, t);
        ctx.globalAlpha = alpha * (0.32 - i * 0.07);
        ctx.beginPath(); ctx.arc(q.x, q.y, pk.size * (1 - i * 0.18), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = alpha;
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
        n.pulse *= 0.94;
        if (n.pulse < 0.02) n.pulse = 0;
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
          if (pk.p > 1) { pk.p -= 1; pk.e.b.pulse = 1; }
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
      redraw() {
        colors = readColors();
        sprites.clear();
        if (reduceMotion.matches) drawStatic();
      },
    };
  }
})();
