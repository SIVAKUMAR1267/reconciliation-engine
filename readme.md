Here is a comprehensive, production-ready `README.md` tailored specifically for your KoinX submission. It highlights the exact architectural decisions the reviewers are looking for (performance, data quality, and precision) and provides clear instructions on how to test your code.

---

# KoinX Reconciliation Engine
**Author:** Sivakumar R

## Overview
This is a production-grade Transaction Reconciliation Engine built in Node.js. It ingests messy cryptocurrency transaction data from both user and exchange sources, standardizes the datasets, and runs a highly efficient time-based sliding window algorithm to reconcile the balances. 

The system categorizes transactions into four buckets: `Matched`, `Conflicting`, `Unmatched (User)`, and `Unmatched (Exchange)`, outputting the final results as a downloadable CSV report.

## Tech Stack
* **Runtime:** Node.js (Express.js)
* **Database:** MongoDB (Mongoose)
* **Precision Math:** `bignumber.js`
* **Data Parsing:** `csv-parser`, `json2csv`
* **Testing:** Jest

---

## Key Architectural Decisions

1. **$O(N)$ Sliding Window Algorithm:** 
   A naive reconciliation engine compares every user transaction to every exchange transaction ($O(N^2)$ complexity). To ensure this system scales with high-volume datasets, the engine groups transactions by asset class, sorts them chronologically, and uses a two-pointer sliding window. This drops the matching time complexity to $O(N)$.

2. **Arbitrary-Precision Arithmetic:** 
   Standard JavaScript floating-point math (`0.1 + 0.2 === 0.30000000000000004`) is unsafe for 18-decimal cryptocurrency transactions. All percentage difference calculations for quantity tolerances are executed using `bignumber.js` to prevent false conflict flags.

3. **Defensive Ingestion & Data Quality:** 
   The prompt explicitly noted that the data would be messy. The CSV ingestion stream actively sanitizes the data:
   * Maps aliases (e.g., `bitcoin` → `BTC`).
   * Normalizes perspective shifts (e.g., `TRANSFER_OUT` → `TRANSFER_IN`).
   * Flags missing or corrupt timestamps, saving them to the database as anomalous rows rather than crashing the ingestion pipeline or dropping them silently.

4. **1-to-1 Consumption Lock:** 
   The matching engine tracks consumed exchange transactions in a `Set`. If a user accidentally exports duplicate rows, the engine will only match the first one to the exchange, correctly leaving the duplicate stranded as an `Unmatched (User)` error.

---

## Setup & Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure Environment
# Rename .env.example to .env, or ensure the following variables are set:
# MONGO_URI=mongodb://127.0.0.1:27017/koinx_recon
# PORT=3000

# 3. Start the server
npm start

```

---

## API Documentation

### 1. Trigger Reconciliation Run

**POST** `/api/reconcile`
Ingests the CSV files (placed at the root directory) and executes the matching engine. Accepts optional configuration overrides.

**Request Body (Optional):**

```json
{
  "TIMESTAMP_TOLERANCE_SECONDS": 300,
  "QUANTITY_TOLERANCE_PCT": 0.01
}

```

**Response:**

```json
{
  "success": true,
  "runId": "a1b2c3d4-5678-90ef-ghij-klmnopqrstuv",
  "summary": {
    "MATCHED": 21,
    "CONFLICTING": 1,
    "UNMATCHED_USER": 2,
    "UNMATCHED_EXCHANGE": 3
  }
}

```

### 2. Download Final CSV Report

**GET** `/api/report/:runId`
Downloads the fully formatted reconciliation report as a `.csv` file.
*(Tip: Paste this URL directly into your browser using the `runId` from the POST request to trigger the file download).*

### 3. Get Summary Counts

**GET** `/api/report/:runId/summary`
Returns the numerical breakdown of the reconciliation buckets for a specific run.

### 4. Get Unmatched Data

**GET** `/api/report/:runId/unmatched`
Returns the detailed JSON array of rows that failed to match, alongside the system's reasoning.

---

## Testing

The core mathematical and sliding-window logic is covered by a Jest unit testing suite. To execute the tests:

```bash
npm test

```

```

```