import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const PAGE_WIDTH_TWIPS = 12240; // US Letter (8.5 in)
const PAGE_MARGIN_TWIPS = 1080; // 0.75 in
const CONTENT_WIDTH_TWIPS = PAGE_WIDTH_TWIPS - PAGE_MARGIN_TWIPS * 2; // 10080 twips

const FONT_BODY = 'Calibri';
const FONT_MONO = 'Consolas';
const COLOR_TEXT = '1E293B';
const COLOR_HEADING = '0F172A';
const COLOR_ACCENT = '3730A3';
const COLOR_BORDER = 'CBD5E1';
const COLOR_HEADER_BG = '1E293B';
const COLOR_STRIPE_BG = 'F8FAFC';
const COLOR_QUOTE_BG = 'EEF2FF';
const COLOR_QUOTE_BORDER = '4F46E5';
const COLOR_CODE_BG = 'F1F5F9';

function parseInline(text, base = {}) {
  const runs = [];
  const baseRun = { font: FONT_BODY, size: 21, color: COLOR_TEXT, ...base };
  const segments = String(text ?? '').split(/<br\s*\/?>/gi);

  segments.forEach((seg, segIdx) => {
    if (segIdx > 0) runs.push(new TextRun({ ...baseRun, text: '', break: 1 }));
    const tokenRe = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|(?<!\w)__([^_]+)__(?!\w)|\*([^*]+)\*|(?<!\w)_([^_]+)_(?!\w)/g;
    let last = 0;
    let m;
    while ((m = tokenRe.exec(seg)) !== null) {
      if (m.index > last) runs.push(new TextRun({ ...baseRun, text: seg.slice(last, m.index) }));
      if (m[1] !== undefined) {
        runs.push(
          new TextRun({
            ...baseRun,
            text: m[1],
            font: FONT_MONO,
            size: Math.max((baseRun.size || 21) - 2, 16),
            shading: { type: ShadingType.CLEAR, fill: COLOR_CODE_BG },
          }),
        );
      } else if (m[2] !== undefined && m[3] !== undefined) {
        runs.push(
          new ExternalHyperlink({
            link: m[3],
            children: [new TextRun({ ...baseRun, text: m[2], color: COLOR_ACCENT, underline: {} })],
          }),
        );
      } else if (m[4] !== undefined) {
        runs.push(new TextRun({ ...baseRun, text: m[4], bold: true, italics: true }));
      } else if (m[5] !== undefined || m[6] !== undefined) {
        runs.push(new TextRun({ ...baseRun, text: m[5] ?? m[6], bold: true }));
      } else if (m[7] !== undefined || m[8] !== undefined) {
        runs.push(new TextRun({ ...baseRun, text: m[7] ?? m[8], italics: true }));
      }
      last = tokenRe.lastIndex;
    }
    if (last < seg.length) runs.push(new TextRun({ ...baseRun, text: seg.slice(last) }));
  });

  if (runs.length === 0) runs.push(new TextRun({ ...baseRun, text: '' }));
  return runs;
}

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cur = '';
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '\\' && trimmed[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (trimmed[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += trimmed[i];
    }
  }
  cells.push(cur.trim());
  return cells;
}

const isTableSeparator = (line) => /^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(line);
const looksLikeTableRow = (line) => line.includes('|') && /^\s*\|?.+\|.+\|?\s*$/.test(line);

function computeColumnWidths(header, rows) {
  const colCount = Math.max(header.length, ...rows.map((r) => r.length), 1);
  const weights = Array.from({ length: colCount }, (_, col) => {
    const headerLen = (header[col] || '').length;
    const lengths = rows.map((r) => (r[col] || '').length);
    const maxBody = lengths.length ? Math.max(...lengths) : 0;
    const avgBody = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
    return Math.max(6, Math.min(Math.max(headerLen, avgBody * 0.75 + maxBody * 0.25), 65));
  });
  const total = weights.reduce((a, b) => a + b, 0) || colCount;
  const raw = weights.map((w) => Math.max(650, Math.round((w / total) * CONTENT_WIDTH_TWIPS)));
  const sum = raw.reduce((a, b) => a + b, 0);
  const maxIdx = raw.indexOf(Math.max(...raw));
  raw[maxIdx] += CONTENT_WIDTH_TWIPS - sum;
  return raw;
}

function buildTable(headerCells, bodyRows) {
  const colWidths = computeColumnWidths(headerCells, bodyRows);
  const colCount = colWidths.length;
  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
    left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
    right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
  };
  const cellMargins = { top: 80, bottom: 80, left: 100, right: 100 };

  const makeRow = (cells, isHeader, rowIdx) =>
    new TableRow({
      tableHeader: isHeader,
      cantSplit: true,
      children: Array.from({ length: colCount }, (_, col) => {
        const text = cells[col] ?? '';
        const fill = isHeader ? COLOR_HEADER_BG : rowIdx % 2 === 1 ? COLOR_STRIPE_BG : undefined;
        return new TableCell({
          width: { size: colWidths[col], type: WidthType.DXA },
          borders: cellBorders,
          margins: cellMargins,
          shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: parseInline(text, isHeader ? { bold: true, color: 'FFFFFF', size: 19 } : { size: 19 }),
            }),
          ],
        });
      }),
    });

  return new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [makeRow(headerCells, true, 0), ...bodyRows.map((r, i) => makeRow(r, false, i))],
  });
}

function markdownToBlocks(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^\s*```/.test(line)) {
      const codeLines = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { codeLines.push(lines[i]); i++; }
      if (i < lines.length) i++;
      blocks.push(
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: COLOR_CODE_BG },
          indent: { left: 200, right: 200 },
          spacing: { before: 100, after: 140 },
          children: codeLines.length
            ? codeLines.map((cl, idx) => new TextRun({ text: cl, font: FONT_MONO, size: 18, color: COLOR_TEXT, break: idx > 0 ? 1 : 0 }))
            : [new TextRun({ text: '', font: FONT_MONO, size: 18 })],
        }),
      );
      continue;
    }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push(
        new Paragraph({
          spacing: { before: 180, after: 180 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BORDER, space: 4 } },
          children: [],
        }),
      );
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const map = {
        1: { heading: HeadingLevel.HEADING_1, size: 32, color: COLOR_HEADING, before: 120, after: 160 },
        2: { heading: HeadingLevel.HEADING_2, size: 26, color: COLOR_ACCENT, before: 280, after: 100, border: true },
        3: { heading: HeadingLevel.HEADING_3, size: 22, color: COLOR_HEADING, before: 200, after: 80 },
        4: { heading: HeadingLevel.HEADING_4, size: 21, color: COLOR_HEADING, before: 160, after: 60 },
      };
      const cfg = map[level];
      blocks.push(
        new Paragraph({
          heading: cfg.heading,
          spacing: { before: cfg.before, after: cfg.after },
          border: cfg.border ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER, space: 4 } } : undefined,
          children: parseInline(text, { bold: true, size: cfg.size, color: cfg.color }),
        }),
      );
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push(
        new Paragraph({
          indent: { left: 260, right: 160 },
          spacing: { before: 100, after: 160 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: COLOR_QUOTE_BORDER, space: 10 } },
          shading: { type: ShadingType.CLEAR, fill: COLOR_QUOTE_BG },
          children: quoteLines.flatMap((ql, idx) =>
            idx === 0 ? parseInline(ql, { size: 19 }) : [new TextRun({ text: '', break: 1 }), ...parseInline(ql, { size: 19 })],
          ),
        }),
      );
      continue;
    }

    if (i + 1 < lines.length && looksLikeTableRow(line) && isTableSeparator(lines[i + 1])) {
      const headerCells = splitTableRow(line);
      i += 2;
      const bodyRows = [];
      while (i < lines.length && lines[i].trim() && looksLikeTableRow(lines[i])) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push(buildTable(headerCells, bodyRows));
      blocks.push(new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }));
      continue;
    }

    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (bulletMatch) {
      const level = Math.min(Math.floor(bulletMatch[1].replace(/\t/g, '  ').length / 2), 4);
      blocks.push(new Paragraph({ bullet: { level }, spacing: { before: 20, after: 60 }, children: parseInline(bulletMatch[2].trim()) }));
      i++;
      continue;
    }

    const orderedMatch = line.match(/^(\s*)\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      const level = Math.min(Math.floor(orderedMatch[1].replace(/\t/g, '  ').length / 2), 2);
      blocks.push(
        new Paragraph({
          numbering: { reference: 'ordered-list', level },
          spacing: { before: 20, after: 60 },
          children: parseInline(orderedMatch[2].trim()),
        }),
      );
      i++;
      continue;
    }

    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(#{1,4}\s|>\s?|```|[-*+]\s|\d+[.)]\s|(?:---+|\*\*\*+|___+)\s*$)/.test(lines[i]) &&
      !(i + 1 < lines.length && looksLikeTableRow(lines[i]) && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(new Paragraph({ spacing: { before: 40, after: 120 }, children: parseInline(paraLines.join(' ')) }));
  }

  return blocks;
}

export async function markdownToDocxBuffer(markdown, { title = 'Test Strategy' } = {}) {
  const doc = new Document({
    title,
    creator: 'AI Test Strategy Generator',
    description: 'Generated Jira Test Strategy',
    numbering: {
      config: [
        {
          reference: 'ordered-list',
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: FONT_BODY, size: 21, color: COLOR_TEXT },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: PAGE_MARGIN_TWIPS, right: PAGE_MARGIN_TWIPS, bottom: PAGE_MARGIN_TWIPS, left: PAGE_MARGIN_TWIPS } },
        },
        children: markdownToBlocks(markdown),
      },
    ],
  });

  return Packer.toBuffer(doc);
}
