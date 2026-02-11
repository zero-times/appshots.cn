import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const samplePngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAhh7A5QAAAAASUVORK5CYII=';

function runSkillExport(imagesDir, copyPath, outDir) {
  const args = [
    'skill:export',
    '--',
    '--images-dir',
    imagesDir,
    '--copy',
    copyPath,
    '--template',
    'clean',
    '--sizes',
    '6.7',
    '--languages',
    'zh,en',
    '--out-dir',
    outDir,
    '--app-name',
    'SmokeApp',
    '--include-watermark',
    'true',
    '--watermark-text',
    'appshots',
  ];

  const result = spawnSync(pnpmCmd, args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    throw new Error(`skill export failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }

  return result.stdout;
}

function assertOutputs(outDir) {
  const expected = [
    path.join(outDir, '6.7inch', 'zh', 'SmokeApp_6.7_zh_1.png'),
    path.join(outDir, '6.7inch', 'en', 'SmokeApp_6.7_en_1.png'),
  ];

  for (const filePath of expected) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`expected output not found: ${filePath}`);
    }
    const size = fs.statSync(filePath).size;
    if (size <= 0) {
      throw new Error(`output is empty: ${filePath}`);
    }
  }

  return expected;
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appshots-skill-smoke-'));
  const inputDir = path.join(tempRoot, 'input');
  const outDir = path.join(tempRoot, 'output');
  const copyPath = path.join(tempRoot, 'copy.json');

  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(inputDir, '01.png'), Buffer.from(samplePngBase64, 'base64'));

  const copy = {
    headlines: [{ screenshotIndex: 0, zh: '极速生成商店截图', en: 'Generate Store Screenshots Fast' }],
    subtitles: [{ screenshotIndex: 0, zh: '一键导出多语言与多尺寸', en: 'One click for multi-language and multi-size export' }],
    tagline: { zh: 'appshots', en: 'appshots' },
  };
  fs.writeFileSync(copyPath, JSON.stringify(copy, null, 2));

  try {
    const stdout = runSkillExport(inputDir, copyPath, outDir);
    const outputs = assertOutputs(outDir);

    console.log('skill CLI smoke test passed');
    console.log(stdout.trim());
    console.log('outputs:');
    for (const filePath of outputs) {
      console.log(`- ${filePath}`);
    }

    fs.rmSync(tempRoot, { recursive: true, force: true });
  } catch (error) {
    console.error(`smoke test failed; temp files kept at: ${tempRoot}`);
    throw error;
  }
}

main();
