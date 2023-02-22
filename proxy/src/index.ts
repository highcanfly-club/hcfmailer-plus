import type {Request} from "@cloudflare/workers-types"
export interface Env {
	OKTETO_FQDN_HCFMAILER: string,
	OKTETO_FQDN_MAILTRAIN_PUBLIC: string
	OKTETO_FQDN_MAILTRAIN_TRUSTED: string
}

export default {
	async fetch(
		request: Request<unknown>,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const url = new URL(request.url);
		const _rurl = request.url.toLowerCase();
		if (_rurl.includes('newsletter')){
			url.hostname = env.OKTETO_FQDN_HCFMAILER
		} else if (_rurl.includes('list')){
			url.hostname = env.OKTETO_FQDN_MAILTRAIN_PUBLIC ;
		} else if (_rurl.includes('mailtrain')){
			url.hostname = env.OKTETO_FQDN_MAILTRAIN_TRUSTED ;
		} else {
			url.hostname = env.OKTETO_FQDN_MAILTRAIN_PUBLIC 
		}
		console.log(`Proxy to:${request.method} ${url.toString()}`)
		request.headers.forEach((value,key) => {
			console.log(`\t${key}:${value}`)
		})
		const data = await fetch(url.toString(),request as RequestInit<RequestInitCfProperties>);
		return data;
	},
};
