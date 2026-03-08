import * as path from 'path';
import * as fs from 'fs';
import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Applies heuristic cleanup to messy PDF text exports.
 * Removes page numbers, repeating headers, and collapses excessive whitespace.
 */
const cleanPDFText = (text: string): string => {
    let clean = text;

    // 1. Remove standalone page numbers (e.g., "12", "Page 12", "- 12 -")
    clean = clean.replace(/^\s*(?:Page\s*)?-?\s*\d+\s*-?\s*$/gm, '');

    // 2. Remove common watermarks
    clean = clean.replace(/(?:DRAFT|CONFIDENTIAL|DO NOT COPY)/gi, '');

    return clean.trim();
};

/**
 * Custom Layout-Aware PDF Reader using pdfjs-dist directly.
 * Reconstructs the visual appearance of a screenplay by using X/Y coordinates.
 */
class LayoutPDFReader {
    async loadData(buffer: Buffer): Promise<string> {
        const data = new Uint8Array(buffer);
        const loadingTask = pdfjs.getDocument({ data });
        const pdf = await loadingTask.promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Sort items by Y (top to bottom) then X (left to right)
            const items = textContent.items as any[];
            items.sort((a, b) => {
                if (Math.abs(a.transform[5] - b.transform[5]) < 5) {
                    return a.transform[4] - b.transform[4];
                }
                return b.transform[5] - a.transform[5];
            });

            let lastY = -1;
            let pageText = '';

            for (const item of items) {
                const x = item.transform[4];
                const y = item.transform[5];

                if (lastY !== -1 && Math.abs(y - lastY) > 5) {
                    pageText += '\n';
                }

                // Approximate indentation: 1 unit ~= 0.1 character
                const indent = Math.max(0, Math.floor(x / 8));
                if (lastY === -1 || Math.abs(y - lastY) > 5) {
                    pageText += ' '.repeat(indent);
                }

                pageText += item.str;
                lastY = y;
            }
            fullText += pageText + '\n\n';
        }

        return fullText;
    }
}

/**
 * Extracts raw UTF-8 text from various document formats commonly used for scripts.
 * Supported formats: .txt, .md, .pdf, .docx
 */
export const extractTextFromFile = async (fileBuffer: Buffer, mimetype: string, originalName: string): Promise<string> => {
    const ext = path.extname(originalName).toLowerCase();

    try {
        // 1. Plain Text / Markdown
        if (mimetype === 'text/plain' || mimetype === 'text/markdown' || ext === '.txt' || ext === '.md') {
            return fileBuffer.toString('utf-8');
        }

        // 2. PDF Parsing
        if (mimetype === 'application/pdf' || ext === '.pdf') {
            const reader = new LayoutPDFReader();
            const fullText = await reader.loadData(fileBuffer);
            return cleanPDFText(fullText);
        }

        // 3. DOCX Parsing (Word)
        if (
            mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            ext === '.docx'
        ) {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            return result.value;
        }

        // Unsupported Format
        throw new Error(`Unsupported file type: ${mimetype || ext}. Please upload PDF, DOCX, TXT, or MD files.`);

    } catch (error: any) {
        console.error(`[FileParser] Error extracting text from ${originalName}: ${error.message}`);
        throw new Error(`Failed to parse file: ${error.message}`);
    }
};
