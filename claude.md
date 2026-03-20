# Planning

List queries/dashboards to get basic knowledges of the metric definitions.

Before creating queries, ask to the user about columns of the reqeusted query.

ex)
  Q 결과에 어떤 칼럼이 포함되길 바라시나요?
  A 학교명, 학생수, 최근 사용 날짜.

# Data Analysis Workflow

데이터 분석 요청 시 다음 순서를 따릅니다:

1. `list_dashboards` → 관련 대시보드 탐색
2. `get_dashboard` → 대시보드 내 쿼리 목록 확인
3. `get_query` → 참고할 SQL 쿼리 확인
4. `execute_athena_query` → Athena에서 직접 SQL 실행
5. (선택) `generate_chart` → 결과를 차트로 시각화

# Query Creation

Add '[CLAUDE]' prefix for every queries you made.

# Query Archiving

For your temporary queries, archive it.

# Query Execution

Polling에 이슈가 발생할 수 있으니, 결과에서 행이 확인되지 않고 ID만 반환된다면
같은 쿼리를 재시도해보세요. 쿼리 결과를 얻을지도 모릅니다.

# Table Preview

다음과 같은 쿼리로 데이터 예시와 스키마를 확인하세요.

SELECT * FROM jce_prd.class_entry_submissions LIMIT 10

# Testing

Use 'execute-query' tool.

# Publishing

Do not archive your final query.

# Databases

사용 가능한 DB 목록은 아래와 같다
1. jce_prd : service DB의 snapshot
2. kafka_prd : kafka 로로부터

# Athena SQL Guide

Athena는 Presto 문법을 사용합니다.

**SHOW TABLES 주의사항**:
Athena의 SHOW TABLES는 SQL 표준 LIKE가 아닌 정규표현식을 사용합니다.
- ❌ 잘못된 예: `SHOW TABLES IN database_name LIKE '%pattern%'`
- ✅ 올바른 예: `SHOW TABLES IN database_name '*pattern*'`
- LIKE 키워드를 사용하지 마세요
- `%` 대신 `*` 또는 `.*` 을 사용하세요
- 예: `SHOW TABLES IN jce_prd '*activ*'` (activ를 포함하는 모든 테이블)
- 예: `SHOW TABLES IN jce_prd 'class_*'` (class_로 시작하는 모든 테이블)

# Chart Visualization Guide

데이터 조회 결과를 시각화하려면 `generate_chart` 도구를 사용합니다.

Chart.js config 형식으로 전달합니다:
```json
{
  "type": "bar",
  "data": {
    "labels": ["A", "B", "C"],
    "datasets": [{
      "label": "Count",
      "data": [10, 20, 30]
    }]
  }
}
```

지원하는 차트 유형: bar, line, pie, doughnut, radar, polarArea, scatter, bubble
