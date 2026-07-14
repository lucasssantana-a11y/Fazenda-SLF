import { chromium } from "playwright";
import { existsSync } from "node:fs";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:4173";
const TEST_EMAIL = process.env.TEST_EMAIL || process.env.INITIAL_ADMIN_EMAIL || "admin@fazenda.local";
const CHROME_FALLBACK = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const results = [];
const failures = [];

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}

function moneyClose(actual, expected, tolerance = 0.01) {
  return Math.abs(Number(actual || 0) - expected) <= tolerance;
}

async function request(path, { method = "GET", token = "", body = undefined, expected = null } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (expected !== null && response.status !== expected) {
    throw new Error(`${method} ${path} retornou ${response.status}: ${text}`);
  }
  return { response, payload };
}

async function authenticate() {
  const codeResponse = await request("/api/auth/request-code", {
    method: "POST",
    body: { email: TEST_EMAIL },
    expected: 200
  });
  const authResponse = await request("/api/auth/verify-code", {
    method: "POST",
    body: { email: TEST_EMAIL, code: codeResponse.payload.devCode },
    expected: 200
  });
  return authResponse.payload.token;
}

function buildTestDb(originalDb) {
  const db = structuredClone(originalDb);
  db.lots = [
    {
      id: "test-lot-old",
      code: 1,
      name: "Teste Lote Antigo",
      quantity: 10,
      entryDate: "2026-01-01",
      purchasePricePerHead: 1000,
      purchaseArrobas: 5,
      currentArrobas: 7,
      category: "Teste"
    },
    {
      id: "test-lot-retro",
      code: 2,
      name: "Teste Lote Retroativo",
      quantity: 5,
      entryDate: "2026-01-15",
      purchasePricePerHead: 900,
      purchaseArrobas: 4.5,
      currentArrobas: 6,
      category: "Teste"
    },
    {
      id: "test-lot-future",
      code: 3,
      name: "Teste Lote Futuro",
      quantity: 5,
      entryDate: "2026-02-10",
      purchasePricePerHead: 800,
      purchaseArrobas: 4,
      currentArrobas: 5,
      category: "Teste"
    }
  ];
  db.animals = [];
  db.animalWeighings = [];
  db.lotWeighings = [];
  db.expenses = [
    { id: "test-exp-before-all", date: "2026-01-10", expenseCategoryId: "suplementacao", description: "Antes do retroativo", amount: 150, allocationMode: "all_lots_by_headcount", lotIds: [] },
    { id: "test-exp-after-all", date: "2026-01-20", expenseCategoryId: "sal_mineral", description: "Depois do retroativo", amount: 300, allocationMode: "all_lots_by_headcount", lotIds: [] },
    { id: "test-exp-specific-after", date: "2026-01-20", expenseCategoryId: "colaboradores", description: "Específica depois", amount: 90, allocationMode: "specific_lots", lotIds: ["test-lot-old", "test-lot-retro"], lotId: "test-lot-old" },
    { id: "test-exp-specific-before", date: "2026-01-10", expenseCategoryId: "fretes", description: "Específica antes", amount: 60, allocationMode: "specific_lots", lotIds: ["test-lot-old", "test-lot-retro"], lotId: "test-lot-old" }
  ];
  db.pastures = [];
  db.pastureMovements = [];
  db.simulations = [];
  db.auctionComparisons = [];
  db.authCodes = [];
  return db;
}

async function runApiChecks(token, originalDb) {
  const testDb = buildTestDb(originalDb);
  await request("/api/admin/restore-db", { method: "POST", token, body: testDb, expected: 200 });

  const dbResponse = await request("/api/db", { token, expected: 200 });
  check("DB restaurado para teste isolado", dbResponse.payload.lots.length === 3 && dbResponse.payload.expenses.length === 4);

  const intelligence = await request("/api/intelligence/lots-performance", { token, expected: 200 });
  const byId = Object.fromEntries(intelligence.payload.lots.map((lot) => [lot.lotId, lot]));
  check("Rateio ignora lote ainda não ativo", moneyClose(byId["test-lot-future"].allocatedCostTotal, 0), `valor=${byId["test-lot-future"]?.allocatedCostTotal}`);
  check("Rateio retroativo inclui lote após entrada", moneyClose(byId["test-lot-retro"].allocatedCostTotal, 130), `valor=${byId["test-lot-retro"]?.allocatedCostTotal}`);
  check("Rateio lote antigo soma todas as despesas válidas", moneyClose(byId["test-lot-old"].allocatedCostTotal, 470), `valor=${byId["test-lot-old"]?.allocatedCostTotal}`);

  const invalidZero = await request("/api/expenses", {
    method: "POST",
    token,
    body: { expenseCategoryId: "suplementacao", description: "Inválida", amount: 0, date: "2026-01-20", allocationMode: "all_lots_by_headcount" }
  });
  check("API bloqueia despesa com valor zero", invalidZero.response.status === 400, `status=${invalidZero.response.status}`);

  const invalidInactiveLot = await request("/api/expenses", {
    method: "POST",
    token,
    body: { expenseCategoryId: "suplementacao", description: "Lote inativo", amount: 10, date: "2026-01-05", allocationMode: "specific_lots", lotIds: ["test-lot-retro"] }
  });
  check("API bloqueia rateio específico para lote inativo na data", invalidInactiveLot.response.status === 400, `status=${invalidInactiveLot.response.status}`);

  const validReceipt = await request("/api/expenses", {
    method: "POST",
    token,
    body: {
      expenseCategoryId: "suplementacao",
      description: "Nota fotografada teste",
      amount: 123.45,
      date: "2026-01-20",
      allocationMode: "specific_lots",
      lotIds: ["test-lot-old", "test-lot-retro"],
      receiptName: "nota-teste.jpg",
      receiptDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w=="
    }
  });
  check("API aceita despesa válida com comprovante", validReceipt.response.status === 201, `status=${validReceipt.response.status}`);

  const simulate = await request("/api/simulate", {
    method: "POST",
    token,
    body: {
      lotId: "test-lot-old",
      scenarioName: "Teste integrado",
      quantity: 10,
      purchaseArrobas: 5,
      currentArrobas: 7,
      targetArrobas: 9,
      purchasePricePerHead: 1000,
      arrobaPrice: 330,
      gmdKgDay: 0.45,
      operationType: "sale",
      simulationBasis: "current"
    },
    expected: 200
  });
  check("Simulação retorna recomendação", Boolean(simulate.payload.recommendation || simulate.payload.purchaseRecommendation));
}

async function runUiChecks(token) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROME_PATH || (existsSync(CHROME_FALLBACK) ? CHROME_FALLBACK : undefined)
    });
  } catch (error) {
    if (process.env.SKIP_UI_ON_BROWSER_FAILURE === "1") {
      check("UI Playwright externo indisponível", true, error.message.split("\n")[0]);
      return;
    }
    throw error;
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate((authToken) => localStorage.setItem("slfAuthToken", authToken), token);
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({ path: "outputs/integrated-desktop-overview.png", fullPage: true });

  for (const view of ["overview", "herd", "costs", "ai", "pastures", "market", "reports", "auction", "loans", "simulate"]) {
    await page.locator(`.nav-item[data-view="${view}"]`).click();
    await page.waitForSelector(`#view-${view}.active`);
  }

  await page.locator('.nav-item[data-view="costs"]').click();
  await page.waitForSelector("#view-costs.active");
  await page.locator('[data-module-group="costs"][data-module-tab="cost-allocation"]').click();
  await page.waitForSelector('[data-module-group="costs"][data-module-pane="cost-allocation"].active');
  check("Tela de apropriação renderiza cards por lote", await page.locator(".cost-lot-card").count() >= 3);
  check("Tela de apropriação renderiza quebra por categoria", await page.locator(".category-breakdown-row").count() >= 1);

  await page.locator('[data-module-group="costs"][data-module-tab="expense-entry"]').click();
  await page.waitForSelector('[data-module-pane="expense-entry"].active');
  await page.locator("#expenseAllocationMode").selectOption("specific_lots");
  await page.locator('#expenseForm [name="description"]').fill("Teste UI inválido");
  await page.locator('#expenseForm [name="amount"]').fill("0");
  await page.locator("#expenseForm button[type='submit']").click();
  await page.waitForSelector(".toast.warn");
  check("Despesa inválida mostra toast de revisão", (await page.locator(".toast.warn").innerText()).includes("Revise a despesa"));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate((authToken) => localStorage.setItem("slfAuthToken", authToken), token);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('.nav-item[data-view="costs"]').click();
  await page.locator('[data-module-group="costs"][data-module-tab="cost-allocation"]').click();
  await page.screenshot({ path: "outputs/integrated-mobile-costs.png", fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  check("Mobile sem overflow horizontal na apropriação", !overflow);

  check("Console sem erros nas telas testadas", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  await browser.close();
}

async function main() {
  let token = "";
  let backup = null;
  try {
    token = await authenticate();
    const backupResponse = await request("/api/admin/backup-db", { token, expected: 200 });
    backup = backupResponse.payload;
    await runApiChecks(token, backup);
    await runUiChecks(token);
  } finally {
    if (token && backup) {
      await request("/api/admin/restore-db", { method: "POST", token, body: backup, expected: 200 });
    }
  }

  console.log(JSON.stringify({ ok: failures.length === 0, results, failures }, null, 2));
  if (failures.length) process.exit(1);
}

await main();
