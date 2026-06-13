# Image assets

**`PalmTree.jpg`** is drawn in both bottom corners (mirrored on the right). It
may be a plain JPEG on a white background — the scene knocks the white out to
transparency in-browser (`keyOutWhite` in `public/js/scene.js`), so no
transparent PNG is required. If the file is missing, a drawn clip-art palm is
used as a fallback.

To swap art: replace `PalmTree.jpg` (or point `PALM_SRC` in `scene.js` at a new
file). Tune on-screen height via `PALM_IMG_H`.
