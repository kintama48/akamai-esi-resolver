import { BaseESIResolver, ESIContext } from './base-resolver';

export class ChooseResolver extends BaseESIResolver {
    constructor(esiContext: ESIContext) {
        super(esiContext);
    }

    element(element: Element) {
        // Choose blocks are handled by their children (when/otherwise)
        // This handler just ensures the choose tag itself is removed
        element.removeAndKeepContent();
    }
}

export class WhenResolver extends BaseESIResolver {
    constructor(esiContext: ESIContext) {
        super(esiContext);
    }

    element(element: Element) {
        const test = element.getAttribute('test');
        
        if (test && this.evaluateCondition(test)) {
            element.removeAndKeepContent();
        } else {
            element.remove();
        }
    }

    protected evaluateCondition(condition: string): boolean {
        // Handle complex conditions with OR operator (|)
        if (condition.includes('|')) {
            const conditions = condition.split('|').map(c => c.trim());
            return conditions.some(c => this.evaluateSingleCondition(c));
        }

        return this.evaluateSingleCondition(condition);
    }

    private evaluateSingleCondition(condition: string): boolean {
        // Handle negation (!$exists)
        if (condition.includes('!$exists')) {
            const varMatch = condition.match(/!\$exists\(\$\(([^)]+)\)\)/);
            if (varMatch) {
                return !this.esiContext.hasVariable(varMatch[1]);
            }
        }

        // Handle existence checks: $exists(variable)
        if (condition.includes('$exists')) {
            const varMatch = condition.match(/\$exists\(\$\(([^)]+)\)\)/);
            if (varMatch) {
                return this.esiContext.hasVariable(varMatch[1]);
            }
        }

        // Handle equality checks: $(var) == value
        const eqMatch = condition.match(/\$\(([^)]+)\)\s*==\s*(.+)/);
        if (eqMatch) {
            const varValue = this.esiContext.getVariable(eqMatch[1]);
            const compareValue = eqMatch[2].replace(/'/g, '');
            return varValue === compareValue;
        }

        // Handle matches operator with quoted patterns: '''pattern''' or 'pattern'
        const matchesRegex = condition.match(/\$\(([^)]+)\)\s+matches\s+(.+)/);
        if (matchesRegex) {
            const varValue = this.esiContext.getVariable(matchesRegex[1]);
            let pattern = matchesRegex[2];
            
            // Remove triple quotes or single quotes
            pattern = pattern.replace(/'''/g, '').replace(/'/g, '');
            
            try {
                const regex = new RegExp(pattern);
                return regex.test(String(varValue || ''));
            } catch (e) {
                return false;
            }
        }

        // Handle function calls like $checkCountryLanguageExists
        const funcMatch = condition.match(/\$([a-zA-Z_][a-zA-Z0-9_]*)\(/);
        if (funcMatch) {
            const funcName = funcMatch[1];
            const func = this.esiContext.getFunction(funcName);
            if (func) {
                // Execute function (simplified)
                return this.executeFunctionCondition(funcName, condition);
            }
        }

        return super.evaluateCondition(condition);
    }

    private executeFunctionCondition(funcName: string, condition: string): boolean {
        // Extract function arguments
        const argsMatch = condition.match(/\$\w+\(([^)]*)\)/);
        if (argsMatch) {
            const argsStr = argsMatch[1];
            // Process arguments and execute function
            // This is a simplified implementation
            return false; // Default to false for unimplemented functions
        }
        return false;
    }
}

export class OtherwiseResolver extends BaseESIResolver {
    constructor(esiContext: ESIContext) {
        super(esiContext);
    }

    element(element: Element) {
        // Otherwise is the fallback - always execute its content
        element.removeAndKeepContent();
    }
}