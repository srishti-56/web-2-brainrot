import Ocr from '@gutenye/ocr-browser';

let ocrInstance = null;

export async function initializeOcr() {
    if (!ocrInstance) {
        ocrInstance = await Ocr.create({
            models: {
                // These paths should point to your extension's assets directory
                detectionPath: chrome.runtime.getURL('assets/ch_PP-OCRv4_det_infer.onnx'),
                recognitionPath: chrome.runtime.getURL('assets/ch_PP-OCRv4_rec_infer.onnx'),
                dictionaryPath: chrome.runtime.getURL('assets/ppocr_keys_v1.txt')
            }
        });
    }
    return ocrInstance;
}

export async function performOcr(imageData) {
    try {
        const ocr = await initializeOcr();
        const result = await ocr.detect(imageData);
        return result;
    } catch (error) {
        console.error('OCR processing failed:', error);
        throw error;
    }
} 