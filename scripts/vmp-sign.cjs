// Gancho afterPack do electron-builder: assina o pacote para o Widevine (VMP da castLabs).
// Só roda nas compilações com Widevine (CYPHER_WIDEVINE=1, definido pela CI quando as
// credenciais EVS existem). Precisa acontecer antes de gerar o portátil e o instalador.
const { execFileSync } = require('node:child_process');

module.exports = async function vmpSign(context) {
  if (process.env.CYPHER_WIDEVINE !== '1') return;
  const python = process.env.PYTHON || 'python';
  console.log(`Assinando VMP em ${context.appOutDir}`);
  execFileSync(python, ['-m', 'castlabs_evs.vmp', 'sign-pkg', context.appOutDir], { stdio: 'inherit' });
  execFileSync(python, ['-m', 'castlabs_evs.vmp', 'verify-pkg', context.appOutDir], { stdio: 'inherit' });
};
