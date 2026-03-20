import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  QueryExecutionState,
} from "@aws-sdk/client-athena";
import { logger } from "./logger.js";

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 120000;

function getClient(): AthenaClient {
  return new AthenaClient({
    region: process.env.AWS_REGION || "ap-northeast-2",
  });
}

export interface AthenaQueryResult {
  columns: string[];
  rows: string[][];
  totalRows: number;
}

/**
 * Athena 쿼리를 실행하고 결과를 polling하여 반환합니다.
 */
export async function executeAndWait(
  query: string,
  database: string
): Promise<AthenaQueryResult> {
  const client = getClient();
  const outputLocation =
    process.env.ATHENA_OUTPUT_LOCATION || "s3://aws-athena-query-results/";

  // 쿼리 실행 시작
  const startResponse = await client.send(
    new StartQueryExecutionCommand({
      QueryString: query,
      QueryExecutionContext: { Database: database },
      ResultConfiguration: { OutputLocation: outputLocation },
    })
  );

  const executionId = startResponse.QueryExecutionId;
  if (!executionId) {
    throw new Error("QueryExecutionId를 받지 못했습니다.");
  }

  logger.debug(`Athena query started: ${executionId}`);

  // Polling
  const startTime = Date.now();
  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    const statusResponse = await client.send(
      new GetQueryExecutionCommand({ QueryExecutionId: executionId })
    );

    const state = statusResponse.QueryExecution?.Status?.State;

    if (state === QueryExecutionState.SUCCEEDED) {
      break;
    } else if (
      state === QueryExecutionState.FAILED ||
      state === QueryExecutionState.CANCELLED
    ) {
      const reason =
        statusResponse.QueryExecution?.Status?.StateChangeReason ||
        "알 수 없는 오류";
      throw new Error(`쿼리 실행 실패 (${state}): ${reason}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  if (Date.now() - startTime >= POLL_TIMEOUT_MS) {
    throw new Error(
      `쿼리 실행 시간 초과 (${POLL_TIMEOUT_MS / 1000}초). ExecutionId: ${executionId}`
    );
  }

  // 결과 가져오기
  const resultsResponse = await client.send(
    new GetQueryResultsCommand({ QueryExecutionId: executionId })
  );

  const resultSet = resultsResponse.ResultSet;
  if (!resultSet || !resultSet.Rows || resultSet.Rows.length === 0) {
    return { columns: [], rows: [], totalRows: 0 };
  }

  // 첫 번째 행은 컬럼 헤더
  const columns = (resultSet.Rows[0].Data || []).map(
    (d) => d.VarCharValue || ""
  );

  const rows = resultSet.Rows.slice(1).map((row) =>
    (row.Data || []).map((d) => d.VarCharValue || "")
  );

  return { columns, rows, totalRows: rows.length };
}

/**
 * Athena 쿼리 결과를 마크다운 테이블로 포맷팅합니다.
 * 50행 초과 시 처음 50행만 표시합니다.
 */
export function formatResultAsMarkdown(result: AthenaQueryResult): string {
  if (result.columns.length === 0) {
    return "결과가 없습니다.";
  }

  const MAX_ROWS = 50;
  const displayRows = result.rows.slice(0, MAX_ROWS);

  // 헤더 행
  let formatted = "| " + result.columns.join(" | ") + " |\n";
  // 구분선
  formatted += "| " + result.columns.map(() => "---").join(" | ") + " |\n";
  // 데이터 행
  for (const row of displayRows) {
    formatted += "| " + row.join(" | ") + " |\n";
  }

  if (result.totalRows > MAX_ROWS) {
    formatted += `\n(총 ${result.totalRows}행 중 처음 ${MAX_ROWS}행만 표시)`;
  } else {
    formatted += `\n총 ${result.totalRows}행`;
  }

  return formatted;
}
