# Metals Intelligence Agent

구리, 알루미늄, 주석, 합금철, 몰리브덴 관련 RSS 뉴스를 Trading 및 Procurement 관점의 실행 가능한 정보로 정리하는 로컬 Intelligence System입니다.

> **기본 시스템은 OpenAI API를 사용하지 않으며 OpenAI API 비용은 발생하지 않습니다.**

RSS 수집부터 분류, 우선순위 계산, 대시보드 저장까지 전부 로컬 Rule Engine으로 처리합니다. Codex는 API 대체 수단이 아니며, 사용자가 선택적으로 검토할 기사만 파일 Queue로 전달하고 결과를 다시 Import하는 별도 워크플로입니다.

## Architecture

```text
RSS feeds
   ↓
Normalization
   ↓
Relevance filtering
   ↓
Deduplication
   ↓
Rule-based intelligence analysis
   ↓
Priority calculation
   ├── Local Dashboard
   ├── Telegram Alert
   └── Optional Codex Analysis Queue
              ↓
       User/Codex file review
              ↓
       Result import → Dashboard
```

기본 실행 경로에는 OpenAI SDK, API key, 모델 호출, 재시도, quota fallback이 없습니다. ChatGPT 웹 세션, Codex 인증 토큰, 쿠키 또는 비공식 endpoint도 사용하지 않습니다.

## 지원 품목

- Copper
- Aluminum / Aluminium
- Tin
- Ferro Alloy: HCFeMn, FeSi, SiMn, FeCr, FeMn
- Molybdenum

공통 규칙은 `config/rules/common.json`, 품목별 규칙은 `config/rules/*.json`에서 관리합니다.

## 준비 사항

- Node.js 22 이상
- 인터넷 연결: RSS 수집과 선택적 Telegram 발송에 사용
- Telegram을 사용하지 않으면 외부 계정이나 API key가 필요하지 않음

## 설치

프로젝트 폴더에서 다음 명령을 실행합니다.

```bash
npm install
```

환경변수 예시를 복사합니다.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

## 일반 실행

```bash
npm start
```

이 명령 하나가 다음 작업을 수행합니다.

1. 로컬 Dashboard Server 시작
2. Agent 즉시 1회 실행
3. RSS 수집 및 Rule 분석
4. Dashboard 데이터 갱신
5. Telegram이 설정된 경우 중요 기사 발송
6. 이후 기본 30분마다 Agent 재실행

실행 시 터미널에 실제 주소가 표시됩니다. 기본 주소는 다음과 같습니다.

```text
http://127.0.0.1:4173/
```

해당 포트가 이미 사용 중이면 Vite가 다음 가용 포트를 표시합니다. 종료하려면 실행한 터미널에서 `Ctrl+C`를 누릅니다.

## npm 명령

| 명령 | 기능 |
|---|---|
| `npm start` | Dashboard + 즉시 Agent 실행 + 30분 Scheduler |
| `npm run agent` | Agent를 실제 모드로 1회 실행하고 데이터를 저장 |
| `npm run agent:dry` | 발송과 파일 저장 없이 결과를 터미널에서 확인 |
| `npm run dev` | Dashboard 개발 서버만 실행 |
| `npm run codex:queue` | Pending Queue를 출력하고 Codex 요청 Markdown 생성 |
| `npm run codex:import` | Codex 분석 결과를 Queue와 Dashboard에 반영 |
| `npm run digest` | 당일 요약 Telegram 발송 |
| `npm run digest:dry` | 요약 메시지를 발송하지 않고 확인 |
| `npm test` | 전체 자동 테스트 |
| `npm run build` | Production Dashboard 빌드 |

## 환경변수

`.env`는 `package.json`과 같은 프로젝트 최상위 폴더에 둡니다.

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
KAKAO_ACCESS_TOKEN=
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=
KAKAO_REFRESH_TOKEN=
KAKAO_LINK_URL=
DRY_RUN=false
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=4173
```

- `TELEGRAM_BOT_TOKEN`: BotFather가 발급한 Bot token
- `TELEGRAM_CHAT_ID`: Bot이 메시지를 보낼 개인 또는 그룹 Chat ID
- `KAKAO_ACCESS_TOKEN`: 현재 카카오 Access Token. 만료 시 자동 갱신됨
- `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REFRESH_TOKEN`: 카카오 Access Token 자동 갱신에 사용
- `DRY_RUN=true`: 메시지를 보내거나 JSON을 저장하지 않고 결과만 출력
- `DASHBOARD_HOST`, `DASHBOARD_PORT`: 로컬 Dashboard 바인딩 설정
- 새 카카오 토큰은 로컬의 `.kakao-token-state.json`에 저장되며 이 파일은 Git에서 제외됨
- 카카오 자동 갱신은 로컬의 지속되는 파일시스템을 기준으로 동작함. 매 실행마다 초기화되는 배포 환경에서는 별도 Secret 저장소가 필요함

`OPENAI_API_KEY`는 사용하지도 요구하지도 않습니다. Secret을 `VITE_*` 변수로 만들지 마세요. `VITE_*` 값은 브라우저 번들에 포함될 수 있습니다.

## Telegram 설정

1. Telegram에서 `@BotFather`를 열어 Bot을 만듭니다.
2. Bot token을 `.env`의 `TELEGRAM_BOT_TOKEN`에 입력합니다.
3. 생성한 Bot에게 `/start` 메시지를 보냅니다.
4. Chat ID를 확인해 `TELEGRAM_CHAT_ID`에 입력합니다.
5. 첫 시험에서는 `config/settings.json`의 `maxMessagesPerRun`을 `1`로 둡니다.
6. `DRY_RUN=false`인지 확인하고 `npm run agent`를 실행합니다.

Telegram 정보가 없으면 Agent는 실패하지 않습니다.

```text
Telegram not configured. Skipping delivery.
```

이미 성공적으로 발송된 기사는 `data/sent-items.json`을 기준으로 다시 보내지 않습니다. 전송 실패 기사는 발송 완료로 기록하지 않습니다.

## Rule Engine

Rule Engine은 단순 키워드 빈도 대신 사건 방향을 구분합니다.

- Supply Bullish: 광산·제련소 shutdown, 감산, 파업, 사고, 수출 금지, 제재, 물류 차질
- Supply Bearish: 신규 광산, 증설, 생산 증가, 재가동, 수출 증가
- Demand Bullish: EV 수요 증가, 전력망 투자, 건설·제조업 회복, 중국 부양책
- Demand Bearish: 경기침체, 수요 둔화, 건설 둔화, 제조업 위축
- Inventory Bullish: 재고 감소, 비축량 고갈, 창고 유출
- Inventory Bearish: 재고 증가, 창고 유입

상승 및 하락 근거가 함께 있거나 생산·가격 영향이 명시적으로 불명확하면 `Unclear`로 유지합니다. Procurement 평가는 구매자의 비용, 리드타임, 가용성 및 공급 위험 관점입니다.

### 동음이의어 오탐 방지

`config/commodities.json`의 `ambiguousKeywords`와 `exclusionPatterns`가 금속명과 다른 뜻의 문맥을 구분합니다. 예를 들어 `경기도 구리시`, `구리경찰서`, `시진핑 주석`, `국가주석`, 각주·주석 표기, 생활용품 tin 문맥은 제외합니다. 반면 `구리 광산`, `구리 가격`, `주석 수출`, `주석 공급`처럼 명시적인 금속시장 문맥이 있으면 정상적으로 유지합니다.

Importance는 Trading Impact, Procurement Impact, 사건 규모, 공급·수요 변화 폭을 함께 반영합니다.

## Codex Analysis Queue

Rule 분석 후 선택적 정밀 검토 가치가 있는 기사만 다음 파일에 저장됩니다.

```text
data/codex-analysis-queue.json
```

지원 상태:

- `PENDING`: 선택적 검토 후보
- `ANALYZED`: Codex 결과가 정상 Import됨
- `SKIPPED`: 검토하지 않기로 결정

기본 Queue 기준은 `config/settings.json`의 `codexQueue`에서 조정합니다. HIGH 기사, MEDIUM 이상이면서 방향이 불명확한 기사, 상충 신호, 중요 사건 taxonomy가 후보입니다. 일반 LOW 기사는 Queue에서 제외됩니다.

### Codex 정밀 분석 요청 만들기

```bash
npm run codex:queue
```

터미널에 Pending 목록을 출력하고 다음 파일을 생성합니다.

```text
outputs/codex-analysis-request.md
```

이 Markdown을 Codex 환경에서 열어 명시적으로 분석을 요청합니다. 프로젝트가 Codex를 자동 호출하거나 인증 정보를 재사용하지 않습니다.

### Codex 결과 작성

결과를 `data/codex-analysis-results.json`의 `items`에 넣습니다.

```json
{
  "items": [
    {
      "id": "Queue의 기사 ID",
      "importance": "HIGH",
      "marketImpact": "Bullish",
      "procurementImpact": "NEGATIVE",
      "category": "Supply Disruption",
      "region": "Chile",
      "summary": "기사에 근거한 요약",
      "marketImpactReason": "시장 방향의 근거",
      "procurementImpactReason": "구매자 관점 영향",
      "keyEvidence": ["기사에 실제로 포함된 근거"],
      "confidence": "HIGH"
    }
  ]
}
```

허용값:

- Importance: `HIGH`, `MEDIUM`, `LOW`
- Market Impact: `Bullish`, `Bearish`, `Neutral`, `Unclear`
- Procurement Impact: `NEGATIVE`, `POSITIVE`, `NEUTRAL`, `UNCLEAR`
- Confidence: `HIGH`, `MEDIUM`, `LOW`

### Codex 결과 반영

```bash
npm run codex:import
```

Import 후에도 Rule 결과는 삭제되지 않습니다.

```json
{
  "ruleAnalysis": {},
  "codexAnalysis": {},
  "effectiveAnalysis": {},
  "analysisSource": "CODEX"
}
```

Codex 분석이 유효하면 Dashboard의 effective 값은 Codex 결과를 우선 사용합니다. 기사 Detail에서는 Rule과 Codex 분석을 나란히 비교할 수 있습니다.

## Scheduler

`npm start`는 시작 직후 Agent를 한 번 실행한 다음 `agentIntervalMinutes` 간격으로 반복합니다.

```json
"agentIntervalMinutes": 30
```

이전 실행이 끝나지 않았다면 다음 실행을 중첩하지 않습니다.

```text
Agent already running. Skipping scheduled run.
```

## Dashboard

Dashboard는 다음 정보를 표시합니다.

- 품목별 Today News, HIGH, MEDIUM, Bullish, Bearish, Procurement Risk
- Market Signal Board: Market Bias, Supply, Demand, Inventory, Procurement Risk
- Latest Intelligence: 품목, 중요도, 방향, 조달 영향, Category, Region, Source, Analysis Source, Sent
- Analysis Source 필터: `RULE`, `CODEX`
- 기사 Detail의 Rule/Codex 비교
- Codex Analysis Queue의 Pending, Analyzed, Skipped 및 검토 사유
- RSS source health

화면은 30초마다 로컬 JSON을 새로 읽습니다.

## 데이터 파일

```text
data/
  sent-items.json
  codex-analysis-queue.json
  codex-analysis-results.json

public/data/
  latest-news.json
  market-summary.json
  status.json
  codex-analysis-queue.json
```

기존 뉴스 및 발송 이력은 새 실행 시 ID 기준으로 병합하며 보존 기간 설정 안에서 유지됩니다.

## Source Health

각 RSS source는 독립적으로 실행됩니다. 한 source가 실패해도 나머지 source와 Agent는 계속 작동합니다. 비활성 source도 Settings 화면에서 확인할 수 있습니다.

- Google News Metals EN: 기본 활성
- Google News Metals KO: 기본 활성
- International Tin Association: 기본 활성
- MINING.COM: HTTP 403이 확인되어 기본 비활성
- Aluminium Insider: malformed XML이 확인되어 기본 비활성

## GitHub Actions

- `news-agent.yml`: 정기 뉴스 수집, Rule 분석, Queue 및 Dashboard 데이터 커밋
- `daily-digest.yml`: KST 07:30, 12:00, 17:30 요약
- `deploy-dashboard.yml`: GitHub Pages 빌드 및 배포

워크플로에 OpenAI Secret은 없습니다. 선택적으로 필요한 Secret은 다음 두 개입니다.

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

Secret이 없어도 뉴스 Agent workflow는 Rule-only 모드로 정상 완료됩니다.

## 검증

```bash
npm install
npm test
npm run build
npm run agent
npm run codex:queue
npm start
```

`npm run agent`는 실제 데이터 저장과 Telegram 발송이 가능한 명령입니다. Telegram을 아직 시험하지 않으려면 `DRY_RUN=true` 또는 `npm run agent:dry`를 사용하세요.

## 문제 해결

### Dashboard에 기사가 없음

`npm run agent:dry`는 파일을 저장하지 않습니다. `DRY_RUN=false` 상태에서 `npm run agent`를 실행한 뒤 화면을 새로 고치세요.

### Telegram이 발송되지 않음

- `.env`가 프로젝트 최상위 폴더에 있는지 확인
- token과 Chat ID 앞뒤에 따옴표나 공백이 없는지 확인
- Bot과 먼저 `/start` 대화를 했는지 확인
- `config/settings.json`에서 `enableTelegram`이 `true`인지 확인

### Codex Queue가 비어 있음

Agent를 실제 모드로 한 번 실행해야 Queue가 저장됩니다. 일반 LOW 뉴스는 의도적으로 Queue에 넣지 않습니다.

### RSS 일부 실패

Source 하나의 오류는 전체 실패가 아닙니다. Settings & Sources의 Latest source health에서 개별 상태를 확인하세요.

## 설계 목적

```text
NEWS
→ EVENT
→ MARKET IMPACT
→ PROCUREMENT IMPACT
→ PRIORITY
→ ACTIONABLE INTELLIGENCE
```

목표는 뉴스 수를 늘리는 것이 아니라, 매일 Trading 및 Procurement 담당자가 중요한 산업 사건과 불확실성을 빠르게 구분하도록 돕는 것입니다.
