import { loadImage } from 'canvas';

export interface ProcessedImage {
  data: Buffer;
  mimeType: string;
}

/**
 * Validate and process uploaded image
 */
export async function processImage(imageBuffer: Buffer, mimeType: string): Promise<ProcessedImage> {
  // Validate image by attempting to load it
  try {
    await loadImage(imageBuffer);
    return {
      data: imageBuffer,
      mimeType,
    };
  } catch (error: any) {
    throw new Error(`Invalid image file: ${error.message}`);
  }
}
