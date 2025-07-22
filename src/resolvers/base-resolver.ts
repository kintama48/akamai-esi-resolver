import { Context } from '../models/context';

export interface ESIFunction {
    name: string;
    body: string;
    args: string[];
}

export class ESIContext {
    private variables: Map<string, any> = new Map();
    private functions: Map<string, ESIFunction> = new Map();
    private stack: any[] = [];
    private breakFlag: boolean = false;
    private returnValue: any = null;

    setVariable(name: string, value: any) {
        this.variables.set(name, value);
    }

    getVariable(name: string): any {
        return this.variables.get(name);
    }

    hasVariable(name: string): boolean {
        return this.variables.has(name);
    }

    setFunction(name: string, func: ESIFunction) {
        this.functions.set(name, func);
    }

    getFunction(name: string): ESIFunction | undefined {
        return this.functions.get(name);
    }

    setBreak() {
        this.breakFlag = true;
    }

    isBreak(): boolean {
        return this.breakFlag;
    }

    clearBreak() {
        this.breakFlag = false;
    }

    setReturn(value: any) {
        this.returnValue = value;
    }

    getReturn(): any {
        return this.returnValue;
    }

    clearReturn() {
        this.returnValue = null;
    }
}

export abstract class BaseESIResolver {
    protected esiContext: ESIContext;
    protected context?: Context;

    constructor(esiContext: ESIContext, context?: Context) {
        this.esiContext = esiContext;
        this.context = context;
    }

    abstract element(element: Element): void | Promise<void>;

    protected evaluateExpression(expr: string): any {
        // Basic expression evaluation
        if (expr.startsWith("'") && expr.endsWith("'")) {
            return expr.slice(1, -1);
        }
        if (expr === 'true') return true;
        if (expr === 'false') return false;
        if (!isNaN(Number(expr))) return Number(expr);
        
        return expr;
    }

    protected evaluateCondition(condition: string): boolean {
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

        // Handle matches operator: $(var) matches pattern
        const matchesRegex = condition.match(/\$\(([^)]+)\)\s+matches\s+(.+)/);
        if (matchesRegex) {
            const varValue = this.esiContext.getVariable(matchesRegex[1]);
            const pattern = matchesRegex[2].replace(/'''/g, '').replace(/'/g, '');
            try {
                const regex = new RegExp(pattern);
                return regex.test(String(varValue || ''));
            } catch (e) {
                return false;
            }
        }

        return false;
    }

    protected processVariables(content: string): string {
        // Process ESI variables and functions
        return content.replace(/\$\(([^)]+)\)/g, (match, varName) => {
            if (this.esiContext.hasVariable(varName)) {
                return this.esiContext.getVariable(varName);
            }
            return match;
        });
    }

    protected evaluateCollection(collection: string): any[] {
        // Handle $string_split function
        const splitMatch = collection.match(/\$string_split\(\$\(([^)]+)\),\s*'([^']+)'\)/);
        if (splitMatch) {
            const varValue = this.esiContext.getVariable(splitMatch[1]);
            if (typeof varValue === 'string') {
                return varValue.split(splitMatch[2]);
            }
        }

        // Handle direct collection reference
        const directMatch = collection.match(/\$\(([^)]+)\)/);
        if (directMatch) {
            const varValue = this.esiContext.getVariable(directMatch[1]);
            if (Array.isArray(varValue)) {
                return varValue;
            }
        }

        return [];
    }
}

export class DeleteResolver extends BaseESIResolver {
    element(element: Element) {
        element.remove();
    }
}