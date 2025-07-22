import { BaseESIResolver, ESIContext } from './base-resolver';

export class ForeachResolver extends BaseESIResolver {
    constructor(esiContext: ESIContext) {
        super(esiContext);
    }

    element(element: Element) {
        const collection = element.getAttribute('collection');
        const item = element.getAttribute('item') || 'item';

        if (collection) {
            const collectionValue = this.evaluateCollection(collection);
            if (Array.isArray(collectionValue)) {
                let content = '';
                for (const itemValue of collectionValue) {
                    if (this.esiContext.isBreak()) break;
                    
                    this.esiContext.setVariable(item, itemValue);
                    // Process the content of foreach
                    content += this.processContent(element.getAttribute('innerHTML') || '');
                }
                this.esiContext.clearBreak(); // Clear break flag after loop
                element.replace(content, { html: true });
            } else {
                element.remove();
            }
        } else {
            element.remove();
        }
    }

    protected evaluateCollection(collection: string): any[] {
        // Handle $string_split function with various formats
        const splitMatch = collection.match(/\$string_split\(\$\(([^)]+)\),\s*'([^']+)'\)/);
        if (splitMatch) {
            const varValue = this.esiContext.getVariable(splitMatch[1]);
            if (typeof varValue === 'string') {
                return varValue.split(splitMatch[2]);
            }
        }

        // Handle $str() wrapper around HTTP_ACCEPT_LANGUAGE
        const strMatch = collection.match(/\$string_split\(\$str\(\$\(([^)]+)\)\),\s*'([^']+)'\)/);
        if (strMatch) {
            const varValue = this.esiContext.getVariable(strMatch[1]);
            if (typeof varValue === 'string') {
                return varValue.split(strMatch[2]);
            }
        }

        // Handle direct collection reference
        const directMatch = collection.match(/\$\(([^)]+)\)/);
        if (directMatch) {
            const varValue = this.esiContext.getVariable(directMatch[1]);
            if (Array.isArray(varValue)) {
                return varValue;
            }
            if (typeof varValue === 'string') {
                // If it's a string, treat as comma-separated list
                return varValue.split(',');
            }
        }

        return [];
    }

    private processContent(content: string): string {
        // Process the content within foreach
        // This would normally involve recursive ESI processing
        return this.processVariables(content);
    }
}

export class BreakResolver extends BaseESIResolver {
    constructor(esiContext: ESIContext) {
        super(esiContext);
    }

    element(element: Element) {
        this.esiContext.setBreak();
        element.remove();
    }
}