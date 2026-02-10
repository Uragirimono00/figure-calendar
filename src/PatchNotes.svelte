<!-- src/PatchNotes.svelte -->
<script>
    const patches = [
        {
            date: '2026-02-10',
            changes: [
                'URL 스크래핑 기능 추가: 상품 페이지 URL을 입력하면 상품명, 가격, 이미지, 발매일, 제조사 정보를 자동으로 추출합니다.',
                '지원 사이트: comics-art.co.kr, maniahouse.co.kr, smartstore.naver.com 및 기타 사이트 (OG/JSON-LD 폴백).',
                '"찜 (위시리스트)" / "구매" 구매 상태 구분 추가: 위시리스트 아이템과 실제 구매 아이템을 분리하여 관리할 수 있습니다.',
                '제조사, 발매일 필드 추가: 상세 정보 모달에서 제조사와 발매일을 기록할 수 있습니다.',
                '찜 아이템에 하트 뱃지 표시: 그리드 뷰에서 위시리스트 아이템을 쉽게 구분할 수 있습니다.',
                '테이블 뷰에 구매 상태 컬럼 및 필터 추가.',
                '크롬 확장프로그램 지원: 상품 페이지에서 바로 피규어 캘린더에 저장할 수 있습니다.',
                'Firebase Cloud Functions를 통한 서버 사이드 스크래핑으로 CORS 문제 해결.',
                '외부 이미지 URL 로드 실패 시 에러 처리 개선.'
            ]
        },
        {
            date: '2025-03-02',
            changes: [
                '쿠키를 사용하여 캐시, 뷰 모드, 정렬 상태, 테이블 컬럼 표시 상태를 30일 동안 저장하도록 업데이트하였습니다.',
                '테이블 뷰에서 필터 아이콘 아래에 필터 입력란이 표시되고, 오른쪽에 컬럼 선택(체크박스) UI를 추가하여 사용자가 보여줄 컬럼을 직접 설정할 수 있게 하였습니다.',
                '표 뷰일 때 year-control 영역이 숨겨지도록 개선하였습니다.',
                '금액, 남은 금액, 예상 관세 값이 없을 경우 0으로 표시되도록 formatNumber 함수를 수정하였습니다.'
            ]
        },
        {
            date: '2025-02-28',
            changes: [
                '전체 페이지 높이를 100%로 처리하여 모바일 환경에서도 일관된 레이아웃을 제공합니다.',
                '해시 기반 라우팅을 구현하여 외부 라이브러리 없이 페이지 전환이 가능해졌습니다.',
                '푸터에 패치노트 링크를 추가하여 사용자가 쉽게 패치 내역을 확인할 수 있습니다.',
                '패치노트 디자인을 개선하여 날짜별 그룹화와 가독성을 향상시켰습니다.',
                '다크모드가 전체 앱에 적용되어, UI 요소들의 색상이 일관되게 보이도록 개선되었습니다.'
            ]
        },
        {
            date: '2025-02-27',
            changes: [
                '사이드바가 오른쪽에서 fly 트랜지션을 사용해 슬라이드로 나타나도록 개선되었습니다.',
                '모든 화면 크기에서 데스크탑/모바일 구분 없이 햄버거 메뉴만 표시되도록 변경되었습니다.',
                '다크모드에서 햄버거 버튼과 닫기(×) 버튼의 색상을 명시적으로 흰색(#fff)으로 지정하여 가독성을 향상시켰습니다.',
                '기타 UI 및 기능 개선, 버그 수정이 이루어졌습니다.'
            ]
        }
    ];
</script>

<main class="patch-notes">
    <div class="patch-container">
        <h1 class="page-title">패치노트</h1>
        <div class="timeline">
            {#each patches as patch, i}
                <article class="patch-card">
                    <div class="timeline-dot"></div>
                    <div class="patch-content">
                        <div class="patch-date">{patch.date}</div>
                        <ul>
                            {#each patch.changes as change}
                                <li>{change}</li>
                            {/each}
                        </ul>
                    </div>
                </article>
            {/each}
        </div>
    </div>
</main>

<style>
    .patch-notes {
        min-height: 100vh;
        padding: var(--space-8) var(--space-4);
        background-color: var(--color-bg);
        color: var(--color-text);
    }
    .patch-container {
        max-width: 640px;
        margin: 0 auto;
    }
    .page-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text);
        margin-bottom: var(--space-8);
    }
    .timeline {
        position: relative;
        padding-left: var(--space-6);
    }
    .timeline::before {
        content: '';
        position: absolute;
        left: 7px;
        top: 8px;
        bottom: 0;
        width: 2px;
        background: var(--color-border);
    }
    .patch-card {
        position: relative;
        margin-bottom: var(--space-6);
    }
    .patch-card:last-child {
        margin-bottom: 0;
    }
    .timeline-dot {
        position: absolute;
        left: calc(-1 * var(--space-6) + 3px);
        top: 8px;
        width: 10px;
        height: 10px;
        border-radius: var(--radius-full);
        background: var(--color-primary);
        border: 2px solid var(--color-bg);
        z-index: 1;
    }
    .patch-content {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-4) var(--space-5);
        box-shadow: var(--shadow-sm);
    }
    .patch-date {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-primary);
        margin-bottom: var(--space-3);
    }
    ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    li {
        position: relative;
        padding-left: var(--space-4);
        margin-bottom: var(--space-2);
        font-size: 0.8125rem;
        line-height: 1.6;
        color: var(--color-text-secondary);
    }
    li:last-child {
        margin-bottom: 0;
    }
    li::before {
        content: '';
        position: absolute;
        left: 0;
        top: 8px;
        width: 5px;
        height: 5px;
        border-radius: var(--radius-full);
        background: var(--color-text-muted);
    }
</style>
