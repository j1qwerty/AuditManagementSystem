// Export helpers: PDF (via print dialog), Excel (real .xlsx, no libraries),
// CSV, Word (.doc) and JSON. Everything is generated in the browser.
import { download } from './utils'

// ---------- CSV ----------
function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportCSV(filename, rows, headers) {
  const head = (headers || Object.keys(rows[0] || {})).map(csvEscape).join(',')
  const body = rows.map((r) => (headers || Object.keys(r)).map((h) => csvEscape(r[h])).join(',')).join('\n')
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(['\ufeff' + head + '\n' + body], { type: 'text/csv;charset=utf-8' })
  download(blob, filename.endsWith('.csv') ? filename : filename + '.csv')
}

/* ==========================================================================
   Real .xlsx writer (no external library)
   A spreadsheet is a ZIP of small XML parts. ZIP entries are stored
   uncompressed (method 0) which only needs a CRC32 checksum - easy to build
   by hand. The result opens natively in Excel, LibreOffice and Google Sheets.
   ========================================================================== */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(u8) {
  let c = 0xffffffff
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// files: [{ name, data: Uint8Array }] -> Blob (uncompressed ZIP)
function zipStore(files) {
  const enc = new TextEncoder()
  const parts = []
  const central = []
  let offset = 0
  for (const f of files) {
    const nameBytes = enc.encode(f.name)
    const crc = crc32(f.data)
    const local = new Uint8Array(30 + nameBytes.length)
    const dv = new DataView(local.buffer)
    dv.setUint32(0, 0x04034b50, true)  // local file header signature
    dv.setUint16(4, 20, true)          // version needed
    dv.setUint16(6, 0x0800, true)      // flags: UTF-8 names
    dv.setUint16(8, 0, true)           // method: store (no compression)
    dv.setUint16(10, 0, true)          // mod time
    dv.setUint16(12, 0x21, true)       // mod date (1980-01-01)
    dv.setUint32(14, crc, true)
    dv.setUint32(18, f.data.length, true)
    dv.setUint32(22, f.data.length, true)
    dv.setUint16(26, nameBytes.length, true)
    dv.setUint16(28, 0, true)          // extra length
    local.set(nameBytes, 30)
    parts.push(local, f.data)
    central.push({ nameBytes, crc, size: f.data.length, offset })
    offset += local.length + f.data.length
  }
  const centralStart = offset
  for (const c of central) {
    const h = new Uint8Array(46 + c.nameBytes.length)
    const dv = new DataView(h.buffer)
    dv.setUint32(0, 0x02014b50, true)  // central directory signature
    dv.setUint16(4, 20, true)          // version made by
    dv.setUint16(6, 20, true)          // version needed
    dv.setUint16(8, 0x0800, true)
    dv.setUint16(10, 0, true)
    dv.setUint16(12, 0, true)
    dv.setUint16(14, 0x21, true)
    dv.setUint32(16, c.crc, true)
    dv.setUint32(20, c.size, true)
    dv.setUint32(24, c.size, true)
    dv.setUint16(28, c.nameBytes.length, true)
    dv.setUint32(42, c.offset, true)
    h.set(c.nameBytes, 46)
    parts.push(h)
    offset += h.length
  }
  const end = new Uint8Array(22)
  const dv = new DataView(end.buffer)
  dv.setUint32(0, 0x06054b50, true)   // end of central directory
  dv.setUint16(8, central.length, true)
  dv.setUint16(10, central.length, true)
  dv.setUint32(12, offset - centralStart, true)
  dv.setUint32(16, centralStart, true)
  parts.push(end)
  return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

function xmlEsc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// column letter for a 0-based index: 0 -> A, 25 -> Z, 26 -> AA
function colName(i) {
  let s = ''
  i += 1
  while (i > 0) {
    const r = (i - 1) % 26
    s = String.fromCharCode(65 + r) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

// Header style: white bold text on the app's thistle accent, thin borders,
// frozen first row + autofilter, generous column widths.
const XLSX_HEADER_FILL = 'FF8B53AC'

function buildXLSX(sheetName, headers, rows) {
  const cols = headers.length
  const enc = new TextEncoder()
  const xml = (s) => enc.encode(s)

  const sheetData = []
  // header row (style 1)
  sheetData.push(
    `<row r="1">${headers.map((h, i) => `<c r="${colName(i)}1" s="1" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(h)}</t></is></c>`).join('')}</row>`
  )
  // data rows
  rows.forEach((r, ri) => {
    const rn = ri + 2
    const cells = []
    for (let ci = 0; ci < cols; ci++) {
      const v = r[ci]
      const ref = `${colName(ci)}${rn}`
      if (v === null || v === undefined || v === '') continue
      if (typeof v === 'number' && Number.isFinite(v)) cells.push(`<c r="${ref}"><v>${v}</v></c>`)
      else {
        const n = Number(v)
        // keep pure numeric strings (amounts, counts) as real numbers in Excel
        if (n !== 0 && String(n) === String(v).trim() && Number.isFinite(n) && !/^0[0-9]/.test(String(v).trim())) {
          cells.push(`<c r="${ref}"><v>${n}</v></c>`)
        } else {
          cells.push(`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`)
        }
      }
    }
    sheetData.push(`<row r="${rn}">${cells.join('')}</row>`)
  })

  // sensible column widths from content
  const widths = headers.map((h, i) => {
    let max = String(h).length
    rows.forEach((r) => { const l = String(r[i] == null ? '' : r[i]).length; if (l > max) max = l })
    return Math.min(46, Math.max(10, max + 3))
  })
  const colsXml = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
  const lastRef = `${colName(cols - 1)}${Math.max(rows.length + 1, 2)}`

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>'

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${xmlEsc(sheetName).slice(0, 28) || 'Sheet1'}" sheetId="1" r:id="rId1"/></sheets></workbook>`

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>'

  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="3">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    `<fill><patternFill patternType="solid"><fgColor rgb="${XLSX_HEADER_FILL}"/><bgColor indexed="64"/></patternFill></fill>` +
    '</fills>' +
    '<borders count="2">' +
    '<border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFD1BADE"/></left><right style="thin"><color rgb="FFD1BADE"/></right><top style="thin"><color rgb="FFD1BADE"/></top><bottom style="thin"><color rgb="FFD1BADE"/></bottom><diagonal/></border>' +
    '</borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'

  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:${lastRef}"/>` +
    '<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    colsXml +
    `<sheetData>${sheetData.join('')}</sheetData>` +
    `<autoFilter ref="A1:${lastRef}"/>` +
    '</worksheet>'

  return zipStore([
    { name: '[Content_Types].xml', data: xml(contentTypes) },
    { name: '_rels/.rels', data: xml(rels) },
    { name: 'xl/workbook.xml', data: xml(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: xml(workbookRels) },
    { name: 'xl/styles.xml', data: xml(styles) },
    { name: 'xl/worksheets/sheet1.xml', data: xml(sheet) }
  ])
}

// Same calling convention as exportCSV: rows is an array of arrays when
// headers are given, otherwise an array of objects (keys become headers).
export function exportXLSX(filename, rows, headers, sheetName) {
  const heads = headers || Object.keys(rows[0] || {})
  const body = rows.map((r) => (headers ? heads.map((_, i) => r[i]) : heads.map((h) => r[h])))
  const name = (filename.replace(/\.xlsx$/i, '') || 'export')
  const blob = buildXLSX(sheetName || name.slice(0, 28), heads, body)
  download(blob, name + '.xlsx')
}

// ---------- Word (.doc via HTML - opens in MS Word / LibreOffice) ----------
// `styles` (optional) replaces the default stylesheet - used by callers that
// need brand colours (e.g. the workflow guide export).
export function exportWord(filename, title, htmlBody, styles) {
  const css = styles || `
    body{font-family:'Calibri',Arial,sans-serif;font-size:11pt;color:#222}
    h1{font-size:18pt;color:#123430;margin-bottom:4pt}
    h2{font-size:13pt;color:#123430;margin-top:14pt}
    table{border-collapse:collapse;width:100%;font-size:10pt}
    th,td{border:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#eef3f1}
    .meta{color:#555;font-size:10pt;margin-bottom:12pt}
    .box{border:1px solid #bbb;padding:10px;margin:8px 0;background:#fafafa}
  `
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
  <head><meta charset="utf-8"><title>${title}</title>
  <style>${css}</style></head>
  <body>${htmlBody}</body></html>`
  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' })
  download(blob, filename.endsWith('.doc') ? filename : filename + '.doc')
}

// ---------- PDF (opens the browser print dialog -> "Save as PDF") ----------
export function printDocument(title, htmlBody) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) {
    alert('Please allow pop-ups for this site to export PDF.')
    return
  }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    @page { margin: 18mm 16mm }
    body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;color:#1c2430}
    h1{font-size:20px;color:#123430;margin:0 0 2px}
    h2{font-size:14px;color:#123430;margin:18px 0 6px;border-bottom:1px solid #d7ddd9;padding-bottom:3px}
    h3{font-size:12px;margin:12px 0 4px;color:#334}
    .meta{color:#55606e;font-size:11px;margin-bottom:14px}
    table{border-collapse:collapse;width:100%;font-size:11px;margin:6px 0}
    th,td{border:1px solid #cfd6d2;padding:5px 7px;text-align:left;vertical-align:top}
    th{background:#eef3f1}
    .badge{display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;border:1px solid #bbb}
    .box{border:1px solid #cfd6d2;padding:8px 10px;margin:8px 0;background:#fafbfa}
    ul{margin:4px 0;padding-left:18px}
    .footer{margin-top:24px;color:#8892a0;font-size:10px;border-top:1px solid #e4e8ee;padding-top:6px}
  </style></head><body>${htmlBody}
  <div class="footer">Generated by the Audit Management System.</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
  </body></html>`)
  w.document.close()
}

export function tableHTML(headers, rows) {
  const head = headers.map((h) => `<th>${h}</th>`).join('')
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c === null || c === undefined ? '' : c}</td>`).join('')}</tr>`).join('')
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}
