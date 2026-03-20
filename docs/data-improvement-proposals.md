# 데이터 인프라 개선 제안

> Athena 데이터 조회 시 발견된 불일치/불편 사항과 개선 방안을 정리합니다.

---

## 1. 파티션 형식 불일치

현재 DB마다 파티션 컬럼명과 형식이 제각각입니다.

| DB | 파티션 컬럼 | 형식 | 예시 |
|---|---|---|---|
| `jce_*` / `datadb_*` | `partition_0` | `YYYY-MM-DD` | `'2026-03-11'` |
| `ga_*` | `event_date` | `YYYYMMDD` | `'20260310'` |
| `data_warehouse_*` | `date` | `YYYY-MM-DDTHH:MM:SS` | `'2026-03-10T00:00:00'` |
| `kafka_*` | `date` | `YYYY-MM-DD` | `'2026-03-10'` |

**문제점:**
- 쿼리할 때마다 어떤 형식인지 기억하거나 확인해야 함
- AI가 쿼리를 생성할 때 형식을 틀려서 에러 발생 빈번
- `DATE '2026-03-10'` vs `'2026-03-10'` vs `'20260310'` 혼용

**개선안:**
- 신규 테이블부터 파티션 컬럼명을 `date`, 형식을 `YYYY-MM-DD` 문자열로 통일
- `ga_*`는 GA4 BigQuery Export 원본 형식이라 변경이 어려움 → 뷰에서 변환
  ```sql
  CREATE VIEW ga_prd.v_events AS
  SELECT *, date_parse(event_date, '%Y%m%d') AS date
  FROM ga_prd.google_analytics;
  ```

---

## 2. GA 테이블 스키마 불일치

**문제점:**
- `parsed_ga`: 파티션마다 `params` 컬럼의 타입이 다름 (map vs JSON array). 넓은 날짜 범위 조회 시 `INVALID_CAST_ARGUMENT` 에러 발생
- `google_analytics`: `is_active_user` 컬럼이 파티션마다 `boolean` / `int` 혼재. `SELECT *` 불가
- `traffic_source`, `collected_traffic_source`, `event_params` 등이 JSON 문자열이라 매번 `json_extract_scalar()` 필요

**개선안:**
- `parsed_ga` 테이블을 재생성하거나 폐기하고, `google_analytics` 기반 뷰로 대체
- JSON 필드를 플래트닝한 뷰 생성:
  ```
  ga_prd.v_sessions    — session_start 이벤트 + UTM/소스 플래트닝
  ga_prd.v_page_views  — page_view 이벤트 + page_location/referrer 플래트닝
  ga_prd.v_clicks      — click 이벤트 + click_text/class 플래트닝
  ```

---

## 3. Glue 메타데이터 부재

**문제점:**
- 대부분의 DB에 `Description`이 비어 있음 (19개 중 5개만 설명 있음)
- 테이블 레벨 Description도 없음
- `SHOW DATABASES`만으로는 각 DB가 뭔지 파악 불가 → AI가 탐색에 시간 소모

**개선안:**
- Glue Catalog의 Database/Table Description 필드 채우기
  ```python
  glue.update_database(
      Name='ga_prd',
      DatabaseInput={'Name': 'ga_prd', 'Description': 'Google Analytics GA4 이벤트 데이터'}
  )
  ```
- 또는 Redash MCP에 메타데이터 조회 도구 추가 (Glue API 기반)

---

## 4. data_mart 불필요한 분리

**문제점:**
- 현재 데이터 규모에서 warehouse와 mart를 나눌 실익이 없음
- 마트 테이블 6개를 위해 별도 DB/파이프라인을 유지하는 관리 비용

**개선안:**
- `data_mart_*` 테이블을 `data_warehouse_*`로 이관
- 필요 시 테이블 네이밍으로 구분 (예: `mart_daily_active_user`)
- 데이터 규모가 커져서 반복 집계 비용이 부담될 때 재도입

---

## 5. 뷰 활용 부재

**문제점:**
- 자주 사용하는 JOIN 패턴을 매번 수동으로 작성해야 함
- JSON 파싱 로직이 반복됨
- AI가 테이블 구조를 매번 탐색해야 쿼리 생성 가능

**개선안:**

| 뷰 | 용도 | 우선순위 |
|---|---|---|
| `ga_prd.v_sessions` | 세션 + UTM/소스 플래트닝 | 높음 |
| `ga_prd.v_page_views` | 페이지뷰 + URL/referrer 플래트닝 | 높음 |
| `ga_prd.v_clicks` | 클릭 이벤트 + 버튼 정보 플래트닝 | 중간 |
| `jce_prd.v_classrooms` | 교실 + 소유자 + 학생 수 JOIN | 중간 |
| `jce_prd.v_submissions` | 제출물 + 활동 + 교실 + 유저 JOIN | 낮음 |

---

## 우선순위 요약

| 순위 | 항목 | 효과 | 난이도 |
|---|---|---|---|
| 1 | GA 플래트닝 뷰 생성 | JSON 파싱 반복 제거, AI 쿼리 정확도 향상 | 낮음 |
| 2 | Glue 메타데이터 채우기 | DB/테이블 탐색 시간 단축 | 낮음 |
| 3 | 파티션 형식 통일 (신규분) | 쿼리 에러 감소 | 중간 |
| 4 | data_mart → warehouse 통합 | 관리 포인트 감소 | 중간 |
| 5 | jce 자주 쓰는 JOIN 뷰 생성 | 반복 쿼리 간소화 | 낮음 |
