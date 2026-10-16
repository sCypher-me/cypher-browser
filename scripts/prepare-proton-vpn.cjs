const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../vendor/proton-vpn-browser-extension');
const webpack = path.join(root, 'node_modules/webpack/bin/webpack.js');
const output = path.join(root, 'distribution-cypher/manifest.json');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmCli = process.env.npm_execpath;

function run(args) {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cypher-proton-npm-'));
  const configPath = path.join(configDir, 'npmrc');
  fs.writeFileSync(configPath, '# Cypher Proton build: ignore package scripts and use default registries.\n');
  const env = { ...process.env };
  delete env.npm_config_allow_scripts;
  delete env.NPM_CONFIG_ALLOW_SCRIPTS;
  try {
    const isolatedArgs = [...args, `--userconfig=${configPath}`, `--globalconfig=${configPath}`];
    const result = npmCli
      ? spawnSync(process.execPath, [npmCli, ...isolatedArgs], { cwd:root, stdio:'inherit', env })
      : spawnSync(npm, isolatedArgs, { cwd:root, stdio:'inherit', shell:process.platform === 'win32', env });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`npm ${args[0]} falhou com o código ${result.status ?? 'indisponível'}.`);
  } finally {
    fs.rmSync(configDir, { recursive:true, force:true });
  }
}

if (!fs.existsSync(webpack)) run(['ci', '--ignore-scripts']);
run(['run', 'build:cypher']);

const manifest = JSON.parse(fs.readFileSync(output, 'utf8'));
if (manifest.manifest_version !== 2 || manifest.key !== 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAi06udziL3L40ltaSvthhugMjNN64XPD7eTZAJs3rqn9IdOSrWSWHm5xO7czk9N3Zz2plUDZ1Y1jN29K8AMLYqSsPCeEfXSZqMYi8vjWfV4xut1RvhxOfuuEimKrX40S5QfISUbync6kJ40UM1nz/43jA2S8+cWEETjE+5vFkiIB5+o0rtjbMwiYYUZ2mxuKnAUWLU/yvNdeRqFXS94I+iIERR/ExVAt9GsVSRTU3bXFdfRNQforPxNtBfBu5FzQHjgRfWJZlKRd4m1FBs5m17/eXGCydewLa01gx0CvsxZlOwSuoOc8QTiePvBdk7xqrpvYozQt5iOQ0ijGeNNcTBQIDAQAB') throw new Error('Manifesto Proton inválido para o Cypher.');
console.log(`Extensão Proton ${manifest.version} preparada para o Cypher.`);
