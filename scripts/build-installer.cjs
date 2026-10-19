const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appDirectory = path.join(root, 'release', 'win-unpacked');
const output = path.join(root, 'release', `Cypher-${pkg.version}-Setup.exe`);
const source = path.join(root, 'installer', 'CypherSetup.cs');
const icon = path.join(root, 'build', 'icon.ico');
const manifest = path.join(root, 'installer', 'cypher-installer.manifest');
const terms = path.join(root, 'installer', 'TERMOS-DE-USO.txt');
const framework = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319');
const candidates = [path.join(framework, 'csc.exe'), path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')];
const compiler = candidates.find(file => fs.existsSync(file));

// Assinatura (CI com SignPath): o desinstalador é compilado antes e assinado junto com o app.
//   --uninstaller-only <arquivo>  só compila o desinstalador nesse caminho e termina.
//   --uninstaller <arquivo>       usa um desinstalador já pronto (assinado) em vez de compilar.
const argument = name => { const index = process.argv.indexOf(name); return index > 0 ? path.resolve(process.argv[index + 1] || '') : ''; };
const uninstallerOnly = argument('--uninstaller-only');
const prebuiltUninstaller = argument('--uninstaller');

function run(command, args, label) {
  process.stdout.write(`\n${label}\n`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} falhou com código ${result.status}.`);
}

if (process.platform !== 'win32') throw new Error('O instalador autoral do Cypher só pode ser gerado em Windows.');
if (!compiler) throw new Error('O compilador do .NET Framework (csc.exe) não foi encontrado.');
if (!fs.existsSync(manifest)) throw new Error('O manifesto de DPI do instalador não foi encontrado.');
if (!fs.existsSync(terms)) throw new Error('Os termos de uso do instalador não foram encontrados.');
if (!uninstallerOnly && !fs.existsSync(path.join(appDirectory, 'Cypher.exe'))) throw new Error('Compile o aplicativo antes de montar o instalador.');
if (prebuiltUninstaller && !fs.existsSync(prebuiltUninstaller)) throw new Error(`Desinstalador não encontrado: ${prebuiltUninstaller}`);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cypher-setup-'));
const payload = path.join(temporary, 'Cypher-Payload.zip');
const metadata = path.join(temporary, 'SetupMetadata.cs');
const versionedSource = path.join(temporary, 'CypherSetup.cs');
const payloadScript = path.join(temporary, 'package-payload.ps1');
const uninstaller = path.join(temporary, 'CypherUninstaller.exe');
const packagedUninstaller = path.join(appDirectory, 'CypherUninstaller.exe');

const assemblyVersion = pkg.version.split('-')[0].split('.').concat('0').slice(0, 4).join('.');
fs.writeFileSync(versionedSource, fs.readFileSync(source, 'utf8').replace('__CYPHER_VERSION__', pkg.version), 'utf8');
fs.writeFileSync(metadata, [
  'using System.Reflection;',
  '[assembly: AssemblyTitle("Cypher Setup")]',
  '[assembly: AssemblyProduct("Cypher")]',
  '[assembly: AssemblyCompany("Cypher")]',
  `[assembly: AssemblyVersion("${assemblyVersion}")]`,
  `[assembly: AssemblyFileVersion("${assemblyVersion}")]`,
].join('\n'), 'utf8');

(function build() { try {
  const sharedArgs = [
    '/nologo', '/target:winexe', '/platform:anycpu', '/optimize+', `/win32icon:${icon}`, `/win32manifest:${manifest}`,
    '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll',
  ];
  if (uninstallerOnly) {
    run(compiler, [...sharedArgs, '/define:UNINSTALLER', `/out:${uninstallerOnly}`, versionedSource, metadata], 'Compilando o desinstalador Cypher');
    process.stdout.write(`\nDesinstalador criado: ${path.relative(root, uninstallerOnly)}\n`);
    return;
  }
  if (prebuiltUninstaller) fs.copyFileSync(prebuiltUninstaller, uninstaller);
  else run(compiler, [...sharedArgs, '/define:UNINSTALLER', `/out:${uninstaller}`, versionedSource, metadata], 'Compilando o desinstalador Cypher');
  fs.rmSync(packagedUninstaller, { force: true });
  fs.copyFileSync(uninstaller, packagedUninstaller);

  fs.writeFileSync(payloadScript, [
    'param([string]$SourceDirectory, [string]$ArchivePath)',
    '$ErrorActionPreference = "Stop"',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    'if (Test-Path -LiteralPath $ArchivePath) { Remove-Item -LiteralPath $ArchivePath -Force }',
    '[System.IO.Compression.ZipFile]::CreateFromDirectory($SourceDirectory, $ArchivePath, [System.IO.Compression.CompressionLevel]::Optimal, $false)',
  ].join('\n'), 'utf8');
  run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', payloadScript, appDirectory, payload], 'Preparando os arquivos do navegador');

  run(compiler, [...sharedArgs,
    '/reference:System.IO.Compression.dll',
    '/reference:System.IO.Compression.FileSystem.dll',
    `/resource:${payload},CypherSetup.Payload.zip`,
    `/resource:${terms},CypherSetup.Terms.txt`,
    `/out:${output}`, versionedSource, metadata,
  ], 'Compilando o instalador autoral Cypher');

  const bytes = fs.statSync(output).size;
  process.stdout.write(`\nInstalador criado: ${path.relative(root, output)} (${(bytes / 1024 / 1024).toFixed(1)} MB)\n`);
} finally {
  if (!uninstallerOnly) fs.rmSync(packagedUninstaller, { force: true });
  fs.rmSync(temporary, { recursive: true, force: true });
} })();
