import * as path from 'path';
import * as fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

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
            const data = await pdfParse(fileBuffer);
            return data.text;
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
