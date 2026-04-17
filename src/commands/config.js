const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getConfig, setConfig } = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurações do bot (apenas admins)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('ver').setDescription('Ver configurações atuais'))
    .addSubcommand(s =>
      s.setName('categoria').setDescription('Categoria onde tickets serão criados')
        .addChannelOption(o => o.setName('categoria').setDescription('Selecione a categoria')
          .addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    )
    .addSubcommand(s =>
      s.setName('suporte').setDescription('Cargo de suporte que gerencia tickets')
        .addRoleOption(o => o.setName('cargo').setDescription('Selecione o cargo').setRequired(true))
    )
    .addSubcommand(s =>
      s.setName('logs').setDescription('Canal onde logs de tickets são enviados')
        .addChannelOption(o => o.setName('canal').setDescription('Selecione o canal')
          .addChannelTypes(ChannelType.GuildText).setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const config = getConfig(guildId);

    if (sub === 'ver') {
      const categoria = config.TICKET_CATEGORY_ID
        ? (interaction.guild.channels.cache.get(config.TICKET_CATEGORY_ID)?.name || '❓ ID inválido')
        : '❌ Não configurada';
      const suporte = config.SUPPORT_ROLE_ID
        ? (interaction.guild.roles.cache.get(config.SUPPORT_ROLE_ID)?.name || '❓ ID inválido')
        : '❌ Não configurado';
      const logs = config.TICKET_LOG_CHANNEL_ID
        ? (interaction.guild.channels.cache.get(config.TICKET_LOG_CHANNEL_ID)?.name || '❓ ID inválido')
        : '❌ Não configurado';

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('⚙️ Configurações do Bot')
            .addFields(
              { name: '📁 Categoria dos Tickets', value: `\`${categoria}\``, inline: true },
              { name: '🛡️ Cargo de Suporte', value: `\`${suporte}\``, inline: true },
              { name: '📋 Canal de Logs', value: `\`${logs}\``, inline: true },
            )
            .setFooter({ text: 'Use /config <subcomando> para alterar' })
            .setTimestamp()
        ],
        ephemeral: true,
      });
    }

    if (sub === 'categoria') {
      const cat = interaction.options.getChannel('categoria');
      setConfig(guildId, 'TICKET_CATEGORY_ID', cat.id);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x00ff99).setDescription(`✅ Categoria definida: **${cat.name}**`)],
        ephemeral: true,
      });
    }

    if (sub === 'suporte') {
      const cargo = interaction.options.getRole('cargo');
      setConfig(guildId, 'SUPPORT_ROLE_ID', cargo.id);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x00ff99).setDescription(`✅ Cargo de suporte: **${cargo.name}**`)],
        ephemeral: true,
      });
    }

    if (sub === 'logs') {
      const canal = interaction.options.getChannel('canal');
      setConfig(guildId, 'TICKET_LOG_CHANNEL_ID', canal.id);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x00ff99).setDescription(`✅ Canal de logs: ${canal}`)],
        ephemeral: true,
      });
    }
  },
};