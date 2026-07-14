const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const arrobaCategoryLabels = { male: "Macho / boi", female: "Fêmea / vaca", mixed: "Mista" };

function formatDateBR(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
}

function parseNumericInput(value) {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim();
  if (!text) return 0;
  if (text.includes(",")) return Number(text.replace(/\./g, "").replace(",", "."));
  return Number(text);
}

function percentFieldOrDefault(value, fallbackDecimal) {
  const parsed = parseNumericInput(value);
  return parsed > 0 ? parsed / 100 : Number(fallbackDecimal || 0);
}

const viewMeta = {
  overview: ["Visão geral", "Painel da operação"],
  herd: ["Rebanho", "Cadastro de lotes e animais"],
  costs: ["Custos", "Despesas e suplementos"],
  pastures: ["Pastos e piquetes", "Manejo de pastagens"],
  market: ["Mercado", "Arroba e insumos"],
  auction: ["Leilão", "Comparação de pesagens e valores"],
  loans: ["Empréstimos", "Viabilidade de compra financiada"],
  reports: ["Relatórios", "Visão executiva e infraestrutura"],
  simulate: ["Simular", "Viabilidade de compra e venda"],
  ai: ["Inteligência", "Performance, risco e recomendações"]
};

let db = null;
let editContext = null;
let authToken = localStorage.getItem("slfAuthToken") || "";
let sidebarCollapsed = localStorage.getItem("slfSidebarCollapsed") === "1";

const entityLabels = {
  lots: "Lote",
  animals: "Animal",
  animalWeighings: "Pesagem individual",
  lotWeighings: "Pesagem do lote",
  expenses: "Custo",
  pastures: "Pasto",
  pastureMovements: "Movimentação",
  marketQuotes: "Cotação",
  supplements: "Suplemento",
  marketCostBenchmarks: "Benchmark",
  loanScenarios: "Simulação de crédito",
  receiptAnalyses: "Análise de notinha"
};

const editSchemas = {
  lots: [
    ["name", "Nome", "text"],
    ["code", "Código", "number"],
    ["quantity", "Quantidade", "number"],
    ["entryDate", "Entrada", "date"],
    ["purchaseArrobas", "@ aquisição", "number"],
    ["currentArrobas", "@ atual", "number"],
    ["purchasePricePerHead", "Compra/cab", "number"],
    ["category", "Categoria", "text"],
    ["origin", "Origem", "text"],
    ["estimatedAgeMonths", "Idade meses", "number"],
    ["notes", "Notas", "textarea"]
  ],
  animals: [
    ["tag", "Identificação", "text"],
    ["code", "Código", "number"],
    ["lotId", "Lote", "lot"],
    ["currentArrobas", "@ atual", "number"],
    ["entryDate", "Entrada", "date"]
  ],
  expenses: [
    ["expenseCategoryId", "Categoria", "expenseCategory"],
    ["description", "Descrição", "text"],
    ["amount", "Valor", "number"],
    ["date", "Data", "date"],
    ["allocationMode", "Rateio", "allocationMode"],
    ["lotIds", "Lotes", "lotsMultiple"]
  ],
  animalWeighings: [
    ["animalId", "Animal", "animal"],
    ["tagSnapshot", "Brinco", "text"],
    ["date", "Data", "date"],
    ["weightKg", "Peso vivo kg", "number"],
    ["source", "Origem", "text"],
    ["notes", "Notas", "textarea"]
  ],
  lotWeighings: [
    ["lotId", "Lote", "lot"],
    ["date", "Data", "date"],
    ["quantityEvaluated", "Qtd. avaliada", "number"],
    ["averageWeightKg", "Peso médio kg", "number"],
    ["source", "Origem", "text"],
    ["notes", "Notas", "textarea"]
  ],
  pastures: [
    ["name", "Nome", "text"],
    ["areaHa", "Área ha", "number"],
    ["carryingCapacityHeadHa", "Suporte cab/ha", "number"],
    ["forageType", "Forragem", "text"],
    ["status", "Status", "text"],
    ["notes", "Notas", "textarea"]
  ],
  pastureMovements: [
    ["lotId", "Lote", "lot"],
    ["pastureId", "Pasto", "pasture"],
    ["type", "Tipo", "movementType"],
    ["date", "Data", "date"]
  ],
  marketQuotes: [
    ["date", "Data", "date"],
    ["region", "Praça", "text"],
    ["animalSex", "Categoria", "animalSex"],
    ["arrobaPrice", "R$/@", "number"],
    ["source", "Fonte", "text"]
  ],
  marketCostBenchmarks: [
    ["date", "Data", "date"],
    ["region", "Região", "text"],
    ["system", "Sistema", "text"],
    ["metricType", "Métrica", "text"],
    ["value", "R$/@", "number"],
    ["source", "Fonte", "text"],
    ["sourceUrl", "URL fonte", "text"],
    ["notes", "Notas", "textarea"]
  ],
  supplements: [
    ["name", "Nome", "text"],
    ["type", "Tipo", "text"],
    ["bagPrice", "Preço saco", "number"],
    ["bagKg", "Peso saco kg", "number"],
    ["defaultPercentPv", "% PV padrão", "percentPv"]
  ]
};

async function api(path, options = {}) {
  const token = options.auth === false ? "" : authToken;
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && !path.startsWith("/api/auth/")) showLogin(payload.detail || "Faça login para acessar o sistema.");
    throw new Error(payload.detail || payload.error || `Erro ${response.status}`);
  }
  return response.json();
}

function showLogin(message = "") {
  document.querySelector("#authGate").hidden = false;
  document.querySelector("#appShell").hidden = true;
  document.querySelector("#loginMessage").textContent = message;
}

function showApp() {
  document.querySelector("#authGate").hidden = true;
  document.querySelector("#appShell").hidden = false;
  document.querySelector("#loginMessage").textContent = "";
  setSidebarCollapsed(sidebarCollapsed);
}

function showToast(title, message = "", type = "success") {
  const stack = document.querySelector("#toastStack");
  if (!stack) return;
  const toast = document.createElement("article");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div>
      <strong>${escapeHtml(title)}</strong>
      ${message ? `<p>${escapeHtml(message)}</p>` : ""}
    </div>
    <button type="button" aria-label="Fechar aviso">×</button>
  `;
  const close = () => toast.remove();
  toast.querySelector("button").addEventListener("click", close);
  stack.append(toast);
  setTimeout(close, type === "error" ? 6500 : 4200);
}

function setSidebarCollapsed(collapsed) {
  sidebarCollapsed = collapsed;
  localStorage.setItem("slfSidebarCollapsed", collapsed ? "1" : "0");
  const shell = document.querySelector("#appShell");
  shell?.classList.toggle("nav-collapsed", collapsed);
  const button = document.querySelector("#sidebarToggle");
  if (button) {
    button.setAttribute("aria-label", collapsed ? "Abrir menu" : "Recolher menu");
    button.title = collapsed ? "Abrir menu" : "Recolher menu";
  }
}

function setModuleTab(group, name) {
  document.querySelectorAll(`[data-module-tab][data-module-group="${group}"]`).forEach((item) => {
    item.classList.toggle("active", item.dataset.moduleTab === name);
  });
  document.querySelectorAll(`[data-module-pane][data-module-group="${group}"]`).forEach((item) => {
    item.classList.toggle("active", item.dataset.modulePane === name);
  });
}

function formData(form) {
  const payload = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (payload[key] === undefined) payload[key] = value;
    else if (Array.isArray(payload[key])) payload[key].push(value);
    else payload[key] = [payload[key], value];
  }
  return payload;
}

async function fileAsDataUrl(file) {
  if (!file || !file.size) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function todayIso() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function waitForVideoEvent(video, eventName) {
  return new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Não foi possível ler o vídeo enviado."));
    };
    const cleanup = () => {
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function extractVideoFrames(file, maxFrames = 10) {
  if (!file || !file.type.startsWith("video/")) return [];
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = objectUrl;

  try {
    await waitForVideoEvent(video, "loadedmetadata");
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const frameCount = Math.max(1, Math.min(maxFrames, Math.ceil(duration / 1.5) || 1));
    const canvas = document.createElement("canvas");
    const width = Math.min(video.videoWidth || 1600, 1600);
    const height = Math.round(width * ((video.videoHeight || 720) / (video.videoWidth || 1280)));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const frames = [];

    for (let index = 0; index < frameCount; index += 1) {
      const position = frameCount === 1 ? 0.5 : (index + 0.75) / (frameCount + 0.5);
      video.currentTime = Math.min(duration - 0.05, Math.max(0, duration * position));
      await waitForVideoEvent(video, "seeked");
      context.drawImage(video, 0, 0, width, height);
      frames.push(canvas.toDataURL("image/jpeg", 0.88));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function visualEvidenceFromFiles(files, options = {}) {
  const maxImages = options.maxImages || 30;
  const maxFramesPerVideo = options.maxFramesPerVideo || 10;
  const imageDataUrls = [];
  const mediaNames = [];
  let photoCount = 0;
  let videoCount = 0;
  let frameCount = 0;

  for (const file of files || []) {
    if (!file || imageDataUrls.length >= maxImages) continue;
    mediaNames.push(file.name);
    if (file.type.startsWith("image/")) {
      const dataUrl = await fileAsDataUrl(file);
      if (dataUrl) {
        imageDataUrls.push(dataUrl);
        photoCount += 1;
      }
    } else if (file.type.startsWith("video/")) {
      const remaining = Math.max(0, maxImages - imageDataUrls.length);
      const frames = await extractVideoFrames(file, Math.min(maxFramesPerVideo, remaining));
      if (frames.length) {
        imageDataUrls.push(...frames);
        videoCount += 1;
        frameCount += frames.length;
      }
    }
  }

  return {
    imageDataUrls,
    primaryDataUrl: imageDataUrls[0] || null,
    mediaNames,
    evidenceSummary: `${photoCount} foto(s), ${videoCount} vídeo(s), ${frameCount} frame(s) extraído(s)`
  };
}

function mediaPreview(evidence) {
  const urls = (evidence.imageDataUrls || []).slice(0, 10);
  if (!urls.length) return "";
  return `
    <div class="media-evidence-preview">
      <span>Evidências enviadas à IA</span>
      <div>${urls.map((url, index) => `<img src="${url}" alt="Evidência ${index + 1}" loading="lazy" />`).join("")}</div>
    </div>
  `;
}

function setView(name) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === name && item.classList.contains("nav-item")));
  document.querySelector("#viewEyebrow").textContent = viewMeta[name][0];
  document.querySelector("#viewTitle").textContent = viewMeta[name][1];
  if (["herd", "costs", "pastures", "market"].includes(name)) {
    document.querySelector(`#view-${name}`).querySelectorAll("form").forEach((form) => form.reset());
  }
  if (name === "simulate") clearSimulation();
}

function fillOptions(select, items, blankLabel = null) {
  select.innerHTML = "";
  if (blankLabel) select.append(new Option(blankLabel, ""));
  for (const item of items) select.append(new Option(item.name || item.id, item.id));
}

function fillGroupedExpenseCategories(select) {
  select.innerHTML = "";
  for (const category of db.expenseCategories) {
    const label = `${category.group} - ${category.name}`;
    select.append(new Option(label, category.id));
  }
}

function fillExpenseFilterOptions() {
  const categoryFilter = document.querySelector("#expenseCategoryFilter");
  const lotFilter = document.querySelector("#expenseLotFilter");
  if (categoryFilter) {
    const selected = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="">Todas as categorias</option>';
    for (const category of db.expenseCategories) {
      categoryFilter.append(new Option(`${category.group} - ${category.name}`, category.id));
    }
    categoryFilter.value = selected;
  }
  if (lotFilter) {
    const selected = lotFilter.value;
    lotFilter.innerHTML = '<option value="">Todos os lotes</option>';
    for (const lot of db.lots) {
      lotFilter.append(new Option(lot.name || lot.id, lot.id));
    }
    lotFilter.value = selected;
  }
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function metricSection(title, items, className = "") {
  return `
    <section class="metric-section ${className}">
      <h3>${title}</h3>
      <div class="result-grid">${items.join("")}</div>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function table(title, headers, rows) {
  const bodyRows = rows.length ? rows.map((row) => {
    if (typeof row === "string") return row;
    return `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
  }).join("") : `<tr><td colspan="${headers.length}">Sem registros.</td></tr>`;
  return `
    <div class="table-card">
      ${title ? `<h3>${title}</h3>` : ""}
      <div class="table-wrap">
        <table>
          <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function editableRow(entity, id, cells, rowAction = "edit") {
  return `<tr data-row-action="${rowAction}" data-entity="${entity}" data-id="${id}">${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
}

function actionButtons(entity, id, extra = "") {
  return `
    ${extra}
    <button class="mini-button" type="button" data-action="edit" data-entity="${entity}" data-id="${id}">Editar</button>
    <button class="mini-button danger" type="button" data-action="delete" data-entity="${entity}" data-id="${id}">Excluir</button>
  `;
}

function simulationAction(id) {
  return `
    <button class="mini-button" type="button" data-action="viewSimulation" data-id="${id}">Ver</button>
    <button class="mini-button danger" type="button" data-action="delete" data-entity="simulations" data-id="${id}">Excluir</button>
  `;
}

function latestArrobaQuote(category = "mixed") {
  const quotes = [...(db?.marketQuotes || [])].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  if (category === "mixed") return quotes[0] || null;
  return quotes.find((quote) => quote.animalSex === category) || quotes.find((quote) => quote.animalSex === "mixed") || quotes[0] || null;
}

function latestArrobaPrice(category = "mixed") {
  return Number(latestArrobaQuote(category)?.arrobaPrice || db?.settings?.arrobaPrice || 0);
}

function expenseLotIds(expense) {
  if (Array.isArray(expense.lotIds)) return expense.lotIds.filter(Boolean);
  return expense.lotId ? [expense.lotId] : [];
}

function lotWasActiveForExpense(lot, expense) {
  if (!lot?.id) return false;
  if (!expense?.date || !lot.entryDate) return true;
  return String(lot.entryDate) <= String(expense.date);
}

function allocatedExpenseForLot(lot, expense) {
  const amount = Number(expense.amount || 0);
  const ids = expenseLotIds(expense);
  if (expense.allocationMode === "specific_lots" || expense.allocationMode === "specific_lot") {
    if (!ids.includes(lot.id)) return 0;
    if (!lotWasActiveForExpense(lot, expense)) return 0;
    const selectedHeads = db.lots
      .filter((item) => ids.includes(item.id))
      .filter((item) => lotWasActiveForExpense(item, expense))
      .reduce((acc, item) => acc + Number(item.quantity || 0), 0);
    return selectedHeads ? amount * (Number(lot.quantity || 0) / selectedHeads) : 0;
  }
  if (!lotWasActiveForExpense(lot, expense)) return 0;
  if (expense.allocationMode === "all_lots_by_headcount" || (!ids.length && !expense.lotId)) {
    const totalHeads = (db.lots || [])
      .filter((item) => lotWasActiveForExpense(item, expense))
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return totalHeads ? amount * (Number(lot.quantity || 0) / totalHeads) : 0;
  }
  return 0;
}

function allocatedExpensesForLot(lot) {
  return (db.expenses || []).reduce((sum, expense) => sum + allocatedExpenseForLot(lot, expense), 0);
}

function stockArrobasForLot(lot) {
  return Number(lot.quantity || 0) * Number(lot.currentArrobas || 0);
}

function liveArrobasFromWeight(weightKg) {
  return Number(weightKg || 0) / 30;
}

function growthProjectionSeries(lot, gmdKgDay, horizonDays = 180) {
  const points = [];
  const step = 15;
  const startArrobas = Number(lot.currentArrobas || lot.purchaseArrobas || 0);
  for (let day = 0; day <= horizonDays; day += step) {
    const producedArrobas = liveArrobasFromWeight(gmdKgDay * day);
    points.push({ day, arrobas: startArrobas + producedArrobas });
  }
  return points;
}

function linePath(points, minY, maxY, width, height, pad) {
  const rangeY = Math.max(maxY - minY, 1);
  const maxDay = Math.max(...points.map((point) => point.day), 1);
  return points.map((point, index) => {
    const x = pad + (point.day / maxDay) * (width - pad * 2);
    const y = height - pad - ((point.arrobas - minY) / rangeY) * (height - pad * 2);
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function growthChart(lot) {
  const scenarios = [
    ["Conservador", 0.4, "#2b79b9"],
    ["Base", 0.5, "#d9862c"],
    ["Acelerado", 0.7, "#248a43"]
  ];
  const series = scenarios.map(([label, gmd, color]) => ({ label, gmd, color, points: growthProjectionSeries(lot, gmd) }));
  const allPoints = series.flatMap((item) => item.points);
  const minY = Math.max(0, Math.floor(Math.min(...allPoints.map((point) => point.arrobas)) - 0.5));
  const maxY = Math.ceil(Math.max(...allPoints.map((point) => point.arrobas)) + 0.5);
  const width = 520;
  const height = 220;
  const pad = 42;
  const xTicks = [0, 45, 90, 135, 180];
  const yTicks = [minY, (minY + maxY) / 2, maxY];
  const grid = xTicks.map((day) => {
    const x = pad + (day / 180) * (width - pad * 2);
    return `<line x1="${x}" x2="${x}" y1="${pad}" y2="${height - pad}" />`;
  }).join("");
  const yGrid = yTicks.map((value) => {
    const y = height - pad - ((value - minY) / Math.max(maxY - minY, 1)) * (height - pad * 2);
    return `<line x1="${pad}" x2="${width - pad}" y1="${y}" y2="${y}" />`;
  }).join("");
  const xLabels = xTicks.map((day) => {
    const x = pad + (day / 180) * (width - pad * 2);
    return `<text class="axis-label" x="${x}" y="${height - 12}" text-anchor="middle">${day}d</text>`;
  }).join("");
  const yLabels = yTicks.map((value) => {
    const y = height - pad - ((value - minY) / Math.max(maxY - minY, 1)) * (height - pad * 2);
    return `<text class="axis-label" x="${pad - 10}" y="${y + 4}" text-anchor="end">${number.format(value)}@</text>`;
  }).join("");
  const finalBase = series.find((item) => item.label === "Base")?.points.at(-1)?.arrobas || Number(lot.currentArrobas || 0);
  return `
    <article class="chart-card">
      <div class="chart-title">
        <div>
          <strong>${escapeHtml(lot.name)}</strong>
          <span>${number.format(Number(lot.quantity || 0))} cab. | ${number.format(Number(lot.currentArrobas || 0))}@ hoje</span>
        </div>
        <em>Base 180d: ${number.format(finalBase)}@</em>
      </div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Projeção de crescimento em arrobas">
        <g class="chart-grid-lines">${grid}${yGrid}</g>
        <line class="axis-line" x1="${pad}" x2="${width - pad}" y1="${height - pad}" y2="${height - pad}" />
        <line class="axis-line" x1="${pad}" x2="${pad}" y1="${pad}" y2="${height - pad}" />
        ${series.map((item) => `<path d="${linePath(item.points, minY, maxY, width, height, pad)}" fill="none" stroke="${item.color}" stroke-width="3" />`).join("")}
        ${series.map((item) => item.points.map((point) => {
          const x = pad + (point.day / 180) * (width - pad * 2);
          const y = height - pad - ((point.arrobas - minY) / Math.max(maxY - minY, 1)) * (height - pad * 2);
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${item.color}" />`;
        }).join("")).join("")}
        ${xLabels}
        ${yLabels}
      </svg>
      <div class="chart-legend">${series.map((item) => `<span><i style="background:${item.color}"></i>${item.label} ${number.format(item.gmd)} kg/d</span>`).join("")}</div>
    </article>
  `;
}

function daysSince(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));
}

function lotDecisionMetrics(lot, price) {
  const quantity = Number(lot.quantity || 0);
  const purchaseArrobas = Number(lot.purchaseArrobas || lot.currentArrobas || 0);
  const currentArrobas = Number(lot.currentArrobas || purchaseArrobas || 0);
  const allocatedCostTotal = allocatedExpensesForLot(lot);
  const allocatedCostPerHead = quantity ? allocatedCostTotal / quantity : 0;
  const investedPerHead = Number(lot.purchasePricePerHead || 0) + allocatedCostPerHead;
  const valuePerHead = currentArrobas * price;
  const resultPerHead = valuePerHead - investedPerHead;
  const margin = valuePerHead ? resultPerHead / valuePerHead : 0;
  const costPerArroba = currentArrobas ? investedPerHead / currentArrobas : 0;
  const producedArrobas = Math.max(0, currentArrobas - purchaseArrobas);
  const days = daysSince(lot.entryDate);
  const gmd = days && days > 0 ? (producedArrobas * 30) / days : 0;
  let action = "Monitorar";
  let tone = "neutral";
  let reason = "Sem sinal extremo; atualizar pesagem e custo mantém a leitura confiável.";
  if (resultPerHead < -150 && gmd < 0.25) {
    action = "Avaliar descarte";
    tone = "danger";
    reason = "Resultado negativo e GMD baixo indicam capital preso.";
  } else if (margin < 0 || costPerArroba > price * 0.94) {
    action = "Atenção";
    tone = "warn";
    reason = "Custo por arroba está apertado contra o preço de referência.";
  } else if (gmd >= 0.45 && margin >= 0.12) {
    action = "Manter ganho";
    tone = "ok";
    reason = "Margem e ganho estimado favorecem segurar no curto prazo.";
  } else if (resultPerHead > 0 && currentArrobas >= 10) {
    action = "Simular venda";
    tone = "ok";
    reason = "Lote já tem resultado positivo e peso relevante para decisão.";
  }
  const score = Math.max(0, Math.min(100, Math.round(50 + margin * 100 + gmd * 35 - Math.max(0, (costPerArroba / Math.max(price, 1) - 0.85) * 80))));
  return {
    quantity,
    purchaseArrobas,
    currentArrobas,
    stockArrobas: quantity * currentArrobas,
    allocatedCostTotal,
    allocatedCostPerHead,
    investedPerHead,
    valuePerHead,
    resultPerHead,
    margin,
    costPerArroba,
    producedArrobas,
    days,
    gmd,
    action,
    tone,
    reason,
    score
  };
}

function lotDecisionCard(lot, price) {
  const metrics = lotDecisionMetrics(lot, price);
  const scoreWidth = Math.max(4, Math.min(100, metrics.score));
  return `
    <article class="lot-radar-card ${metrics.tone}">
      <div class="lot-radar-head">
        <div>
          <span>Lote ${lot.code || ""}</span>
          <strong>${escapeHtml(lot.name || lot.id)}</strong>
        </div>
        <em>${metrics.action}</em>
      </div>
      <div class="score-line"><i style="width:${scoreWidth}%"></i></div>
      <div class="lot-radar-metrics">
        <div><span>Resultado/cab</span><strong>${currency.format(metrics.resultPerHead)}</strong></div>
        <div><span>Margem</span><strong>${percent.format(metrics.margin || 0)}</strong></div>
        <div><span>Custo/@</span><strong>${currency.format(metrics.costPerArroba || 0)}</strong></div>
        <div><span>GMD est.</span><strong>${number.format(metrics.gmd || 0)} kg/d</strong></div>
      </div>
      <p>${escapeHtml(metrics.reason)}</p>
      <div class="lot-radar-actions">
        <button class="mini-button" type="button" data-action="simulateLot" data-id="${lot.id}">Simular</button>
        <button class="mini-button light" type="button" data-action="gotoView" data-id="ai">Ranking</button>
      </div>
    </article>
  `;
}

function lotDecisionSummary(lots, price) {
  const metrics = lots.map((lot) => ({ lot, metrics: lotDecisionMetrics(lot, price) }));
  const danger = metrics.filter((item) => item.metrics.tone === "danger").length;
  const warn = metrics.filter((item) => item.metrics.tone === "warn").length;
  const best = [...metrics].sort((a, b) => b.metrics.score - a.metrics.score)[0];
  const worst = [...metrics].sort((a, b) => a.metrics.score - b.metrics.score)[0];
  return { metrics, danger, warn, best, worst };
}

function overviewLotCard(lot, price) {
  const metrics = lotDecisionMetrics(lot, price);
  return `
    <article class="overview-lot-card ${metrics.tone}">
      <div>
        <span>Lote ${lot.code || ""}</span>
        <strong>${escapeHtml(lot.name || lot.id)}</strong>
      </div>
      <div class="overview-lot-numbers">
        <span>${number.format(metrics.quantity)} cab</span>
        <span>${number.format(metrics.currentArrobas)}@ atual</span>
        <span>${currency.format(metrics.resultPerHead)}/cab</span>
      </div>
      <p>${escapeHtml(metrics.action)} · ${escapeHtml(metrics.reason)}</p>
      <button class="mini-button light" type="button" data-action="simulateLot" data-id="${lot.id}">Simular</button>
    </article>
  `;
}

function renderOverviewLots(price) {
  const rankedLots = db.lots
    .map((lot) => ({ lot, metrics: lotDecisionMetrics(lot, price) }))
    .sort((a, b) => {
      const toneWeight = { danger: 0, warn: 1, neutral: 2, ok: 3 };
      const toneDelta = (toneWeight[a.metrics.tone] ?? 2) - (toneWeight[b.metrics.tone] ?? 2);
      return toneDelta || a.metrics.score - b.metrics.score;
    })
    .slice(0, 5);
  document.querySelector("#overviewLots").innerHTML = rankedLots.length
    ? `<div class="overview-list">${rankedLots.map((item) => overviewLotCard(item.lot, price)).join("")}</div>`
    : '<p class="empty-state">Cadastre um lote para iniciar a leitura do rebanho.</p>';
}

function overviewExpenseItem(expense) {
  const category = db.expenseCategories.find((item) => item.id === expense.expenseCategoryId);
  const hasReceipt = Boolean(expense.receiptDataUrl);
  return `
    <article class="movement-item">
      <div class="movement-date">
        <strong>${formatDateBR(expense.date) || "--"}</strong>
        <span>${category?.group || "Custo"}</span>
      </div>
      <div class="movement-main">
        <strong>${escapeHtml(expense.description || category?.name || "Despesa")}</strong>
        <span>${escapeHtml(expenseRateioLabel(expense))}</span>
      </div>
      <div class="movement-value">
        <strong>${currency.format(Number(expense.amount || 0))}</strong>
        ${hasReceipt ? `<button class="mini-button light" type="button" data-action="viewReceipt" data-id="${expense.id}">Nota</button>` : ""}
      </div>
    </article>
  `;
}

function renderOverviewExpenses() {
  const expenses = [...(db.expenses || [])]
    .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")))
    .slice(0, 5);
  const totalRecent = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  document.querySelector("#overviewExpenses").innerHTML = expenses.length
    ? `
      <div class="movement-summary">
        <span>${number.format(expenses.length)} últimos lançamentos</span>
        <strong>${currency.format(totalRecent)}</strong>
      </div>
      <div class="movement-list">${expenses.map(overviewExpenseItem).join("")}</div>
    `
    : '<p class="empty-state">Nenhum custo lançado ainda.</p>';
}

function renderExecutiveDashboard() {
  const selectedLotId = document.querySelector("#dashboardLotSelect").value;
  const lots = selectedLotId ? db.lots.filter((lot) => lot.id === selectedLotId) : db.lots;
  const quote = latestArrobaQuote("mixed") || latestArrobaQuote("male");
  const price = Number(quote?.arrobaPrice || db.settings?.arrobaPrice || 0);
  const totalHeads = lots.reduce((sum, lot) => sum + Number(lot.quantity || 0), 0);
  const totalArrobas = lots.reduce((sum, lot) => sum + stockArrobasForLot(lot), 0);
  const stockValue = totalArrobas * price;
  const acquisitionValue = lots.reduce((sum, lot) => sum + Number(lot.quantity || 0) * Number(lot.purchasePricePerHead || 0), 0);
  const allocatedCosts = lots.reduce((sum, lot) => sum + allocatedExpensesForLot(lot), 0);
  const avgArrobas = totalHeads ? totalArrobas / totalHeads : 0;
  const acquisitionArrobas = lots.reduce((sum, lot) => sum + Number(lot.quantity || 0) * Number(lot.purchaseArrobas || 0), 0);
  const producedArrobas = Math.max(0, totalArrobas - acquisitionArrobas);
  const unrealizedGain = stockValue - acquisitionValue - allocatedCosts;
  const decisionSummary = lotDecisionSummary(lots, price);
  document.querySelector("#overviewKpis").innerHTML = [
    metric("Animais ativos", number.format(totalHeads)),
    metric("@ em estoque", `${number.format(totalArrobas)}@`),
    metric("Resultado potencial", currency.format(unrealizedGain)),
    metric("Lotes em atenção", number.format(decisionSummary.warn + decisionSummary.danger)),
    metric("@ do dia", currency.format(price)),
    metric("Peso médio", `${number.format(avgArrobas)}@`)
  ].join("");
  document.querySelector("#dashboardInsights").innerHTML = [
    `<span><strong>Mercado:</strong> ${escapeHtml(quote?.region || "Manual")} ${quote?.date ? `| ${shortDate.format(new Date(`${quote.date}T00:00:00`))}` : ""}</span>`,
    `<span><strong>Melhor lote:</strong> ${escapeHtml(decisionSummary.best?.lot?.name || "sem lote")}</span>`,
    `<span><strong>Prioridade:</strong> ${escapeHtml(decisionSummary.worst?.lot?.name || "sem lote")}</span>`,
    `<span><strong>Base financeira:</strong> estoque ${currency.format(stockValue)} | custos ${currency.format(allocatedCosts)}</span>`
  ].join("");
  document.querySelector("#growthCharts").innerHTML = lots.length ? lots.map((lot) => lotDecisionCard(lot, price)).join("") : "<p>Cadastre um lote para visualizar o radar.</p>";
}

function renderOverview() {
  renderExecutiveDashboard();
  renderOverviewLots(latestArrobaPrice());
  renderOverviewExpenses();
}

function analysisRows(title, rows) {
  return `
    <section class="report-panel">
      <h3>${title}</h3>
      <div class="report-rows">
        ${rows.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("")}
      </div>
    </section>
  `;
}

function reportKpi(label, value, tone = "") {
  return `<div class="report-kpi ${tone}"><span>${label}</span><strong>${value}</strong></div>`;
}

function cdiAccumulatedRateFor(result) {
  return Number(result.cdiAccumulatedRate ?? result.discountAccumulatedRate ?? 0);
}

function operationAccumulatedRateFor(result) {
  return Number(result.operationAccumulatedRate ?? result.roi ?? 0);
}

function operationVsCdiRateFor(result) {
  if (result.operationVsCdi !== undefined && result.operationVsCdi !== null) return Number(result.operationVsCdi || 0);
  return operationAccumulatedRateFor(result) - cdiAccumulatedRateFor(result);
}

function operationVsCdiAmountFor(result) {
  if (result.operationVsCdiAmount !== undefined && result.operationVsCdiAmount !== null) return Number(result.operationVsCdiAmount || 0);
  return Number(result.profitTotal || 0) - Number(result.cdiGrossReturn || 0);
}

function rateOrDash(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? "n/a" : percent.format(Number(value));
}

function simulationReport(result) {
  const isPurchaseSimulation = result.operationType === "purchase" || (!result.lotId && result.simulationBasis === "current");
  const benchmark = result.marketCostComparison?.benchmark || result.marketCostBenchmark || null;
  const benchmarkSource = benchmark ? `${benchmark.source || "Benchmark"} - ${benchmark.region || ""}` : "sem referência";
  const purchaseOutlayTotal = result.purchaseOutlayTotal || ((result.purchasePricePerHead || 0) * (result.quantity || 0) + (result.acquisitionExtraCostsTotal || 0));
  const sideBySideRows = isPurchaseSimulation ? [
    ["Base", `${number.format(result.targetArrobas || 0)}@`, `${number.format(result.remainingDays ?? result.days ?? 0)}`, currency.format(result.revenueTotal || 0), currency.format(result.profitTotal || 0), percent.format(result.margin || 0), percent.format(result.roi || 0)],
    ["Stress", `${number.format(result.targetArrobas || 0)}@`, `${number.format(result.stressScenario?.days || 0)}`, currency.format((result.targetArrobas || 0) * (result.stressScenario?.arrobaPrice || 0) * (result.quantity || 0)), currency.format(result.stressScenario?.profitTotal || 0), percent.format(result.stressScenario?.margin || 0), ""]
  ] : [
    ["Venda agora", `${number.format(result.currentArrobas || 0)}@`, "0", currency.format(result.sellNowScenario?.revenueTotal || 0), currency.format(result.sellNowScenario?.profitTotal || 0), percent.format(result.sellNowScenario?.margin || 0), percent.format(result.sellNowScenario?.roi || 0)],
    ["Futuro 30-60d", `${number.format(result.futureComparisonScenario?.arrobas || 0)}@`, `${number.format(result.futureComparisonScenario?.days || 0)}`, currency.format((result.futureComparisonScenario?.revenuePerHead || 0) * (result.quantity || 0)), currency.format(result.futureComparisonScenario?.profitTotal || 0), percent.format(result.futureComparisonScenario?.margin || 0), percent.format(result.futureComparisonScenario?.roi || 0)],
    ["Meta de venda", `${number.format(result.targetArrobas || 0)}@`, `${number.format(result.remainingDays ?? result.days ?? 0)}`, currency.format(result.revenueTotal || 0), currency.format(result.profitTotal || 0), percent.format(result.margin || 0), percent.format(result.roi || 0)]
  ];
  const decisionLabel = isPurchaseSimulation ? result.purchaseRecommendation || "Avaliar compra" : result.recommendation || "Avaliar venda";
  const decisionNote = isPurchaseSimulation
    ? `Preço teto ${currency.format(result.purchaseCeilingPerHead || 0)}/cab | desembolso ${currency.format(purchaseOutlayTotal)}`
    : result.decision?.reason || `@ usada ${currency.format(result.arrobaPrice || 0)}`;
  const executiveMetrics = isPurchaseSimulation ? [
    reportKpi("Lucro/cab", currency.format(result.profitPerHeadEffective ?? result.profitPerHead), "gain"),
    reportKpi("Lucro total", currency.format(result.profitTotal || 0), "gain"),
    reportKpi("Margem", percent.format(result.margin || 0)),
    reportKpi("ROI", percent.format(operationAccumulatedRateFor(result))),
    reportKpi("TIR a.m.", rateOrDash(result.irrMonthly)),
    reportKpi("Prazo", `${number.format(result.remainingDays ?? result.days)} dias`)
  ] : [
    reportKpi("Lucro/cab meta", currency.format(result.profitPerHead || 0), "gain"),
    reportKpi("Lucro total", currency.format(result.profitTotal || 0), "gain"),
    reportKpi("Margem", percent.format(result.margin || 0)),
    reportKpi("TIR a.m.", rateOrDash(result.irrMonthly)),
    reportKpi("Venda agora/cab", currency.format(result.sellNowScenario?.profitPerHead || 0)),
  ];
  const operatingRows = [
    ["Base do cálculo", result.simulationBasis === "acquisition" ? "operação completa" : "peso atual"],
    ["@ aquisição", `${number.format(result.purchaseArrobas || 0)}@`],
    ...isPurchaseSimulation ? [] : [["@ atual", `${number.format(result.currentArrobas || 0)}@`]],
    ["@ alvo", `${number.format(result.targetArrobas || 0)}@`],
    ["@ a produzir de hoje", `${number.format(result.futureProducedArrobas || 0)}@`],
    ["Kg faltantes de hoje", `${number.format(result.remainingKgToGain ?? result.kgToGain)} kg`],
    ["Prazo total", `${number.format(result.totalDays ?? result.days)} dias`],
    ["Tempo faltante", `${number.format(result.remainingDays ?? result.days)} dias`]
  ];
  const financialRows = [
    ["Compra/cab", currency.format(result.purchasePricePerHead || 0)],
    ...isPurchaseSimulation ? [
      ["Custo compra R$/@", currency.format(result.acquisitionCostPerArroba || result.purchasePricePerArroba || ((result.purchasePricePerHead || 0) / (result.purchaseArrobas || 1)))],
      ["Preço teto/cab", currency.format(result.purchaseCeilingPerHead || 0)],
      ["Folga no preço/cab", currency.format(result.purchaseGapPerHead || 0)],
      ["Total desembolso compra", currency.format(purchaseOutlayTotal)]
    ] : [
      [`@ usada ${arrobaCategoryLabels[result.arrobaCategory || "mixed"] || "Mista"}`, currency.format(result.arrobaPrice || 0)],
      ["Receita agora", currency.format(result.sellNowScenario?.revenueTotal ?? 0)],
      ["Receita na meta", currency.format(result.revenueTotal || 0)],
      ["Lucro venda agora/cab", currency.format(result.sellNowScenario?.profitPerHead || 0)],
      ["Lucro incremental/cab", currency.format(result.decision?.incrementalProfitPerHead || 0)]
    ],
    ["Custos anteriores lote", currency.format(result.historicalCostTotal || 0)],
    ["Terra própria R$/cab/mês", currency.format(result.landOwnCostMonth || 0)],
    ["Meses terra própria", number.format((result.remainingDays ?? result.days ?? 0) / 30)],
    ["Terra própria total lote", currency.format(result.landOwnCostAccumulated || 0)],
    ["Terra própria/cab/dia", currency.format(result.landOwnCostPerHeadDay || 0)],
    ["Custos futuros/cab", currency.format(result.directFutureCostPerHead || ((result.feedCostAccumulated || 0) + (result.operatingCostAccumulated || 0) + (result.landOwnCostPerHeadAccumulated || 0)))],
    ["Ponto equilíbrio @", currency.format(result.breakEvenArrobaPrice || 0)]
  ];
  const nutritionRows = [
    ["GMD informado", `${number.format(result.gmdKgDay || 0)} kg/dia`],
    ["GMD técnico esperado", `${number.format(result.technicalExpectedGmdKgDay || 0)} kg/dia`],
    ["Consistência GMD", result.gmdValidation?.message || "não avaliado"],
    ["Custo alim./dia", currency.format(result.feedCostDay || 0)],
    ["Custo alim. acumulado", currency.format(result.feedCostAccumulated || 0)],
    ["Proteinado", `${number.format(result.fortisBags || 0)} sacos`],
    ["Proteico energético", `${number.format(result.comigoBags || 0)} sacos`]
  ];
  const capitalRows = [
    ["CDI acumulado", percent.format(cdiAccumulatedRateFor(result))],
    ["ROI operação", percent.format(operationAccumulatedRateFor(result))],
    ["TIR mensal", rateOrDash(result.irrMonthly)],
    ["TIR anualizada", rateOrDash(result.irrAnnual)],
    ["Operação vs CDI", percent.format(operationVsCdiRateFor(result))],
    ["Diferença vs CDI", currency.format(operationVsCdiAmountFor(result))],
    ["CDI sobre compra", currency.format(result.cdiOnPurchaseCapital || 0)],
    ["Lucro vs CDI compra", currency.format(result.operationVsPurchaseCapitalCdiAmount || 0)],
    ["Lucro real/cab", currency.format(result.realProfitPerHead || 0)],
    ["ROI mensal", percent.format(result.roiMonthly || 0)]
  ];
  const efficiencyRows = [
    ["Sua @ futura produzida", currency.format(result.productionCostPerProducedArroba || 0)],
    ["Suplemento/@ produzida", currency.format(result.supplementCostPerProducedArroba || result.feedCostPerProducedArroba || 0)],
    ["Terra própria/@ produzida", currency.format(result.landOwnCostPerProducedArroba || 0)],
    ["Sua @ total produzida", currency.format(result.totalProductionCostPerProducedArroba || result.productionCostPerProducedArroba || 0)],
    ["Custo total/@ vendida", currency.format(result.totalCostPerSoldArroba || 0)],
    ["Benchmark mercado", benchmark ? `${currency.format(Number(benchmark.value || 0))} (${benchmark.metricType || ""})` : "sem referência"],
    ["Vs benchmark", result.marketCostComparison?.benchmark ? `${currency.format(result.marketCostComparison.difference || 0)} | ${percent.format(result.marketCostComparison.differencePct || 0)}` : "sem referência"],
    ["Performance", result.marketCostComparison?.label || "sem referência"],
    ["Fonte benchmark", benchmarkSource]
  ];
  const riskRows = [
    ["Lucro no cenário ruim", currency.format(result.stressScenario?.profitTotal || 0)],
    ["Margem no cenário ruim", percent.format(result.stressScenario?.margin || 0)],
    ["Mortalidade considerada", percent.format(result.mortalityRate || 0)],
    ["Risco prazo", result.timeRisk],
    ["Risco mercado", `${result.marketRisk?.level || "indefinido"} (${number.format(result.marketRisk?.score || 0)})`],
    ["Risco final", result.risk || "indefinido"]
  ];
  const replacementCostTotal = Number(result.animalPurchaseCapital || 0);
  const feedCostTotal = Number(result.feedCostAccumulated || 0) * Number(result.quantity || 0);
  const laborAndOperationTotal = Number(result.acquisitionLaborTotal || 0) + Number(result.operatingCostAccumulated || 0) * Number(result.quantity || 0);
  const otherCostTotal = Number(result.freightTotal || 0) + Number(result.commissionTotal || 0) + Number(result.initialCostsTotal || 0) + Number(result.historicalCostTotal || 0);
  const landCostTotal = Number(result.landOwnCostAccumulated || 0);
  const totalDirectCosts = replacementCostTotal + landCostTotal + laborAndOperationTotal + feedCostTotal + otherCostTotal;
  const feedCostMonthTotal = Number(result.feedCostDay || 0) * Number(result.quantity || 0) * 30;
  const laborAndOperationMonthTotal = Number(result.operatingCostPerHeadDay || 0) * Number(result.quantity || 0) * 30;
  const totalMonthlyCosts = Number(result.landOwnCostMonth || 0) * Number(result.quantity || 0) + feedCostMonthTotal + laborAndOperationMonthTotal;
  const costOverviewRows = [
    ["Reposição", currency.format(replacementCostTotal), ""],
    ["Terra própria", currency.format(landCostTotal), currency.format((result.landOwnCostMonth || 0) * (result.quantity || 0))],
    ["Mão de obra/operação", currency.format(laborAndOperationTotal), currency.format(laborAndOperationMonthTotal)],
    ["Suplementação", currency.format(feedCostTotal), currency.format(feedCostMonthTotal)],
    ["Outras despesas", currency.format(otherCostTotal), ""],
    ["Total despesas", currency.format(totalDirectCosts), currency.format(totalMonthlyCosts)]
  ];
  const reportPanels = [
    analysisRows("Operação", operatingRows),
    analysisRows("Financeiro", financialRows),
    analysisRows("Suplementação", nutritionRows),
    analysisRows("Mercado, CDI e Eficiência", [...capitalRows, ...efficiencyRows]),
    analysisRows("Risco", riskRows)
  ].join("");
  return `
    <section class="sim-report">
      <div class="report-hero">
        <div>
          <span>${isPurchaseSimulation ? "Viabilidade de compra" : "Hipótese de venda"}</span>
          <strong>${decisionLabel}</strong>
          <p>${decisionNote}</p>
        </div>
        <div class="report-hero-meta">
          <span>${result.lotName || "Simulação"}</span>
          <strong>${number.format(result.quantity || 0)} cab</strong>
        </div>
      </div>
      <div class="report-kpis">${executiveMetrics.join("")}</div>
      <div class="report-layout">${reportPanels}</div>
      ${table("Visão geral de custos", ["Despesa", "Custo total", "Custo/mês"], costOverviewRows)}
      ${table(isPurchaseSimulation ? "Cenários de compra" : "Comparação lado a lado", ["Cenário", "@ venda", "Dias", "Receita", "Lucro", "Margem", "ROI"], sideBySideRows)}
    </section>
  `;
}

function renderSimulation(result) {
  const isPurchaseSimulation = result.operationType === "purchase" || (!result.lotId && result.simulationBasis === "current");
  const signalClass = result.profitPerHead < 0 ? "danger" : result.risk === "alto" ? "warn" : "";
  const purchaseOutlayTotal = result.purchaseOutlayTotal || ((result.purchasePricePerHead || 0) * (result.quantity || 0) + (result.acquisitionExtraCostsTotal || 0));
  document.querySelector("#decisionSummary").innerHTML = isPurchaseSimulation ? `
    <div class="metric signal ${result.purchaseGapPerHead < 0 || result.stressScenario?.profitTotal < 0 ? "warn" : ""}">
      <span>Decisão de compra</span>
      <strong>${result.purchaseRecommendation || "Avaliar compra"}</strong>
    </div>
    ${metric("Lucro esperado/cab", currency.format(result.profitPerHeadEffective ?? result.profitPerHead))}
    ${metric("ROI esperado", percent.format(result.roi || 0))}
    ${metric("Prazo até venda", `${number.format(result.remainingDays ?? result.days)} dias`)}
    ${metric("Preço teto/cab", currency.format(result.purchaseCeilingPerHead || 0))}
    ${metric("Total desembolso compra", currency.format(purchaseOutlayTotal))}
  ` : `
    <div class="metric signal ${signalClass}">
      <span>Decisão final</span>
      <strong>${result.recommendation}</strong>
    </div>
    ${metric(`@ hoje ${arrobaCategoryLabels[result.arrobaCategory || "mixed"] || "Mista"}`, currency.format(result.arrobaPrice || 0))}
    ${metric("Lucro por cabeça", currency.format(result.profitPerHead))}
    ${metric("Prazo total estimado", `${number.format(result.totalDays ?? result.days)} dias`)}
    ${metric("Tempo faltante", `${number.format(result.remainingDays ?? result.days)} dias`)}
    ${metric("Por quê", result.decision?.reason || "")}
  `;
  document.querySelector("#simulationResult").innerHTML = simulationReport(result);
}

function clearSimulation() {
  document.querySelector("#simulationResult").innerHTML = "";
  document.querySelector("#decisionSummary").innerHTML = "";
}

function auctionMetric(label, value, tone = "") {
  return `<div class="metric ${tone}"><span>${label}</span><strong>${value}</strong></div>`;
}

function auctionPayload(form, prefix) {
  const arrobas = parseNumericInput(form.elements[`lot${prefix}Arrobas`].value);
  const pricePerArroba = parseNumericInput(form.elements[`lot${prefix}PricePerArroba`].value);
  return {
    scenarioName: form.elements[`lot${prefix}Name`].value || `Lote ${prefix}`,
    quantity: parseNumericInput(form.elements[`lot${prefix}Quantity`].value || 1),
    purchaseArrobas: arrobas,
    currentArrobas: arrobas,
    purchasePricePerHead: arrobas * pricePerArroba,
    purchasePricePerArroba: pricePerArroba,
    freightTotal: parseNumericInput(form.elements[`lot${prefix}FreightTotal`].value),
    acquisitionLaborTotal: parseNumericInput(form.elements[`lot${prefix}LaborTotal`].value),
    initialCostsTotal: parseNumericInput(form.elements[`lot${prefix}InitialCostsTotal`].value),
    operationType: "purchase",
    simulationBasis: "current",
    targetArrobas: parseNumericInput(form.targetArrobas.value),
    arrobaPrice: parseNumericInput(form.arrobaPrice.value),
    gmdKgDay: parseNumericInput(form.gmdKgDay.value),
    commissionRate: parseNumericInput(form.commissionRate.value) / 100,
    mortalityRate: parseNumericInput(form.mortalityRate.value) / 100,
    operatingCostPerHeadDay: parseNumericInput(form.operatingCostPerHeadDay.value),
    landOwnCostMonth: parseNumericInput(form.landOwnCostMonth.value),
    fortisPercentPv: parseNumericInput(form.fortisPercentPv.value) / 100,
    comigoPercentPv: parseNumericInput(form.comigoPercentPv.value) / 100,
    cdiAnnualRate: percentFieldOrDefault(form.cdiAnnualRate.value, db?.settings?.cdiAnnualRate),
    ipcaAnnualRate: percentFieldOrDefault(form.ipcaAnnualRate.value, db?.settings?.ipcaAnnualRate)
  };
}

function auctionLotCard(result, prefix, winnerPrefix) {
  const isWinner = prefix === winnerPrefix;
  const purchasePerArroba = result.purchaseArrobas ? result.purchasePricePerHead / result.purchaseArrobas : 0;
  const profitPerHead = result.profitPerHeadEffective ?? result.profitPerHead ?? 0;
  return `
    <article class="auction-result-card ${isWinner ? "winner" : ""}">
      <div class="auction-result-head">
        <div>
          <span>${isWinner ? "Melhor ROI" : "Comparativo"}</span>
          <strong>${escapeHtml(result.lotName)}</strong>
        </div>
        <em>${percent.format(result.roi || 0)}</em>
      </div>
      <div class="result-grid">
        ${auctionMetric("@ compra", `${number.format(result.purchaseArrobas || 0)}@`)}
        ${auctionMetric("Compra R$/@", currency.format(purchasePerArroba))}
        ${auctionMetric("Valor/cab", currency.format(result.purchasePricePerHead || 0))}
        ${auctionMetric("Desembolso", currency.format(result.purchaseOutlayTotal || 0))}
        ${auctionMetric("Prazo até meta", `${number.format(result.remainingDays || 0)} dias`)}
        ${auctionMetric("Custo futuro/cab", currency.format(result.directFutureCostPerHead || 0))}
        ${auctionMetric("Terra/cab período", currency.format(result.landOwnCostPerHeadAccumulated || 0))}
        ${auctionMetric("Custo compra/cab", currency.format(result.acquisitionExtraCostPerHead || 0))}
        ${auctionMetric("Receita/cab", currency.format(result.revenuePerHead || 0))}
        ${auctionMetric("Lucro/cab", currency.format(profitPerHead), profitPerHead >= 0 ? "signal" : "signal danger")}
        ${auctionMetric("Lucro total", currency.format(result.profitTotal || 0), result.profitTotal >= 0 ? "signal" : "signal danger")}
        ${auctionMetric("Margem", percent.format(result.margin || 0))}
        ${auctionMetric("TIR a.m.", rateOrDash(result.irrMonthly))}
        ${auctionMetric("Preço teto R$/@", currency.format(result.purchaseCeilingPerArroba || 0))}
        ${auctionMetric("@ efetiva final", currency.format(result.totalCostPerSoldArroba || 0))}
        ${auctionMetric("Vs CDI", currency.format(operationVsCdiAmountFor(result) || 0), operationVsCdiAmountFor(result) >= 0 ? "signal" : "signal warn")}
      </div>
    </article>
  `;
}

function renderAuctionComparison(data) {
  const a = data.lotA;
  const b = data.lotB;
  const winnerPrefix = data.winner === "lotA" ? "A" : "B";
  const winner = data.winner === "lotA" ? a : b;
  const loser = data.winner === "lotA" ? b : a;
  const winnerProfit = winner.profitPerHeadEffective ?? winner.profitPerHead ?? 0;
  const loserProfit = loser.profitPerHeadEffective ?? loser.profitPerHead ?? 0;
  const profitDelta = winnerProfit - loserProfit;
  const roiDelta = (winner.roi || 0) - (loser.roi || 0);
  document.querySelector("#auctionWinner").textContent = `Melhor: ${winner.lotName}`;
  document.querySelector("#auctionInsight").textContent =
    `${winner.lotName} ganha por ${currency.format(profitDelta)} por cabeça e ${percent.format(roiDelta)} de ROI no cenário informado.`;
  document.querySelector("#auctionResult").innerHTML = `
    <div class="auction-summary">
      ${auctionMetric("Vencedor", winner.lotName, "signal")}
      ${auctionMetric("Diferença lucro/cab", currency.format(profitDelta))}
      ${auctionMetric("Diferença ROI", percent.format(roiDelta))}
      ${auctionMetric("Menor desembolso", (a.purchaseOutlayTotal || 0) <= (b.purchaseOutlayTotal || 0) ? a.lotName : b.lotName)}
    </div>
    <div class="auction-result-grid">
      ${auctionLotCard(a, "A", winnerPrefix)}
      ${auctionLotCard(b, "B", winnerPrefix)}
    </div>
  `;
}

function auctionWinnerFor(record) {
  return record.winner === "lotA" ? record.lotA : record.lotB;
}

function auctionLoserFor(record) {
  return record.winner === "lotA" ? record.lotB : record.lotA;
}

function renderAuctionHistory() {
  const rows = (db.auctionComparisons || []).slice(0, 20).map((record) => {
    const winner = auctionWinnerFor(record);
    const loser = auctionLoserFor(record);
    const winnerProfit = winner.profitPerHeadEffective ?? winner.profitPerHead ?? 0;
    const loserProfit = loser.profitPerHeadEffective ?? loser.profitPerHead ?? 0;
    return editableRow("auctionComparisons", record.id, [
      record.createdAt ? new Date(record.createdAt).toLocaleString("pt-BR") : "",
      escapeHtml(winner.lotName || ""),
      percent.format(winner.roi || 0),
      rateOrDash(winner.irrMonthly),
      currency.format(winnerProfit),
      currency.format(winnerProfit - loserProfit),
      currency.format(winner.profitTotal || 0),
      currency.format(operationVsCdiAmountFor(winner) || 0),
      `<button class="mini-button danger" type="button" data-action="delete" data-entity="auctionComparisons" data-id="${record.id}">Excluir</button>`
    ]);
  });
  document.querySelector("#auctionHistory").innerHTML = table("", ["Data", "Vencedor", "ROI", "TIR a.m.", "Lucro/cab", "Vantagem/cab", "Lucro total", "Vs CDI", "Ações"], rows);
}

async function compareAuctionLots(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    lotA: auctionPayload(form, "A"),
    lotB: auctionPayload(form, "B")
  };
  if (!payload.lotA.purchaseArrobas || !payload.lotB.purchaseArrobas || !payload.lotA.arrobaPrice) {
    window.alert("Informe arrobas de compra e preço futuro da arroba para comparar.");
    return;
  }
  document.querySelector("#auctionWinner").textContent = "Calculando...";
  const result = await api("/api/auction/compare", { method: "POST", body: JSON.stringify(payload) });
  renderAuctionComparison(result);
  await refresh();
  renderAuctionComparison(result);
}

function loanOperationPayload(form) {
  const purchaseArrobas = parseNumericInput(form.purchaseArrobas.value);
  const purchasePricePerArroba = parseNumericInput(form.purchasePricePerArroba.value);
  return {
    scenarioName: form.scenarioName.value || "Compra financiada",
    quantity: parseNumericInput(form.quantity.value || 1),
    purchaseArrobas,
    currentArrobas: purchaseArrobas,
    purchasePricePerHead: purchaseArrobas * purchasePricePerArroba,
    purchasePricePerArroba,
    freightTotal: parseNumericInput(form.freightTotal.value),
    commissionRate: parseNumericInput(form.commissionRate.value) / 100,
    acquisitionLaborTotal: parseNumericInput(form.acquisitionLaborTotal.value),
    initialCostsTotal: parseNumericInput(form.initialCostsTotal.value),
    operationType: "purchase",
    simulationBasis: "current",
    targetArrobas: parseNumericInput(form.targetArrobas.value),
    arrobaPrice: parseNumericInput(form.arrobaPrice.value),
    gmdKgDay: parseNumericInput(form.gmdKgDay.value),
    mortalityRate: parseNumericInput(form.mortalityRate.value) / 100,
    operatingCostPerHeadDay: parseNumericInput(form.operatingCostPerHeadDay.value),
    landOwnCostMonth: parseNumericInput(form.landOwnCostMonth.value),
    fortisPercentPv: parseNumericInput(form.fortisPercentPv.value) / 100,
    comigoPercentPv: parseNumericInput(form.comigoPercentPv.value) / 100,
    cdiAnnualRate: percentFieldOrDefault(form.cdiAnnualRate.value, db?.settings?.cdiAnnualRate),
    ipcaAnnualRate: percentFieldOrDefault(form.ipcaAnnualRate.value, db?.settings?.ipcaAnnualRate)
  };
}

function renderLoanResult(result) {
  const op = result.operation;
  document.querySelector("#loanDecision").textContent = result.recommendation;
  document.querySelector("#loanInsight").textContent =
    `${result.recommendation}: lucro após custo financeiro de ${currency.format(result.profitAfterDebtCost || 0)} e Vs CDI de ${currency.format(result.profitAfterDebtVsCdi || 0)}.`;
  document.querySelector("#loanResult").innerHTML = `
    <div class="auction-summary">
      ${auctionMetric("Decisão", result.recommendation, result.profitAfterDebtCost >= 0 ? "signal" : "signal danger")}
      ${auctionMetric("Lucro sem dívida", currency.format(op.profitTotal || 0))}
      ${auctionMetric("Lucro após juros", currency.format(result.profitAfterDebtCost || 0), result.profitAfterDebtCost >= 0 ? "signal" : "signal danger")}
      ${auctionMetric("Vs CDI capital próprio", currency.format(result.profitAfterDebtVsCdi || 0), result.profitAfterDebtVsCdi >= 0 ? "signal" : "signal warn")}
    </div>
    <div class="auction-result-grid">
      <article class="auction-result-card winner">
        <div class="auction-result-head">
          <div><span>Operação pecuária</span><strong>${escapeHtml(op.lotName || "Compra")}</strong></div>
          <em>ROI ${percent.format(op.roi || 0)}</em>
        </div>
        <div class="result-grid">
          ${auctionMetric("Desembolso compra", currency.format(op.purchaseOutlayTotal || 0))}
          ${auctionMetric("Capital investido", currency.format(op.investedTotal || 0))}
          ${auctionMetric("Prazo até venda", `${number.format(op.remainingDays || 0)} dias`)}
          ${auctionMetric("Receita total", currency.format(op.revenueTotal || 0))}
          ${auctionMetric("Lucro total", currency.format(op.profitTotal || 0))}
          ${auctionMetric("Margem", percent.format(op.margin || 0))}
          ${auctionMetric("TIR a.m.", rateOrDash(op.irrMonthly))}
          ${auctionMetric("@ efetiva final", currency.format(op.totalCostPerSoldArroba || 0))}
          ${auctionMetric("Preço teto R$/@", currency.format(op.purchaseCeilingPerArroba || 0))}
        </div>
      </article>
      <article class="auction-result-card">
        <div class="auction-result-head">
          <div><span>Banco</span><strong>Dívida simulada</strong></div>
          <em>${percent.format(result.monthlyRate || 0)} a.m.</em>
        </div>
        <div class="result-grid">
          ${auctionMetric("Valor emprestado", currency.format(result.principal || 0))}
          ${auctionMetric("Parcela estimada", currency.format(result.regularPayment || 0))}
          ${auctionMetric("Taxa efetiva parcela", percent.format(result.effectiveMonthlyRate || 0))}
          ${auctionMetric("Parcelas até venda", number.format(result.saleInstallmentCount || 0))}
          ${auctionMetric("Juros até venda", currency.format(result.totalInterestUntilSale || 0))}
          ${auctionMetric("Tarifas", currency.format(result.upfrontCost || 0))}
          ${auctionMetric("Saldo na venda", currency.format(result.payoffAtSale || 0))}
          ${auctionMetric("Custo financeiro", currency.format(result.totalFinancialCost || 0))}
          ${auctionMetric("ROI capital próprio", percent.format(result.roiOnOwnCapital || 0))}
        </div>
      </article>
    </div>
  `;
}

function renderLoanHistory() {
  const container = document.querySelector("#loanHistory");
  if (!container) return;
  const rows = (db.loanScenarios || []).slice(0, 20).map((record) => [
    record.createdAt ? new Date(record.createdAt).toLocaleString("pt-BR") : "",
    escapeHtml(record.operation?.lotName || record.input?.operation?.scenarioName || "Compra financiada"),
    escapeHtml(record.recommendation || ""),
    currency.format(record.principal || 0),
    currency.format(record.regularPayment || 0),
    currency.format(record.totalFinancialCost || 0),
    currency.format(record.profitAfterDebtCost || 0),
    currency.format(record.profitAfterDebtVsCdi || 0),
    `<button class="mini-button danger" type="button" data-action="delete" data-entity="loanScenarios" data-id="${record.id}">Excluir</button>`
  ]);
  container.innerHTML = table("", ["Data", "Cenário", "Decisão", "Principal", "Parcela", "Custo fin.", "Lucro após dívida", "Vs CDI", "Ações"], rows);
}

async function simulateLoan(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    operation: loanOperationPayload(form),
    financedPercent: parseNumericInput(form.financedPercent.value),
    loanPrincipal: parseNumericInput(form.loanPrincipal.value),
    monthlyInterestRate: parseNumericInput(form.monthlyInterestRate.value),
    quotedMonthlyPayment: parseNumericInput(form.quotedMonthlyPayment.value),
    termMonths: parseNumericInput(form.termMonths.value),
    graceMonths: parseNumericInput(form.graceMonths.value),
    amortizationMode: form.amortizationMode.value,
    feeRate: parseNumericInput(form.feeRate.value),
    feeAmount: parseNumericInput(form.feeAmount.value)
  };
  document.querySelector("#loanDecision").textContent = "Calculando...";
  const result = await api("/api/loans/simulate", { method: "POST", body: JSON.stringify(payload) });
  renderLoanResult(result);
  await refresh();
  renderLoanResult(result);
}

function reportMetric(label, value, tone = "") {
  return `<article class="report-kpi ${tone}"><span>${label}</span><strong>${value}</strong></article>`;
}

function renderExecutiveReportPayload(payload) {
  const container = document.querySelector("#executiveReport");
  if (!container) return;
  const k = payload.kpis || {};
  const radar = payload.decisionRadar || {};
  const actions = payload.actions || [];
  container.innerHTML = `
    <div class="report-kpis">
      ${reportMetric("Lotes", number.format(k.lotCount || 0))}
      ${reportMetric("Animais", number.format(k.totalHeads || 0))}
      ${reportMetric("@ estoque", `${number.format(k.totalStockArrobas || 0)}@`)}
      ${reportMetric("Valor estoque", currency.format(k.stockValue || 0), "gain")}
      ${reportMetric("Compra histórica", currency.format(k.acquisitionValue || 0))}
      ${reportMetric("Custos lançados", currency.format(k.expenseTotal || 0))}
      ${reportMetric("Resultado potencial", currency.format(k.unrealizedResult || 0), k.unrealizedResult >= 0 ? "gain" : "danger")}
      ${reportMetric("Simulações", number.format(k.simulationCount || 0))}
      ${reportMetric("Leilões", number.format(k.auctionComparisonCount || 0))}
      ${reportMetric("Crédito", number.format(k.loanScenarioCount || 0))}
    </div>
    <div class="recommendation-grid">
      <article class="recommendation-card ok">
        <span>Melhor lote</span>
        <strong>${escapeHtml(radar.bestLot?.lotName || "Sem dados")}</strong>
        <p>${escapeHtml(radar.bestLot?.recommendation?.reason || "Cadastre e pese lotes para gerar destaque.")}</p>
      </article>
      <article class="recommendation-card warn">
        <span>Ponto de atenção</span>
        <strong>${escapeHtml(radar.worstLot?.lotName || "Sem dados")}</strong>
        <p>${escapeHtml(radar.worstLot?.recommendation?.reason || "Sem lote crítico identificado.")}</p>
      </article>
      <article class="recommendation-card">
        <span>Mercado</span>
        <strong>Risco ${escapeHtml(radar.marketRisk?.marketRiskLevel || "n/a")}</strong>
        <p>CDI ${percent.format(radar.marketRisk?.cdiAnnualRate || 0)} a.a. | Arroba ${currency.format(radar.marketRisk?.latestArrobaPrice || k.marketPrice || 0)}</p>
      </article>
      <article class="recommendation-card ${radar.latestLoan?.profitAfterDebtCost >= 0 ? "ok" : "warn"}">
        <span>Último crédito</span>
        <strong>${escapeHtml(radar.latestLoan?.recommendation || "Sem simulação")}</strong>
        <p>${radar.latestLoan ? `Lucro após dívida ${currency.format(radar.latestLoan.profitAfterDebtCost || 0)} | Vs CDI ${currency.format(radar.latestLoan.profitAfterDebtVsCdi || 0)}` : "Rode uma simulação no módulo Crédito."}</p>
      </article>
    </div>
    ${table("Ações recomendadas", ["Prioridade"], actions.map((item) => [escapeHtml(item)]))}
  `;
}

function renderDbReadinessPayload(payload) {
  const container = document.querySelector("#dbReadiness");
  if (!container) return;
  const blockers = payload.blockers || [];
  const setupItems = payload.setupItems || [];
  const readinessLabel = payload.readinessLabel || (blockers.length ? "Configuração pendente" : "Pronto para migrar");
  const readinessDetail = payload.readinessDetail || (blockers.length ? "Resolva os itens abaixo antes da produção." : "Sem bloqueios críticos detectados.");
  const statusTone = blockers.length ? "signal warn" : "signal";
  const rows = (payload.collections || []).map((item) => [
    escapeHtml(item.name),
    number.format(item.records || 0),
    escapeHtml(item.suggestedTable || "")
  ]);
  container.innerHTML = `
    <div class="auction-summary">
      ${auctionMetric("Armazenamento atual", payload.currentStore?.type || "json_file")}
      ${auctionMetric("Tamanho aproximado", `${number.format((payload.currentStore?.approximateBytes || 0) / 1024)} KB`)}
      ${auctionMetric("Destino", payload.targetStore?.type || "postgres")}
      ${auctionMetric("Status", readinessLabel, statusTone)}
    </div>
    <p class="empty-state readiness-note">${escapeHtml(readinessDetail)}</p>
    ${blockers.length ? table("Ajustes antes da produção", ["Item"], blockers.map((item) => [escapeHtml(item)])) : ""}
    ${setupItems.length ? table("Para ativar Postgres", ["Próximo passo"], setupItems.map((item) => [escapeHtml(item)])) : '<p class="empty-state">Postgres já configurado para a próxima migração.</p>'}
    ${table("Coleções e tabelas sugeridas", ["Coleção", "Registros", "Tabela"], rows)}
  `;
}

async function renderExecutiveReport() {
  const report = document.querySelector("#executiveReport");
  const readiness = document.querySelector("#dbReadiness");
  if (!report || !readiness) return;
  try {
    const [executive, dbPlan] = await Promise.all([
      api("/api/reports/executive"),
      api("/api/admin/db-readiness")
    ]);
    renderExecutiveReportPayload(executive);
    renderDbReadinessPayload(dbPlan);
  } catch (error) {
    report.innerHTML = `<article class="recommendation-card danger"><span>Relatório</span><strong>${escapeHtml(error.message)}</strong></article>`;
    readiness.innerHTML = "";
  }
}

function renderSelectedLotContext(lot) {
  const container = document.querySelector("#selectedLotContext");
  if (!lot) {
    container.innerHTML = "";
    return;
  }
  const stockArrobas = stockArrobasForLot(lot);
  const allocatedCosts = allocatedExpensesForLot(lot);
  container.innerHTML = [
    metric("Lote selecionado", `${lot.code ? `#${lot.code} - ` : ""}${lot.name}`),
    metric("Entrada", lot.entryDate || "sem data"),
    metric("@ aquisição", `${number.format(Number(lot.purchaseArrobas || 0))}@`),
    metric("@ atual", `${number.format(Number(lot.currentArrobas || 0))}@`),
    metric("@ estoque", `${number.format(stockArrobas)}@`),
    metric("Valor estoque", currency.format(stockArrobas * latestArrobaPrice())),
    metric("Compra/cab", currency.format(Number(lot.purchasePricePerHead || 0))),
    metric("Custos já rateados", currency.format(allocatedCosts))
  ].join("");
}

function renderSimulationHistory() {
  const rows = db.simulations.slice(0, 12).map((item) => editableRow("simulations", item.id, [
    `<input type="checkbox" data-simulation-select value="${item.id}" aria-label="Selecionar simulação" />`,
    item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : "",
    item.lotName,
    item.operationType === "purchase" || (!item.lotId && item.purchaseRecommendation) ? item.purchaseRecommendation || "Avaliar compra" : item.recommendation,
    currency.format(Number(item.profitPerHead || 0)),
    percent.format(Number(item.margin || 0)),
    currency.format(Number(item.profitTotal || 0)),
    simulationAction(item.id)
  ], "viewSimulation"));
  document.querySelector("#simulationHistory").innerHTML = table("", ["Sel.", "Data", "Cenário", "Decisão", "Lucro/cab", "Margem", "Lucro total", "Ações"], rows);
}

function renderHerd() {
  const lotRows = db.lots.map((lot) => editableRow("lots", lot.id, [
    lot.code || "",
    escapeHtml(lot.name),
    number.format(Number(lot.quantity || 0)),
    lot.entryDate || "",
    `${number.format(Number(lot.purchaseArrobas || 0))}@`,
    `${number.format(Number(lot.currentArrobas || 0))}@`,
    currency.format(Number(lot.purchasePricePerHead || 0)),
    escapeHtml(lot.category || ""),
    actionButtons("lots", lot.id)
  ]));
  const animalRows = db.animals.map((animal) => editableRow("animals", animal.id, [
    animal.code || "",
    escapeHtml(animal.tag || ""),
    escapeHtml(db.lots.find((lot) => lot.id === animal.lotId)?.name || ""),
    `${number.format(Number(animal.currentArrobas || 0))}@`,
    animal.entryDate || "",
    actionButtons("animals", animal.id)
  ]));
  const weighingRows = (db.animalWeighings || []).slice(0, 20).map((weighing) => editableRow("animalWeighings", weighing.id, [
    weighing.date || "",
    escapeHtml(weighing.tagSnapshot || db.animals.find((animal) => animal.id === weighing.animalId)?.tag || weighing.animalId || ""),
    `${number.format(Number(weighing.weightKg || 0))} kg`,
    `${number.format(liveArrobasFromWeight(weighing.weightKg))}@`,
    escapeHtml(weighing.source || ""),
    weighing.photoDataUrl ? `<button class="mini-button" type="button" data-action="viewWeighingPhoto" data-id="${weighing.id}">Foto</button>` : "",
    actionButtons("animalWeighings", weighing.id)
  ]));
  const lotWeighingRows = (db.lotWeighings || []).slice(0, 20).map((weighing) => editableRow("lotWeighings", weighing.id, [
    weighing.date || "",
    escapeHtml(db.lots.find((lot) => lot.id === weighing.lotId)?.name || weighing.lotId || ""),
    number.format(Number(weighing.quantityEvaluated || 0)),
    `${number.format(Number(weighing.averageWeightKg || 0))} kg`,
    `${number.format(liveArrobasFromWeight(weighing.averageWeightKg))}@`,
    `${number.format(liveArrobasFromWeight(weighing.averageWeightKg) * Number(weighing.quantityEvaluated || 0))}@`,
    escapeHtml(weighing.source || ""),
    weighing.photoDataUrl ? `<button class="mini-button" type="button" data-action="viewLotWeighingPhoto" data-id="${weighing.id}">Foto</button>` : "",
    actionButtons("lotWeighings", weighing.id)
  ]));
  document.querySelector("#lotsTable").innerHTML = table("", ["ID", "Lote", "Qtd.", "Entrada", "@ aquisição", "@ atual", "Compra/cab", "Categoria", "Ações"], lotRows);
  document.querySelector("#animalsTable").innerHTML = table("", ["ID", "Animal", "Lote", "@ atual", "Entrada", "Ações"], animalRows);
  document.querySelector("#weighingTables").innerHTML = [
    table("Pesagens individuais por brinco", ["Data", "Brinco", "Peso", "@ viva", "Origem", "Foto", "Ações"], weighingRows),
    table("Pesagens por lote", ["Data", "Lote", "Qtd.", "Peso médio", "@ média viva", "@ total viva", "Origem", "Foto", "Ações"], lotWeighingRows)
  ].join("");
}

function renderCosts() {
  const supplementRows = db.supplements.map((item) => editableRow("supplements", item.id, [
    escapeHtml(item.name),
    escapeHtml(item.type),
    currency.format(Number(item.bagPrice || 0)),
    `${number.format(Number(item.bagKg || 0))} kg`,
    currency.format(Number(item.costKg || 0)),
    `${number.format(Number(item.defaultPercentPv || 0) * 100)}%`,
    actionButtons("supplements", item.id)
  ]));
  const filteredExpenses = filteredSortedExpenses();
  const expenseRows = filteredExpenses.map((expense) => editableRow("expenses", expense.id, [
    formatDateBR(expense.date),
    escapeHtml(db.expenseCategories.find((category) => category.id === expense.expenseCategoryId)?.name || expense.expenseCategoryId || ""),
    escapeHtml(expense.description || ""),
    currency.format(Number(expense.amount || 0)),
    escapeHtml(expenseRateioLabel(expense)),
    expense.receiptDataUrl ? `<button class="mini-button" type="button" data-action="viewReceipt" data-id="${expense.id}">Ver nota</button>` : "",
    actionButtons("expenses", expense.id)
  ]));
  document.querySelector("#supplementsTable").innerHTML = table("", ["Nome", "Tipo", "Saco", "Kg/saco", "R$/kg", "% PV", "Ações"], supplementRows);
  document.querySelector("#expensesTable").innerHTML = `
    <div class="table-summary">
      <span>${number.format(filteredExpenses.length)} de ${number.format(db.expenses.length)} lançamento(s)</span>
      <span>Total filtrado: ${currency.format(filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0))}</span>
    </div>
    ${table("", ["Data", "Categoria", "Descrição", "Valor", "Rateio", "Comprovante", "Ações"], expenseRows)}
  `;
  renderCostAppropriationReport();
}

function expenseCategoryName(categoryId) {
  return db.expenseCategories.find((category) => category.id === categoryId)?.name || categoryId || "Sem categoria";
}

function expenseCategoryLabel(categoryId) {
  const category = db.expenseCategories.find((item) => item.id === categoryId);
  if (!category) return categoryId || "Sem categoria";
  return `${category.group} - ${category.name}`;
}

function expenseRateioLabel(expense) {
  if (expense.allocationMode === "all_lots_by_headcount") return "Todos por cabeça";
  return expenseLotIds(expense).map((id) => db.lots.find((lot) => lot.id === id)?.name || id).filter(Boolean).join(", ") || "Sem lote";
}

function expenseFilterValues() {
  const amountMinText = document.querySelector("#expenseAmountMin")?.value || "";
  const amountMaxText = document.querySelector("#expenseAmountMax")?.value || "";
  return {
    search: document.querySelector("#expenseSearch")?.value.trim().toLowerCase() || "",
    categoryId: document.querySelector("#expenseCategoryFilter")?.value || "",
    lotId: document.querySelector("#expenseLotFilter")?.value || "",
    dateFrom: document.querySelector("#expenseDateFrom")?.value || "",
    dateTo: document.querySelector("#expenseDateTo")?.value || "",
    amountMin: amountMinText === "" ? null : parseNumericInput(amountMinText),
    amountMax: amountMaxText === "" ? null : parseNumericInput(amountMaxText),
    sort: document.querySelector("#expenseSort")?.value || "date-desc"
  };
}

function expenseSearchText(expense) {
  return [
    expense.date,
    expenseCategoryName(expense.expenseCategoryId),
    expense.description,
    Number(expense.amount || 0).toFixed(2),
    currency.format(Number(expense.amount || 0)),
    expenseRateioLabel(expense)
  ].join(" ").toLowerCase();
}

function expenseAffectsLot(expense, lotId) {
  if (!lotId) return true;
  const lot = db.lots.find((item) => item.id === lotId);
  if (!lot) return false;
  return allocatedExpenseForLot(lot, expense) > 0;
}

function compareExpenseDates(a, b, direction) {
  const aDate = a.date ? new Date(`${a.date}T00:00:00`).getTime() : null;
  const bDate = b.date ? new Date(`${b.date}T00:00:00`).getTime() : null;
  if (aDate === null && bDate === null) return 0;
  if (aDate === null) return 1;
  if (bDate === null) return -1;
  return direction === "asc" ? aDate - bDate : bDate - aDate;
}

function filteredSortedExpenses() {
  const filters = expenseFilterValues();
  const filtered = (db.expenses || []).filter((expense) => {
    const amount = Number(expense.amount || 0);
    if (filters.search && !expenseSearchText(expense).includes(filters.search)) return false;
    if (filters.categoryId && expense.expenseCategoryId !== filters.categoryId) return false;
    if (filters.lotId && !expenseAffectsLot(expense, filters.lotId)) return false;
    if (filters.dateFrom && String(expense.date || "") < filters.dateFrom) return false;
    if (filters.dateTo && String(expense.date || "") > filters.dateTo) return false;
    if (filters.amountMin !== null && amount < filters.amountMin) return false;
    if (filters.amountMax !== null && amount > filters.amountMax) return false;
    return true;
  });
  return filtered.sort((a, b) => {
    if (filters.sort === "date-asc") return compareExpenseDates(a, b, "asc");
    if (filters.sort === "amount-desc") return Number(b.amount || 0) - Number(a.amount || 0) || compareExpenseDates(a, b, "desc");
    if (filters.sort === "amount-asc") return Number(a.amount || 0) - Number(b.amount || 0) || compareExpenseDates(a, b, "desc");
    return compareExpenseDates(a, b, "desc");
  });
}

function costAppropriationForLot(lot) {
  const quantity = Number(lot.quantity || 0);
  const purchaseTotal = quantity * Number(lot.purchasePricePerHead || 0);
  const stockArrobas = stockArrobasForLot(lot);
  const purchaseArrobas = quantity * Number(lot.purchaseArrobas || 0);
  const expenseTotal = allocatedExpensesForLot(lot);
  const totalCost = purchaseTotal + expenseTotal;
  const categoryTotals = new Map();

  for (const expense of db.expenses || []) {
    const allocated = allocatedExpenseForLot(lot, expense);
    if (!allocated) continue;
    const category = expenseCategoryLabel(expense.expenseCategoryId);
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + allocated);
  }

  return {
    lot,
    quantity,
    purchaseTotal,
    expenseTotal,
    totalCost,
    stockArrobas,
    purchaseArrobas,
    costPerHead: quantity ? totalCost / quantity : 0,
    expensePerHead: quantity ? expenseTotal / quantity : 0,
    costPerCurrentArroba: stockArrobas ? totalCost / stockArrobas : 0,
    costPerPurchaseArroba: purchaseArrobas ? totalCost / purchaseArrobas : 0,
    categoryTotals
  };
}

function costCategoryBars(categoryTotals, baseTotal) {
  const rows = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '<p class="empty-state">Nenhuma despesa apropriada para este recorte.</p>';
  return `
    <div class="category-breakdown">
      ${rows.map(([category, amount]) => {
        const share = baseTotal ? amount / baseTotal : 0;
        return `
          <div class="category-breakdown-row">
            <div>
              <strong>${escapeHtml(category)}</strong>
              <span>${currency.format(amount)} | ${percent.format(share)}</span>
            </div>
            <i><b style="width:${Math.max(3, Math.min(100, share * 100)).toFixed(1)}%"></b></i>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function costLotAppropriationCard(report, index) {
  const expenseShare = report.totalCost ? report.expenseTotal / report.totalCost : 0;
  return `
    <details class="cost-lot-card" ${index < 2 ? "open" : ""}>
      <summary>
        <div>
          <span>Lote ${report.lot.code || ""}</span>
          <strong>${escapeHtml(report.lot.name || report.lot.id)}</strong>
        </div>
        <em>${currency.format(report.totalCost)}</em>
      </summary>
      <div class="cost-lot-metrics">
        ${metric("Animais", number.format(report.quantity))}
        ${metric("Compra", currency.format(report.purchaseTotal))}
        ${metric("Despesas", currency.format(report.expenseTotal))}
        ${metric("Despesa/cab", currency.format(report.expensePerHead))}
        ${metric("Custo/cab", currency.format(report.costPerHead))}
        ${metric("Custo/@ atual", currency.format(report.costPerCurrentArroba))}
      </div>
      <div class="cost-lot-split">
        <div class="cost-stack">
          <span>Composição do custo</span>
          <i><b style="width:${Math.max(0, Math.min(100, (1 - expenseShare) * 100)).toFixed(1)}%"></b><b class="expense" style="width:${Math.max(0, Math.min(100, expenseShare * 100)).toFixed(1)}%"></b></i>
          <div><strong>Compra ${percent.format(1 - expenseShare)}</strong><strong>Despesas ${percent.format(expenseShare)}</strong></div>
        </div>
        ${costCategoryBars(report.categoryTotals, report.expenseTotal)}
      </div>
    </details>
  `;
}

function renderCostAppropriationReport() {
  const reports = (db.lots || [])
    .map(costAppropriationForLot)
    .sort((a, b) => b.totalCost - a.totalCost);
  const totalPurchase = reports.reduce((sum, item) => sum + item.purchaseTotal, 0);
  const totalExpenses = reports.reduce((sum, item) => sum + item.expenseTotal, 0);
  const totalCost = reports.reduce((sum, item) => sum + item.totalCost, 0);
  const totalHeads = reports.reduce((sum, item) => sum + item.quantity, 0);
  const totalStockArrobas = reports.reduce((sum, item) => sum + item.stockArrobas, 0);
  const highestCostLot = reports
    .slice()
    .sort((a, b) => b.costPerHead - a.costPerHead)[0];
  const categoryTotals = new Map();

  for (const report of reports) {
    for (const [category, amount] of report.categoryTotals.entries()) {
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
    }
  }

  document.querySelector("#costAppropriationReport").innerHTML = `
    <div class="cost-appropriation-screen">
      <div class="cost-report-summary">
        ${metric("Capital de compra", currency.format(totalPurchase))}
        ${metric("Despesas apropriadas", currency.format(totalExpenses))}
        ${metric("Custo total", currency.format(totalCost))}
        ${metric("Custo médio/cab", currency.format(totalHeads ? totalCost / totalHeads : 0))}
        ${metric("Custo médio/@ atual", currency.format(totalStockArrobas ? totalCost / totalStockArrobas : 0))}
        ${metric("Lote mais caro/cab", highestCostLot ? `${escapeHtml(highestCostLot.lot.name)} | ${currency.format(highestCostLot.costPerHead)}` : "Sem lotes")}
      </div>
      <section class="cost-breakdown-panel">
        <div class="section-head">
          <div><h3>Despesas por categoria</h3><span>Rateio consolidado sobre os lotes ativos nas datas das despesas</span></div>
        </div>
        ${costCategoryBars(categoryTotals, totalExpenses)}
      </section>
      <section class="cost-lot-list">
        <div class="section-head">
          <div><h3>Lotes apropriados</h3><span>Abra um lote para ver composição, despesa por cabeça e categorias</span></div>
        </div>
        ${reports.length ? reports.map(costLotAppropriationCard).join("") : '<p class="empty-state">Cadastre lotes para visualizar a apropriação.</p>'}
      </section>
    </div>
  `;
}

function managementDecisionTone(result) {
  if (Number(result.profitTotal || 0) < 0 || Number(result.margin || 0) < 0) return "danger";
  if (Number(result.roi || 0) < cdiAccumulatedRateFor(result) || result.risk === "alto") return "warn";
  return "gain";
}

function managementDecisionText(result) {
  if (Number(result.profitTotal || 0) < 0) return "Rever custo/preco antes de vender";
  if (Number(result.remainingDays || 0) <= 30 && Number(result.margin || 0) > 0.12) return "Lote perto da meta: preparar venda";
  if (Number(result.roi || 0) < cdiAccumulatedRateFor(result)) return "Retorno abaixo do CDI: acompanhar de perto";
  if (result.risk === "alto") return "Margem positiva, mas com risco alto";
  return "Manter ate a meta projetada";
}

function dreLine(label, amount, revenue, quantity, soldArrobas, level = 0, className = "") {
  const sign = amount < 0 ? "-" : "";
  const absAmount = Math.abs(amount);
  const perHead = quantity ? amount / quantity : 0;
  const perSoldArroba = soldArrobas ? amount / soldArrobas : 0;
  const margin = revenue ? amount / revenue : 0;
  return `
    <tr class="dre-row ${className}">
      <td><span style="--dre-indent:${level}">${escapeHtml(label)}</span></td>
      <td>${sign}${currency.format(absAmount)}</td>
      <td>${currency.format(perHead)}</td>
      <td>${currency.format(perSoldArroba)}</td>
      <td>${percent.format(margin)}</td>
    </tr>
  `;
}

function managementReport(result) {
  const lot = db.lots.find((item) => item.id === result.lotId);
  const costReport = lot ? costAppropriationForLot(lot) : null;
  const projectedSaleDate = new Date();
  projectedSaleDate.setDate(projectedSaleDate.getDate() + Math.ceil(Number(result.remainingDays || 0)));
  const saleDate = formatDateBR(result.expectedSaleDate || projectedSaleDate.toISOString().slice(0, 10));
  const currentValue = Number(result.currentArrobas || 0) * Number(result.arrobaPrice || 0) * Number(result.quantity || 0);
  const projectedFutureCost = Number(result.feedCostAccumulated || 0) * Number(result.quantity || 0)
    + Number(result.operatingCostAccumulated || 0) * Number(result.quantity || 0)
    + Number(result.landOwnCostAccumulated || 0);
  const totalCostAtSale = Number(result.animalPurchaseCapital || 0)
    + Number(result.historicalCostTotal || 0)
    + Number(result.acquisitionExtraCostsTotal || 0)
    + projectedFutureCost;
  const quantity = Math.max(1, Number(result.quantity || 0));
  const soldArrobas = Number(result.targetArrobas || 0) * Number(result.quantity || 0) * Number(result.mortalityFactor || 1);
  const grossRevenue = Number(result.revenueTotal || 0);
  const netRevenue = grossRevenue;
  const animalPurchaseCost = -Number(result.animalPurchaseCapital || 0);
  const acquisitionExtraCosts = -Number(result.acquisitionExtraCostsTotal || 0);
  const appropriatedCosts = -Number(result.historicalCostTotal || 0);
  const supplementationCost = -Number(result.feedCostAccumulated || 0) * Number(result.quantity || 0);
  const landOwnCost = -Number(result.landOwnCostAccumulated || 0);
  const operatingCost = -Number(result.operatingCostAccumulated || 0) * Number(result.quantity || 0);
  const grossResult = netRevenue + animalPurchaseCost + acquisitionExtraCosts + appropriatedCosts + supplementationCost;
  const operationalResult = grossResult + landOwnCost + operatingCost;
  const opportunityCost = -Number(result.cdiGrossReturn || 0);
  const economicResult = operationalResult + opportunityCost;
  const dreRows = [
    dreLine("Receita bruta projetada na venda", grossRevenue, grossRevenue, quantity, soldArrobas, 0, "dre-revenue"),
    dreLine("(-) Deducoes da receita", 0, grossRevenue, quantity, soldArrobas, 1),
    dreLine("(=) Receita liquida", netRevenue, grossRevenue, quantity, soldArrobas, 0, "dre-total"),
    dreLine("(-) Compra dos animais", animalPurchaseCost, grossRevenue, quantity, soldArrobas, 1),
    dreLine("(-) Frete, comissao e custos de aquisicao", acquisitionExtraCosts, grossRevenue, quantity, soldArrobas, 1),
    dreLine("(-) Custos ja apropriados ao lote", appropriatedCosts, grossRevenue, quantity, soldArrobas, 1),
    dreLine("(-) Suplementacao projetada", supplementationCost, grossRevenue, quantity, soldArrobas, 1),
    dreLine("(=) Resultado bruto", grossResult, grossRevenue, quantity, soldArrobas, 0, "dre-total"),
    dreLine("(-) Terra propria / arrendamento economico", landOwnCost, grossRevenue, quantity, soldArrobas, 1),
    dreLine("(-) Despesas operacionais projetadas", operatingCost, grossRevenue, quantity, soldArrobas, 1),
    dreLine("(=) Resultado operacional do lote", operationalResult, grossRevenue, quantity, soldArrobas, 0, "dre-total dre-operational"),
    dreLine("(-) Custo de oportunidade CDI", opportunityCost, grossRevenue, quantity, soldArrobas, 1),
    dreLine("(=) Resultado economico apos CDI", economicResult, grossRevenue, quantity, soldArrobas, 0, "dre-grand-total")
  ];
  const monthlyCost = Number(result.quantity || 0) * (
    Number(result.feedCostDay || 0) * 30
    + Number(result.operatingCostPerHeadDay || 0) * 30
    + Number(result.landOwnCostMonth || 0)
  );
  const decisionTone = managementDecisionTone(result);
  const categoryRows = costReport
    ? [...costReport.categoryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([category, amount]) => [
      escapeHtml(category),
      currency.format(amount),
      costReport.expenseTotal ? percent.format(amount / costReport.expenseTotal) : "0%"
    ])
    : [];
  const projectionRows = [
    ["Venda agora", `${number.format(result.currentArrobas || 0)}@`, "Hoje", currency.format(result.sellNowScenario?.revenueTotal || currentValue), currency.format(result.sellNowScenario?.profitTotal || 0), percent.format(result.sellNowScenario?.roi || 0)],
    ["Venda na meta", `${number.format(result.targetArrobas || 0)}@`, `${number.format(result.remainingDays || 0)} dias`, currency.format(result.revenueTotal || 0), currency.format(result.profitTotal || 0), percent.format(result.roi || 0)],
    ["Cenario ruim", `${number.format(result.targetArrobas || 0)}@`, `${number.format(result.stressScenario?.days || 0)} dias`, currency.format((result.targetArrobas || 0) * (result.stressScenario?.arrobaPrice || 0) * (result.quantity || 0)), currency.format(result.stressScenario?.profitTotal || 0), percent.format(result.stressScenario?.margin || 0)]
  ];
  const costRows = [
    ["Compra dos animais", currency.format(result.animalPurchaseCapital || 0), currency.format(result.purchasePricePerHead || 0)],
    ["Custos ja apropriados", currency.format(result.historicalCostTotal || 0), currency.format(Number(result.historicalCostTotal || 0) / Math.max(1, Number(result.quantity || 0)))],
    ["Suplementacao projetada", currency.format(Number(result.feedCostAccumulated || 0) * Number(result.quantity || 0)), currency.format(result.feedCostAccumulated || 0)],
    ["Operacao projetada", currency.format(Number(result.operatingCostAccumulated || 0) * Number(result.quantity || 0)), currency.format(result.operatingCostAccumulated || 0)],
    ["Terra propria projetada", currency.format(result.landOwnCostAccumulated || 0), currency.format(result.landOwnCostPerHeadAccumulated || 0)],
    ["Custo futuro projetado", currency.format(projectedFutureCost), currency.format(projectedFutureCost / Math.max(1, Number(result.quantity || 0)))],
    ["Custo total na meta", currency.format(totalCostAtSale), currency.format(totalCostAtSale / Math.max(1, Number(result.quantity || 0)))]
  ];
  const acquisitionRows = [
    ["Lote", escapeHtml(result.lotName || lot?.name || "Lote")],
    ["Entrada", formatDateBR(lot?.entryDate)],
    ["Quantidade", `${number.format(result.quantity || 0)} cabecas`],
    ["Compra/cab", currency.format(result.purchasePricePerHead || 0)],
    ["@ aquisicao", `${number.format(result.purchaseArrobas || 0)}@`],
    ["@ atual", `${number.format(result.currentArrobas || 0)}@`],
    ["Custo apropriado/cab", currency.format(costReport?.expensePerHead || 0)],
    ["Custo total/cab hoje", currency.format(costReport?.costPerHead || 0)]
  ];
  const performanceRows = [
    ["Meta de venda", `${number.format(result.targetArrobas || 0)}@`],
    ["Data estimada de venda", saleDate],
    ["Prazo faltante", `${number.format(result.remainingDays || 0)} dias`],
    ["GMD usado", `${number.format(result.gmdKgDay || 0)} kg/dia`],
    ["Kg faltantes/cab", `${number.format(result.remainingKgToGain || 0)} kg`],
    ["Custo mensal projetado", currency.format(monthlyCost)],
    ["Custo total/@ vendida", currency.format(result.totalCostPerSoldArroba || 0)],
    ["Preco equilibrio @", currency.format(result.breakEvenArrobaPrice || 0)]
  ];
  const returnRows = [
    ["Receita na meta", currency.format(result.revenueTotal || 0)],
    ["Lucro total", currency.format(result.profitTotal || 0)],
    ["Lucro/cab", currency.format(result.profitPerHead || 0)],
    ["Margem", percent.format(result.margin || 0)],
    ["ROI", percent.format(result.roi || 0)],
    ["TIR mensal", rateOrDash(result.irrMonthly)],
    ["TIR anualizada", rateOrDash(result.irrAnnual)],
    ["Operacao vs CDI", `${percent.format(operationVsCdiRateFor(result))} | ${currency.format(operationVsCdiAmountFor(result))}`]
  ];

  return `
    <section class="management-report sim-report">
      <div class="management-report-header">
        <img src="/logo-slf.png" alt="SLF Agropecuária" />
        <div>
          <span>SLF Agropecuária</span>
          <strong>DRE gerencial do lote</strong>
          <p>${escapeHtml(result.lotName || lot?.name || "Lote")} | Emitido em ${new Date().toLocaleDateString("pt-BR")} | Meta ${number.format(result.targetArrobas || 0)}@</p>
        </div>
      </div>
      <div class="report-hero">
        <div>
          <span>DRE gerencial do lote</span>
          <strong>${managementDecisionText(result)}</strong>
          <p>Meta ${number.format(result.targetArrobas || 0)}@ com preco de venda ${currency.format(result.arrobaPrice || 0)}/@ e venda estimada em ${saleDate}.</p>
        </div>
        <div class="report-hero-meta">
          <span>${escapeHtml(result.lotName || lot?.name || "Lote")}</span>
          <strong>${number.format(result.quantity || 0)} cab</strong>
        </div>
      </div>
      <div class="report-kpis">
        ${reportKpi("Lucro total", currency.format(result.profitTotal || 0), decisionTone)}
        ${reportKpi("Margem", percent.format(result.margin || 0), decisionTone)}
        ${reportKpi("ROI", percent.format(result.roi || 0), decisionTone)}
        ${reportKpi("TIR a.m.", rateOrDash(result.irrMonthly))}
        ${reportKpi("Prazo", `${number.format(result.remainingDays || 0)} dias`)}
        ${reportKpi("Equilibrio @", currency.format(result.breakEvenArrobaPrice || 0))}
      </div>
      <div class="report-layout">
        ${analysisRows("Aquisicao e posicao atual", acquisitionRows)}
        ${analysisRows("Meta, prazo e performance", performanceRows)}
        ${analysisRows("Margem, ROI e capital", returnRows)}
        ${analysisRows("Leitura gerencial", [
          ["Decisao sugerida", managementDecisionText(result)],
          ["Risco", result.risk || "indefinido"],
          ["Cenario ruim", `${currency.format(result.stressScenario?.profitTotal || 0)} de lucro | ${percent.format(result.stressScenario?.margin || 0)} margem`],
          ["Venda agora", `${currency.format(result.sellNowScenario?.profitTotal || 0)} de lucro | ${percent.format(result.sellNowScenario?.roi || 0)} ROI`]
        ])}
      </div>
      ${table("DRE gerencial projetada do lote", ["Conta", "Total lote", "R$/cab", "R$/@ vendida", "% Receita"], dreRows)}
      ${table("Projecao de custos ate a meta", ["Componente", "Total lote", "R$/cab"], costRows)}
      ${table("Simulacao de venda", ["Cenario", "@ venda", "Prazo", "Receita", "Resultado", "Indicador"], projectionRows)}
      ${categoryRows.length ? table("Custos apropriados por categoria", ["Categoria", "Valor", "% custos apropriados"], categoryRows) : ""}
    </section>
  `;
}

function managementReportPayload(form) {
  const payload = formData(form);
  const lot = db.lots.find((item) => item.id === payload.lotId);
  if (!lot) throw new Error("Selecione um lote para emitir o relatorio.");
  return {
    lotId: lot.id,
    lotName: lot.name,
    quantity: Number(lot.quantity || 0),
    animalSex: lot.category === "male" || lot.category === "female" ? lot.category : "mixed",
    operationType: "sale",
    simulationBasis: "acquisition",
    purchaseArrobas: Number(lot.purchaseArrobas || 0),
    currentArrobas: Number(lot.currentArrobas || lot.purchaseArrobas || 0),
    purchasePricePerHead: Number(lot.purchasePricePerHead || 0),
    targetArrobas: parseNumericInput(payload.targetArrobas || 12),
    gmdKgDay: parseNumericInput(payload.gmdKgDay || 0),
    arrobaPrice: parseNumericInput(payload.arrobaPrice || db.settings.arrobaPrice || 0),
    fortisPercentPv: Number(payload.fortisPercentPv || 0) / 100,
    comigoPercentPv: Number(payload.comigoPercentPv || 0) / 100,
    operatingCostPerHeadDay: parseNumericInput(payload.operatingCostPerHeadDay || 0),
    landOwnCostMonth: parseNumericInput(payload.landOwnCostMonth || 0),
    mortalityRate: Number(payload.mortalityRate || 0) / 100,
    cdiAnnualRate: Number(payload.cdiAnnualRate || 0) / 100,
    ipcaAnnualRate: Number(payload.ipcaAnnualRate || 0) / 100,
    discountRate: Number(payload.cdiAnnualRate || 0) / 100
  };
}

async function generateLotManagementReport(event) {
  event.preventDefault();
  const container = document.querySelector("#lotManagementReport");
  try {
    const result = await api("/api/simulate", {
      method: "POST",
      body: JSON.stringify(managementReportPayload(event.currentTarget))
    });
    container.innerHTML = managementReport(result);
  } catch (error) {
    container.innerHTML = `<div class="metric signal danger"><span>Relatorio gerencial</span><strong>Nao foi possivel gerar</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function renderPastures() {
  const pastureRows = db.pastures.map((pasture) => editableRow("pastures", pasture.id, [
    escapeHtml(pasture.name),
    `${number.format(Number(pasture.areaHa || 0))} ha`,
    `${number.format(Number(pasture.carryingCapacityHeadHa || 0))} cab/ha`,
    escapeHtml(pasture.forageType || ""),
    escapeHtml(pasture.status || ""),
    actionButtons("pastures", pasture.id)
  ]));
  const movementRows = db.pastureMovements.map((movement) => editableRow("pastureMovements", movement.id, [
    movement.date || "",
    escapeHtml(db.lots.find((lot) => lot.id === movement.lotId)?.name || ""),
    escapeHtml(db.pastures.find((pasture) => pasture.id === movement.pastureId)?.name || ""),
    escapeHtml(movement.type || ""),
    actionButtons("pastureMovements", movement.id)
  ]));
  document.querySelector("#pastureTables").innerHTML = [
    table("Pastos e piquetes", ["Nome", "Área", "Suporte", "Forragem", "Status", "Ações"], pastureRows),
    table("Movimentações", ["Data", "Lote", "Pasto", "Tipo", "Ações"], movementRows)
  ].join("");
}

function renderMarket() {
  const indicatorRows = db.financialIndicators.map((item) => [
    escapeHtml(item.name || item.code),
    item.date || "",
    item.unit?.includes("decimal") ? percent.format(Number(item.value || 0)) : number.format(Number(item.value || 0)),
    escapeHtml(item.source || "")
  ]);
  const quoteRows = db.marketQuotes.slice().reverse().map((quote) => editableRow("marketQuotes", quote.id, [
    quote.date || "",
    escapeHtml(quote.region || ""),
    arrobaCategoryLabels[quote.animalSex || "mixed"] || "Mista",
    currency.format(Number(quote.arrobaPrice || 0)),
    escapeHtml(quote.source || ""),
    actionButtons("marketQuotes", quote.id)
  ]));
  const supplementRows = db.supplements.map((item) => [
    escapeHtml(item.name),
    escapeHtml(item.type),
    currency.format(Number(item.bagPrice || 0)),
    `${number.format(Number(item.bagKg || 0))} kg`,
    currency.format(Number(item.costKg || 0))
  ]);
  const benchmarkRows = (db.marketCostBenchmarks || []).map((item) => editableRow("marketCostBenchmarks", item.id, [
    item.date || "",
    escapeHtml(item.region || ""),
    escapeHtml(item.system || ""),
    escapeHtml(item.metricType || ""),
    currency.format(Number(item.value || 0)),
    escapeHtml(item.source || ""),
    actionButtons("marketCostBenchmarks", item.id)
  ]));
  document.querySelector("#financialIndicators").innerHTML = table("", ["Indicador", "Data", "Valor", "Fonte"], indicatorRows);
  document.querySelector("#marketQuotes").innerHTML = table("", ["Data", "Praça", "Categoria", "R$/@", "Fonte", "Ações"], quoteRows);
  document.querySelector("#marketSupplements").innerHTML = table("", ["Insumo", "Tipo", "Saco", "Kg/saco", "R$/kg"], supplementRows);
  document.querySelector("#marketCostBenchmarks").innerHTML = table("", ["Data", "Região", "Sistema", "Métrica", "R$/@", "Fonte", "Ações"], benchmarkRows);
}

async function renderAiInsights() {
  const container = document.querySelector("#aiInsights");
  if (!container) return;
  try {
    const payload = await api("/api/intelligence/insights?horizonDays=120");
    container.innerHTML = (payload.insights || []).map((item) => `
      <article class="insight-note ${item.severity || ""}">
        <span>${escapeHtml(item.title)}</span>
        <strong>${escapeHtml(item.text)}</strong>
        <p>${escapeHtml(item.decisionUse)}</p>
      </article>
    `).join("");
  } catch (error) {
    container.innerHTML = `<article class="insight-note atenção"><span>Inteligência</span><strong>${escapeHtml(error.message)}</strong></article>`;
  }
}

async function generateDecisionBrief(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const container = document.querySelector("#decisionBriefResult");
  container.innerHTML = '<article class="recommendation-card"><span>Brief</span><strong>Gerando análise...</strong></article>';
  try {
    const payload = await api("/api/ai/decision-brief", {
      method: "POST",
      body: JSON.stringify({ lotId: form.lotId.value })
    });
    container.innerHTML = `
      <article class="recommendation-card ${payload.provider === "openai" ? "ok" : "warn"}">
        <span>${escapeHtml(payload.provider || "deterministic")}</span>
        <strong>${escapeHtml(payload.title || "Brief de decisão")}</strong>
        <p>${escapeHtml(payload.recommendation || "")}</p>
      </article>
      ${table("Razões", ["Leitura"], (payload.reasons || []).map((item) => [escapeHtml(item)]))}
      ${table("Próximas ações", ["Ação"], (payload.nextActions || []).map((item) => [escapeHtml(item)]))}
    `;
  } catch (error) {
    container.innerHTML = `<article class="recommendation-card danger"><span>Brief</span><strong>${escapeHtml(error.message)}</strong></article>`;
  }
}

async function analyzeReceiptOcr() {
  const form = document.querySelector("#expenseForm");
  const box = document.querySelector("#receiptOcrResult");
  const file = form.receipt.files?.[0];
  if (!file) {
    showToast("Foto necessária", "Anexe a foto da notinha antes de rodar o OCR.", "warn");
    return;
  }
  const button = document.querySelector("#analyzeReceiptBtn");
  button.disabled = true;
  button.textContent = "Lendo notinha...";
  box.innerHTML = '<div class="metric"><span>OCR</span><strong>Analisando comprovante...</strong></div>';
  try {
    const receiptDataUrl = await fileAsDataUrl(file);
    const result = await api("/api/ocr/receipt", {
      method: "POST",
      body: JSON.stringify({
        receiptName: file.name,
        receiptDataUrl,
        description: form.description.value
      })
    });
    if (result.totalAmount > 0 && !parseNumericInput(form.amount.value)) form.amount.value = result.totalAmount.toFixed(2);
    if (result.documentDate && !form.date.value) form.date.value = result.documentDate;
    if (result.suggestedCategoryId) form.expenseCategoryId.value = result.suggestedCategoryId;
    if (result.description && !form.description.value) form.description.value = result.description;
    box.innerHTML = [
      metric("OCR", result.provider === "openai" ? "IA visual" : "Fallback local"),
      metric("Confiança", result.confidence || "baixa"),
      metric("Fornecedor", escapeHtml(result.vendorName || "não identificado")),
      metric("Valor sugerido", currency.format(result.totalAmount || 0)),
      metric("Categoria", escapeHtml(result.suggestedCategoryId || "outros")),
      ...(result.warnings || []).map((warning) => `<div class="metric signal warn"><span>Aviso</span><strong>${escapeHtml(warning)}</strong></div>`)
    ].join("");
  } catch (error) {
    box.innerHTML = `<div class="metric signal danger"><span>OCR</span><strong>Falha</strong><p>${escapeHtml(error.message)}</p></div>`;
  } finally {
    button.disabled = false;
    button.textContent = "Ler notinha por IA/OCR";
  }
}

function recommendationToneClass(severity) {
  if (severity === "crítico") return "danger";
  if (severity === "atenção") return "warn";
  if (severity === "ok") return "ok";
  return "";
}

function performanceActionButton(lotId) {
  return `<button class="mini-button" type="button" data-action="simulateLot" data-id="${lotId}">Simular</button>`;
}

function renderRecommendationCards(payload) {
  const discardCards = (payload.discardCandidates || []).map((lot) => `
    <article class="recommendation-card danger">
      <span>${escapeHtml(lot.recommendation.label)}</span>
      <strong>${escapeHtml(lot.lotName)}</strong>
      <p>${escapeHtml(lot.recommendation.reason)}</p>
      <div>
        <em>Score ${number.format(lot.score)}</em>
        <em>GMD ${number.format(lot.estimatedGmdKgDay)} kg/d</em>
        <em>${currency.format(lot.potentialResultPerHead)}/cab</em>
      </div>
    </article>
  `);
  const bestCards = (payload.bestLots || []).map((lot) => `
    <article class="recommendation-card ok">
      <span>Melhor performance</span>
      <strong>${escapeHtml(lot.lotName)}</strong>
      <p>${escapeHtml(lot.recommendation.reason)}</p>
      <div>
        <em>Score ${number.format(lot.score)}</em>
        <em>Margem ${percent.format(lot.potentialMargin || 0)}</em>
        <em>${number.format(lot.currentArrobas || 0)}@</em>
      </div>
    </article>
  `);
  if (!discardCards.length && !bestCards.length) {
    return '<article class="recommendation-card"><span>Inteligência</span><strong>Sem lotes suficientes</strong><p>Cadastre lotes, datas de entrada e pesos para gerar ranking.</p></article>';
  }
  return [...discardCards, ...bestCards].join("");
}

async function renderLotIntelligence() {
  const kpis = document.querySelector("#lotIntelligenceKpis");
  const alerts = document.querySelector("#lotIntelligenceAlerts");
  const ranking = document.querySelector("#lotPerformanceRanking");
  if (!kpis || !alerts || !ranking) return;
  try {
    const payload = await api("/api/intelligence/lots-performance");
    const summary = payload.summary || {};
    const market = payload.marketReference || {};
    kpis.innerHTML = [
      metric("Lotes avaliados", number.format(summary.lotCount || 0)),
      metric("Score médio", number.format(summary.averageScore || 0)),
      metric("Candidatos descarte", number.format(summary.discardCandidateCount || 0)),
      metric("Em observação", number.format(summary.observationCandidateCount || 0)),
      metric("Resultado potencial", currency.format(summary.totalPotentialResult || 0)),
      metric("@ em estoque", `${number.format(summary.totalStockArrobas || 0)}@`),
      metric("@ referência", currency.format(market.arrobaPrice || 0))
    ].join("");
    alerts.innerHTML = renderRecommendationCards(payload);
    const rows = (payload.lots || []).map((lot) => [
      lot.code || "",
      escapeHtml(lot.lotName || ""),
      number.format(lot.score || 0),
      `<span class="status-chip ${recommendationToneClass(lot.recommendation?.severity)}">${escapeHtml(lot.recommendation?.label || "")}</span>`,
      number.format(lot.quantity || 0),
      formatDateBR(lot.entryDate),
      lot.daysInFarm === null ? "n/a" : `${number.format(lot.daysInFarm)} dias`,
      `${number.format(lot.currentArrobas || 0)}@`,
      `${number.format(lot.producedArrobasPerHead || 0)}@`,
      `${number.format(lot.estimatedGmdKgDay || 0)} kg/d`,
      currency.format(lot.allocatedCostPerHead || 0),
      currency.format(lot.totalCostPerCurrentArroba || 0),
      currency.format(lot.potentialResultPerHead || 0),
      percent.format(lot.potentialMargin || 0),
      performanceActionButton(lot.lotId)
    ]);
    ranking.innerHTML = table("Ranking de performance dos lotes", ["ID", "Lote", "Score", "Recomendação", "Qtd.", "Entrada", "Tempo", "@ atual", "@ produzida", "GMD", "Desp./cab", "Custo/@", "Resultado/cab", "Margem", "Ação"], rows);
  } catch (error) {
    kpis.innerHTML = "";
    alerts.innerHTML = `<article class="recommendation-card danger"><span>Inteligência</span><strong>${escapeHtml(error.message)}</strong></article>`;
    ranking.innerHTML = "";
  }
}

async function renderAll() {
  renderOverview();
  renderHerd();
  renderCosts();
  renderPastures();
  renderMarket();
  renderSimulationHistory();
  renderAuctionHistory();
  renderLoanHistory();
  await renderExecutiveReport();
  await renderLotIntelligence();
  await renderAiInsights();
}

async function refresh() {
  const simulationForm = document.querySelector("#simulationForm");
  const simulationSnapshot = simulationForm ? formData(simulationForm) : null;
  db = await api("/api/db");
  for (const id of ["lotSelect", "animalLotSelect", "movementLotSelect"]) {
    fillOptions(document.querySelector(`#${id}`), db.lots, id === "lotSelect" ? "Cenário avulso / leilão" : null);
  }
  fillOptions(document.querySelector("#dashboardLotSelect"), db.lots, "Estoque total");
  fillOptions(document.querySelector("#expenseLotSelect"), db.lots);
  document.querySelector("#expenseLotSelect").disabled = document.querySelector("#expenseAllocationMode").value === "all_lots_by_headcount";
  fillOptions(document.querySelector("#managementReportLotSelect"), db.lots, "Selecione um lote");
  fillOptions(document.querySelector("#decisionBriefLotSelect"), db.lots, "Selecione um lote");
  fillOptions(document.querySelector("#weighingAnimalSelect"), db.animals, "Selecione um animal");
  fillOptions(document.querySelector("#lotWeighingLotSelect"), db.lots, "Selecione um lote");
  fillOptions(document.querySelector("#pastureSelect"), db.pastures);
  fillGroupedExpenseCategories(document.querySelector("#expenseCategorySelect"));
  fillExpenseFilterOptions();
  const expenseForm = document.querySelector("#expenseForm");
  if (expenseForm && !expenseForm.date.value) expenseForm.date.value = todayIso();
  fillOptions(document.querySelector("#simulationQuoteSelect"), db.marketQuotes.slice().reverse().map((quote) => ({
    id: quote.id,
    name: `${arrobaCategoryLabels[quote.animalSex || "mixed"] || "Mista"} - ${quote.region || "Mercado"} - ${currency.format(Number(quote.arrobaPrice || 0))} (${quote.date || "sem data"})`
  })), "Usar preço manual");
  const priceInput = document.querySelector('#simulationForm [name="arrobaPrice"]');
  if (!priceInput.value) priceInput.value = db.settings.arrobaPrice;
  document.querySelector('#simulationForm [name="cdiAnnualRate"]').value = ((db.settings.cdiAnnualRate || 0) * 100).toFixed(2);
  document.querySelector('#simulationForm [name="ipcaAnnualRate"]').value = ((db.settings.ipcaAnnualRate || 0) * 100).toFixed(2);
  const managementReportForm = document.querySelector("#lotManagementReportForm");
  if (managementReportForm) {
    managementReportForm.arrobaPrice.value ||= db.settings.arrobaPrice;
    managementReportForm.cdiAnnualRate.value = ((db.settings.cdiAnnualRate || 0) * 100).toFixed(2);
    managementReportForm.ipcaAnnualRate.value = ((db.settings.ipcaAnnualRate || 0) * 100).toFixed(2);
  }
  document.querySelector('#auctionForm [name="cdiAnnualRate"]').value = ((db.settings.cdiAnnualRate || 0) * 100).toFixed(2);
  document.querySelector('#auctionForm [name="ipcaAnnualRate"]').value = ((db.settings.ipcaAnnualRate || 0) * 100).toFixed(2);
  const auctionPriceInput = document.querySelector('#auctionForm [name="arrobaPrice"]');
  if (!auctionPriceInput.value) auctionPriceInput.value = db.settings.arrobaPrice;
  document.querySelector('#loanForm [name="cdiAnnualRate"]').value = ((db.settings.cdiAnnualRate || 0) * 100).toFixed(2);
  document.querySelector('#loanForm [name="ipcaAnnualRate"]').value = ((db.settings.ipcaAnnualRate || 0) * 100).toFixed(2);
  const loanPriceInput = document.querySelector('#loanForm [name="arrobaPrice"]');
  if (!loanPriceInput.value) loanPriceInput.value = db.settings.arrobaPrice;
  if (simulationSnapshot) restoreSimulationForm(simulationSnapshot);
  syncSimulationMode();
  await renderAll();
}

function restoreSimulationForm(values) {
  const form = document.querySelector("#simulationForm");
  for (const [key, value] of Object.entries(values)) {
    const field = form.elements[key];
    if (!field || value === undefined || Array.isArray(value)) continue;
    field.value = value;
  }
}

function resetSimulationInputsForPurchase() {
  const form = document.querySelector("#simulationForm");
  form.reset();
  form.lotId.value = "";
  form.scenarioName.value = "";
  form.quantity.value = 1;
  form.purchaseArrobas.value = 6.5;
  form.currentArrobas.value = 6.5;
  form.purchasePricePerHead.value = "";
  form.purchasePricePerArroba.value = "";
  form.freightTotal.value = 0;
  form.commissionRate.value = 0;
  form.acquisitionLaborTotal.value = 0;
  form.initialCostsTotal.value = 0;
  form.mortalityRate.value = 0;
  form.targetArrobas.value = 10.5;
  form.gmdKgDay.value = 0.5;
  form.arrobaPrice.value = db?.settings?.arrobaPrice || 330;
  form.arrobaCategory.value = "mixed";
  form.futureArrobaChange.value = 0;
  form.fortisPercentPv.value = 0.1;
  form.comigoPercentPv.value = 0.3;
  form.operatingCostPerHeadDay.value = 0;
  form.landOwnCostMonth.value = 0;
  form.cdiAnnualRate.value = ((db?.settings?.cdiAnnualRate || 0) * 100).toFixed(2);
  form.ipcaAnnualRate.value = ((db?.settings?.ipcaAnnualRate || 0) * 100).toFixed(2);
  form.discountRate.value = "";
  syncSimulationMode();
  clearSimulation();
}

function resetExpenseForm() {
  const form = document.querySelector("#expenseForm");
  form.reset();
  form.date.value = todayIso();
  document.querySelector("#receiptPreviewInline").innerHTML = "";
  document.querySelector("#receiptOcrResult").innerHTML = "";
  document.querySelector("#expenseLotSelect").disabled = true;
  Array.from(document.querySelector("#expenseLotSelect").options).forEach((option) => { option.selected = false; });
}

function validateExpensePayload(payload) {
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) return "Informe um valor de despesa maior que zero.";
  if (!String(payload.description || "").trim()) return "Informe uma descrição para a despesa.";
  if (payload.expenseCategoryId && !db.expenseCategories.some((category) => category.id === payload.expenseCategoryId)) return "Categoria de despesa não encontrada.";
  if (payload.allocationMode === "specific_lots") {
    if (!payload.lotIds.length) return "Selecione ao menos um lote para este rateio.";
    const inactiveLot = payload.date
      ? payload.lotIds.map((lotId) => db.lots.find((lot) => lot.id === lotId)).find((lot) => lot?.entryDate && String(lot.entryDate) > String(payload.date))
      : null;
    if (inactiveLot) return `O lote ${inactiveLot.name || inactiveLot.id} entrou depois da data da despesa. Ajuste a data ou o rateio.`;
  }
  if (payload.allocationMode === "all_lots_by_headcount" && payload.date) {
    const activeLots = db.lots.filter((lot) => !lot.entryDate || String(lot.entryDate) <= String(payload.date));
    if (!activeLots.length) return "Nenhum lote estava ativo na data da despesa.";
  }
  return "";
}

async function renderReceiptInlinePreview(file) {
  const target = document.querySelector("#receiptPreviewInline");
  if (!target) return;
  if (!file) {
    target.innerHTML = "";
    return;
  }
  const dataUrl = await fileAsDataUrl(file);
  target.innerHTML = `
    <img src="${dataUrl}" alt="Prévia da nota selecionada" />
    <div>
      <strong>${escapeHtml(file.name || "Nota fotografada")}</strong>
      <span>${number.format((file.size || 0) / 1024)} KB prontos para salvar</span>
    </div>
  `;
}

function resetQuoteForm() {
  const form = document.querySelector("#quoteForm");
  form.reset();
  form.arrobaPrice.value = "";
}

async function createEntity(entity, payload) {
  try {
    await api(`/api/${entity}`, { method: "POST", body: JSON.stringify(payload) });
    await refresh();
    showToast(`${entityLabels[entity] || "Registro"} salvo`, "Dados gravados e tela atualizada.");
  } catch (error) {
    showToast("Não foi possível salvar", error.message, "error");
    throw error;
  }
}

async function updateEntity(entity, id, payload) {
  try {
    await api(`/api/${entity}/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    await refresh();
    showToast(`${entityLabels[entity] || "Registro"} atualizado`, "Alteração gravada com sucesso.");
  } catch (error) {
    showToast("Não foi possível atualizar", error.message, "error");
    throw error;
  }
}

async function deleteEntity(entity, id) {
  await api(`/api/${entity}/${id}`, { method: "DELETE" });
  await refresh();
  showToast(`${entityLabels[entity] || "Registro"} excluído`, "O item saiu da base local.");
}

async function deleteSimulationsBulk(payload) {
  const result = await api("/api/simulations/bulk-delete", { method: "POST", body: JSON.stringify(payload) });
  await refresh();
  showToast("Histórico atualizado", `${result.deleted || 0} simulação(ões) excluída(s).`);
  return result;
}

function coerceEditPayload(entity, payload) {
  const numericFields = new Set(["code", "quantity", "purchaseArrobas", "currentArrobas", "purchasePricePerHead", "estimatedAgeMonths", "amount", "areaHa", "carryingCapacityHeadHa", "arrobaPrice", "bagPrice", "bagKg", "defaultPercentPv", "year", "averageArrobaPrice", "weightKg"]);
  for (const [key, value] of Object.entries(payload)) {
    if (numericFields.has(key)) payload[key] = value === "" ? null : parseNumericInput(value);
  }
  if (entity === "lots" && Number(payload.purchaseArrobas || 0) > 1 && Number(payload.currentArrobas || 0) > 0 && Number(payload.currentArrobas || 0) < 1) {
    throw new Error("@ atual menor que 1@ parece erro de conversão. Informe a arroba viva atual do lote, por exemplo 7 ou 9.");
  }
  if (payload.defaultPercentPv !== undefined && payload.defaultPercentPv !== null) payload.defaultPercentPv = payload.defaultPercentPv / 100;
  if (entity === "expenses") {
    payload.lotIds = Array.isArray(payload.lotIds) ? payload.lotIds.filter(Boolean) : payload.lotIds ? [payload.lotIds] : [];
    payload.lotId = payload.lotIds[0] || "";
    if (payload.allocationMode === "all_lots_by_headcount") {
      payload.lotIds = [];
      payload.lotId = "";
    }
  }
  return payload;
}

function editInput([key, label, type], value) {
  if (type === "textarea") return `<label class="full">${label}<textarea name="${key}" rows="3">${value ?? ""}</textarea></label>`;
  if (type === "lot" || type === "lotOptional") {
    const blank = type === "lotOptional" ? '<option value="">Geral</option>' : "";
    return `<label>${label}<select name="${key}">${blank}${db.lots.map((lot) => `<option value="${lot.id}" ${lot.id === value ? "selected" : ""}>${lot.name}</option>`).join("")}</select></label>`;
  }
  if (type === "allocationMode") return `<label>${label}<select name="${key}"><option value="all_lots_by_headcount" ${value === "all_lots_by_headcount" || !value ? "selected" : ""}>Todos os lotes por cabeça</option><option value="specific_lots" ${value === "specific_lots" || value === "specific_lot" ? "selected" : ""}>Lotes selecionados por cabeça</option></select></label>`;
  if (type === "lotsMultiple") {
    const values = new Set(Array.isArray(value) ? value : editContext ? expenseLotIds(db[editContext.entity].find((item) => item.id === editContext.id) || {}) : []);
    return `<label class="full">${label}<select name="${key}" multiple size="5">${db.lots.map((lot) => `<option value="${lot.id}" ${values.has(lot.id) ? "selected" : ""}>${lot.name}</option>`).join("")}</select></label>`;
  }
  if (type === "animal") return `<label>${label}<select name="${key}">${db.animals.map((animal) => `<option value="${animal.id}" ${animal.id === value ? "selected" : ""}>${animal.tag || `Animal ${animal.code || ""}`}</option>`).join("")}</select></label>`;
  if (type === "expenseCategory") return `<label>${label}<select name="${key}">${db.expenseCategories.map((category) => `<option value="${category.id}" ${category.id === value ? "selected" : ""}>${category.group} - ${category.name}</option>`).join("")}</select></label>`;
  if (type === "pasture") return `<label>${label}<select name="${key}">${db.pastures.map((pasture) => `<option value="${pasture.id}" ${pasture.id === value ? "selected" : ""}>${pasture.name}</option>`).join("")}</select></label>`;
  if (type === "movementType") return `<label>${label}<select name="${key}">${["Entrada", "Saída"].map((option) => `<option ${option === value ? "selected" : ""}>${option}</option>`).join("")}</select></label>`;
  if (type === "animalSex") return `<label>${label}<select name="${key}">${Object.entries(arrobaCategoryLabels).map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${optionValue === (value || "mixed") ? "selected" : ""}>${optionLabel}</option>`).join("")}</select></label>`;
  if (type === "percentPv") return `<label>${label}<input name="${key}" type="number" step="0.1" value="${value === undefined || value === null ? "" : Number(value) * 100}" /></label>`;
  const step = type === "number" ? ' step="0.01"' : "";
  return `<label>${label}<input name="${key}" type="${type}"${step} value="${value ?? ""}" /></label>`;
}

function openEditDialog(entity, id) {
  const record = db[entity].find((item) => item.id === id);
  if (!record) return;
  editContext = { entity, id };
  document.querySelector("#editTitle").textContent = `Editar ${entity}`;
  document.querySelector("#editFields").innerHTML = editSchemas[entity].map((field) => editInput(field, record[field[0]])).join("");
  document.querySelector("#editDialog").showModal();
}

function openSimulationDialog(id) {
  const item = db.simulations.find((simulation) => simulation.id === id);
  if (!item) return;
  document.querySelector("#simulationDetails").innerHTML = simulationReport(item);
  document.querySelector("#simulationDialog").showModal();
}

function openReceiptDialog(id) {
  const expense = db.expenses.find((item) => item.id === id);
  if (!expense?.receiptDataUrl) return;
  document.querySelector("#receiptPreview").src = expense.receiptDataUrl;
  document.querySelector("#receiptDialog").showModal();
}

function openWeighingPhotoDialog(id) {
  const weighing = db.animalWeighings.find((item) => item.id === id);
  if (!weighing?.photoDataUrl) return;
  document.querySelector("#receiptPreview").src = weighing.photoDataUrl;
  document.querySelector("#receiptDialog h2").textContent = "Foto da pesagem";
  document.querySelector("#receiptDialog").showModal();
}

function openLotWeighingPhotoDialog(id) {
  const weighing = db.lotWeighings.find((item) => item.id === id);
  if (!weighing?.photoDataUrl) return;
  document.querySelector("#receiptPreview").src = weighing.photoDataUrl;
  document.querySelector("#receiptDialog h2").textContent = "Foto da pesagem do lote";
  document.querySelector("#receiptDialog").showModal();
}

function applyProjectedArrobaPrice(event = null) {
  const quoteId = document.querySelector("#simulationQuoteSelect").value;
  const simulationForm = document.querySelector("#simulationForm");
  const priceInput = simulationForm.querySelector('[name="arrobaPrice"]');
  if (!quoteId) {
    if (event?.type === "change") priceInput.value = "";
    return;
  }
  const quote = db.marketQuotes.find((item) => item.id === quoteId);
  const change = parseNumericInput(simulationForm.querySelector('[name="futureArrobaChange"]').value || 0) / 100;
  if (quote) {
    simulationForm.querySelector('[name="arrobaCategory"]').value = quote.animalSex || "mixed";
    priceInput.value = (Number(quote.arrobaPrice || 0) * (1 + change)).toFixed(2);
  }
}

document.querySelectorAll("[data-view]").forEach((item) => {
  item.addEventListener("click", () => {
    setView(item.dataset.view);
    if (item.dataset.lotContext && item.dataset.view === "simulate") {
      const select = document.querySelector("#lotSelect");
      select.value = item.dataset.lotContext;
      select.dispatchEvent(new Event("change"));
    }
  });
});

document.querySelector("#sidebarToggle")?.addEventListener("click", () => {
  setSidebarCollapsed(!sidebarCollapsed);
});
document.querySelectorAll("[data-module-tab]").forEach((button) => {
  button.addEventListener("click", () => setModuleTab(button.dataset.moduleGroup, button.dataset.moduleTab));
});
document.querySelector("#refreshBtn").addEventListener("click", refresh);
document.querySelector("#backupDbBtn").addEventListener("click", async () => {
  const backup = await api("/api/admin/backup-db");
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fazenda-slf-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Backup gerado", "Arquivo JSON baixado para o seu computador.");
});
document.querySelector("#restoreDbBtn").addEventListener("click", () => {
  document.querySelector("#restoreDbInput").click();
});
document.querySelector("#restoreDbInput").addEventListener("change", async (event) => {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = "";
  if (!file) return;
  if (!confirm("Restaurar este backup vai substituir o banco atual deste ambiente. Deseja continuar?")) return;
  const payload = JSON.parse(await file.text());
  const result = await api("/api/admin/restore-db", { method: "POST", body: JSON.stringify(payload) });
  await refresh();
  showToast("Banco restaurado", `${result.lots} lotes, ${result.expenses} despesas e ${result.simulations} simulações carregadas.`);
});
document.querySelector("#auctionForm").addEventListener("submit", compareAuctionLots);
document.querySelector("#loanForm").addEventListener("submit", simulateLoan);
document.querySelector("#refreshExecutiveReportBtn")?.addEventListener("click", renderExecutiveReport);
document.querySelector("#printExecutiveReportBtn")?.addEventListener("click", () => {
  document.body.classList.add("printing-management-report");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-management-report"), 500);
});
document.querySelector("#decisionBriefForm")?.addEventListener("submit", generateDecisionBrief);
document.querySelector("#analyzeReceiptBtn")?.addEventListener("click", analyzeReceiptOcr);
document.querySelector("#deleteSelectedSimulationsBtn").addEventListener("click", async () => {
  const ids = Array.from(document.querySelectorAll("[data-simulation-select]:checked")).map((item) => item.value);
  if (!ids.length) {
    showToast("Nada selecionado", "Selecione ao menos uma simulação para excluir.", "warn");
    return;
  }
  const ok = window.confirm(`Excluir ${ids.length} simulação(ões) selecionada(s)?`);
  if (ok) await deleteSimulationsBulk({ ids });
});
document.querySelector("#deleteAllSimulationsBtn").addEventListener("click", async () => {
  const ok = window.confirm("Excluir todo o histórico de simulações? Esta ação não pode ser desfeita.");
  if (ok) await deleteSimulationsBulk({ all: true });
});
document.querySelector("#expenseCategorySelect").addEventListener("change", () => {
  const category = db.expenseCategories.find((item) => item.id === document.querySelector("#expenseCategorySelect").value);
  const description = document.querySelector('#expenseForm [name="description"]');
  if (category && !description.value) description.value = category.name;
});
document.querySelector("#expenseAllocationMode").addEventListener("change", () => {
  const lotSelect = document.querySelector("#expenseLotSelect");
  const allLots = document.querySelector("#expenseAllocationMode").value === "all_lots_by_headcount";
  lotSelect.disabled = allLots;
  if (allLots) Array.from(lotSelect.options).forEach((option) => { option.selected = false; });
});
document.querySelector('#expenseForm [name="receipt"]').addEventListener("change", async (event) => {
  await renderReceiptInlinePreview(event.currentTarget.files?.[0]);
});
["expenseSearch", "expenseDateFrom", "expenseDateTo", "expenseAmountMin", "expenseAmountMax"].forEach((id) => {
  document.querySelector(`#${id}`)?.addEventListener("input", renderCosts);
});
["expenseCategoryFilter", "expenseLotFilter", "expenseSort"].forEach((id) => {
  document.querySelector(`#${id}`)?.addEventListener("change", renderCosts);
});
document.querySelector("#clearExpenseFilters")?.addEventListener("click", () => {
  ["expenseSearch", "expenseDateFrom", "expenseDateTo", "expenseAmountMin", "expenseAmountMax"].forEach((id) => {
    const field = document.querySelector(`#${id}`);
    if (field) field.value = "";
  });
  const categoryFilter = document.querySelector("#expenseCategoryFilter");
  const lotFilter = document.querySelector("#expenseLotFilter");
  const sort = document.querySelector("#expenseSort");
  if (categoryFilter) categoryFilter.value = "";
  if (lotFilter) lotFilter.value = "";
  if (sort) sort.value = "date-desc";
  renderCosts();
});
document.querySelector("#lotManagementReportForm")?.addEventListener("submit", generateLotManagementReport);
document.querySelector("#printManagementReportBtn")?.addEventListener("click", () => {
  const report = document.querySelector("#lotManagementReport");
  if (!report?.innerHTML.trim()) {
    showToast("Relatório vazio", "Gere um relatório antes de imprimir.", "warn");
    return;
  }
  document.body.classList.add("printing-management-report");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-management-report"), 500);
});
function syncSimulationMode() {
  const form = document.querySelector("#simulationForm");
  const hasLot = Boolean(form.lotId.value);
  const isPurchase = !hasLot;
  const title = document.querySelector("#view-simulate .decision-panel > .section-head h2");
  const subtitle = document.querySelector("#view-simulate .decision-panel > .section-head span");
  if (title) title.textContent = isPurchase ? "Viabilidade de compra" : "Hipótese de venda";
  if (subtitle) subtitle.textContent = isPurchase ? "Compra, custo futuro, margem e ROI" : "GMD, meta e suplementação";
  document.querySelector("#simulationBasisField").hidden = isPurchase;
  document.querySelector("#currentArrobasField").hidden = isPurchase;
  document.querySelector("#purchaseArrobaPriceField").hidden = !isPurchase;
  document.querySelector("#arrobaCategoryField").hidden = isPurchase;
  document.querySelector("#marketQuoteField").hidden = isPurchase;
  document.querySelector("#futureArrobaChangeField").hidden = isPurchase;
  form.simulationBasis.value = isPurchase ? "current" : form.simulationBasis.value;
  form.simulationBasis.disabled = isPurchase;
  if (isPurchase) {
    form.currentArrobas.value = form.purchaseArrobas.value || form.currentArrobas.value;
    updatePurchasePricePerArroba();
  }
}
function updatePurchasePricePerArroba() {
  const form = document.querySelector("#simulationForm");
  if (form.lotId.value) return;
  const purchaseValue = parseNumericInput(form.purchasePricePerHead.value || 0);
  const purchaseArrobas = parseNumericInput(form.purchaseArrobas.value || 0);
  form.purchasePricePerArroba.value = purchaseValue > 0 && purchaseArrobas > 0 ? (purchaseValue / purchaseArrobas).toFixed(2) : "";
}
document.querySelector('#simulationForm [name="purchaseArrobas"]').addEventListener("input", () => {
  const form = document.querySelector("#simulationForm");
  if (!form.lotId.value) form.currentArrobas.value = form.purchaseArrobas.value;
  updatePurchasePricePerArroba();
});
document.querySelector('#simulationForm [name="purchasePricePerHead"]').addEventListener("input", updatePurchasePricePerArroba);
document.querySelector("#lotSelect").addEventListener("change", () => {
  const lot = db.lots.find((item) => item.id === document.querySelector("#lotSelect").value);
  if (!lot) {
    resetSimulationInputsForPurchase();
    syncSimulationMode();
    renderSelectedLotContext(null);
    return;
  }
  clearSimulation();
  const simulationForm = document.querySelector("#simulationForm");
  simulationForm.simulationBasis.disabled = false;
  simulationForm.querySelector('[name="scenarioName"]').value = lot.name;
  simulationForm.querySelector('[name="quantity"]').value = lot.quantity || 1;
  simulationForm.querySelector('[name="purchaseArrobas"]').value = lot.purchaseArrobas || lot.currentArrobas || 0;
  simulationForm.querySelector('[name="currentArrobas"]').value = lot.currentArrobas || 0;
  simulationForm.querySelector('[name="purchasePricePerHead"]').value = lot.purchasePricePerHead || 0;
  simulationForm.querySelector('[name="purchasePricePerArroba"]').value = "";
  simulationForm.querySelector('[name="arrobaCategory"]').value = "mixed";
  simulationForm.querySelector('[name="freightTotal"]').value = 0;
  simulationForm.querySelector('[name="commissionRate"]').value = 0;
  simulationForm.querySelector('[name="acquisitionLaborTotal"]').value = 0;
  simulationForm.querySelector('[name="initialCostsTotal"]').value = 0;
  simulationForm.querySelector('[name="landOwnCostMonth"]').value = 0;
  syncSimulationMode();
  renderSelectedLotContext(lot);
});
document.querySelector("#importCepeaBtn").addEventListener("click", async () => {
  const button = document.querySelector("#importCepeaBtn");
  button.textContent = "Importando...";
  button.disabled = true;
  try {
    await api("/api/market/cepea-latest", { method: "POST", body: "{}" });
    await refresh();
    showToast("Cotação importada", "Preço CEPEA atualizado no mercado.");
  } catch (error) {
    showToast("Falha ao importar CEPEA", error.message, "error");
  } finally {
    button.textContent = "Importar CEPEA atual";
    button.disabled = false;
  }
});
document.querySelector("#importBcbBtn").addEventListener("click", async () => {
  const button = document.querySelector("#importBcbBtn");
  button.textContent = "Importando...";
  button.disabled = true;
  try {
    await api("/api/financial/bcb-latest", { method: "POST", body: "{}" });
    await refresh();
    showToast("Indicadores importados", "CDI e IPCA atualizados na base.");
  } catch (error) {
    showToast("Falha ao importar BCB", error.message, "error");
  } finally {
    button.textContent = "Importar BCB";
    button.disabled = false;
  }
});
document.querySelector("#simulationQuoteSelect").addEventListener("change", applyProjectedArrobaPrice);
document.querySelector('#simulationForm [name="arrobaCategory"]').addEventListener("change", () => {
  const form = document.querySelector("#simulationForm");
  if (form.marketQuoteId.value) return;
  const quote = latestArrobaQuote(form.arrobaCategory.value);
  if (quote) form.arrobaPrice.value = Number(quote.arrobaPrice || 0).toFixed(2);
});
document.querySelector('#simulationForm [name="futureArrobaChange"]').addEventListener("input", applyProjectedArrobaPrice);
document.querySelector("#dashboardLotSelect").addEventListener("change", renderExecutiveDashboard);
window.addEventListener("resize", () => {
  if (document.querySelector("#view-overview").classList.contains("active") && db) renderExecutiveDashboard();
});

document.body.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, entity, id } = button.dataset;
  if (action === "edit") openEditDialog(entity, id);
  if (action === "viewSimulation") openSimulationDialog(id);
  if (action === "viewReceipt") openReceiptDialog(id);
  if (action === "viewWeighingPhoto") openWeighingPhotoDialog(id);
  if (action === "viewLotWeighingPhoto") openLotWeighingPhotoDialog(id);
  if (action === "simulateLot") {
    setView("simulate");
    const select = document.querySelector("#lotSelect");
    select.value = id;
    select.dispatchEvent(new Event("change"));
  }
  if (action === "gotoView") setView(id);
  if (action === "delete") {
    const ok = window.confirm("Excluir este registro? Esta ação remove o item do cadastro.");
    if (ok) await deleteEntity(entity, id);
  }
});

document.body.addEventListener("dblclick", (event) => {
  if (event.target.closest("button, input, select, textarea, a")) return;
  const row = event.target.closest("[data-row-action]");
  if (!row) return;
  const { rowAction, entity, id } = row.dataset;
  if (rowAction === "viewSimulation") openSimulationDialog(id);
  else if (rowAction === "edit") openEditDialog(entity, id);
});

document.querySelector("#closeEditBtn").addEventListener("click", () => document.querySelector("#editDialog").close());
document.querySelector("#cancelEditBtn").addEventListener("click", () => document.querySelector("#editDialog").close());
document.querySelector("#closeSimulationBtn").addEventListener("click", () => document.querySelector("#simulationDialog").close());
document.querySelector("#closeReceiptBtn").addEventListener("click", () => {
  document.querySelector("#receiptDialog h2").textContent = "Comprovante vinculado";
  document.querySelector("#receiptDialog").close();
});
document.querySelector("#editForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editContext) return;
  try {
    const payload = coerceEditPayload(editContext.entity, formData(event.currentTarget));
    await updateEntity(editContext.entity, editContext.id, payload);
    document.querySelector("#editDialog").close();
    editContext = null;
  } catch (error) {
    showToast("Edição não gravada", error.message, "error");
  }
});

document.querySelector("#simulationForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearSimulation();
  const form = event.currentTarget;
  const formSnapshot = formData(form);
  const payload = { ...formSnapshot };
  if (payload.marketQuoteId) applyProjectedArrobaPrice();
  const refreshedPayload = formData(form);
  Object.assign(payload, refreshedPayload);
  for (const key of ["quantity", "purchaseArrobas", "currentArrobas", "purchasePricePerHead", "purchasePricePerArroba", "freightTotal", "commissionRate", "acquisitionLaborTotal", "initialCostsTotal", "mortalityRate", "discountRate", "targetArrobas", "gmdKgDay", "arrobaPrice", "fortisPercentPv", "comigoPercentPv", "operatingCostPerHeadDay", "landOwnCostMonth", "futureArrobaChange", "cdiAnnualRate", "ipcaAnnualRate"]) {
    payload[key] = parseNumericInput(payload[key]);
  }
  if (!Number.isFinite(payload.arrobaPrice) || payload.arrobaPrice <= 0) {
    showToast("Preço inválido", "Informe um preço válido para a arroba.", "warn");
    return;
  }
  payload.fortisPercentPv = payload.fortisPercentPv / 100;
  payload.comigoPercentPv = payload.comigoPercentPv / 100;
  payload.commissionRate = payload.commissionRate / 100;
  payload.cdiAnnualRate = payload.cdiAnnualRate > 0 ? payload.cdiAnnualRate / 100 : Number(db?.settings?.cdiAnnualRate || 0);
  payload.ipcaAnnualRate = payload.ipcaAnnualRate > 0 ? payload.ipcaAnnualRate / 100 : Number(db?.settings?.ipcaAnnualRate || 0);
  payload.discountRate = payload.discountRate ? payload.discountRate / 100 : payload.cdiAnnualRate;
  payload.mortalityRate = payload.mortalityRate / 100;
  payload.operationType = payload.lotId ? "active" : "purchase";
  if (payload.operationType === "purchase") {
    payload.simulationBasis = "current";
    payload.currentArrobas = payload.purchaseArrobas;
    if (!payload.purchasePricePerHead || payload.purchasePricePerHead <= 0) {
      showToast("Valor de compra obrigatório", "Informe o valor de compra para simular a viabilidade.", "warn");
      return;
    }
    payload.purchasePricePerArroba = payload.purchaseArrobas > 0 ? payload.purchasePricePerHead / payload.purchaseArrobas : 0;
    delete payload.marketQuoteId;
    delete payload.futureArrobaChange;
  }
  if (!payload.lotId) delete payload.lotId;
  delete payload.marketQuoteId;
  delete payload.futureArrobaChange;
  const result = await api("/api/simulate", { method: "POST", body: JSON.stringify(payload) });
  renderSimulation(result);
  await refresh();
  restoreSimulationForm(formSnapshot);
  renderSimulation(result);
  showToast("Simulação calculada", result.recommendation || "Resultado econômico atualizado.");
});

document.querySelector("#lotForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = formData(event.currentTarget);
  payload.quantity = parseNumericInput(payload.quantity || 0);
  payload.purchaseArrobas = parseNumericInput(payload.purchaseArrobas || 0);
  payload.currentArrobas = parseNumericInput(payload.currentArrobas || 0);
  payload.purchasePricePerHead = parseNumericInput(payload.purchasePricePerHead || 0);
  payload.estimatedAgeMonths = payload.estimatedAgeMonths ? parseNumericInput(payload.estimatedAgeMonths) : null;
  await createEntity("lots", payload);
  event.currentTarget.reset();
  event.currentTarget.quantity.value = 1;
  event.currentTarget.purchaseArrobas.value = 6.5;
  event.currentTarget.currentArrobas.value = 7;
  event.currentTarget.purchasePricePerHead.value = 1950;
  setView("herd");
});

document.querySelector("#animalForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = formData(event.currentTarget);
  payload.currentArrobas = parseNumericInput(payload.currentArrobas || 0);
  await createEntity("animals", payload);
  event.currentTarget.reset();
  fillOptions(document.querySelector("#animalLotSelect"), db.lots);
});

document.querySelector("#weighingAnimalSelect").addEventListener("change", () => {
  const form = document.querySelector("#weighingForm");
  const animal = db.animals.find((item) => item.id === form.animalId.value);
  form.tagSnapshot.value = animal?.tag || "";
});

document.querySelector("#estimateWeightBtn").addEventListener("click", async () => {
  const form = document.querySelector("#weighingForm");
  const resultBox = document.querySelector("#aiWeightResult");
  const files = Array.from(form.animalPhoto.files || []);
  const animalId = form.animalId.value;
  if (!animalId) {
    showToast("Selecione um animal", "Escolha o animal antes de estimar o peso.", "warn");
    return;
  }
  if (!files.length) {
    showToast("Mídia necessária", "Anexe ao menos uma foto ou vídeo do animal.", "warn");
    return;
  }
  const button = document.querySelector("#estimateWeightBtn");
  button.textContent = "Analisando evidências...";
  button.disabled = true;
  resultBox.innerHTML = '<div class="metric"><span>IA por foto/vídeo</span><strong>Analisando...</strong></div>';
  try {
    const evidence = await visualEvidenceFromFiles(files, { maxImages: 30, maxFramesPerVideo: 10 });
    if (!evidence.imageDataUrls.length) throw new Error("Nenhuma imagem ou frame válido foi extraído.");
    const result = await api("/api/ai/weight-from-photo", {
      method: "POST",
      body: JSON.stringify({
        animalId,
        imageDataUrl: evidence.primaryDataUrl,
        imageDataUrls: evidence.imageDataUrls,
        evidenceSummary: evidence.evidenceSummary,
        notes: form.notes.value
      })
    });
    if (result.status === "missing_api_key") {
      resultBox.innerHTML = `<div class="metric signal warn"><span>IA por foto/vídeo</span><strong>Configurar API</strong><p>${result.detail}</p></div>`;
      return;
    }
    if (result.plausibility?.status !== "review") form.weightKg.value = Number(result.estimatedWeightKg || 0).toFixed(1);
    form.source.value = "IA por foto";
    const reviewNote = result.plausibility?.status === "review" ? " Revisar antes de gravar: estimativa fora da faixa plausível do cadastro/histórico." : "";
    const aiNote = `IA por foto/vídeo: ${Number(result.estimatedWeightKg || 0).toFixed(1)} kg (${result.confidence}). Evidências: ${evidence.evidenceSummary}.${reviewNote} ${result.reasoning || ""}`;
    form.notes.value = form.notes.value ? `${form.notes.value}\n${aiNote}` : aiNote;
    resultBox.innerHTML = [
      result.plausibility?.status === "review" ? `<div class="metric signal warn"><span>Revisão necessária</span><strong>Fora da faixa plausível</strong><p>${escapeHtml(result.plausibility.reason || "")}</p></div>` : "",
      metric("Peso estimado IA", `${number.format(result.estimatedWeightKg || 0)} kg`),
      metric("@ estimada", `${number.format(result.estimatedArrobas || 0)}@`),
      metric("Confiança", result.confidence || "baixa"),
      metric("Evidências", number.format(evidence.imageDataUrls.length)),
      result.plausibility?.referenceWeightKg ? metric("Referência cadastro", `${number.format(result.plausibility.referenceWeightKg)} kg`) : "",
      metric("Faixa estimada", `${number.format(result.minWeightKg || 0)} a ${number.format(result.maxWeightKg || 0)} kg`),
      mediaPreview(evidence)
    ].join("");
  } catch (error) {
    const quota = /quota|billing|plan/i.test(error.message);
    resultBox.innerHTML = `<div class="metric signal ${quota ? "warn" : "danger"}"><span>IA por foto/vídeo</span><strong>${quota ? "Crédito/API" : "Falha"}</strong><p>${quota ? "A API respondeu limite de quota ou faturamento. As mídias ficam anexadas na pesagem, mas o peso deve ser informado manualmente até regularizar os créditos." : error.message}</p></div>`;
  } finally {
    button.textContent = "Estimar peso por IA";
    button.disabled = false;
  }
});

document.querySelector("#estimateLotWeightBtn").addEventListener("click", async () => {
  const form = document.querySelector("#lotWeighingForm");
  const resultBox = document.querySelector("#aiLotWeightResult");
  const files = Array.from(form.lotPhoto.files || []);
  const lotId = form.lotId.value;
  if (!lotId) {
    showToast("Selecione um lote", "Escolha o lote antes de estimar o peso médio.", "warn");
    return;
  }
  if (!files.length) {
    showToast("Mídia necessária", "Anexe ao menos uma foto ou vídeo do lote.", "warn");
    return;
  }
  const button = document.querySelector("#estimateLotWeightBtn");
  button.textContent = "Analisando lote...";
  button.disabled = true;
  resultBox.innerHTML = '<div class="metric"><span>IA por foto/vídeo</span><strong>Analisando lote...</strong></div>';
  try {
    const evidence = await visualEvidenceFromFiles(files, { maxImages: 30, maxFramesPerVideo: 10 });
    if (!evidence.imageDataUrls.length) throw new Error("Nenhuma imagem ou frame válido foi extraído.");
    const result = await api("/api/ai/lot-weight-from-photo", {
      method: "POST",
      body: JSON.stringify({
        lotId,
        quantityEvaluated: parseNumericInput(form.quantityEvaluated.value || 0),
        imageDataUrl: evidence.primaryDataUrl,
        imageDataUrls: evidence.imageDataUrls,
        evidenceSummary: evidence.evidenceSummary,
        notes: form.notes.value
      })
    });
    if (result.status === "missing_api_key") {
      resultBox.innerHTML = `<div class="metric signal warn"><span>IA por foto/vídeo</span><strong>Configurar API</strong><p>${result.detail}</p></div>`;
      return;
    }
    if (result.plausibility?.status !== "review") form.averageWeightKg.value = Number(result.averageWeightKg || 0).toFixed(1);
    form.source.value = "IA por foto";
    const reviewNote = result.plausibility?.status === "review" ? " Revisar antes de gravar: estimativa fora da faixa plausível do cadastro/histórico." : "";
    const aiNote = `IA por foto/vídeo lote: ${Number(result.averageWeightKg || 0).toFixed(1)} kg médios (${result.confidence}). Evidências: ${evidence.evidenceSummary}.${reviewNote} Animais visíveis: ${result.visibleAnimals || "n/a"}. ${result.reasoning || ""}`;
    form.notes.value = form.notes.value ? `${form.notes.value}\n${aiNote}` : aiNote;
    resultBox.innerHTML = [
      result.plausibility?.status === "review" ? `<div class="metric signal warn"><span>Revisão necessária</span><strong>Fora da faixa plausível</strong><p>${escapeHtml(result.plausibility.reason || "")}</p></div>` : "",
      metric("Peso médio IA", `${number.format(result.averageWeightKg || 0)} kg`),
      metric("@ média", `${number.format(result.averageArrobas || 0)}@`),
      metric("Confiança", result.confidence || "baixa"),
      metric("Evidências", number.format(evidence.imageDataUrls.length)),
      result.plausibility?.referenceWeightKg ? metric("Referência cadastro", `${number.format(result.plausibility.referenceWeightKg)} kg`) : "",
      metric("Animais visíveis", number.format(result.visibleAnimals || 0)),
      mediaPreview(evidence)
    ].join("");
  } catch (error) {
    const quota = /quota|billing|plan/i.test(error.message);
    resultBox.innerHTML = `<div class="metric signal ${quota ? "warn" : "danger"}"><span>IA por foto/vídeo</span><strong>${quota ? "Crédito/API" : "Falha"}</strong><p>${quota ? "A API respondeu limite de quota ou faturamento. As mídias ficam anexadas na pesagem do lote, mas o peso médio deve ser informado manualmente até regularizar os créditos." : error.message}</p></div>`;
  } finally {
    button.textContent = "Estimar média do lote por IA";
    button.disabled = false;
  }
});

document.querySelector("#weighingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = formData(form);
  const animal = db.animals.find((item) => item.id === payload.animalId);
  const files = Array.from(form.animalPhoto.files || []);
  payload.weightKg = parseNumericInput(payload.weightKg || 0);
  payload.tagSnapshot = payload.tagSnapshot || animal?.tag || "";
  const evidence = files.length ? await visualEvidenceFromFiles(files, { maxImages: 12, maxFramesPerVideo: 4 }) : { mediaNames: [], imageDataUrls: [], primaryDataUrl: null };
  payload.photoName = evidence.mediaNames?.[0] || null;
  payload.photoDataUrl = evidence.primaryDataUrl;
  payload.photoDataUrls = evidence.imageDataUrls;
  payload.mediaNames = evidence.mediaNames;
  delete payload.animalPhoto;
  await createEntity("animalWeighings", payload);
  form.reset();
  document.querySelector("#aiWeightResult").innerHTML = "";
  fillOptions(document.querySelector("#weighingAnimalSelect"), db.animals, "Selecione um animal");
});

document.querySelector("#lotWeighingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = formData(form);
  const files = Array.from(form.lotPhoto.files || []);
  payload.quantityEvaluated = parseNumericInput(payload.quantityEvaluated || 0);
  payload.averageWeightKg = parseNumericInput(payload.averageWeightKg || 0);
  const evidence = files.length ? await visualEvidenceFromFiles(files, { maxImages: 12, maxFramesPerVideo: 4 }) : { mediaNames: [], imageDataUrls: [], primaryDataUrl: null };
  payload.photoName = evidence.mediaNames?.[0] || null;
  payload.photoDataUrl = evidence.primaryDataUrl;
  payload.photoDataUrls = evidence.imageDataUrls;
  payload.mediaNames = evidence.mediaNames;
  delete payload.lotPhoto;
  await createEntity("lotWeighings", payload);
  form.reset();
  document.querySelector("#aiLotWeightResult").innerHTML = "";
  fillOptions(document.querySelector("#lotWeighingLotSelect"), db.lots, "Selecione um lote");
});

document.querySelector("#expenseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = formData(event.currentTarget);
  const file = event.currentTarget.receipt.files[0];
  payload.amount = parseNumericInput(payload.amount || 0);
  payload.lotIds = Array.isArray(payload.lotIds) ? payload.lotIds : payload.lotIds ? [payload.lotIds] : [];
  payload.lotId = payload.lotIds[0] || "";
  if (payload.allocationMode === "all_lots_by_headcount") {
    payload.lotIds = [];
    payload.lotId = "";
  }
  const validationError = validateExpensePayload(payload);
  if (validationError) {
    showToast("Revise a despesa", validationError, "warn");
    return;
  }
  payload.receiptName = file?.name || null;
  payload.receiptDataUrl = await fileAsDataUrl(file);
  await createEntity("expenses", payload);
  resetExpenseForm();
});

document.querySelector("#pastureForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = formData(event.currentTarget);
  payload.areaHa = payload.areaHa ? parseNumericInput(payload.areaHa) : null;
  payload.carryingCapacityHeadHa = payload.carryingCapacityHeadHa ? parseNumericInput(payload.carryingCapacityHeadHa) : null;
  await createEntity("pastures", payload);
  event.currentTarget.reset();
});

document.querySelector("#movementForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await createEntity("pastureMovements", formData(event.currentTarget));
  event.currentTarget.reset();
  fillOptions(document.querySelector("#movementLotSelect"), db.lots);
  fillOptions(document.querySelector("#pastureSelect"), db.pastures);
});

document.querySelector("#quoteForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = formData(event.currentTarget);
  payload.arrobaPrice = parseNumericInput(payload.arrobaPrice || 0);
  await createEntity("marketQuotes", payload);
  resetQuoteForm();
});

document.querySelector("#testAiBtn").addEventListener("click", async () => {
  const result = await api("/api/ai/hypothesis", {
    method: "POST",
    body: JSON.stringify({ intent: "validate_market_and_sale_hypothesis", context: "cattle_operation" })
  });
  document.querySelector("#aiResult").textContent = JSON.stringify(result, null, 2);
});

async function init() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }
  if (!authToken) {
    showLogin();
    return;
  }
  try {
    await api("/api/auth/me");
  } catch {
    authToken = "";
    localStorage.removeItem("slfAuthToken");
    showLogin();
    return;
  }
  showApp();
  await refresh();
  clearSimulation();
}

document.querySelector("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  button.disabled = true;
  button.textContent = "Entrando...";
  document.querySelector("#loginMessage").textContent = "";
  try {
    const session = await api("/api/auth/login", { method: "POST", auth: false, body: JSON.stringify(formData(form)) });
    authToken = session.token;
    localStorage.setItem("slfAuthToken", authToken);
    showApp();
    await refresh();
    clearSimulation();
  } catch (error) {
    document.querySelector("#loginMessage").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Entrar";
  }
});

await init();
