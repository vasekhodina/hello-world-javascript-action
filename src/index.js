import * as core from "@actions/core";
import { writeFile } from "node:fs/promises";
import {DefaultArtifactClient} from '@actions/artifact';


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

function sleep(s) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

function testBatchStillRunning(batchStatusResponse) {
  core.debug(batchStatusResponse);
  return batchStatusResponse.results.summary.pending > 0;
}

/** @param {unknown} batchStatusJSON
 * @param batchStatusFilepath
 */
async function writeBatchStatusJsonToFile(batchStatusJSON, batchStatusFilepath) {
  await writeFile(
    batchStatusFilepath,
    JSON.stringify(batchStatusJSON, null, 2),
    "utf8",
  );
}

async function run() {
  const apiKey = core.getInput("api-key", { required: true });
  const labelsInput = core.getInput("labels", { required: true });
  const apiUrl = core.getInput("api-url")
  const batchRunUrl = "https://app.aiva.works/scheduling/"
  const batchStatusFilepath = "./batch-status.json"
  const artifact = new DefaultArtifactClient()

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
  core.notice("Link to executed test batch: " + batchRunUrl + batchID);

  let batchStatusJSON = null;
  let batchStatusResText= null;
  
  do {
    core.info("Waiting for test batch to finish.")
    await sleep(30)
    const res = await fetch(apiUrl+ "/" + batchID, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-API-Key": apiKey,
      },
    });

    const batchStatusResText= await res.text();
    core.info(batchStatusResText);
    batchStatusJSON = JSON.parse(batchStatusResText);
    core.info(batchStatusJSON);
  } while (testBatchStillRunning(batchStatusJSON));

  await writeBatchStatusJsonToFile(batchStatusJSON, batchStatusFilepath);

  const {id, size} = await artifact.uploadArtifact(
      'batch-status',
      [batchStatusFilepath],
      {
        retentionDays: 10
      }
  )

  console.notice(`Created artifact with batch status, id: ${id} (bytes: ${size}`) 
  
  core.setOutput("status-code", String(res.status));
  core.setOutput("response-body", batchStatusResText);
}

run().catch((error) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
