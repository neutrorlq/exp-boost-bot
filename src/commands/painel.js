const {
  SlashCommandBuilder, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ActionRowBuilder, PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Envia o painel de tickets (apenas admins)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('imagem').setDescription('URL do banner (opcional)').setRequired(false))
    .addStringOption(o => o.setName('descricao').setDescription('Descrição personalizada (opcional)').setRequired(false)),

  async execute(interaction) {
    const imagem = interaction.options.getString('imagem');
    const descricaoCustom = interaction.options.getString('descricao');

    const embed = new EmbedBuilder()
      .setColor(0x1a1a2e)
      .setTitle(`Seja muito bem-vindo(a) ao suporte da ${interaction.guild.name}`)
      .setDescription(
        descricaoCustom ||
        '> Estamos aqui para garantir que você tenha a melhor experiência possível.\n\n' +
        '> **Como funciona?** Selecione o motivo do contato abaixo para abrir um ticket privado com nossa equipe.\n\n' +
        '> Por favor, seja paciente após abrir o ticket. Nossa equipe responderá o mais breve possível.\n\n' +
        '> Descreva o mais detalhado possível o seu problema!'
      );

    if (imagem) embed.setImage(imagem);

    const menu = new StringSelectMenuBuilder()
      .setCustomId('selecionar_ticket')
      .setPlaceholder('Selecione o motivo do contato...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Suporte Técnico').setDescription('Problemas com o produto').setEmoji('🔧').setValue('suporte_tecnico'),
        new StringSelectMenuOptionBuilder().setLabel('Dúvidas Gerais').setDescription('Perguntas sobre o serviço').setEmoji('❓').setValue('duvidas_gerais'),
        new StringSelectMenuOptionBuilder().setLabel('Financeiro / Pagamento').setDescription('Problemas com pagamento').setEmoji('💳').setValue('financeiro'),
        new StringSelectMenuOptionBuilder().setLabel('Outros').setDescription('Outros assuntos').setEmoji('📩').setValue('outros'),
      );

    await interaction.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)],
    });

    await interaction.reply({ content: '✅ Painel enviado!', ephemeral: true });
  },
};