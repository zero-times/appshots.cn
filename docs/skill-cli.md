# appshots Skill CLI

Use this CLI as a skill backend in AI IDEs (Codex, Claude Code, etc.):
- IDE model handles image understanding and copy recommendation
- This CLI handles final screenshot rendering/export into a target directory

## Command

```bash
pnpm skill:export -- \
  --images-dir ./input-screenshots \
  --copy ./examples/skill-copy.example.json \
  --template clean \
  --sizes "6.7,android-phone" \
  --languages "zh,en,pt" \
  --out-dir ./exports \
  --app-name DemoApp \
  --include-watermark true \
  --watermark-text appshots
```

## Required input

- `--out-dir`
- one of:
  - `--images` (comma-separated image paths)
  - `--images-dir` (directory with png/jpg/jpeg/webp)

## Copy JSON

Preferred shape is `GeneratedCopy`:

```json
{
  "headlines": [{ "screenshotIndex": 0, "zh": "...", "en": "..." }],
  "subtitles": [{ "screenshotIndex": 0, "zh": "...", "en": "..." }],
  "tagline": { "zh": "...", "en": "..." }
}
```

The CLI also accepts `items[]` shape and will normalize it.

## Output structure

```
<out-dir>/
  <sizeId>inch/
    <lang>/
      <appName>_<sizeId>_<lang>_<index>.png
```

## Supported size ids

- iOS: `6.7`, `6.1`, `5.5`, `11.0`, `12.9`
- Google Play: `android-phone`, `android-7`, `android-10`

## Supported template ids

`clean`, `tech-dark`, `vibrant`, `aurora`, `sunset-glow`, `forest-mist`, `rose-gold`, `monochrome-bold`, `ocean-breeze`, `neon-pulse`, `lavender-dream`, `desert-sand`, `midnight-purple`, `candy-pop`
