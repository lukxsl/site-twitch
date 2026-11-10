// Gera version.json no build da Vercel (e localmente) para o rodapé do site.
// CommonJS de propósito: a raiz do projeto não tem package.json.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const raiz = path.resolve(__dirname, '..');
const env = process.env;

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return '';
  }
}

const sha = String(env.VERCEL_GIT_COMMIT_SHA || git('rev-parse HEAD') || '').trim();
const mensagemBruta = String(env.VERCEL_GIT_COMMIT_MESSAGE || git('log -1 --pretty=%s') || '').trim();
const branch = String(env.VERCEL_GIT_COMMIT_REF || git('rev-parse --abbrev-ref HEAD') || 'main').trim();

const versao = {
  deployedAt: new Date().toISOString(),
  commit: sha ? sha.slice(0, 7) : '',
  message: mensagemBruta.split('\n')[0].slice(0, 160),
  branch
};

const pastaPublica = path.join(raiz, 'public');
fs.mkdirSync(pastaPublica, { recursive: true });
fs.writeFileSync(path.join(pastaPublica, 'version.json'), JSON.stringify(versao, null, 2) + '\n', 'utf8');
console.log('[gen-version] public/version.json gerado:', versao.commit || '(sem commit)', '-', versao.branch);
