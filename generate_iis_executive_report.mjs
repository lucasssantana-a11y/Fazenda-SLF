import { readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2] || "outputs/iis-log-analysis.json";
const output = process.argv[3] || "outputs/relatorio-executivo-visual-logs-iis.html";
const r = JSON.parse(readFileSync(input, "utf8"));

const fmt = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const dec = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const total = r.global.count;
const totalProcessingMin = r.global.avgMs * r.global.count / 60000;
const wsdlReq = r.queries.reduce((sum, item) => sum + item.count, 0);
const maxCount = Math.max(...r.topSoapByVolume.slice(0, 10).map((x) => x.count));
const maxTime = Math.max(...r.topSoapByVolume.slice(0, 10).map((x) => x.avgMs * x.count / 60000));

function ms(value) {
  if (value >= 1000) return `${dec.format(value / 1000)}s`;
  return `${fmt.format(Math.round(value))}ms`;
}

function minutes(value) {
  return `${fmt.format(Math.round(value))} min`;
}

function bar(width, label = "") {
  return `<div class="bar"><i style="width:${Math.max(1, Math.min(100, width))}%"></i>${label ? `<span>${label}</span>` : ""}</div>`;
}

function kpi(label, value, note = "") {
  return `<article class="kpi"><span>${label}</span><strong>${value}</strong>${note ? `<em>${note}</em>` : ""}</article>`;
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function row(cells) {
  return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
}

const topSoapRows = r.topSoapByVolume.slice(0, 12).map((x) => row([
  `<strong>${x.key}</strong>`,
  fmt.format(x.count),
  pct.format(x.count / total),
  ms(x.avgMs),
  ms(x.p95Ms),
  ms(x.p99Ms),
  ms(x.maxMs),
  fmt.format(x.slowCount5s)
]));

const offenderRows = r.topSoapByVolume
  .slice(0, 10)
  .map((x) => {
    const totalMin = x.avgMs * x.count / 60000;
    return row([
      `<strong>${x.key}</strong>`,
      minutes(totalMin),
      bar((totalMin / maxTime) * 100),
      x.slowCount5s ? fmt.format(x.slowCount5s) : "-",
      x.p99Ms >= 10000 ? "Cauda crítica" : x.p95Ms >= 5000 ? "P95 alto" : "Volume"
    ]);
  });

const volumeBars = r.topSoapByVolume.slice(0, 8).map((x) => `
  <div class="hbar-row">
    <span>${x.key}</span>
    ${bar((x.count / maxCount) * 100, fmt.format(x.count))}
  </div>
`).join("");

const latencyBars = r.slowEndpointsP95.slice(0, 8).map((x) => `
  <div class="hbar-row">
    <span>${x.key.replace("SOAP:", "")}</span>
    ${bar((x.p95Ms / r.slowEndpointsP95[0].p95Ms) * 100, ms(x.p95Ms))}
  </div>
`).join("");

const quickWins = [
  ["Corrigir health check `/worklab`", "9.036 erros 404 deixam de poluir monitoramento e logs.", "Baixo", "Imediato"],
  ["Criar `/health` leve e padronizar probes", "Remove `GET /` status 0 e evita bater em rota de negócio.", "Baixo", "Imediato"],
  ["Cachear WSDL/XSD nos clientes", `Pode cortar até ${fmt.format(wsdlReq)} chamadas de metadados (${pct.format(wsdlReq / total)} do volume observado).`, "Médio", "Alto"],
  ["Revisar POST com `?wsdl`", "Há 201.650 POSTs com query `wsdl`; provável erro de integração ou cliente SOAP mal configurado.", "Médio", "Alto"],
  ["Backoff em `ConsultaStatusAtendimento`", "Redução de 30% pouparia ~49,9 mil chamadas e ~411 min de processamento no período.", "Médio", "Alto"],
  ["Limite/paginação em `BuscaResultadosPorPeriodo`", "Baixo volume, mas p95 38s e p99 100s; reduz risco de travamento e timeout.", "Médio", "Alto"],
  ["Instrumentar tamanho do lote/payload", "Sem `cs-bytes/sc-bytes`, hoje não há medição real de payload.", "Baixo", "Médio"],
  ["Separar envio pesado em fila assíncrona", "`EnviaLaudoAtendimentoLista` concentra maior consumo e cauda máxima de 365s.", "Alto", "Muito alto"]
].map((x) => row(x));

const roadmap = [
  ["0-7 dias", "Infra e ruído", "Corrigir `/worklab`, `/`, criar health leve, cache headers para WSDL, dashboard de p95/p99 por SOAPAction.", "Menos erro falso, menor ruído, diagnóstico mais confiável."],
  ["7-30 dias", "Eficiência operacional", "Backoff em polling, cache WSDL nos clientes, limite de janela para buscas por período, logs de tamanho de lote.", "Menos requisições, menos CPU, menor latência percebida."],
  ["30-90 dias", "Arquitetura", "Fila para laudos/listas, paginação real, índices de banco, contratos V3 priorizados, migração de clientes legados.", "Redução real de infra necessária e estabilidade em picos."],
  ["90+ dias", "Produto/API", "Webhooks/push para status, SLA por cliente, rate limit inteligente, versionamento e descontinuação de clientes antigos.", "Escala com menos servidores e menor custo operacional."]
].map((x) => row(x));

const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Relatório Executivo - Logs IIS</title>
  <style>
    :root {
      --bg: #f4f7f5;
      --ink: #17211d;
      --muted: #65736d;
      --line: #d9e4de;
      --surface: #ffffff;
      --brand: #245f48;
      --brand2: #2b78a0;
      --amber: #a56a18;
      --danger: #a33d32;
      --soft: #e8f2ed;
      --shadow: 0 16px 42px rgba(20, 37, 30, .08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    }
    main { width: min(1380px, calc(100vw - 36px)); margin: 0 auto; padding: 28px 0 44px; }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(260px, .6fr);
      gap: 18px;
      align-items: end;
      padding: 26px;
      border-radius: 10px;
      background: linear-gradient(135deg, #14392b, #214d3c);
      color: #f7fffb;
      box-shadow: var(--shadow);
    }
    .hero h1 { margin: 0; font-size: clamp(30px, 4vw, 54px); letter-spacing: 0; line-height: 1; }
    .hero p { margin: 12px 0 0; max-width: 900px; color: #c9ddd4; font-weight: 700; line-height: 1.45; }
    .hero-meta { display: grid; gap: 8px; text-align: right; color: #c9ddd4; font-weight: 800; }
    .section { margin-top: 18px; display: grid; gap: 14px; }
    .section h2 { margin: 0; font-size: 22px; }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .kpi, .panel {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 10px;
      box-shadow: var(--shadow);
    }
    .kpi { padding: 16px; display: grid; gap: 8px; min-height: 118px; }
    .kpi span, th, .tag { color: var(--muted); font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .kpi strong { font-size: clamp(24px, 2.8vw, 38px); line-height: 1; }
    .kpi em { color: var(--muted); font-style: normal; font-weight: 700; }
    .panel { padding: 16px; min-width: 0; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .callout {
      border-left: 5px solid var(--brand);
      padding: 14px 16px;
      background: #fff;
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .callout.warn { border-left-color: var(--amber); }
    .callout.danger { border-left-color: var(--danger); }
    .callout strong { display: block; font-size: 18px; margin-bottom: 6px; }
    .callout p { margin: 0; color: var(--muted); line-height: 1.5; font-weight: 700; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; }
    th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { background: #f0f6f2; white-space: nowrap; }
    td { font-weight: 700; }
    tr:last-child td { border-bottom: 0; }
    .bar { position: relative; min-width: 110px; height: 22px; border-radius: 999px; background: #edf2ef; overflow: hidden; }
    .bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--brand), var(--brand2)); }
    .bar span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 11px; font-weight: 900; color: #0f1f18; }
    .hbar-row { display: grid; grid-template-columns: minmax(180px, 260px) 1fr; gap: 12px; align-items: center; margin: 9px 0; }
    .hbar-row > span { color: var(--muted); font-weight: 900; overflow-wrap: anywhere; }
    .actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .action { padding: 14px; border-radius: 10px; border: 1px solid var(--line); background: #fff; }
    .action strong { display: block; font-size: 16px; margin: 8px 0; }
    .action p { margin: 0; color: var(--muted); line-height: 1.4; font-weight: 700; }
    .tag { display: inline-flex; width: max-content; border-radius: 999px; padding: 5px 9px; background: var(--soft); color: var(--brand); }
    .footer { margin-top: 20px; color: var(--muted); font-size: 13px; font-weight: 700; }
    @media (max-width: 980px) {
      .hero, .grid-2, .kpis, .actions { grid-template-columns: 1fr; }
      .hero-meta { text-align: left; }
      .hbar-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
<main>
  <section class="hero">
    <div>
      <h1>Relatório Executivo de Logs IIS</h1>
      <p>Leitura gerencial de capacidade, lentidão, falhas e oportunidades de ganho para reduzir infraestrutura necessária e acelerar processamento.</p>
    </div>
    <div class="hero-meta">
      <span>Arquivo: u_ex260528_x.log</span>
      <span>Período: ${r.period.firstTs.replace("T", " ").replace("Z", "")} a ${r.period.lastTs.replace("T", " ").replace("Z", "")} UTC</span>
      <span>Fonte: IIS W3C + SOAPAction</span>
    </div>
  </section>

  <section class="section">
    <div class="kpis">
      ${kpi("Requisições", fmt.format(total), "6h27 de janela analisada")}
      ${kpi("p95 global", ms(r.global.p95Ms), `p99 ${ms(r.global.p99Ms)}`)}
      ${kpi(">= 5 segundos", fmt.format(r.global.slowCount5s), `${fmt.format(r.global.slowCount10s)} acima de 10s`)}
      ${kpi("WSDL/XSD", fmt.format(wsdlReq), pct.format(wsdlReq / total) + " do volume")}
    </div>
  </section>

  <section class="section grid-2">
    <article class="callout danger">
      <strong>Maior ofensor de capacidade: EnviaLaudoAtendimentoLista</strong>
      <p>Não é o maior volume, mas consome ~1.429 minutos de processamento, com p99 de ${ms(30246)} e máximo de ${ms(365605)}. É o primeiro alvo para ganho real de infraestrutura.</p>
    </article>
    <article class="callout warn">
      <strong>Erro recorrente de infraestrutura: /worklab health check</strong>
      <p>Foram ${fmt.format(9036)} respostas 404 em <code>/worklab/drvRastreabilidadePedido/valida/v1.0/check/true</code>. Corrigir isso limpa alertas falsos e reduz ruído operacional.</p>
    </article>
    <article class="callout">
      <strong>Polling domina o volume</strong>
      <p><code>ConsultaStatusAtendimento</code> representa ${pct.format(166167 / total)} de todas as chamadas. Um backoff de 30% pouparia ~49,9 mil chamadas e ~411 minutos de processamento no período.</p>
    </article>
    <article class="callout warn">
      <strong>Busca por período tem risco desproporcional</strong>
      <p><code>BuscaResultadosPorPeriodo</code> tem apenas 570 chamadas, mas p95 de ${ms(38046)}, p99 de ${ms(99994)} e máximo de ${ms(203564)}. Precisa de paginação, limite de janela e análise de índice.</p>
    </article>
  </section>

  <section class="section grid-2">
    <div class="panel">
      <h2>Volume por função</h2>
      ${volumeBars}
    </div>
    <div class="panel">
      <h2>Lentidão por p95</h2>
      ${latencyBars}
    </div>
  </section>

  <section class="section">
    <h2>Volume e latência por função SOAP</h2>
    ${table(["Função", "Volume", "% total", "Avg", "p95", "p99", "Máx", ">=5s"], topSoapRows)}
  </section>

  <section class="section">
    <h2>Maiores consumidores de capacidade</h2>
    ${table(["Função", "Tempo acumulado", "Peso visual", "Eventos >=5s", "Diagnóstico"], offenderRows)}
  </section>

  <section class="section">
    <h2>Ações de ganho imediato</h2>
    ${table(["Ação", "Ganho esperado", "Esforço", "Impacto"], quickWins)}
  </section>

  <section class="section">
    <h2>Proposta de ganho real</h2>
    <div class="actions">
      <article class="action">
        <span class="tag">Infra</span>
        <strong>Reduzir ruído e erro falso</strong>
        <p>Corrigir <code>/worklab</code>, criar <code>/health</code>, ajustar probes e remover status 0 de <code>GET /</code>.</p>
      </article>
      <article class="action">
        <span class="tag">Tráfego</span>
        <strong>Cortar metadados repetidos</strong>
        <p>Cache WSDL/XSD e revisar clientes com POST <code>?wsdl</code>. Potencial de reduzir até 41,9% do volume observado.</p>
      </article>
      <article class="action">
        <span class="tag">Aplicação</span>
        <strong>Assincronizar laudos/listas</strong>
        <p>Fila + protocolo de status para <code>EnviaLaudoAtendimentoLista</code>, reduzindo timeouts e p99 extremo.</p>
      </article>
      <article class="action">
        <span class="tag">Banco</span>
        <strong>Paginar buscas críticas</strong>
        <p>Limitar período, paginar e revisar índices para <code>BuscaResultadosPorPeriodo</code> e <code>BuscaProcedimentos</code>.</p>
      </article>
    </div>
  </section>

  <section class="section">
    <h2>Roadmap recomendado</h2>
    ${table(["Prazo", "Frente", "Ações", "Resultado esperado"], roadmap)}
  </section>

  <section class="section">
    <h2>Leitura final</h2>
    <article class="panel">
      <p><strong>Onde melhora mais rápido:</strong> corrigir health checks e WSDL/cache. Isso reduz volume artificial, melhora leitura operacional e pode diminuir carga sem tocar regra de negócio.</p>
      <p><strong>Onde melhora de verdade:</strong> atacar <code>EnviaLaudoAtendimentoLista</code>, <code>EnviaLaudoAtendimento</code>, <code>RecebeAtendimento</code> e <code>BuscaResultadosPorPeriodo</code>. Esses endpoints combinam volume, latência e cauda longa.</p>
      <p><strong>Onde faltam dados:</strong> tamanho real de payload, quantidade de registros por lote, cliente lógico, correlation-id e tempos internos de banco/serialização. Sem isso, dá para priorizar ofensores, mas ainda não dá para atribuir causa raiz com precisão cirúrgica.</p>
    </article>
  </section>

  <p class="footer">Relatório gerado a partir do JSON estruturado em <code>outputs/iis-log-analysis.json</code>. Como o log IIS não possui <code>cs-bytes</code>/<code>sc-bytes</code>, volume de dados foi estimado por requisições e tempo de processamento.</p>
</main>
</body>
</html>`;

writeFileSync(output, html);
console.log(output);
