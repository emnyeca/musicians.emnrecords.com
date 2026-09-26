import { spawnSync, spawn } from 'node:child_process';
const args = process.argv.slice(2);
if (args[0] === 'tests/backend.php') {
  const setup = spawnSync('docker', ['compose', '--profile', 'test', 'up', '-d', '--wait', 'db-test'], { stdio: 'inherit' });
  if (setup.status !== 0) process.exit(setup.status ?? 1);
  const test = spawnSync('docker', ['compose', 'run', '--rm', '--no-deps', 'web', 'php', ...args], { stdio: 'inherit' });
  process.exit(test.status ?? 1);
}
const native = spawnSync(process.env.PHP_BIN || 'php', ['-v'], { stdio: 'ignore' });
const command = native.status === 0 ? (process.env.PHP_BIN || 'php') : 'docker';
const actualArgs = native.status === 0 ? args : ['compose', 'run', '--rm', '--no-deps', 'web', 'php', ...args];
if (command === 'docker' && args.includes('-S')) {
  console.error('Use docker compose up -d for the Docker preview at http://127.0.0.1:8080');
  process.exit(1);
}
const child = spawn(command, actualArgs, { stdio: 'inherit' });
child.on('error', () => { console.error('PHP 8.3+ or Docker is required. See docs/operator-setup.md.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
