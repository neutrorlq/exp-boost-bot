const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Envia mensagem como o bot (apenas admins)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('mensagem').setDescription('Mensagem simples ou embed no canal atual'))
    .addSubcommand(s =>
      s.setName('webhook').setDescription('Mensagem com nome e avatar customizados')
        .addChannelOption(o => o.setName('canal').setDescription('Canal de destino').addChannelTypes(ChannelType.GuildText).setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'mensagem') {
      const modal = new ModalBuilder().setCustomId('modal_say_mensagem').setTitle('💬 Enviar Mensagem');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('texto').setLabel('Mensagem').setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Digite a mensagem... (suporta emojis, markdown e emojis do servidor)').setRequired(true).setMaxLength(2000)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('titulo').setLabel('Título do embed (opcional)').setStyle(TextInputStyle.Short)
            .setPlaceholder('Deixe vazio para mensagem simples').setRequired(false).setMaxLength(200)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cor').setLabel('Cor hex (opcional)').setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: #ff0000').setRequired(false).setMaxLength(10)
        )
      );
      await interaction.showModal(modal);
    }

    if (sub === 'webhook') {
      const canal = interaction.options.getChannel('canal');
      const modal = new ModalBuilder().setCustomId(`modal_say_webhook_${canal.id}`).setTitle('🪝 Enviar via Webhook');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('texto').setLabel('Mensagem').setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Digite a mensagem... (suporta emojis, markdown e emojis do servidor)').setRequired(true).setMaxLength(2000)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('titulo').setLabel('Título do embed (opcional)').setStyle(TextInputStyle.Short)
            .setPlaceholder('Deixe vazio para mensagem simples').setRequired(false).setMaxLength(200)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cor').setLabel('Cor hex (opcional)').setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: #ff0000').setRequired(false).setMaxLength(10)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('nome').setLabel('Nome do remetente (opcional)').setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: Suporte EXP BOOST').setRequired(false).setMaxLength(80)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('avatar').setLabel('URL do avatar (opcional)').setStyle(TextInputStyle.Short)
            .setPlaceholder('https://...').setRequired(false).setMaxLength(500)
        )
      );
      await interaction.showModal(modal);
    }
  },
};
