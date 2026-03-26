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

  private async handlePdf(file: Buffer): Promise<ProcessedImage> {
    // For PDF, we convert the first page to PNG using sharp if possible
    // Sharp does not natively support PDF; in production you'd use pdf-to-img or pdftoppm.
    // Here we attempt to use sharp to detect and fall back gracefully.
    try {
      const image = sharp(file, { pages: 1 })
      const pngBuffer = await image.png().toBuffer()
      const metadata = await sharp(pngBuffer).metadata()
      return {
        buffer: pngBuffer,
        mimeType: 'image/png',
        dimensions: { width: metadata.width || 1024, height: metadata.height || 1024 },
      }
    } catch {
      throw new InvalidFileTypeError('application/pdf (conversion failed - sharp does not support PDF natively)')
    }
  }
}
