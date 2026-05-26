# Tekken — Life Tracker

개인 게임 / 영화 / 애니메이션 기록용 정적 웹앱 프로젝트.

## 카테고리별 참조 DB

| 카테고리 | DB | 키 필요 |
|---|---|---|
| 🎮 게임 | [RAWG](https://rawg.io/apidocs) | 내장 기본키 (사용자 키 우선) |
| 🎬 영상 (영화·TV·애니·OVA 등 통합) | [TMDB movie + tv](https://www.themoviedb.org/) | 내장 기본키 |

## Stack

- **단일 파일 스탠드얼론 웹앱** — `index.html` 하나에 HTML / CSS / Vanilla JS 모두 인라인
- 빌드 도구·서버·의존성 없음. 외부 스크립트도 없음
- 데이터 저장: 브라우저 `localStorage` (프로필명별 분리)
- 외부 API (선택): [RAWG Video Games Database](https://rawg.io/apidocs) — 게임명으로 장르/기본 정보 조회

## 실행 방법

`index.html` 파일 하나만 있으면 됩니다. 다음 중 어떤 방식이든 동작합니다.

```bash
# 옵션 1: 그냥 더블클릭 (file:// 프로토콜로 바로 실행됨)

# 옵션 2: 로컬 서버로 띄우기
python3 -m http.server 8000   # → http://localhost:8000
npx serve .                   # 또는 이 방식
```

USB·메신저·이메일로 `index.html` 한 파일만 공유해도 그대로 동작합니다.

## 파일 구조

```
index.html   # 모든 것 (마크업 + 스타일 + 로직)
CLAUDE.md    # 프로젝트 안내
```

## 데이터 모델

`localStorage` 키: `gametracker:profile:<프로필명>` → JSON 배열

```ts
type Game = {
  id: string;            // 로컬 uuid
  title: string;
  status: 'cleared' | 'playing' | 'planned';
  platform: string;      // 사용자가 리스트에서 선택
  genres: string[];      // RAWG에서 자동 채움
  released?: string;
  rating?: number;
  background_image?: string;
  description?: string;
  youtubeQuery?: string; // 공략 검색용
  screenshots: string[]; // base64 data URL
  note?: string;
  createdAt: number;
};
```

프로필 목록은 별도 키 `gametracker:profiles`에 배열로 저장.

## RAWG API 키

기본 키가 `index.html`에 내장되어 있어 별도 설정 없이 자동 채움이 동작합니다.
사용자가 설정 패널에서 본인 키를 입력하면 `localStorage.gametracker:rawgKey`에 저장되며
이후 호출에서 우선 사용됩니다. 비우면 다시 내장 키로 폴백.

> ⚠️ 내장 키는 HTML 안에 평문으로 들어가므로 파일을 받는 누구나 볼 수 있습니다.
> 모두가 같은 키를 쓰면 월 20,000 요청 한도를 공유하게 되니, 광범위 배포 시에는
> 각자 발급해 사용하세요.
