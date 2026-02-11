# 피규어 캘린더

피규어 상품 페이지에서 정보를 추출하여 캘린더에 저장하는 Tampermonkey 유저스크립트입니다.

## 설치

1. [Tampermonkey](https://www.tampermonkey.net/) 브라우저 확장 프로그램 설치
2. 아래 링크를 클릭하여 스크립트 설치

[![Install](https://img.shields.io/badge/Install-Tampermonkey-green)](https://raw.githubusercontent.com/Uragirimono00/figure-calendar/master/figure-calendar.user.js)

설치 후 자동 업데이트를 지원합니다.

## 지원 사이트

| 사이트 | 기능 |
|--------|------|
| [피규어 캘린더](https://figure-calendar.vercel.app/) | 로그인 정보 자동 동기화 |
| [코믹스아트](https://comics-art.co.kr/) | 상품 정보 추출 |
| [매니아하우스](https://maniahouse.co.kr/) | 상품 정보 추출 |
| [네이버 스마트스토어](https://smartstore.naver.com/) | 상품 정보 추출 |
| [히어로타임](https://herotime.co.kr/) | 상품 정보 추출 |
| [래빗츠](https://rabbits.kr/) | 상품 정보 추출 |
| [아카라이브](https://arca.live/) | 게시글 정보 추출 / 네비게이션 모달 |

## 기능

- 상품 페이지에서 이름, 가격, 예약금/잔금, 발매일, 제조사 등 자동 추출
- 추출된 정보를 피규어 캘린더 찜 목록에 바로 저장
- 피규어 캘린더 사이트 로그인 시 Tampermonkey 자동 동기화 (Google 로그인 포함)
- 아카라이브 네비게이션 바에서 피규어 캘린더 모달로 바로 접근
- 중복 저장 방지
