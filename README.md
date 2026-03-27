# AIVA batch test run

A [GitHub Action](https://docs.github.com/en/actions) that starts a test batch in [AIVA](https://app.aiva.works/) via `POST /v1/batches`, waits until no tests are pending, then saves the final batch status JSON and uploads it as a workflow artifact.

Runtime: **Node 24** ([`action.yml`](action.yml)). Entry point: [`dist/index.js`](dist/index.js) (build from [`src/index.js`](src/index.js) with Rollup).

## What it does

1. Sends a batch request to `https://api.aiva.works/v1/batches` with your API key and the labels you provide (parallel execution enabled; batch name `"Github Action Batch"`).
2. Polls batch status every **30 seconds** until `results.summary.pending` is zero (or missing, treated as finished).
3. Writes the last status payload to **`batch-ctrf.json`** in the workspace.
4. Uploads that file as an artifact named **`batch-status`**.
5. Adds a [job summary](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary) with a link to the batch in the AIVA app and the final status JSON.

API reference: [Run batch](https://app.aiva.works/docs/api/batches-run-batch).

## Inputs

| Input       | Required | Description |
|------------|----------|-------------|
| `api-key`  | Yes      | AIVA API key. Store as a [repository or organization secret](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions), e.g. `AIVA_API_KEY`, and pass it into the action. |
| `labels`   | Yes      | **Semicolon-separated** test labels (e.g. `smoke;regression`). Empty segments after splitting are ignored; at least one non-empty label is required. |

## Outputs

This action does not declare any [`outputs`](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions#outputs-for-composite-actions) in `action.yml`. Consume the **`batch-status`** artifact or the job summary for results.

## Artifacts

| Name            | Contents |
|-----------------|----------|
| `batch-status`  | File `batch-ctrf.json` (final batch status JSON from the API). |

## Usage

```yaml
jobs:
  run-batch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run AIVA batch
        uses: vasekhodina/hello-world-javascript-action@main   # pin a tag or commit SHA for reproducible builds
        with:
          api-key: <YOUR-AIVA-API-KEY>
          labels: smoke;nightly
```

## License

TBD