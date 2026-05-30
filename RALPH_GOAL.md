# Ralph Goal — desktop-pet v0.1 (MVP)

> 이 문서는 Ralph 루프가 매 이터레이션 참조하는 **목표·작업순서·완료기준**이다.
> 권위 있는 설계 문서: `docs/superpowers/specs/2026-05-30-desktop-pet-design.md` (먼저 읽을 것)

## 목표 (Objective)

설계 문서의 **v0.1 MVP**를 동작하는 상태로 구현한다.
즉: macOS 바탕화면을 펫이 돌아다니고(걷기/유휴/드래그), `claude`/`codex` 실행을 감지해
펫이 "일하는(working)" 애니메이션으로 바뀌며, 메뉴바에 상주하는 Electron 앱.

## 하드 제약 (Hard Constraints)

- **macOS 전용**, **Electron + TypeScript**.
- 설계 문서의 검증된 결정을 따른다. 특히:
  - hover/클릭통과는 **renderer mousemove 의존 금지** → **Main `screen.getCursorScreenPoint()` 폴링** 토글.
  - 오버레이는 `transparent` + `alwaysOnTop('screen-saver')` + `setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true})`, **`fullscreen:true` 금지**, 적용은 **`ready-to-show` 이후**.
  - 프로세스 감지는 `ps-list` **`cmd` 매칭**(`name` 절단 회피), 존재 → `running`(working 애니메이션).
  - Dock 숨김은 **`LSUIElement=1`**(electron-builder `mac.extendInfo`) 우선.
  - idle/sleeping 시 **프레임레이트 다운**(배터리).
- **범위 밖(하지 말 것):** hook/notify 커넥터, `~/.claude`·`~/.codex` 설정 수정, 멀티모니터, 펫 5종 전부, 코드 서명/공증 — 전부 **v0.2+**.
- 무료 에셋은 **CC0/허용 라이선스만**, 매니페스트 `license`에 출처 기록.

## 빌드 순서 (이터레이션 단위 — 위에서부터 하나씩)

- [ ] **0. 스파이크: 클릭통과 + hover (최우선·가장 큰 리스크)**
      최소 Electron 앱: 투명 전체화면 오버레이 1개 + 화면 중앙에 드래그 가능한 사각형 1개.
      Main에서 커서 폴링으로 사각형 위 진입/이탈 감지 → `setIgnoreMouseEvents` 토글.
      **성공 기준:** 마우스 버튼을 누르지 않은 단순 hover에서 사각형 위 진입/이탈이 안정적으로 감지되어
      클릭통과가 토글되고, 곧바로 드래그를 시작할 수 있다. (실패 시 방식 A/B 비교 후 진행)
- [ ] **1. 프로젝트 스캐폴드** — `package.json`, `tsconfig.json`, `electron-builder.yml`(`mac.extendInfo.LSUIElement=1`), 빌드 스크립트, `src/{main,renderer,shared}` 구조(설계 8절).
- [ ] **2. Overlay Window Manager** — 설계 6.1 그대로(투명/항상위/전체화면 위/주 모니터만).
- [ ] **3. Pet Engine** — `pet.ts`(Entity), `state-machine.ts`(순수 전이), `movement.ts`(랜덤 워크), `sprite.ts`(시트 blit), Canvas 렌더 + 절전 정책.
- [ ] **4. Asset System** — 매니페스트 로더 + **CC0 펫 1–2종**(idle/walk/working/sleeping). 라이선스 기록.
- [ ] **5. Activity Detector** — `ps-list` cmd 폴링 → `running/idle/sleeping`, IPC로 renderer에 `ActivityState` 전달 → 펫 애니메이션 전환. 자기 개발 세션 오탐 제외 고려.
- [ ] **6. 드래그 상호작용** — 클릭통과 토글과 연동해 펫 집기/놓기.
- [ ] **7. Tray/Settings** — 펫 선택·일시정지·로그인 시 실행·종료.
- [ ] **8. 테스트** — 유닛(`state-machine`, `movement`, detector 매핑), `ps-list` mock 통합. 설계 10절.
- [ ] **9. 패키징** — 무공증 `.dmg` 빌드, 첫 실행(우클릭→열기) 흐름 확인.

## 완료 정의 (Definition of Done — v0.1)

설계 9절 v0.1 + 수용 기준을 모두 만족:
1. 앱 실행 시 메뉴바 상주(Dock 없음), 바탕화면에 펫이 걸어다님.
2. `claude` 또는 `codex` 실행 → 펫이 working 애니메이션, 종료/유휴 → idle → (장시간) sleeping.
3. 펫을 마우스로 드래그해 옮길 수 있음(버튼 미누름 hover에서 토글 정상).
4. 트레이: 펫 선택·일시정지·로그인 시 실행·종료 동작.
5. idle/sleeping 시 프레임레이트 다운 동작.
6. 유닛/통합 테스트 통과.
7. 무공증 `.dmg` 빌드 성공 + 첫 실행 흐름 확인.

## 이터레이션 프로토콜

1. 위 체크리스트에서 **다음 미완료 항목 1개** 선택.
2. **최소 변경**으로 구현(설계 문서 준수, 추측 금지 — 불확실하면 설계/공식문서 확인).
3. **검증:** 실제 실행 또는 테스트로 동작 확인(버그는 근본원인 없이 고치지 말 것).
4. **원자적 커밋**(항목 단위), 체크리스트 갱신.
5. 다음 항목으로.

## 완전 종료 시

모든 완료 정의 충족 + 검증 완료되면 → `/oh-my-claudecode:cancel` 실행해 Ralph 모드 정리.
