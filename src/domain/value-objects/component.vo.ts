import { ComponentType } from '@shared/constants/component-types'

export class ComponentVO {
  constructor(
    public readonly name: string,
    public readonly type: ComponentType,
    public readonly description: string,
    public readonly connections: string[],
  ) {}

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      description: this.description,
      connections: this.connections,
    }
  }
}
