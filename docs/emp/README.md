# 고용지원사업 업무판 코드 묶음 (인덱스)

- 만든 곳: 화성시아르딤복지관 직업지원팀
- 기준일: 2026-11-16
- 구성: 구글 시트 1개(DB) + 화면 8개(HTML). 화면 하나가 폴더 하나이고, 각 폴더의 `index.html`이 시작 파일입니다.
- 이 묶음에는 **코드와 빈 양식만** 들어 있습니다. 참여자 기록(시트 내용)은 없습니다.

---

## 1. 목차 (폴더별 화면)

| 폴더 | 화면 이름 | 하는 일 | 같이 있어야 하는 파일 |
|---|---|---|---|
| `01_hub` | 고용지원사업 업무판 (메인) | 참여자 단계(①~④) 흐름, 사업체 관리·고용자원개발 기록, 중증장애인 지원고용 검토, 사업체 키워드 찾기, 사후관리 대상 추가·확인, 장기근속 격려, 월별 실적, 기록 고치기, 선택지 고치기 | 없음 (한 파일) |
| `02_job-counsel` | 직업상담기록지 정리 | 상담 메모 → AI 초안 → 직업상담기록지 한글(hwpx)/Word/PDF 저장, 시트 저장 | `hwpx.js`, `resume-hwpx.js`, `resume-templates.js` |
| `03_records-resume` | 상담기록 불러오기·이력서 | 참여자의 지난 기록을 모아 이력서·자기소개서 초안(임의 작성 문장 표시) → 한글 파일 | `resume-hwpx.js`, `resume-templates.js` |
| `04_matching` | 취업 매칭 도우미 | 참여자↔사업체 추천(AI), 취업알선 적합성 분석지 작성 → 시트 저장, 한글 파일 | `fit-hwpx.js`, `fit-template.js` |
| `05_process-aftercare` | 과정상담·사후관리 일지 | 과정상담일지 작성(원본 양식), 다음 사후관리일 정하기 → 시트 저장, 한글 파일 | `proc-hwpx.js`, `proc-template.js` |
| `06_placement-result` | 취업알선 결과 기록 | 알선 결과(취업·불합격·포기), 취업일·퇴사일 기록 | 없음 (한 파일) |
| `07_file-import` | 서류 파일로 입력 | hwp·hwpx·xlsx·csv 서류를 읽어 시트에 넣기(AI가 칸 정리) | `read-forms.js` |
| `08_monthly-report` | 월별 계획·결과보고 | 월별 실시계획서·결과보고서·사업별 현황 리스트 6종을 원본 한글 양식으로 만들기 | `monthly-hwpx.js`, `monthly-templates.js` |

- 시트의 탭·열 구조는 **`시트구조.md`**에 따로 정리했습니다.
- 각 화면이 어떤 탭을 읽고 쓰는지는 아래 4번에 있습니다.

---

## 2. 이 코드가 돌아가는 방식 (꼭 읽어 주세요)

이 화면들은 **claude.ai 아티팩트**로 만들어서, 아래 세 가지를 claude.ai가 대신 해 줍니다. 코드 안에서는 `window.claude.use(...)`로 부릅니다.

| 이름 | 하는 일 | 코드에서 부르는 모양 |
|---|---|---|
| `mcp` | 연 사람의 구글 계정으로 구글 시트 읽기·쓰기 | `mcp.callTool("Google Sheets", "get_values", {spreadsheetId, range})` → `결과.payload.values`<br>`mcp.callTool("Google Sheets", "update_values", {spreadsheetId, range, values})` (USER_ENTERED, `null` 칸은 건너뜀) |
| `sample` | AI(Claude)에게 초안 받기 | `sample.json(프롬프트글, {modelTier:"default" 또는 "complex"})` → JSON 값 |
| `downloads` | 만든 파일을 내려받게 하기 | `downloads.save({filename, data: Blob})` |

그래서 동료분 앱이 어떤 종류인지에 따라 붙이는 방법이 다릅니다.

### 방법 A. 동료분 앱도 claude.ai 아티팩트라면
- 폴더째 올리고, 화면마다 아래 기능(capabilities)을 같은 모양으로 선언하면 그대로 동작합니다.
- 화면을 여는 사람이 claude.ai에 **Google Sheets 커넥터**를 연결해 두어야 하고, 그 사람 구글 계정에 **시트 접근 권한**이 있어야 합니다.

| 폴더 | 선언할 기능 |
|---|---|
| `01_hub` | mcp: Google Sheets [get_values, update_values] |
| `02_job-counsel` | mcp: Google Sheets [get_values, update_values], sample, downloads |
| `03_records-resume` | mcp: Google Sheets [get_values], sample, downloads |
| `04_matching` | mcp: Google Sheets [get_values, update_values], sample, downloads |
| `05_process-aftercare` | mcp: Google Sheets [get_values, update_values], sample, downloads |
| `06_placement-result` | mcp: Google Sheets [get_values, update_values] |
| `07_file-import` | mcp: Google Sheets [get_values, update_values], sample |
| `08_monthly-report` | mcp: Google Sheets [get_values, update_values], downloads |

### 방법 B. 일반 웹앱(직접 만든 사이트·앱)이라면
- `window.claude`가 없어서 그대로는 시트를 못 읽습니다. 화면에 "claude.ai에서 열었을 때만…" 안내가 뜹니다.
- 각 `index.html`에서 화면 코드보다 **먼저** `claude-adapter.example.js`를 넣으면, 위 세 가지를 일반 방식으로 바꿔 줍니다.
  - `mcp` → Google Sheets API(v4) `spreadsheets.values.get / update`
  - `sample` → 동료분이 정한 AI 서버 주소로 보냄(없으면 AI 초안 기능이 꺼짐)
  - `downloads` → 브라우저 다운로드
- 동료분이 채워야 할 곳은 두 군데입니다: 구글 로그인 토큰을 주는 `getAccessToken()`, AI 서버 주소 `AI_ENDPOINT`.
- **이 어댑터는 시험해 보지 않은 예시입니다.** 붙인 뒤 시트 읽기·쓰기를 꼭 확인해 주세요.
- AI 서버를 만들 때 API 키는 브라우저 코드에 넣지 말고 서버 쪽에 두세요.

---

## 3. 동료분이 바꿔야 할 값

| 무엇 | 어디 | 설명 |
|---|---|---|
| 시트 ID | 각 `index.html`의 `const SHEET="1kFmBp…6V4"` | 지금 쓰는 DB 시트입니다. 다른 시트를 쓰면 이 값을 바꿉니다. 같은 시트를 쓰려면 시트 주인에게 공유를 받아야 합니다. |
| 화면끼리 연결 주소 | `01_hub`의 `const L={…}`와 머리 링크들, 다른 화면의 `HUB_URL`·'← 업무판으로' 링크 | 지금은 claude.ai 아티팩트 주소(`https://claude.ai/artifact/…`)입니다. 동료분 앱의 화면 주소로 바꿔야 합니다. |
| 담당자 기본값 | `01_hub`(사후관리 대상 추가 시 참여자 '담당자' 칸), `02_job-counsel`(새 참여자 등록) | 직업지원팀 담당자 이름이 고정으로 들어가 있습니다. 앱 사용자 이름으로 바꾸거나 입력받게 바꿔 주세요. |
| 기관 정보 | `02_job-counsel`, `03_records-resume`의 `const ORG={…}` | 기관 이름·대표 전화(이력서·기록지에 들어감). |
| 최저임금 | `01_hub`의 `const MINW=10320` | 사업체 찾기에서 임금을 '저임금/고임금'으로 나눌 때 씁니다(2026년 기준). |

---

## 4. 화면별로 읽고 쓰는 시트 탭

| 폴더 | 읽는 탭 | 쓰는 곳 |
|---|---|---|
| `01_hub` | 참여자, 구직상담, 과정상담, 취업알선, 직무분석, 장기근속자, 고용자원개발, 사업체관리, 선택지 | 참여자 N(단계 직접 지정)·V(단계 메모)·I(장애정도)·T/U/W, 새 참여자 줄(사후관리 대상 추가), 고용자원개발·사업체관리 새 줄, '기록 고치기'에서 고친 칸, 선택지 탭 |
| `02_job-counsel` | 참여자, 구직상담 | 참여자 새 줄(없는 분), 구직상담 한 줄(A~AB) |
| `03_records-resume` | 참여자, 구직상담, 과정상담, 취업알선, 서비스이력 | 쓰지 않음(읽기만) |
| `04_matching` | 참여자, 구직상담, 직무분석, 취업알선, 과정상담 | 취업알선 새 줄(적합성 분석지) |
| `05_process-aftercare` | 참여자, 과정상담, 취업알선 | 과정상담 한 줄(A~K), 참여자 W(다음 사후관리일) |
| `06_placement-result` | 취업알선, 선택지(J열) | 취업알선 Q~U(결과·취업일·퇴사일·퇴사사유·비고) |
| `07_file-import` | 참여자, 직무분석, 서비스이력 등 | 서류 종류에 따라 참여자·구직상담·과정상담·직무분석·취업알선·서비스이력·장기근속자 (빈 값은 덮어쓰지 않음) |
| `08_monthly-report` | 참여자, 구직상담, 과정상담, 취업알선, 고용자원개발, 사업체관리, 월별보고 | 월별보고(쓴 글 저장), 고용자원개발·사업체관리 새 줄 |

공통 규칙:
- 새 줄을 쓰는 화면은 대부분 쓰기 직전에 시트 끝의 **빈 줄을 다시 확인**합니다(다른 사람이 쓴 줄을 덮지 않게).
- 기존 줄을 고칠 때는 쓰기 직전에 그 줄의 등록번호(또는 사업체·직무)가 맞는지 다시 읽어 봅니다.
- **시트에 열을 끼워 넣거나 순서를 바꾸면 안 됩니다.** 코드가 열 위치(A, B, …)로 읽고 씁니다.
- 글자는 앞에 `'`를 붙여 저장합니다(숫자·날짜로 바뀌지 않게). 날짜는 `2026-11-16` 모양입니다.
- **'(자동)' 열은 수식 칸이라 쓰면 안 됩니다.** (`시트구조.md` 참고)

---

## 5. 한글(hwpx) 양식 파일

- `*-template.js`, `monthly-templates.js`, `resume-templates.js` 안의 긴 글자는 **기관 원본 양식(빈 양식)**을 hwpx로 저장해 base64로 넣은 것입니다.
- `*-hwpx.js`는 그 양식의 **표 칸 순서 번호**에 글자만 넣습니다. 칸 모양·글꼴은 원본 그대로입니다.
  - 적합성 분석지 77칸(`FIT_CELLS`), 과정상담일지 27칸(`PROC_CELLS`), 이력서 A 112칸·B 141칸, 월별 실시계획서 120칸·결과보고서 132칸, 현황 리스트 6종.
- **원본 양식의 칸이 바뀌면 칸 번호를 다시 맞춰야 합니다.** 칸 수가 다르면 "양식 칸 수가 다름" 오류를 냅니다.
- 직업상담기록지(`02_job-counsel/hwpx.js`)만 원본 대신 코드로 표를 그립니다.
- claude.ai 화면에서는 한글 파일을 `.hwpx.zip` 이름으로 받게 해 두었습니다(이름 끝 `.zip`을 지우면 한글에서 열림). 일반 앱에서는 `.hwpx`로 바로 저장하게 바꿔도 됩니다.

---

## 6. 외부 라이브러리 (CDN에서 불러옴)

| 라이브러리 | 버전 | 쓰는 화면 |
|---|---|---|
| JSZip | 3.10.1 | 02, 03, 04, 05, 07, 08 (hwpx·zip 만들기/읽기) |
| SheetJS (xlsx) | 0.18.5 | 07 (엑셀 읽기) |
| hwp.js | 0.0.3 (+esm) | 07 (보안 없는 hwp 읽기) |
| docx | 8.5.0 | 02 (Word 저장) |
| html2canvas / jsPDF | 1.4.1 / 2.5.1 | 02 (PDF 저장) |
| IBM Plex Sans KR / Mono | Google Fonts | 전체 (글꼴) |

- 서버 보안 문서(DRM, 파일 머리가 "BMS Docu")는 브라우저에서 읽을 수 없습니다.

---

## 7. 개인정보·보안

- 이 묶음은 보내기 전에 코드와 양식 속 글자를 검사했습니다. 참여자 이름·연락처·주민번호는 없습니다.
  - 예시 칸에 남아 있던 참여자 이름 1개, 등록번호 1개, 주석 속 이름 1개는 가짜 예시(`홍길동`, `2026-00000`)로 바꿨습니다.
- 참여자 정보는 모두 **구글 시트**에만 있습니다. 시트 접근은 구글 공유 권한으로 정해집니다.
- 이 코드를 기관 밖 서비스에 올리거나 실제 시트와 연결하기 전에 **기관 정보보안 규정**을 확인해 주세요.
- 구글 로그인 토큰이나 AI API 키를 코드·저장소에 넣지 마세요.

---

## 8. 시험한 정도

- claude.ai 안에서 실제 시트로 쓰고 있습니다. 2026-11-16에 추가한 기능은 가짜 자료로 시험했습니다(중증·경증 나눠 보기, 사업체 찾기, 사업체 관리 기록, 사후관리 대상 추가).
- `claude-adapter.example.js`(일반 웹앱용)는 **시험하지 않은 예시**입니다.
