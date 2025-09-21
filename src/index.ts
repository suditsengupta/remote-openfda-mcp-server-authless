import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// Import handler functions
import {
  handleSearchDrugAdverseEvents,
  handleSearchDrugLabels,
  handleSearchDrugNDC,
  handleSearchDrugRecalls,
  handleSearchDrugsFDA,
  handleSearchDrugShortages
} from './handlers/drug-handlers.js';

import {
  handleSearchDevice510K,
  handleSearchDeviceClassifications,
  handleSearchDeviceAdverseEvents,
  handleSearchDeviceRecalls
} from './handlers/device-handlers.js';

/**
 * FDA MCP Server
 */
class FDAServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "fda-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
 // Drug Tools
        {
          name: 'search_drug_adverse_events',
          description: 'Search FDA drug adverse event reports (FAERS)',
          inputSchema: {
            type: 'object',
            properties: {
              drug_name: {
                type: 'string',
                description: 'Name of the drug or medication'
              },
              brand_name: {
                type: 'string',
                description: 'Brand/trade name of the drug'
              },
              generic_name: {
                type: 'string',
                description: 'Generic name of the drug'
              },
              manufacturer: {
                type: 'string',
                description: 'Manufacturer name'
              },
              reaction: {
                type: 'string',
                description: 'Adverse reaction or side effect'
              },
              serious_only: {
                type: 'boolean',
                description: 'Only return serious adverse events'
              },
              patient_sex: {
                type: 'string',
                description: 'Patient sex (1=Male, 2=Female)',
                enum: ['1', '2']
              },
              country: {
                type: 'string',
                description: 'Country where event occurred'
              },
              date_from: {
                type: 'string',
                description: 'Start date for date range (YYYYMMDD format)'
              },
              date_to: {
                type: 'string',
                description: 'End date for date range (YYYYMMDD format)'
              },
              count: {
                type: 'string',
                description: 'Field to group results by for counting (e.g., "patient.drug.openfda.brand_name.exact")'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (1-100)',
                minimum: 1,
                maximum: 100
              },
              skip: {
                type: 'number',
                description: 'Number of results to skip for pagination',
                minimum: 0
              }
            }
          }
        },
        {
          name: 'search_drug_labels',
          description: 'Search FDA drug product labeling information',
          inputSchema: {
            type: 'object',
            properties: {
              brand_name: {
                type: 'string',
                description: 'Brand/trade name of the drug'
              },
              generic_name: {
                type: 'string',
                description: 'Generic name of the drug'
              },
              manufacturer: {
                type: 'string',
                description: 'Manufacturer name'
              },
              active_ingredient: {
                type: 'string',
                description: 'Active ingredient name'
              },
              indication: {
                type: 'string',
                description: 'Medical indication or condition'
              },
              route: {
                type: 'string',
                description: 'Route of administration (e.g., ORAL, TOPICAL)'
              },
              product_type: {
                type: 'string',
                description: 'Product type (e.g., HUMAN PRESCRIPTION DRUG)'
              },
              count: {
                type: 'string',
                description: 'Field to group results by for counting'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (1-100)',
                minimum: 1,
                maximum: 100
              },
              skip: {
                type: 'number',
                description: 'Number of results to skip for pagination',
                minimum: 0
              }
            }
          }
        },
        {
          name: 'search_drug_ndc',
          description: 'Search National Drug Code (NDC) directory',
          inputSchema: {
            type: 'object',
            properties: {
              product_ndc: {
                type: 'string',
                description: 'Product NDC number'
              },
              package_ndc: {
                type: 'string',
                description: 'Package NDC number'
              },
              proprietary_name: {
                type: 'string',
                description: 'Proprietary/brand name'
              },
              nonproprietary_name: {
                type: 'string',
                description: 'Nonproprietary/generic name'
              },
              labeler_name: {
                type: 'string',
                description: 'Labeler/manufacturer name'
              },
              dosage_form: {
                type: 'string',
                description: 'Dosage form (e.g., TABLET, CAPSULE, INJECTION)'
              },
              route: {
                type: 'string',
                description: 'Route of administration'
              },
              substance_name: {
                type: 'string',
                description: 'Active substance name'
              },
              count: {
                type: 'string',
                description: 'Field to group results by for counting'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (1-100)',
                minimum: 1,
                maximum: 100
              },
              skip: {
                type: 'number',
                description: 'Number of results to skip for pagination',
                minimum: 0
              }
            }
          }
        },
        {
          name: 'search_drug_recalls',
          description: 'Search drug recall enforcement reports',
          inputSchema: {
            type: 'object',
            properties: {
              product_description: {
                type: 'string',
                description: 'Product description or name'
              },
              recalling_firm: {
                type: 'string',
                description: 'Name of the recalling firm'
              },
              classification: {
                type: 'string',
                description: 'Recall classification (Class I, Class II, Class III)',
                enum: ['Class I', 'Class II', 'Class III']
              },
              status: {
                type: 'string',
                description: 'Recall status',
                enum: ['Ongoing', 'Completed', 'Pending', 'Terminated']
              },
              state: {
                type: 'string',
                description: 'State where recall occurred'
              },
              country: {
                type: 'string',
                description: 'Country where recall occurred'
              },
              reason_for_recall: {
                type: 'string',
                description: 'Reason for the recall'
              },
              date_from: {
                type: 'string',
                description: 'Start date for recall initiation (YYYYMMDD format)'
              },
              date_to: {
                type: 'string',
                description: 'End date for recall initiation (YYYYMMDD format)'
              },
              count: {
                type: 'string',
                description: 'Field to group results by for counting'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (1-100)',
                minimum: 1,
                maximum: 100
              },
              skip: {
                type: 'number',
                description: 'Number of results to skip for pagination',
                minimum: 0
              }
            }
          }
        },
        {
          name: 'search_drugs_fda',
          description: 'Search Drugs@FDA database for approved drug products',
          inputSchema: {
            type: 'object',
            properties: {
              sponsor_name: {
                type: 'string',
                description: 'Sponsor/applicant name'
              },
              application_number: {
                type: 'string',
                description: 'FDA application number (NDA, ANDA, BLA)'
              },
              brand_name: {
                type: 'string',
                description: 'Brand/trade name of the drug'
              },
              generic_name: {
                type: 'string',
                description: 'Generic name of the drug'
              },
              active_ingredient: {
                type: 'string',
                description: 'Active ingredient name'
              },
              dosage_form: {
                type: 'string',
                description: 'Dosage form'
              },
              marketing_status: {
                type: 'string',
                description: 'Marketing status',
                enum: ['Prescription', 'Over-the-counter', 'Discontinued', 'None']
              },
              count: {
                type: 'string',
                description: 'Field to group results by for counting'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (1-100)',
                minimum: 1,
                maximum: 100
              },
              skip: {
                type: 'number',
                description: 'Number of results to skip for pagination',
                minimum: 0
              }
            }
          }
        },
        {
          name: 'search_drug_shortages',
          description: 'Search current drug shortages reported to FDA',
          inputSchema: {
            type: 'object',
            properties: {
              product_name: {
                type: 'string',
                description: 'Product name'
              },
              generic_name: {
                type: 'string',
                description: 'Generic name'
              },
              brand_name: {
                type: 'string',
                description: 'Brand name'
              },
              active_ingredient: {
                type: 'string',
                description: 'Active ingredient name'
              },
              shortage_status: {
                type: 'string',
                description: 'Current shortage status',
                enum: ['Currently in Shortage', 'Resolved', 'Discontinued', 'Available']
              },
              shortage_designation: {
                type: 'string',
                description: 'Shortage designation',
                enum: ['Yes', 'No']
              },
              dosage_form: {
                type: 'string',
                description: 'Dosage form'
              },
              count: {
                type: 'string',
                description: 'Field to group results by for counting'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (1-100)',
                minimum: 1,
                maximum: 100
              },
              skip: {
                type: 'number',
                description: 'Number of results to skip for pagination',
                minimum: 0
              }
            }
          }
        },

        // Device Tools
        {
          name: 'search_device_510k',
          description: 'Search FDA 510(k) device clearances',
          inputSchema: {
            type: 'object',
            properties: {
              device_name: {
                type: 'string',
                description: 'Name of the medical device'
              },
              applicant: {
                type: 'string',
                description: 'Applicant company name'
              },
              contact: {
                type: 'string',
                description: 'Contact information'
              },
              product_code: {
                type: 'string',
                description: 'FDA product code'
              },
              clearance_type: {
                type: 'string',
                description: 'Type of 510(k) clearance'
              },
              decision_date_from: {
                type: 'string',
                description: 'Start date for decision date range (YYYYMMDD format)'
              },
              decision_date_to: {
                type: 'string',
                description: 'End date for decision date range (YYYYMMDD format)'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (1-100)',
                minimum: 1,
                maximum: 100
              },
              skip: {
                type: 'number',
                description: 'Number of results to skip for pagination',
                minimum: 0
              }
            }
          }
        },
        {
          name: 'search_device_classifications',
          description: 'Search FDA device classifications',
          inputSchema: {
            type: 'object',
            properties: {
              device_name: {
                type: 'string',
                description: 'Name of the medical device'
              },
              device_class: {
                type: 'string',
                description: 'Device class (I, II, III)',
                enum: ['1', '2', '3']
              },
              medical_specialty: {
                type: 'string',
                description: 'Medical specialty'
              },
              product_code: {
                type: 'string',
                description: 'FDA product code'
              },
              regulation_number: {
                type: 'string',
                description: 'FDA regulation number'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (1-100)',
                minimum: 1,
                maximum: 100
              },
              skip: {
                type: 'number',
                description: 'Number of results to skip for pagination',
                minimum: 0
              }
            }
          }
        },
        {
          name: 'search_device_adverse_events',
          description: 'Search FDA device adverse events (MDR)',
          inputSchema: {
            type: 'object',
            properties: {
              device_name: {
                type: 'string',
                description: 'Name of the medical device'
              },
              brand_name: {
                type: 'string',
                description: 'Brand name of the device'
              },
              manufacturer: {
                type: 'string',
                description: 'Device manufacturer name'
              },
              product_code: {
                type: 'string',
                description: 'FDA product code'
              },
              event_type: {
                type: 'string',
                description: 'Type of adverse event'
              },
              patient_sex: {
                type: 'string',
                description: 'Patient sex (F=Female, M=Male)',
                enum: ['F', 'M']
              },
              date_from: {
                type: 'string',
                description: 'Start date for event date range (YYYYMMDD format)'
              },
              date_to: {
                type: 'string',
                description: 'End date for event date range (YYYYMMDD format)'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (1-100)',
                minimum: 1,
                maximum: 100
              },
              skip: {
                type: 'number',
                description: 'Number of results to skip for pagination',
                minimum: 0
              }
            }
          }
        },
        {
          name: 'search_device_recalls',
          description: 'Search FDA device recall enforcement reports',
          inputSchema: {
            type: 'object',
            properties: {
              product_description: {
                type: 'string',
                description: 'Product description or name'
              },
              recalling_firm: {
                type: 'string',
                description: 'Name of the recalling firm'
              },
              classification: {
                type: 'string',
                description: 'Recall classification (Class I, Class II, Class III)',
                enum: ['Class I', 'Class II', 'Class III']
              },
              status: {
                type: 'string',
                description: 'Recall status',
                enum: ['Ongoing', 'Completed', 'Pending', 'Terminated']
              },
              product_code: {
                type: 'string',
                description: 'FDA product code'
              },
              date_from: {
                type: 'string',
                description: 'Start date for recall initiation (YYYYMMDD format)'
              },
              date_to: {
                type: 'string',
                description: 'End date for recall initiation (YYYYMMDD format)'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (1-100)',
                minimum: 1,
                maximum: 100
              },
              skip: {
                type: 'number',
                description: 'Number of results to skip for pagination',
                minimum: 0
              }
            }
          }
        }
      ]
    }));


// Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          // Drug Tools
          case 'search_drug_adverse_events':
            return await handleSearchDrugAdverseEvents(request.params.arguments);
          case 'search_drug_labels':
            return await handleSearchDrugLabels(request.params.arguments);
          case 'search_drug_ndc':
            return await handleSearchDrugNDC(request.params.arguments);
          case 'search_drug_recalls':
            return await handleSearchDrugRecalls(request.params.arguments);
          case 'search_drugs_fda':
            return await handleSearchDrugsFDA(request.params.arguments);
          case 'search_drug_shortages':
            return await handleSearchDrugShortages(request.params.arguments);
          
          // Device Tools
          case 'search_device_510k':
            return await handleSearchDevice510K(request.params.arguments);
          case 'search_device_classifications':
            return await handleSearchDeviceClassifications(request.params.arguments);
          case 'search_device_adverse_events':
            return await handleSearchDeviceAdverseEvents(request.params.arguments);
          case 'search_device_recalls':
            return await handleSearchDeviceRecalls(request.params.arguments);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
    }

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
