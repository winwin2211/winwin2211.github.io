# Portfolio — Trịnh Văn Thắng

A single static page, no build step, no dependencies. Open `index.html` in a
browser or serve the folder with any static server.

```
index.html      content and structure
styles.css      design tokens, layout, dark mode
main.js         theme toggle, timeline, figures, hero schematic (canvas)
assets/         favicon, social preview image and its source
```

## Edit content

Everything visible is in `index.html`. The sections, in order:

- Hero copy (name, role, location, buttons)
- "What I've run in production" — the five figures
- Experience timeline — one `<li class="job">` per company
- Stack — one `<div class="stack-row">` per group
- Contact

The hero diagram's nodes and links live at the top of `buildSchematic` in
`main.js` (`columns` and `links`). Change labels there.

## Preview locally

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages (free)

1. Create a new **public** repository on GitHub. Naming it
   `<your-username>.github.io` gives you the root URL
   `https://<your-username>.github.io/`; any other name gives
   `https://<your-username>.github.io/<repo>/`.
2. Push this folder:

   ```
   git remote add origin git@github.com:<your-username>/<repo>.git
   git push -u origin main
   ```

3. In the repository: **Settings → Pages → Build and deployment →
   Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.**
   The site is live in about a minute.
4. Replace `SITE_URL` in `index.html` (the `og:url`, `og:image` and
   `twitter:image` tags) with the real URL, commit and push again. Social
   networks read those tags to build the link preview.

### Custom domain (optional)

Add a `CNAME` file containing your domain, then point a `CNAME` DNS record
at `<your-username>.github.io`. GitHub issues the TLS certificate.

### Alternatives

Cloudflare Pages and Netlify both host static sites free and can deploy
straight from the same GitHub repository, or by drag-and-drop upload of the
folder. Nothing in the site depends on the host.

## Regenerate the social preview image

`assets/og.html` is the source. Render it at 1200×630 with a headless
browser, for example:

```
npx playwright screenshot --viewport-size=1200,630 assets/og.html assets/og.png
```
