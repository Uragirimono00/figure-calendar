<!-- src/PrivacyPolicy.svelte -->
<div class="privacy-container">
    <div class="privacy-content">
        <h1>개인정보처리방침</h1>
        <p class="subtitle">Privacy Policy</p>
        <p class="updated">최종 수정일: 2025년 2월 10일</p>

        <section>
            <h2>1. 수집하는 개인정보</h2>
            <p>피규어 캘린더는 서비스 제공을 위해 다음 정보를 수집합니다:</p>
            <ul>
                <li><strong>이메일 주소</strong> — 회원가입 및 로그인 인증에 사용됩니다.</li>
                <li><strong>사용자가 입력한 상품 정보</strong> — 상품명, 가격, 발매일, 제조사, 구매처, 이미지 URL 등 사용자가 직접 입력하거나 스크래핑을 통해 가져온 정보입니다.</li>
            </ul>
        </section>

        <section>
            <h2>2. 개인정보의 이용 목적</h2>
            <ul>
                <li>사용자 인증 및 계정 관리</li>
                <li>사용자의 피규어 예약/구매 일정 관리 서비스 제공</li>
                <li>사용자가 저장한 상품 데이터의 보관 및 표시</li>
            </ul>
        </section>

        <section>
            <h2>3. 개인정보의 보관 및 파기</h2>
            <p>수집된 정보는 Firebase(Google Cloud) 서버에 안전하게 저장됩니다. 사용자가 계정을 삭제하면 관련 데이터도 함께 삭제됩니다.</p>
        </section>

        <section>
            <h2>4. 제3자 제공</h2>
            <p>피규어 캘린더는 사용자의 개인정보를 제3자에게 판매, 공유, 제공하지 않습니다. 단, 서비스 운영을 위해 다음 서비스를 이용합니다:</p>
            <ul>
                <li><strong>Firebase Authentication</strong> — 사용자 인증</li>
                <li><strong>Cloud Firestore</strong> — 데이터 저장</li>
                <li><strong>Firebase Storage</strong> — 이미지 저장</li>
                <li><strong>Firebase Cloud Functions</strong> — URL 스크래핑 처리</li>
            </ul>
            <p>위 서비스들은 Google의 개인정보처리방침에 따라 운영됩니다.</p>
        </section>

        <section>
            <h2>5. 크롬 확장프로그램</h2>
            <p>피규어 캘린더 크롬 확장프로그램은 다음과 같이 동작합니다:</p>
            <ul>
                <li>사용자가 방문 중인 상품 페이지에서 상품 정보(상품명, 가격, 이미지, 발매일, 제조사)를 추출합니다.</li>
                <li>추출된 정보는 사용자의 확인 후에만 Firebase에 저장됩니다.</li>
                <li>확장프로그램은 지원되는 쇼핑몰 사이트(comics-art.co.kr, maniahouse.co.kr, smartstore.naver.com)에서만 동작합니다.</li>
                <li>브라우징 기록, 방문 기록 등 추가적인 데이터를 수집하지 않습니다.</li>
                <li>로그인 인증 정보는 <code>chrome.storage.local</code>에 기기 내에서만 저장됩니다.</li>
            </ul>
        </section>

        <section>
            <h2>6. 사용자의 권리</h2>
            <ul>
                <li>언제든지 저장된 상품 데이터를 수정하거나 삭제할 수 있습니다.</li>
                <li>계정 삭제를 요청할 수 있습니다.</li>
            </ul>
        </section>

        <section>
            <h2>7. 문의</h2>
            <p>개인정보 관련 문의사항이 있으시면 서비스 관리자에게 연락해 주세요.</p>
        </section>
    </div>
</div>

<style>
    .privacy-container {
        max-width: 720px;
        margin: 0 auto;
        padding: var(--space-6) var(--space-4);
    }
    .privacy-content {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-xl);
        padding: var(--space-8) var(--space-6);
    }
    h1 {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text);
        margin: 0 0 var(--space-1) 0;
    }
    .subtitle {
        font-size: 0.875rem;
        color: var(--color-text-muted);
        margin: 0 0 var(--space-1) 0;
    }
    .updated {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        margin: 0 0 var(--space-6) 0;
        padding-bottom: var(--space-4);
        border-bottom: 1px solid var(--color-border);
    }
    section {
        margin-bottom: var(--space-5);
    }
    h2 {
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text);
        margin: 0 0 var(--space-2) 0;
    }
    p {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        line-height: 1.7;
        margin: 0 0 var(--space-2) 0;
    }
    ul {
        margin: var(--space-2) 0;
        padding-left: var(--space-5);
    }
    li {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        line-height: 1.7;
        margin-bottom: var(--space-1);
    }
    code {
        font-size: 0.8125rem;
        background: var(--color-surface-hover);
        padding: 1px 5px;
        border-radius: var(--radius-sm);
        color: var(--color-text);
    }
    @media (max-width: 640px) {
        .privacy-content {
            padding: var(--space-5) var(--space-4);
        }
    }
</style>
