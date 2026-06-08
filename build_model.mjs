import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/lucassantana/Documents/Codex/2026-05-04/voc-tem-acesso-as-minhas-conversas/outputs";
const outputPath = `${outputDir}/simulador_recria_engorda_bezerras.xlsx`;

const wb = Workbook.create();

function ws(name) {
  return wb.worksheets.add(name);
}

function set(sheet, range, values) {
  sheet.getRange(range).values = values;
}

function formulas(sheet, range, values) {
  sheet.getRange(range).formulas = values;
}

function styleTitle(sheet, range) {
  const r = sheet.getRange(range);
  r.merge();
  r.format.fill = "#1F4E3D";
  r.format.font = { color: "#FFFFFF", bold: true, size: 16 };
  r.format.horizontalAlignment = "center";
  r.format.rowHeightPx = 34;
}

function styleHeader(sheet, range) {
  const r = sheet.getRange(range);
  r.format.fill = "#DDEBE4";
  r.format.font = { bold: true, color: "#183A2D" };
  r.format.borders = { preset: "all", style: "thin", color: "#B7C9C0" };
  r.format.wrapText = true;
}

function styleBody(sheet, range) {
  const r = sheet.getRange(range);
  r.format.borders = { preset: "all", style: "thin", color: "#D9E2DE" };
  r.format.font = { color: "#26342F", size: 10 };
}

function money(sheet, range) {
  sheet.getRange(range).format.numberFormat = '"R$" #,##0.00';
}

function percent(sheet, range) {
  sheet.getRange(range).format.numberFormat = '0.0%';
}

function number(sheet, range, fmt = '#,##0.0') {
  sheet.getRange(range).format.numberFormat = fmt;
}

const prem = ws("Premissas");
styleTitle(prem, "A1:D1");
set(prem, "A1:D1", [["Premissas gerais do simulador", null, null, null]]);
set(prem, "A3:D13", [
  ["Premissa", "Valor", "Unidade", "Comentário"],
  ["Rendimento de carcaça padrão", 0.55, "%", "Editável; usado para converter arroba em peso vivo."],
  ["Kg por arroba de carcaça", 15, "kg", "Convenção de mercado."],
  ["Preço base da arroba", 330, "R$/@", "Cenário base de venda."],
  ["Dias por mês", 30, "dias", "Usado para custo mensal e ROI mensal."],
  ["Custo operacional diário adicional", 0, "R$/cab/dia", "Use para veterinário, manejo, mão de obra, terra etc."],
  ["Preço compra padrão", 1950, "R$/cab", "Usado quando o lote não tiver preço específico."],
  ["Capital e foco", "Lucro com giro rápido", "", "Evitar perseguir 12@ se reduzir margem ou aumentar risco de seca."],
  ["Data do modelo", new Date("2026-05-04T00:00:00"), "", "Modelo inicial criado a partir da planilha enviada."],
  ["Fonte do racional", "Planilha original + contexto operacional", "", "Mantém lógica de receita, reposição, suplemento e resultado."],
  ["Observação", "Campos verdes/claros são premissas editáveis", "", "Resultados recalculam no Excel."]
]);
styleHeader(prem, "A3:D3");
styleBody(prem, "A4:D13");
prem.getRange("A:A").format.columnWidthPx = 250;
prem.getRange("B:B").format.columnWidthPx = 155;
prem.getRange("C:C").format.columnWidthPx = 105;
prem.getRange("D:D").format.columnWidthPx = 440;
percent(prem, "B4:B4");
money(prem, "B6:B8");
prem.getRange("B11:B11").format.numberFormat = "dd/mm/yyyy";

const ins = ws("Insumos");
styleTitle(ins, "A1:H1");
set(ins, "A1:H1", [["Insumos e suplementação", null, null, null, null, null, null, null]]);
set(ins, "A3:H6", [
  ["Insumo", "Tipo", "Preço saco", "Peso saco kg", "Custo kg", "Uso técnico", "Fornecedor/Obs.", "Editável"],
  ["Fortis Seca", "Proteinado com ureia", 75.9, 25, null, "0,1% PV", "Seca / ativação ruminal", "Sim"],
  ["Comigo Corte", "Proteico-energética", 59.5, 30, null, "0,3% a 0,7% PV", "Reforço para engorda", "Sim"],
  ["Outros", "Opcional", 0, 1, null, "0% PV", "Campo reserva", "Sim"]
]);
formulas(ins, "E4:E6", [["=C4/D4"], ["=C5/D5"], ["=IF(D6=0,0,C6/D6)"]]);
styleHeader(ins, "A3:H3");
styleBody(ins, "A4:H6");
money(ins, "C4:C6");
money(ins, "E4:E6");
ins.getRange("A:H").format.columnWidthPx = 140;
ins.getRange("F:F").format.columnWidthPx = 175;
ins.getRange("G:G").format.columnWidthPx = 210;

const lotes = ws("Lotes");
styleTitle(lotes, "A1:J1");
set(lotes, "A1:J1", [["Cadastro de lotes/grupos", null, null, null, null, null, null, null, null, null]]);
set(lotes, "A3:J8", [
  ["Lote", "Qtd.", "@ atual", "Preço compra/cab", "PV atual kg", "Observação", "Perfil de decisão", "Ativo?", "Pasto", "Risco"],
  ["Lote maior - base 8,5@", 17, 8.5, 1950, null, "Cenário base visual", "Giro rápido", "Sim", "Secando", "Médio"],
  ["Lote maior - otimista 9@", 17, 9, 1950, null, "Cenário otimista visual", "Giro rápido", "Sim", "Secando", "Médio"],
  ["Grupo médio 7,75@", 0, 7.75, 1950, null, "Editar quantidade quando definida", "Intermediário", "Sim", "Secando", "Médio"],
  ["Bezerras pequenas 4@", 0, 4, 0, null, "Não forçar alto consumo", "Crescimento barato", "Sim", "Secando", "Alto"],
  ["Novo lote", 0, 0, 0, null, "Linha reserva", "A definir", "Não", "", ""]
]);
formulas(lotes, "E4:E8", [["=C4*Premissas!$B$5/Premissas!$B$4"], ["=C5*Premissas!$B$5/Premissas!$B$4"], ["=C6*Premissas!$B$5/Premissas!$B$4"], ["=C7*Premissas!$B$5/Premissas!$B$4"], ["=IF(C8=0,0,C8*Premissas!$B$5/Premissas!$B$4)"]]);
styleHeader(lotes, "A3:J3");
styleBody(lotes, "A4:J8");
number(lotes, "C4:E8", "0.00");
money(lotes, "D4:D8");
lotes.getRange("A:A").format.columnWidthPx = 210;
lotes.getRange("F:G").format.columnWidthPx = 230;

const gmd = ws("Cenários de GMD");
styleTitle(gmd, "A1:H1");
set(gmd, "A1:H1", [["Estratégias e cenários de ganho médio diário", null, null, null, null, null, null, null]]);
set(gmd, "A3:H19", [
  ["Estratégia", "Cenário GMD", "GMD kg/dia", "% Fortis PV", "% Comigo PV", "Custo esperado", "Risco seca", "Comentário"],
  ["Somente Fortis", "Pasto fraco", 0.1, 0.001, 0, "Baixo", "Alto", "Manutenção/crescimento lento na seca."],
  ["Somente Fortis", "Pasto médio", 0.3, 0.001, 0, "Baixo", "Médio", "Pode ser útil para pequenas."],
  ["Somente Fortis", "Pasto bom", 0.5, 0.001, 0, "Baixo", "Médio", "Depende muito de oferta de pasto."],
  ["Econômica", "Conservador", 0.4, 0.001, 0.003, "Médio", "Médio", "Fortis 0,1% + Comigo 0,3% PV."],
  ["Econômica", "Base", 0.5, 0.001, 0.003, "Médio", "Médio", "Compatível com histórico observado."],
  ["Econômica", "Bom", 0.6, 0.001, 0.003, "Médio", "Baixo", "Melhor resposta se pasto ainda sustentar."],
  ["Econômica", "Ótimo", 0.7, 0.001, 0.003, "Médio", "Baixo", "Mais otimista para a seca."],
  ["Intermediária", "Conservador", 0.55, 0.001, 0.005, "Médio/alto", "Médio", "Comigo 0,5% PV."],
  ["Intermediária", "Base", 0.7, 0.001, 0.005, "Médio/alto", "Médio", "Busca reduzir dias até venda."],
  ["Intermediária", "Bom", 0.85, 0.001, 0.005, "Médio/alto", "Baixo", "Requer resposta de pasto."],
  ["Intermediária", "Ótimo", 0.95, 0.001, 0.005, "Médio/alto", "Baixo", "Cenário agressivo de resposta."],
  ["Agressiva", "Conservador", 0.7, 0.001, 0.007, "Alto", "Médio", "Comigo 0,7% PV."],
  ["Agressiva", "Base", 0.85, 0.001, 0.007, "Alto", "Médio", "Giro maior com custo diário maior."],
  ["Agressiva", "Bom", 1, 0.001, 0.007, "Alto", "Baixo", "Depende de manejo e adaptação."],
  ["Agressiva", "Ótimo", 1.1, 0.001, 0.007, "Alto", "Baixo", "Use com cautela em bezerras pequenas."]
]);
styleHeader(gmd, "A3:H3");
styleBody(gmd, "A4:H19");
number(gmd, "C4:E19", "0.000");
gmd.getRange("A:H").format.columnWidthPx = 145;
gmd.getRange("H:H").format.columnWidthPx = 260;

const venda = ws("Cenários de venda");
styleTitle(venda, "A1:E1");
set(venda, "A1:E1", [["Metas de venda e preço da arroba", null, null, null, null]]);
set(venda, "A3:E8", [
  ["Meta @", "Tipo", "Preço @ base", "Comentário", "Ativa?"],
  [8.5, "Venda imediata/base", 330, "Usado para comparar vender agora com 8,5@.", "Sim"],
  [9, "Venda imediata/otimista", 330, "Usado para comparar vender agora com 9@.", "Sim"],
  [10.5, "Giro rápido", 330, "Meta sugerida para lote maior.", "Sim"],
  [11, "Giro rápido+", 330, "Meta provável de equilíbrio giro/lucro.", "Sim"],
  [12, "Alongado", 330, "Não perseguir automaticamente.", "Sim"]
]);
styleHeader(venda, "A3:E3");
styleBody(venda, "A4:E8");
money(venda, "C4:C8");
venda.getRange("A:E").format.columnWidthPx = 170;
venda.getRange("D:D").format.columnWidthPx = 280;

const result = ws("Resultado econômico");
styleTitle(result, "A1:AB1");
set(result, "A1:AB1", [["Motor econômico por lote, estratégia, GMD e meta de venda", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]]);
const headers = ["Lote", "Estratégia", "Cenário GMD", "Meta @", "Preço @", "Qtd.", "@ atual", "PV atual kg", "PV alvo kg", "Kg vivos faltantes", "GMD kg/d", "Dias", "Fortis kg/d", "Comigo kg/d", "Custo alim/dia", "Custo alim/mês", "Custo alim acumulado", "Custo operacional acum.", "Receita/cab", "Receita total", "Lucro/cab", "Lucro total", "Margem %", "Custo alim/@ prod.", "ROI", "ROI mensal", "Risco seca", "Sinal"];
set(result, "A3:AB3", [headers]);
const lots = ["Lote maior - base 8,5@", "Lote maior - otimista 9@", "Grupo médio 7,75@", "Bezerras pequenas 4@"];
const strategies = ["Somente Fortis", "Econômica", "Intermediária", "Agressiva"];
const gmdScenarios = ["Conservador", "Base", "Bom", "Ótimo"];
const targets = [8.5, 9, 10.5, 11, 12];
const rows = [];
for (const lote of lots) {
  for (const estrategia of strategies) {
    for (const cenario of gmdScenarios) {
      for (const target of targets) {
        if (estrategia === "Somente Fortis" && cenario === "Conservador") rows.push([lote, estrategia, "Pasto fraco", target]);
        else if (estrategia === "Somente Fortis" && cenario === "Base") rows.push([lote, estrategia, "Pasto médio", target]);
        else if (estrategia === "Somente Fortis" && cenario === "Bom") rows.push([lote, estrategia, "Pasto bom", target]);
        else if (estrategia !== "Somente Fortis") rows.push([lote, estrategia, cenario, target]);
      }
    }
  }
}
set(result, `A4:D${rows.length + 3}`, rows);
const fRows = [];
for (let r = 4; r <= rows.length + 3; r++) {
  fRows.push([
    "=Premissas!$B$6",
    `=XLOOKUP(A${r},Lotes!$A$4:$A$8,Lotes!$B$4:$B$8,0)`,
    `=XLOOKUP(A${r},Lotes!$A$4:$A$8,Lotes!$C$4:$C$8,0)`,
    `=G${r}*Premissas!$B$5/Premissas!$B$4`,
    `=D${r}*Premissas!$B$5/Premissas!$B$4`,
    `=MAX(0,I${r}-H${r})`,
    `=SUMIFS('Cenários de GMD'!$C$4:$C$19,'Cenários de GMD'!$A$4:$A$19,B${r},'Cenários de GMD'!$B$4:$B$19,C${r})`,
    `=IF(J${r}=0,0,J${r}/K${r})`,
    `=((H${r}+I${r})/2)*SUMIFS('Cenários de GMD'!$D$4:$D$19,'Cenários de GMD'!$A$4:$A$19,B${r},'Cenários de GMD'!$B$4:$B$19,C${r})`,
    `=((H${r}+I${r})/2)*SUMIFS('Cenários de GMD'!$E$4:$E$19,'Cenários de GMD'!$A$4:$A$19,B${r},'Cenários de GMD'!$B$4:$B$19,C${r})`,
    `=M${r}*Insumos!$E$4+N${r}*Insumos!$E$5`,
    `=O${r}*Premissas!$B$7`,
    `=O${r}*L${r}`,
    `=Premissas!$B$7*Premissas!$B$8*L${r}`,
    `=D${r}*E${r}`,
    `=S${r}*F${r}`,
    `=S${r}-XLOOKUP(A${r},Lotes!$A$4:$A$8,Lotes!$D$4:$D$8,Premissas!$B$9)-Q${r}-R${r}`,
    `=U${r}*F${r}`,
    `=IF(S${r}=0,0,U${r}/S${r})`,
    `=IF(D${r}-G${r}<=0,0,Q${r}/(D${r}-G${r}))`,
    `=IFERROR(U${r}/(XLOOKUP(A${r},Lotes!$A$4:$A$8,Lotes!$D$4:$D$8,Premissas!$B$9)+Q${r}+R${r}),0)`,
    `=IF(L${r}=0,Y${r},Y${r}/MAX(1,L${r}/Premissas!$B$7))`,
    `=IF(L${r}=0,"Venda imediata",IF(L${r}<=60,"Baixo",IF(L${r}<=120,"Médio","Alto")))`,
    `=IF(U${r}<0,"Não fazer",IF(AA${r}="Alto","Risco seca",IF(Z${r}>=0.03,"Bom giro","Margem ok")))`
  ]);
}
formulas(result, `E4:AB${rows.length + 3}`, fRows);
styleHeader(result, "A3:AB3");
styleBody(result, `A4:AB${rows.length + 3}`);
money(result, `E4:E${rows.length + 3}`);
money(result, `O4:V${rows.length + 3}`);
money(result, `X4:X${rows.length + 3}`);
percent(result, `W4:W${rows.length + 3}`);
percent(result, `Y4:Z${rows.length + 3}`);
number(result, `G4:N${rows.length + 3}`, "0.00");
result.getRange("A:C").format.columnWidthPx = 145;
result.getRange("D:AB").format.columnWidthPx = 112;
result.getRange("A3:AB3").format.wrapText = true;

const sens = ws("Sensibilidade da arroba");
styleTitle(sens, "A1:O1");
set(sens, "A1:O1", [["Sensibilidade por preço da arroba - estratégia Econômica / GMD Base", null, null, null, null, null, null, null, null, null, null, null, null, null, null]]);
set(sens, "A3:O3", [["Lote", "Preço @", "Meta @", "@ atual", "Dias", "Custo alim acum.", "Receita/cab", "Lucro/cab", "Lucro total", "Margem %", "ROI", "Risco seca", "Decisão", "Observação", "Qtd."]]);
const prices = [300, 320, 330, 350, 370];
const sensRows = [];
for (const lote of lots) {
  for (const price of prices) {
    for (const target of targets) sensRows.push([lote, price, target]);
  }
}
set(sens, `A4:C${sensRows.length + 3}`, sensRows);
const sensF = [];
for (let r = 4; r <= sensRows.length + 3; r++) {
  sensF.push([
    `=XLOOKUP(A${r},Lotes!$A$4:$A$8,Lotes!$C$4:$C$8,0)`,
    `=MAX(0,(C${r}*Premissas!$B$5/Premissas!$B$4)-(D${r}*Premissas!$B$5/Premissas!$B$4))/SUMIFS('Cenários de GMD'!$C$4:$C$19,'Cenários de GMD'!$A$4:$A$19,"Econômica",'Cenários de GMD'!$B$4:$B$19,"Base")`,
    `=(((D${r}*Premissas!$B$5/Premissas!$B$4)+(C${r}*Premissas!$B$5/Premissas!$B$4))/2)*(SUMIFS('Cenários de GMD'!$D$4:$D$19,'Cenários de GMD'!$A$4:$A$19,"Econômica",'Cenários de GMD'!$B$4:$B$19,"Base")*Insumos!$E$4+SUMIFS('Cenários de GMD'!$E$4:$E$19,'Cenários de GMD'!$A$4:$A$19,"Econômica",'Cenários de GMD'!$B$4:$B$19,"Base")*Insumos!$E$5)*E${r}`,
    `=B${r}*C${r}`,
    `=G${r}-XLOOKUP(A${r},Lotes!$A$4:$A$8,Lotes!$D$4:$D$8,Premissas!$B$9)-F${r}`,
    `=H${r}*O${r}`,
    `=IF(G${r}=0,0,H${r}/G${r})`,
    `=IFERROR(H${r}/(XLOOKUP(A${r},Lotes!$A$4:$A$8,Lotes!$D$4:$D$8,Premissas!$B$9)+F${r}),0)`,
    `=IF(E${r}=0,"Venda imediata",IF(E${r}<=60,"Baixo",IF(E${r}<=120,"Médio","Alto")))`,
    `=IF(H${r}<0,"Não comprar/tratar",IF(L${r}="Alto","Só se preço/pasto compensar","Viável"))`,
    `=IF(C${r}=12,"Testar margem incremental; não perseguir automaticamente","Comparar com giro e risco")`,
    `=XLOOKUP(A${r},Lotes!$A$4:$A$8,Lotes!$B$4:$B$8,0)`
  ]);
}
formulas(sens, `D4:O${sensRows.length + 3}`, sensF);
styleHeader(sens, "A3:O3");
styleBody(sens, `A4:O${sensRows.length + 3}`);
money(sens, `B4:B${sensRows.length + 3}`);
money(sens, `F4:I${sensRows.length + 3}`);
percent(sens, `J4:K${sensRows.length + 3}`);
number(sens, `C4:E${sensRows.length + 3}`, "0.00");
sens.getRange("A:O").format.columnWidthPx = 126;
sens.getRange("N:N").format.columnWidthPx = 245;

const rec = ws("Recomendação final");
styleTitle(rec, "A1:H1");
set(rec, "A1:H1", [["Resumo executivo e recomendação objetiva", null, null, null, null, null, null, null]]);
set(rec, "A3:D10", [
  ["Pergunta", "Resposta automática", "Critério", "Leitura de campo"],
  ["Melhor lucro absoluto", null, "Maior lucro total", "Pode exigir mais dias; conferir risco seca."],
  ["Melhor giro do capital", null, "Maior ROI mensal", "Prioriza rapidez e capital rodando."],
  ["Melhor margem", null, "Maior margem %", "Útil quando risco e caixa importam mais que escala."],
  ["Lote maior", "Avaliar venda em 10,5@ a 11@ com estratégia Econômica ou Intermediária.", "Giro rápido", "Não travar capital buscando 12@ se o pasto secar."],
  ["Grupo médio", "Testar Comigo 0,3% a 0,5% PV conforme resposta de pasto.", "Equilíbrio", "Se GMD cair abaixo de 0,4 kg/dia, recalcular."],
  ["Bezerras pequenas", "Priorizar crescimento barato; evitar consumo agressivo.", "Risco/categoria", "Proteinado e manejo de pasto antes de engorda pesada."],
  ["Regra prática", "Vender antes quando dias adicionais elevam risco e reduzem ROI mensal.", "Seca", "Margem incremental manda mais que peso final."]
]);
formulas(rec, "B4:B6", [
  [`=INDEX('Resultado econômico'!$A$4:$A$303,MATCH(MAXIFS('Resultado econômico'!$V$4:$V$303,'Resultado econômico'!$F$4:$F$303,">0"),'Resultado econômico'!$V$4:$V$303,0))&" | "&INDEX('Resultado econômico'!$B$4:$B$303,MATCH(MAXIFS('Resultado econômico'!$V$4:$V$303,'Resultado econômico'!$F$4:$F$303,">0"),'Resultado econômico'!$V$4:$V$303,0))&" | "&INDEX('Resultado econômico'!$D$4:$D$303,MATCH(MAXIFS('Resultado econômico'!$V$4:$V$303,'Resultado econômico'!$F$4:$F$303,">0"),'Resultado econômico'!$V$4:$V$303,0))&"@ | R$ "&TEXT(MAXIFS('Resultado econômico'!$V$4:$V$303,'Resultado econômico'!$F$4:$F$303,">0"),"#,##0")`],
  [`=INDEX('Resultado econômico'!$A$4:$A$303,MATCH(MAXIFS('Resultado econômico'!$Z$4:$Z$303,'Resultado econômico'!$F$4:$F$303,">0",'Resultado econômico'!$L$4:$L$303,">0"),'Resultado econômico'!$Z$4:$Z$303,0))&" | "&INDEX('Resultado econômico'!$B$4:$B$303,MATCH(MAXIFS('Resultado econômico'!$Z$4:$Z$303,'Resultado econômico'!$F$4:$F$303,">0",'Resultado econômico'!$L$4:$L$303,">0"),'Resultado econômico'!$Z$4:$Z$303,0))&" | "&INDEX('Resultado econômico'!$D$4:$D$303,MATCH(MAXIFS('Resultado econômico'!$Z$4:$Z$303,'Resultado econômico'!$F$4:$F$303,">0",'Resultado econômico'!$L$4:$L$303,">0"),'Resultado econômico'!$Z$4:$Z$303,0))&"@ | "&TEXT(MAXIFS('Resultado econômico'!$Z$4:$Z$303,'Resultado econômico'!$F$4:$F$303,">0",'Resultado econômico'!$L$4:$L$303,">0"),"0.0%")&" a.m."`],
  [`=INDEX('Resultado econômico'!$A$4:$A$303,MATCH(MAXIFS('Resultado econômico'!$W$4:$W$303,'Resultado econômico'!$F$4:$F$303,">0"),'Resultado econômico'!$W$4:$W$303,0))&" | "&INDEX('Resultado econômico'!$B$4:$B$303,MATCH(MAXIFS('Resultado econômico'!$W$4:$W$303,'Resultado econômico'!$F$4:$F$303,">0"),'Resultado econômico'!$W$4:$W$303,0))&" | "&INDEX('Resultado econômico'!$D$4:$D$303,MATCH(MAXIFS('Resultado econômico'!$W$4:$W$303,'Resultado econômico'!$F$4:$F$303,">0"),'Resultado econômico'!$W$4:$W$303,0))&"@ | "&TEXT(MAXIFS('Resultado econômico'!$W$4:$W$303,'Resultado econômico'!$F$4:$F$303,">0"),"0.0%")`]
]);
styleHeader(rec, "A3:D3");
styleBody(rec, "A4:D10");
rec.getRange("A:A").format.columnWidthPx = 180;
rec.getRange("B:B").format.columnWidthPx = 500;
rec.getRange("C:C").format.columnWidthPx = 165;
rec.getRange("D:D").format.columnWidthPx = 390;
rec.getRange("B4:D10").format.wrapText = true;

set(rec, "A13:H13", [["Tabela executiva: lote maior, estratégia Econômica, GMD Base", "Meta @", "Dias", "Custo alim/cab", "Receita/cab", "Lucro/cab", "Margem", "Sinal"]]);
const execTargets = [[8.5], [9], [10.5], [11], [12]];
set(rec, "B14:B18", execTargets);
set(rec, "A14:A18", [["Lote maior - base 8,5@"], ["Lote maior - base 8,5@"], ["Lote maior - base 8,5@"], ["Lote maior - base 8,5@"], ["Lote maior - base 8,5@"]]);
for (let r = 14; r <= 18; r++) {
  formulas(rec, `C${r}:H${r}`, [[
    `=INDEX('Resultado econômico'!$L$4:$L$323,MATCH(1,('Resultado econômico'!$A$4:$A$323="Lote maior - base 8,5@")*('Resultado econômico'!$B$4:$B$323="Econômica")*('Resultado econômico'!$C$4:$C$323="Base")*('Resultado econômico'!$D$4:$D$323=B${r}),0))`,
    `=INDEX('Resultado econômico'!$Q$4:$Q$323,MATCH(1,('Resultado econômico'!$A$4:$A$323="Lote maior - base 8,5@")*('Resultado econômico'!$B$4:$B$323="Econômica")*('Resultado econômico'!$C$4:$C$323="Base")*('Resultado econômico'!$D$4:$D$323=B${r}),0))`,
    `=INDEX('Resultado econômico'!$S$4:$S$323,MATCH(1,('Resultado econômico'!$A$4:$A$323="Lote maior - base 8,5@")*('Resultado econômico'!$B$4:$B$323="Econômica")*('Resultado econômico'!$C$4:$C$323="Base")*('Resultado econômico'!$D$4:$D$323=B${r}),0))`,
    `=INDEX('Resultado econômico'!$U$4:$U$323,MATCH(1,('Resultado econômico'!$A$4:$A$323="Lote maior - base 8,5@")*('Resultado econômico'!$B$4:$B$323="Econômica")*('Resultado econômico'!$C$4:$C$323="Base")*('Resultado econômico'!$D$4:$D$323=B${r}),0))`,
    `=INDEX('Resultado econômico'!$W$4:$W$323,MATCH(1,('Resultado econômico'!$A$4:$A$323="Lote maior - base 8,5@")*('Resultado econômico'!$B$4:$B$323="Econômica")*('Resultado econômico'!$C$4:$C$323="Base")*('Resultado econômico'!$D$4:$D$323=B${r}),0))`,
    `=INDEX('Resultado econômico'!$AB$4:$AB$323,MATCH(1,('Resultado econômico'!$A$4:$A$323="Lote maior - base 8,5@")*('Resultado econômico'!$B$4:$B$323="Econômica")*('Resultado econômico'!$C$4:$C$323="Base")*('Resultado econômico'!$D$4:$D$323=B${r}),0))`
  ]]);
}
styleHeader(rec, "A13:H13");
styleBody(rec, "A14:H18");
money(rec, "D14:F18");
percent(rec, "G14:G18");
number(rec, "B14:C18", "0.00");
rec.getRange("A13:A18").format.columnWidthPx = 280;

for (const sheet of wb.worksheets.items) {
  sheet.getRange("A1:AB200").format.font = { name: "Aptos" };
}

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(outputPath);
console.log(outputPath);
