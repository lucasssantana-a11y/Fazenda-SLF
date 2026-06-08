import http from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const dataDir = path.join(root, "data");
const dbPath = path.join(dataDir, "db.json");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
let writeQueue = Promise.resolve();

function loadLocalEnv() {
  const envPath = path.join(root, ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadLocalEnv();

function hashPassword(salt, password) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function hashCode(identifier, code) {
  return crypto.createHash("sha256").update(`${identifier}:${code}`).digest("hex");
}

const defaultDb = {
  settings: {
    carcassYield: 0.55,
    arrobaKg: 15,
    arrobaPrice: 330,
    operatingCostPerHeadDay: 0,
    cdiAnnualRate: 0.105,
    ipcaAnnualRate: 0.04,
    aiProvider: "openai_or_gemini_pending_key"
  },
  users: [
    {
      id: "user-lucas",
      name: "Lucas Santana",
      email: "lucas@fazendaslf.com",
      role: "admin",
      passwordSalt: "slf-local",
      passwordHash: hashPassword("slf-local", "FazendaSLF@2026")
    }
  ],
  authSessions: [],
  authCodes: [],
  marketQuotes: [
    { id: "quote_manual_330", date: "2026-05-04", region: "Manual", animalSex: "mixed", arrobaPrice: 330, source: "Premissa inicial" }
  ],
  marketMonthlyCloses: [],
  marketCostBenchmarks: [
    {
      id: "bench-cna-ro-2024-recria-engorda-semi-coe",
      date: "2024-04-30",
      region: "Colorado D'Oeste | RO",
      system: "Recria e engorda em semiconfinamento",
      metricType: "COE/@ vendida",
      value: 171.88,
      source: "CNA/Cepea Campo Futuro",
      sourceUrl: "https://www.cnabrasil.org.br/noticias/cna-levanta-custos-da-pecuaria-de-corte-em-rondonia",
      notes: "Custo Operacional Efetivo por arroba vendida; aquisição dos animais foi 51,6% do COE."
    },
    {
      id: "bench-imea-mt-2024q1-recria-engorda-cot",
      date: "2024-03-31",
      region: "Mato Grosso",
      system: "Recria-engorda",
      metricType: "COT/@ vendida",
      value: 200.05,
      source: "Senar/IMEA via Agrolink",
      sourceUrl: "https://www.agrolink.com.br/noticias/variacoes-nos-custos-de-producao-da-pecuaria-em-mato-grosso_490509.html",
      notes: "Custo Operacional Total por arroba vendida no 1o trimestre de 2024."
    },
    {
      id: "bench-cna-pa-2025-paragominas-recria-terminacao-coe",
      date: "2025-08-08",
      region: "Paragominas | PA",
      system: "Recria e terminação a pasto",
      metricType: "COE/@ vendida",
      value: 183.5,
      source: "CNA/Campo Futuro",
      sourceUrl: "https://www.cnabrasil.org.br/noticias/campo-futuro-levanta-custo-da-bovinocultura-de-corte-no-para",
      notes: "COE por arroba vendida; reposição representou 62,2% e suplementação mineral 10,5% do custo."
    },
    {
      id: "bench-cna-pa-2025-santana-ciclo-completo-coe",
      date: "2025-08-08",
      region: "Santana do Araguaia | PA",
      system: "Ciclo completo",
      metricType: "COE/@ vendida",
      value: 164.61,
      source: "CNA/Campo Futuro",
      sourceUrl: "https://www.cnabrasil.org.br/noticias/campo-futuro-levanta-custo-da-bovinocultura-de-corte-no-para",
      notes: "COE por arroba vendida; suplementação mineral representou 51,3% e mão de obra 16,5%."
    }
  ],
  marketHistory: [
    { id: "annual-1998", year: 1998, averageArrobaPrice: 26.94, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-1999", year: 1999, averageArrobaPrice: 27.5, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2000", year: 2000, averageArrobaPrice: 30.2, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2001", year: 2001, averageArrobaPrice: 39.34, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2002", year: 2002, averageArrobaPrice: 43.2, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2003", year: 2003, averageArrobaPrice: 54.62, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2004", year: 2004, averageArrobaPrice: 56.45, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2005", year: 2005, averageArrobaPrice: 55.05, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2006", year: 2006, averageArrobaPrice: 54.87, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2007", year: 2007, averageArrobaPrice: 58.56, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2008", year: 2008, averageArrobaPrice: 71.85, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2009", year: 2009, averageArrobaPrice: 76.61, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2010", year: 2010, averageArrobaPrice: 87.31, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2011", year: 2011, averageArrobaPrice: 95.74, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2012", year: 2012, averageArrobaPrice: 95.04, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2013", year: 2013, averageArrobaPrice: 101.84, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2014", year: 2014, averageArrobaPrice: 115.36, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2015", year: 2015, averageArrobaPrice: 143.55, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2016", year: 2016, averageArrobaPrice: 152.84, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2017", year: 2017, averageArrobaPrice: 138.57, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2018", year: 2018, averageArrobaPrice: 144.99, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2019", year: 2019, averageArrobaPrice: 153.1, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2020", year: 2020, averageArrobaPrice: 197.53, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2021", year: 2021, averageArrobaPrice: 267.13, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2022", year: 2022, averageArrobaPrice: 289.43, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" },
    { id: "annual-2023", year: 2023, averageArrobaPrice: 275, frequency: "annual", source: "Compilação pública baseada em CEPEA/Farmnews; validar contra base oficial antes de decisão comercial" }
  ],
  supplements: [
    { id: "fortis-seca", name: "Fortis Seca", type: "Proteinado com ureia", bagPrice: 75.9, bagKg: 25, costKg: 3.036, defaultPercentPv: 0.001 },
    { id: "comigo-corte", name: "Comigo Corte", type: "Proteico-energética", bagPrice: 59.5, bagKg: 30, costKg: 1.9833333333, defaultPercentPv: 0.003 }
  ],
  lots: [
    { id: "lote-maior-85", name: "Lote maior - base 8,5@", quantity: 17, entryDate: "2026-01-20", purchasePricePerHead: 1950, currentArrobas: 8.5, notes: "Cenário base visual" },
    { id: "lote-maior-90", name: "Lote maior - otimista 9@", quantity: 17, entryDate: "2026-01-20", purchasePricePerHead: 1950, currentArrobas: 9, notes: "Cenário otimista visual" }
  ],
  animals: [],
  animalWeighings: [],
  lotWeighings: [],
  expenseCategories: [
    { id: "fretes", name: "Fretes e carretos", group: "Compra/Venda", defaultDescription: "Transporte de animais, insumos ou equipamentos" },
    { id: "comissoes_compra", name: "Comissões de compra", group: "Compra/Venda", defaultDescription: "Comissão de leilão, corretagem ou intermediação na compra" },
    { id: "comissoes_venda", name: "Comissões de venda", group: "Compra/Venda", defaultDescription: "Comissão de venda, corretagem ou leilão" },
    { id: "colaboradores", name: "Pagamento colaboradores", group: "Mão de obra", defaultDescription: "Salários, diárias, ajudantes e serviços de campo" },
    { id: "encargos", name: "Encargos trabalhistas", group: "Mão de obra", defaultDescription: "Encargos, benefícios e obrigações de pessoal" },
    { id: "suplementacao", name: "Suplementação", group: "Alimentação", defaultDescription: "Proteinado, ração, concentrado e aditivos" },
    { id: "sal_mineral", name: "Sal mineral", group: "Alimentação", defaultDescription: "Sal mineral, mistura mineral e núcleos" },
    { id: "veterinario", name: "Veterinário", group: "Sanidade", defaultDescription: "Atendimento técnico, consultas e procedimentos" },
    { id: "medicamentos", name: "Medicamentos", group: "Sanidade", defaultDescription: "Vermífugos, antibióticos, anti-inflamatórios e curativos" },
    { id: "vacinas", name: "Vacinas", group: "Sanidade", defaultDescription: "Vacinas obrigatórias e protocolos sanitários" },
    { id: "manutencao_cercas", name: "Manutenção de cercas", group: "Infraestrutura", defaultDescription: "Arames, mourões, porteiras e mão de obra de cerca" },
    { id: "manutencao_pastos", name: "Manutenção de pastagens", group: "Infraestrutura", defaultDescription: "Roçada, reforma, adubação, sementes e corretivos" },
    { id: "manutencao_maquinas", name: "Manutenção de máquinas", group: "Máquinas", defaultDescription: "Trator, implementos, peças e oficina" },
    { id: "combustivel", name: "Combustível", group: "Máquinas", defaultDescription: "Diesel, gasolina, lubrificantes e deslocamentos" },
    { id: "arrendamento", name: "Arrendamento / aluguel de pasto", group: "Terra", defaultDescription: "Arrendamento, aluguel de pasto e parceria" },
    { id: "terra_propria", name: "Terra própria", group: "Terra", defaultDescription: "Custo de oportunidade ou custo direto mensal da área própria ocupada pelos animais" },
    { id: "energia_agua", name: "Energia e água", group: "Operacional", defaultDescription: "Energia, bombas, poços, água e bebedouros" },
    { id: "impostos_taxas", name: "Impostos e taxas", group: "Administrativo", defaultDescription: "GTA, taxas, impostos, registros e documentos" },
    { id: "perdas_mortalidade", name: "Perdas e mortalidade", group: "Risco", defaultDescription: "Mortalidade, descarte forçado e perdas operacionais" },
    { id: "outros", name: "Outros", group: "Geral", defaultDescription: "Despesa não classificada" }
  ],
  expenses: [],
  pastures: [
    { id: "pasto-casa", name: "Pasto Acima Casa", areaHa: null, status: "Secando", notes: "Importado do racional da planilha" },
    { id: "pasto-estrada", name: "Pasto Estrada - Ramirinho", areaHa: null, status: "Secando", notes: "" }
  ],
  pastureMovements: [],
  financialIndicators: [
    { id: "cdi-manual", code: "CDI_ANNUAL", name: "CDI anual referência", date: "2026-05-04", value: 0.105, unit: "decimal a.a.", source: "Premissa manual" },
    { id: "ipca-manual", code: "IPCA_12M", name: "IPCA 12 meses referência", date: "2026-05-04", value: 0.04, unit: "decimal a.a.", source: "Premissa manual" }
  ],
  riskFactors: [
    { id: "risk-cycle", category: "ciclo_pecuario", name: "Transição de baixa para alta", direction: "misto", impact: 4, probability: 4, horizonMonths: 12, source: "Modelo operacional informado", notes: "Reposição cara, arroba em alta gradual e margens ainda pressionadas no curto prazo." },
    { id: "risk-climate", category: "clima", name: "Seca / perda de pasto", direction: "negativo", impact: 4, probability: 3, horizonMonths: 6, source: "Premissa inicial", notes: "Seca eleva custo e prazo de ganho." },
    { id: "risk-macro", category: "macro", name: "Juros e câmbio", direction: "misto", impact: 3, probability: 3, horizonMonths: 12, source: "Premissa inicial", notes: "Afeta CDI, custo de oportunidade, exportação e insumos." }
  ],
  cycleSignals: [
    { id: "cycle-initial", date: "2026-05-04", phase: "transicao_baixa_para_alta", confidence: 0.7, source: "Modelo operacional informado", notes: "Brasil em transição de baixa para alta; reposição cara, arroba com alta gradual e margem pressionada no curto prazo." }
  ],
  simulations: []
  ,
  auctionComparisons: []
};

const entities = new Set(["lots", "animals", "animalWeighings", "lotWeighings", "expenseCategories", "expenses", "pastures", "pastureMovements", "supplements", "marketQuotes", "marketMonthlyCloses", "marketCostBenchmarks", "marketHistory", "financialIndicators", "riskFactors", "cycleSignals", "simulations", "auctionComparisons"]);

async function ensureDb() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(dbPath)) await writeFile(dbPath, JSON.stringify(defaultDb, null, 2));
}

async function loadDb() {
  await ensureDb();
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  let changed = false;
  for (const [key, value] of Object.entries(defaultDb)) {
    if (db[key] === undefined) {
      db[key] = value;
      changed = true;
    }
  }
  for (const [key, value] of Object.entries(defaultDb.settings)) {
    if (db.settings[key] === undefined) {
      db.settings[key] = value;
      changed = true;
    }
  }
  let nextLotCode = 1;
  for (const lot of db.lots || []) {
    if (!lot.code) {
      lot.code = nextLotCode;
      changed = true;
    }
    if (lot.purchaseArrobas === undefined || lot.purchaseArrobas === null || lot.purchaseArrobas === "") {
      lot.purchaseArrobas = Number(lot.currentArrobas || 0);
      changed = true;
    }
    nextLotCode = Math.max(nextLotCode, Number(lot.code || 0) + 1);
  }
  let nextAnimalCode = 1;
  for (const animal of db.animals || []) {
    if (!animal.code) {
      animal.code = nextAnimalCode;
      changed = true;
    }
    nextAnimalCode = Math.max(nextAnimalCode, Number(animal.code || 0) + 1);
  }
  for (const expense of db.expenses || []) {
    if (!Array.isArray(expense.lotIds)) {
      expense.lotIds = expense.lotId ? [expense.lotId] : [];
      changed = true;
    }
    if (expense.allocationMode === "specific_lot") {
      expense.allocationMode = "specific_lots";
      changed = true;
    }
  }
  const lotsToSyncFromLiveWeight = new Set();
  for (const weighing of db.animalWeighings || []) {
    if (Number(weighing.weightKg || 0) > 0) {
      const liveArrobas = arrobaFromPv(weighing.weightKg, db);
      if (Math.abs(Number(weighing.arrobas || 0) - liveArrobas) > 0.001) {
        weighing.arrobas = liveArrobas;
        changed = true;
        const animal = (db.animals || []).find((item) => item.id === weighing.animalId);
        if (animal?.lotId) lotsToSyncFromLiveWeight.add(animal.lotId);
      }
    }
  }
  for (const weighing of db.lotWeighings || []) {
    if (Number(weighing.averageWeightKg || 0) > 0) {
      const liveAverageArrobas = arrobaFromPv(weighing.averageWeightKg, db);
      const liveTotalArrobas = liveAverageArrobas * Number(weighing.quantityEvaluated || 0);
      if (Math.abs(Number(weighing.averageArrobas || 0) - liveAverageArrobas) > 0.001 || Math.abs(Number(weighing.totalArrobas || 0) - liveTotalArrobas) > 0.001) {
        weighing.averageArrobas = liveAverageArrobas;
        weighing.totalArrobas = liveTotalArrobas;
        weighing.totalWeightKg = Number(weighing.averageWeightKg || 0) * Number(weighing.quantityEvaluated || 0);
        changed = true;
        if (weighing.lotId) lotsToSyncFromLiveWeight.add(weighing.lotId);
      }
    }
  }
  for (const lotId of lotsToSyncFromLiveWeight) syncLotFromWeighings(db, lotId);
  for (const category of defaultDb.expenseCategories || []) {
    if (!(db.expenseCategories || []).some((item) => item.id === category.id)) {
      db.expenseCategories.push(category);
      changed = true;
    }
  }
  for (const quote of db.marketQuotes || []) {
    if (!quote.animalSex) {
      quote.animalSex = String(quote.region || "").toLowerCase().includes("boi") ? "male" : "mixed";
      changed = true;
    }
  }
  const cycle = db.cycleSignals?.find((item) => item.id === "cycle-initial");
  if (cycle && cycle.phase === "indefinido") {
    Object.assign(cycle, defaultDb.cycleSignals[0]);
    changed = true;
  }
  const riskCycle = db.riskFactors?.find((item) => item.id === "risk-cycle");
  if (riskCycle && riskCycle.notes === "Ajustar após inserir dados históricos e leitura do ciclo.") {
    Object.assign(riskCycle, defaultDb.riskFactors[0]);
    changed = true;
  }
  if (changed) await saveDb(db);
  return db;
}

async function saveDb(db) {
  const tempPath = `${dbPath}.tmp`;
  writeQueue = writeQueue.then(async () => {
    await writeFile(tempPath, JSON.stringify(db, null, 2));
    await rename(tempPath, dbPath);
  });
  return writeQueue;
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function clientDb(db) {
  const { users, authSessions, authCodes, ...rest } = db;
  return { ...rest, users: (users || []).map(publicUser) };
}

function tokenFromRequest(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function authenticatedSession(db, req) {
  const token = tokenFromRequest(req);
  if (!token) return null;
  const now = Date.now();
  const session = (db.authSessions || []).find((item) => item.token === token && new Date(item.expiresAt).getTime() > now);
  if (!session) return null;
  const user = (db.users || []).find((item) => item.id === session.userId);
  return user ? { session, user } : null;
}

function findUserByIdentifier(db, identifier) {
  const normalized = String(identifier || "").trim().toLowerCase();
  return (db.users || []).find((item) => String(item.email || "").toLowerCase() === normalized || String(item.id || "").toLowerCase() === `user-${normalized}`);
}

function createSession(db, user) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
  db.authSessions = (db.authSessions || []).filter((item) => new Date(item.expiresAt).getTime() > Date.now());
  db.authSessions.push({ id: id("session"), token, userId: user.id, createdAt: new Date().toISOString(), expiresAt });
  return { token, expiresAt, user: publicUser(user) };
}

function normalizeForDuplicate(entity, record) {
  const fields = {
    lots: ["name", "quantity", "entryDate", "purchaseArrobas", "purchasePricePerHead", "currentArrobas", "notes"],
    animals: ["tag", "lotId", "currentArrobas", "entryDate"]
  }[entity];
  if (!fields) return null;
  return JSON.stringify(fields.map((field) => {
    const value = record[field];
    if (typeof value === "string") return value.trim().toLowerCase();
    if (typeof value === "number") return Number(value);
    return value ?? "";
  }));
}

function hasDuplicate(db, entity, candidate, ignoreId = null) {
  const target = normalizeForDuplicate(entity, candidate);
  if (!target) return false;
  return db[entity].some((record) => record.id !== ignoreId && normalizeForDuplicate(entity, record) === target);
}

function nextCode(db, entity) {
  return (db[entity] || []).reduce((max, item) => Math.max(max, Number(item.code || 0)), 0) + 1;
}

function send(res, status, payload, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(payload));
}

function sendRawJson(res, status, payload, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(payload, null, 2));
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function pvFromArroba(arrobas, db) {
  return Number(arrobas || 0) * 30;
}

function arrobaFromPv(weightKg, db) {
  return Number(weightKg || 0) ? Number(weightKg || 0) / 30 : 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pastureQualityFromLot(lot) {
  const text = `${lot.pastureQuality || ""} ${lot.notes || ""} ${lot.category || ""}`.toLowerCase();
  if (/bom|boa|verde|canavial|massa|aguas|águas/.test(text)) return "bom";
  if (/fraco|ruim|seco|seca|secando|baixo/.test(text)) return "fraco";
  return "medio";
}

function pastureFactor(quality) {
  return quality === "bom" ? 1.08 : quality === "fraco" ? 0.76 : 0.92;
}

function technicalGmdFromSupplementation({ proteinPercentPv, energyProteinPercentPv, pastureQuality }) {
  let base;
  if (energyProteinPercentPv < 0.001) base = 0.28;
  else if (energyProteinPercentPv <= 0.002) base = 0.38;
  else if (energyProteinPercentPv <= 0.0035) base = 0.52;
  else if (energyProteinPercentPv <= 0.0055) base = 0.68;
  else base = 0.82;

  if (proteinPercentPv < 0.0008) base -= 0.06;
  if (proteinPercentPv > 0.0012) base += 0.03;
  return clamp(base * pastureFactor(pastureQuality), 0.05, 1.05);
}

function gmdConsistency(inputGmd, technicalGmd) {
  const delta = inputGmd - technicalGmd;
  const tolerance = 0.12;
  if (delta > tolerance) return { status: "otimista", delta, message: "GMD informado acima do esperado para a suplementação/pasto." };
  if (delta < -tolerance) return { status: "conservador", delta, message: "GMD informado abaixo do esperado para a suplementação/pasto." };
  return { status: "coerente", delta, message: "GMD informado coerente com a suplementação/pasto." };
}

function npv(rate, cashFlows) {
  return cashFlows.reduce((sum, value, index) => sum + value / Math.pow(1 + rate, index), 0);
}

function internalRateOfReturn(cashFlows) {
  const hasPositive = cashFlows.some((value) => value > 0);
  const hasNegative = cashFlows.some((value) => value < 0);
  if (!hasPositive || !hasNegative) return null;

  let low = -0.95;
  let high = 10;
  let lowNpv = npv(low, cashFlows);
  let highNpv = npv(high, cashFlows);
  for (let index = 0; index < 40 && lowNpv * highNpv > 0; index += 1) {
    high *= 2;
    highNpv = npv(high, cashFlows);
  }
  if (lowNpv * highNpv > 0) return null;

  for (let index = 0; index < 100; index += 1) {
    const mid = (low + high) / 2;
    const midNpv = npv(mid, cashFlows);
    if (Math.abs(midNpv) < 0.0001) return mid;
    if (lowNpv * midNpv <= 0) {
      high = mid;
      highNpv = midNpv;
    } else {
      low = mid;
      lowNpv = midNpv;
    }
  }
  return (low + high) / 2;
}

function latestWeighingForAnimal(db, animalId) {
  return (db.animalWeighings || [])
    .filter((item) => item.animalId === animalId)
    .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")))[0];
}

function syncAnimalFromWeighings(db, animalId) {
  const animal = db.animals.find((item) => item.id === animalId);
  if (!animal) return;
  const latest = latestWeighingForAnimal(db, animalId);
  if (latest) {
    animal.currentWeightKg = Number(latest.weightKg || 0);
    animal.currentArrobas = Number(latest.arrobas || 0);
    animal.lastWeighingDate = latest.date || latest.createdAt?.slice(0, 10) || "";
  } else {
    delete animal.currentWeightKg;
    delete animal.lastWeighingDate;
  }
  animal.updatedAt = new Date().toISOString();
  syncLotFromWeighings(db, animal.lotId);
}

function normalizeWeighing(record, db) {
  record.weightKg = Number(record.weightKg || 0);
  record.arrobas = record.weightKg ? arrobaFromPv(record.weightKg, db) : Number(record.arrobas || 0);
  return record;
}

function latestLotWeighing(db, lotId) {
  return (db.lotWeighings || [])
    .filter((item) => item.lotId === lotId)
    .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")))[0];
}

function syncLotFromWeighings(db, lotId) {
  const lot = db.lots.find((item) => item.id === lotId);
  if (!lot) return;
  const lotWeighing = latestLotWeighing(db, lotId);
  if (lotWeighing?.averageArrobas) {
    lot.currentArrobas = Number(lotWeighing.averageArrobas || 0);
    lot.lastWeighingDate = lotWeighing.date || lotWeighing.createdAt?.slice(0, 10) || "";
    lot.lastWeighingSource = lotWeighing.source || "Lote";
    lot.updatedAt = new Date().toISOString();
    return;
  }
  const animals = (db.animals || []).filter((animal) => animal.lotId === lotId && Number(animal.currentArrobas || 0) > 0);
  if (animals.length) {
    lot.currentArrobas = animals.reduce((sum, animal) => sum + Number(animal.currentArrobas || 0), 0) / animals.length;
    lot.lastWeighingSource = "Animais individuais";
    lot.updatedAt = new Date().toISOString();
  }
}

function normalizeLotWeighing(record, db) {
  const lot = db.lots.find((item) => item.id === record.lotId);
  record.quantityEvaluated = Number(record.quantityEvaluated || lot?.quantity || 0);
  record.averageWeightKg = Number(record.averageWeightKg || 0);
  record.averageArrobas = record.averageWeightKg ? arrobaFromPv(record.averageWeightKg, db) : Number(record.averageArrobas || 0);
  record.totalWeightKg = record.averageWeightKg * record.quantityEvaluated;
  record.totalArrobas = record.averageArrobas * record.quantityEvaluated;
  return record;
}

function lotContextForVision(db, lotId) {
  const lot = db.lots.find((item) => item.id === lotId) || {};
  const recentLotWeighings = (db.lotWeighings || [])
    .filter((item) => item.lotId === lotId)
    .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")))
    .slice(0, 5)
    .map((item) => ({
      date: item.date || item.createdAt,
      averageWeightKg: Number(item.averageWeightKg || 0),
      averageArrobas: Number(item.averageArrobas || 0),
      quantityEvaluated: Number(item.quantityEvaluated || 0),
      source: item.source || ""
    }));
  const animals = (db.animals || [])
    .filter((animal) => animal.lotId === lotId)
    .map((animal) => ({
      tag: animal.tag,
      code: animal.code,
      currentWeightKg: Number(animal.currentWeightKg || 0),
      currentArrobas: Number(animal.currentArrobas || 0),
      lastWeighingDate: animal.lastWeighingDate || ""
    }));
  return {
    lot: {
      id: lot.id,
      name: lot.name,
      quantity: Number(lot.quantity || 0),
      purchaseArrobas: Number(lot.purchaseArrobas || 0),
      currentArrobas: Number(lot.currentArrobas || 0),
      entryDate: lot.entryDate || ""
    },
    animals,
    recentLotWeighings,
    conversion: {
      basis: "live_weight",
      liveArrobaKg: 30
    }
  };
}

function animalContextForVision(db, animalId) {
  const animal = db.animals.find((item) => item.id === animalId) || {};
  const lot = db.lots.find((item) => item.id === animal.lotId) || {};
  const weighings = (db.animalWeighings || [])
    .filter((item) => item.animalId === animalId)
    .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")))
    .slice(0, 5)
    .map((item) => ({
      date: item.date || item.createdAt,
      weightKg: Number(item.weightKg || 0),
      arrobas: Number(item.arrobas || 0),
      source: item.source || ""
    }));
  return {
    animal: {
      id: animal.id,
      tag: animal.tag,
      code: animal.code,
      currentArrobas: Number(animal.currentArrobas || 0),
      currentWeightKg: Number(animal.currentWeightKg || 0),
      lastWeighingDate: animal.lastWeighingDate || ""
    },
    lot: {
      id: lot.id,
      name: lot.name,
      quantity: Number(lot.quantity || 0),
      purchaseArrobas: Number(lot.purchaseArrobas || 0),
      currentArrobas: Number(lot.currentArrobas || 0),
      entryDate: lot.entryDate || ""
    },
    recentWeighings: weighings,
    conversion: {
      basis: "live_weight",
      liveArrobaKg: 30
    }
  };
}

function outputTextFromResponse(payload) {
  if (payload.output_text) return payload.output_text;
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("\n")
    .trim();
}

function parseJsonObject(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta da IA não trouxe JSON.");
  return JSON.parse(match[0]);
}

function visualEvidenceItems({ imageDataUrl, imageDataUrls }) {
  const urls = [];
  if (Array.isArray(imageDataUrls)) urls.push(...imageDataUrls);
  if (imageDataUrl) urls.push(imageDataUrl);
  const unique = [...new Set(urls)].filter((url) => String(url || "").startsWith("data:image/")).slice(0, 20);
  if (!unique.length) {
    const error = new Error("Envie ao menos uma foto ou frame de vídeo válido.");
    error.status = 400;
    throw error;
  }
  return unique.map((url) => ({ type: "input_image", image_url: url, detail: "high" }));
}

function visionModel() {
  return process.env.OPENAI_VISION_MODEL || "gpt-4.1";
}

async function callOpenAiVisionJson(prompt, visualItems) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: visionModel(),
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...visualItems
        ]
      }]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || "Falha ao chamar a OpenAI.");
    error.status = response.status;
    throw error;
  }
  return parseJsonObject(outputTextFromResponse(payload));
}

function referenceWeightKgForContext(context, db, mode) {
  const conversion = context?.conversion || db.settings;
  const pv = (arrobas) => Number(arrobas || 0) * Number(conversion.liveArrobaKg || 30);
  if (mode === "animal") {
    if (Number(context.animal?.currentWeightKg || 0) > 0) return Number(context.animal.currentWeightKg);
    if (Number(context.animal?.currentArrobas || 0) > 0) return pv(context.animal.currentArrobas);
    const recent = (context.recentWeighings || []).find((item) => Number(item.weightKg || 0) > 0);
    if (recent) return Number(recent.weightKg);
  }
  const recentLot = (context.recentLotWeighings || []).find((item) => Number(item.averageWeightKg || 0) > 0);
  if (recentLot) return Number(recentLot.averageWeightKg);
  const animalWeights = (context.animals || []).map((item) => Number(item.currentWeightKg || 0)).filter((value) => value > 0);
  if (animalWeights.length) return animalWeights.reduce((sum, value) => sum + value, 0) / animalWeights.length;
  if (Number(context.lot?.currentArrobas || 0) > 0) return pv(context.lot.currentArrobas);
  if (Number(context.lot?.purchaseArrobas || 0) > 0) return pv(context.lot.purchaseArrobas);
  return 0;
}

function plausibilityForWeight(estimatedWeightKg, context, db, mode) {
  const referenceWeightKg = referenceWeightKgForContext(context, db, mode);
  if (!referenceWeightKg || !estimatedWeightKg) {
    return { status: "ok", referenceWeightKg: 0, ratio: 0, reason: "" };
  }
  const ratio = estimatedWeightKg / referenceWeightKg;
  const status = ratio < 0.72 || ratio > 1.45 ? "review" : "ok";
  const reason = status === "review"
    ? `Estimativa ${Math.round(estimatedWeightKg)} kg diverge da referência operacional ${Math.round(referenceWeightKg)} kg. Revise frames, ângulo e categoria antes de gravar.`
    : "";
  return { status, referenceWeightKg, ratio, reason };
}

async function estimateWeightFromPhoto({ imageDataUrl, imageDataUrls, animalId, notes, evidenceSummary }, db) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      status: "missing_api_key",
      detail: "Configure OPENAI_API_KEY no ambiente do servidor para ativar a pesagem por foto.",
      context: animalContextForVision(db, animalId)
    };
  }
  const visualItems = visualEvidenceItems({ imageDataUrl, imageDataUrls });

  const context = animalContextForVision(db, animalId);
  const prompt = [
    "Você é um avaliador técnico de bovinos de corte no Brasil.",
    "Estime o peso vivo em kg do animal usando todas as evidências visuais enviadas: fotos e frames extraídos de vídeos.",
    "Quando houver múltiplas evidências, priorize consistência entre ângulos laterais, traseiros e frontais, porte, profundidade corporal, escore corporal e proporção com objetos/animais próximos.",
    "A estimativa final deve ser visual. Use o contexto operacional somente como calibração secundária; não reduza nem aumente a estimativa apenas para coincidir com peso cadastrado, peso anterior ou expectativa do lote.",
    "Se a evidência visual indicar peso muito diferente do cadastro, mantenha a estimativa visual e explique a divergência em warnings.",
    "Estime sempre peso vivo em kg; o sistema converterá para arroba viva usando 1@ = 30 kg.",
    "Retorne apenas JSON válido, sem markdown, com os campos:",
    '{"estimatedWeightKg": number, "confidence": "baixa|media|alta", "minWeightKg": number, "maxWeightKg": number, "reasoning": string, "warnings": string[]}',
    "Se as evidências não permitirem avaliar o animal, use confidence baixa e explique em warnings.",
    evidenceSummary ? `Resumo das evidências: ${evidenceSummary}` : "",
    `Contexto: ${JSON.stringify(context)}`,
    notes ? `Observações do operador: ${notes}` : ""
  ].filter(Boolean).join("\n");

  let parsed = await callOpenAiVisionJson(prompt, visualItems);
  let estimatedWeightKg = Number(parsed.estimatedWeightKg || 0);
  let plausibility = plausibilityForWeight(estimatedWeightKg, context, db, "animal");
  if (plausibility.status === "review") {
    parsed = await callOpenAiVisionJson([
      prompt,
      "REAVALIAÇÃO OBRIGATÓRIA:",
      `Sua primeira estimativa foi ${Math.round(estimatedWeightKg)} kg, mas a referência operacional é ${Math.round(plausibility.referenceWeightKg)} kg.`,
      "Reavalie os frames com foco em escala corporal, profundidade, comprimento, garupa, categoria e ângulo.",
      "Não copie a referência operacional. Corrija apenas se a evidência visual sustentar. Se mantiver divergência grande, explique objetivamente nos warnings."
    ].join("\n"), visualItems);
    estimatedWeightKg = Number(parsed.estimatedWeightKg || 0);
    plausibility = plausibilityForWeight(estimatedWeightKg, context, db, "animal");
  }
  return {
    status: "ok",
    model: visionModel(),
    estimatedWeightKg,
    estimatedArrobas: arrobaFromPv(estimatedWeightKg, db),
    confidence: parsed.confidence || "baixa",
    minWeightKg: Number(parsed.minWeightKg || 0),
    maxWeightKg: Number(parsed.maxWeightKg || 0),
    reasoning: parsed.reasoning || "",
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    plausibility,
    context
  };
}

async function estimateLotWeightFromPhoto({ imageDataUrl, imageDataUrls, lotId, notes, quantityEvaluated, evidenceSummary }, db) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      status: "missing_api_key",
      detail: "Configure OPENAI_API_KEY no ambiente do servidor para ativar a pesagem de lote por foto.",
      context: lotContextForVision(db, lotId)
    };
  }
  const visualItems = visualEvidenceItems({ imageDataUrl, imageDataUrls });

  const context = lotContextForVision(db, lotId);
  const prompt = [
    "Você é um avaliador técnico de bovinos de corte no Brasil.",
    "As evidências podem conter várias fotos e frames extraídos de vídeos do mesmo lote. Estime o peso vivo médio do lote, não o peso de um animal isolado.",
    "Considere porte visual, homogeneidade do lote, condição corporal, categoria, contexto histórico, quantidade avaliada informada e variação entre animais.",
    "Não tente identificar brincos individualmente neste modo; este modo é uma estimativa média coletiva.",
    "A estimativa final deve ser visual. Use o histórico do lote apenas como calibração secundária; não puxe o resultado para o peso atual cadastrado se as evidências mostrarem animais maiores ou menores.",
    "Se houver animais de tamanhos distintos no vídeo, estime a média ponderada dos animais visíveis e explique a dispersão.",
    "Estime sempre peso vivo médio em kg; o sistema converterá para arroba viva usando 1@ = 30 kg.",
    "Retorne apenas JSON válido, sem markdown, com os campos:",
    '{"averageWeightKg": number, "confidence": "baixa|media|alta", "minAverageWeightKg": number, "maxAverageWeightKg": number, "visibleAnimals": number, "reasoning": string, "warnings": string[]}',
    "Se as evidências não permitirem avaliação confiável, use confidence baixa e explique em warnings.",
    `Quantidade informada pelo operador: ${quantityEvaluated || context.lot.quantity || "não informada"}`,
    evidenceSummary ? `Resumo das evidências: ${evidenceSummary}` : "",
    `Contexto: ${JSON.stringify(context)}`,
    notes ? `Observações do operador: ${notes}` : ""
  ].filter(Boolean).join("\n");

  let parsed = await callOpenAiVisionJson(prompt, visualItems);
  let averageWeightKg = Number(parsed.averageWeightKg || 0);
  let plausibility = plausibilityForWeight(averageWeightKg, context, db, "lot");
  if (plausibility.status === "review") {
    parsed = await callOpenAiVisionJson([
      prompt,
      "REAVALIAÇÃO OBRIGATÓRIA:",
      `Sua primeira estimativa média foi ${Math.round(averageWeightKg)} kg, mas a referência operacional do lote é ${Math.round(plausibility.referenceWeightKg)} kg.`,
      "Reavalie os frames com foco em média ponderada dos animais visíveis, escala, categoria, comprimento, profundidade corporal e homogeneidade.",
      "Não copie a referência operacional. Corrija apenas se a evidência visual sustentar. Se mantiver divergência grande, explique objetivamente nos warnings."
    ].join("\n"), visualItems);
    averageWeightKg = Number(parsed.averageWeightKg || 0);
    plausibility = plausibilityForWeight(averageWeightKg, context, db, "lot");
  }
  return {
    status: "ok",
    model: visionModel(),
    averageWeightKg,
    averageArrobas: arrobaFromPv(averageWeightKg, db),
    confidence: parsed.confidence || "baixa",
    minAverageWeightKg: Number(parsed.minAverageWeightKg || 0),
    maxAverageWeightKg: Number(parsed.maxAverageWeightKg || 0),
    visibleAnimals: Number(parsed.visibleAnimals || 0),
    reasoning: parsed.reasoning || "",
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    plausibility,
    context
  };
}

function allocatedExpenseForLot(db, expense, lot) {
  const amount = Number(expense.amount || 0);
  const selectedLotIds = Array.isArray(expense.lotIds) ? expense.lotIds.filter(Boolean) : expense.lotId ? [expense.lotId] : [];
  const lotWasActiveForExpense = (item) => {
    if (!item?.id) return false;
    if (!expense?.date || !item.entryDate) return true;
    return String(item.entryDate) <= String(expense.date);
  };
  if ((expense.allocationMode === "specific_lot" || expense.allocationMode === "specific_lots") && selectedLotIds.includes(lot.id)) {
    const selectedHeads = db.lots
      .filter((item) => selectedLotIds.includes(item.id))
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return selectedHeads ? amount * (Number(lot.quantity || 0) / selectedHeads) : 0;
  }
  if (!lotWasActiveForExpense(lot)) return 0;
  if (expense.allocationMode === "all_lots_by_headcount" || (!selectedLotIds.length && expense.allocationMode !== "specific_lots" && expense.allocationMode !== "specific_lot")) {
    const totalHeads = db.lots
      .filter((item) => lotWasActiveForExpense(item))
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return totalHeads ? amount * (Number(lot.quantity || 0) / totalHeads) : 0;
  }
  return 0;
}

function allocatedExpensesForLot(db, lot) {
  if (!lot?.id) return 0;
  return db.expenses.reduce((sum, expense) => sum + allocatedExpenseForLot(db, expense, lot), 0);
}

function normalizeExpense(record) {
  record.lotIds = Array.isArray(record.lotIds) ? record.lotIds.filter(Boolean) : record.lotIds ? [record.lotIds] : record.lotId ? [record.lotId] : [];
  record.allocationMode = record.allocationMode || (record.lotIds.length ? "specific_lots" : "all_lots_by_headcount");
  if (record.allocationMode === "specific_lot") record.allocationMode = "specific_lots";
  if (record.allocationMode === "all_lots_by_headcount") {
    record.lotIds = [];
    record.lotId = "";
  } else {
    record.lotId = record.lotIds[0] || "";
  }
  return record;
}

function validateRestoredDb(payload) {
  const requiredArrays = ["lots", "expenses", "pastures", "supplements", "marketQuotes", "users"];
  for (const key of requiredArrays) {
    if (!Array.isArray(payload?.[key])) {
      const error = new Error(`Backup inválido: campo ${key} ausente.`);
      error.status = 400;
      throw error;
    }
  }
  if (!payload.settings || typeof payload.settings !== "object") {
    const error = new Error("Backup inválido: configurações ausentes.");
    error.status = 400;
    throw error;
  }
}

function recomputeMonthlyCloses(db) {
  const grouped = new Map();
  for (const quote of db.marketQuotes) {
    if (!quote.date || !quote.arrobaPrice) continue;
    const month = quote.date.slice(0, 7);
    const key = `${month}|${quote.source || ""}|${quote.region || ""}|${quote.animalSex || "mixed"}`;
    const current = grouped.get(key);
    if (!current || quote.date > current.closeDate) {
      grouped.set(key, {
        id: `close_${month}_${String(quote.source || "manual").replace(/\W+/g, "_")}_${String(quote.region || "geral").replace(/\W+/g, "_")}`,
        month: `${month}-01`,
        source: quote.source || "Manual",
        region: quote.region || "",
        animalSex: quote.animalSex || "mixed",
        closeDate: quote.date,
        closePrice: Number(quote.arrobaPrice),
        quoteId: quote.id
      });
    }
  }
  db.marketMonthlyCloses = Array.from(grouped.values()).sort((a, b) => b.month.localeCompare(a.month));
  return db.marketMonthlyCloses;
}

function riskScore(db, horizonDays = 120) {
  const horizonMonths = Math.max(1, horizonDays / 30);
  const activeFactors = db.riskFactors.filter((factor) => Number(factor.horizonMonths || 0) >= horizonMonths * 0.5);
  const weighted = activeFactors.map((factor) => {
    const directionMultiplier = factor.direction === "positivo" ? -1 : factor.direction === "neutro" ? 0.5 : 1;
    return Number(factor.impact || 0) * Number(factor.probability || 0) * directionMultiplier;
  });
  const raw = weighted.reduce((sum, item) => sum + item, 0);
  const max = Math.max(1, activeFactors.length * 25);
  const normalized = Math.max(0, Math.min(100, (raw / max) * 100));
  const latestCycle = db.cycleSignals.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0] || null;
  return {
    score: normalized,
    level: normalized >= 70 ? "alto" : normalized >= 40 ? "medio" : "baixo",
    factorCount: activeFactors.length,
    latestCycle,
    factors: activeFactors
  };
}

function intelligenceInsights(db, horizonDays = 120) {
  const risk = riskScore(db, horizonDays);
  const latestQuote = db.marketQuotes.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0] || null;
  const latestClose = db.marketMonthlyCloses?.[0] || null;
  const cdi = db.financialIndicators.find((item) => item.code === "CDI_ANNUAL" && item.source?.includes("BCB")) || db.financialIndicators.find((item) => item.code === "CDI_ANNUAL");
  const ipca = db.financialIndicators.find((item) => item.code === "IPCA_12M" && item.source?.includes("BCB")) || db.financialIndicators.find((item) => item.code === "IPCA_12M");
  const cycle = risk.latestCycle;
  const insights = [
    {
      title: "Ciclo pecuário",
      severity: "atenção",
      text: cycle?.notes || "Sem sinal de ciclo calibrado.",
      decisionUse: "Penaliza retenções longas quando reposição está cara e margem curta."
    },
    {
      title: "Preço da arroba",
      severity: latestQuote ? "ok" : "atenção",
      text: latestQuote ? `Última cotação disponível: R$ ${Number(latestQuote.arrobaPrice).toFixed(2)}/@ em ${latestQuote.date}.` : "Sem cotação diária importada.",
      decisionUse: "Serve como preço atual e base de projeção para venda futura."
    },
    {
      title: "Fechamento mensal",
      severity: latestClose ? "ok" : "atenção",
      text: latestClose ? `Fechamento ${latestClose.month}: R$ ${Number(latestClose.closePrice).toFixed(2)}/@ em ${latestClose.closeDate}.` : "Ainda sem fechamento mensal calculado.",
      decisionUse: "Usado para análise de ciclo sem poluir a tela com toda a série histórica."
    },
    {
      title: "Custo de oportunidade",
      severity: cdi ? "ok" : "atenção",
      text: cdi ? `CDI de referência: ${(Number(cdi.value) * 100).toFixed(2)}% a.a.` : "CDI ainda manual ou ausente.",
      decisionUse: "Toda compra de animal deve superar o capital aplicado a 100% do CDI no mesmo prazo."
    },
    {
      title: "Inflação",
      severity: ipca ? "ok" : "atenção",
      text: ipca ? `IPCA de referência: ${(Number(ipca.value) * 100).toFixed(2)}% em 12m.` : "IPCA ainda manual ou ausente.",
      decisionUse: "Ajuda a avaliar lucro real, não só lucro nominal."
    }
  ];
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      marketRiskLevel: risk.level,
      marketRiskScore: risk.score,
      cyclePhase: cycle?.phase || "indefinido",
      latestArrobaPrice: latestQuote?.arrobaPrice || null,
      cdiAnnualRate: cdi?.value || db.settings.cdiAnnualRate,
      ipcaAnnualRate: ipca?.value || db.settings.ipcaAnnualRate
    },
    insights,
    signals: {
      cycle,
      monitoredFactors: risk.factors,
      latestQuote,
      latestClose,
      cdi,
      ipca
    },
    nextDataToFetch: [
      "Série CEPEA diária/mensal oficial completa",
      "Dados climáticos por região da fazenda",
      "Notícias geopolíticas/exportação com classificação automática",
      "Indicadores de reposição: bezerro, boi magro e relação troca"
    ]
  };
}

function cycleBias(phase) {
  const normalized = String(phase || "").toLowerCase();
  if (normalized.includes("alta") && !normalized.includes("baixa_para_alta")) return "favor_segurar";
  if (normalized.includes("transicao_baixa_para_alta")) return "cautela_alta";
  if (normalized.includes("baixa")) return "favor_vender";
  if (normalized.includes("descarte")) return "cautela_compra";
  if (normalized.includes("expansao")) return "neutro";
  return "neutro";
}

function decideOperation({ now, future, target, comparisonDays, gmdKgDay, feedCostDay, risk, cycle }) {
  const incrementalProfit = future.profitPerHead - now.profitPerHead;
  const incrementalProfitPct = now.profitPerHead > 0 ? incrementalProfit / now.profitPerHead : incrementalProfit > 0 ? 1 : -1;
  const incrementalRevenue = future.revenuePerHead - now.revenuePerHead;
  const incrementalCost = future.feedCostAccumulated + future.operatingCostAccumulated + (future.landOwnCostAccumulated || 0);
  const incrementalCostRatio = incrementalRevenue > 0 ? incrementalCost / incrementalRevenue : 1;
  const targetProfit = Number(target?.profitPerHead || 0);
  const targetBeatsNow = targetProfit > now.profitPerHead;
  const targetProfitable = targetProfit > 0;
  const cycleDecisionBias = cycleBias(cycle?.phase);
  const marginGoodNow = now.margin >= 0.2;
  const upsideRelevant = incrementalProfitPct >= 0.15;
  const highMarketRisk = risk.level === "alto";
  const longOrRisky = comparisonDays > 120 || highMarketRisk;
  const goodGmd = gmdKgDay >= 0.5;
  const cheapIncrementalGain = incrementalCostRatio <= 0.45;

  let action = "sell_now";
  let holdDays = 0;
  let reason = "Giro e proteção de capital dominam o ganho incremental.";

  if (now.profitPerHead < 0 && targetProfitable && targetBeatsNow) {
    action = "hold_target";
    holdDays = Math.round(target.days || comparisonDays);
    reason = "Venda agora realiza prejuízo; a meta completa ainda gera lucro econômico.";
  } else if (future.profitPerHead <= 0 && targetProfitable && targetBeatsNow) {
    action = "hold_target";
    holdDays = Math.round(target.days || comparisonDays);
    reason = "O curto prazo ainda não fecha, mas levar até a meta gera lucro econômico.";
  } else if (future.profitPerHead <= 0) {
    action = "sell_now";
    reason = "Cenário futuro não gera lucro econômico suficiente.";
  } else if (marginGoodNow && (longOrRisky || !upsideRelevant)) {
    action = "sell_now";
    reason = "Margem atual já é boa e o ganho adicional não compensa prazo/risco.";
  } else if (cycleDecisionBias === "favor_vender" || cycleDecisionBias === "cautela_compra") {
    action = "sell_now";
    reason = "Fase do ciclo penaliza retenção longa e compra/reposição cara.";
  } else if (goodGmd && cheapIncrementalGain && upsideRelevant && !highMarketRisk) {
    action = "hold";
    holdDays = Math.round(Math.min(Math.max(30, comparisonDays), 60));
    reason = "GMD, custo incremental e upside justificam segurar por prazo curto.";
  } else if (cycleDecisionBias === "cautela_alta" && upsideRelevant && comparisonDays <= 90 && goodGmd) {
    action = "hold";
    holdDays = Math.round(Math.min(Math.max(30, comparisonDays), 60));
    reason = "Transição para alta permite capturar upside, mas só com giro curto.";
  }

  return {
    action,
    finalDecision: action === "hold_target" ? `Segurar até a meta (${holdDays} dias)` : action === "hold" ? `Segurar por ${holdDays} dias` : "Vender agora",
    holdDays,
    reason,
    incrementalProfitPerHead: incrementalProfit,
    incrementalProfitPct,
    incrementalCostRatio,
    cycleDecisionBias,
    dominates: action === "hold" || action === "hold_target" ? "venda_futura" : "venda_agora"
  };
}

function latestBenchmarkDate(benchmark) {
  return new Date(benchmark.date || "1900-01-01").getTime() || 0;
}

function selectMarketCostBenchmark(db) {
  const benchmarks = [...(db.marketCostBenchmarks || [])].filter((item) => Number(item.value || 0) > 0);
  if (!benchmarks.length) return null;
  return benchmarks.sort((a, b) => {
    const dateDelta = latestBenchmarkDate(b) - latestBenchmarkDate(a);
    if (dateDelta) return dateDelta;
    const aCot = String(a.metricType || "").includes("COT") ? 1 : 0;
    const bCot = String(b.metricType || "").includes("COT") ? 1 : 0;
    return bCot - aCot;
  })[0];
}

function compareWithMarketBenchmark(cost, benchmark) {
  if (!benchmark || !Number(benchmark.value || 0) || !Number.isFinite(cost)) {
    return {
      benchmark: null,
      difference: 0,
      differencePct: 0,
      performance: "sem referencia",
      label: "sem referencia"
    };
  }
  const benchmarkValue = Number(benchmark.value || 0);
  const difference = cost - benchmarkValue;
  const differencePct = benchmarkValue ? difference / benchmarkValue : 0;
  const performance = differencePct <= -0.05 ? "melhor" : differencePct >= 0.05 ? "pior" : "em linha";
  const label = performance === "melhor"
    ? "melhor que mercado"
    : performance === "pior"
      ? "pior que mercado"
      : "em linha com mercado";
  return { benchmark, difference, differencePct, performance, label };
}

function parseBrazilianNumber(value) {
  const text = String(value).trim();
  if (text.includes(",")) return Number(text.replace(/\./g, "").replace(",", "."));
  return Number(text);
}

function numericInput(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "string" ? parseBrazilianNumber(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumericInput(value, fallback = 0) {
  const parsed = numericInput(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

async function fetchCepeaLatestQuote() {
  const response = await fetch("https://cepea.org.br/br/indicador/boi-gordo.aspx");
  if (!response.ok) throw new Error(`CEPEA respondeu ${response.status}`);
  const html = await response.text();
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const match = text.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+[-\d,]+%\s+[-\d,]+%\s+(\d{1,3}(?:\.\d{3})*,\d{2})/);
  if (!match) throw new Error("Nao foi possivel localizar a cotacao CEPEA na pagina");
  const [day, month, year] = match[1].split("/");
  return {
    id: `cepea_${year}${month}${day}`,
    date: `${year}-${month}-${day}`,
    region: "CEPEA/ESALQ - Boi Gordo",
    animalSex: "male",
    arrobaPrice: parseBrazilianNumber(match[2]),
    usdArrobaPrice: parseBrazilianNumber(match[3]),
    source: "https://cepea.org.br/br/indicador/boi-gordo.aspx",
    notes: "Valor à vista por arroba de 15 kg, sem Funrural, conforme página pública CEPEA."
  };
}

async function fetchSgs(code, daysBack = 45) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - daysBack);
  const fmt = (date) => date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${fmt(start)}&dataFinal=${fmt(end)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`BCB SGS ${code} respondeu ${response.status}`);
  const data = await response.json();
  return data.filter((item) => item.valor !== undefined).map((item) => ({
    date: item.data.split("/").reverse().join("-"),
    value: parseBrazilianNumber(item.valor)
  }));
}

async function fetchFinancialIndicators() {
  const cdiDaily = await fetchSgs(12, 20);
  const ipcaMonthly = await fetchSgs(433, 430);
  const latestCdi = cdiDaily.at(-1);
  const last12Ipca = ipcaMonthly.slice(-12);
  if (!latestCdi) throw new Error("Nao foi possivel obter CDI no BCB SGS");
  const cdiAnnualRate = Math.pow(1 + latestCdi.value / 100, 252) - 1;
  const ipcaAnnualRate = last12Ipca.reduce((acc, item) => acc * (1 + item.value / 100), 1) - 1;
  return [
    { id: "bcb-cdi-annualized", code: "CDI_ANNUAL", name: "CDI anualizado a partir do DI diário", date: latestCdi.date, value: cdiAnnualRate, unit: "decimal a.a.", source: "BCB SGS série 12" },
    { id: "bcb-ipca-12m", code: "IPCA_12M", name: "IPCA acumulado 12 meses", date: last12Ipca.at(-1)?.date || latestCdi.date, value: ipcaAnnualRate, unit: "decimal 12m", source: "BCB SGS série 433" }
  ];
}

function simulate(input, db) {
  const lot = db.lots.find((item) => item.id === input.lotId) || input.lot || {};
  const quantity = numericInput(input.quantity, numericInput(lot.quantity, 1));
  const operationType = input.operationType === "active" || lot.id ? "active" : "purchase";
  const purchaseArrobas = numericInput(input.purchaseArrobas, numericInput(lot.purchaseArrobas, numericInput(input.currentArrobas, 0)));
  const currentArrobasInput = numericInput(input.currentArrobas, numericInput(lot.currentArrobas, purchaseArrobas));
  const currentArrobas = operationType === "purchase" ? purchaseArrobas : currentArrobasInput;
  const simulationBasis = operationType === "purchase" ? "current" : input.simulationBasis === "acquisition" ? "acquisition" : "current";
  const startArrobas = operationType === "purchase" ? purchaseArrobas : simulationBasis === "acquisition" ? purchaseArrobas : currentArrobas;
  const targetArrobas = numericInput(input.targetArrobas, 10.5);
  const gmdKgDay = numericInput(input.gmdKgDay, 0.5);
  const arrobaPrice = numericInput(input.arrobaPrice, numericInput(db.settings.arrobaPrice, 0));
  const arrobaCategory = ["male", "female", "mixed"].includes(input.arrobaCategory) ? input.arrobaCategory : "mixed";
  const purchasePricePerArroba = numericInput(input.purchasePricePerArroba, 0);
  const purchasePricePerHeadInput = numericInput(input.purchasePricePerHead, numericInput(lot.purchasePricePerHead, 0));
  const purchasePricePerHead = purchasePricePerArroba > 0 ? purchaseArrobas * purchasePricePerArroba : purchasePricePerHeadInput;
  const freightTotal = numericInput(input.freightTotal, 0);
  const legacyCommissionTotal = numericInput(input.commissionTotal, 0);
  const commissionRate = numericInput(input.commissionRate, 0);
  const animalPurchaseCapitalBase = purchasePricePerHead * quantity;
  const commissionTotal = commissionRate > 0 ? animalPurchaseCapitalBase * commissionRate : legacyCommissionTotal;
  const acquisitionLaborTotal = numericInput(input.acquisitionLaborTotal, 0);
  const initialCostsTotal = numericInput(input.initialCostsTotal, 0);
  const defaultCdiAnnualRate = positiveNumericInput(db.settings.cdiAnnualRate, 0.105);
  const defaultIpcaAnnualRate = positiveNumericInput(db.settings.ipcaAnnualRate, 0.04);
  const cdiAnnualRate = positiveNumericInput(input.cdiAnnualRate, defaultCdiAnnualRate);
  const discountRate = positiveNumericInput(input.discountRate, cdiAnnualRate);
  const mortalityRate = Math.max(0, numericInput(input.mortalityRate, 0));
  const mortalityFactor = Math.max(0, 1 - mortalityRate);
  const ipcaAnnualRate = positiveNumericInput(input.ipcaAnnualRate, defaultIpcaAnnualRate);
  const fortisPercentPv = numericInput(input.fortisPercentPv, 0.001);
  const comigoPercentPv = numericInput(input.comigoPercentPv, 0.003);
  const pastureQuality = input.pastureQuality || pastureQualityFromLot(lot);
  const technicalExpectedGmdKgDay = technicalGmdFromSupplementation({
    proteinPercentPv: fortisPercentPv,
    energyProteinPercentPv: comigoPercentPv,
    pastureQuality
  });
  const gmdValidation = gmdConsistency(gmdKgDay, technicalExpectedGmdKgDay);
  const operatingCostPerHeadDay = numericInput(input.operatingCostPerHeadDay, numericInput(db.settings.operatingCostPerHeadDay, 0));
  const landOwnCostMonth = numericInput(input.landOwnCostMonth, 0);
  const historicalCostTotal = operationType === "active" && lot.id ? allocatedExpensesForLot(db, lot) : 0;
  const historicalCostPerHead = quantity ? historicalCostTotal / quantity : 0;
  const acquisitionExtraCostsTotal = freightTotal + commissionTotal + acquisitionLaborTotal + initialCostsTotal;
  const acquisitionExtraCostPerHead = quantity ? acquisitionExtraCostsTotal / quantity : 0;
  const purchaseOutlayTotal = animalPurchaseCapitalBase + acquisitionExtraCostsTotal;
  const fortis = db.supplements.find((item) => item.id === "fortis-seca") || { costKg: 0 };
  const comigo = db.supplements.find((item) => item.id === "comigo-corte") || { costKg: 0 };

  const currentPvKg = pvFromArroba(currentArrobas, db);
  const startPvKg = pvFromArroba(startArrobas, db);
  const targetPvKg = pvFromArroba(targetArrobas, db);
  const kgToGain = Math.max(0, targetPvKg - startPvKg);
  const remainingKgToGain = Math.max(0, targetPvKg - currentPvKg);
  const remainingDays = gmdKgDay > 0 ? remainingKgToGain / gmdKgDay : 0;
  const elapsedKgGain = operationType === "purchase" ? 0 : Math.max(0, currentPvKg - pvFromArroba(purchaseArrobas, db));
  const elapsedEstimatedDays = operationType === "purchase" ? 0 : gmdKgDay > 0 ? elapsedKgGain / gmdKgDay : 0;
  const totalDays = operationType === "purchase" ? remainingDays : simulationBasis === "acquisition" ? elapsedEstimatedDays + remainingDays : remainingDays;
  const days = remainingDays;
  const avgPvKg = (currentPvKg + targetPvKg) / 2;
  const fortisKgDay = avgPvKg * fortisPercentPv;
  const comigoKgDay = avgPvKg * comigoPercentPv;
  const feedCostDay = fortisKgDay * Number(fortis.costKg || 0) + comigoKgDay * Number(comigo.costKg || 0);
  const feedCostAccumulated = feedCostDay * days;
  const fortisKgAccumulated = fortisKgDay * days * quantity;
  const comigoKgAccumulated = comigoKgDay * days * quantity;
  const fortisBags = Number(fortis.bagKg || 0) ? fortisKgAccumulated / Number(fortis.bagKg || 0) : 0;
  const comigoBags = Number(comigo.bagKg || 0) ? comigoKgAccumulated / Number(comigo.bagKg || 0) : 0;
  const operatingCostAccumulated = operatingCostPerHeadDay * days;
  const landOwnCostPerHeadDay = landOwnCostMonth / 30;
  const landOwnCostPerHeadAccumulated = landOwnCostPerHeadDay * days;
  const landOwnCostAccumulated = landOwnCostPerHeadAccumulated * quantity;
  const revenuePerHead = targetArrobas * arrobaPrice;
  const revenueTotal = revenuePerHead * quantity * mortalityFactor;
  const currentSalePrice = numericInput(input.currentSaleArrobaPrice ?? input.sellNowArrobaPrice, arrobaPrice);
  const sellNowRevenuePerHead = currentArrobas * currentSalePrice;
  const sellNowProfitPerHead = sellNowRevenuePerHead - purchasePricePerHead - historicalCostPerHead - acquisitionExtraCostPerHead;
  const sellNowProfitTotal = sellNowProfitPerHead * quantity * mortalityFactor;
  const sellNowMargin = sellNowRevenuePerHead ? sellNowProfitPerHead / sellNowRevenuePerHead : 0;
  const sellNowInvestedPerHead = purchasePricePerHead + historicalCostPerHead + acquisitionExtraCostPerHead;
  const sellNowRoi = sellNowInvestedPerHead ? sellNowProfitPerHead / sellNowInvestedPerHead : 0;
  const investedPerHead = purchasePricePerHead + historicalCostPerHead + acquisitionExtraCostPerHead + feedCostAccumulated + operatingCostAccumulated + landOwnCostPerHeadAccumulated;
  const investedTotal = investedPerHead * quantity;
  const profitPerHead = revenuePerHead - investedPerHead;
  const profitTotal = revenueTotal - investedTotal;
  const profitPerHeadEffective = quantity ? profitTotal / quantity : 0;
  const netRevenueTotal = revenueTotal - (historicalCostTotal + acquisitionExtraCostsTotal + feedCostAccumulated * quantity + operatingCostAccumulated * quantity + landOwnCostAccumulated);
  const margin = revenuePerHead ? profitPerHead / revenuePerHead : 0;
  const roi = investedTotal ? profitTotal / investedTotal : 0;
  const roiMonthly = days > 0 ? roi / Math.max(1, days / 30) : roi;
  const irrMonths = Math.max(1, Math.ceil(days / 30));
  const monthlyFutureCostTotal = (feedCostDay + operatingCostPerHeadDay + landOwnCostPerHeadDay) * quantity * 30;
  const irrCashFlows = [-purchaseOutlayTotal - historicalCostTotal];
  for (let month = 1; month <= irrMonths; month += 1) {
    const monthStartDay = (month - 1) * 30;
    const activeDaysInMonth = Math.max(0, Math.min(30, days - monthStartDay));
    const periodCost = activeDaysInMonth > 0 ? monthlyFutureCostTotal * (activeDaysInMonth / 30) : 0;
    irrCashFlows.push(month === irrMonths ? revenueTotal - periodCost : -periodCost);
  }
  const irrMonthly = internalRateOfReturn(irrCashFlows);
  const irrAnnual = irrMonthly === null ? null : Math.pow(1 + irrMonthly, 12) - 1;
  const animalPurchaseCapital = animalPurchaseCapitalBase;
  const cdiAccumulatedRate = Math.pow(1 + cdiAnnualRate, days / 365) - 1;
  const operationAccumulatedRate = roi;
  const cdiReferenceCapital = investedTotal;
  const cdiGrossReturn = cdiReferenceCapital * cdiAccumulatedRate;
  const cdiOnPurchaseCapital = purchaseOutlayTotal * cdiAccumulatedRate;
  const operationVsPurchaseCapitalCdiAmount = profitTotal - cdiOnPurchaseCapital;
  const discountAccumulatedRate = Math.pow(1 + discountRate, days / 365) - 1;
  const cdiEndingCapital = cdiReferenceCapital + cdiGrossReturn;
  const operationEndingCapital = investedTotal + profitTotal;
  const operationVsCdiAmount = profitTotal - cdiGrossReturn;
  const operationVsCdi = operationAccumulatedRate - cdiAccumulatedRate;
  const realProfitPerHead = profitPerHead / Math.pow(1 + ipcaAnnualRate, days / 365);
  const producedArrobas = Math.max(0, targetArrobas - startArrobas);
  const futureProducedArrobas = Math.max(0, targetArrobas - currentArrobas);
  const feedCostPerProducedArroba = futureProducedArrobas ? feedCostAccumulated / futureProducedArrobas : 0;
  const productionCostPerProducedArroba = futureProducedArrobas ? (feedCostAccumulated + operatingCostAccumulated + landOwnCostPerHeadAccumulated) / futureProducedArrobas : 0;
  const totalProductionCostPerProducedArroba = producedArrobas ? (historicalCostPerHead + acquisitionExtraCostPerHead + feedCostAccumulated + operatingCostAccumulated + landOwnCostPerHeadAccumulated) / producedArrobas : 0;
  const totalCostPerSoldArroba = targetArrobas ? investedPerHead / targetArrobas : 0;
  const acquisitionCostPerArroba = purchaseArrobas ? purchasePricePerHead / purchaseArrobas : 0;
  const landOwnCostPerProducedArroba = futureProducedArrobas ? landOwnCostPerHeadAccumulated / futureProducedArrobas : 0;
  const supplementCostPerProducedArroba = futureProducedArrobas ? feedCostAccumulated / futureProducedArrobas : 0;
  const directFutureCostPerHead = feedCostAccumulated + operatingCostAccumulated + landOwnCostPerHeadAccumulated;
  const marketCostBenchmark = selectMarketCostBenchmark(db);
  const marketCostComparison = compareWithMarketBenchmark(totalCostPerSoldArroba, marketCostBenchmark);
  const breakEvenArrobaPrice = targetArrobas ? investedPerHead / targetArrobas : 0;
  const variableCostPerHeadToTarget = historicalCostPerHead + acquisitionExtraCostPerHead + feedCostAccumulated + operatingCostAccumulated + landOwnCostPerHeadAccumulated;
  const purchaseCeilingPerHead = Math.max(0, revenuePerHead * mortalityFactor - variableCostPerHeadToTarget);
  const purchaseCeilingPerArroba = purchaseArrobas ? purchaseCeilingPerHead / purchaseArrobas : 0;
  const paybackDays = profitTotal > 0 && days > 0 ? Math.min(days, investedTotal / (profitTotal / days)) : null;
  const stressArrobaPrice = arrobaPrice * 0.9;
  const stressGmdKgDay = gmdKgDay * 0.8;
  const stressDays = stressGmdKgDay > 0 ? remainingKgToGain / stressGmdKgDay : days;
  const stressFeedCostAccumulated = feedCostDay * stressDays;
  const stressRevenueTotal = targetArrobas * stressArrobaPrice * quantity * Math.max(0, 1 - Math.max(mortalityRate, 0.02));
  const stressLandOwnCostPerHeadAccumulated = (landOwnCostMonth / 30) * stressDays;
  const stressLandOwnCostAccumulated = stressLandOwnCostPerHeadAccumulated * quantity;
  const stressInvestedTotal = (purchasePricePerHead + historicalCostPerHead + acquisitionExtraCostPerHead + stressFeedCostAccumulated + operatingCostPerHeadDay * stressDays + stressLandOwnCostPerHeadAccumulated) * quantity;
  const stressProfitTotal = stressRevenueTotal - stressInvestedTotal;
  const purchaseGapPerHead = purchaseCeilingPerHead - purchasePricePerHead;
  const minimumAttractivenessSpread = 0.05;
  const operationBeatsCdi = operationVsCdi >= minimumAttractivenessSpread;
  const stressProfitable = stressProfitTotal >= 0;
  const purchaseRecommendation = purchasePricePerHead <= 0
    ? "Informar preço de compra"
    : purchaseGapPerHead >= 0 && stressProfitable && operationBeatsCdi
      ? "Comprar"
      : purchaseGapPerHead >= 0 && stressProfitable
        ? "Comprar com cautela: ROI pouco acima do CDI"
        : purchaseGapPerHead >= 0
        ? "Comprar com cautela"
        : `Comprar só até R$ ${purchaseCeilingPerHead.toFixed(2)}/cab`;
  const risk = riskScore(db, days);
  const timeRisk = days === 0 ? "venda_imediata" : days <= 60 ? "baixo" : days <= 120 ? "medio" : "alto";
  const combinedRisk = risk.level === "alto" || timeRisk === "alto" ? "alto" : risk.level === "medio" || timeRisk === "medio" ? "medio" : "baixo";
  const comparisonDays = Math.min(days || 60, 60);
  const comparisonTargetPvKg = currentPvKg + gmdKgDay * comparisonDays;
  const comparisonTargetArrobas = arrobaFromPv(comparisonTargetPvKg, db);
  const comparisonAvgPvKg = (currentPvKg + comparisonTargetPvKg) / 2;
  const comparisonFortisKgDay = comparisonAvgPvKg * fortisPercentPv;
  const comparisonComigoKgDay = comparisonAvgPvKg * comigoPercentPv;
  const comparisonFeedCostDay = comparisonFortisKgDay * Number(fortis.costKg || 0) + comparisonComigoKgDay * Number(comigo.costKg || 0);
  const comparisonFeedCostAccumulated = comparisonFeedCostDay * comparisonDays;
  const comparisonOperatingCostAccumulated = operatingCostPerHeadDay * comparisonDays;
  const comparisonLandOwnCostPerHeadAccumulated = (landOwnCostMonth / 30) * comparisonDays;
  const comparisonLandOwnCostAccumulated = comparisonLandOwnCostPerHeadAccumulated * quantity;
  const comparisonRevenuePerHead = comparisonTargetArrobas * arrobaPrice;
  const comparisonProfitPerHead = comparisonRevenuePerHead - purchasePricePerHead - historicalCostPerHead - acquisitionExtraCostPerHead - comparisonFeedCostAccumulated - comparisonOperatingCostAccumulated - comparisonLandOwnCostPerHeadAccumulated;
  const comparisonMargin = comparisonRevenuePerHead ? comparisonProfitPerHead / comparisonRevenuePerHead : 0;
  const comparisonInvestedPerHead = purchasePricePerHead + historicalCostPerHead + acquisitionExtraCostPerHead + comparisonFeedCostAccumulated + comparisonOperatingCostAccumulated + comparisonLandOwnCostPerHeadAccumulated;
  const comparisonRoi = comparisonInvestedPerHead ? comparisonProfitPerHead / comparisonInvestedPerHead : 0;
  const decision = decideOperation({
    now: {
      revenuePerHead: sellNowRevenuePerHead,
      profitPerHead: sellNowProfitPerHead,
      margin: sellNowMargin
    },
    future: {
      revenuePerHead: comparisonRevenuePerHead,
      profitPerHead: comparisonProfitPerHead,
      margin: comparisonMargin,
      feedCostAccumulated: comparisonFeedCostAccumulated,
      operatingCostAccumulated: comparisonOperatingCostAccumulated,
      landOwnCostAccumulated: comparisonLandOwnCostPerHeadAccumulated
    },
    target: {
      revenuePerHead,
      profitPerHead,
      margin,
      roi,
      days
    },
    comparisonDays,
    gmdKgDay,
    feedCostDay,
    risk,
    cycle: risk.latestCycle
  });

  return {
    lotId: lot.id || null,
    lotName: lot.name || input.scenarioName || "Simulação avulsa",
    operationType,
    quantity,
    simulationBasis,
    startArrobas,
    currentArrobas,
    targetArrobas,
    currentPvKg,
    startPvKg,
    targetPvKg,
    kgToGain,
    remainingKgToGain,
    gmdKgDay,
    technicalExpectedGmdKgDay,
    pastureQuality,
    gmdValidation,
    days,
    totalDays,
    remainingDays,
    elapsedEstimatedDays,
    fortisKgDay,
    comigoKgDay,
    feedCostDay,
    feedCostMonth: feedCostDay * 30,
    feedCostAccumulated,
    fortisKgAccumulated,
    comigoKgAccumulated,
    fortisBags,
    comigoBags,
    operatingCostPerHeadDay,
    operatingCostAccumulated,
    landOwnCostMonth,
    landOwnCostAccumulated,
    landOwnCostPerHeadDay,
    landOwnCostPerHeadAccumulated,
    revenuePerHead,
    revenueTotal,
    netRevenueTotal,
    arrobaPrice,
    arrobaCategory,
    purchasePricePerHead,
    purchasePricePerArroba,
    purchaseArrobas,
    freightTotal,
    commissionRate,
    commissionTotal,
    acquisitionLaborTotal,
    initialCostsTotal,
    acquisitionExtraCostsTotal,
    acquisitionExtraCostPerHead,
    purchaseOutlayTotal,
    historicalCostTotal,
    historicalCostPerHead,
    profitPerHead,
    profitPerHeadEffective,
    profitTotal,
    margin,
    roi,
    roiMonthly,
    irrMonthly,
    irrAnnual,
    irrCashFlows,
    cdiAnnualRate,
    discountRate,
    mortalityRate,
    mortalityFactor,
    ipcaAnnualRate,
    animalPurchaseCapital,
    investedTotal,
    cdiReferenceCapital,
    cdiAccumulatedRate,
    operationAccumulatedRate,
    cdiGrossReturn,
    cdiOnPurchaseCapital,
    operationVsPurchaseCapitalCdiAmount,
    discountAccumulatedRate,
    cdiEndingCapital,
    operationEndingCapital,
    operationVsCdi,
    operationVsCdiAmount,
    realProfitPerHead,
    producedArrobas,
    futureProducedArrobas,
    acquisitionCostPerArroba,
    directFutureCostPerHead,
    feedCostPerProducedArroba,
    supplementCostPerProducedArroba,
    landOwnCostPerProducedArroba,
    productionCostPerProducedArroba,
    totalProductionCostPerProducedArroba,
    totalCostPerSoldArroba,
    marketCostBenchmark,
    marketCostComparison,
    breakEvenArrobaPrice,
    purchaseCeilingPerHead,
    purchaseCeilingPerArroba,
    purchaseGapPerHead,
    purchaseRecommendation,
    minimumAttractivenessSpread,
    operationBeatsCdi,
    paybackDays,
    stressScenario: {
      arrobaPrice: stressArrobaPrice,
      gmdKgDay: stressGmdKgDay,
      days: stressDays,
      profitTotal: stressProfitTotal,
      margin: stressRevenueTotal ? stressProfitTotal / stressRevenueTotal : 0,
      landOwnCostAccumulated: stressLandOwnCostAccumulated
    },
    sellNowScenario: {
      arrobas: currentArrobas,
      arrobaPrice: currentSalePrice,
      revenuePerHead: sellNowRevenuePerHead,
      revenueTotal: sellNowRevenuePerHead * quantity,
      profitPerHead: sellNowProfitPerHead,
      profitTotal: sellNowProfitTotal,
      margin: sellNowMargin,
      roi: sellNowRoi
    },
    futureComparisonScenario: {
      days: comparisonDays,
      arrobas: comparisonTargetArrobas,
      revenuePerHead: comparisonRevenuePerHead,
      feedCostAccumulated: comparisonFeedCostAccumulated,
      landOwnCostAccumulated: comparisonLandOwnCostAccumulated,
      profitPerHead: comparisonProfitPerHead,
      profitTotal: comparisonProfitPerHead * quantity,
      margin: comparisonMargin,
      roi: comparisonRoi
    },
    decision,
    timeRisk,
    marketRisk: risk,
    risk: days === 0 ? "venda_imediata" : combinedRisk,
    recommendation: operationType === "purchase" ? purchaseRecommendation : decision.finalDecision
  };
}

function pricePayment(principal, monthlyRate, months) {
  if (months <= 0) return 0;
  if (monthlyRate <= 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

function impliedPriceRate(principal, payment, months) {
  if (principal <= 0 || payment <= 0 || months <= 0) return 0;
  if (payment <= principal / months) return 0;
  let low = 0;
  let high = 1;
  for (let index = 0; index < 80; index += 1) {
    const mid = (low + high) / 2;
    if (pricePayment(principal, mid, months) > payment) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

function simulateLoan(input, db) {
  const operation = simulate(input.operation || {}, db);
  const financedPercent = clamp(numericInput(input.financedPercent, 80), 0, 100) / 100;
  const requestedPrincipal = numericInput(input.loanPrincipal, 0);
  const basePrincipal = requestedPrincipal > 0 ? requestedPrincipal : Number(operation.purchaseOutlayTotal || 0) * financedPercent;
  const principal = Math.min(Math.max(0, basePrincipal), Number(operation.investedTotal || basePrincipal || 0));
  const monthlyRate = Math.max(0, numericInput(input.monthlyInterestRate, 0) / 100);
  const quotedMonthlyPayment = Math.max(0, numericInput(input.quotedMonthlyPayment, 0));
  const termMonths = Math.max(1, Math.round(numericInput(input.termMonths, 12)));
  const graceMonths = Math.max(0, Math.min(termMonths, Math.round(numericInput(input.graceMonths, 0))));
  const feeRate = Math.max(0, numericInput(input.feeRate, 0) / 100);
  const feeAmount = Math.max(0, numericInput(input.feeAmount, 0));
  const upfrontCost = principal * feeRate + feeAmount;
  const saleMonth = Math.max(0, Number(operation.remainingDays || operation.days || 0) / 30);
  const saleInstallmentCount = Math.min(termMonths, Math.ceil(saleMonth));
  const amortizationMode = ["price", "interest_only", "bullet"].includes(input.amortizationMode) ? input.amortizationMode : "price";
  let balance = principal;
  let totalInterestUntilSale = 0;
  let principalPaidUntilSale = 0;
  let debtServiceUntilSale = 0;
  let regularPayment = 0;
  const amortizingMonths = Math.max(1, termMonths - graceMonths);
  const effectiveMonthlyRate = quotedMonthlyPayment > 0 && amortizationMode === "price"
    ? impliedPriceRate(principal, quotedMonthlyPayment, amortizingMonths)
    : monthlyRate;
  const scheduleMonthlyRate = effectiveMonthlyRate;

  if (amortizationMode === "price") {
    regularPayment = quotedMonthlyPayment > 0 ? quotedMonthlyPayment : pricePayment(principal, monthlyRate, amortizingMonths);
  } else if (amortizationMode === "interest_only") {
    regularPayment = principal * monthlyRate;
  }

  for (let month = 1; month <= saleInstallmentCount; month += 1) {
    const interest = balance * scheduleMonthlyRate;
    let principalPayment = 0;
    let payment = 0;
    if (amortizationMode === "price" && month > graceMonths) {
      principalPayment = Math.min(balance, Math.max(0, regularPayment - interest));
      payment = interest + principalPayment;
    } else if (amortizationMode === "price") {
      payment = interest;
    } else if (amortizationMode === "interest_only") {
      payment = interest;
      if (month === termMonths) {
        principalPayment = balance;
        payment += principalPayment;
      }
    } else {
      payment = month === termMonths ? interest + balance : 0;
      principalPayment = month === termMonths ? balance : 0;
    }
    balance = Math.max(0, balance - principalPayment);
    totalInterestUntilSale += interest;
    principalPaidUntilSale += principalPayment;
    debtServiceUntilSale += payment;
  }

  const payoffAtSale = balance;
  const totalFinancialCost = totalInterestUntilSale + upfrontCost;
  const profitAfterDebtCost = Number(operation.profitTotal || 0) - totalFinancialCost;
  const ownCapitalRequired = Math.max(0, Number(operation.investedTotal || 0) - principal + upfrontCost + totalInterestUntilSale);
  const roiOnOwnCapital = ownCapitalRequired ? profitAfterDebtCost / ownCapitalRequired : 0;
  const cdiAccumulatedRate = Number(operation.cdiAccumulatedRate || 0);
  const cdiOnOwnCapital = ownCapitalRequired * cdiAccumulatedRate;
  const profitAfterDebtVsCdi = profitAfterDebtCost - cdiOnOwnCapital;
  const debtCoverage = payoffAtSale ? Number(operation.revenueTotal || 0) / payoffAtSale : null;
  const effectiveMonthlyCost = principal ? Math.pow(1 + (totalFinancialCost / principal), 1 / Math.max(saleMonth, 1)) - 1 : 0;
  const recommendation = profitAfterDebtCost > 0 && profitAfterDebtVsCdi > 0
    ? "Empréstimo viável"
    : profitAfterDebtCost > 0
      ? "Viável, mas perde para o CDI"
      : "Não fecha com esta dívida";

  return {
    operation,
    principal,
    financedPercent,
    monthlyRate,
    quotedMonthlyPayment,
    effectiveMonthlyRate,
    termMonths,
    graceMonths,
    amortizationMode,
    saleMonth,
    saleInstallmentCount,
    regularPayment,
    totalInterestUntilSale,
    principalPaidUntilSale,
    debtServiceUntilSale,
    payoffAtSale,
    upfrontCost,
    totalFinancialCost,
    profitAfterDebtCost,
    ownCapitalRequired,
    roiOnOwnCapital,
    cdiOnOwnCapital,
    profitAfterDebtVsCdi,
    debtCoverage,
    effectiveMonthlyCost,
    recommendation
  };
}

async function routeApi(req, res, url) {
  const db = await loadDb();
  const parts = url.pathname.split("/").filter(Boolean);
  const entity = parts[1];
  const itemId = parts[2];

  if (url.pathname === "/api/health") return send(res, 200, { ok: true, name: "simulador-pecuaria-api-first" });
  if (url.pathname === "/api/auth/request-code" && req.method === "POST") {
    const payload = await body(req);
    const identifier = String(payload.email || "").trim().toLowerCase();
    const user = findUserByIdentifier(db, identifier);
    if (!user) return send(res, 404, { error: "user_not_found", detail: "Usuário não encontrado." });
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();
    db.authCodes = (db.authCodes || []).filter((item) => new Date(item.expiresAt).getTime() > Date.now() && !item.usedAt);
    db.authCodes.push({
      id: id("auth_code"),
      userId: user.id,
      email: user.email,
      codeHash: hashCode(user.email.toLowerCase(), code),
      createdAt: new Date().toISOString(),
      expiresAt
    });
    await saveDb(db);
    console.log(`[auth] Codigo de acesso para ${user.email}: ${code}`);
    return send(res, 200, {
      ok: true,
      email: user.email,
      expiresAt,
      delivery: "local_dev",
      devCode: code,
      message: "Código gerado. Em produção ele será enviado por e-mail."
    });
  }
  if (url.pathname === "/api/auth/verify-code" && req.method === "POST") {
    const payload = await body(req);
    const identifier = String(payload.email || "").trim().toLowerCase();
    const code = String(payload.code || "").trim();
    const user = findUserByIdentifier(db, identifier);
    if (!user) return send(res, 404, { error: "user_not_found", detail: "Usuário não encontrado." });
    const codeHash = hashCode(user.email.toLowerCase(), code);
    const record = (db.authCodes || []).find((item) => item.userId === user.id && item.codeHash === codeHash && !item.usedAt && new Date(item.expiresAt).getTime() > Date.now());
    if (!record) return send(res, 401, { error: "invalid_code", detail: "Código inválido ou expirado." });
    record.usedAt = new Date().toISOString();
    const session = createSession(db, user);
    await saveDb(db);
    return send(res, 200, session);
  }
  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const payload = await body(req);
    const identifier = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "").trim();
    const user = findUserByIdentifier(db, identifier);
    const ok = user && user.passwordHash === hashPassword(user.passwordSalt, password);
    if (!ok) return send(res, 401, { error: "invalid_credentials", detail: "E-mail ou senha inválidos." });
    const session = createSession(db, user);
    await saveDb(db);
    return send(res, 200, session);
  }

  if (url.pathname === "/api/auth/me") {
    const auth = authenticatedSession(db, req);
    if (!auth) return send(res, 401, { error: "unauthorized", detail: "Faça login para acessar o sistema." });
    return send(res, 200, { user: publicUser(auth.user), expiresAt: auth.session.expiresAt, authDisabled: false });
  }
  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    const token = tokenFromRequest(req);
    db.authSessions = (db.authSessions || []).filter((item) => item.token !== token);
    await saveDb(db);
    return send(res, 200, { ok: true });
  }

  if (!authenticatedSession(db, req)) {
    return send(res, 401, { error: "unauthorized", detail: "Faça login para acessar o sistema." });
  }

  if (url.pathname === "/api/admin/backup-db" && req.method === "GET") {
    return sendRawJson(res, 200, db, {
      "content-disposition": `attachment; filename=\"fazenda-slf-backup-${new Date().toISOString().slice(0, 10)}.json\"`
    });
  }

  if (url.pathname === "/api/admin/restore-db" && req.method === "POST") {
    const restored = await body(req);
    validateRestoredDb(restored);
    restored.authSessions = db.authSessions || [];
    restored.authCodes = [];
    await saveDb(restored);
    return send(res, 200, {
      ok: true,
      lots: restored.lots.length,
      expenses: restored.expenses.length,
      simulations: restored.simulations?.length || 0
    });
  }

  if (url.pathname === "/api/db") return send(res, 200, clientDb(db));
  if (url.pathname === "/api/risk/score") return send(res, 200, riskScore(db, Number(url.searchParams.get("horizonDays") || 120)));
  if (url.pathname === "/api/intelligence/insights") return send(res, 200, intelligenceInsights(db, Number(url.searchParams.get("horizonDays") || 120)));
  if (url.pathname === "/api/market/cepea-latest" && req.method === "POST") {
    const quote = await fetchCepeaLatestQuote();
    const index = db.marketQuotes.findIndex((item) => item.id === quote.id);
    if (index >= 0) db.marketQuotes[index] = { ...db.marketQuotes[index], ...quote, updatedAt: new Date().toISOString() };
    else db.marketQuotes.push({ ...quote, createdAt: new Date().toISOString() });
    db.settings.arrobaPrice = quote.arrobaPrice;
    recomputeMonthlyCloses(db);
    await saveDb(db);
    return send(res, 200, quote);
  }
  if (url.pathname === "/api/market/monthly-closes/recompute" && req.method === "POST") {
    const closes = recomputeMonthlyCloses(db);
    await saveDb(db);
    return send(res, 200, closes);
  }
  if (url.pathname === "/api/financial/bcb-latest" && req.method === "POST") {
    const indicators = await fetchFinancialIndicators();
    for (const indicator of indicators) {
      const index = db.financialIndicators.findIndex((item) => item.id === indicator.id);
      if (index >= 0) db.financialIndicators[index] = { ...db.financialIndicators[index], ...indicator, updatedAt: new Date().toISOString() };
      else db.financialIndicators.push({ ...indicator, createdAt: new Date().toISOString() });
    }
    const cdi = indicators.find((item) => item.code === "CDI_ANNUAL");
    const ipca = indicators.find((item) => item.code === "IPCA_12M");
    if (cdi) db.settings.cdiAnnualRate = cdi.value;
    if (ipca) db.settings.ipcaAnnualRate = ipca.value;
    await saveDb(db);
    return send(res, 200, indicators);
  }
  if (url.pathname === "/api/simulate" && req.method === "POST") {
    const result = simulate(await body(req), db);
    const record = { id: id("simulation"), createdAt: new Date().toISOString(), ...result };
    db.simulations.unshift(record);
    db.simulations = db.simulations.slice(0, 100);
    await saveDb(db);
    return send(res, 200, record);
  }
  if (url.pathname === "/api/auction/compare" && req.method === "POST") {
    const payload = await body(req);
    const lotA = simulate(payload.lotA || {}, db);
    const lotB = simulate(payload.lotB || {}, db);
    const winner = Number(lotA.roi || 0) >= Number(lotB.roi || 0) ? "lotA" : "lotB";
    const record = {
      id: id("auction"),
      createdAt: new Date().toISOString(),
      input: payload,
      lotA,
      lotB,
      winner
    };
    db.auctionComparisons.unshift(record);
    db.auctionComparisons = db.auctionComparisons.slice(0, 100);
    await saveDb(db);
    return send(res, 200, record);
  }
  if (url.pathname === "/api/loans/simulate" && req.method === "POST") {
    return send(res, 200, simulateLoan(await body(req), db));
  }
  if (url.pathname === "/api/simulations/bulk-delete" && req.method === "POST") {
    const payload = await body(req);
    const ids = new Set(Array.isArray(payload.ids) ? payload.ids : []);
    const before = db.simulations.length;
    db.simulations = payload.all ? [] : db.simulations.filter((item) => !ids.has(item.id));
    await saveDb(db);
    return send(res, 200, { ok: true, deleted: before - db.simulations.length, remaining: db.simulations.length });
  }
  if (url.pathname === "/api/ai/hypothesis" && req.method === "POST") {
    const payload = await body(req);
    return send(res, 200, {
      status: "provider_not_configured",
      message: "Endpoint reservado para OpenAI/Gemini. Configure chave e provedor para gerar análises automáticas.",
      received: payload
    });
  }
  if (url.pathname === "/api/ai/status") {
    return send(res, 200, {
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      visionModel: visionModel()
    });
  }
  if (url.pathname === "/api/ai/weight-from-photo" && req.method === "POST") {
    try {
      const payload = await body(req);
      const result = await estimateWeightFromPhoto(payload, db);
      return send(res, 200, result);
    } catch (error) {
      return send(res, error.status || 500, { error: "weight_estimation_failed", detail: error.message });
    }
  }
  if (url.pathname === "/api/ai/lot-weight-from-photo" && req.method === "POST") {
    try {
      const payload = await body(req);
      const result = await estimateLotWeightFromPhoto(payload, db);
      return send(res, 200, result);
    } catch (error) {
      return send(res, error.status || 500, { error: "lot_weight_estimation_failed", detail: error.message });
    }
  }

  if (!entities.has(entity)) return send(res, 404, { error: "not_found" });

  if (req.method === "GET") return send(res, 200, itemId ? db[entity].find((item) => item.id === itemId) : db[entity]);

  if (req.method === "POST") {
    const payload = await body(req);
    const record = { id: payload.id || id(entity), createdAt: new Date().toISOString(), ...payload };
    if (db[entity].some((item) => item.id === record.id)) return send(res, 409, { error: "duplicate_id", detail: "Já existe um registro com este ID." });
    if ((entity === "lots" || entity === "animals") && !record.code) record.code = nextCode(db, entity);
    if (entity === "lots" && (record.purchaseArrobas === undefined || record.purchaseArrobas === null || record.purchaseArrobas === "")) record.purchaseArrobas = Number(record.currentArrobas || 0);
    if (entity === "supplements") record.costKg = Number(record.bagKg) ? Number(record.bagPrice) / Number(record.bagKg) : Number(record.costKg || 0);
    if ((entity === "lots" || entity === "animals") && hasDuplicate(db, entity, record)) {
      return send(res, 409, { error: "duplicate_record", detail: "Cadastro duplicado com os mesmos dados." });
    }
    if (entity === "expenses") normalizeExpense(record);
    if (entity === "animalWeighings") {
      const animal = db.animals.find((item) => item.id === record.animalId);
      if (!animal) return send(res, 404, { error: "animal_not_found", detail: "Animal não encontrado para registrar pesagem." });
      normalizeWeighing(record, db);
    }
    if (entity === "lotWeighings") {
      const lot = db.lots.find((item) => item.id === record.lotId);
      if (!lot) return send(res, 404, { error: "lot_not_found", detail: "Lote não encontrado para registrar pesagem." });
      normalizeLotWeighing(record, db);
    }
    db[entity].push(record);
    if (entity === "animalWeighings") syncAnimalFromWeighings(db, record.animalId);
    if (entity === "lotWeighings") syncLotFromWeighings(db, record.lotId);
    if (entity === "marketQuotes") recomputeMonthlyCloses(db);
    await saveDb(db);
    return send(res, 201, record);
  }

  if (req.method === "PUT" && itemId) {
    const payload = await body(req);
    const index = db[entity].findIndex((item) => item.id === itemId);
    if (index < 0) return send(res, 404, { error: "not_found" });
    const previousAnimalId = entity === "animalWeighings" ? db[entity][index].animalId : null;
    const previousLotId = entity === "lotWeighings" ? db[entity][index].lotId : null;
    const updated = { ...db[entity][index], ...payload, updatedAt: new Date().toISOString() };
    if ((entity === "lots" || entity === "animals") && hasDuplicate(db, entity, updated, itemId)) {
      return send(res, 409, { error: "duplicate_record", detail: "Cadastro duplicado com os mesmos dados." });
    }
    if (entity === "expenses") normalizeExpense(updated);
    if (entity === "animalWeighings") {
      const animal = db.animals.find((item) => item.id === updated.animalId);
      if (!animal) return send(res, 404, { error: "animal_not_found", detail: "Animal não encontrado para atualizar pesagem." });
      normalizeWeighing(updated, db);
    }
    if (entity === "lotWeighings") {
      const lot = db.lots.find((item) => item.id === updated.lotId);
      if (!lot) return send(res, 404, { error: "lot_not_found", detail: "Lote não encontrado para atualizar pesagem." });
      normalizeLotWeighing(updated, db);
    }
    db[entity][index] = updated;
    if (entity === "supplements") db[entity][index].costKg = Number(db[entity][index].bagKg) ? Number(db[entity][index].bagPrice) / Number(db[entity][index].bagKg) : Number(db[entity][index].costKg || 0);
    if (entity === "animalWeighings") {
      syncAnimalFromWeighings(db, db[entity][index].animalId);
      if (previousAnimalId && previousAnimalId !== db[entity][index].animalId) syncAnimalFromWeighings(db, previousAnimalId);
    }
    if (entity === "lotWeighings") {
      syncLotFromWeighings(db, db[entity][index].lotId);
      if (previousLotId && previousLotId !== db[entity][index].lotId) syncLotFromWeighings(db, previousLotId);
    }
    if (entity === "marketQuotes") recomputeMonthlyCloses(db);
    await saveDb(db);
    return send(res, 200, db[entity][index]);
  }

  if (req.method === "DELETE" && itemId) {
    const existing = db[entity]?.find((item) => item.id === itemId);
    db[entity] = db[entity].filter((item) => item.id !== itemId);
    if (entity === "animalWeighings" && existing?.animalId) syncAnimalFromWeighings(db, existing.animalId);
    if (entity === "lotWeighings" && existing?.lotId) syncLotFromWeighings(db, existing.lotId);
    if (entity === "marketQuotes") recomputeMonthlyCloses(db);
    await saveDb(db);
    return send(res, 200, { ok: true });
  }

  return send(res, 405, { error: "method_not_allowed" });
}

async function staticFile(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    const type = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
      ".json": "application/json",
      ".webmanifest": "application/manifest+json",
      ".svg": "image/svg+xml",
      ".png": "image/png"
    }[ext] || "application/octet-stream";
    res.writeHead(200, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await routeApi(req, res, url);
    return await staticFile(req, res, url);
  } catch (error) {
    send(res, 500, { error: "internal_error", detail: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`Simulador pecuário rodando em http://${host}:${port}`);
});
