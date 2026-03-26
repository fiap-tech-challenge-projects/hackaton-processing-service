export interface IStorageService {
  download(fileUrl: string): Promise<Buffer>
}

export const STORAGE_SERVICE = Symbol('IStorageService')
