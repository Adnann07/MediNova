import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractPdfPages(files, onProgress = () => {}) {
  const pages = [];
  let ocrWorker;
  try {
    for (const file of files) {
      onProgress(`Reading ${file.name}…`);
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      if (pdf.numPages > 40 || pages.length + pdf.numPages > 80) {
        await pdf.destroy();
        throw new Error('Keep each PDF to 40 pages or fewer and the combined upload to 80 pages or fewer.');
      }
      try {
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          onProgress(`Extracting ${file.name} · page ${pageNumber} of ${pdf.numPages}`);
          const page = await pdf.getPage(pageNumber);
          const textContent = await page.getTextContent();
          let text = textContent.items
            .filter((item) => 'str' in item)
            .map((item) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (text.length < 40) {
            if (!ocrWorker) {
              onProgress('Starting local OCR for scanned pages…');
              ocrWorker = await createWorker('eng', 1, {
                logger: (message) => {
                  if (message.status === 'recognizing text') {
                    onProgress(`Reading scanned page · ${Math.round((message.progress || 0) * 100)}%`);
                  }
                },
              });
            }
            const baseViewport = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: Math.min(2, 1400 / baseViewport.width) });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Could not create a canvas for OCR in this browser.');
            await page.render({ canvasContext: context, viewport }).promise;
            const recognized = await ocrWorker.recognize(canvas);
            if (recognized.data.text.trim().length > text.length) text = recognized.data.text.trim();
            canvas.width = 0;
            canvas.height = 0;
          }

          if (text.trim().length >= 20) {
            pages.push({ documentName: file.name, pageNumber, text: text.slice(0, 10_000) });
          }
          page.cleanup();
        }
      } finally {
        await pdf.destroy();
      }
    }
    if (!pages.length) throw new Error('No readable text was found. Try a clearer PDF or one with selectable text.');
    return pages;
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
  }
}
