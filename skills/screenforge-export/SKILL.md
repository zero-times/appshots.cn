---
name: appshots-export
description: Render and export App Store/Google Play screenshots into a target directory from input images + copy JSON.
---

Use this skill when the user asks to generate final store screenshots directly into a local folder.

## Workflow

1. Ask for:
- input images (paths or directory)
- output directory
- target sizes
- target languages
- template id
- watermark preference

2. Build/normalize copy JSON to `GeneratedCopy` shape if needed.

3. Run:

```bash
pnpm skill:export -- \
  --images-dir <input_dir> \
  --copy <copy_json_path> \
  --template <template_id> \
  --sizes "6.7,android-phone" \
  --languages "zh,en,pt" \
  --out-dir <output_dir> \
  --app-name <app_name>
```

4. Return generated output paths and summary.

## Notes

- This skill focuses on rendering/export.
- If AI analysis/recommendation is needed, let the IDE model produce copy/template first, then call this command.
