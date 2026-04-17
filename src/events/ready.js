const logger = require('../utils/logger');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    // Verificar variáveis obrigatórias
    const obrigatorias = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
    const faltando = obrigatorias.filter(v => !process.env[v]);
    if (faltando.length > 0) {
      logger.error(`Variáveis de ambiente faltando: ${faltando.join(', ')}`);
      process.exit(1);
    }

    logger.info(`Bot online como: ${client.user.tag}`);
    logger.info(`Servidores: ${client.guilds.cache.size}`);

    client.user.setActivity('Tickets | /painel', { type: 2 });

    // Reprocessar anúncios agendados
    try {
      const anuncio = require('../commands/anuncio');
      await anuncio.reprocessarAgendamentos(client);
    } catch (e) {
      logger.error(`Erro ao reprocessar agendamentos: ${e.message}`);
    }
  },
};