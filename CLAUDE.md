# Tekken — Game Life Tracker

개인 게임 라이프 기록용 정적 웹앱 프로젝트.

## Stack

- 단일 페이지 정적 웹앱 (HTML / CSS / Vanilla JS, 빌드 도구 없음)
- 데이터 저장: 브라우저 `localStorage` (프로필명별 분리)
- 외부 API: [RAWG Video Games Database](https://rawg.io/apidocs) — 게임명으로 장르/기본 정보 조회

## 실행 방법

빌드 도구 없음. 정적 파일이므로 다음 중 하나로 띄우면 됩니다.

```bash
# 옵션 1: Python
python3 -m http.server 8000

# 옵션 2: Node (npx, 글로벌 설치 불필요)
npx serve .
```

`http://localhost:8000` 접속.

## 파일 구조

```
index.html   # 페이지 마크업
styles.css   # 스타일 / 상태별 색상 토큰
app.js       # 상태 관리, 저장, RAWG 호출, UI 렌더링
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

선택 사항입니다. 입력하지 않으면 자동 채움이 비활성화되고 모든 필드를 수동 입력합니다.
키는 [rawg.io/apidocs](https://rawg.io/apidocs)에서 무료로 발급받아 앱 설정 패널에 입력하면
`localStorage.gametracker:rawgKey`에 저장됩니다.
