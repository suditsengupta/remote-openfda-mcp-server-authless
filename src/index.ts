import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Types for FDA API responses
interface OpenFDARecord {
	openfda?: {
		brand_name?: string[];
		generic_name?: string[];
		manufacturer_name?: string[];
		product_ndc?: string[];
		dosage_form?: string[];
		route?: string[];
		substance_name?: string[];
	};
	indications_and_usage?: string[];
	dosage_and_administration?: string[];
	use_in_specific_populations?: string[];
	how_supplied_storage_and_handling?: string[];
	warnings_and_precautions?: string[];
	clinical_pharmacology?: string[];
	description?: string[];
}

interface OpenFDAResponse {
	results?: OpenFDARecord[];
}

interface DrugInfo {
	brandNames: string[];
	genericNames: string[];
	manufacturer: string[];
	indications: string[];
	ndcCodes: string[];
}

// Define our FDA MCP agent
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "FDA Drug Tools",
		version: "1.0.0",
	});

	private readonly OPENFDA_URL = "https://api.fda.gov/drug/label.json";
	private readonly TIMEOUT = 30000;
	private readonly MAX_RETRIES = 3;

	async init() {
		// Helper methods
		const normalizeNDC = (ndcInput: string): string[] => {
			if (!ndcInput) return [];
			
			const input = ndcInput.trim();
			const formats = [input];
			
			// Handle hyphenated NDCs
			if (input.includes('-')) {
				const cleanNDC = input.replace(/[^\d]/g, '');
				if (cleanNDC.length >= 9) {
					formats.push(cleanNDC);
				}
			} else {
				// Handle non-hyphenated NDCs
				const cleanNDC = input.replace(/[^\d]/g, '');
				if (cleanNDC.length === 10) {
					formats.push(`${cleanNDC.slice(0, 5)}-${cleanNDC.slice(5, 9)}-${cleanNDC.slice(9)}`);
				} else if (cleanNDC.length === 11) {
					formats.push(`${cleanNDC.slice(0, 5)}-${cleanNDC.slice(5, 9)}-${cleanNDC.slice(9)}`);
				}
			}
			
			return [...new Set(formats)].slice(0, 3);
		};

		const buildSearch = (
			drug?: string,
			manufacturer?: string,
			dosageForm?: string,
			route?: string,
			ndc?: string,
			exact: boolean = false
		): string => {
			// Prioritize NDC searches
			if (ndc) {
				const ndcFormats = normalizeNDC(ndc);
				if (ndcFormats.length > 0) {
					const ndcQueries = ndcFormats.map(format => `openfda.product_ndc:"${format}"`);
					const ndcQuery = `(${ndcQueries.join(" OR ")})`;
					
					const additionalFilters = [];
					if (manufacturer) additionalFilters.push(`openfda.manufacturer_name:"${manufacturer}"`);
					if (dosageForm) additionalFilters.push(`openfda.dosage_form:"${dosageForm}"`);
					if (route) additionalFilters.push(`openfda.route:"${route}"`);
					
					if (!additionalFilters.length && !drug) return ndcQuery;
					
					const queryParts = [ndcQuery];
					if (drug) {
						const fields = ["openfda.brand_name", "openfda.generic_name", "openfda.substance_name"];
						const drugQuery = `(${fields.map(field => 
							exact ? `${field}.exact:"${drug}"` : `${field}:"${drug}"`
						).join(" OR ")})`;
						queryParts.push(drugQuery);
					}
					
					queryParts.push(...additionalFilters);
					return queryParts.join(" AND ");
				}
			}
			
			// Non-NDC searches
			const queryParts = [];
			
			if (drug) {
				const fields = ["openfda.brand_name", "openfda.generic_name", "openfda.substance_name"];
				const drugQuery = `(${fields.map(field => 
					exact ? `${field}.exact:"${drug}"` : `${field}:"${drug}"`
				).join(" OR ")})`;
				queryParts.push(drugQuery);
			}

			if (manufacturer) queryParts.push(`openfda.manufacturer_name:"${manufacturer}"`);
			if (dosageForm) queryParts.push(`openfda.dosage_form:"${dosageForm}"`);
			if (route) queryParts.push(`openfda.route:"${route}"`);

			return queryParts.length > 0 ? queryParts.join(" AND ") : "*:*";
		};

		const fetchOpenFDAWithRetry = async (params: Record<string, any>): Promise<OpenFDAResponse> => {
			for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
				try {
					const url = new URL(this.OPENFDA_URL);
					Object.entries(params).forEach(([key, value]) => {
						url.searchParams.append(key, String(value));
					});

					console.log(`FDA API query (attempt ${attempt + 1}):`, params);
					
					const controller = new AbortController();
					const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);
					
					const response = await fetch(url.toString(), {
						signal: controller.signal,
						headers: {
							'User-Agent': 'FDA-Tools-MCP-Server/1.0.0'
						}
					});
					
					clearTimeout(timeoutId);
					
					if (response.status === 404) {
						console.log(`No results found for query: ${params.search || 'N/A'}`);
						return { results: [] };
					}
					
					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}
					
					const result = await response.json() as OpenFDAResponse;
					console.log(`Found ${result.results?.length || 0} results`);
					return result;
					
				} catch (error) {
					console.warn(`Attempt ${attempt + 1} failed:`, error);
					if (attempt === this.MAX_RETRIES - 1) {
						throw error;
					}
					// Wait before retry
					await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
				}
			}
			throw new Error("All retry attempts failed");
		};

		// Tool parameter schema
		const toolParams = {
			drug_name: z.string().optional(),
			manufacturer: z.string().optional(), 
			dosage_form: z.string().optional(),
			route: z.string().optional(),
			ndc: z.string().optional(),
			limit: z.number().min(1).max(10).default(3),
			exact_match: z.boolean().default(false)
		};

		// 1. Drug Indications Tool
		this.server.tool(
			"get_drug_indications",
			toolParams,
			async ({ drug_name, manufacturer, dosage_form, route, ndc, limit, exact_match }) => {
				try {
					const params = {
						search: buildSearch(drug_name, manufacturer, dosage_form, route, ndc, exact_match),
						limit: Math.max(1, Math.min(limit || 3, 10))
					};
					
					const data = await fetchOpenFDAWithRetry(params);
					if (!data.results?.length) {
						return { content: [{ type: "text", text: "No FDA-approved indications found for the specified criteria." }] };
					}
					
					const results: DrugInfo[] = data.results.map(rec => ({
						brandNames: rec.openfda?.brand_name || [],
						genericNames: rec.openfda?.generic_name || [],
						manufacturer: rec.openfda?.manufacturer_name || [],
						indications: rec.indications_and_usage || [],
						ndcCodes: rec.openfda?.product_ndc || []
					}));
					
					return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error fetching drug indications: ${error}` }] };
				}
			}
		);

		// 2. Drug Dosage Tool
		this.server.tool(
			"get_drug_dosage",
			toolParams,
			async ({ drug_name, manufacturer, dosage_form, route, ndc, limit, exact_match }) => {
				try {
					const params = {
						search: buildSearch(drug_name, manufacturer, dosage_form, route, ndc, exact_match),
						limit: Math.max(1, Math.min(limit || 3, 10))
					};
					
					const data = await fetchOpenFDAWithRetry(params);
					if (!data.results?.length) {
						return { content: [{ type: "text", text: "No FDA-approved dosage information found for the specified criteria." }] };
					}
					
					const dosageInfo = data.results.flatMap(rec => rec.dosage_and_administration || []);
					return { content: [{ type: "text", text: JSON.stringify(dosageInfo, null, 2) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error fetching drug dosage: ${error}` }] };
				}
			}
		);

		// 3. Specific Populations Tool
		this.server.tool(
			"get_specific_populations",
			toolParams,
			async ({ drug_name, manufacturer, dosage_form, route, ndc, limit, exact_match }) => {
				try {
					const params = {
						search: buildSearch(drug_name, manufacturer, dosage_form, route, ndc, exact_match),
						limit: Math.max(1, Math.min(limit || 3, 10))
					};
					
					const data = await fetchOpenFDAWithRetry(params);
					if (!data.results?.length) {
						return { content: [{ type: "text", text: "No specific populations information found for the specified criteria." }] };
					}
					
					const populationsInfo = data.results.flatMap(rec => rec.use_in_specific_populations || []);
					return { content: [{ type: "text", text: JSON.stringify(populationsInfo, null, 2) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error fetching specific populations info: ${error}` }] };
				}
			}
		);

		// 4. Storage & Handling Tool
		this.server.tool(
			"get_storage_handling",
			toolParams,
			async ({ drug_name, manufacturer, dosage_form, route, ndc, limit, exact_match }) => {
				try {
					const params = {
						search: buildSearch(drug_name, manufacturer, dosage_form, route, ndc, exact_match),
						limit: Math.max(1, Math.min(limit || 3, 10))
					};
					
					const data = await fetchOpenFDAWithRetry(params);
					if (!data.results?.length) {
						return { content: [{ type: "text", text: "No storage and handling information found for the specified criteria." }] };
					}
					
					const storageInfo = data.results.flatMap(rec => rec.how_supplied_storage_and_handling || []);
					return { content: [{ type: "text", text: JSON.stringify(storageInfo, null, 2) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error fetching storage handling info: ${error}` }] };
				}
			}
		);

		// 5. Warnings & Precautions Tool
		this.server.tool(
			"get_warnings_precautions",
			toolParams,
			async ({ drug_name, manufacturer, dosage_form, route, ndc, limit, exact_match }) => {
				try {
					const params = {
						search: buildSearch(drug_name, manufacturer, dosage_form, route, ndc, exact_match),
						limit: Math.max(1, Math.min(limit || 3, 10))
					};
					
					const data = await fetchOpenFDAWithRetry(params);
					if (!data.results?.length) {
						return { content: [{ type: "text", text: "No warnings and precautions found for the specified criteria." }] };
					}
					
					const warningsInfo = data.results.flatMap(rec => rec.warnings_and_precautions || []);
					return { content: [{ type: "text", text: JSON.stringify(warningsInfo, null, 2) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error fetching warnings precautions: ${error}` }] };
				}
			}
		);

		// 6. Clinical Pharmacology Tool
		this.server.tool(
			"get_clinical_pharmacology",
			toolParams,
			async ({ drug_name, manufacturer, dosage_form, route, ndc, limit, exact_match }) => {
				try {
					const params = {
						search: buildSearch(drug_name, manufacturer, dosage_form, route, ndc, exact_match),
						limit: Math.max(1, Math.min(limit || 3, 10))
					};
					
					const data = await fetchOpenFDAWithRetry(params);
					if (!data.results?.length) {
						return { content: [{ type: "text", text: "No clinical pharmacology information found for the specified criteria." }] };
					}
					
					const pharmacologyInfo = data.results.flatMap(rec => rec.clinical_pharmacology || []);
					return { content: [{ type: "text", text: JSON.stringify(pharmacologyInfo, null, 2) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error fetching clinical pharmacology: ${error}` }] };
				}
			}
		);

		// 7. Drug Description Tool
		this.server.tool(
			"get_drug_description",
			toolParams,
			async ({ drug_name, manufacturer, dosage_form, route, ndc, limit, exact_match }) => {
				try {
					const params = {
						search: buildSearch(drug_name, manufacturer, dosage_form, route, ndc, exact_match),
						limit: Math.max(1, Math.min(limit || 3, 10))
					};
					
					const data = await fetchOpenFDAWithRetry(params);
					if (!data.results?.length) {
						return { content: [{ type: "text", text: "No drug description found for the specified criteria." }] };
					}
					
					const descriptionInfo = data.results.flatMap(rec => rec.description || []);
					return { content: [{ type: "text", text: JSON.stringify(descriptionInfo, null, 2) }] };
				} catch (error) {
					return { content: [{ type: "text", text: `Error fetching drug description: ${error}` }] };
				}
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
