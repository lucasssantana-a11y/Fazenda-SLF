import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/lucassantana/Desktop/Planilha 1 - Calculo de Resultados Pecuarios v.2025_Lucas.xlsx";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

for (const sheet of workbook.worksheets.items) {
  const table = await workbook.inspect({
    kind: "table",
    range: `${sheet.name}!A1:W80`,
    include: "values,formulas",
    tableMaxRows: 80,
    tableMaxCols: 23,
    summary: `Full preview ${sheet.name}`,
  });
  console.log(`\n--- ${sheet.name} ---`);
  console.log(table.ndjson);
}

const formulas = await workbook.inspect({
  kind: "match",
  searchTerm: "=",
  options: { maxResults: 500, matchCase: false },
  summary: "Formula-like text search",
});
console.log("\n--- Formula search ---");
console.log(formulas.ndjson);
