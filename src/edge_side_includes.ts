import { Context } from './models/context';
import { ESIContext } from './resolvers/base-resolver';
import { DeleteResolver } from './resolvers/base-resolver';
import { IncludeResolver } from './resolvers/include-resolver';
import { IncludeReplaceResolver } from './resolvers/include-resolver';
import { AssignResolver } from './resolvers/assign-resolver';
import { ChooseResolver } from './resolvers/conditional-resolver';
import { WhenResolver } from './resolvers/conditional-resolver';
import { OtherwiseResolver } from './resolvers/conditional-resolver';
import { ForeachResolver } from './resolvers/loop-resolver';
import { VarsResolver } from './resolvers/vars-resolver';
import { FunctionResolver } from './resolvers/function-resolver';
import { BreakResolver } from './resolvers/loop-resolver';


export class EdgeSideIncludesBehavior  {
    constructor(private enabled: boolean, private enableViaHttp: boolean) {
        this.enabled = true;
    }


    public async execute(context: Context) {
        let response = context.get_response();
        if (response === null) {
            return;
        }

        let edge_control = response.headers.get('edge-control') ?? '';
        let disabled_by_header = edge_control.includes('dca=noop');
        let enabled_by_header = edge_control.includes('dca=esi');

        // Only run ESI if
        // - enabled flag is set, or it's enabled via a header and
        // - it's not disabled by edge-control
        let enabled = ((this.enabled || (enabled_by_header)) && !disabled_by_header);

        // Otherwise we won't process tags
        if (!enabled) {
            return;
        }

        // We need the eyeball URL, since we'll only respect ESI include pathname's
        // but use the Eyeball schema, port and hostname
        let request = context.get_request();
        let url = new URL(request.url);

        // But also the potentially modified request object, in case any "modify incoming request
        // header" behaviors triggered
        let modified_request = context.get_modified_request();

        // ESI Context for managing variables, functions, and state
        const esiContext = new ESIContext();
        this.initializeBuiltinVariables(esiContext, request, url);
        
        // This is an HTMLRewriter 'pipeline'. We take the response stream, detect ESI includes
        // and collect all fetch() Promises. This will run requests concurrently without await'ing
        // them here.
        let includeResolver = new IncludeResolver(
          esiContext,
          context,
          modified_request,
          url,
          '1' // Default loop counter
        );

        response = new HTMLRewriter()
          .on('esi\\:include', includeResolver)
          .on('esi\\:vars', new VarsResolver(esiContext))
          .on('esi\\:assign', new AssignResolver(esiContext))
          .on('esi\\:choose', new ChooseResolver(esiContext))
          .on('esi\\:when', new WhenResolver(esiContext))
          .on('esi\\:otherwise', new OtherwiseResolver(esiContext))
          .on('esi\\:foreach', new ForeachResolver(esiContext))
          .on('esi\\:function', new FunctionResolver(esiContext))
          .on('esi\\:break', new BreakResolver(esiContext))
          .on('esi\\:comment', new DeleteResolver(esiContext))
          .on('esi\\:try', new DeleteResolver(esiContext))
          .on('esi\\:attempt', new DeleteResolver(esiContext))
          .on('esi\\:except', new DeleteResolver(esiContext))
          .on('esi\\:eval', new DeleteResolver(esiContext))
          .transform(response);

        // We take the same stream, await promises one by one, then replace the ESI tags with their
        // contents
        let replaceResolver = new IncludeReplaceResolver(esiContext, includeResolver);
        response = new HTMLRewriter()
          .on('esi\\:include', replaceResolver)
          .transform(response);

        context.set_response(response, true);
    }

    private initializeBuiltinVariables(esiContext: ESIContext, request: Request, url: URL) {
        // Initialize built-in ESI variables
        esiContext.setVariable('REQUEST_PATH', url.pathname);
        esiContext.setVariable('HTTP_HOST', request.headers.get('host') || url.hostname);
        esiContext.setVariable('HTTP_USER_AGENT', request.headers.get('user-agent') || '');
        esiContext.setVariable('HTTP_ACCEPT_LANGUAGE', request.headers.get('accept-language') || '');
        esiContext.setVariable('QUERY_STRING', url.search.slice(1));

        // Process query parameters
        url.searchParams.forEach((value, key) => {
            esiContext.setVariable(`QUERY_STRING_${key}`, value);
        });

        // Process cookies
        const cookieHeader = request.headers.get('cookie');
        if (cookieHeader) {
            const cookies = this.parseCookies(cookieHeader);
            Object.entries(cookies).forEach(([name, value]) => {
                esiContext.setVariable(`HTTP_COOKIE_${name}`, value);
            });
        }

        // Extract locale from URL path (e.g., /de/en/)
        const localeMatch = url.pathname.match(/^\/([a-z]{2})\/([a-z]{2})\//);
        if (localeMatch) {
            esiContext.setVariable('RU', localeMatch[1]); // Region/country
            esiContext.setVariable('LC', localeMatch[2]); // Language
        }

        // Mock geolocation data (in real implementation, this would come from CF)
        esiContext.setVariable('GEO_country_code', 'US'); // Default
    }

    private parseCookies(cookieHeader: string): Record<string, string> {
        const cookies: Record<string, string> = {};
        cookieHeader.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            if (name && value) {
                cookies[name] = decodeURIComponent(value);
            }
        });
        return cookies;
    }
}