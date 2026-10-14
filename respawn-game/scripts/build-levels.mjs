/* Builds every web level and copies it into public/levels/<id>/, and copies the
 * colour videos into public/videos/. Run from respawn-game/:  npm run levels
 *
 *   --skip-build     only copy existing dist/ folders (faster when nothing changed)
 *   VIDEO_DIR=...    where V.mp4, I.mp4 ... R.mp4 live (only needed if public/videos is empty)
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shell = resolve(here, '..');
const repo = resolve(shell, '..');

const LEVELS = {
  violet: 'level3-violet-web',
  indigo: 'level4-indigo-web',
  blue: 'level2-blue',
  green: 'level5-green-web',
  yellow: 'level8-yellow-web',
  orange: 'level6-orange-web',
  red: 'level7-red-web',
};
const skipBuild = process.argv.includes('--skip-build');

for (const [id, folder] of Object.entries(LEVELS)) {
  const dir = join(repo, folder);
  if (!skipBuild) {
    if (!existsSync(join(dir, 'node_modules'))) {
      console.log(`[${id}] installing dependencies…`);
      execSync('npm install --no-audit --no-fund', { cwd: dir, stdio: 'inherit' });
    }
    console.log(`[${id}] building ${folder}…`);
    execSync('npm run build', { cwd: dir, stdio: 'inherit' });
  }
  const out = join(shell, 'public', 'levels', id);
  rmSync(out, { recursive: true, force: true });
  cpSync(join(dir, 'dist'), out, { recursive: true });
  console.log(`[${id}] → public/levels/${id}`);
}

const videos = join(shell, 'public', 'videos');
const need = ['V', 'I', 'B', 'G', 'Y', 'O', 'R'].filter((c) => !existsSync(join(videos, `${c}.mp4`)));
if (need.length) {
  const src = process.env.VIDEO_DIR ?? resolve(repo, '..', 'pravrutti 2.0', 'respawn infodeets');
  mkdirSync(videos, { recursive: true });
  for (const c of need) {
    const f = join(src, `${c}.mp4`);
    if (!existsSync(f)) { console.warn(`! missing ${f}`); continue; }
    cpSync(f, join(videos, `${c}.mp4`));
    console.log(`[video] ${c}.mp4 → public/videos`);
  }
}
console.log(`done: ${readdirSync(join(shell, 'public', 'levels')).length} levels ready`);
