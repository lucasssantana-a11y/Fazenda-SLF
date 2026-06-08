import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });

const overviewTitle = await page.locator("#viewTitle").textContent();
await page.getByRole("button", { name: "Simular" }).click();
await page.waitForSelector("#view-simulate.active");
await page.getByRole("button", { name: "Calcular viabilidade" }).click();
await page.waitForSelector("#simulationResult .metric");
const metricCount = await page.locator("#simulationResult .metric").count();
const decisionText = await page.locator("#decisionSummary").innerText();
await page.screenshot({ path: "outputs/ux-simulador-overview.png", fullPage: true });
await browser.close();

console.log(JSON.stringify({ overviewTitle, metricCount, decisionText }, null, 2));
