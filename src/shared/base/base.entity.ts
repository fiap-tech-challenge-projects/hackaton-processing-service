export abstract class BaseEntity {
  private readonly _id: string
  private _createdAt: Date
  private _updatedAt: Date

  constructor(id: string, createdAt: Date, updatedAt: Date) {
    this._id = id
    this._createdAt = createdAt
    this._updatedAt = updatedAt
  }

  get id(): string {
    return this._id
  }

  get createdAt(): Date {
    return this._createdAt
  }

  get updatedAt(): Date {
    return this._updatedAt
  }

  set updatedAt(value: Date) {
    this._updatedAt = value
  }

  equals(entity: BaseEntity): boolean {
    if (!(entity instanceof BaseEntity)) {
      return false
    }
    return this._id === entity._id
  }
}
