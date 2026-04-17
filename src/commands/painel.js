const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Envia o painel de tickets (apenas admins)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_painel').setTitle('🎫 Configurar Painel de Tickets');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('descricao').setLabel('Descrição do painel (opcional)').setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Deixe vazio para usar o texto padrão').setRequired(false).setMaxLength(1000)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('imagem').setLabel('URL do banner (opcional)').setStyle(TextInputStyle.Short)
          .setPlaceholder('https://...').setRequired(false).setMaxLength(500)
      )
    );
    await interaction.showModal(modal);
  },
};
