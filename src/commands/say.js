const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, WebhookClient } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Envia mensagem como o bot ou via webhook (apenas admins)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s =>
      s.setName('mensagem').setDescription('Mensagem simples ou embed')
        .addStringOption(o => o.setName('texto').setDescription('Texto').setRequired(true))
        .addChannelOption(o => o.setName('canal').setDescription('Canal (padrão: atual)').setRequired(false))
        .addStringOption(o => o.setName('titulo').setDescription('Título do embed').setRequired(false))
        .addStringOption(o => o.setName('cor').setDescription('Cor hex (ex: #ff0000)').setRequired(false))
    )
    .addSubcommand(s =>
      s.setName('webhook').setDescription('Mensagem com nome e avatar customizados')
        .addStringOption(o => o.setName('texto').setDescription('Texto').setRequired(true))
        .addChannelOption(o => o.setName('canal').setDescription('Canal').setRequired(true))
        .addStringOption(o => o.setName('nome').setDescription('Nome do remetente').setRequired(false))
        .addStringOption(o => o.setName('avatar').setDescription('URL do avatar (https://...)').setRequired(false))
        .addStringOption(o => o.setName('titulo').setDescription('Título do embed').setRequired(false))
        .addStringOption(o => o.setName('cor').setDescription('Cor hex').setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'mensagem') {
      const texto = interaction.options.getString('texto');
      const canal = interaction.options.getChannel('canal') || interaction.channel;
      const titulo = interaction.options.getString('titulo');
      const cor = interaction.options.getString('cor');

      try {
        if (titulo) {
          const embed = new EmbedBuilder()
            .setColor(cor ? parseInt(cor.replace('#', ''), 16) : 0x5865f2)
            .setTitle(titulo).setDescription(texto).setTimestamp();
          await canal.send({ embeds: [embed] });
        } else {
          await canal.send(texto);
        }
        return interaction.reply({ content: `✅ Mensagem enviada em ${canal}!`, ephemeral: true });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'webhook') {
      const texto = interaction.options.getString('texto');
      const canal = interaction.options.getChannel('canal');
      const nome = interaction.options.getString('nome') || interaction.client.user.username;
      const avatarURL = interaction.options.getString('avatar') || interaction.client.user.displayAvatarURL();
      const titulo = interaction.options.getString('titulo');
      const cor = interaction.options.getString('cor');

      // Validar URL do avatar
      if (interaction.options.getString('avatar')) {
        const url = interaction.options.getString('avatar');
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return interaction.reply({ content: '❌ O avatar precisa ser uma URL válida começando com `https://`', ephemeral: true });
        }
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        // Reusar webhook existente para não acumular
        const webhooks = await canal.fetchWebhooks();
        let webhook = webhooks.find(w => w.owner?.id === interaction.client.user.id);
        if (!webhook) {
          webhook = await canal.createWebhook({
            name: 'Bot Webhook',
            avatar: interaction.client.user.displayAvatarURL(),
          });
        }

        const wClient = new WebhookClient({ id: webhook.id, token: webhook.token });
        const payload = { username: nome, avatarURL };

        if (titulo) {
          const embed = new EmbedBuilder()
            .setColor(cor ? parseInt(cor.replace('#', ''), 16) : 0x5865f2)
            .setTitle(titulo).setDescription(texto).setTimestamp();
          payload.embeds = [embed];
        } else {
          payload.content = texto;
        }

        await wClient.send(payload);
        return interaction.editReply({ content: `✅ Mensagem enviada via webhook em ${canal}!` });
      } catch (e) {
        return interaction.editReply({ content: `❌ Erro: ${e.message}` });
      }
    }
  },
};