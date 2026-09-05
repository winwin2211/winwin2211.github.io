# Portfolio — Trịnh Văn Thắng

A single static page, no build step, no dependencies. Open `index.html` in a
browser or serve the folder with any static server.

```
index.html      content and structure
styles.css      design tokens, layout, responsive rules
main.js         timeline, scroll reveals, hero schematic (canvas)
assets/         favicon, portrait, social preview image and its source
```

## Edit content

Everything visible is in `index.html`. The sections, in order:

- Hero copy (name, role, location, buttons)
- About — portrait (`assets/portrait.jpg`, cropped with CSS `object-position`) and three paragraphs
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

The git remote is already set to `git@github.com:winwin2211/winwin2211.github.io.git`
and the absolute URLs in `index.html` point at `https://winwin2211.github.io`.

1. Create a **public** repository named `winwin2211.github.io` at
   <https://github.com/new>. Leave "Add a README" and every other initialising
   option unchecked, so the repository starts empty.
2. Push:

   ```
   git push -u origin main
   ```

3. GitHub Pages turns itself on for a `<username>.github.io` repository. If the
   site is not live after a minute, open **Settings - Pages** and set
   **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**.
4. The site is served at <https://winwin2211.github.io/>.

`.nojekyll` is committed so GitHub serves the files as they are, without
running Jekyll over them.

### If you name the repository something else

A repository named, say, `portfolio` is served from
`https://winwin2211.github.io/portfolio/`. Every asset on the page uses a
relative path, so the page still works, but the four absolute URLs in the
`<head>` of `index.html` (`og:url`, `og:image`, `twitter:image` and the
schema.org `image`) have to be updated to the new address, otherwise link
previews on social networks break.

### Custom domain (optional)

Add a `CNAME` file containing your domain, then point a `CNAME` DNS record
at `winwin2211.github.io`. GitHub issues the TLS certificate.

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
