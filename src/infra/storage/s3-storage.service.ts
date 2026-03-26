import { Injectable, Logger } from '@nestjs/common'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { IStorageService } from '@application/ports/storage.port'
import { StorageDownloadError } from '@shared/exceptions/domain.exception'

@Injectable()
export class S3StorageService implements IStorageService {
  private readonly logger = new Logger(S3StorageService.name)
  private readonly s3Client: S3Client
  private readonly bucketName: string

  constructor() {
    const endpoint = process.env.S3_ENDPOINT
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true'

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(endpoint && {
        endpoint,
        forcePathStyle,
      }),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
      },
    })

    this.bucketName = process.env.S3_BUCKET || 'diagrams'
  }

  async download(fileUrl: string): Promise<Buffer> {
    const key = this.extractKeyFromUrl(fileUrl)

    this.logger.log(`Downloading file from S3: bucket=${this.bucketName}, key=${key}`)

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })

      const response = await this.s3Client.send(command)

      if (!response.Body) {
        throw new StorageDownloadError(fileUrl)
      }

      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk)
      }

      const buffer = Buffer.concat(chunks)
      this.logger.log(`Downloaded ${buffer.length} bytes for key=${key}`)

      return buffer
    } catch (error: any) {
      if (error instanceof StorageDownloadError) {
        throw error
      }
      this.logger.error(`Failed to download from S3: ${error.message}`)
      throw new StorageDownloadError(fileUrl)
    }
  }

  private extractKeyFromUrl(fileUrl: string): string {
    // Handle full S3 URLs (s3://bucket/key or https://bucket.s3.region.amazonaws.com/key)
    // Also handles plain keys like "uploads/filename.png"
    try {
      if (fileUrl.startsWith('s3://')) {
        const withoutScheme = fileUrl.slice(5)
        const slashIndex = withoutScheme.indexOf('/')
        return slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : withoutScheme
      }

      if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        const url = new URL(fileUrl)
        // Strip leading slash from pathname
        return url.pathname.slice(1)
      }

      // Treat as a raw S3 key
      return fileUrl
    } catch {
      return fileUrl
    }
  }
}
