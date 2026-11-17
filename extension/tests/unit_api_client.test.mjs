/**
 * Unit Tests for EpoClaim Extension API Client
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EpoClaimApiClient, EpoClaimClientError } from "../src/api/epoclaim-client.ts";

describe("EpoClaimApiClient Test Suite", () => {
  test("initializes with default localhost:8000 and normalizes trailing slashes", () => {
    const client = new EpoClaimApiClient({ baseUrl: "http://localhost:8000///" });
    assert.equal(client.getBaseUrl(), "http://localhost:8000");
  });

  test("correctly attaches X-API-Key and Authorization Bearer headers when configured", async () => {
    let capturedHeaders = null;
    let capturedBody = null;

    const mockFetch = async (url, init) => {
      capturedHeaders = init.headers;
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          report_id: "rep_test_123",
          original_input: "France won the 2018 World Cup.",
          total_claims: 1,
          supported_claims: 1,
          contradicted_claims: 0,
          outdated_claims: 0,
          claim_results: [],
          evidence_sources: [],
        }),
      };
    };

    const client = new EpoClaimApiClient({
      baseUrl: "https://epoclaim-backend.onrender.com",
      apiKey: "epoclaim_secret_key_123",
      fetchFn: mockFetch,
    });

    const report = await client.analyzeResponse({
      response_text: "France won the 2018 World Cup.",
      prompt: "Who won the 2018 World Cup?",
      enable_live_search: true,
    });

    assert.equal(report.report_id, "rep_test_123");
    assert.equal(report.supported_claims, 1);
    assert.equal(capturedHeaders["X-API-Key"], "epoclaim_secret_key_123");
    assert.equal(capturedHeaders["Authorization"], "Bearer epoclaim_secret_key_123");
    assert.equal(capturedHeaders["Content-Type"], "application/json");
    assert.equal(capturedBody.response_text, "France won the 2018 World Cup.");
    assert.equal(capturedBody.prompt, "Who won the 2018 World Cup?");
    assert.equal(capturedBody.enable_live_search, true);
  });

  test("throws EpoClaimClientError on 401 Unauthorized", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ detail: "Invalid API key" }),
    });

    const client = new EpoClaimApiClient({ fetchFn: mockFetch });

    await assert.rejects(
      async () => {
        await client.analyzeResponse({ response_text: "Test" });
      },
      (err) => {
        assert.ok(err instanceof EpoClaimClientError);
        assert.equal(err.statusCode, 401);
        assert.match(err.message, /Authentication failed/);
        return true;
      }
    );
  });

  test("throws EpoClaimClientError on 404 Not Found for report lookup", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ detail: "Report with ID 'rep_missing' was not found." }),
    });

    const client = new EpoClaimApiClient({ fetchFn: mockFetch });

    await assert.rejects(
      async () => {
        await client.getReport("rep_missing");
      },
      (err) => {
        assert.ok(err instanceof EpoClaimClientError);
        assert.equal(err.statusCode, 404);
        assert.match(err.message, /not found/i);
        return true;
      }
    );
  });

  test("throws EpoClaimClientError on empty response text", async () => {
    const client = new EpoClaimApiClient();
    await assert.rejects(
      async () => {
        await client.analyzeResponse({ response_text: "   " });
      },
      /Response text cannot be empty/
    );
  });
});

