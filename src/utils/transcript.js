const fs = require('fs');
const path = require('path');

const TRANSCRIPT_DIR = path.join(process.cwd(), 'transcripts');
if (!fs.existsSync(TRANSCRIPT_DIR)) fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });

async function gerarTranscript(channel) {
  let todas = [];
  let ultimo = null;

  // Buscar até 500 mensagens em lotes
  for (let i = 0; i < 5; i++) {
    const opcoes = { limit: 100 };
    if (ultimo) opcoes.before = ultimo;

    const lote = await channel.messages.fetch(opcoes);
    if (lote.size === 0) break;

    todas = todas.concat([...lote.values()]);
    ultimo = lote.last()?.id;
    if (lote.size < 100) break;
  }

  const sorted = todas.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  let conteudo = `╔══════════════════════════════════════════╗\n`;
  conteudo += `   TRANSCRIPT: ${channel.name}\n`;
  conteudo += `   Data: ${new Date().toLocaleString('pt-BR')}\n`;
  conteudo += `   Topic: ${channel.topic || 'N/A'}\n`;
  conteudo += `   Total de mensagens: ${sorted.filter(m => !m.author.bot).length}\n`;
  conteudo += `╚══════════════════════════════════════════╝\n\n`;

  for (const msg of sorted) {
    if (msg.author.bot) continue;
    const hora = new Date(msg.createdTimestamp).toLocaleString('pt-BR');
    conteudo += `[${hora}] ${msg.author.tag}\n`;
    if (msg.content) conteudo += `  ${msg.content}\n`;
    if (msg.attachments.size > 0) {
      msg.attachments.forEach(a => { conteudo += `  [Anexo: ${a.url}]\n`; });
    }
    conteudo += '\n';
  }

  const arquivo = path.join(TRANSCRIPT_DIR, `${channel.name}-${Date.now()}.txt`);
  fs.writeFileSync(arquivo, conteudo, 'utf-8');
  return arquivo;
}

module.exports = { gerarTranscript };