import { BaseESIResolver, ESIContext, ESIFunction } from './base-resolver';

export class FunctionResolver extends BaseESIResolver {
    constructor(esiContext: ESIContext) {
        super(esiContext);
    }

    element(element: Element) {
        const name = element.getAttribute('name');
        if (name) {
            const func: ESIFunction = {
                name,
                body: this.getElementContent(element),
                args: this.extractFunctionArgs(element)
            };
            this.esiContext.setFunction(name, func);
        }
        element.remove();
    }

    private getElementContent(element: Element): string {
        return element.getAttribute('innerHTML') || element.textContent || '';
    }

    private extractFunctionArgs(element: Element): string[] {
        // Extract function arguments from the function body
        // This is a simplified implementation
        const content = this.getElementContent(element);
        const argsMatch = content.match(/ARGS\{(\d+)\}/g);
        
        if (argsMatch) {
            const argNumbers = argsMatch.map(match => {
                const num = match.match(/\d+/);
                return num ? parseInt(num[0]) : 0;
            });
            return argNumbers.map(n => `arg${n}`);
        }

        return [];
    }
}

export class ReturnResolver extends BaseESIResolver {
    constructor(esiContext: ESIContext) {
        super(esiContext);
    }

    element(element: Element) {
        const value = element.getAttribute('value');
        if (value) {
            const evaluatedValue = this.evaluateReturnValue(value);
            this.esiContext.setReturn(evaluatedValue);
        }
        element.remove();
    }

    private evaluateReturnValue(value: string): any {
        // Handle variable references
        if (value.includes('$(')) {
            return this.processVariables(value);
        }

        // Handle function calls
        if (value.includes('$')) {
            return this.evaluateFunctionCall(value);
        }

        // Handle basic expressions
        return this.evaluateExpression(value);
    }

    private evaluateFunctionCall(expr: string): any {
        // Handle $getCountryLanguageFromCookie calls
        const cookieFuncMatch = expr.match(/\$getCountryLanguageFromCookie\(([^)]+)\)/);
        if (cookieFuncMatch) {
            const args = this.parseArguments(cookieFuncMatch[1]);
            return this.executeGetCountryLanguageFromCookie(args);
        }

        return this.evaluateExpression(expr);
    }

    private parseArguments(argsStr: string): string[] {
        // Parse function arguments
        return argsStr.split(',').map(arg => {
            arg = arg.trim();
            if (arg.includes('$(ARGS{')) {
                // Handle ARGS{n} references
                const argMatch = arg.match(/\$\(ARGS\{(\d+)\}\)/);
                if (argMatch) {
                    const argIndex = parseInt(argMatch[1]);
                    return this.esiContext.getVariable(`ARG_${argIndex}`) || '';
                }
            }
            return this.processVariables(arg);
        });
    }

    private executeGetCountryLanguageFromCookie(args: string[]): string {
        if (args.length >= 2) {
            const cookieValue = args[0];
            const position = parseInt(args[1]);
            
            if (typeof cookieValue === 'string' && !isNaN(position)) {
                const parts = cookieValue.split('-');
                return parts[position] || '';
            }
        }
        return '';
    }
}