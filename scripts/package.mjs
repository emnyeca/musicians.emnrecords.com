import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// A fresh directory prevents stale/secret files from entering a release.
const target = resolve('build', `release-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(target, { recursive: true });
await cp('out', `${target}/public`, { recursive: true });
await mkdir(`${target}/musicians-private`);
for (const name of ['bootstrap', 'profile', 'roles', 'icons', 'store', 'discord', 'member', 'http', 'config.example']) {
  await cp(`server/${name}.php`, `${target}/musicians-private/${name}.php`);
}
await cp('server/role-catalog.json', `${target}/musicians-private/role-catalog.json`);
await cp('sql/schema.sql', `${target}/schema.sql`);
await mkdir(`${target}/scripts`);
for (const name of ['preflight.php', 'register-discord-commands.php', 'discord-commands.json', 'import-office-drafts.php', 'merge-office-duplicates.php', 'strip-office-slug-prefix.php', 'publish-confirmed-drafts.php', 'install-member-web.php', 'post-member-panel.php', 'import-vanity-roles.php']) {
  await cp(`scripts/${name}`, `${target}/scripts/${name}`);
}
await cp('sql/002_member_web_access.sql', `${target}/scripts/002_member_web_access.sql`);
await writeFile(`${target}/INSTALL.md`, await readFile('docs/operator-setup.md'));
console.log(`Release prepared (not uploaded): ${target}`);
