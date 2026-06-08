import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const logPath = process.argv[2];
const outputPath = process.argv[3] || "outputs/iis-log-analysis.json";

if (!logPath) {
  console.error("Usage: node analyze_iis_log.mjs <log-path> [output-json]");
  process.exit(1);
}

function clean(value) {
  if (!value || value === "-") return "";
  return value.replace(/^"|"$/g, "");
}

function actionName(soapAction) {
  const value = clean(soapAction);
  if (!value) return "";
  return value.split("/").filter(Boolean).at(-1) || value;
}

function endpointKey(row) {
  const soap = actionName(row.soapAction);
  if (soap) return `SOAP:${soap}`;
  const query = row.query && row.query !== "-" ? `?${row.query}` : "";
  return `${row.method} ${row.uri}${query}`;
}

function uaFamily(userAgent) {
  const value = clean(userAgent);
  if (!value) return "sem user-agent";
  if (value.includes("Borland+SOAP")) return "Borland SOAP";
  if (value.includes("Apache-CXF")) return "Apache CXF";
  if (value.includes("Apache-HttpClient")) return "Apache HttpClient";
  if (value.includes("NuSOAP")) return "NuSOAP";
  if (value.includes("SOAP+Toolkit")) return "SOAP Toolkit";
  if (value.includes("InterSystems+IRIS")) return "InterSystems IRIS";
  if (value.includes("MS+Web+Services+Client")) return ".NET Web Services";
  if (value.includes("WinHttp")) return "WinHTTP";
  if (value.includes("Java/")) return "Java";
  if (value.includes("Mozilla")) return "Mozilla/legacy";
  return value.slice(0, 80);
}

function makeStats() {
  return {
    count: 0,
    totalMs: 0,
    minMs: Infinity,
    maxMs: 0,
    times: [],
    statuses: new Map(),
    slowCount1s: 0,
    slowCount5s: 0,
    slowCount10s: 0,
    errors: 0
  };
}

function addStats(stats, ms, status) {
  stats.count += 1;
  stats.totalMs += ms;
  stats.minMs = Math.min(stats.minMs, ms);
  stats.maxMs = Math.max(stats.maxMs, ms);
  stats.times.push(ms);
  stats.statuses.set(status, (stats.statuses.get(status) || 0) + 1);
  if (ms >= 1000) stats.slowCount1s += 1;
  if (ms >= 5000) stats.slowCount5s += 1;
  if (ms >= 10000) stats.slowCount10s += 1;
  if (status >= 400) stats.errors += 1;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function summarizeStats(stats) {
  const sorted = stats.times.sort((a, b) => a - b);
  return {
    count: stats.count,
    avgMs: stats.count ? stats.totalMs / stats.count : 0,
    p50Ms: percentile(sorted, 50),
    p90Ms: percentile(sorted, 90),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    minMs: stats.minMs === Infinity ? 0 : stats.minMs,
    maxMs: stats.maxMs,
    slowCount1s: stats.slowCount1s,
    slowCount5s: stats.slowCount5s,
    slowCount10s: stats.slowCount10s,
    errors: stats.errors,
    statuses: Object.fromEntries([...stats.statuses.entries()].sort((a, b) => a[0] - b[0]))
  };
}

function bump(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function topMap(map, limit = 20) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([key, count]) => ({ key, count }));
}

const globalStats = makeStats();
const byEndpoint = new Map();
const byUri = new Map();
const bySoap = new Map();
const byStatus = new Map();
const byClient = new Map();
const byUa = new Map();
const bySecond = new Map();
const byMinute = new Map();
const byHour = new Map();
const methodCounts = new Map();
const queryCounts = new Map();
const slowRows = [];
const errorRows = [];
let firstTs = null;
let lastTs = null;
let lineCount = 0;
let dataRows = 0;

function rememberTopRows(rows, row, limit = 30) {
  rows.push(row);
  rows.sort((a, b) => b.timeTaken - a.timeTaken);
  if (rows.length > limit) rows.length = limit;
}

const rl = createInterface({
  input: createReadStream(logPath),
  crlfDelay: Infinity
});

for await (const line of rl) {
  lineCount += 1;
  if (!line || line.startsWith("#")) continue;
  const parts = line.split(/\s+/);
  if (parts.length < 16) continue;
  const [
    date,
    time,
    serverIp,
    method,
    uri,
    query,
    port,
    username,
    clientIp,
    userAgent,
    referer,
    status,
    substatus,
    win32Status,
    timeTaken,
    soapAction
  ] = parts;
  const ts = `${date}T${time}Z`;
  firstTs = firstTs ? (ts < firstTs ? ts : firstTs) : ts;
  lastTs = lastTs ? (ts > lastTs ? ts : lastTs) : ts;
  const ms = Number(timeTaken || 0);
  const statusCode = Number(status || 0);
  const soap = actionName(soapAction);
  const key = endpointKey({ method, uri, query, soapAction });
  const row = {
    ts,
    method,
    uri,
    query,
    clientIp,
    userAgent: clean(userAgent),
    uaFamily: uaFamily(userAgent),
    status: statusCode,
    substatus: Number(substatus || 0),
    win32Status: Number(win32Status || 0),
    timeTaken: ms,
    soapAction: clean(soapAction),
    endpoint: key
  };

  dataRows += 1;
  addStats(globalStats, ms, statusCode);
  if (!byEndpoint.has(key)) byEndpoint.set(key, makeStats());
  addStats(byEndpoint.get(key), ms, statusCode);
  if (!byUri.has(`${method} ${uri}`)) byUri.set(`${method} ${uri}`, makeStats());
  addStats(byUri.get(`${method} ${uri}`), ms, statusCode);
  if (soap) {
    if (!bySoap.has(soap)) bySoap.set(soap, makeStats());
    addStats(bySoap.get(soap), ms, statusCode);
  }
  bump(byStatus, `${statusCode}.${row.substatus}.${row.win32Status}`);
  bump(byClient, clientIp);
  bump(byUa, row.uaFamily);
  bump(methodCounts, method);
  if (query && query !== "-") bump(queryCounts, `${uri}?${query}`);
  const second = `${date} ${time}`;
  const minute = second.slice(0, 16);
  const hour = second.slice(0, 13);
  bump(bySecond, second);
  bump(byMinute, minute);
  bump(byHour, hour);
  if (ms >= 5000) rememberTopRows(slowRows, row, 40);
  if (statusCode >= 400) {
    errorRows.push(row);
    if (errorRows.length > 200) errorRows.shift();
  }
}

function summarizeGroupMap(map, limit, sortBy = "count") {
  return [...map.entries()]
    .map(([key, stats]) => ({ key, ...summarizeStats(stats) }))
    .sort((a, b) => {
      if (sortBy === "p95") return b.p95Ms - a.p95Ms;
      if (sortBy === "max") return b.maxMs - a.maxMs;
      if (sortBy === "slow5s") return b.slowCount5s - a.slowCount5s;
      if (sortBy === "errors") return b.errors - a.errors;
      return b.count - a.count;
    })
    .slice(0, limit);
}

const seconds = [...bySecond.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
const minutes = [...byMinute.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

const report = {
  file: logPath,
  lineCount,
  dataRows,
  period: { firstTs, lastTs },
  global: summarizeStats(globalStats),
  methods: topMap(methodCounts, 10),
  statuses: topMap(byStatus, 20),
  clients: topMap(byClient, 20),
  userAgents: topMap(byUa, 20),
  queries: topMap(queryCounts, 30),
  topEndpointsByVolume: summarizeGroupMap(byEndpoint, 30, "count"),
  topSoapByVolume: summarizeGroupMap(bySoap, 30, "count"),
  topUriByVolume: summarizeGroupMap(byUri, 30, "count"),
  slowEndpointsP95: summarizeGroupMap(byEndpoint, 30, "p95"),
  slowEndpointsMax: summarizeGroupMap(byEndpoint, 30, "max"),
  endpointsWithErrors: summarizeGroupMap(byEndpoint, 30, "errors").filter((item) => item.errors > 0),
  topSeconds: seconds.map(([second, count]) => ({ second, count })),
  topMinutes: minutes.map(([minute, count]) => ({ minute, count })),
  hourlyVolume: [...byHour.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([hour, count]) => ({ hour, count })),
  slowRows,
  errorSample: errorRows.slice(-80)
};

writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  outputPath,
  dataRows,
  period: report.period,
  global: report.global,
  topEndpoint: report.topEndpointsByVolume[0],
  topSlow: report.slowRows[0],
  topErrorEndpoint: report.endpointsWithErrors[0]
}, null, 2));
