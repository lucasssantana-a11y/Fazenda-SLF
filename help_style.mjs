import { Workbook } from "@oai/artifact-tool";
const workbook = Workbook.create();
console.log(JSON.stringify(await workbook.help("range"), null, 2).slice(0, 12000));
