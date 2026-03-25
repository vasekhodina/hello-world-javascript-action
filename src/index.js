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

  core.setOutput("status-code", String(res.status));
  core.setOutput("response-body", responseText);
  const response = JSON.parse(responseText);
  const batchID = response["testBatchId"];

  core.info(`AIVA batch request accepted (${res.status})`);
  if (responseText) {
    core.info(responseText);
  }
  core.info(batchID);

  try {
    const res = await fetch(apiUrl+ "/" + batchID, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-API-Key": apiKey,
      },
    });

    const responseText = await res.text();
    core.setOutput("status-code", String(res.status));
    core.setOutput("response-body", responseText);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run().catch((error) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
