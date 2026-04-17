const fs    = require('fs');
const path  = require('path');
const https = require('https');

const DB_PATH   = path.join(process.cwd(), 'database.json');
const GH_TOKEN  = process.env.GITHUB_TOKEN;
const GH_REPO   = process.env.GITHUB_REPO || 'neutrorlq/exp-boost-bot';
const GH_FILE   = 'database.json';
const GH_BRANCH = 'main';

const INICIAL = {
  configs:{}, ticketCounter:{}, charges:[], scheduledDeletes:[],
  weeklyStats:{ weekStart:null, tickets:0, payments:0, revenue:0, history:[] },
};

function ghRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: endpoint, method,
      headers: {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'exp-boost-bot',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(data ? { 'Content-Type':'application/json','Content-Length':Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

let _dbCache = null;
let _ghSha   = null;
let _saveTimeout = null;

async function initDB() {
  try {
    if (GH_TOKEN) {
      const res = await ghRequest('GET', `/repos/${GH_REPO}/contents/${GH_FILE}?ref=${GH_BRANCH}`);
      if (res.content) {
        const data = JSON.parse(Buffer.from(res.content, 'base64').toString('utf-8'));
        _ghSha   = res.sha;
        _dbCache = data;
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        console.log('[DB] Carregado do GitHub');
        return;
      }
    }
  } catch(e) { console.error('[DB] GitHub load error:', e.message); }

  if (fs.existsSync(DB_PATH)) {
    _dbCache = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    console.log('[DB] Carregado do arquivo local');
  } else {
    _dbCache = JSON.parse(JSON.stringify(INICIAL));
    _dbCache.weeklyStats.weekStart = new Date().toISOString();
    console.log('[DB] Iniciado do zero');
  }
  _normalize(_dbCache);
}

function _normalize(d) {
  if (!d.configs)           d.configs = {};
  if (!d.ticketCounter)     d.ticketCounter = {};
  if (!Array.isArray(d.charges))          d.charges = [];
  if (!Array.isArray(d.scheduledDeletes)) d.scheduledDeletes = [];
  if (!d.weeklyStats || typeof d.weeklyStats !== 'object')
    d.weeklyStats = { weekStart: new Date().toISOString(), tickets:0, payments:0, revenue:0, history:[] };
  if (!d.weeklyStats.weekStart) d.weeklyStats.weekStart = new Date().toISOString();
  if (!Array.isArray(d.weeklyStats.history)) d.weeklyStats.history = [];
  ['tickets','payments','revenue'].forEach(k => { if (typeof d.weeklyStats[k] !== 'number') d.weeklyStats[k] = 0; });
}

function loadDB() {
  if (!_dbCache) {
    if (fs.existsSync(DB_PATH)) {
      _dbCache = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } else {
      _dbCache = JSON.parse(JSON.stringify(INICIAL));
      _dbCache.weeklyStats.weekStart = new Date().toISOString();
    }
    _normalize(_dbCache);
  }
  return _dbCache;
}

function saveDB(data) {
  _dbCache = data;
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch {}
  if (!GH_TOKEN) return;
  if (_saveTimeout) clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(async () => {
    try {
      if (!_ghSha) {
        const r = await ghRequest('GET', `/repos/${GH_REPO}/contents/${GH_FILE}?ref=${GH_BRANCH}`);
        _ghSha = r.sha;
      }
      const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
      const r = await ghRequest('PUT', `/repos/${GH_REPO}/contents/${GH_FILE}`, {
        message: 'db: auto-sync', content, sha: _ghSha, branch: GH_BRANCH,
      });
      if (r.content?.sha) _ghSha = r.content.sha;
      console.log('[DB] Sincronizado com GitHub');
    } catch(e) {
      console.error('[DB] GitHub save error:', e.message);
      _ghSha = null;
    }
  }, 3000);
}

function checkWeeklyReset(db) {
  const diffDays = (Date.now() - new Date(db.weeklyStats.weekStart)) / (1000*60*60*24);
  if (diffDays >= 7) {
    db.weeklyStats.history.unshift({ weekStart:db.weeklyStats.weekStart, weekEnd:new Date().toISOString(), tickets:db.weeklyStats.tickets, payments:db.weeklyStats.payments, revenue:db.weeklyStats.revenue });
    if (db.weeklyStats.history.length > 12) db.weeklyStats.history = db.weeklyStats.history.slice(0,12);
    Object.assign(db.weeklyStats, { weekStart:new Date().toISOString(), tickets:0, payments:0, revenue:0 });
    saveDB(db);
  }
}

function getConfig(guildId) { return loadDB().configs[guildId] || {}; }
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
  saveDB(db);
}

function confirmarPagamento(canalNome, confirmadoPor) {
  const db = loadDB();
  const c = [...(db.charges||[])].reverse().find(c => c.canal === canalNome && c.status === 'PENDENTE');
  if (c) {
    c.status = 'PAGO';
    c.confirmadoPor = confirmadoPor;
    c.confirmadoEm  = new Date().toISOString();
    db.weeklyStats.revenue = (db.weeklyStats.revenue||0) + (parseFloat(c.valor)||0);
    saveDB(db);
    return c;
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
  db.scheduledDeletes = (db.scheduledDeletes||[]).filter(a => a.messageId !== messageId);
  saveDB(db);
}

function listarAgendamentos() {
  const db = loadDB();
  if (!Array.isArray(db.scheduledDeletes)) { db.scheduledDeletes = []; saveDB(db); }
  return db.scheduledDeletes;
}

module.exports = {
  initDB, loadDB, saveDB,
  getConfig, setConfig,
  proximoNumeroTicket,
  salvarCobranca, confirmarPagamento,
  salvarAgendamento, removerAgendamento, listarAgendamentos,
  checkWeeklyReset,
};
