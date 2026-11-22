---
name: add-painting
description: Add a new painting entry to public/paintings.json (Gouache or Acryl section). Use when the user asks to add a painting, artwork, or gallery entry. The image file must already be in public/images/.
---

# Add a painting to the gallery

Adds one work to `public/paintings.json`. The image file is already in `public/images/`; this skill does not copy images.

Paths are relative to the repo root.

## Input

Expect these from the user. Ask only for what is required and missing.

| Field        | Required | Notes |
|--------------|----------|-------|
| image file   | yes      | Filename in `public/images/`, e.g. `bruder_telefoniert.jpg`. The JSON value is `images/<filename>`. |
| title        | yes      | German. |
| section      | yes      | `Gouache` or `Acryl`. If not given, infer it from the medium. If that is unclear, ask. |
| medium       | yes      | Usually `Gouache auf Malkarton` or `Acryl auf Leinwand`. Use the section's usual wording if the user gives only the technique. |
| dimensions   | yes      | Format `30 × 40 cm`. Use the `×` character, not `x`. |
| year         | no       | See the year rule below. |
| note         | no       | German description, shown when the image is clicked. Omit the key if none is given. |

## Steps

1. **Check the image.** Confirm `public/images/<filename>` exists. If it does not, stop and tell the user. Do not add the entry.

2. **Year rule.** If no year is given, use the current year (run `date +%Y`). Tell the user that you assumed this year, e.g. "No year was given, so I used 2026 (the current year)."

3. **Fix typos.** Correct spelling, grammar, and obvious typos in the German text: `title`, `medium`, `note`. Keep the wording and tone, and do not restyle. Be careful with proper names and deliberate phrasing; change them only if clearly wrong. Record every change as "before → after" for the report. If nothing needed fixing, say so.

4. **Add the entry.** Append it as the last item in the matching section's `works` array, unless the user asks for a different position. Use the same key order and two-space indentation as the file. Fields in order: `image`, `title`, `year`, `medium`, `dimensions`, and `note` if present.

5. **Validate.** Run:
   `node -e "JSON.parse(require('fs').readFileSync('public/paintings.json','utf8'))"`
   If it fails, fix the JSON and run it again.

6. **Report** to the user, in English, with these items:
   - the entry that was added (section, title, year, medium, dimensions, note)
   - the year assumption, if one was made
   - each typo fix as "before → after", or "no typos found"
   - that nothing was committed

## Notes

- The first Gouache work (`works[0]`) is the large hero image on the home page. Do not move or remove it unless the user asks, and say so if they do.
- Do not commit or push unless the user asks.
- The "Über mich" photo is not in this list. It is set in `src/gallery.js` (`renderBio`).
