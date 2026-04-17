const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const { salvarCobranca } = require('../utils/database');
const logger = require('../utils/logger');

const PAYER_DOCUMENT = '43414637804';
const PAYER_NAME     = 'Caique';
const PIX_PROXY_URL  = 'https://xispe.site/pix.php';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pix')
    .setDescription('Envia botão de pagamento PIX no ticket (apenas moderadores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!interaction.channel.name.startsWith('ticket-')) {
      return interaction.reply({ content: '❌ Este comando só pode ser usado dentro de um canal de ticket.', ephemeral: true });
    }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('gerar_pix').setLabel('💳 Gerar PIX').setStyle(ButtonStyle.Success)
    );
    await interaction.channel.send({
      embeds: [new EmbedBuilder().setColor(0x2b2d31).setDescription('💳 Clique no botão abaixo para gerar uma cobrança PIX.')],
      components: [row],
    });
    await interaction.reply({ content: '✅ Botão enviado!', ephemeral: true });
  },
};

async function gerarPix({ valor, descricao, interaction }) {
  const transactionId = `discord-${interaction.channel.id}-${Date.now()}`;
  const response = await axios.post(PIX_PROXY_URL, {
    amount: valor,
    payerName: PAYER_NAME,
    payerDocument: PAYER_DOCUMENT,
    transactionId,
    description: descricao || `Pagamento - ${interaction.channel.name}`,
  }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });

  const dados = response.data.data || response.data;
  salvarCobranca({
    transactionId: dados.transactionId,
    valor,
    canal: interaction.channel.name,
    geradoPor: interaction.user.tag,
    status: dados.transactionState || dados.status || 'PENDENTE',
  });
  logger.info(`PIX gerado: R$${valor} por ${interaction.user.tag} em ${interaction.channel.name}`);
  return dados;
}

module.exports.gerarPix = gerarPix;