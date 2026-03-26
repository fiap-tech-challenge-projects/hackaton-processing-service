import { Injectable } from '@nestjs/common'
import * as sharp from 'sharp'
import { InvalidFileTypeError, ImageTooSmallError } from '@shared/exceptions/domain.exception'

export interface ProcessedImage {
  buffer: Buffer
  mimeType: string
  dimensions: { width: number; height: number }
}

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']

@Injectable()
export class PreProcessorService {
  async process(file: Buffer, mimeType: string): Promise<ProcessedImage> {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new InvalidFileTypeError(mimeType)
    }

    if (mimeType === 'application/pdf') {
      return this.handlePdf(file)
    }

    return this.handleImage(file, mimeType)
  }

  private async handleImage(file: Buffer, mimeType: string): Promise<ProcessedImage> {
    const image = sharp(file)
    const metadata = await image.metadata()

    const width = metadata.width || 0
    const height = metadata.height || 0

    if (width < 200 || height < 200) {
      throw new ImageTooSmallError({ width, height })
    }

    let processedBuffer = file

    if (width > 2048 || height > 2048) {
      processedBuffer = await image
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .toBuffer()

      const resizedMeta = await sharp(processedBuffer).metadata()
      return {
        buffer: processedBuffer,
        mimeType,
        dimensions: { width: resizedMeta.width || 2048, height: resizedMeta.height || 2048 },
      }
    }

    return { buffer: processedBuffer, mimeType, dimensions: { width, height } }
  }

  private handlePdf(file: Buffer): ProcessedImage {
    // Sharp does not support PDF natively. Claude and GPT-4o both accept PDF input
    // via base64, so we pass the raw buffer directly with its original MIME type.
    // File size is the only constraint worth enforcing here (50 MB hard limit).
    const MAX_PDF_SIZE = 50 * 1024 * 1024
    if (file.byteLength > MAX_PDF_SIZE) {
      throw new InvalidFileTypeError('application/pdf (file exceeds 50 MB size limit)')
    }

    return {
      buffer: file,
      mimeType: 'application/pdf',
      // PDFs have no pixel dimensions; use sentinel values that callers should ignore
      dimensions: { width: 0, height: 0 },
    }
  }
}
