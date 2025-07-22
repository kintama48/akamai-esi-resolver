interface InitContext {
    request: Request;
    wasInitialized: boolean;
    isEarlyRevalidation: boolean;
    env: Env;
    requestType: RequestType;
    cache: Cache;
    ctx: ExecutionContext;
}

export class Context implements ExecutionContext {
    wasInitialized: boolean;
    env: Env;
    ctx: ExecutionContext;
    request: Request;
    modifiedRequest: Request;
    response: Response | null;
    requestType: RequestType;
    cache: Cache;

    // Phased Releases
    originId: string;

    // Whether this is an early revalidation request
    isEarlyRevalidation: boolean;

    constructor(
        initContext: InitContext
    ) {

        const { request, wasInitialized, isEarlyRevalidation, env, requestType, cache, ctx } = initContext;
        this.wasInitialized = wasInitialized;
        this.env = env;
        this.ctx = ctx;
        this.request = request;
        this.modifiedRequest = new Request(this.request);
        this.originId = '';
        this.isEarlyRevalidation = isEarlyRevalidation;
        this.requestType = requestType;
        this.cache = cache;
        this.response = null;
    }

    public set_response(res: Response, override: boolean = false) {
        if (!this.response || override) {
            this.response = res;
        }
    }

    public get_response(): Response | null {
        return this.response;
    }

    public set_request_type(requestType: RequestType): void {
        this.requestType = requestType;
    }

    public set_was_initialized(wasInitialized: boolean) {
        this.wasInitialized = wasInitialized;
    }

    public get_was_initialized(): boolean {
        return this.wasInitialized;
    }

    public waitUntil(promise: Promise<any>): void {
        return this.ctx.waitUntil(promise);
    }

    public passThroughOnException(): void {
        return this.ctx.passThroughOnException();
    }

    public get props(): any {
        return this.ctx.props;
    }

    public get_env(): Env {
        return this.env;
    }

    public get_ctx(): ExecutionContext {
        return this.ctx;
    }

    public set_request(request: Request): void {
        this.request = request;
    }

    public get_request(): Request {
        return this.request;
    }

    public set_modified_request(request: Request): void {
        this.modifiedRequest = request;
    }

    public get_modified_request(): Request {
        return this.modifiedRequest;
    }

    public set_cache(cache: Cache): void {
        this.cache = cache;
    }

    public get_cache(): Cache {
        return this.cache;
    }

    public get_request_type(): RequestType {
        return this.requestType;
    }

    public set_origin_id(originId: string): void {
        this.originId = originId;
    }

    public get_origin_id(): string {
        return this.originId;
    }

    public is_early_revalidation(): boolean {
        return this.isEarlyRevalidation;
    }

    public async esi_tags_check(): Promise<boolean> {
        const response = this.get_response();
        if (response === null) {
            return false;
        }

        const responseClone = response.clone();
        const bodyText = await responseClone.text();
        
        // Check for any ESI tags
        return bodyText.includes('<esi:') || bodyText.includes('esi:');
    }

    // Variables and Processor support for ESI
    private variables = new Map<string, any>();
    private processor = { get_loop: () => 1 };

    public get_variables() {
        return {
            get: (key: string) => {
                const value = this.variables.get(key);
                return value ? { get_value: () => value } : null;
            }
        };
    }

    public get_processor() {
        return this.processor;
    }

    public set_variable(key: string, value: any): void {
        this.variables.set(key, value);
    }
}

export enum RequestType {
    Normal = 'TEMPLATE',
    // ClientReq = 'CLIENT_REQ',
    EsiFragment = 'ESI_FRAGMENT',
    // EwSubrequest = 'EW_SUBREQUEST',
    // ImageResizing = 'IMAGE_RESIZING'
}