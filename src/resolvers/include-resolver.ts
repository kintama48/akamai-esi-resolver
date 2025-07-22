import { BaseESIResolver, ESIContext } from './base-resolver';
import { Context } from '../models/context';
import { start } from '../index';

const HEADER_ESI_FRAGMENT = 'x-esi-fragment';
const HEADER_LOOP = 'x-esi-loop';

// Global ESI Regex patterns
const REGEX_REQUEST_PATH = new RegExp(/\$\(REQUEST_PATH\)/, 'g');
const REGEX_QUERY_STRING = new RegExp(/\$\(QUERY_STRING\{'(.*?)'\}\)/, 'g');
const RU_STRING = new RegExp(/\$\(RU\)/, 'g');
const LC_STRING = new RegExp(/\$\(LC\)/, 'g');

export class IncludeResolver extends BaseESIResolver {
    public context: Context;
    private request: Request;
    private url: URL;
    private promises: (Response | Promise<Response>)[];
    private loop: string;

    constructor(esiContext: ESIContext, context: Context, request: Request, url: URL, loop: string) {
        super(esiContext, context);
        this.context = context;
        this.request = request;
        this.url = url;
        this.promises = [];
        this.loop = loop;
    }

    async element(element: Element) {
        let src = element.getAttribute('src');

        if (!src) {
            return;
        }

        // Process variable substitutions
        src = this.processVariableSubstitutions(src);

        // Build the request URL
        const requestUrl = this.buildRequestUrl(src);
        const request = this.buildRequest(requestUrl);

        // Create and store promise
        const promise = this.createFetchPromise(request);
        this.promises.push(promise);
    }

    private processVariableSubstitutions(src: string): string {
        // Handle $(REQUEST_PATH)
        if (src.includes('REQUEST_PATH')) {
            src = src.replace(REGEX_REQUEST_PATH, this.url.pathname);
        }

        // Handle $(QUERY_STRING)
        if (src.includes('QUERY_STRING')) {
            src = src.replace(REGEX_QUERY_STRING, (match, param) => {
                const paramValue = this.url.searchParams.get(param);
                return paramValue !== null ? paramValue : '';
            });
        }

        // Handle $(RU) and $(LC)
        if (src.includes('RU') || src.includes('LC')) {
            let locales = /\/(..)\/(..)(?=\/|$)/;
            let match = this.url.pathname.match(locales);

            if (src.includes('RU')) {
                src = src.replace(RU_STRING, match?.[1] ?? '');
            }

            if (src.includes('LC')) {
                src = src.replace(LC_STRING, match?.[2] ?? '');
            }
        }

        return src;
    }

    private buildRequestUrl(src: string): URL {
        // Check for fragment host override
        let fragment_host = this.context.get_variables()?.get('builtin.CF_FRAGMENT_HOST')?.get_value() ?? null;

        let url = new URL(src, this.url);
        url.protocol = this.url.protocol;
        url.port = this.url.port;
        url.hostname = (fragment_host !== null) ? fragment_host : this.url.hostname;

        return url;
    }

    private buildRequest(url: URL): Request {
        let request = new Request(url);

        // Set ESI headers
        request.headers.set(HEADER_ESI_FRAGMENT, 'true');
        request.headers.set(HEADER_LOOP, this.loop);
        request.headers.set('host', url.hostname);

        // Add custom fragment headers if configured
        let fragment_headers = this.context.get_variables()?.get('builtin.CF_FRAGMENT_HEADERS')?.get_value() ?? null;
        if (fragment_headers !== null) {
            fragment_headers.split(',').forEach((header: string) => {
                let [key, value] = header.split('=');
                request.headers.set(key, value);
            });
        }

        return request;
    }

    private createFetchPromise(request: Request): Promise<Response> {
        let fragment_host = this.context.get_variables()?.get('builtin.CF_FRAGMENT_HOST')?.get_value() ?? null;

        return (fragment_host !== null)
            ? fetch(request)
            : start(request, this.context.get_env(), this.context.get_ctx());
    }

    getPromises(): (Response | Promise<Response>)[] {
        return this.promises;
    }
}

export class IncludeReplaceResolver extends BaseESIResolver {
    private includeResolver: IncludeResolver;

    constructor(esiContext: ESIContext, includeResolver: IncludeResolver) {
        super(esiContext);
        this.includeResolver = includeResolver;
    }

    async element(element: Element) {
        const src = element.getAttribute('src');

        if (!src) {
            return;
        }

        let onerror = element.getAttribute('onerror') ?? '';

        let promise = this.includeResolver.getPromises().splice(0, 1)[0];
        let response = await promise;

        // Handle error cases based on onerror directive
        let text = (onerror === 'continue' && response.status !== 200 && response.status !== 204)
            ? ''
            : await response.text();

        element.replace(text, { html: true });
    }
}