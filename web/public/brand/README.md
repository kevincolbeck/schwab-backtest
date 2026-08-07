# Brand assets

Two versions of the mark, and the distinction matters:

| File | Background | Use it for |
|---|---|---|
| `chatbacktest-logo-400.png` | **transparent** | anywhere with a decent background of its own — decks, docs, embeds, partner sites |
| `chatbacktest-logo-1024.png` | **transparent** | the high-res master; downscale from this |
| `chatbacktest-twitter-pfp-400.png` | black disc, flattened | X/Twitter profile picture. Flattened deliberately: X crops to a circle and fills transparency unpredictably |

The black disc also lives in `web/src/app/icon.png` (browser tab favicon) and
`web/src/app/apple-icon.png` (iOS home screen — flattened onto black because
iOS composites transparent touch icons onto WHITE, which would leave a black
disc floating in a white square).

**Rule of thumb:** the disc version is for surfaces we don't control the
background of. Everywhere else, use the transparent mark.
