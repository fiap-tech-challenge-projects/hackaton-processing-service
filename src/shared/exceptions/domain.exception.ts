export class DomainException extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'DomainException'
  }
}

export class InvalidFileTypeError extends DomainException {
  constructor(mimeType: string) {
    super(`Invalid file type: ${mimeType}`, 'INVALID_FILE_TYPE')
  }
}

export class ImageTooSmallError extends DomainException {
  constructor(dimensions: { width: number; height: number }) {
    super(
      `Image is too small: ${dimensions.width}x${dimensions.height}. Minimum is 200x200.`,
      'IMAGE_TOO_SMALL',
    )
  }
}

export class LlmResponseInvalidError extends DomainException {
  constructor(reason: string) {
    super(`LLM response is invalid: ${reason}`, 'LLM_RESPONSE_INVALID')
  }
}

export class StorageDownloadError extends DomainException {
  constructor(url: string) {
    super(`Failed to download file from storage: ${url}`, 'STORAGE_DOWNLOAD_ERROR')
  }
}
