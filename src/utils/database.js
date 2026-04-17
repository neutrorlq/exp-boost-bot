const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'database.json');

const INICIAL = {
  configs: {},
  ticketCounter: {},
  charges: [],
  scheduledDeletes: [],
  weeklyStats: {
    weekStart: null,
    tickets: 0,
    payments: 0,
    revenue: 0,
    history: [], // Guarda histórico das semanas anteriores
  },
};

function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const init = JSON.parse(JSON.stringify(INICIAL));
      init.weeklyStats.weekStart = new Date().toISOString();
      fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
      return init;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);

    // Garantir estrutura completa
    if (!data.configs) data.configs = {};
    if (!data.ticketCounter) data.ticketCounter = {};
    if (!Array.isArray(data.charges)) data.charges = [];
    if (!Array.isArray(data.scheduledDeletes)) data.scheduledDeletes = [];
    if (!data.weeklyStats || typeof data.weeklyStats !== 'object') {
      data.weeklyStats = { weekStart: new Date().toISOString(), tickets: 0, payments: 0, revenue: 0, history: [] };
    }
    if (!data.weeklyStats.weekStart) data.weeklyStats.weekStart = new Date().toISOString();
    if (!Array.isArray(data.weeklyStats.history)) data.weeklyStats.history = [];
    if (typeof data.weeklyStats.tickets !== 'number') data.weeklyStats.tickets = 0;
    if (typeof data.weeklyStats.payments !== 'number') data.weeklyStats.payments = 0;
    if (typeof data.weeklyStats.revenue !== 'number') data.weeklyStats.revenue = 0;

    return data;
  } catch (e) {
    console.error('[DB] Erro ao carregar database.json:', e.message);
    const fallback = JSON.parse(JSON.stringify(INICIAL));
    fallback.weeklyStats.weekStart = new Date().toISOString();
    return fallback;
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[DB] Erro ao salvar database.json:', e.message);
  }
}

// ─── VERIFICAR E RESETAR SEMANA ────────────────────────────────────────────
function checkWeeklyReset(db) {
  const weekStart = new Date(db.weeklyStats.weekStart);
  const now = new Date();
  const diffMs = now - weekStart;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays >= 7) {
    // Salvar semana atual no histórico
    db.weeklyStats.history.unshift({
      weekStart: db.weeklyStats.weekStart,
      weekEnd: now.toISOString(),
      tickets: db.weeklyStats.tickets,
      payments: db.weeklyStats.payments,
      revenue: db.weeklyStats.revenue,
    });

    // Manter apenas últimas 12 semanas no histórico
    if (db.weeklyStats.history.length > 12) {
      db.weeklyStats.history = db.weeklyStats.history.slice(0, 12);
    }

    // Resetar semana atual
    db.weeklyStats.weekStart = now.toISOString();
    db.weeklyStats.tickets   = 0;
    db.weeklyStats.payments  = 0;
    db.weeklyStats.revenue   = 0;

    saveDB(db);
    console.log('[DB] Estatísticas semanais resetadas.');
    return true;
  }
  return false;
}

// ─── CONFIG ────────────────────────────────────────────────────────────────
function getConfig(guildId) {
  const db = loadDB();
  return db.configs[guildId] || {};
}

function setConfig(guildId, key, value) {
  const db = loadDB();
  if (!db.configs[guildId]) db.configs[guildId] = {};
  db.configs[guildId][key] = value;
  saveDB(db);
}

// ─── TICKETS ───────────────────────────────────────────────────────────────
function proximoNumeroTicket(guildId) {
  const db = loadDB();
  checkWeeklyReset(db);

  if (!db.ticketCounter[guildId]) db.ticketCounter[guildId] = 0;
  db.ticketCounter[guildId]++;
  db.weeklyStats.tickets++;
  saveDB(db);
  return String(db.ticketCounter[guildId]).padStart(4, '0');
}

// ─── COBRANÇAS ─────────────────────────────────────────────────────────────
function salvarCobranca(dados) {
  const db = loadDB();
  checkWeeklyReset(db);

  if (!Array.isArray(db.charges)) db.charges = [];
  db.charges.push({ ...dados, criadoEm: new Date().toISOString() });
  db.weeklyStats.payments++;
  db.weeklyStats.revenue += parseFloat(dados.valor) || 0;
  saveDB(db);
}

// ─── AGENDAMENTOS ──────────────────────────────────────────────────────────
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
  if (!Array.isArray(db.scheduledDeletes)) {
    db.scheduledDeletes = [];
    saveDB(db);
  }
  return db.scheduledDeletes;
}

module.exports = {
  getConfig, setConfig,
  proximoNumeroTicket,
  salvarCobranca,
  salvarAgendamento, removerAgendamento, listarAgendamentos,
  checkWeeklyReset,
  loadDB, saveDB,
};
