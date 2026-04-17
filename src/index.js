require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const startWebhookServer = require('./utils/webhookServer');
const logger = require('./utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// ─── CARREGAR COMANDOS ─────────────────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    logger.info(`Comando carregado: /${command.data.name}`);
  }
}

// ─── CARREGAR EVENTOS ──────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  logger.info(`Evento carregado: ${event.name}`);
}

// ─── TRATAMENTO DE ERROS GLOBAIS ──────────────────────────────────────────────
client.on('error', error => logger.error(`Client error: ${error.message}`));
client.on('warn', info => logger.warn(info));
process.on('unhandledRejection', error => logger.error(`UnhandledRejection: ${error?.message || error}`));
process.on('uncaughtException', error => {
  logger.error(`UncaughtException: ${error.message}`);
  process.exit(1);
});

// ─── INICIAR WEBHOOK + LOGIN ───────────────────────────────────────────────────
const { initDB } = require('./utils/database');
initDB().then(() => {
  startWebhookServer(client);
  client.login(process.env.DISCORD_TOKEN);
});
