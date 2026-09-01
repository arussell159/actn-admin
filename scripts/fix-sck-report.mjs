import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const inputPath =
  "C:/Users/AlexRussell/OneDrive - africactn.com/Desktop/SOA - 2026-09-01T172047.019.xlsx";
const outputDir = path.resolve("outputs/sck-chad-sierra-leone-report");
const outputPath = path.join(outputDir, "SCK Chad and Sierra Leone Report - fixed.xlsx");

const workbook = XLSX.readFile(inputPath, {
  cellDates: true,
  raw: true,
});

const sourceSheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sourceSheet, {
  header: 1,
  defval: null,
  raw: true,
});

const excelEpoch = Date.UTC(1899, 11, 30);
const toDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    return new Date(excelEpoch + value * 24 * 60 * 60 * 1000);
  }
  return value;
};

const reportRows = rows
  .filter((row) => row?.[0] && row?.[1] && row?.[3] != null)
  .map((row) => [
    row[0],
    String(row[1]),
    row[2] ? String(row[2]) : "",
    Number(row[3]),
    row[4],
    String(row[5]),
    toDate(row[6]),
  ]);

const totalAmount = reportRows.reduce((sum, row) => sum + row[3], 0);
const chadRows = reportRows.filter((row) => row[0] === "Chad");
const sierraLeoneRows = reportRows.filter((row) => row[0] === "Sierra Leone");
const chadTotal = chadRows.reduce((sum, row) => sum + row[3], 0);
const sierraLeoneTotal = sierraLeoneRows.reduce((sum, row) => sum + row[3], 0);
const dataStartRow = 6;
const dataEndRow = dataStartRow + reportRows.length - 1;
const totalRow = dataEndRow + 1;

const aoa = [
  ["SCK Chad and Sierra Leone Report", null, null, null, null, null, null],
  ["Statement of Account", null, null, null, null, null, null],
  ["Report Date", new Date(2026, 8, 1), null, null, "Original Sheet", workbook.SheetNames[0], null],
  [null, null, null, null, null, null, null],
  ["Country", "Container / BL", "SCK Ref", "Amount", "Currency", "Invoice", "Invoice Date"],
  ...reportRows,
  ["Total", null, null, totalAmount, "USD", null, null],
  [null, null, null, null, null, null, null],
  ["Country Summary", null, null, null, null, null, null],
  ["Country", "Line Count", "Amount", "Currency", null, null, null],
  ["Chad", chadRows.length, chadTotal, "USD", null, null, null],
  ["Sierra Leone", sierraLeoneRows.length, sierraLeoneTotal, "USD", null, null, null],
];

const fixedBook = XLSX.utils.book_new();
fixedBook.Props = {
  Title: "SCK Chad and Sierra Leone Report",
  Subject: "Statement of Account",
  Author: "Africa CTN",
  CreatedDate: new Date(2026, 8, 1),
};

const fixedSheet = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
fixedSheet["!ref"] = `A1:G${aoa.length}`;
fixedSheet["!merges"] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
  { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
  { s: { r: totalRow + 1, c: 0 }, e: { r: totalRow + 1, c: 3 } },
];
fixedSheet["!cols"] = [
  { wch: 16 },
  { wch: 22 },
  { wch: 14 },
  { wch: 12 },
  { wch: 10 },
  { wch: 12 },
  { wch: 14 },
];
fixedSheet["!freeze"] = { xSplit: 0, ySplit: 5 };
fixedSheet["!autofilter"] = { ref: `A5:G${dataEndRow}` };
fixedSheet[`D${totalRow}`] = {
  t: "n",
  f: `SUM(D${dataStartRow}:D${dataEndRow})`,
  v: totalAmount,
  z: '#,##0.00',
};
fixedSheet[`B${totalRow + 4}`] = {
  t: "n",
  f: `COUNTIF(A${dataStartRow}:A${dataEndRow},"Chad")`,
  v: chadRows.length,
  z: '#,##0',
};
fixedSheet[`C${totalRow + 4}`] = {
  t: "n",
  f: `SUMIF(A${dataStartRow}:A${dataEndRow},"Chad",D${dataStartRow}:D${dataEndRow})`,
  v: chadTotal,
  z: '#,##0.00',
};
fixedSheet[`B${totalRow + 5}`] = {
  t: "n",
  f: `COUNTIF(A${dataStartRow}:A${dataEndRow},"Sierra Leone")`,
  v: sierraLeoneRows.length,
  z: '#,##0',
};
fixedSheet[`C${totalRow + 5}`] = {
  t: "n",
  f: `SUMIF(A${dataStartRow}:A${dataEndRow},"Sierra Leone",D${dataStartRow}:D${dataEndRow})`,
  v: sierraLeoneTotal,
  z: '#,##0.00',
};

for (let row = dataStartRow; row <= totalRow; row += 1) {
  const amountCell = fixedSheet[`D${row}`];
  if (amountCell) amountCell.z = '#,##0.00';
  const currencyCell = fixedSheet[`E${row}`];
  if (currencyCell) currencyCell.t = "s";
  const dateCell = fixedSheet[`G${row}`];
  if (dateCell) dateCell.z = "m/d/yy";
}

if (fixedSheet.B3) fixedSheet.B3.z = "yyyy-mm-dd";

for (const cellRef of [`C${totalRow + 4}`, `C${totalRow + 5}`]) {
  if (fixedSheet[cellRef]) fixedSheet[cellRef].z = '#,##0.00';
}

for (const cellRef of [`B${totalRow + 4}`, `B${totalRow + 5}`]) {
  if (fixedSheet[cellRef]) fixedSheet[cellRef].z = '#,##0';
}

XLSX.utils.book_append_sheet(fixedBook, fixedSheet, "SCK Report");

fs.mkdirSync(outputDir, { recursive: true });
XLSX.writeFile(fixedBook, outputPath, {
  bookType: "xlsx",
  compression: true,
  cellDates: true,
});

console.log(outputPath);
