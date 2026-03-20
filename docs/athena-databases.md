# Athena 데이터베이스 가이드

> Redash에서 AWS Athena 데이터 소스(ID: 1)를 통해 조회할 수 있는 데이터베이스 목록입니다.

---

## 네이밍 규칙

`{서비스}_{env}_{region}`

- **env**: `dev`(개발), `prd`(운영)
- **region**: 서울(기본, 생략), 중동(`me`), 영국(`uk`)

---

## 데이터베이스 목록

### 서비스 DB 스냅샷

매일 RDS 스냅샷으로부터 적재됩니다.

| 패턴 | 이런 데이터를 볼 때 사용 |
|---|---|
| `jce_{env}_{region}` | 교실/교재/활동/학생/교사/제출물/구독 등 **코들 서비스의 원본 데이터**를 직접 확인하고 싶을 때. 특정 교실의 학생 목록, 특정 유저의 제출 이력, 구독 상태 등 서비스 DB를 그대로 조회. `class_` 접두사는 수업 도메인, `user_` 접두사는 사용자 도메인. |
| `datadb_{env}_{region}` | AI Chatkit의 **대화 세션, 스레드, 메시지 내역**을 확인하고 싶을 때. 사용자별 챗봇 사용 이력, 대화 내용 분석. |

### 이벤트 / 로그

| 패턴 | 이런 데이터를 볼 때 사용 |
|---|---|
| `ga_{env}` | **웹사이트 방문/클릭/스크롤 등 사용자 행동 이벤트**, 유입 경로(UTM/트래픽 소스), 디바이스/지역 정보를 볼 때. 마케팅 채널 분석, 페이지별 트래픽, 세션 분석 등. |
| `kafka_{env}` | **서비스 내부 실시간 이벤트**를 볼 때. LLM 호출 로그(요청/응답/타입), 동영상 재생/일시정지 이벤트, 교재 수정 이벤트 등. |

### 정제 데이터

| 패턴 | 이런 데이터를 볼 때 사용 |
|---|---|
| `data_warehouse_{env}` | **1차 정제된 분석용 데이터**. 활성 교실/교재/교사 현황, 교사 분류(초중고/K12), 사용자 활성화(어떤 유저가 어떤 교실에서 어떤 교재를 사용했는지), GA 행동 데이터(클릭/페이지뷰/스크롤/체류), 연수 세션 로그, AI 퀴즈 생성 내역 등. 원본 DB를 JOIN/가공한 결과물. |
| `data_mart_{env}` | **2차 정제된 핵심 지표**. DAU, 마케팅 동의 현황/비율, 에러 도움말 커버리지, 1:1 세션 전환율, 자체 문제 생성 수, 학기 일정 등. 대시보드/리포트에 바로 쓸 수 있는 집계 데이터. |

### 외부 연동

| 패턴 | 이런 데이터를 볼 때 사용 |
|---|---|
| `monday_{env}` | **영업/계약 데이터**. 학교별 계약 상태·금액·기간·담당자·정산 현황, 선도교사 관리(학교·지역·연수 진행 상태) 등 Monday.com에서 관리하는 영업 파이프라인. |
| `default` | **인프라 로그**. ALB 액세스 로그(요청 URL, 응답 코드, 처리 시간, 클라이언트 IP 등), CloudFront 로그. API 응답 시간 분석, 에러율 모니터링, 트래픽 패턴 파악 시 사용. |

---

## 데이터 흐름

```
[원본 소스]              [Athena DB]                [정제 단계]
──────────              ──────────                ──────────
RDS (코들)        →  jce_{env}_{region}     ─┐
RDS (Chatkit)     →  datadb_{env}_{region}   │
Google Analytics  →  ga_{env}                ├→  data_warehouse_{env}  →  data_mart_{env}
Kafka             →  kafka_{env}             │        (1차 정제)            (2차 정제)
Monday.com        →  monday_{env}            ┘
ALB/CloudFront    →  default
```

---

## 파티션 필터링

DB마다 파티션 형식이 다릅니다.

```sql
-- jce/datadb: partition_0 (날짜 문자열)
WHERE partition_0 = '2026-03-11'

-- ga: event_date (YYYYMMDD 문자열)
WHERE event_date = '20260310'

-- data_warehouse/data_mart/kafka: date (날짜 문자열)
WHERE date = '2026-03-10'
```

---

## 주의사항

- `ga_prd.parsed_ga`는 파티션 간 스키마 불일치가 있어, 넓은 날짜 범위 조회 시 에러 발생 가능. raw 테이블(`google_analytics`)을 사용하는 것이 안정적.
- `ga_prd.google_analytics`의 `is_active_user` 컬럼도 파티션 간 타입 불일치가 있으므로, `SELECT *` 대신 필요한 컬럼만 명시할 것.
- GA의 `traffic_source`, `collected_traffic_source`는 JSON 문자열이므로 `json_extract_scalar()`로 파싱해야 함.
