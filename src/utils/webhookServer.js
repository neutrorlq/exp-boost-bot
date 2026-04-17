const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

function startWebhookServer(client) {
  const app = express();
  app.use(express.json());
  const PORT = process.env.WEBHOOK_PORT || 3000;
  const SECRET = process.env.WEBHOOK_SECRET;

  function autenticar(req, res, next) {
    if (!SECRET) return next();
    const chave = req.headers['x-secret'] || req.headers['authorization']?.replace('Bearer ', '');
    if (chave !== SECRET) return res.status(401).json({ error: 'Não autorizado.' });
    next();
  }

  app.post('/webhook', autenticar, async (req, res) => {
    const { channelId, content, embed } = req.body;
    if (!channelId) return res.status(400).json({ error: 'channelId é obrigatório.' });
    if (!content && !embed) return res.status(400).json({ error: 'Forneça content ou embed.' });
    try {
      const canal = await client.channels.fetch(channelId);
      if (!canal?.isTextBased()) return res.status(404).json({ error: 'Canal não encontrado.' });
      const payload = {};
      if (content) payload.content = content;
      if (embed) {
        const { EmbedBuilder } = require('discord.js');
        const e = new EmbedBuilder();
        if (embed.title) e.setTitle(embed.title);
        if (embed.description) e.setDescription(embed.description);
        if (embed.color) e.setColor(parseInt(embed.color.replace('#', ''), 16));
        if (embed.image) e.setImage(embed.image);
        if (embed.footer) e.setFooter({ text: embed.footer });
        if (embed.fields?.length) e.addFields(embed.fields);
        if (embed.timestamp !== false) e.setTimestamp();
        payload.embeds = [e];
      }
      const mensagem = await canal.send(payload);
      res.json({ success: true, messageId: mensagem.id });
    } catch (error) {
      logger.error('Webhook error: ' + error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/status', (req, res) => {
    res.json({
      status: 'online',
      bot: client.user?.tag || 'carregando...',
      guilds: client.guilds?.cache.size || 0,
      uptime: Math.floor(process.uptime()) + 's',
    });
  });

  app.get('/data/database', (req, res) => {
    try {
      const dbPath = path.join(process.cwd(), 'database.json');
      if (!fs.existsSync(dbPath)) return res.json({});
      res.json(JSON.parse(fs.readFileSync(dbPath, 'utf-8')));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/data/logs', (req, res) => {
    try {
      const logsDir = path.join(process.cwd(), 'logs');
      const result = { logs: [], transcripts: [] };
      if (fs.existsSync(logsDir)) {
        const dates = [
          new Date().toISOString().split('T')[0],
          new Date(Date.now() - 86400000).toISOString().split('T')[0],
        ];
        for (const date of dates) {
          const file = path.join(logsDir, date + '.log');
          if (!fs.existsSync(file)) continue;
          const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
          for (const line of lines.slice(-200)) {
            const m = line.match(/\[(.+?)\] \[(\w+)\] (.+)/);
            if (m) result.logs.push({ time: m[1], level: m[2], message: m[3] });
          }
        }
      }
      const transcriptsDir = path.join(process.cwd(), 'transcripts');
      if (fs.existsSync(transcriptsDir)) {
        const files = fs.readdirSync(transcriptsDir)
          .filter(f => f.endsWith('.txt'))
          .map(f => ({
            name: f,
            ticket: (f.match(/^(ticket-\d+)/) || [])[1] || '—',
            modified: fs.statSync(path.join(transcriptsDir, f)).mtimeMs,
          }))
          .sort((a, b) => b.modified - a.modified)
          .slice(0, 50);
        result.transcripts = files;
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/data/transcript', (req, res) => {
    try {
      const file = path.basename(req.query.file || '');
      const filePath = path.join(process.cwd(), 'transcripts', file);
      if (!file || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado.' });
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/canais/:guildId', autenticar, async (req, res) => {
    try {
      const guild = await client.guilds.fetch(req.params.guildId);
      const canais = guild.channels.cache
        .filter(c => c.isTextBased())
        .map(c => ({ id: c.id, name: c.name, category: c.parent?.name || null }));
      res.json({ canais });
    } catch {
      res.status(404).json({ error: 'Servidor não encontrado.' });
    }
  });

  app.listen(PORT, () => {
    logger.info('Servidor webhook rodando em http://localhost:' + PORT);
    logger.info('  GET  /data/database   -> Dados do bot');
    logger.info('  GET  /data/logs       -> Logs e transcripts');
    logger.info('  GET  /data/transcript -> Ver transcript');
  });
}

module.exports = startWebhookServer;