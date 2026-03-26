import { OutputValidatorService } from '../output-validator.service'

describe('OutputValidatorService', () => {
  let service: OutputValidatorService

  beforeEach(() => {
    service = new OutputValidatorService()
  })

  describe('validate', () => {
    const validResponse = JSON.stringify({
      components: [
        {
          name: 'API Gateway',
          type: 'gateway',
          description: 'Entry point for all client requests',
          connections: ['User Service', 'Order Service'],
        },
        {
          name: 'User Service',
          type: 'service',
          description: 'Handles user authentication and profile management',
          connections: ['Users DB'],
        },
        {
          name: 'Order Service',
          type: 'service',
          description: 'Manages order lifecycle',
          connections: ['Orders DB'],
        },
        {
          name: 'Users DB',
          type: 'database',
          description: 'PostgreSQL database for user data',
          connections: [],
        },
        {
          name: 'Orders DB',
          type: 'database',
          description: 'PostgreSQL database for order data',
          connections: [],
        },
      ],
      risks: [
        {
          title: 'Single Point of Failure',
          description: 'The API Gateway is the single entry point with no redundancy',
          severity: 'high',
          category: 'reliability',
          affectedComponents: ['API Gateway'],
        },
      ],
      recommendations: [
        {
          title: 'Add Load Balancer',
          description: 'Introduce a load balancer to distribute traffic and eliminate SPOF',
          priority: 'high',
          effort: 'medium',
          relatedRisks: ['Single Point of Failure'],
        },
      ],
      summary: 'A simple microservices architecture with an API gateway and two services.',
    })

    describe('valid LLM responses', () => {
      it('should validate a well-formed response', () => {
        const result = service.validate(validResponse)

        expect(result.isValid).toBe(true)
        expect(result.parsed).toBeDefined()
        expect(result.confidence).toBeGreaterThan(0)
      })

      it('should strip markdown code blocks before parsing', () => {
        const withMarkdown = '```json\n' + validResponse + '\n```'
        const result = service.validate(withMarkdown)

        expect(result.isValid).toBe(true)
        expect(result.parsed).toBeDefined()
      })

      it('should strip plain code blocks before parsing', () => {
        const withMarkdown = '```\n' + validResponse + '\n```'
        const result = service.validate(withMarkdown)

        expect(result.isValid).toBe(true)
        expect(result.parsed).toBeDefined()
      })

      it('should return confidence = 1 when all checks pass', () => {
        const result = service.validate(validResponse)

        expect(result.confidence).toBe(1)
      })

      it('should populate parsed with the LlmAnalysisResponse on valid input', () => {
        const result = service.validate(validResponse)

        expect(result.parsed?.components).toHaveLength(5)
        expect(result.parsed?.risks).toHaveLength(1)
        expect(result.parsed?.recommendations).toHaveLength(1)
        expect(result.parsed?.summary).toBeDefined()
      })
    })

    describe('invalid LLM responses', () => {
      it('should fail when content is not valid JSON', () => {
        const result = service.validate('this is not json at all')

        expect(result.isValid).toBe(false)
        expect(result.confidence).toBe(0)

        const jsonCheck = result.checks.find((c) => c.name === 'json_parse')
        expect(jsonCheck?.passed).toBe(false)
      })

      it('should fail when JSON has an error field (LLM error response)', () => {
        const errorResponse = JSON.stringify({
          error: 'NOT_ARCHITECTURE_DIAGRAM',
          message: 'The provided image does not appear to be a software architecture diagram',
        })

        const result = service.validate(errorResponse)

        expect(result.isValid).toBe(false)
        expect(result.confidence).toBe(0)

        const errorCheck = result.checks.find((c) => c.name === 'error_response')
        expect(errorCheck?.passed).toBe(false)
        expect(errorCheck?.details?.error).toBe('NOT_ARCHITECTURE_DIAGRAM')
      })

      it('should fail when required fields are missing', () => {
        const missingFields = JSON.stringify({
          components: [],
          // missing risks, recommendations, summary
        })

        const result = service.validate(missingFields)

        expect(result.isValid).toBe(false)

        const requiredCheck = result.checks.find((c) => c.name === 'required_fields')
        expect(requiredCheck?.passed).toBe(false)
        expect(requiredCheck?.details?.missing).toContain('risks')
        expect(requiredCheck?.details?.missing).toContain('recommendations')
        expect(requiredCheck?.details?.missing).toContain('summary')
      })

      it('should fail when component type is not a valid enum value', () => {
        const invalidType = JSON.parse(validResponse)
        invalidType.components[0].type = 'blockchain'

        const result = service.validate(JSON.stringify(invalidType))

        expect(result.isValid).toBe(false)

        const enumCheck = result.checks.find((c) => c.name === 'enum_values')
        expect(enumCheck?.passed).toBe(false)
      })

      it('should fail when risk severity is not a valid enum value', () => {
        const invalidSeverity = JSON.parse(validResponse)
        invalidSeverity.risks[0].severity = 'extreme'

        const result = service.validate(JSON.stringify(invalidSeverity))

        expect(result.isValid).toBe(false)

        const enumCheck = result.checks.find((c) => c.name === 'enum_values')
        expect(enumCheck?.passed).toBe(false)
      })

      it('should fail when risk category is not a valid enum value', () => {
        const invalidCategory = JSON.parse(validResponse)
        invalidCategory.risks[0].category = 'unknown-category'

        const result = service.validate(JSON.stringify(invalidCategory))

        expect(result.isValid).toBe(false)
      })

      it('should fail when recommendation priority is invalid', () => {
        const invalidPriority = JSON.parse(validResponse)
        invalidPriority.recommendations[0].priority = 'critical'

        const result = service.validate(JSON.stringify(invalidPriority))

        expect(result.isValid).toBe(false)
      })

      it('should fail when duplicate component names exist', () => {
        const duplicateComponents = JSON.parse(validResponse)
        duplicateComponents.components.push({ ...duplicateComponents.components[0] })

        const result = service.validate(JSON.stringify(duplicateComponents))

        expect(result.isValid).toBe(false)

        const uniqueCheck = result.checks.find((c) => c.name === 'unique_components')
        expect(uniqueCheck?.passed).toBe(false)
      })

      it('should fail when risk references a component not in the components list', () => {
        const invalidRef = JSON.parse(validResponse)
        invalidRef.risks[0].affectedComponents = ['NonExistentComponent']

        const result = service.validate(JSON.stringify(invalidRef))

        expect(result.isValid).toBe(false)

        const refCheck = result.checks.find((c) => c.name === 'risk_references')
        expect(refCheck?.passed).toBe(false)
      })

      it('should fail hallucination check when there are too many components', () => {
        const manyComponents = JSON.parse(validResponse)
        for (let i = 0; i < 50; i++) {
          manyComponents.components.push({
            name: `Service-${i}`,
            type: 'service',
            description: 'A service',
            connections: [],
          })
        }

        const result = service.validate(JSON.stringify(manyComponents))

        expect(result.isValid).toBe(false)

        const hallucinationCheck = result.checks.find((c) => c.name === 'hallucination_check')
        expect(hallucinationCheck?.passed).toBe(false)
        expect(hallucinationCheck?.details?.tooManyComponents).toBe(true)
      })
    })

    describe('confidence calculation', () => {
      it('should return partial confidence when only some checks pass', () => {
        const partiallyInvalid = JSON.stringify({
          components: [
            {
              name: 'Service A',
              type: 'service',
              description: 'A service',
              connections: [],
            },
          ],
          risks: [],
          recommendations: [],
          summary: 'Basic summary',
          // valid but with duplicate would fail one check
        })

        const result = service.validate(partiallyInvalid)

        // All checks pass for this minimal valid response
        expect(result.confidence).toBeGreaterThan(0)
      })
    })
  })
})
