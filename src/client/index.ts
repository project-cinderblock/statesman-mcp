import axios, { AxiosInstance, AxiosError } from "axios";
import { ServerConfig } from "../config.js";
import {
  ApiResponse,
  PlatformStatus,
  PlatformSettings,
  Continent,
  Country,
  City,
  LiveClusterResult,
  ClusterSnapshot,
  ClusterGroup,
  ClusterReport,
  ClusterReportSummary,
  ClusterSubReport,
  JobStatus
} from "./types.js";

export class StatesmanApiError extends Error {
  public code: string;
  public status?: number;
  public details?: string[];

  constructor(message: string, code = "api_error", status?: number, details?: string[]) {
    super(message);
    this.name = "StatesmanApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class StatesmanApiClient {
  public readonly apiUrl: string;
  private http: AxiosInstance;

  constructor(config: ServerConfig) {
    this.apiUrl = config.apiUrl;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    this.http = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeoutMs,
      headers
    });
  }

  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError<{ error?: { code?: string; message?: string; details?: string[] } }>;
      const status = axiosErr.response?.status;
      const errorPayload = axiosErr.response?.data?.error;

      if (errorPayload) {
        throw new StatesmanApiError(
          errorPayload.message || axiosErr.message,
          errorPayload.code || "api_error",
          status,
          errorPayload.details
        );
      }

      throw new StatesmanApiError(
        axiosErr.message,
        status ? `http_${status}` : "network_error",
        status
      );
    }

    if (error instanceof Error) {
      throw new StatesmanApiError(error.message);
    }

    throw new StatesmanApiError(String(error));
  }

  // System & Status
  async getStatus(): Promise<PlatformStatus> {
    try {
      const res = await this.http.get<ApiResponse<PlatformStatus>>("/status");
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getOpenApiSpec(): Promise<Record<string, unknown>> {
    try {
      const res = await this.http.get<Record<string, unknown>>("/openapi.json");
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getSettings(): Promise<PlatformSettings> {
    try {
      const res = await this.http.get<ApiResponse<PlatformSettings>>("/settings");
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateContextWindow(contextWindow: number): Promise<unknown> {
    try {
      const res = await this.http.patch<ApiResponse<unknown>>("/settings/context_window", {
        context_window: contextWindow
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async generateBulkEmbeddings(modelType: "Country" | "City", onlyMissing = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/settings/generate_embeddings", {
        model_type: modelType,
        only_missing: onlyMissing
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Global Search
  async search(params: {
    q: string;
    mode?: "semantic" | "keyword" | "auto";
    target_type?: "all" | "country" | "city";
    limit?: number;
  }): Promise<ApiResponse<unknown>> {
    try {
      const res = await this.http.get<ApiResponse<unknown>>("/search", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Continents
  async listContinents(params?: {
    q?: string;
    include_countries?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Continent[]>> {
    try {
      const res = await this.http.get<ApiResponse<Continent[]>>("/continents", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getContinent(id: number, params?: { include_countries?: boolean }): Promise<Continent> {
    try {
      const res = await this.http.get<ApiResponse<Continent>>(`/continents/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createContinent(continent: { name: string; description?: string }): Promise<Continent> {
    try {
      const res = await this.http.post<ApiResponse<Continent>>("/continents", { continent });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateContinent(id: number, continent: { name?: string; description?: string }): Promise<Continent> {
    try {
      const res = await this.http.patch<ApiResponse<Continent>>(`/continents/${id}`, { continent });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteContinent(id: number): Promise<{ id: number; name: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; name: string; deleted: boolean }>>(`/continents/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async upsertContinentsBatch(
    continents: Array<{ name: string; description?: string }>
  ): Promise<ApiResponse<Continent[]>> {
    try {
      const res = await this.http.post<ApiResponse<Continent[]>>("/continents/upsert_batch", {
        continents
      });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateContinents(sync = false): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        "/continents/populate",
        {},
        {
          params: { sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateContinentCountries(continentId: number, sync = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        `/continents/${continentId}/populate_countries`,
        {},
        {
          params: { sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Countries
  async listCountries(params?: {
    continent_id?: number;
    continent?: string;
    theme?: string;
    q?: string;
    embedded?: boolean;
    include_cities?: boolean;
    include_embedding?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Country[]>> {
    try {
      const res = await this.http.get<ApiResponse<Country[]>>("/countries", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getCountry(id: number, params?: { include_embedding?: boolean; include_cities?: boolean }): Promise<Country> {
    try {
      const res = await this.http.get<ApiResponse<Country>>(`/countries/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createCountry(country: {
    continent_id: number;
    name: string;
    description?: string;
    themes?: string[];
  }): Promise<Country> {
    try {
      const res = await this.http.post<ApiResponse<Country>>("/countries", { country });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateCountry(
    id: number,
    country: {
      name?: string;
      description?: string;
      themes?: string[];
      continent_id?: number;
    }
  ): Promise<Country> {
    try {
      const res = await this.http.patch<ApiResponse<Country>>(`/countries/${id}`, { country });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteCountry(id: number): Promise<{ id: number; name: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; name: string; deleted: boolean }>>(`/countries/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async upsertCountriesBatch(
    continentId: number,
    countries: Array<{
      name: string;
      description?: string;
      themes?: string[];
    }>
  ): Promise<ApiResponse<Country[]>> {
    try {
      const res = await this.http.post<ApiResponse<Country[]>>("/countries/upsert_batch", {
        continent_id: continentId,
        countries
      });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getCountryNeighbors(
    id: number,
    params?: { limit?: number; continent_id?: number; include_embedding?: boolean }
  ): Promise<Country[]> {
    try {
      const res = await this.http.get<ApiResponse<Country[]>>(`/countries/${id}/neighbors`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async generateCountryEmbedding(id: number, sync = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        `/countries/${id}/generate_embedding`,
        {},
        {
          params: { sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateCountryCities(id: number, sync = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        `/countries/${id}/populate_cities`,
        {},
        {
          params: { sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateCountries(continentId?: number, sync = false): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        "/countries/populate",
        {},
        {
          params: { continent_id: continentId, sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Cities
  async listCities(params?: {
    country_id?: number;
    continent_id?: number;
    theme?: string;
    q?: string;
    embedded?: boolean;
    include_embedding?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<City[]>> {
    try {
      const res = await this.http.get<ApiResponse<City[]>>("/cities", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getCity(id: number, params?: { include_embedding?: boolean }): Promise<City> {
    try {
      const res = await this.http.get<ApiResponse<City>>(`/cities/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createCity(city: {
    country_id: number;
    name: string;
    description?: string;
    themes?: string[];
  }): Promise<City> {
    try {
      const res = await this.http.post<ApiResponse<City>>("/cities", { city });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateCity(
    id: number,
    city: {
      name?: string;
      description?: string;
      themes?: string[];
      country_id?: number;
    }
  ): Promise<City> {
    try {
      const res = await this.http.patch<ApiResponse<City>>(`/cities/${id}`, { city });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteCity(id: number): Promise<{ id: number; country_id: number; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; country_id: number; deleted: boolean }>>(
        `/cities/${id}`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async upsertCitiesBatch(
    countryId: number,
    cities: Array<{
      name: string;
      description?: string;
      themes?: string[];
    }>
  ): Promise<ApiResponse<City[]>> {
    try {
      const res = await this.http.post<ApiResponse<City[]>>("/cities/upsert_batch", {
        country_id: countryId,
        cities
      });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getCityNeighbors(
    id: number,
    params?: { limit?: number; country_id?: number; continent_id?: number; include_embedding?: boolean }
  ): Promise<City[]> {
    try {
      const res = await this.http.get<ApiResponse<City[]>>(`/cities/${id}/neighbors`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async generateCityEmbedding(id: number, sync = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        `/cities/${id}/generate_embedding`,
        {},
        {
          params: { sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateCities(countryId?: number, sync = false): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        "/cities/populate",
        {},
        {
          params: { country_id: countryId, sync }
        }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Clusters & Snapshots
  async computeClusters(params?: {
    target_type?: "Country" | "City";
    level?: number;
    full_coverage?: boolean;
    force?: boolean;
  }): Promise<LiveClusterResult> {
    try {
      const res = await this.http.get<ApiResponse<LiveClusterResult>>("/clusters", { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createClusterSnapshot(data: {
    target_type: "Country" | "City";
    level: number;
    full_coverage?: boolean;
    title: string;
  }): Promise<ClusterSnapshot> {
    try {
      const res = await this.http.post<ApiResponse<ClusterSnapshot>>("/clusters/snapshot", data);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async listClusterSnapshots(params?: {
    target_type?: "Country" | "City";
    include_groups?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ClusterSnapshot[]>> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSnapshot[]>>("/cluster_snapshots", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterSnapshot(
    id: number,
    params?: {
      include_groups?: boolean;
      include_members?: boolean;
      include_reports?: boolean;
    }
  ): Promise<ClusterSnapshot> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSnapshot>>(`/cluster_snapshots/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteClusterSnapshot(id: number): Promise<{ id: number; title: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; title: string; deleted: boolean }>>(
        `/cluster_snapshots/${id}`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async listClusterGroups(
    clusterSnapshotId: number,
    params?: { include_members?: boolean }
  ): Promise<ApiResponse<ClusterGroup[]>> {
    try {
      const res = await this.http.get<ApiResponse<ClusterGroup[]>>(
        `/cluster_snapshots/${clusterSnapshotId}/cluster_groups`,
        { params }
      );
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterGroup(id: number, params?: { include_members?: boolean }): Promise<ClusterGroup> {
    try {
      const res = await this.http.get<ApiResponse<ClusterGroup>>(`/cluster_groups/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Synthesis Reports
  async listClusterReports(params?: {
    cluster_snapshot_id?: number;
    target_type?: "Country" | "City";
    status?: string;
    is_detailed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ClusterReport[]>> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReport[]>>("/cluster_reports", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterReport(
    id: number,
    params?: {
      include_summaries?: boolean;
      include_sub_reports?: boolean;
    }
  ): Promise<ClusterReport> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReport>>(`/cluster_reports/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createClusterReport(data: {
    cluster_snapshot_id: number;
    prompt: string;
  }): Promise<ClusterReport> {
    try {
      const res = await this.http.post<ApiResponse<ClusterReport>>("/cluster_reports", data);
      const report = res.data.data;
      if (res.data.meta && (res.data.meta as Record<string, unknown>).job_id) {
        report.job_id = (res.data.meta as Record<string, unknown>).job_id as string;
      }
      return report;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteClusterReport(id: number): Promise<{ id: number; title: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; title: string; deleted: boolean }>>(
        `/cluster_reports/${id}`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deepSynthesis(reportId: number, data?: { batch_size?: number }): Promise<ClusterReport> {
    try {
      const res = await this.http.post<ApiResponse<ClusterReport>>(
        `/cluster_reports/${reportId}/deep_synthesis`,
        data || {}
      );
      const report = res.data.data;
      if (res.data.meta && (res.data.meta as Record<string, unknown>).job_id) {
        report.job_id = (res.data.meta as Record<string, unknown>).job_id as string;
      }
      return report;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async listClusterReportSummaries(clusterReportId: number): Promise<ClusterReportSummary[]> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReportSummary[]>>(
        `/cluster_reports/${clusterReportId}/summaries`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterReportSummary(id: number): Promise<ClusterReportSummary> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReportSummary>>(`/cluster_report_summaries/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async listClusterSubReports(clusterReportId: number): Promise<ClusterSubReport[]> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSubReport[]>>(
        `/cluster_reports/${clusterReportId}/sub_reports`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterSubReport(id: number): Promise<ClusterSubReport> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSubReport>>(`/cluster_sub_reports/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Jobs
  async listJobs(limit = 20): Promise<JobStatus[]> {
    try {
      const res = await this.http.get<ApiResponse<JobStatus[]>>("/jobs", { params: { limit } });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getJob(jobId: string): Promise<JobStatus> {
    try {
      const res = await this.http.get<ApiResponse<JobStatus>>(`/jobs/${jobId}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async waitForJob(jobId: string, pollIntervalMs = 2000, timeoutMs = 60000): Promise<JobStatus> {
    const startTime = Date.now();
    let latestJob: JobStatus | undefined;
    while (Date.now() - startTime < timeoutMs) {
      const job = await this.getJob(jobId);
      latestJob = job;
      if (job.status === "completed") {
        return job;
      }
      if (job.status === "failed") {
        throw new StatesmanApiError(
          job.error || job.message || `Job ${jobId} failed`,
          "job_failed"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    if (latestJob && (latestJob.status === "running" || latestJob.status === "queued" || (latestJob.status as any) === "pending")) {
      return {
        ...latestJob,
        timed_out: true,
        is_running: true
      };
    }
    throw new StatesmanApiError(
      `Job ${jobId} timed out after ${timeoutMs}ms while waiting for completion`,
      "job_timeout"
    );
  }

  async waitForClusterReport(
    id: number,
    pollIntervalMs = 3000,
    timeoutMs = 600000
  ): Promise<ClusterReport> {
    const startTime = Date.now();
    let latestReport: ClusterReport | undefined;
    while (Date.now() - startTime < timeoutMs) {
      const report = await this.getClusterReport(id, { include_summaries: false, include_sub_reports: false });
      latestReport = report;
      if (report.status === "completed") {
        return report;
      }
      if (report.status === "failed") {
        throw new StatesmanApiError(
          report.error_message || `Cluster report ${id} failed to generate`,
          "report_failed"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    if (latestReport && (latestReport.status === "running" || latestReport.status === "queued" || latestReport.status === "pending")) {
      return {
        ...latestReport,
        timed_out: true,
        is_running: true
      };
    }
    throw new StatesmanApiError(
      `Cluster report ${id} timed out after ${timeoutMs}ms while waiting for completion`,
      "report_timeout"
    );
  }
}
