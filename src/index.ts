/**
 * ESI (Edge Side Includes) Resolver Worker
 * 
 * This Cloudflare Worker processes ESI tags in HTML responses, enabling
 * server-side includes, conditional logic, loops, and variable substitution.
 * 
 * Supported ESI Tags:
 * - esi:include - Include external fragments
 * - esi:assign - Variable assignment
 * - esi:choose/when/otherwise - Conditional logic
 * - esi:foreach - Loop iterations
 * - esi:vars - Variable substitution and function calls
 * - esi:function - Custom function definitions
 * - esi:return - Return values from functions
 * - esi:break - Break from loops
 */

import { EdgeSideIncludesBehavior } from "./edge_side_includes";
import { Context, RequestType } from "./models/context";

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return await start(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;

export async function start(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	try {
		// Create a mock context since we don't have the full Context class
		const context = new Context({
			request,
			wasInitialized: false,
			isEarlyRevalidation: false,
			env,
			cache: caches.default,
			ctx,
			requestType: RequestType.Normal
		});

		// Fetch the original response
		const response = await fetch(request);
		
		// Clone response to check for ESI tags
		const responseClone = response.clone();

		if (await context.esi_tags_check()) {
			context.set_request_type(RequestType.EsiFragment);
			const resolver = new EdgeSideIncludesBehavior();
			resolver.execute(context);
		}


		return response;
		
	} catch (error) {
		console.error('ESI Processing Error:', error);
		// Return original response on error
		return await fetch(request);
	}
}