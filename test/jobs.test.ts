import { describe, it, expect, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { StatesmanApiClient } from "../src/client/index.js";

describe("Job polling (waitForJob)", () => {
  let mock: MockAdapter;
  let client: StatesmanApiClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    client = new StatesmanApiClient({
      apiUrl: "http://localhost:3000/api/v1",
      timeoutMs: 5000
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it("polls job until status becomes completed", async () => {
    let callCount = 0;
    mock.onGet("http://localhost:3000/api/v1/jobs/test-job-1").reply(() => {
      callCount++;
      if (callCount === 1) {
        return [
          200,
          {
            data: {
              job_id: "test-job-1",
              job_class: "PopulateCountriesJob",
              status: "running",
              progress: { current: 1, total: 7 }
            }
          }
        ];
      }
      return [
        200,
        {
          data: {
            job_id: "test-job-1",
            job_class: "PopulateCountriesJob",
            status: "completed",
            result: { success: true }
          }
        }
      ];
    });

    const job = await client.waitForJob("test-job-1", 10, 1000);
    expect(job.status).toBe("completed");
    expect(callCount).toBe(2);
  });

  it("throws when job status is failed", async () => {
    mock.onGet("http://localhost:3000/api/v1/jobs/failed-job").reply(200, {
      data: {
        job_id: "failed-job",
        job_class: "GenerateAllEmbeddingsJob",
        status: "failed",
        error: "Ollama connection refused"
      }
    });

    await expect(client.waitForJob("failed-job", 10, 500)).rejects.toThrow("Ollama connection refused");
  });

  it("returns still-running job with timed_out flag when wait timeout expires", async () => {
    mock.onGet("http://localhost:3000/api/v1/jobs/slow-job").reply(200, {
      data: { job_id: "slow-job", job_class: "GenerateClusterReportJob", status: "running" }
    });

    const job = await client.waitForJob("slow-job", 20, 50);
    expect(job.timed_out).toBe(true);
    expect(job.is_running).toBe(true);
    expect(job.status).toBe("running");
  });
});

describe("Cluster Report Polling (waitForClusterReport)", () => {
  let mock: MockAdapter;
  let client: StatesmanApiClient;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    client = new StatesmanApiClient({
      apiUrl: "http://localhost:3000/api/v1",
      timeoutMs: 5000
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it("polls cluster report until completed", async () => {
    let callCount = 0;
    mock.onGet("http://localhost:3000/api/v1/cluster_reports/5").reply(() => {
      callCount++;
      if (callCount < 2) {
        return [200, { data: { id: 5, status: "running", progress_percentage: 25 } }];
      }
      return [200, { data: { id: 5, status: "completed", progress_percentage: 100, content: "# Scholarly Monograph" } }];
    });

    const report = await client.waitForClusterReport(5, 10, 1000);
    expect(report.status).toBe("completed");
    expect(report.content).toBe("# Scholarly Monograph");
  });

  it("returns still-generating report with timed_out flag when timeout is reached", async () => {
    mock.onGet("http://localhost:3000/api/v1/cluster_reports/5").reply(200, {
      data: { id: 5, status: "running", progress_percentage: 45, phase_description: "Analyzing geopolitical cluster 12" }
    });

    const report = await client.waitForClusterReport(5, 10, 50);
    expect(report.timed_out).toBe(true);
    expect(report.is_running).toBe(true);
    expect(report.progress_percentage).toBe(45);
  });

  it("throws StatesmanApiError when report fails", async () => {
    mock.onGet("http://localhost:3000/api/v1/cluster_reports/5").reply(200, {
      data: { id: 5, status: "failed", error_message: "Synthesis cluster failure" }
    });

    await expect(client.waitForClusterReport(5, 10, 500)).rejects.toThrow("Synthesis cluster failure");
  });
});
