import * as core from "@actions/core";
import {writeFile} from "node:fs/promises";
import {DefaultArtifactClient} from '@actions/artifact';


/** @param {string} labelsInput */
function parseLabels(labelsInput) {
  const labels = labelsInput
    .split(";")
    .map((s) => s.trim())
    .filter((label) => label.length > 0);
  
  if (labels.length === 0) {
    throw new Error(
        'labels must contain at least one label after splitting by semicolon(e.g. "nightly")',
    );
  }
  return labels;
}

/**
 * @param {number} s - Seconds to wait for
 */
function sleep(s) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

/**
 * @param batchStatusResponse
 * @returns {Boolean} True if there are no more pending tests
 */
function testBatchStillRunning(batchStatusResponse) {
  core.debug(batchStatusResponse);
  const pending = batchStatusResponse?.results?.summary?.pending ?? 0;
  return pending > 0;
}

/**
 * @param batchStatusJSON
 * @param {string} batchStatusFilepath
 */
async function writeBatchStatusJsonToFile(batchStatusJSON, batchStatusFilepath) {
  await writeFile(
    batchStatusFilepath,
    JSON.stringify(batchStatusJSON, null, 2),
    "utf8",
  );
}

/**
 * @param {Request | string | URL} apiUrl
 * @param {string} apiKey
 * @param {string[]} labels
 * @returns {string} batchID of the newly created batch in AIVA
 */
async function executeBatch(apiUrl, apiKey, labels) {
  core.info("Executing test batch containing tests labeled with: " + labels);

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      "name": "Github Action Batch",
      "labels": labels,
      "parallel": true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AIVA batch request failed (${res.status}): ${errText}`);
  }

  core.info(`AIVA batch request accepted (${res.status})`);

  const responseJSON = await res.json();
  const batchId = responseJSON.testBatchId;
  if (typeof batchId !== "string" || batchId.length === 0) {
    throw new Error("AIVA batch response missing testBatchId");
  }
  return batchId;
}

/**
 * @param {string} apiUrl
 * @param {string} apiKey
 * @param {string} batchId
 */
async function getBatchStatus(apiUrl, apiKey, batchId) {
  const res = await fetch(apiUrl + "/" + batchId, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "X-API-Key": apiKey,
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Batch status request failed (${res.status}): ${errText}`);
  }
  return await res.json();
}

/**
 * Main function of the github action.
 */
async function run(){
  const apiKey = core.getInput("api-key", {required: true});
  const labelsInput = core.getInput("labels", {required: true});

  const artifact = new DefaultArtifactClient()

  const apiUrl = "https://api.aiva.works/v1/batches"
  const aivaBatchUrl = "https://app.aiva.works/scheduling/"
  const batchStatusFilepath = "./batch-ctrf.json"
  const labels = parseLabels(labelsInput);
  const batchWaitTimeout = 30

  core.setSecret(apiKey);

  const batchId = await executeBatch(apiUrl, apiKey, labels)
  core.summary.addLink("See the batch results in AIVA. ", aivaBatchUrl + batchId);

  let batchStatus = null;
  do {
    core.info("Waiting for test batch to finish.")
    await sleep(batchWaitTimeout);
    batchStatus = await getBatchStatus(apiUrl, apiKey, batchId);
    core.debug(JSON.stringify(batchStatus));
  } while (testBatchStillRunning(batchStatus));

  core.summary.addRaw(JSON.stringify(batchStatus));
  await writeBatchStatusJsonToFile(batchStatus, batchStatusFilepath);
  await artifact.uploadArtifact(
      'batch-status',
      [batchStatusFilepath],
      ".",
  )

  await core.summary.write()
}

run().catch((error) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
