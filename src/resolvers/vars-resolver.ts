import { BaseESIResolver, ESIContext } from './base-resolver';

export class VarsResolver extends BaseESIResolver {
    constructor(esiContext: ESIContext) {
        super(esiContext);
    }

    element(element: Element) {
        // Get the content of the vars tag
        const content = this.getElementContent(element);
        
        if (content) {
            // Process variable substitution and function calls
            const processed = this.processVarsContent(content);
            element.replace(processed, { html: true });
        } else {
            element.remove();
        }
    }

    private getElementContent(element: Element): string {
        // Try to get content from various sources
        return element.getAttribute('content') || 
               element.getAttribute('innerHTML') || 
               element.textContent || '';
    }

    private processVarsContent(content: string): string {
        // Process ESI function calls
        content = this.processFunctionCalls(content);
        
        // Process variable substitution
        content = this.processVariables(content);
        
        return content;
    }

    private processFunctionCalls(content: string): string {
        // Handle $set_redirect function
        const redirectMatch = content.match(/\$set_redirect\(([^)]+)\)/);
        if (redirectMatch) {
            const url = this.evaluateExpression(redirectMatch[1]);
            // In a real implementation, this would set the redirect response
            console.log('Setting redirect to:', url);
            return ''; // Remove the function call from output
        }

        // Handle $set_response_code function
        const responseCodeMatch = content.match(/\$set_response_code\((\d+)\)/);
        if (responseCodeMatch) {
            const code = parseInt(responseCodeMatch[1]);
            console.log('Setting response code to:', code);
            return ''; // Remove the function call from output
        }

        // Handle $add_header function
        const addHeaderMatch = content.match(/\$add_header\('([^']+)',\s*([^)]+)\)/);
        if (addHeaderMatch) {
            const headerName = addHeaderMatch[1];
            const headerValue = this.processVariables(addHeaderMatch[2]);
            console.log('Adding header:', headerName, '=', headerValue);
            return ''; // Remove the function call from output
        }

        // Handle $add_cachebusting_header function
        if (content.includes('$add_cachebusting_header()')) {
            console.log('Adding cache busting headers');
            return content.replace('$add_cachebusting_header()', '');
        }

        // Handle $html_encode function
        const htmlEncodeMatch = content.match(/\$html_encode\(([^)]+)\)/);
        if (htmlEncodeMatch) {
            const value = this.processVariables(htmlEncodeMatch[1]);
            const encoded = this.htmlEncode(value);
            return content.replace(htmlEncodeMatch[0], encoded);
        }

        return content;
    }

    private htmlEncode(str: string): string {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    protected processVariables(content: string): string {
        // Enhanced variable processing for complex expressions
        return content.replace(/\$\(([^)]+)\)/g, (match, varExpr) => {
            // Handle nested expressions like HTTP_COOKIE{'key'}
            if (varExpr.includes('{') && varExpr.includes('}')) {
                return this.processComplexVariable(varExpr);
            }

            // Handle simple variable references
            if (this.esiContext.hasVariable(varExpr)) {
                return String(this.esiContext.getVariable(varExpr));
            }

            // Handle built-in variables that might not be in context
            return this.processBuiltinVariable(varExpr) || match;
        });
    }

    private processComplexVariable(varExpr: string): string {
        // Handle HTTP_COOKIE{'key'} format
        const cookieMatch = varExpr.match(/HTTP_COOKIE\{'([^']+)'\}/);
        if (cookieMatch) {
            const cookieName = cookieMatch[1];
            // In a real implementation, this would get the cookie value from the request
            return this.esiContext.getVariable(`HTTP_COOKIE_${cookieName}`) || '';
        }

        // Handle QUERY_STRING{'key'} format
        const queryMatch = varExpr.match(/QUERY_STRING\{'([^']+)'\}/);
        if (queryMatch) {
            const paramName = queryMatch[1];
            return this.esiContext.getVariable(`QUERY_STRING_${paramName}`) || '';
        }

        // Handle GEO{'key'} format
        const geoMatch = varExpr.match(/GEO\{'([^']+)'\}/);
        if (geoMatch) {
            const geoField = geoMatch[1];
            return this.esiContext.getVariable(`GEO_${geoField}`) || '';
        }

        // Handle array/object access like countryMap{$(variable)}
        const arrayMatch = varExpr.match(/([^{]+)\{([^}]+)\}/);
        if (arrayMatch) {
            const arrayName = arrayMatch[1];
            const keyExpr = arrayMatch[2];
            const key = this.processVariables(`$(${keyExpr})`);
            const array = this.esiContext.getVariable(arrayName);
            
            if (array && typeof array === 'object') {
                return array[key] || '';
            }
        }

        return '';
    }

    private processBuiltinVariable(varName: string): string | null {
        // Handle built-in variables that should be available globally
        switch (varName) {
            case 'HTTP_HOST':
                return this.esiContext.getVariable('HTTP_HOST') || '';
            case 'HTTP_USER_AGENT':
                return this.esiContext.getVariable('HTTP_USER_AGENT') || '';
            case 'REQUEST_PATH':
                return this.esiContext.getVariable('REQUEST_PATH') || '';
            case 'QUERY_STRING':
                return this.esiContext.getVariable('QUERY_STRING') || '';
            default:
                return null;
        }
    }
}