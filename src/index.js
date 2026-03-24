import * as core from "@actions/core";

/**
 * @param {string} labelsInput
 * @returns {string[]}
 */
function parseLabels(labelsInput) {
  return labelsInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} apiKey
 * @param {"bearer" | "x-api-key"} mode
 * @returns {Record<string, string>}
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
  const apiUrl = core.getInput("api-url") || "https://api.aiva.works/v1/batches";
  const authMode = core.getInput("auth-header") || "x-api-key";

  core.setSecret(apiKey);

  if (authMode !== "bearer" && authMode !== "x-api-key") {
    throw new Error(
      `auth-header must be "bearer" or "x-api-key", got "${authMode}"`,
    );
  }

  const labels = parseLabels(labelsInput);
  if (labels.length === 0) {
    throw new Error(
      'labels must contain at least one label after splitting by comma (e.g. "smoke")',
    );
  }

  const body = {
      "name": "test",
      "labels": [
        "test-batch",
      ],
      "parallel": true,
    };

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders(apiKey, authMode),
    },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  core.setOutput("status-code", String(res.status));
  core.setOutput("response-body", responseText);

  if (!res.ok) {
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
