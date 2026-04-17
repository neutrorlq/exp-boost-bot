const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType } = require('discord.js');
const { salvarAgendamento, removerAgendamento, listarAgendamentos } = require('../utils/database');
const logger = require('../utils/logger');

async function agendarDelecao(client, messageId, channelId, deletarEm) {
  const restante = deletarEm - Date.now();
  setTimeout(async () => {
    try {
      const canal = await client.channels.fetch(channelId);
      const msg = await canal.messages.fetch(messageId);
      await msg.delete();
      logger.info(`Anúncio ${messageId} deletado`);
    } catch {}
    removerAgendamento(messageId);
  }, restante > 0 ? restante : 0);
}

async function reprocessarAgendamentos(client) {
  const lista = listarAgendamentos();
  if (!lista.length) return;
  for (const item of lista) await agendarDelecao(client, item.messageId, item.channelId, item.deletarEm);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anuncio')
    .setDescription('Envia um anúncio que será apagado automaticamente (apenas admins)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o => o.setName('canal').setDescription('Canal onde enviar').addChannelTypes(ChannelType.GuildText).setRequired(true)),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal');
    const modal = new ModalBuilder().setCustomId(`modal_anuncio_${canal.id}`).setTitle('📢 Criar Anúncio');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('mensagem').setLabel('Mensagem').setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Texto do anúncio... (suporta emojis e markdown)').setRequired(true).setMaxLength(2000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('titulo').setLabel('Título do embed (opcional)').setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 🔥 Novidade importante').setRequired(false).setMaxLength(200)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('cor').setLabel('Cor hex (opcional)').setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: #ff0000').setRequired(false).setMaxLength(10)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('tempo').setLabel('Tempo até apagar (ex: 30 minutos, 2 horas)').setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 30 minutos').setRequired(true).setMaxLength(50)
      )
    );
    await interaction.showModal(modal);
  },

  reprocessarAgendamentos,
};
