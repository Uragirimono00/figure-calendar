<!-- src/PatchNotes.svelte -->
<script>
    const patches = [
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
    {#each patches as patch}
        <article class="patch-group">
            <h2>{patch.date}</h2>
            <ul>
                {#each patch.changes as change}
                    <li>{change}</li>
                {/each}
            </ul>
        </article>
    {/each}
</main>

<style>
    .patch-notes {
        padding: 2rem;
        max-width: 100%;
        min-height: 100%;
        margin: 0 auto;
        background-color: #fff;
        color: #333;
        border-radius: 4px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }
    :global(html.dark) .patch-notes {
        background-color: #1e1e1e;
        color: #fff;
        box-shadow: 0 2px 6px rgba(255,255,255,0.1);
    }
    .patch-group + .patch-group {
        margin-top: 2rem;
        border-top: 1px solid #ccc;
        padding-top: 1rem;
    }
    :global(html.dark) .patch-group + .patch-group {
        border-top: 1px solid #555;
    }
    h2 {
        margin-bottom: 0.5rem;
        font-size: 1.3rem;
        border-bottom: 2px solid #3498db;
        padding-bottom: 0.25rem;
    }
    :global(html.dark) h2 {
        border-bottom-color: #2980b9;
    }
    ul {
        list-style-type: disc;
        padding-left: 2rem;
        line-height: 1.6;
    }
    li {
        margin-bottom: 0.5rem;
    }
</style>
