import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const outputPath = "/Users/lucassantana/Documents/Codex/2026-05-04/voc-tem-acesso-as-minhas-conversas/outputs/simulador_recria_engorda_bezerras.xlsx";
const input = await FileBlob.load(outputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

for (const range of [
  "Recomendação final!A1:H18",
  "Resultado econômico!A1:AB18",
  "Sensibilidade da arroba!A1:O20",
  "Premissas!A1:D13",
]) {
  const inspected = await workbook.inspect({
    kind: "table",
    range,
    include: "values,formulas",
    tableMaxRows: 24,
    tableMaxCols: 28,
    summary: `Inspect ${range}`,
  });
  console.log(`\n--- ${range} ---`);
  console.log(inspected.ndjson);
}

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log("\n--- Errors ---");
console.log(errors.ndjson);

for (const sheetName of [
  "Recomendação final",
  "Resultado econômico",
  "Sensibilidade da arroba",
  "Lotes",
  "Cenários de GMD",
  "Insumos",
  "Premissas",
]) {
  await workbook.render({ sheetName, range: "A1:J25", scale: 1 });
  console.log(`Rendered ${sheetName}`);
}
