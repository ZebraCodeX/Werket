import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Export to PDF using pdf-lib for proper PDF generation
 */
export async function buildPdf(html: string, options: ExportOptions): Promise<Uint8Array> {
  const blocks = htmlToBlocks(html);
  if (!blocks.length) throw new Error('Nothing to export');

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const boldItalicFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  const pageWidth = 595.28; // A4 width in points
  const pageHeight = 841.89; // A4 height in points
  const margin = 56; // 2cm margin

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 56; // top margin
  const lineHeight = 14;
  const maxWidth = 595.28 - 112; // page width - margins
  let numbering = 0;

  const drawText = (text: string, x: number, y: number, font: any, size: number, color = rgb(0, 0, 0)) => {
    page.drawText(text, {
      x,
      y,
      size,
      font,
      color,
    });
  };

  const drawWrappedText = (text: string, x: number, y: number, font: any, size: number, maxWidth: number, color = rgb(0, 0, 0)) => {
    const words = text.split(/\s+/);
    let line = '';
    let y = y;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, 12);
      
      if (width > maxWidth && line) {
        page.drawText(line, { x, y, size: 12, font, color: rgb(0, 0, 0) });
        y -= 14;
        line = word;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      page.drawText(line, { x, y, size: 12, font, color: rgb(0, 0, 0) });
      y -= 14;
    }
    
    return y;
  };

  const drawWords = (text: string, x: number, y: number, font: any, size: number, color = rgb(0, 0, 0)) => {
    const words = text.split(/(\s+)/);
    let line = '';
    let currentY = y;

    for (const word of words) {
      const testLine = line ? `${line}${word}` : word;
      const width = font.widthOfTextAtSize(testLine, size);
      
      if (width > maxWidth && line) {
        page.drawText(line, { x, y: currentY, size, font, color });
        currentY -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      page.drawText(line, { x, y: currentY, size, font, color });
      currentY -= lineHeight;
    }
    
    return currentY;
  };

  let currentY = y;

  const addParagraph = (text: string, font: any, size: number, isBold = false, isItalic = false, isCentered = false) => {
    const fontToUse = isBold && isItalic ? boldItalicFont : isBold ? boldFont : isItalic ? italicFont : font;
    const words = text.split(/\s+/);
    let line = '';
    let lineWidth = 0;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, size);
      
      if (width > maxWidth && line) {
        const x = isCentered ? (pageWidth - font.widthOfTextAtSize(line, size)) / 2 : margin;
        page.drawText(line, { x, y: currentY, size, font: fontToUse, color: rgb(0, 0, 0) });
        currentY -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      const x = isCentered ? (pageWidth - font.widthOfTextAtSize(line, size)) / 2 : margin;
      page.drawText(line, { x, y: currentY, size, font: fontToUse, color: rgb(0, 0, 0) });
      currentY -= lineHeight;
    }
    
    currentY -= 4; // paragraph spacing
  };

  // Helper to get font
  const getFont = (bold: boolean, italic: boolean) => {
    if (bold && italic) return boldItalicFont;
    if (bold) return boldFont;
    if (italic) return italicFont;
    return font;
  };

  // Process blocks
  for (const block of blocks) {
    if (block.empty) {
      currentY -= 20;
      continue;
    }

    const isHeading = block.type === 'h1' || block.type === 'h2' || block.type === 'h3';
    const isList = block.type === 'li';
    const isCheck = block.type === 'check';
    const isQuote = block.quote;

    if (currentY < 100) {
      const newPage = pdfDoc.addPage([pageWidth, pageHeight]);
      page = newPage;
      currentY = pageHeight - 56;
    }

    if (isHeading) {
      const level = parseInt(block.type[1]);
      const size = level === 1 ? 24 : level === 2 ? 20 : 18;
      const fontToUse = boldFont;
      
      for (const run of block.runs) {
        if (run.text.trim()) {
          addParagraph(run.text, boldFont, size, true, run.italic, true);
        }
      }
      currentY -= 6;
      continue;
    }

    if (isList) {
      currentY -= 4;
      for (const run of block.runs) {
        if (run.text.trim()) {
          const prefix = block.list === 'number' ? `${++numbering}. ` : '• ';
          addParagraph(prefix + run.text, font, 12, run.bold, run.italic);
        }
      }
      currentY -= 4;
      continue;
    }

    if (isCheck) {
      currentY -= 4;
      for (const run of block.runs) {
        if (run.text.trim()) {
          const prefix = block.checked ? '☑ ' : '☐ ';
          addParagraph(prefix + run.text, font, 12, run.bold, run.italic);
        }
      }
      currentY -= 4;
      continue;
    }

    // Regular paragraph
    let paragraphText = '';
    for (const run of block.runs) {
      if (run.br) {
        if (paragraphText) {
          addParagraph(paragraphText, font, 12, false, false, isQuote);
          paragraphText = '';
        }
        currentY -= 8;
        continue;
      }
      paragraphText += run.text;
    }
    
    if (paragraphText) {
      addParagraph(paragraphText, font, 12, false, false, isQuote);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Uint8Array(pdfBytes);
}