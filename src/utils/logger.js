const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function getLogFile() {
  const hoje = new Date().toISOString().split('T')[0];
  return path.join(LOG_DIR, `${hoje}.log`);
}

function escrever(nivel, mensagem) {
  const agora = new Date().toLocaleString('pt-BR');
  const linha = `[${agora}] [${nivel}] ${mensagem}\n`;
  try { fs.appendFileSync(getLogFile(), linha); } catch {}
  if (nivel === 'ERROR') console.error(linha.trim());
  else console.log(linha.trim());
}

module.exports = {
  info:  msg => escrever('INFO',  msg),
  warn:  msg => escrever('WARN',  msg),
  error: msg => escrever('ERROR', msg),
};
