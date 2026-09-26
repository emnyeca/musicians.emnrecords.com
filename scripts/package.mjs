import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// A fresh directory prevents stale/secret files from entering a release.
const target = resolve('build', `release-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(target, { recursive: true });
await cp('out', `${target}/public`, { recursive: true });
await mkdir(`${target}/musicians-private`);
for (const name of ['bootstrap', 'profile', 'store', 'discord', 'http', 'config.example']) {
  await cp(`server/${name}.php`, `${target}/musicians-private/${name}.php`);
}
await cp('sql/schema.sql', `${target}/schema.sql`);
await mkdir(`${target}/scripts`);
for (const name of ['preflight.php', 'register-discord-commands.php', 'discord-commands.json', 'import-office-drafts.php', 'merge-office-duplicates.php', 'publish-confirmed-drafts.php']) {
  await cp(`scripts/${name}`, `${target}/scripts/${name}`);
}
await writeFile(`${target}/INSTALL.md`, await readFile('docs/operator-setup.md'));
console.log(`Release prepared (not uploaded): ${target}`);
