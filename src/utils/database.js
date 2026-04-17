const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'database.json');

const INICIAL = {
  configs: {},
  ticketCounter: {},
  charges: [],
  scheduledDeletes: [],
  weeklyStats: { weekStart: null, tickets: 0, payments: 0, revenue: 0, history: [] },
};

function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const init = JSON.parse(JSON.stringify(INICIAL));
      init.weeklyStats.weekStart = new Date().toISOString();
      fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
      return init;
    }
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    if (!data.configs)           data.configs = {};
    if (!data.ticketCounter)     data.ticketCounter = {};
    if (!Array.isArray(data.charges))         data.charges = [];
    if (!Array.isArray(data.scheduledDeletes)) data.scheduledDeletes = [];
    if (!data.weeklyStats || typeof data.weeklyStats !== 'object') {
      data.weeklyStats = { weekStart: new Date().toISOString(), tickets: 0, payments: 0, revenue: 0, history: [] };
    }
    if (!data.weeklyStats.weekStart) data.weeklyStats.weekStart = new Date().toISOString();
    if (!Array.isArray(data.weeklyStats.history)) data.weeklyStats.history = [];
    if (typeof data.weeklyStats.tickets  !== 'number') data.weeklyStats.tickets  = 0;
    if (typeof data.weeklyStats.payments !== 'number') data.weeklyStats.payments = 0;
    if (typeof data.weeklyStats.revenue  !== 'number') data.weeklyStats.revenue  = 0;
    return data;
  } catch (e) {
    console.error('[DB] Erro ao carregar:', e.message);
    const fb = JSON.parse(JSON.stringify(INICIAL));
    fb.weeklyStats.weekStart = new Date().toISOString();
    return fb;
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[DB] Erro ao salvar:', e.message);
  }
}

function checkWeeklyReset(db) {
  const weekStart = new Date(db.weeklyStats.weekStart);
  const diffDays  = (Date.now() - weekStart) / (1000 * 60 * 60 * 24);
  if (diffDays >= 7) {
    db.weeklyStats.history.unshift({
      weekStart: db.weeklyStats.weekStart,
      weekEnd:   new Date().toISOString(),
      tickets:   db.weeklyStats.tickets,
      payments:  db.weeklyStats.payments,
      revenue:   db.weeklyStats.revenue,
    });
    if (db.weeklyStats.history.length > 12) db.weeklyStats.history = db.weeklyStats.history.slice(0, 12);
    db.weeklyStats.weekStart = new Date().toISOString();
    db.weeklyStats.tickets   = 0;
    db.weeklyStats.payments  = 0;
    db.weeklyStats.revenue   = 0;
    saveDB(db);
  }
}

function getConfig(guildId) {
  return loadDB().configs[guildId] || {};
}

function setConfig(guildId, key, value) {
  const db = loadDB();
  if (!db.configs[guildId]) db.configs[guildId] = {};
  db.configs[guildId][key] = value;
  saveDB(db);
}

function proximoNumeroTicket(guildId) {
  const db = loadDB();
  checkWeeklyReset(db);
  if (!db.ticketCounter[guildId]) db.ticketCounter[guildId] = 0;
  db.ticketCounter[guildId]++;
  db.weeklyStats.tickets++;
  saveDB(db);
  return String(db.ticketCounter[guildId]).padStart(4, '0');
}

function salvarCobranca(dados) {
  const db = loadDB();
  checkWeeklyReset(db);
  if (!Array.isArray(db.charges)) db.charges = [];
  db.charges.push({ ...dados, criadoEm: new Date().toISOString() });
  db.weeklyStats.payments++;
  // Só soma no revenue se já for PAGO na criação
  if (dados.status && dados.status !== 'PENDENTE') {
    db.weeklyStats.revenue += parseFloat(dados.valor) || 0;
  }
  saveDB(db);
}

function confirmarPagamento(canalNome, confirmadoPor) {
  const db = loadDB();
  const cobranca = [...(db.charges||[])].reverse().find(c => c.canal === canalNome && c.status === 'PENDENTE');
  if (cobranca) {
    cobranca.status       = 'PAGO';
    cobranca.confirmadoPor = confirmadoPor;
    cobranca.confirmadoEm  = new Date().toISOString();
    // Adiciona ao revenue semanal
    if (db.weeklyStats) {
      db.weeklyStats.revenue = (db.weeklyStats.revenue || 0) + (parseFloat(cobranca.valor) || 0);
    }
    saveDB(db);
    return cobranca;
  }
  return null;
}

function salvarAgendamento(dados) {
  const db = loadDB();
  if (!Array.isArray(db.scheduledDeletes)) db.scheduledDeletes = [];
  db.scheduledDeletes.push(dados);
  saveDB(db);
}

function removerAgendamento(messageId) {
  const db = loadDB();
  db.scheduledDeletes = (db.scheduledDeletes || []).filter(a => a.messageId !== messageId);
  saveDB(db);
}

function listarAgendamentos() {
  const db = loadDB();
  if (!Array.isArray(db.scheduledDeletes)) { db.scheduledDeletes = []; saveDB(db); }
  return db.scheduledDeletes;
}

module.exports = {
  getConfig, setConfig,
  proximoNumeroTicket,
  salvarCobranca, confirmarPagamento,
  salvarAgendamento, removerAgendamento, listarAgendamentos,
  checkWeeklyReset,
  loadDB, saveDB,
};
