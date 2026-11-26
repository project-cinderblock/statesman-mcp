import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { StatesmanApiClient } from "../src/client/index.js";
import { registerAllTools } from "../src/tools/index.js";
import { registerResources } from "../src/resources/index.js";
import { registerPrompts } from "../src/prompts/index.js";

describe("MCP Server Tool, Resource, and Prompt Execution", () => {
  let mock: MockAdapter;
  let server: McpServer;
  let client: StatesmanApiClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    server = new McpServer(
      { name: "statesman-test", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );
    client = new StatesmanApiClient({
      apiUrl: "http://localhost:3000/api/v1",
      timeoutMs: 5000
    });
    registerAllTools(server, client);
    registerResources(server, client);
    registerPrompts(server);
  });

  afterEach(() => {
    mock.restore();
  });

  it("registers all 51 expected tools across all 8 domains", () => {
    const registeredToolNames = Object.keys((server as any)._registeredTools);

    const expectedTools = [
      // Search (2)
      "search",
      "find_counterparts",
      // Continents (8)
      "list_continents",
      "get_continent",
      "create_continent",
      "update_continent",
      "delete_continent",
      "upsert_continents_batch",
      "populate_continents",
      "populate_continent_countries",
      // Countries (9)
      "list_countries",
      "get_country",
      "create_country",
      "update_country",
      "delete_country",
      "upsert_countries_batch",
      "generate_country_embedding",
      "populate_country_cities",
      "populate_countries_bulk",
      // Cities (8)
      "list_cities",
      "get_city",
      "create_city",
      "update_city",
      "delete_city",
      "upsert_cities_batch",
      "generate_city_embedding",
      "populate_cities_bulk",
      // Clusters & Snapshots (7)
      "compute_clusters",
      "create_cluster_snapshot",
      "list_cluster_snapshots",
      "get_cluster_snapshot",
      "delete_cluster_snapshot",
      "list_cluster_groups",
      "get_cluster_group",
      // Reports (10)
      "list_cluster_reports",
      "get_cluster_report",
      "create_cluster_report",
      "delete_cluster_report",
      "generate_deep_synthesis",
      "wait_for_cluster_report",
      "list_report_summaries",
      "get_report_summary",
      "list_report_sub_reports",
      "get_report_sub_report",
      // Jobs (3)
      "list_jobs",
      "get_job_status",
      "wait_for_job",
      // System (5)
      "get_platform_status",
      "get_settings",
      "update_context_window",
      "trigger_bulk_embeddings",
      "get_openapi_spec"
    ];

    for (const tool of expectedTools) {
      expect(registeredToolNames).toContain(tool);
    }
    expect(registeredToolNames.length).toBe(expectedTools.length);
  });

  it("executes the search tool handler successfully", async () => {
    const searchTool = (server as any)._registeredTools["search"];
    expect(searchTool).toBeDefined();

    mock.onGet("http://localhost:3000/api/v1/search").reply(200, {
      data: [{ type: "Country", score: 0.94, data: { id: 1, name: "France" } }]
    });

    const result = await searchTool.handler({
      q: "semi-presidential nuclear republic",
      mode: "auto",
      target_type: "all",
      limit: 10
    });
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain("France");
  });

  it("executes get_country and handles 404 errors gracefully", async () => {
    const getCountryTool = (server as any)._registeredTools["get_country"];
    expect(getCountryTool).toBeDefined();

    mock.onGet("http://localhost:3000/api/v1/countries/42").reply(200, {
      data: { id: 42, name: "Japan", themes: ["island", "tech", "maritime trade"] }
    });

    const result = await getCountryTool.handler({
      id: 42,
      include_cities: true,
      include_embedding: false
    });
    expect(result.content[0].text).toContain("Japan");

    // Test error case
    mock.onGet("http://localhost:3000/api/v1/countries/999").reply(404, {
      error: { code: "not_found", message: "Country not found" }
    });

    const errorResult = await getCountryTool.handler({
      id: 999,
      include_cities: true,
      include_embedding: false
    });
    expect(errorResult.isError).toBe(true);
    expect(errorResult.content[0].text).toContain("Country not found");
  });

  it("executes upsert_cities_batch and find_counterparts for cities", async () => {
    const upsertCitiesTool = (server as any)._registeredTools["upsert_cities_batch"];
    mock.onPost("http://localhost:3000/api/v1/cities/upsert_batch").reply(200, {
      data: [{ id: 10, name: "Busan", themes: ["container port"] }],
      meta: { country_id: 3, count: 1 }
    });

    const upsertRes = await upsertCitiesTool.handler({
      country_id: 3,
      cities: [{ name: "Busan", themes: ["container port"] }]
    });
    expect(upsertRes.content[0].text).toContain("Busan");

    const counterpartsTool = (server as any)._registeredTools["find_counterparts"];
    mock.onGet("http://localhost:3000/api/v1/cities/10/neighbors").reply(200, {
      data: [{ id: 11, name: "Rotterdam", neighbor_distance: 0.05 }]
    });

    const neighborsRes = await counterpartsTool.handler({
      entity_type: "city",
      id: 10,
      limit: 5,
      include_embedding: false
    });
    expect(neighborsRes.content[0].text).toContain("Rotterdam");
  });

  it("registers resources correctly", () => {
    const registeredResources = (server as any)._registeredResources;
    const registeredTemplates = (server as any)._registeredResourceTemplates;

    expect(registeredResources["statesman://status"]).toBeDefined();
    expect(registeredResources["statesman://continents"]).toBeDefined();
    expect(Object.keys(registeredTemplates)).toHaveLength(2);
  });

  it("registers prompts correctly", () => {
    const registeredPrompts = (server as any)._registeredPrompts;
    expect(registeredPrompts["comparative_statecraft_analysis"]).toBeDefined();
    expect(registeredPrompts["geopolitical_cluster_synthesis"]).toBeDefined();

    const promptObj = registeredPrompts["comparative_statecraft_analysis"];
    const generated = promptObj.callback({
      entity_a: "Japan",
      entity_b: "United Kingdom",
      entity_type: "country"
    });
    expect(generated.messages[0].content.text).toContain("Japan");
    expect(generated.messages[0].content.text).toContain("United Kingdom");
  });
});
