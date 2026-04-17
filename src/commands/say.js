const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, WebhookClient, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Envia mensagem como o bot ou via webhook (apenas admins)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s =>
      s.setName('mensagem').setDescription('Mensagem simples no canal atual')
    )
    .addSubcommand(s =>
      s.setName('webhook').setDescription('Abre formulário para enviar via webhook')
        .addChannelOption(o =>
          o.setName('canal')
            .setDescription('Canal de destino')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ─── MENSAGEM SIMPLES ──────────────────────────────────────────────────────
    if (sub === 'mensagem') {
      const modal = new ModalBuilder()
        .setCustomId('modal_say_mensagem')
        .setTitle('Enviar Mensagem');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('texto')
            .setLabel('Mensagem')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Digite a mensagem... (suporta emojis e markdown)')
            .setRequired(true)
            .setMaxLength(2000)
        )
      );

      await interaction.showModal(modal);
      return;
    }

    // ─── WEBHOOK ───────────────────────────────────────────────────────────────
    if (sub === 'webhook') {
      const canal = interaction.options.getChannel('canal');

      const modal = new ModalBuilder()
        .setCustomId(`modal_say_webhook_${canal.id}`)
        .setTitle('Enviar via Webhook');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('texto')
            .setLabel('Mensagem')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Digite a mensagem... (suporta emojis, markdown e emojis do Discord)')
            .setRequired(true)
            .setMaxLength(2000)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('nome')
            .setLabel('Nome do remetente (opcional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: Suporte EXP BOOST')
            .setRequired(false)
            .setMaxLength(80)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('avatar')
            .setLabel('URL do avatar (opcional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://...')
            .setRequired(false)
            .setMaxLength(500)
        )
      );

      await interaction.showModal(modal);
      return;
    }
  },
};
