import * as core from "@actions/core";
import { writeFile } from "node:fs/promises";
import {DefaultArtifactClient} from '@actions/artifact';


/** @param {string} labelsInput */
function parseLabels(labelsInput) {
  const labels = labelsInput
    .split(";")
    .map((s) => s.trim());
  
  if (labels.length === 0) {
    throw new Error(
        'labels must contain at least one label after splitting by semicolon(e.g. "nightly")',
    );
  }
  return labels;
}

function sleep(s) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

function testBatchStillRunning(batchStatusResponse) {
  core.debug(batchStatusResponse);
  return batchStatusResponse.results.summary.pending > 0;
}

/**
 * @param batchStatusJSON
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
  
  const artifact = new DefaultArtifactClient()

  const apiUrl = "https://api.aiva.works/v1/batches"
  const aivaBatchUrl= "https://app.aiva.works/scheduling/"
  const batchStatusFilepath = "./batch-ctrf.json"
  const labels = parseLabels(labelsInput);

  core.setSecret(apiKey);
  
  core.info("Executing test batch containing test with these labels:" + labels);
  
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

  const responseText = await res.text();

  core.setOutput("status-code", String(res.status));
  core.setOutput("response-body", responseText);
  const response = JSON.parse(responseText);
  const batchID = res["testBatchId"];

  core.info(`AIVA batch request accepted (${res.status})`);
  if (responseText) {
    core.info(responseText);
  }
  core.summary.addLink("See the batch results in AIVA. ", aivaBatchUrl + batchID);

  let batchStatusJSON = null;
  let batchStatusResText= null;
  
  do {
    core.info("Waiting for test batch to finish.")
    await sleep(30)
    const res = await fetch(apiUrl + "/" + batchID, {
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

  await artifact.uploadArtifact(
      'batch-status',
      [batchStatusFilepath],
      ".",
  )
  
  core.summary.write()
}

run().catch((error) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
