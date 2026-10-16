import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PdfExtractResult {
  text: string;
  totalPages: number;
  wordCount: number;
  isScanned: boolean;
  pageRangeApplied?: string;
}

export async function extractTextFromPdfInBrowser(
  file: File,
  startPage?: number,
  endPage?: number,
  onProgress?: (current: number, total: number) => void
): Promise<PdfExtractResult> {
  const arrayBuffer = await file.arrayBuffer();

  // Ensure worker is always pointing to the bundled local worker
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const totalDocPages = pdf.numPages;

  const start = Math.max(1, Math.min(startPage || 1, totalDocPages));
  const end = Math.min(totalDocPages, Math.max(start, endPage || totalDocPages));
  const pagesToProcess = end - start + 1;

  let fullText = '';
  let totalChars = 0;

  for (let pageNum = start; pageNum <= end; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText.length > 0) {
        fullText += `--- PÁGINA ${pageNum} ---\n${pageText}\n\n`;
        totalChars += pageText.length;
      }
    } catch (pageErr) {
      console.warn(`Erro ao ler página ${pageNum}:`, pageErr);
    }

    if (onProgress) {
      onProgress(pageNum - start + 1, pagesToProcess);
    }
  }

  const words = fullText.split(/\s+/).filter(Boolean).length;
  const isScanned = totalChars < 80;

  return {
    text: fullText.trim(),
    totalPages: totalDocPages,
    wordCount: words,
    isScanned,
    pageRangeApplied: `${start} a ${end}`,
  };
}
