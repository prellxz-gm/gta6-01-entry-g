// Isla Verde — main.ts
// Build entrypoint (Node stdlib only): copies game/ + screenshots/ into the
// output dir and writes dossier.json via the kit's buildDossier helper.
// Usage: MAKEFUN_OUTPUT_DIR=out node main.ts
import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const out = resolve(process.env.MAKEFUN_OUTPUT_DIR || 'out');

async function main() {
  await mkdir(out, { recursive: true });
  // Fresh output: copy the game and its screenshots in.
  await cp(resolve('game'), join(out, 'game'), { recursive: true });
  await cp(resolve('screenshots'), join(out, 'screenshots'), { recursive: true });

  const dossierBytes = buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  await writeFile(join(out, 'dossier.json'), dossierBytes);
  // Determinism guard: the dossier must stay well under the 1.5 MiB cap,
  // and the build must be byte-identical when re-run (no timestamps inside).
  if (dossierBytes.length > 1572864) {
    throw new Error(`dossier.json too large: ${dossierBytes.length} bytes (cap 1572864)`);
  }

  // Small build report on stdout for the coordinator's log.
  const shots = (await readdir(join(out, 'screenshots'))).sort();
  let gameBytes = 0;
  let gameFiles = 0;
  async function walk(dir: string) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else { gameFiles++; gameBytes += (await stat(p)).size; }
    }
  }
  await walk(join(out, 'game'));
  const dossier = await stat(join(out, 'dossier.json'));
  console.log(JSON.stringify({
    out,
    screenshots: shots,
    game_files: gameFiles,
    game_bytes: gameBytes,
    dossier_bytes: dossier.size,
  }));
}

main().catch((err) => { console.error(err); process.exit(1); });
