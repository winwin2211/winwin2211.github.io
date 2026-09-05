# Design notes

Subject: Trinh Van Thang, Backend & DevOps engineer. Distributed systems for
on-chain trading, real-time analytics, e-commerce. Audience: recruiters and
engineers arriving from a social-profile link. Job of the page: establish
credibility in ten seconds, let people read deeper, make contact easy.

## Direction: engineering schematic

The one memorable element is the hero: a live system diagram drawn on a
blueprint grid. Sources (chains) feed a message bus, workers fan out to
storage, an API serves users. Packets move along the edges at a pace that
reads as throughput. Everything else on the page is quiet.

## Tokens

Color (light)
- paper      #EDF1F4  cool blueprint paper
- ink        #12202E  deep navy ink for text and lines
- ink-soft   #55677A  secondary text
- rule       #C5CFD8  grid lines, hairlines
- signal     #1E4FE8  cobalt: links, primary emphasis
- hot        #E8891E  amber: live packets, the "hot path"

Color (dark)
- paper #0F1A26, ink #E6ECF2, ink-soft #9AAABB, rule #26374A,
  signal #6C8CFF, hot #F2A44A

Type
- Bricolage Grotesque, headlines and name (opinionated grotesk, tight).
- IBM Plex Sans, body. IBM Plex Mono only inside the diagram and the
  production-figures table, where it is the vernacular of the content.

Layout
- Left aligned, 72ch max prose. Asymmetric hero: text column left,
  diagram fills the right and bleeds behind the text on wide screens.
- Sections separated by whitespace and one hairline, no cards.
- Experience is a real sequence, so it gets a dated timeline.

Motion
- One orchestrated moment: the diagram draws itself on load, then
  packets flow. Expand/collapse on timeline entries answers a click.
- Everything else static. prefers-reduced-motion freezes the diagram.
