import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/lucassantana/Desktop/Planilha 1 - Calculo de Resultados Pecuarios v.2025_Lucas.xlsx";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook",
  summary: "Workbook structure",
});
console.log(summary.ndjson);

const sheets = workbook.worksheets.items.map((sheet) => sheet.name);
for (const name of sheets) {
  const preview = await workbook.inspect({
    kind: "table",
    range: `${name}!A1:L30`,
    include: "values,formulas,formats",
    tableMaxRows: 30,
    tableMaxCols: 12,
    summary: `Preview ${name}`,
  });
  console.log(`\n--- ${name} ---`);
  console.log(preview.ndjson);
}
