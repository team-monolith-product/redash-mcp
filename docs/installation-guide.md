# Redash MCP 설치 가이드

Redash MCP는 AI 어시스턴트(Claude 등)에서 Redash와 AWS Athena에 접근할 수 있게 해주는 MCP 서버입니다.

## 사전 요구사항

- Node.js v18 이상
- npm
- Redash 인스턴스 접근 권한 및 API 키
- (선택) AWS 자격 증명 — Athena 쿼리 실행 시 필요

## 1. 레포지토리 클론 및 빌드

```bash
git clone https://github.com/team-monolith-product/redash-mcp.git
cd redash-mcp
npm install
npm run build
```

## 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성합니다.

```env
# 필수
REDASH_URL=https://redash.codle.io
REDASH_API_KEY=<your-api-key>

# 선택
REDASH_TIMEOUT=30000          # API 요청 타임아웃 (ms, 기본값: 30000)
REDASH_MAX_RESULTS=1000       # 최대 결과 수 (기본값: 1000)

# Athena 사용 시 (선택)
AWS_REGION=ap-northeast-2
ATHENA_OUTPUT_LOCATION=s3://aws-athena-query-results/
```

> Redash API 키는 Redash 웹 UI → 우측 상단 프로필 → Settings → Account → API Key에서 확인할 수 있습니다.

## 3. Claude Code에 MCP 서버 등록

`~/.claude.json` 파일의 `mcpServers`에 다음을 추가합니다.

```json
{
  "mcpServers": {
    "redash": {
      "type": "stdio",
      "command": "/opt/homebrew/bin/node",
      "args": [
        "<redash-mcp-경로>/dist/cli.js"
      ],
      "env": {
        "REDASH_URL": "https://redash.codle.io",
        "REDASH_API_KEY": "<your-api-key>",
        "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

> `<redash-mcp-경로>`를 실제 클론한 절대 경로로 변경하세요. (예: `/Users/username/Workspace/repo/data/redash-mcp`)

## 4. 동작 확인

Claude Code를 재시작한 뒤, 다음과 같이 MCP 도구가 동작하는지 확인합니다.

```
> redash에 있는 대시보드 목록을 보여줘
```

정상적으로 연결되면 대시보드 목록이 마크다운 형식으로 출력됩니다.

## 사용 가능한 도구

| 도구 | 설명 |
|------|------|
| `list_queries` | Redash 쿼리 목록 조회 |
| `get_query` | 특정 쿼리 상세 조회 |
| `create_query` | 새 쿼리 생성 |
| `update_query` | 기존 쿼리 수정 |
| `archive_query` | 쿼리 아카이브 (소프트 삭제) |
| `execute_query` | 저장된 쿼리 실행 |
| `execute_adhoc_query` | 임시 쿼리 실행 (Redash에 저장하지 않음) |
| `list_dashboards` | 대시보드 목록 조회 |
| `get_dashboard` | 대시보드 상세 조회 |
| `list_data_sources` | 데이터 소스 목록 조회 |
| `execute_athena_query` | AWS Athena에서 직접 SQL 실행 |
| `generate_chart` | Chart.js 기반 차트 이미지 생성 |

## 트러블슈팅

### MCP 서버가 연결되지 않는 경우

1. `node` 경로 확인: `which node` 결과를 `command` 필드에 입력
2. `dist/cli.js` 존재 여부 확인: `npm run build`를 다시 실행
3. 환경 변수 확인: `REDASH_URL`과 `REDASH_API_KEY`가 올바른지 확인

### Athena 쿼리가 실패하는 경우

1. AWS 자격 증명 설정 확인: `~/.aws/credentials` 또는 환경 변수
2. `ATHENA_OUTPUT_LOCATION` S3 버킷 접근 권한 확인
3. 데이터베이스 이름 확인: `jce_prd`, `kafka_prd` 등
