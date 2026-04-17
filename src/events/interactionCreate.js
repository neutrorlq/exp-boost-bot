const {
  Events, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType,
} = require('discord.js');
const { getConfig, proximoNumeroTicket } = require('../utils/database');
const { gerarTranscript } = require('../utils/transcript');
const logger = require('../utils/logger');

// Rate limit: userId -> timestamp do último ticket aberto
const cooldowns = new Map();
const COOLDOWN_MS = 60 * 1000;

const MOTIVOS = {
  suporte_tecnico: { label: '🔧 Suporte Técnico',       cor: 0x5865f2 },
  duvidas_gerais:  { label: '❓ Dúvidas Gerais',         cor: 0xfaa61a },
  financeiro:      { label: '💳 Financeiro / Pagamento', cor: 0x00c864 },
  outros:          { label: '📩 Outros',                 cor: 0x99aab5 },
};

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {

    // ─── SLASH COMMANDS ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (error) {
        logger.error(`Erro /${interaction.commandName}: ${error.message}`);
        const msg = { content: '❌ Ocorreu um erro ao executar este comando.', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else await interaction.reply(msg);
      }
      return;
    }

    // ─── SELECT MENU (Painel de Tickets) ─────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'selecionar_ticket') {
      const motivo = interaction.values[0];

      // Rate limit
      const ultimo = cooldowns.get(interaction.user.id);
      if (ultimo && Date.now() - ultimo < COOLDOWN_MS) {
        const restante = Math.ceil((COOLDOWN_MS - (Date.now() - ultimo)) / 1000);
        return interaction.reply({
          content: `⏳ Aguarde **${restante}s** antes de abrir outro ticket.`,
          ephemeral: true,
        });
      }

      // Verificar ticket já aberto (por ID no topic)
      const ticketExistente = interaction.guild.channels.cache.find(
        ch => ch.topic?.includes(`uid:${interaction.user.id}`) && ch.name.startsWith('ticket-')
      );
      if (ticketExistente) {
        return interaction.reply({
          content: `❌ Você já tem um ticket aberto: ${ticketExistente}\nFeche-o antes de abrir outro.`,
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_ticket_${motivo}`)
        .setTitle('Abrir Ticket');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('descricao')
            .setLabel('Descreva seu problema ou dúvida')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Seja o mais detalhado possível...')
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(500)
        )
      );
      await interaction.showModal(modal);
      return;
    }

    // ─── BOTÕES ───────────────────────────────────────────────────────────────
    if (interaction.isButton()) {

      // ── Gerar PIX ──────────────────────────────────────────────────────────
      if (interaction.customId === 'gerar_pix') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: '❌ Apenas administradores podem gerar cobranças PIX.', ephemeral: true });
        }

        const modal = new ModalBuilder().setCustomId('modal_pix').setTitle('💳 Gerar Cobrança PIX');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('valor')
              .setLabel('Valor em reais (ex: 25.90)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('25.90')
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('descricao')
              .setLabel('Descrição (opcional)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('Serviço X')
              .setRequired(false)
          )
        );
        await interaction.showModal(modal);
        return;
      }

      // ── Confirmar Pagamento ────────────────────────────────────────────────
      if (interaction.customId === 'confirmar_pagamento') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({ content: '❌ Apenas moderadores podem confirmar pagamentos.', ephemeral: true });
        }

        // Desabilitar botão após confirmação
        const rowDesabilitada = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirmar_pagamento')
            .setLabel('✅ Pagamento Confirmado')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
        );
        await interaction.update({ components: [rowDesabilitada] });

        await interaction.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x00c864)
              .setTitle('✅ Pagamento Confirmado')
              .setDescription(`Pagamento confirmado por ${interaction.user}.\nObrigado!`)
              .setTimestamp()
          ]
        });
        return;
      }

      // ── Assumir Ticket ─────────────────────────────────────────────────────
      if (interaction.customId === 'assumir_ticket') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({ content: '❌ Apenas moderadores podem assumir tickets.', ephemeral: true });
        }

        // Desabilitar botão de assumir
        const msgOriginal = interaction.message;
        const rowAtualizada = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('assumir_ticket').setLabel(`🙋 Assumido por ${interaction.user.username}`).setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('gerar_pix').setLabel('💳 Gerar PIX').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('fechar_ticket').setLabel('🔒 Fechar').setStyle(ButtonStyle.Danger),
        );
        await msgOriginal.edit({ components: [rowAtualizada] }).catch(() => {});

        await interaction.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setDescription(`🙋 **${interaction.user}** assumiu este ticket e irá te atender em breve!`)
          ]
        });

        // Renomear canal somente se ainda não foi assumido
        if (!interaction.channel.name.includes('-assumido')) {
          await interaction.channel.setName(`${interaction.channel.name}-assumido`).catch(() => {});
        }

        await interaction.reply({ content: '✅ Você assumiu este ticket!', ephemeral: true });
        return;
      }

      // ── Fechar Ticket ──────────────────────────────────────────────────────
      if (interaction.customId === 'fechar_ticket') {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff9900)
              .setDescription('⚠️ Tem certeza que deseja fechar este ticket?\nO histórico será salvo automaticamente.')
          ],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('confirmar_fechar').setLabel('✅ Fechar Ticket').setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId('cancelar_fechar').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary)
            )
          ],
          ephemeral: true,
        });
        return;
      }

      // ── Confirmar Fechar ───────────────────────────────────────────────────
      if (interaction.customId === 'confirmar_fechar') {
        const channel = interaction.channel;
        const config = getConfig(interaction.guild.id);

        // Avisar no canal antes de fechar
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff4444)
              .setDescription(`🔒 Ticket fechado por ${interaction.user}.\n📄 Gerando transcript... Canal será deletado em **5 segundos**.`)
          ]
        });

        await interaction.reply({ content: '✅ Fechando ticket...', ephemeral: true });

        // Gerar e enviar transcript nos logs
        try {
          const arquivoTranscript = await gerarTranscript(channel);
          const anexo = new AttachmentBuilder(arquivoTranscript, { name: `${channel.name}.txt` });

          const logChannelId = config.TICKET_LOG_CHANNEL_ID;
          if (logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
              await logChannel.send({
                embeds: [
                  new EmbedBuilder()
                    .setColor(0xff4444)
                    .setTitle('🔒 Ticket Fechado')
                    .addFields(
                      { name: '📁 Canal', value: channel.name, inline: true },
                      { name: '👤 Fechado por', value: interaction.user.tag, inline: true },
                      { name: '📅 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                      { name: '📋 Informações', value: channel.topic || 'N/A' }
                    )
                    .setFooter({ text: 'Transcript em anexo' })
                    .setTimestamp()
                ],
                files: [anexo],
              });
            }
          }
          logger.info(`Ticket ${channel.name} fechado por ${interaction.user.tag} — transcript gerado`);
        } catch (e) {
          logger.error(`Erro ao gerar transcript de ${channel.name}: ${e.message}`);
        }

        setTimeout(() => channel.delete().catch(() => {}), 5000);
        return;
      }

      // ── Cancelar Fechar ────────────────────────────────────────────────────
      if (interaction.customId === 'cancelar_fechar') {
        await interaction.reply({ content: '✅ Operação cancelada.', ephemeral: true });
        return;
      }
    }

    // ─── MODAIS ───────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {

      // ── PIX ────────────────────────────────────────────────────────────────
      if (interaction.customId === 'modal_pix') {
        const valorStr = interaction.fields.getTextInputValue('valor').replace(',', '.');
        const descricao = interaction.fields.getTextInputValue('descricao');
        const valor = parseFloat(valorStr);

        if (isNaN(valor) || valor <= 0) {
          return interaction.reply({ content: '❌ Valor inválido! Use números como **25.90**', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const { gerarPix } = require('../commands/pix');
          const dados = await gerarPix({ valor, descricao, interaction });

          const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('💳 Pagamento via PIX')
            .setDescription(`**R$ ${valor.toFixed(2)}**\n\`\`\`${dados.copyPaste}\`\`\``)
            .setImage(dados.qrcodeUrl || null)
            .setFooter({ text: `Gerado por ${interaction.user.tag}` })
            .setTimestamp();

          const rowPix = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('confirmar_pagamento')
              .setLabel('✅ Confirmar Pagamento')
              .setStyle(ButtonStyle.Success)
          );

          await interaction.channel.send({ embeds: [embed], components: [rowPix] });
          await interaction.editReply({ content: '✅ Cobrança PIX enviada no canal!' });

        } catch (error) {
          logger.error(`Erro PIX: ${error?.response?.data?.message || error.message}`);
          const msg = error?.response?.data?.message || error.message || 'Erro desconhecido';
          await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('❌ Erro ao Gerar PIX').setDescription(msg)]
          });
        }
        return;
      }

      // ── Criar Ticket ───────────────────────────────────────────────────────
      if (interaction.customId.startsWith('modal_ticket_')) {
        const motivo = interaction.customId.replace('modal_ticket_', '');
        const descricao = interaction.fields.getTextInputValue('descricao');
        const guild = interaction.guild;
        const user = interaction.user;
        const config = getConfig(guild.id);
        const motivoInfo = MOTIVOS[motivo] || { label: '📩 Ticket', cor: 0x5865f2 };

        // Registrar cooldown
        cooldowns.set(user.id, Date.now());

        await interaction.deferReply({ ephemeral: true });

        try {
          const numero = proximoNumeroTicket(guild.id);
          const nomeCanal = `ticket-${numero}`;

          const permissoes = [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            },
          ];

          if (config.SUPPORT_ROLE_ID) {
            permissoes.push({
              id: config.SUPPORT_ROLE_ID,
              allow: [
                PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels,
              ],
            });
          }

          const canalTicket = await guild.channels.create({
            name: nomeCanal,
            type: ChannelType.GuildText,
            parent: config.TICKET_CATEGORY_ID || null,
            topic: `uid:${user.id} | ${user.tag} | ${motivoInfo.label} | ${descricao.slice(0, 80)}`,
            permissionOverwrites: permissoes,
          });

          const embed = new EmbedBuilder()
            .setColor(motivoInfo.cor)
            .setTitle(`🎫 Ticket #${numero}`)
            .setDescription(`Olá ${user}! Nossa equipe irá te atender em breve.\nDescreva seu problema com o máximo de detalhes possível.`)
            .addFields(
              { name: '📋 Motivo', value: motivoInfo.label, inline: true },
              { name: '👤 Solicitante', value: `${user.tag}`, inline: true },
              { name: '📝 Descrição', value: descricao, inline: false },
              { name: '📅 Aberto em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setFooter({ text: 'Use os botões abaixo para gerenciar o ticket.' })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('assumir_ticket').setLabel('🙋 Assumir').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('gerar_pix').setLabel('💳 Gerar PIX').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('fechar_ticket').setLabel('🔒 Fechar').setStyle(ButtonStyle.Danger),
          );

          await canalTicket.send({
            content: `${user}${config.SUPPORT_ROLE_ID ? ` <@&${config.SUPPORT_ROLE_ID}>` : ''}`,
            embeds: [embed],
            components: [row],
          });

          // Log de abertura
          if (config.TICKET_LOG_CHANNEL_ID) {
            const logChannel = guild.channels.cache.get(config.TICKET_LOG_CHANNEL_ID);
            if (logChannel) {
              await logChannel.send({
                embeds: [
                  new EmbedBuilder()
                    .setColor(motivoInfo.cor)
                    .setTitle(`📂 Ticket #${numero} Aberto`)
                    .addFields(
                      { name: '👤 Usuário', value: `${user.tag} (${user.id})`, inline: true },
                      { name: '📁 Canal', value: `${canalTicket}`, inline: true },
                      { name: '📋 Motivo', value: motivoInfo.label, inline: true },
                      { name: '📝 Descrição', value: descricao }
                    )
                    .setTimestamp()
                ]
              });
            }
          }

          logger.info(`Ticket #${numero} aberto por ${user.tag} — ${motivoInfo.label}`);
          await interaction.editReply({ content: `✅ Seu ticket **#${numero}** foi criado! Acesse: ${canalTicket}` });

        } catch (error) {
          logger.error(`Erro ao criar ticket: ${error.message}`);
          await interaction.editReply({ content: '❌ Erro ao criar o ticket. Verifique as permissões do bot na categoria.' });
        }
      }

      // ── Say Mensagem ───────────────────────────────────────────────────────
      if (interaction.customId === 'modal_say_mensagem') {
        const texto  = interaction.fields.getTextInputValue('texto');
        const titulo = interaction.fields.getTextInputValue('titulo');
        const cor    = interaction.fields.getTextInputValue('cor');
        try {
          if (titulo) {
            const embed = new EmbedBuilder()
              .setColor(cor ? parseInt(cor.replace('#',''), 16) : 0x2b2d31)
              .setTitle(titulo).setDescription(texto).setTimestamp();
            await interaction.channel.send({ embeds: [embed] });
          } else {
            await interaction.channel.send(texto);
          }
          await interaction.reply({ content: '✅ Mensagem enviada!', ephemeral: true });
        } catch (e) {
          await interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
        }
      }

      // ── Say Webhook ────────────────────────────────────────────────────────
      if (interaction.customId.startsWith('modal_say_webhook_')) {
        const canalId = interaction.customId.replace('modal_say_webhook_', '');
        const texto  = interaction.fields.getTextInputValue('texto');
        const titulo = interaction.fields.getTextInputValue('titulo');
        const cor    = interaction.fields.getTextInputValue('cor');
        const nome   = interaction.fields.getTextInputValue('nome') || interaction.client.user.username;
        const avatar = interaction.fields.getTextInputValue('avatar');

        if (avatar && !avatar.startsWith('http')) {
          return interaction.reply({ content: '❌ URL do avatar inválida!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        try {
          const { WebhookClient } = require('discord.js');
          const canal = await interaction.client.channels.fetch(canalId);
          const webhooks = await canal.fetchWebhooks();
          let webhook = webhooks.find(w => w.owner?.id === interaction.client.user.id);
          if (!webhook) webhook = await canal.createWebhook({ name: 'Bot Webhook', avatar: interaction.client.user.displayAvatarURL() });

          const wClient = new WebhookClient({ id: webhook.id, token: webhook.token });
          const payload = { username: nome, avatarURL: avatar || interaction.client.user.displayAvatarURL(), allowedMentions: { parse: ['users','roles'] } };

          if (titulo) {
            const embed = new EmbedBuilder()
              .setColor(cor ? parseInt(cor.replace('#',''), 16) : 0x2b2d31)
              .setTitle(titulo).setDescription(texto).setTimestamp();
            payload.embeds = [embed];
          } else {
            payload.content = texto;
          }

          await wClient.send(payload);
          await interaction.editReply({ content: `✅ Mensagem enviada via webhook em <#${canalId}>!` });
        } catch (e) {
          logger.error(`Erro say webhook: ${e.message}`);
          await interaction.editReply({ content: `❌ Erro: ${e.message}` });
        }
      }

      // ── Painel ─────────────────────────────────────────────────────────────
      if (interaction.customId === 'modal_painel') {
        const descricao = interaction.fields.getTextInputValue('descricao');
        const imagem    = interaction.fields.getTextInputValue('imagem');
        const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

        const embed = new EmbedBuilder()
          .setColor(0x1a1a2e)
          .setTitle(`Seja muito bem-vindo(a) ao suporte da ${interaction.guild.name}`)
          .setDescription(
            descricao ||
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

        await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
        await interaction.reply({ content: '✅ Painel enviado!', ephemeral: true });
      }

      // ── Anúncio ────────────────────────────────────────────────────────────
      if (interaction.customId.startsWith('modal_anuncio_')) {
        const canalId  = interaction.customId.replace('modal_anuncio_', '');
        const mensagem = interaction.fields.getTextInputValue('mensagem');
        const titulo   = interaction.fields.getTextInputValue('titulo');
        const cor      = interaction.fields.getTextInputValue('cor');
        const tempoStr = interaction.fields.getTextInputValue('tempo').toLowerCase().trim();

        const match = tempoStr.match(/(\d+)\s*(segundo|minuto|hora)/);
        if (!match) {
          return interaction.reply({ content: '❌ Tempo inválido! Use: `30 minutos`, `2 horas` ou `60 segundos`', ephemeral: true });
        }

        const num = parseInt(match[1]);
        let tempoMs = 0;
        if (match[2].startsWith('segundo')) tempoMs = num * 1000;
        else if (match[2].startsWith('minuto')) tempoMs = num * 60000;
        else if (match[2].startsWith('hora'))   tempoMs = num * 3600000;

        const deletarEm = Date.now() + tempoMs;
        await interaction.deferReply({ ephemeral: true });

        try {
          const canal = await client.channels.fetch(canalId);
          let msg;

          if (titulo) {
            const embed = new EmbedBuilder()
              .setColor(cor ? parseInt(cor.replace('#',''), 16) : 0x2b2d31)
              .setTitle(titulo).setDescription(mensagem)
              .setFooter({ text: `⏳ Será apagado em ${tempoStr}` }).setTimestamp();
            msg = await canal.send({ embeds: [embed] });
          } else {
            msg = await canal.send(`${mensagem}\n\n*⏳ Esta mensagem será apagada em ${tempoStr}*`);
          }

          const { salvarAgendamento } = require('../utils/database');
          salvarAgendamento({ messageId: msg.id, channelId: canal.id, deletarEm });

          const delay = deletarEm - Date.now();
          setTimeout(async () => {
            try { await msg.delete(); } catch {}
            const { removerAgendamento } = require('../utils/database');
            removerAgendamento(msg.id);
          }, delay > 0 ? delay : 0);

          logger.info(`Anúncio agendado: ${tempoStr} em #${canal.name}`);
          await interaction.editReply({ content: `✅ Anúncio enviado em <#${canalId}>! Será apagado em **${tempoStr}**.` });
        } catch (e) {
          logger.error(`Erro anuncio modal: ${e.message}`);
          await interaction.editReply({ content: `❌ Erro: ${e.message}` });
        }
      }
    }
  },
};
