import axios from "axios";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { logger } from "./logger.js";

const QUICKCHART_BASE_URL = "https://quickchart.io/chart";

export interface ChartConfig {
  type: string;
  data: {
    labels?: string[];
    datasets: Array<{
      label?: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      [key: string]: any;
    }>;
  };
  options?: Record<string, any>;
}

/**
 * QuickChart API를 사용하여 Chart.js 기반 차트 이미지를 생성합니다.
 */
export async function generateChart(
  config: ChartConfig,
  width: number = 800,
  height: number = 400,
  outputPath?: string
): Promise<string> {
  const chartUrl = `${QUICKCHART_BASE_URL}?c=${encodeURIComponent(JSON.stringify(config))}&w=${width}&h=${height}&bkg=white`;

  logger.debug(`Generating chart: ${config.type}`);

  const response = await axios.get(chartUrl, {
    responseType: "arraybuffer",
    timeout: 30000,
  });

  // 저장 경로 결정
  const filePath =
    outputPath ||
    path.join(os.tmpdir(), `chart_${Date.now()}.png`);

  // 디렉토리가 없으면 생성
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, response.data);
  logger.debug(`Chart saved to: ${filePath}`);

  return filePath;
}
