# 데스크탑 펫 + Claude/Codex 마스코트 — 설계 문서

- **작성일:** 2026-05-30
- **상태:** architect 독립 검증 반영 완료 → 사용자 승인 대기(Ralph goal 작성용 기준 문서)
- **프로젝트 코드네임:** `desktop-pet` (추후 리네이밍 가능)

> 본 문서는 독립 검증(oh-my-claudecode:architect) 결과를 반영함. 공식 문서 교차검증으로 수정된 항목은 각 절에 `[검증 반영]`으로 표시.

---

## 1. 개요

macOS 바탕화면을 동물 펫(스프라이트)이 자유롭게 돌아다니는 데스크탑 마스코트 앱.
기본 펫 5종(고양이·강아지 등)을 제공하고, 사용자가 **Claude Code / Codex** 세션을 돌리면
펫이 "일하는" 애니메이션으로 전환되는 **실행 마스코트** 기능을 핵심 차별점으로 가진다.

- **배포 형태:** App Store가 아닌 직접 배포(.dmg 다운로드). 초기엔 무공증, 정식 배포 시 서명+공증.
- **기술 성격:** 웹 기술(HTML/CSS/Canvas/JS)로 구현, **Electron**으로 패키징한 네이티브 macOS 앱.

## 2. 목표 / 비목표

### 목표 (Goals)
- 바탕화면을 자연스럽게 돌아다니는 펫(걷기/유휴/드래그) — 부드러운 애니메이션.
- 기본 펫 5종, 무료/오픈 에셋 기반.
- Claude Code / Codex 실행 상태를 감지해 펫이 **working ↔ idle ↔ sleeping** 전환.
- 무설정으로 즉시 동작(프로세스 감지) + 선택 설치 시 정밀 상태(hook 연동).
- 메뉴바 상주 앱, 가벼운 설정 UI.

### 비목표 (Non-goals, YAGNI)
- App Store 등록 / 샌드박스 대응 (초기 범위 제외).
- Windows / Linux 지원 (macOS 전용으로 시작).
- 펫이 Claude/Codex를 **실행/제어**하는 런처 기능 (마스코트=상태 반영만).
- 멀티유저/계정/클라우드 동기화.
- 사운드/음성 (초기 제외).

## 3. 대표 사용자 시나리오

1. 사용자가 앱 설치 → 메뉴바 아이콘 등장, 바탕화면에 고양이 펫 1마리가 어슬렁거림.
2. 터미널에서 `claude` 실행 → 펫이 작은 노트북 앞에 앉아 **타이핑(working)** 애니메이션.
3. 세션이 끝나 유휴 상태가 길어지면 펫이 **졸기(sleeping)**.
4. 사용자가 펫을 마우스로 집어 다른 위치로 드래그 → 놓으면 그 자리에서 다시 활동.
5. (선택) 메뉴바 → "Claude 연동" 버튼 클릭 → hook 자동 설치 → 이후 "타이핑 중/도구 실행 중/완료"가 더 세밀하게 반영.

## 4. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 패키징/런타임 | **Electron** | 검증된 데스크탑 펫 경로, 투명 오버레이·클릭통과 지원 |
| 언어 | TypeScript | main/renderer 공통 |
| 렌더링 | **Canvas 2D** | 다수 스프라이트 성능, 추후 다수 펫 대비 |
| 상태 저장 | `electron-store` | 설정·활성 펫·연동 상태 |
| 빌드/배포 | `electron-builder` | .dmg 생성, 추후 서명/공증/자동업데이트(electron-updater), `mac.extendInfo`로 LSUIElement |
| 프로세스 감지 | `ps-list` (cmd 매칭) | claude/codex 탐지 — `name`(15자 절단) 대신 `cmd` 사용 |
| hook 수신 | 내장 `http` 로컬 서버(127.0.0.1) | hook/notify 이벤트 수신 |

## 5. 아키텍처 (Electron 2-프로세스)

**메뉴바(트레이) 앱**으로 동작 — Dock 아이콘 숨김.
`[검증 반영]` Dock 숨김은 **빌드 시 `Info.plist`의 `LSUIElement=1`(electron-builder `mac.extendInfo`)를 우선**으로 하고, `app.dock.hide()`는 보조(부팅 시 단독 호출하면 Dock 아이콘이 깜빡일 수 있음). 부작용(Cmd-Tab 미노출 등)은 QA 체크리스트에 포함.

```
┌──────────────────────────── Main Process (Node) ────────────────────────────┐
│  Overlay Window Manager   Activity Detector   Tray/Settings   Connector       │
│  Persistence(store)   Cursor Poller(hover/클릭통과 토글)                        │
└───────────────▲───────────────────────────────────────────────┬──────────────┘
                │ IPC (ActivityState)                  IPC (펫 바운딩박스 공유)│
┌───────────────┴───────────────────────────────────────────────▼──────────────┐
│                         Renderer Process (Web, 투명 전체화면)                   │
│   Pet Engine: Entity + State Machine + Movement AI + Canvas Renderer          │
└────────────────────────────────────────────────────────────────────────────────┘
```

- **Main:** 오버레이 창 생성·관리, 세션 감지, 트레이/설정, 연동 설치, 설정 저장, **커서 위치 폴링 기반 클릭통과 토글**.
- **Renderer:** 투명 전체화면 위 펫 엔진 구동. Main의 `ActivityState`로 애니메이션 전환, 펫 바운딩박스를 Main에 공유.

## 6. 컴포넌트 상세

### 6.1 Overlay Window Manager (main)
- 디스플레이당 1개의 `BrowserWindow` 생성: `transparent:true`, `frame:false`, `alwaysOnTop:true`(level `screen-saver`), `skipTaskbar:true`, `hasShadow:false`, `resizable:false`, 전체 디스플레이 크기.
- `[검증 반영]` **전체화면 앱 위 표시**: `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` 적용. 오버레이 창에는 **`fullscreen:true`를 주지 말 것**(canJoinAllSpaces를 덮어씀). 이 설정은 반드시 **`ready-to-show` 이후**에 적용(초기화 전 적용 시 silent fail).
- `[검증 반영]` **클릭통과 + hover**: 기본 `setIgnoreMouseEvents(true, { forward: true })`. 단, macOS는 클릭통과 상태에서 버튼 미누름 `mousemove`가 불안정 발화(electron#26718)하므로, **hover 감지는 renderer `mousemove`에 의존하지 않고 Main에서 `screen.getCursorScreenPoint()`를 짧은 주기(30~60ms)로 폴링**해 펫 바운딩박스와 교차 판정 → 교차 시 `setIgnoreMouseEvents(false)`, 이탈 시 `true`로 토글. (renderer 히트테스트는 펫 좌표를 Main에 공유하는 용도로 유지.)
- 디스플레이 추가/제거(`screen` 이벤트) 대응. **MVP는 주 디스플레이만**, 멀티모니터는 v0.2.

### 6.2 Pet Engine (renderer) — 핵심
- **Entity:** `{ id, type, x, y, vx, vy, state, facing, animFrame, animClock }`.
- **State Machine:** `idle → walking → idle`(랜덤 워크), 외부 `ActivityState`에 의해 `working`/`tool`/`sleeping` 강제 전환, 사용자 입력으로 `dragged`.
  - 상태 전이는 **순수 함수**로 분리(렌더링과 독립) → 유닛 테스트 가능.
- **Movement AI:** 틱 루프(`requestAnimationFrame`). 유휴 중 랜덤 목표 지점 선택 → 걷기 → 도착 후 유휴. 화면 경계 클램프.
- `[검증 반영]` **절전 정책(비기능 요구):** idle/sleeping 또는 화면 밖일 때 프레임레이트 다운/일시정지로 GPU·배터리 소모 최소화(상시 오버레이이므로 필수).
- **Renderer:** Canvas 2D, 스프라이트 시트에서 현재 프레임 blit. 펫별 z-order.
- **Hit test / 바운딩박스 공유:** 매 프레임 펫 바운딩박스를 Main에 공유(클릭통과 토글은 Main 커서 폴링이 수행). renderer는 `ignoreMouseEvents(false)`로 전환된 동안 들어오는 클릭/드래그를 처리.

### 6.3 Activity Detector (main) — "봇" 기능
통합 출력: `ActivityState = 'idle' | 'running' | 'working' | 'tool' | 'sleeping'`.
`[검증 반영]` 폴링으로는 "추론 중"과 "입력 대기"를 구분 불가하므로, **프로세스 존재 = `running`**(정직한 표기). 정밀 `working`/`tool`은 hook 모드에서만.

1. **기본(무설정) — 프로세스 폴링**
   - N초(기본 2s)마다 `ps-list` 조회. `[검증 반영]` **`cmd`(전체 커맨드라인)로 매칭**(`name`은 15자 절단·오탐). `claude`/`codex` 존재 → `running`, 없으면 `idle`.
   - 유휴가 임계(기본 5분) 지속 시 `sleeping`.
   - `[검증 반영]` **오탐 주의:** 이 앱을 Claude 세션으로 개발/실행 중이면 항상 running 오판 가능 → 자기 자신/개발 세션 제외 로직 고려.
2. **정밀(선택) — hook 수신 서버**
   - 로컬 `http://127.0.0.1:<port>/event` (port는 설정에 저장, 기본 자동 할당 후 고정).
   - 이벤트 페이로드: `{ source: 'claude'|'codex', kind, ts }`.
   - `[검증 반영]` **Claude 매핑:** `UserPromptSubmit/SessionStart → working`, **`PreToolUse → tool`(도구 진입)**, **`PostToolUse → working 복귀`**, `Stop → idle`, `SessionEnd → idle(→ sleeping 타이머)`.
   - `[검증 반영]` **Codex 매핑:** `notify`는 사실상 **`agent-turn-complete`(턴 완료) 단일 신호** → idle/완료 처리에만 사용. Codex의 `working`은 프로세스 폴링에 의존(진행형 상태를 notify로 못 줌).
   - hook 수신이 활성화되면 폴링보다 우선. 일정 시간 hook 무신호 시 폴링 fallback.

### 6.4 Connector / Setup Helper (main)
- "Claude/Codex 연동" 동작 시:
  - **Claude Code:** `~/.claude/settings.json`의 `hooks`에 `UserPromptSubmit`/`PreToolUse`/`PostToolUse`/`Stop`/`SessionStart`/`SessionEnd` 주입.
    - `[검증 반영]` 각 hook은 `type:"command"`(`curl` 한 줄) 또는 **`type:"http"`(내장 webhook, URL/헤더 지정 — `curl` 의존 줄임)** 중 택. matcher는 **도구 이벤트(`PreToolUse`/`PostToolUse`)에만** 의미 있음(나머지엔 미적용).
  - **Codex:** `~/.codex/config.toml`의 `notify = ["/bin/bash", "<script>"]`(프로그램 배열, JSON 1인자)로 로컬 서버 POST.
    - `[검증 반영]` `notify`는 **루트 키 → 모든 `[table]` 위**에 위치해야 파싱 안전(머지 시 위치 규칙 준수).
  - 기존 설정 보존(머지), 적용 전 백업, 해제(언인스톨) 기능 제공.
- 자동 주입이 부담이면 **스니펫 복사** 수동 옵션도 제공.

### 6.5 Tray / Settings UI (main + 작은 창)
- 트레이 메뉴: 펫 선택(5종 토글)·마릿수·일시정지/숨김·연동 설정 열기·로그인 시 실행·종료.
- 설정 창(작은 BrowserWindow): 펫 미리보기, 연동 상태/버튼, 환경설정, **프라이버시 고지**(아래 13 참조).

### 6.6 Asset System (renderer)
- 펫 1종 = 스프라이트 시트(들) + **매니페스트(JSON)**. 매니페스트로 펫 추가가 코드 수정 없이 가능.
- 매니페스트 스키마(초안):
```json
{
  "id": "cat",
  "name": "Cat",
  "frameWidth": 64,
  "frameHeight": 64,
  "sheet": "cat.png",
  "animations": {
    "idle":    { "row": 0, "frames": 4, "fps": 6,  "loop": true },
    "walk":    { "row": 1, "frames": 6, "fps": 10, "loop": true },
    "working": { "row": 2, "frames": 4, "fps": 8,  "loop": true },
    "sleeping":{ "row": 3, "frames": 2, "fps": 2,  "loop": true }
  },
  "license": { "source": "<URL>", "type": "CC0", "author": "<name>" }
}
```
- 각 펫 매니페스트에 **라이선스 메타**를 필수 기록(재배포 검증/표기용).

### 6.7 Persistence (main)
- `electron-store`: 활성 펫 목록, 마릿수, 일시정지 여부, hook 포트, 연동 상태, 로그인 시 실행, 기타 환경설정.

## 7. 데이터 흐름

```
Claude hook / Codex notify ──HTTP POST /event──► Activity Detector (main)
                                                    │  (+ claude/codex 프로세스 폴링 fallback → running)
                                                    ▼
                                              ActivityState ──IPC──► Pet Engine (renderer)
                                                                        │
                                  각 펫 상태머신: idle/walk ◄─► working/tool ─► sleeping
                                                                        ▲
                          Main 커서 폴링(getCursorScreenPoint) × 펫 바운딩박스 ─► setIgnoreMouseEvents 토글
```

## 8. 제안 디렉토리 구조

```
desktop-pet/
├─ package.json
├─ electron-builder.yml          # mac.extendInfo: { LSUIElement: 1 }
├─ tsconfig.json
├─ src/
│  ├─ main/
│  │  ├─ index.ts                # app 부트스트랩, 트레이
│  │  ├─ overlay-window.ts       # Overlay Window Manager (visibleOnFullScreen, 커서 폴링 토글)
│  │  ├─ activity-detector.ts    # 프로세스 폴링(cmd 매칭) + 상태 통합
│  │  ├─ hook-server.ts          # 로컬 HTTP 이벤트 수신
│  │  ├─ connector.ts            # Claude/Codex 연동 설치/해제
│  │  ├─ settings-store.ts       # electron-store 래퍼
│  │  └─ ipc.ts                  # IPC 채널 정의
│  ├─ renderer/
│  │  ├─ index.html
│  │  ├─ pet-engine.ts           # 틱 루프 + 렌더 + 절전 정책
│  │  ├─ pet.ts                  # Entity
│  │  ├─ state-machine.ts        # 순수 상태 전이(테스트 대상)
│  │  ├─ movement.ts             # 이동 AI(테스트 대상)
│  │  ├─ bounds.ts               # 펫 바운딩박스 산출/공유
│  │  └─ sprite.ts               # 스프라이트 시트 로더/blit
│  └─ shared/
│     └─ types.ts                # ActivityState, 이벤트 스키마 등
├─ assets/pets/                  # cat.png, cat.json, dog.png, ...
└─ docs/superpowers/specs/2026-05-30-desktop-pet-design.md
```

## 9. MVP 범위 & 로드맵

### v0.1 (MVP)
- 메뉴바 앱, **주 모니터만**.
- 무료 에셋 펫 **1–2종**, idle/walk/working/sleep.
- 전체화면 투명 오버레이 + **클릭통과(Main 커서 폴링 토글)** + **펫 드래그**.
- 감지: **프로세스 폴링만**(claude/codex, `cmd` 매칭). 실행 중 → `running`(working 애니메이션).
- 트레이: 펫 선택·일시정지·로그인 시 실행·종료.
- `[검증 반영]` **수용 기준 추가:** ① 무공증 첫 실행(우클릭→열기) 흐름 동작, ② idle/sleeping 시 프레임레이트 다운(배터리) 동작, ③ LSUIElement 앱에서 로그인 항목 등록 검증.

### v0.2
- **펫 5종 전부** + 매니페스트 기반 로딩.
- **hook/notify 커넥터** + 자동 설치/해제 → 정밀 상태(working/tool/idle).
- 멀티모니터.

### v0.3+
- 펫 개성·상호작용·반응 애니메이션 추가.
- **코드 서명 + 공증 + 자동 업데이트**(electron-updater).
- 커뮤니티/커스텀 펫 팩.

## 10. 테스트 전략

- **단위(순수 로직):** `state-machine.ts`, `movement.ts`, Activity Detector 이벤트→상태 매핑.
- **통합:** `hook-server` 엔드포인트에 가짜 이벤트 POST → 상태 변화 검증. `ps-list` mock으로 폴링/cmd 매칭 검증.
- **수동/시각 QA(실 macOS):** 오버레이 투명·항상 위(전체화면 앱 위 포함), 클릭통과+hover(버튼 미누름 hover), 드래그, 메뉴바 동작, Dock 숨김 부작용.

## 11. 리스크 & 선행 스파이크

먼저 검증(작은 프로토타입)할 항목:
1. **클릭통과 + hover 토글** — **1순위 스파이크.**
   `[검증 반영]` 성공 기준: **마우스 버튼을 누르지 않은 단순 hover에서도 펫 위 진입/이탈이 안정적으로 감지되어 클릭통과가 토글되고, 곧바로 드래그를 시작할 수 있다.** 두 방식 비교: (A) renderer `mousemove`+`forward:true`, (B) **Main `screen.getCursorScreenPoint()` 폴링**(권장 1차 후보).
2. **항상 위 / 전체화면 위** — `alwaysOnTop`(`screen-saver`) + `setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true})`, `fullscreen:true` 금지, `ready-to-show` 이후 적용.
3. **무료 에셋 라이선스** — 재배포(유료 가능성 포함) 허용 여부, 5종 확보.
4. **Codex `notify` 입자도** — `agent-turn-complete`만 → working은 폴링 의존(확인).
5. **로그인 시 실행 / 무공증 첫 실행** Gatekeeper 흐름 확인.

## 12. 배포

- 초기: `electron-builder`로 무공증 `.dmg` → 사용자 우클릭→열기.
- 정식: Apple Developer($99/년) **서명 + 공증** `.dmg`, `electron-updater` 자동 업데이트. (App Store 아님)

## 13. 프라이버시 & 고지

`[검증 반영]` 본 앱은 ① 주기적으로 **사용자 프로세스 목록을 읽고**(claude/codex 감지), ② 연동 시 **`~/.claude`·`~/.codex` 설정 파일을 수정**한다. 설정 창/온보딩에서 이 동작을 **명시적으로 고지**하고, 연동(설정 수정)은 사용자 동의 후에만 수행한다(적용 전 백업·해제 제공).

## 14. 오픈 질문 (구현 중 확정)

- 펫 기본 마릿수/동시 표시 수 상한.
- 펫 5종 구체 선정(고양이·강아지 + 3종).
- working 표현 방식(노트북 타이핑 vs 망치질 등) — 에셋에 따라.
- hook 포트 충돌 시 처리(자동 재할당).
- 자기 개발 세션(claude) 오탐 제외 방식 구체화.
