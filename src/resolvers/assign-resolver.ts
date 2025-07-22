import { BaseESIResolver, ESIContext } from './base-resolver';

export class AssignResolver extends BaseESIResolver {
    constructor(esiContext: ESIContext) {
        super(esiContext);
    }

    element(element: Element) {
        const name = element.getAttribute('name');
        const value = element.getAttribute('value');

        if (name && value) {
            const processedValue = this.evaluateAssignmentValue(value);
            this.esiContext.setVariable(name, processedValue);
        }

        element.remove();
    }

    private evaluateAssignmentValue(value: string): any {
        // Handle concatenation expressions like: '/' + $(country) + '/' + $(language)
        if (value.includes('+')) {
            return this.evaluateConcatenation(value);
        }

        // Handle variable references
        if (value.includes('$(')) {
            return this.processVariables(value);
        }

        // Handle content from nested elements (like sly tags)
        if (value.includes("'''") && value.includes("${")) {
            // Extract content between triple quotes
            const match = value.match(/'''(.*)'''/);
            if (match) {
                return match[1];
            }
        }

        // Handle basic expressions
        return this.evaluateExpression(value);
    }

    private evaluateConcatenation(expr: string): string {
        // Split by + operator and process each part
        const parts = expr.split('+').map(part => part.trim());
        let result = '';

        for (const part of parts) {
            if (part.startsWith("'") && part.endsWith("'")) {
                // String literal
                result += part.slice(1, -1);
            } else if (part.includes('$(')) {
                // Variable reference
                const processed = this.processVariables(part);
                result += processed;
            } else {
                // Other expressions
                result += this.evaluateExpression(part);
            }
        }

        return result;
    }
}