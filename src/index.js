import * as core from "@actions/core";

/** @param {string} labelsInput */
function parseLabels(labelsInput) {
  return labelsInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} apiKey
 * @param {"bearer" | "x-api-key"} mode
 */
function authHeaders(apiKey, mode) {
  if (mode === "x-api-key") {
    return { "X-API-Key": apiKey };
  }
  return { Authorization: `Bearer ${apiKey}` };
}

async function run() {
  const apiKey = core.getInput("api-key", { required: true });
  const labelsInput = core.getInput("labels", { required: true });
  const apiUrl = core.getInput("api-url")

  core.setSecret(apiKey);
  
  const labels = parseLabels(labelsInput);
  if (labels.length === 0) {
    throw new Error(
      'labels must contain at least one label after splitting by comma (e.g. "smoke")',
    );
  }

  const body = {
    "name": null,
    "labels": ["test-batch"],
    "parallel": true,
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  const contentType = res.headers.get("content-type") || "";

  if (
    contentType.includes("text/html") ||
    looksLikeHtml(responseText)
  ) {
    const hint =
      "The response is HTML (usually a Next.js 404), not the AIVA JSON API. " +
      "Do not use https://app.aiva.works/... for api-url — that host is the web app. " +
      "Omit api-url or use https://api.aiva.works/v1/batches (or the API host your tenant provides).";
    throw new Error(`${hint}\n\nRequest URL: ${apiUrl}\nHTTP ${res.status}`);
  }

  core.setOutput("status-code", String(res.status));
  core.setOutput("response-body", responseText);

  if (!res.ok) {
    if (looksLikeHtml(responseText)) {
      throw new Error(
        "AIVA API returned an error with an HTML body (wrong host or path). " +
          "Use https://api.aiva.works/v1/batches, not app.aiva.works.\n\n" +
          `HTTP ${res.status} ${res.statusText}\nRequest URL: ${apiUrl}`,
      );
    }
    throw new Error(
      `AIVA API request failed: ${res.status} ${res.statusText}\n${responseText}`,
    );
  }

  core.info(`AIVA batch request accepted (${res.status})`);
  if (responseText) {
    core.info(responseText);
  }
}

run().catch((error) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
