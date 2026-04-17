const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { salvarAgendamento, removerAgendamento, listarAgendamentos } = require('../utils/database');
const logger = require('../utils/logger');

async function agendarDelecao(client, messageId, channelId, deletarEm) {
  const agora = Date.now();
  const restante = deletarEm - agora;
  const delay = restante > 0 ? restante : 0;

  setTimeout(async () => {
    try {
      const canal = await client.channels.fetch(channelId);
      const msg = await canal.messages.fetch(messageId);
      await msg.delete();
      logger.info(`Anúncio ${messageId} deletado automaticamente`);
    } catch {}
    removerAgendamento(messageId);
  }, delay);
}

async function reprocessarAgendamentos(client) {
  const lista = listarAgendamentos();
  if (lista.length === 0) return;

  logger.info(`Reprocessando ${lista.length} anúncio(s) agendado(s)...`);
  for (const item of lista) {
    await agendarDelecao(client, item.messageId, item.channelId, item.deletarEm);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anuncio')
    .setDescription('Envia uma mensagem que será apagada automaticamente (apenas admins)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('mensagem').setDescription('Texto do anúncio').setRequired(true))
    .addChannelOption(o => o.setName('canal').setDescription('Canal onde enviar').setRequired(true))
    .addIntegerOption(o => o.setName('tempo').setDescription('Tempo até apagar').setRequired(true).setMinValue(1))
    .addStringOption(o =>
      o.setName('unidade').setDescription('Unidade de tempo').setRequired(true)
        .addChoices(
          { name: 'Segundos', value: 'segundos' },
          { name: 'Minutos', value: 'minutos' },
          { name: 'Horas',   value: 'horas'    },
        )
    )
    .addStringOption(o => o.setName('titulo').setDescription('Título do embed (opcional)').setRequired(false))
    .addStringOption(o => o.setName('cor').setDescription('Cor hex (ex: #ff0000)').setRequired(false)),

  async execute(interaction) {
    const mensagem  = interaction.options.getString('mensagem');
    const canal     = interaction.options.getChannel('canal');
    const tempo     = interaction.options.getInteger('tempo');
    const unidade   = interaction.options.getString('unidade');
    const titulo    = interaction.options.getString('titulo');
    const cor       = interaction.options.getString('cor');

    const mult      = { segundos: 1000, minutos: 60000, horas: 3600000 };
    const tempoMs   = tempo * mult[unidade];
    const deletarEm = Date.now() + tempoMs;
    const tempoLabel = `${tempo} ${unidade}`;

    try {
      let msg;

      if (titulo) {
        const embed = new EmbedBuilder()
          .setColor(cor ? parseInt(cor.replace('#', ''), 16) : 0x2b2d31)
          .setTitle(titulo)
          .setDescription(mensagem)
          .setFooter({ text: `⏳ Será apagado em ${tempoLabel}` })
          .setTimestamp();
        msg = await canal.send({ embeds: [embed] });
      } else {
        msg = await canal.send(`${mensagem}\n\n*⏳ Esta mensagem será apagada em ${tempoLabel}*`);
      }

      // Salvar agendamento para sobreviver reinicializações
      salvarAgendamento({ messageId: msg.id, channelId: canal.id, deletarEm });
      await agendarDelecao(interaction.client, msg.id, canal.id, deletarEm);

      logger.info(`Anúncio agendado: deletar em ${tempoLabel} no canal #${canal.name}`);
      await interaction.reply({
        content: `✅ Anúncio enviado em ${canal}! Será apagado em **${tempoLabel}**.`,
        ephemeral: true,
      });

    } catch (error) {
      logger.error(`Erro no /anuncio: ${error.message}`);
      await interaction.reply({ content: `❌ Erro: ${error.message}`, ephemeral: true });
    }
  },

  reprocessarAgendamentos,
};