import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/zhangliang/Downloads/【排量】书法项目-排期&营收-规划表.xlsx";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const sheets = workbook.worksheets.items.map((sheet, index) => ({
  index,
  name: sheet.name,
}));
console.log(JSON.stringify({ sheets }, null, 2));

for (const sheet of workbook.worksheets.items) {
  const range = `${sheet.name}!A1:Z40`;
  const inspected = await workbook.inspect({
    kind: "table",
    range,
    include: "values,formulas",
    tableMaxRows: 40,
    tableMaxCols: 26,
  });
  console.log(`\n--- ${sheet.name} A1:Z40 ---`);
  console.log(inspected.ndjson);
}

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula errors",
});
console.log("\n--- formula errors ---");
console.log(errors.ndjson);
