import * as fs from 'fs';
import * as path from 'path';
import { app, shell } from 'electron';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export interface GeneratedDocument {
  path: string;
  filename: string;
}

function outputDir(): string {
  const dir = path.join(app.getPath('documents'), 'KLIP');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Guards against writing outside the KLIP output folder — the model
 *  only ever supplies a bare filename, but this stays defensive against
 *  a crafted "../../" filename reaching the filesystem. */
function safeFilePath(dir: string, filename: string, fallbackExt: string): string {
  const base = path.basename(filename).trim() || `document.${fallbackExt}`;
  const withExt = base.toLowerCase().endsWith(`.${fallbackExt}`) ? base : `${base}.${fallbackExt}`;
  let candidate = path.join(dir, withExt);
  let n = 1;
  const { name, ext } = path.parse(withExt);
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${name} (${n})${ext}`);
    n += 1;
  }
  return candidate;
}

/** Parses the simple CSV dialect the model is instructed to emit inside
 *  [EXCEL:...] tags: comma-separated cells, newline-separated rows, and
 *  a cell can be quoted with double quotes to contain a literal comma
 *  or newline (doubled `""` escapes a literal quote). */
export function parseCsvGrid(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const pushCell = () => { row.push(cell); cell = ''; };
  const pushRow = () => { pushCell(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else { inQuotes = false; }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"' && cell === '') { inQuotes = true; continue; }
    if (c === ',') { pushCell(); continue; }
    if (c === '\n') { pushRow(); continue; }
    if (c === '\r') continue;
    cell += c;
  }
  if (cell !== '' || row.length > 0) pushRow();
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ''));
}

export async function createExcel(filename: string, csvBody: string): Promise<GeneratedDocument> {
  const rows = parseCsvGrid(csvBody);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRows(rows);

  if (rows.length > 0) {
    const header = sheet.getRow(1);
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
    });
    sheet.columns.forEach((col) => {
      let max = 8;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > max) max = len;
      });
      col.width = Math.min(max + 2, 48);
    });
  }

  const dir = outputDir();
  const filePath = safeFilePath(dir, filename, 'xlsx');
  await workbook.xlsx.writeFile(filePath);
  return { path: filePath, filename: path.basename(filePath) };
}

export function createPdf(filename: string, body: string): Promise<GeneratedDocument> {
  return new Promise((resolve, reject) => {
    const dir = outputDir();
    const filePath = safeFilePath(dir, filename, 'pdf');
    const doc = new PDFDocument({ margin: 56 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const paragraphs = body.split(/\n{2,}/);
    paragraphs.forEach((para, i) => {
      if (i > 0) doc.moveDown();
      doc.fontSize(11).font('Helvetica').text(para.trim(), { align: 'left' });
    });

    doc.end();
    stream.on('finish', () => resolve({ path: filePath, filename: path.basename(filePath) }));
    stream.on('error', reject);
  });
}

export async function revealDocument(filePath: string): Promise<void> {
  await shell.openPath(filePath);
}
