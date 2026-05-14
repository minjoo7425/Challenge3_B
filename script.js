/* ==========================================================================
 * 외계인 스트레스 정화 센터 - 메인 스크립트
 * --------------------------------------------------------------------------
 * 페이지 흐름:
 *   1. 랜딩 (landing)      → 게임 시작 버튼
 *   2. 인트로 (intro)      → 스크롤 기반 시네마틱 인트로
 *   3. 허브 (hub)          → 6개의 미니 게임이 배치된 우주선 내부
 *      ├─ GAME #1 paint     : 행성 창조 (자유 드로잉) 
 *      ├─ GAME #2 shooting  : 전투 구역 (클릭 슈팅)
 *      ├─ GAME #3 punch     : 격투실 (클릭 펀치)
 *      ├─ GAME #4 mirror    : 심리실 (자존감 거울)
 *      ├─ GAME #5 breathing : 명상실 (호흡 훈련)
 *      └─ GAME #6 plant     : 온실 (식물 키우기)
 *
 * 목차:
 *   0.  POLYFILL               — 구형 브라우저용 roundRect
 *   1-A.INTRO CANVAS ENGINE    — 인트로 캔버스 헬퍼 : 한승연
 *   2.  APP STATE              — 전역 상태 변수 : 정예림
 *   3.  INIT                   — 앱 초기화 : 한승연
 *   4.  STARS                  — 배경 별 : 한승연
 *   5.  NAVIGATION             — 페이지 전환 : 저예림
 *   6.  LANDING PAGE           — 첫 화면 : 한승연 
 *   7.  INTRO SCROLL ENGINE    — 시네마틱 인트로 : 한승연
 *   8.  HUB PAGE               — 라운지 : 강민주
 *   9.  GAME PAGES             — 게임 페이지 렌더러 : 강민주
 *   10. NAVIGATION FUNCTIONS   — 모달 / 게임 선택 : 정예림
 *   11. GAME #1 PAINT          — 행성 창조 : 정예림
 *   12. GAME #2 SHOOTING       — 전투 구역 : 강민주(삭제)
 *   13. GAME #3 PUNCH          — 격투실 : 강민주
 *   14. GAME #4 MIRROR         — 심리실 : 강민주
 *   15. GAME #5 BREATHING      — 명상실 : 정예림
 *   16. GAME #6 PLANT          — 온실 : 한승연
 *   17. BOOT                   — 앱 시작 트리거 : 정예림
 *   18. 불멍                    - 불멍 페이지 제작 : 정예림
 *   19. ending                 - 한승언
 * ========================================================================== */


/* ==========================================================================
 * 0. POLYFILL — 구형 브라우저용 roundRect 폴리필
 * ========================================================================== */
// roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (r > Math.min(w,h)/2) r = Math.min(w,h)/2;
        this.beginPath();
        this.moveTo(x+r, y);
        this.lineTo(x+w-r, y);
        this.arcTo(x+w, y, x+w, y+r, r);
        this.lineTo(x+w, y+h-r);
        this.arcTo(x+w, y+h, x+w-r, y+h, r);
        this.lineTo(x+r, y+h);
        this.arcTo(x, y+h, x, y+h-r, r);
        this.lineTo(x, y+r);
        this.arcTo(x, y, x+r, y, r);
        this.closePath();
        return this;
    };
}

/* ==========================================================================
 * 1-A. INTRO (NEW) — 파스텔 네온 스크롤 인트로
 *
 *   피그마 프롬프트 기반으로 새로 작성된 인트로입니다.
 *   - 마우스 휠로 scrollProgress(0~1)를 조절
 *   - 6개 섹션: 각 16.7% 구간
 *   - 섹션별 fade in/out, 섹션 6은 fade out 없음
 *   - 모든 DOM은 renderIntroPage()에서 생성, initIntroScroll()에서 제어
 * ========================================================================== */

/* ==========================================================================
 * AUDIO MANAGER
 * ========================================================================== */
const AudioManager = {
    sounds: {},
    loops: {},   // 반복 재생 중인 BGM 추적
    
    load(name, path, options = {}) {
        const audio = new Audio(path);
        audio.volume = options.volume ?? 0.6;
        if (options.loop) audio.loop = true;
        this.sounds[name] = audio;
        return audio;
    },
    
    // 효과음: 처음부터 재생 (이미 재생 중이면 다시 처음부터)
    play(name) {
        const s = this.sounds[name];
        if (!s) return;
        s.muted = isMuted;
        s.currentTime = (name === 'popSound') ? 0.5 : 0;
        s.play().catch(() => {});
    },

    // 타이핑 전용: 매번 새 Audio 인스턴스로 즉각 재생 (빠른 타격감)
    playTyping() {
        try {
            const s = this.sounds['typing'];
            if (!s || !s.src) return;
            const clone = new Audio(s.src);
            clone.volume = s.volume;
            clone.currentTime = 0.5;
            clone.play().catch(() => {});
        } catch(e) {}
    },
    
    // BGM: 끝나면 3초 뒤 다시 재생
    playBGMWithDelay(name) {
        const s = this.sounds[name];
        if (!s) return;
        this.stopBGM(name);
        s.muted = isMuted;
        s.currentTime = 0;
        s.loop = false;
        const onEnd = () => {
            this.loops[name] = setTimeout(() => {
                if (this.sounds[name]) {
                    this.sounds[name].currentTime = 0;
                    this.sounds[name].play().catch(() => {});
                }
            }, 3000);
        };
        s.addEventListener('ended', onEnd);
        this.loops[name + '_handler'] = onEnd;
        s.play().catch(() => {});
    },
    
    // BGM: 무한 루프
    playBGMLoop(name) {
        const s = this.sounds[name];
        if (!s) return;
        s.muted = isMuted;
        s.currentTime = 0;
        s.loop = true;
        s.play().catch(() => {});
    },

    // BGM: 특정 시간(초)부터 루프 재생
    playBGMLoopFrom(name, startTime) {
        const s = this.sounds[name];
        if (!s) return;
        s.muted = isMuted;
        s.currentTime = startTime;
        s.loop = true;
        s.play().catch(() => {});
    },
    
    stop(name) {
        const s = this.sounds[name];
        if (!s) return;
        s.pause();
        s.currentTime = 0;
    },
    
    stopBGM(name) {
        const s = this.sounds[name];
        if (!s) return;
        s.pause();
        s.currentTime = 0;
        if (this.loops[name]) {
            clearTimeout(this.loops[name]);
            delete this.loops[name];
        }
        if (this.loops[name + '_handler']) {
            s.removeEventListener('ended', this.loops[name + '_handler']);
            delete this.loops[name + '_handler'];
        }
    },
    
    stopAll() {
        Object.keys(this.sounds).forEach(name => this.stopBGM(name));
    }
};

// 사운드 프리로드 (경로는 실제 파일명에 맞춰 수정하세요)
AudioManager.load('pop',         'assets/sounds/pop.mp3',     { volume: 0.7 });
AudioManager.load('typing',      'assets/sounds/typing.mp3',  { volume: 0.5 });
AudioManager.load('light',       'assets/sounds/light.mp3',   { volume: 0.6 });
AudioManager.load('createplanet','assets/sounds/createplanet.mp3', { volume: 0.5 });
AudioManager.load('intro',       'assets/sounds/intro.mp3',   { volume: 0.5 });
AudioManager.load('intro2',      'assets/sounds/intro2.mp3',  { volume: 0.5 });
AudioManager.load('hub',         'assets/sounds/hub.mp3',     { volume: 0.5 });
AudioManager.load('greenhouse',  'assets/sounds/greenhouse.mp3', { volume: 0.5 });
AudioManager.load('water',       'assets/sounds/water.mp3',   { volume: 0.6 });
AudioManager.load('hit',         'assets/sounds/hit.mp3',     { volume: 0.7 });
AudioManager.load('yoga',        'assets/sounds/yoga.mp3',    { volume: 0.5 });
AudioManager.load('fire',        'assets/sounds/fire.mp3',    { volume: 0.6 });
AudioManager.load('popSound',    'assets/sounds/pop.mp3',     { volume: 0.8 });
AudioManager.load('heal',        'assets/sounds/++.mp3',      { volume: 0.8 });
AudioManager.load('button',      'assets/sounds/button.mp3',  { volume: 0.6 });
AudioManager.load('ending',      'assets/sounds/ending.mp3',  { volume: 0.5 });



// ── 전역 상태 ──────────────────────────
let introScrollProgress = 0;                 // 0 ~ 1
let introRAF = null;
let _introWheelHandler = null;
let _introTouchStart = 0;

// 섹션3 끝 스크롤 잠금: 3번 스크롤 카운트
let _s3ScrollCount = 0;           // 0 → 3 채워야 통과
const S3_LOCK_THRESHOLD = 0.490;  // 이 진행값 이상에서 잠금 발동
const S3_UNLOCK_AT     = 3;       // 필요한 스크롤 횟수

// 섹션 구간 (0-1)
const INTRO_SECTIONS = [
    { start: 0.000, end: 0.167 },   // 1. 태양계
    { start: 0.167, end: 0.334 },   // 2. 지구 확대 + 스트레스
    { start: 0.334, end: 0.501 },   // 3. 폭발
    { start: 0.501, end: 0.668 },   // 4. 경고
    { start: 0.668, end: 0.835 },   // 5. 빨려들어가기
    { start: 0.835, end: 1.000 },   // 6. 마지막 메시지
];

// 섹션별 opacity 계산 (처음 5% fade in, 마지막 5% fade out)
// 섹션 6은 fade out 없음
function introSectionOpacity(idx) {
    const sec = INTRO_SECTIONS[idx];
    const t = introScrollProgress;
    if (t < sec.start || t > sec.end) return 0;
    const dur = sec.end - sec.start;
    const local = (t - sec.start) / dur;
    const fadeIn  = 0.05 / dur;   // 매우 빠른 페이드인
    const fadeOut = 0.04 / dur;   // 아주 짧은 페이드아웃 (글씨 최대한 오래 유지)
    let op = 1;
    if (local < fadeIn) op = local / fadeIn;
    else if (idx !== 5 && local > 1 - fadeOut) op = (1 - local) / fadeOut;
    return Math.max(0, Math.min(1, op));
}

/* ==========================================================================
 *  INTRO PAGE — 렌더링된 HTML
 * ========================================================================== */
function renderIntroPage() {
    // 별 60개
    let starsHtml = '<div class="intro-stars">';
    for (let i = 0; i < 60; i++) {
        const size = Math.random() * 2 + 1;
        const top  = Math.random() * 100;
        const left = Math.random() * 100;
        const dur  = Math.random() * 2 + 2;
        const del  = Math.random() * 3;
        starsHtml += `<div class="intro-star" style="width:${size}px;height:${size}px;top:${top}%;left:${left}%;animation-duration:${dur}s;animation-delay:${del}s;"></div>`;
    }
    starsHtml += '</div>';

    // 폭발 균열 12개
    let cracksHtml = '';
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * 360;
        cracksHtml += `<div class="intro-explosion-crack" style="transform:translate(-50%,0) rotate(${angle}deg);"></div>`;
    }
    // 폭발 파편 30개
    let debrisHtml = '';
    for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * 360 + (Math.random() - 0.5) * 20;
        const size = 6 + Math.random() * 10;
        const shapes = ['2px', '3px', '50%'];
        debrisHtml += `<div class="intro-explosion-debris" data-angle="${angle}" style="width:${size}px;height:${size}px;border-radius:${shapes[i%3]};"></div>`;
    }
    // 불꽃 50개
    let sparksHtml = '';
    const sparkColors = ['#ffb8e6', '#d4b5ff', '#ff9b9b', '#a6f3e6', '#fff5a0', '#ffa64d'];
    for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * 360 + (Math.random() - 0.5) * 15;
        const color = sparkColors[i % sparkColors.length];
        const size = 4 + Math.random() * 6;
        sparksHtml += `<div class="intro-explosion-spark" data-angle="${angle}" style="width:${size}px;height:${size}px;background:${color};box-shadow:0 0 12px ${color},0 0 4px #fff;"></div>`;
    }
    // 충격파 4개
    let shockHtml = '';
    for (let i = 0; i < 4; i++) {
        shockHtml += `<div class="intro-explosion-shockwave" data-idx="${i}"></div>`;
    }
    // 큰 행성 조각 5개 — 폭발 후 화면에 남아 떠다님
    const chunkData = [
        { angle: 40,  dist: 260, floatX:  1.0, floatY: -0.4, rot:  1.2, size: 75 },
        { angle: 145, dist: 220, floatX: -0.7, floatY:  0.8, rot: -0.9, size: 62 },
        { angle: 220, dist: 280, floatX: -0.5, floatY: -1.0, rot:  1.5, size: 80 },
        { angle: 305, dist: 240, floatX:  0.9, floatY:  0.6, rot: -1.1, size: 55 },
        { angle: 100, dist: 200, floatX: -1.0, floatY: -0.3, rot:  0.8, size: 68 },
    ];
    let chunksHtml = '';
    chunkData.forEach((c, i) => {
        chunksHtml += `<div class="intro-explosion-chunk"
            data-angle="${c.angle}" data-dist="${c.dist}"
            data-fx="${c.floatX}" data-fy="${c.floatY}"
            data-rot="${c.rot}" data-size="${c.size}"
            style="width:${c.size}px;height:${c.size}px;"></div>`;
    });



    return `
        <div class="intro-wrap">
            ${starsHtml}

            <!-- 행성 그룹 (섹션 1) -->
            <div class="intro-planets" id="introPlanets">
                <div class="intro-planet sun"></div>
                <div class="intro-planet mercury"></div>
                <div class="intro-planet venus"></div>
                <div class="intro-planet earth" id="introEarthSmall">
                    <div class="continent c1"></div>
                    <div class="continent c2"></div>
                    <div class="continent c3"></div>
                </div>
                <div class="intro-planet mars"></div>
                <div class="intro-planet jupiter"></div>
                <div class="intro-planet saturn"></div>
                <div class="intro-planet uranus"></div>
                <div class="intro-planet neptune"></div>
            </div>

            <!-- 확대된 지구 (섹션 1→2 전환) -->
            <div class="intro-earth-zoom" id="introEarthZoom">
                <div class="continent c1"></div>
                <div class="continent c2"></div>
                <div class="continent c3"></div>
                <div class="cloud cl1"></div>
                <div class="cloud cl2"></div>
            </div>


            <!-- 섹션 1: 별똥별 -->
            <div class="intro-shooting-star" id="introShootingStar"></div>


            <!-- 섹션 1: 태양계 + 텍스트 -->
            <div class="intro-section s1" id="introS1">
                <div class="intro-text" id="introS1Text" style="opacity:0;">
                    우주는 <span class="pink">'감정 에너지'</span>를 자원으로 사용하는 세계.
                </div>
            </div>

            <!-- 섹션 2: 스트레스 강조 -->
            <div class="intro-section s2" id="introS2">
                <div class="intro-text" id="introS2Text" style="opacity:0;">
                    그중에서도 인간의 <span class="pink">'스트레스'</span>는<br>
                    가장 불안정하고 강력한 에너지다.
                </div>
            </div>

            <!-- 섹션 3: 폭발 -->
            <div class="intro-section s3" id="introS3">
                <div class="intro-explosion-wrap">
                    <div class="intro-explosion-planet" id="introExpPlanet"></div>
                    ${cracksHtml}
                    ${shockHtml}
                    <div class="intro-explosion-flash" id="introExpFlash"></div>
                    <div class="intro-explosion-fire" id="introExpFire"></div>
                    ${debrisHtml}
                    ${sparksHtml}
                    ${chunksHtml}
                </div>
                <div class="intro-text" id="introS3Text" style="margin-top: 45vh;">
                    <span id="introS3W1" style="opacity:0;">외계 문명은 이 에너지를 방치하면</span><br>
                    <span id="introS3W2" style="opacity:0;">우주를 </span><span class="pink" id="introS3W3" style="opacity:0;">폭발</span><span class="orange" id="introS3W4" style="opacity:0;">, 왜곡</span><span class="lavender" id="introS3W5" style="opacity:0;">, 현실 붕괴</span><span id="introS3W6" style="opacity:0;">를 일으킬 수 있다고 판단한다.</span>
                </div>
                <div class="intro-explosion-darkness" id="introExpDark"></div>
            </div>

            <!-- 섹션 4: 경고 -->
            <div class="intro-section s4" id="introS4">
                <div class="intro-warning" id="introWarningLevel">⚠ 스트레스 지수 위험 감지 ⚠</div>
            </div>

            <!-- 섹션 5: 빨려들어가기 (포털 연출) -->
            <div class="intro-section s5" id="introS5">
                <!-- 좌/우 배경 패널 (V자로 벌어짐) -->
                <div class="intro-portal-bg left"  id="introPortalLeft"></div>
                <div class="intro-portal-bg right" id="introPortalRight"></div>

                <!-- 중앙 어두운 포털 (V자 구멍) -->
                <div class="intro-portal-core" id="introPortalCore"></div>

                <!-- 빨려들어가는 캐릭터 (당신) -->
                <img class="intro-suck-char" id="introSuckChar"
                     src="assets/character/intro.png" alt="당신" />

                <!-- 텍스트 -->
                <div class="intro-suck-text" id="introSuckText">
                    스트레스 지수가 감지된 <span class="pink">'당신'</span>은<br>
                    <span class="mint">외계 우주 힐링센터</span>로 빨려 들어간다.
                </div>
            </div>

            <!-- 섹션 6: 마지막 메시지 -->
            <div class="intro-section s6" id="introS6">
                <div class="intro-s6-bg"></div>
                <div class="intro-text">
                    당신의 모든 스트레스를 해소하여<br>
                    <span class="mint">지구로 돌아가길</span> 바란다.
                </div>
                <button class="intro-cta-btn" id="introCtaBtn" onclick="showLoadingAndGoHub()">
                    우주힐링센터 입장 →
                </button>
            </div>

            <!-- UI: 건너뛰기 -->
            <button class="intro-skip-btn" onclick="showLoadingAndGoHub()">건너뛰기</button>

            <!-- UI: 진행 바 -->
            <div class="intro-progress">
                <div class="intro-progress-bar">
                    <div class="intro-progress-fill" id="introProgressFill"></div>
                </div>
                <div class="intro-progress-text">스크롤하여 계속...</div>
            </div>

            <!-- UI: 섹션3 스크롤 잠금 힌트 -->
            <div id="introS3LockHint" class="intro-s3-lock-hint"></div>
            </div>
    `;
}

/* ==========================================================================
 * 7. INTRO SCROLL ENGINE (NEW) — 스크롤 기반 애니메이션
 * ========================================================================== */
function initIntroScroll() {
    introScrollProgress = 0;
    _s3ScrollCount = 0;   // 섹션 진입 시 카운트 리셋
    window._introAutoAdvanced = false;

    // ── 섹션3 끝 잠금 체크 헬퍼 ─────────────
    // 반환값: true = 스크롤 진행 허용, false = 잠금(카운트만 올림)
    function checkS3Lock(forward) {
        const locked = forward
            && introScrollProgress >= S3_LOCK_THRESHOLD
            && introScrollProgress < INTRO_SECTIONS[2].end;   // 0.501
        if (!locked) return true;   // 잠금 구간 아님 → 그냥 통과
        _s3ScrollCount++;
        // 카운트 미달 → 막기
        if (_s3ScrollCount < S3_UNLOCK_AT) return false;
        // 카운트 채움 → 잠금 해제, 다음 섹션으로
        _s3ScrollCount = S3_UNLOCK_AT;  // 더 쌓이지 않게 고정
        return true;
    }

    // ── 휠 이벤트 ─────────────────
    _introWheelHandler = (e) => {
        e.preventDefault();
        const forward = e.deltaY > 0;
        // t=1(섹션6) 도달 후엔 더 이상 스크롤로 진행 안 함 (버튼 클릭만 허용)
        if (introScrollProgress >= 0.999 && forward) return;
        if (!checkS3Lock(forward)) return;
        const delta = forward ? 0.007 : -0.007;
        introScrollProgress = Math.max(0, Math.min(1, introScrollProgress + delta));
    };
    window.addEventListener('wheel', _introWheelHandler, { passive: false });

    // ── 터치 이벤트 ────────────────
    const onTouchStart = (e) => { _introTouchStart = e.touches[0].clientY; };
    const onTouchMove  = (e) => {
        e.preventDefault();
        const cur = e.touches[0].clientY;
        const forward = cur < _introTouchStart;
        const delta = (_introTouchStart - cur) * 0.0015;
        _introTouchStart = cur;
        // t=1 도달 후 앞으로 이동 차단
        if (introScrollProgress >= 0.999 && forward) return;
        if (delta > 0 && !checkS3Lock(true)) return;
        introScrollProgress = Math.max(0, Math.min(1, introScrollProgress + delta));
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove',  onTouchMove,  { passive: false });

    // ── 키보드 ────────────────────
    const onKey = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
            e.preventDefault();
            if (introScrollProgress >= 0.999) return;  // 끝에서 차단
            if (!checkS3Lock(true)) return;
            introScrollProgress = Math.min(1, introScrollProgress + 0.05);
        }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            introScrollProgress = Math.max(0, introScrollProgress - 0.05);
        }
    };
    document.addEventListener('keydown', onKey);

    // 렌더 루프 시작
    if (introRAF) cancelAnimationFrame(introRAF);
    introRenderLoop();

    // cleanup
    window._introCleanup = () => {
        if (introRAF) cancelAnimationFrame(introRAF);
        introRAF = null;
        window.removeEventListener('wheel', _introWheelHandler);
        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchmove',  onTouchMove);
        document.removeEventListener('keydown', onKey);
    };
}

/* --------------------------------------------------------------------------
 * 렌더 루프 — 매 프레임마다 scrollProgress에 따라 DOM 스타일 갱신
 * -------------------------------------------------------------------------- */
function introRenderLoop() {
    const t = introScrollProgress;

    // ── UI: 진행 바 ─────
    const pf = document.getElementById('introProgressFill');
    if (pf) pf.style.width = (t * 100).toFixed(1) + '%';

    // ── UI: 섹션3 스크롤 잠금 힌트 ─────
    const lockHint = document.getElementById('introS3LockHint');
    if (lockHint) {
        lockHint.style.opacity = '0';   // 항상 숨김
    }

    // ── 각 섹션 opacity 적용 ────────────
    for (let i = 0; i < 6; i++) {
        const el = document.getElementById('introS' + (i + 1));
        if (!el) continue;
        const op = introSectionOpacity(i);
        el.style.opacity = op;
        el.classList.toggle('active', op > 0.1);
    }

    // ── 섹션 1: 행성 이동 + 텍스트 fade in ──
    const planets = document.getElementById('introPlanets');
    if (planets) {
        const s1Local = Math.max(0, Math.min(1, (t - INTRO_SECTIONS[0].start) / (INTRO_SECTIONS[0].end - INTRO_SECTIONS[0].start)));
        planets.style.transform = `translateX(calc(-50% + ${-s1Local * 30}vw))`;
        planets.style.opacity = t < INTRO_SECTIONS[1].start ? 1 : 0;
    }
    const s1Text = document.getElementById('introS1Text');
    if (s1Text) {
        const tp = (t - 0.05) / (INTRO_SECTIONS[0].end - 0.05 - 0.01);
        s1Text.style.opacity = t < 0.05 ? 0 : Math.min(1, tp);
    }


     // ── 섹션 1: 별똥별 (스크롤에 따라 오른쪽 위 → 화면 중앙으로 이동) ──
    const shootingStar = document.getElementById('introShootingStar');
    if (shootingStar) {
        const s1Start = INTRO_SECTIONS[0].start;   // 0.000
        const s1End   = INTRO_SECTIONS[0].end;     // 0.167
        if (t >= s1Start && t <= s1End) {
            const s1Local = (t - s1Start) / (s1End - s1Start);   // 0 ~ 1
            // 시작: 화면 오른쪽 위 바깥 (110vw, -10vh)
            // 끝  : 화면 중앙 (50vw, 50vh)
            const x = 110 - s1Local * 60;    // 110vw → 50vw
            const y = -10 + s1Local * 60;    // -10vh → 50vh
            shootingStar.style.transform = `translate(${x}vw, ${y}vh)`;
            // 페이드: 처음 10% 페이드인, 마지막 15% 페이드아웃
            let op = 1;
            if (s1Local < 0.1)      op = s1Local / 0.1;
            else if (s1Local > 0.85) op = (1 - s1Local) / 0.15;
            shootingStar.style.opacity = op;
        } else {
            shootingStar.style.opacity = 0;
        }
    }


    // ── 섹션 1→2 전환: 지구 확대 ────────
    const earthZoom = document.getElementById('introEarthZoom');
if (earthZoom) {
    if (t >= 0.167 && t <= 0.334) {
        // 1) 확대: 0.167 ~ 0.230 (scale 1 → 10)
        const zoomProg = Math.max(0, Math.min(1, (t - 0.167) / (0.230 - 0.167)));
        const scale = 1 + zoomProg * 9;
        earthZoom.style.transform = `translate(-50%, -50%) scale(${scale})`;

        // 2) 밝기(opacity) 단계별 계산
        let op;
        if (t < 0.230) {
            // 등장 페이드인 (밝게 나타남)
            op = Math.min(1, zoomProg * 3);
        } else if (t < 0.255) {
            // 밝기 줄이기: 1 → 0.3 (70% 어두워짐)
            const dim = (t - 0.230) / (0.255 - 0.230);
            op = 1 - dim * 0.7;
        } else if (t < 0.310) {
            // 유지 (스크롤 3~4번 분량 멈춤)
            op = 0.3;
        } else {
            // 섹션3으로 넘어가며 천천히 페이드아웃
            const fadeOut = (t - 0.310) / (0.334 - 0.310);
            op = 0.3 * (1 - fadeOut);
        }
        earthZoom.style.opacity = Math.max(0, op);
    } else {
        earthZoom.style.opacity = 0;
    }
}

    // ── 섹션 2: 텍스트 (지구 확대가 끝난 후 서서히 나타남) ──
    const s2Text = document.getElementById('introS2Text');
    if (s2Text) {
        // 0.25 ~ 0.30 구간에서 서서히 페이드인
        // 0.32 이후에는 유지, 0.334 (섹션 2 끝) 부터 페이드아웃
        const fadeInStart = 0.20;
        const fadeInEnd   = 0.26;
        const fadeOutStart = 0.315;
        const fadeOutEnd   = 0.334;
        let op = 0;
        if (t >= fadeInStart && t < fadeInEnd) {
            op = (t - fadeInStart) / (fadeInEnd - fadeInStart);
        } else if (t >= fadeInEnd && t < fadeOutStart) {
            op = 1;
        } else if (t >= fadeOutStart && t < fadeOutEnd) {
            op = 1 - (t - fadeOutStart) / (fadeOutEnd - fadeOutStart);
        }
        s2Text.style.opacity = Math.max(0, Math.min(1, op));
    }

    // ── 섹션 3: 폭발 애니메이션 (강화 버전) ──────────
    const s3Start = INTRO_SECTIONS[2].start;   // 0.334
    const s3End   = INTRO_SECTIONS[2].end;     // 0.501
    const s3Dur   = s3End - s3Start;
    const s3p     = Math.max(0, Math.min(1, (t - s3Start) / s3Dur));

    // ── 섹션3 끝부분 스크롤 잠금 (0.88 이상에서 3번 스크롤해야 통과) ──
    // s3ScrollCount 변수는 전역에서 관리 (initIntroScroll에서 리셋)
    if (t >= s3Start - 0.02 && t <= s3End + 0.02) {

        // ───── 1) 행성 — 긴장 팽창 → 폭발 → 소멸 ─────
        const planet = document.getElementById('introExpPlanet');
        if (planet) {
            if (s3p < 0.18) {
                // 천천히 팽창 + 진동
                const shake = s3p > 0.08 ? (Math.random() - 0.5) * (s3p * 18) : 0;
                const pScale = 1 + s3p * 1.2;
                planet.style.transform = `translate(${shake}px, ${shake * 0.6}px) scale(${pScale})`;
                planet.style.opacity = 1;
                planet.style.filter = `brightness(${1 + s3p * 0.8}) saturate(${1 + s3p * 0.5})`;
            } else if (s3p < 0.28) {
                // 극한 팽창 + 붉게 달아오름
                const local = (s3p - 0.18) / 0.10;
                const shake = (Math.random() - 0.5) * 28;
                const pScale = 1.22 + local * 1.0;
                planet.style.transform = `translate(${shake}px, ${shake * 0.5}px) scale(${pScale})`;
                planet.style.opacity = 1 - local * 0.3;
                planet.style.filter = `brightness(${1.8 + local}) saturate(2) hue-rotate(${local * -30}deg)`;
            } else {
                // 폭발 후 사라짐
                planet.style.opacity = 0;
                planet.style.filter = '';
            }
        }

        // ───── 2) 균열 (0.06 ~ 0.25) ─────
        const crackOp = s3p < 0.06 ? 0
            : s3p < 0.15 ? (s3p - 0.06) / 0.09
            : Math.max(0, 1 - (s3p - 0.15) / 0.10);
        document.querySelectorAll('.intro-explosion-crack').forEach(el => {
            el.style.opacity = crackOp;
        });

        // ───── 3) 섬광 (0.18 ~ 0.36) — 작고 빠르게 ─────
        const flash = document.getElementById('introExpFlash');
        if (flash) {
            const fp   = Math.max(0, Math.min(1, (s3p - 0.18) / 0.08));
            const fade = s3p > 0.24 ? Math.max(0, 1 - (s3p - 0.24) / 0.12) : 1;
            flash.style.opacity   = fp * fade * 0.65;
            flash.style.transform = `translate(-50%,-50%) scale(${0.1 + fp * 1.6})`;
        }

        // ───── 4) 충격파 4개 (0.20 ~ 0.70) ─────
        document.querySelectorAll('.intro-explosion-shockwave').forEach((el, i) => {
            const startAt = 0.20 + i * 0.07;
            const local = Math.max(0, Math.min(1, (s3p - startAt) / 0.38));
            if (local > 0 && local < 1) {
                el.style.opacity = (1 - local) * 1.4;
                el.style.transform = `translate(-50%,-50%) scale(${1 + local * 6})`;
            } else {
                el.style.opacity = 0;
            }
        });

        // ───── 5) 작은 파편 (0.25 ~ 0.65) ─────
        document.querySelectorAll('.intro-explosion-debris').forEach((el, idx) => {
            const angle = parseFloat(el.dataset.angle);
            const local = Math.max(0, Math.min(1, (s3p - 0.25) / 0.40));
            if (local > 0) {
                const dist = local * 500;
                const rad = angle * Math.PI / 180;
                const dx = Math.cos(rad) * dist;
                const dy = Math.sin(rad) * dist;
                const rot = local * 1080;
                el.style.opacity = (1 - local) * 1.0;
                el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg)`;
            } else {
                el.style.opacity = 0;
            }
        });

        // ───── 6) 불꽃 (0.28 ~ 0.72) ─────
        document.querySelectorAll('.intro-explosion-spark').forEach((el) => {
            const angle = parseFloat(el.dataset.angle);
            const local = Math.max(0, Math.min(1, (s3p - 0.28) / 0.44));
            if (local > 0) {
                const dist = local * 380;
                const rad = angle * Math.PI / 180;
                const dx = Math.cos(rad) * dist;
                const dy = Math.sin(rad) * dist;
                el.style.opacity = (1 - local) * 1.1;
                el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${1 - local * 0.6})`;
            } else {
                el.style.opacity = 0;
            }
        });

        // ───── 7) 큰 행성 조각 (0.26 ~ 끝) — 멀리 퍼지고 선명하게 남음 ─────
        document.querySelectorAll('.intro-explosion-chunk').forEach((el) => {
            const angle  = parseFloat(el.dataset.angle);
            const dist   = parseFloat(el.dataset.dist);
            const floatX = parseFloat(el.dataset.fx);
            const floatY = parseFloat(el.dataset.fy);
            const rotSpd = parseFloat(el.dataset.rot);

            const blastLocal = Math.max(0, Math.min(1, (s3p - 0.26) / 0.20));

            if (blastLocal > 0) {
                const rad   = angle * Math.PI / 180;
                const baseX = Math.cos(rad) * dist * 1.8 * blastLocal;
                const baseY = Math.sin(rad) * dist * 1.8 * blastLocal;

                // 폭발 후 은은하게 부유
                const floatProg = Math.max(0, (s3p - 0.46) / 0.54);
                const fx     = floatX * floatProg * 35;
                const fy     = floatY * floatProg * 35;
                const finalX = baseX + fx;
                const finalY = baseY + fy;

                const totalRot = blastLocal * 260 + floatProg * rotSpd * 120;

                // 빠르게 등장 → 끝까지 선명하게 유지 → 섹션 말미에 페이드아웃
                let op;
                if (blastLocal < 0.15)  op = blastLocal / 0.15;
                else if (s3p < 0.94)    op = 1;
                else                    op = Math.max(0, 1 - (s3p - 0.94) / 0.06);

                el.style.opacity   = op;
                el.style.transform = `translate(calc(-50% + ${finalX}px), calc(-50% + ${finalY}px)) rotate(${totalRot}deg)`;
            } else {
                el.style.opacity = 0;
            }
        });

        // ───── 8) 화염 구체 (0.26 ~ 0.46) — 작고 빠르게 소멸 ─────
        const fire = document.getElementById('introExpFire');
        if (fire) {
            const fp   = Math.max(0, Math.min(1, (s3p - 0.26) / 0.20));
            const fade = s3p > 0.36 ? Math.max(0, 1 - (s3p - 0.36) / 0.10) : 1;
            fire.style.opacity   = fp * 0.55 * fade;
            fire.style.transform = `translate(-50%,-50%) scale(${fp * 1.4})`;
        }

        // ───── 9) 어둠 — 조각·텍스트 잘 보이도록 최소화 ─────
        const dark = document.getElementById('introExpDark');
        if (dark) {
            const dp = Math.max(0, Math.min(1, (s3p - 0.82) / 0.12));
            dark.style.opacity = dp * 0.18;
        }

        // ───── 10) 텍스트 순차 표시 ─────
        const textPoints = [
            { id: 'introS3W1', at: 0.340 },
            { id: 'introS3W2', at: 0.370 },
            { id: 'introS3W3', at: 0.400 },
            { id: 'introS3W4', at: 0.425 },
            { id: 'introS3W5', at: 0.450 },
            { id: 'introS3W6', at: 0.476 },
        ];
        textPoints.forEach(tp => {
    const el = document.getElementById(tp.id);
    if (!el) return;
    const fadeIn  = Math.max(0, Math.min(1, (t - tp.at) / 0.015));
    const fadeOut = t > 0.498 ? Math.max(0, 1 - (t - 0.498) / 0.003) : 1;
    el.style.opacity = fadeIn * fadeOut;
});

    } else {
        // 섹션 밖에서는 모든 폭발 요소 숨김
        document.querySelectorAll('.intro-explosion-crack, .intro-explosion-shockwave, .intro-explosion-debris, .intro-explosion-spark, .intro-explosion-chunk').forEach(el => el.style.opacity = 0);
        ['introExpFlash','introExpFire','introExpDark'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.opacity = 0;
        });
    }

    // ── 섹션 5: 빨려들어가기 (포털 연출) ─────────
    const s5Start = INTRO_SECTIONS[4].start;
    const s5End   = INTRO_SECTIONS[4].end;
    const s5p = Math.max(0, Math.min(1, (t - s5Start) / (s5End - s5Start)));

    if (t >= s5Start - 0.02 && t <= s5End + 0.02) {
        // ① 좌/우 배경 패널 V자로 벌어지기 (rotateY)
        //    0 → 60도까지, 안쪽(가운데)으로 기울어짐
        const rotateDeg = s5p * 60;
        const panelL = document.getElementById('introPortalLeft');
        const panelR = document.getElementById('introPortalRight');
        if (panelL) panelL.style.transform = `perspective(900px) rotateY(${rotateDeg}deg)`;
        if (panelR) panelR.style.transform = `perspective(900px) rotateY(${-rotateDeg}deg)`;

        // ② 중앙 포털 어두워짐 (0 → 0.95)
        const core = document.getElementById('introPortalCore');
        if (core) {
            // 초반 15%부터 서서히 짙어짐
            const coreOp = Math.max(0, Math.min(0.95, (s5p - 0.15) / 0.7));
            // 포털 크기도 커짐 (작은 점 → 화면의 절반)
            const coreScale = 0.2 + s5p * 1.3;
            core.style.opacity = coreOp;
            core.style.transform = `translate(-50%, -50%) scale(${coreScale})`;
        }

        // ③ 캐릭터(당신) — 회전+축소하며 중앙(35vh)까지, 이후 서서히 사라짐
        const char = document.getElementById('introSuckChar');
        if (char) {
            const local = s5p;

            // 이동: 0 ~ 0.7 구간에서 -25vh → 35vh
            const moveProg = Math.min(local / 0.7, 1);
            const y = -25 + moveProg * 60;   // -25vh → 35vh

            // x 흔들림 (이동 중에만)
            const xWobble = Math.sin(local * Math.PI * 3) * 8 * (1 - moveProg);

            // 크기: 1.0 → 0.35 (중앙 도달 후 고정)
            const scale = 1 - moveProg * 0.65;

            // 회전: 이동 중 540도, 중앙 도달 후 고정
            const rot = moveProg * 540;

            // 투명도: 등장 페이드인 → 중앙 도달(0.7) 후 서서히 사라짐
            let op = 1;
            if (local < 0.1)       op = local / 0.1;
            else if (local > 0.7)  op = Math.max(0, 1 - (local - 0.7) / 0.3);

            char.style.transform =
                `translate(calc(-50% + ${xWobble}vw), ${y}vh) scale(${scale}) rotate(${rot}deg)`;
            char.style.opacity = op;
        }

        // ④ 텍스트 페이드인 (중반 30%~75% 구간에만 표시)
        const sText = document.getElementById('introSuckText');
        if (sText) {
            let tOp = 0;
            if (s5p >= 0.30 && s5p < 0.45)      tOp = (s5p - 0.30) / 0.15;
            else if (s5p >= 0.45 && s5p < 0.75) tOp = 1;
            else if (s5p >= 0.75 && s5p < 0.90) tOp = 1 - (s5p - 0.75) / 0.15;
            sText.style.opacity = Math.max(0, Math.min(1, tOp));
        }
    } else {
        // 섹션 5 밖에서는 캐릭터 숨김
        const char = document.getElementById('introSuckChar');
        if (char) char.style.opacity = 0;
    }

    // ── 섹션 6: CTA 버튼 (92% 이상) ──────
    const cta = document.getElementById('introCtaBtn');
    if (cta) {
        if (t >= 0.92) cta.classList.add('show');
        else           cta.classList.remove('show');
    }

    introRAF = requestAnimationFrame(introRenderLoop);
}

/* ==========================================================================
 * LOADING OVERLAY (컨트롤룸 진입용) — 조구만 스타일 로딩바
 * ========================================================================== */
function showLoadingAndGoHub() {
    // 이미 로딩 중이면 중복 방지
    if (document.getElementById('hubLoadingOverlay')) return;

    // 로딩 오버레이 생성
    const overlay = document.createElement('div');
    overlay.id = 'hubLoadingOverlay';
    overlay.className = 'hub-loading-overlay';
    overlay.innerHTML = `
        <div class="hub-loading-box">
            <div class="hub-loading-bar-wrap">
                <div class="hub-loading-bar" id="hubLoadingBar"></div>
                <div class="hub-loading-runner" id="hubLoadingRunner">🔥</div>
                <div class="hub-loading-goal">🌍</div>
            </div>
            <div class="hub-loading-text">L O A D I N G . . .</div>
        </div>
    `;
    document.body.appendChild(overlay);

    // 페이드 인
    requestAnimationFrame(() => overlay.classList.add('show'));

    // 로딩바 진행 (총 1500ms)
    const duration = 1500;
    const startTime = performance.now();
    const bar = document.getElementById('hubLoadingBar');
    const runner = document.getElementById('hubLoadingRunner');

    function updateBar(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);

        if (bar) bar.style.width = (progress * 100) + '%';
        if (runner) runner.style.left = `calc(${progress * 100}% - 16px)`;

        if (progress < 1) {
            requestAnimationFrame(updateBar);
        } else {
            // 완료 → 즉시 컨트롤룸(hub)으로 이동
            navigateTo('hub');
            // 페이지 전환 후 오버레이 제거 (살짝 텀 두고)
            setTimeout(() => {
                const ov = document.getElementById('hubLoadingOverlay');
                if (ov) {
                    ov.classList.remove('show');
                    setTimeout(() => ov.remove(), 300);
                }
            }, 100);
        }
    }
    requestAnimationFrame(updateBar);
}



/* ==========================================================================
 * 2. APP STATE — 전역 상태 변수 (현재 페이지, 점수 등)
 * ========================================================================== */
let currentPage = 'landing';
let isMenuOpen = false;
let isSettingsOpen = false;
let selectedGame = null;
let isMuted = false;

// Intro scroll state
let introScrollY = 0;
let introAnimFrame = null;
let introScrollTarget = 0;
let introScrolling = false;
let introStressFilled = false;

// Game states
let paintCanvas, paintCtx, isPainting = false, currentColor = '#ff8fb5';
const paintColors = ['#ff8fb5', '#ffa64d', '#7dffc8', '#b8f5ff', '#a78bfa', '#ff6b6b'];
let shootingScore = 0;
let shootingInterval;
let punchCount = 0;
const affirmations = [
    '나는 소중한 존재입니다',
    '나는 사랑받을 자격이 있습니다',
    '나는 충분히 잘하고 있습니다',
    '나는 행복할 자격이 있습니다',
    '나는 나 자신을 믿습니다',
    '지금 잘하고 있어.',
    '난 누구보다 잘 해내고 있어.',
    '나의 노력을 내가 알고 있어.',
    '난 나라서 특별해.',
    '난 생각보다 더 근사한 사람이야.',
    '나 꽤 잘 컸네.',
    '잘하고 있어.',
    '넘어져도 괜찮아. 일어서면 되니까.',
    '지금 고민하는 그 마음 자체가 이미 성장 중이야.',
    '난 1퍼센트의 가능성 그 자체야.',
    '난 최고야!',
    '아름답고 멋있어.'
];

// 심리실용: 전체 풀에서 5개 랜덤 선택, 다 쓰면 다시 셔플 후 5개
let _mirrorPool = [];       // 남은 풀 (아직 안 쓴 문구)
let _mirrorQueue = [];      // 현재 라운드 5개 큐
let _mirrorQueueIdx = 0;    // 큐에서 현재 위치
let _mirrorRoundCompleted = 0; // 현재 라운드 완료 수

function _mirrorShufflePool() {
    _mirrorPool = [...affirmations].sort(() => Math.random() - 0.5);
}

function _mirrorPickQueue() {
    if (_mirrorPool.length < 5) _mirrorShufflePool();
    _mirrorQueue = _mirrorPool.splice(0, 5);
    _mirrorQueueIdx = 0;
    _mirrorRoundCompleted = 0;
}

function _mirrorCurrentAffirmation() {
    return _mirrorQueue[_mirrorQueueIdx] || '';
}

function _mirrorInitIfNeeded() {
    if (_mirrorQueue.length === 0) {
        _mirrorShufflePool();
        _mirrorPickQueue();
    }
}
let mirrorIndex = 0;
let mirrorCompleted = 0;
let isBreathing = false;
let breathingCycles = 0;
let breathingTimeout;
const plantStages = [
    { emoji: '🌱', name: '씨앗', description: '작은 씨앗이 싹트기 시작했어요' },
    { emoji: '🌿', name: '새싹', description: '새싹이 자라나고 있어요' },
    { emoji: '🪴', name: '어린 식물', description: '건강하게 자라고 있어요' },
    { emoji: '🌳', name: '나무', description: '멋진 나무로 성장했어요' },
    { emoji: '🌸', name: '개화', description: '아름다운 꽃을 피웠어요!' }
];
let plantStage = 0;
let plantWater = 0;

const games = [
    {
        id: 'paint',
        title: '페인트 / 행성 만들기',
        description: '페인트를 뿌려 우주선을 색칠하거나 나만의 행성을 창조해보세요!',
        icon: '🎨',
        position: { top: '20%', left: '13%' },
        color: '#ff8fb5'
    },
    {
        id: 'shooting',
        title: '격투실',
        description: '외계 침입자를 때려서 스트레스를 날려버리세요!',
        icon: '👊',
        position: { top: '22%', right: '15%' },
        color: '#ff6b6b'
    },
    {
        id: 'mirror',
        title: '자존감 거울',
        description: '긍정적인 확언을 따라 써보며 자존감을 높여보세요.',
        icon: '✨',
        position: { top: '38%', left: '46%' },
        color: '#b8f5ff'
    },
    {
        id: 'breathing',
        title: '내면 평화 호흡',
        description: '별의 움직임을 따라 깊은 호흡으로 마음의 평화를 찾으세요.',
        icon: '🌬️',
        position: { bottom: '22%', right: '22%' },
        color: '#a78bfa'
    },
    {
        id: 'bubble',
        title: '뽁뽁이',
        description: '뽁뽁이를 눌러서 스트레스를 해소하세요!',
        icon: '🫧',
        position: { bottom: '22%', left: '22%' },
        color: '#ffd6f5'
    }
];

/* ==========================================================================
 * 3. INIT — 앱 초기화 진입점
 * ========================================================================== */
function init() {
    renderPage();
}

function reduceStress(amount = 5) {
    stressScore = Math.max(0, stressScore - amount);
    // MACHINE 화면 실시간 업데이트 반영 (이미 stressScore 참조하므로 자동)
}

function renderPage() {
     const app = document.getElementById('app');
    app.style.background = '#050510';
    
    // ★ 페이지 전환 시 모든 BGM 정지 (단, hub 아닐 때 yoga도 정지)
    if (currentPage === 'hub') {
        window._yogaBGMPlaying = false;
    }
    AudioManager.stopAll();
    
    switch (currentPage) {
        case 'landing':
            app.innerHTML = renderLandingPage();
            AudioManager.playBGMWithDelay('intro');   // ← landing BGM
            break;
        case 'intro':
            app.innerHTML = renderIntroPage();
            initIntroScroll();
            AudioManager.playBGMWithDelay('intro2');  // ← intro BGM
            break;
        case 'hub':
            app.innerHTML = renderHubPage();
            setTimeout(initHubCanvas, 0);
            AudioManager.playBGMLoop('hub');          // ← hub BGM
            break;
        case 'ending':
            app.innerHTML = renderEndingPage();
            setTimeout(initEndingScroll, 0);
            AudioManager.playBGMLoop('ending');
            break;
        case 'paint':
            reduceStress(5);
            app.innerHTML = renderPlanetCreationPage();
            initPlanetCreation();
            AudioManager.playBGMWithDelay('createplanet'); // ← 행성창조 BGM
            break;
        case 'shooting':
            reduceStress(5);
            app.innerHTML = renderPunchPage();
            initPunch();
            break;
        case 'mirror':
            reduceStress(5);
            app.innerHTML = renderMirrorGamePage();
            initMirrorGame();
            setTimeout(() => AudioManager.playBGMLoopFrom('greenhouse', 0.5), 100);
            break;
        case 'breathing':
            reduceStress(5);
            app.innerHTML = renderBreathingGamePage();
            if (!window._yogaBGMPlaying) {
                window._yogaBGMPlaying = true;
                setTimeout(() => AudioManager.playBGMLoop('yoga'), 100);
            }
            break;
        case 'bubble':
            reduceStress(5);
            app.innerHTML = renderBubblePage();
            initBubblePage();
            break;
        case 'plant':
            reduceStress(5);
            app.innerHTML = renderPlantGamePage();
            initPlantGame();
            AudioManager.playBGMLoop('greenhouse');   // ← 온실 BGM
            break;
        case 'bonfire':
            reduceStress(5);
            app.innerHTML = renderBonfirePage();
            initBonfirePage();
            setTimeout(() => AudioManager.playBGMLoop('fire'), 100);  // stopAll 이후 재생
            break;
    }
    app.style.background = '';
}


/* ==========================================================================
 * 4. STARS — 배경 별 HTML 생성
 * ========================================================================== */
function createStars() {
    let html = '<div class="stars">';
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const size = Math.random() * 2 + 0.5;
        const dur = Math.random() * 4 + 2;
        const delay = Math.random() * 3;
        html += `<div class="star" style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${delay}s;"></div>`;
    }
    html += '</div>';
    return html;
}

/* ==========================================================================
 * 5. NAVIGATION — 페이지 전환 / 네비 바 렌더링
 * ========================================================================== */
function renderNavigation() {
    return `
        <button class="menu-button" onclick="toggleMenu()">
            <svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${isMenuOpen
                    ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>'
                    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>'}
            </svg>
        </button>
        <button class="volume-button" onclick="toggleVolume()" title="${isMuted ? '소리 켜기' : '소리 끄기'}">
            ${isMuted
                ? '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>'
                : '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M9 9a3 3 0 000 6"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>'}
        </button>
        ${isMenuOpen ? renderMenu() : ''}
    `;
}

function renderMenu() {
    return `
        <div class="menu-overlay" onclick="toggleMenu()"></div>
        <div class="menu-drawer">
            <div class="menu-items">
                <div class="menu-item" onclick="document.getElementById('surveyOverlay') ? (toggleMenu(), closeSurvey()) : navigateTo('landing')">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                    </svg>
                    <span>홈</span>
                </div>
                <div class="menu-item" onclick="toggleMenu(); showLoadingAndGoHub();">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                    </svg>
                    <span>라운지</span>
                </div>
                <div class="menu-item" onclick="toggleMenu(); showHelpPopup();">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>도움말</span>
                </div>
            </div>
            <div class="menu-footer">외계 우주 힐링 센터<br/>v1.0.0</div>
        </div>
    `;
}

function renderSettings() {
    return `
        <div class="modal-overlay" onclick="closeSettings()">
            <div class="modal" onclick="event.stopPropagation()" style="border-color:rgba(125,255,200,0.3);">
                <div class="modal-header">
                    <h2>설정</h2>
                    <div class="modal-close" onclick="closeSettings()">✕</div>
                </div>
                <div class="settings-row">
                    <div class="settings-label"><span>🔊</span><span>사운드</span></div>
                    <div class="toggle active" onclick="this.classList.toggle('active')"><div class="toggle-slider"></div></div>
                </div>
                <div class="settings-row">
                    <div class="settings-label"><span>🔔</span><span>효과음</span></div>
                    <div class="toggle active" onclick="this.classList.toggle('active')"><div class="toggle-slider"></div></div>
                </div>
                <div class="settings-row">
                    <div class="settings-label"><span>📳</span><span>화면 흔들림</span></div>
                    <div class="toggle active" onclick="this.classList.toggle('active')"><div class="toggle-slider"></div></div>
                </div>
                <div class="modal-buttons" style="margin-top:20px;">
                    <button class="btn btn-start" style="--color:#7dffc8;" onclick="closeSettings()">저장</button>
                    <button class="btn btn-cancel" onclick="closeSettings()">닫기</button>
                </div>
            </div>
        </div>
    `;
}

let stressScore = 0;   // 설문 결과 스트레스 지수 (0~100)

/* ==========================================================================
 * 6. LANDING PAGE — 첫 화면 (게임 시작 버튼)
 * ========================================================================== */
function wrapChars(text) {
    return text.split('').map(ch =>
        `<span class="landing-char">${ch === ' ' ? ' ' : ch}</span>`
    ).join('');
}

function renderLandingPage() {
    const h1Text = '외계 우주 힐링 센터';
    const sub1 = '당신은 스트레스로 가득 찬 지구인입니다.';
    const sub2 = '우리 외계인 연구원들이 특별한 정화 프로그램을 준비했어요.';
    const sub3 = '함께 스트레스를 날려버릴까요?';

    return `
        <div class="page">
            ${createStars()}
            <style>.landing-page ~ .menu-button, .page > .menu-button { display:none!important; } .page > .volume-button { display:none!important; }</style>
            ${renderNavigation()}
            <div class="landing-page">
                <h1>${wrapChars(h1Text)}</h1>
                <p class="subtitle">
                    ${wrapChars(sub1)}<br/>
                    ${wrapChars(sub2)}<br/>
                    ${wrapChars(sub3)}
                </p>
                <button class="btn-enter" onclick="openSurvey()">
                    게임 참여하기
                </button>
                <div class="landing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;
}


/* ==========================================================================
 * 6-B. SURVEY — 스트레스 설문지 오버레이 (3페이지 구성)
 *   PAGE 0: 카드형 2문항
 *   PAGE 1: 슬라이더형 2문항
 *   PAGE 2: 텍스트형 2문항
 * ========================================================================== */

// 3페이지 구성
const surveyPages = [
    {
        type: 'card-page',
        questions: [
            {
                q: '오늘 기분이 어때요?',
                key: 'mood',
                options: [
                    { label: '😊 좋아',      value: 0   },
                    { label: '😐 그냥 그래', value: 30  },
                    { label: '😤 별로야',    value: 65  },
                    { label: '💀 최악이야',  value: 100 },
                ]
            },
            {
                q: '지금 머릿속이 어때요?',
                key: 'mind',
                options: [
                    { label: '🌤 맑음',      value: 0   },
                    { label: '🌀 약간 복잡', value: 50  },
                    { label: '💥 폭발 직전', value: 100 },
                ]
            }
        ]
    },
    {
        type: 'slider-page',
        questions: [
            { q: '오늘 스트레스 정도를 1~10으로 표시해주세요.', key: 'stress', min: 1, max: 10, default: 5 },
            { q: '지금 이 순간 얼마나 지쳐있나요?',             key: 'tired',  min: 1, max: 10, default: 5 },
        ]
    },
    {
        type: 'text-page',
        questions: [
            { q: '스트레스하면 생각나는 단어를 적어보세요.<br>쉼표(,)로 구분하면 여러 개 입력할 수 있어요.', key: 'word',  placeholder: '예) 일, 회사, 인간관계, 다이어트' },
            { q: '지금 가장 듣고 싶은 말을 적어보세요.',     key: 'cheer', placeholder: '예) 넌 할 수 있어, 멋져, 힘내...' },
        ]
    }
];

let surveyAnswers = {};  // { mood, mind, stress, tired, word, cheer }
let surveyPage   = 0;
let _shootingStarTimer = null;

function openSurvey() {
    surveyAnswers = {};
    surveyPage    = 0;

    const overlay = document.createElement('div');
    overlay.id        = 'surveyOverlay';
    overlay.className = 'survey-overlay';
    overlay.innerHTML = buildSurveyHTML();
    document.getElementById('app').appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('show'));
    startSurveyShootingStars();
    renderSurveyPage();
}

// ── 별똥별 ──────────────────────────────────────────
function startSurveyShootingStars() {
    function spawnStar() {
        const overlay = document.getElementById('surveyOverlay');
        if (!overlay) return;

        // 한 번에 1~3개
        const count = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < count; i++) {
            const star = document.createElement('div');
            star.className = 'survey-shooting-star';
            // 시작 위치: 화면 상단 랜덤 x
            const startX = Math.random() * 80 + 5;   // 5~85vw
            const length = Math.random() * 80 + 60;  // 60~140px
            const angle  = Math.random() * 20 + 30;  // 30~50deg
            const dur    = Math.random() * 0.6 + 0.6; // 0.6~1.2s
            const delay  = i * (Math.random() * 0.3);
            star.style.cssText = `
                left:${startX}vw; top:-10px;
                width:${length}px;
                --angle:${angle}deg;
                animation-duration:${dur}s;
                animation-delay:${delay}s;
                transform:rotate(${angle}deg);
            `;
            overlay.appendChild(star);
            setTimeout(() => star.remove(), (dur + delay + 0.2) * 1000);
        }

        // 다음 스폰: 1~3초 랜덤
        const next = Math.random() * 2000 + 1000;
        _shootingStarTimer = setTimeout(spawnStar, next);
    }
    spawnStar();
}

function stopSurveyShootingStars() {
    clearTimeout(_shootingStarTimer);
    _shootingStarTimer = null;
}

// ── HTML 뼈대 ────────────────────────────────────────
function buildSurveyHTML() {
    // 별 배경 (createStars와 동일 방식)
    let starsHtml = '';
    for (let i = 0; i < 60; i++) {
        const x    = Math.random() * 100;
        const y    = Math.random() * 100;
        const size = Math.random() * 2 + 0.5;
        const dur  = Math.random() * 4 + 2;
        const del  = Math.random() * 3;
        starsHtml += `<div class="star" style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${del}s;"></div>`;
    }

    return `
        <div class="survey-stars">${starsHtml}</div>
        ${renderNavigation()}
        <div class="survey-box">
            <div class="survey-header">
                <div class="survey-title">🛸 외계 연구원의 스트레스 진단</div>
                <div class="survey-progress-wrap">
                    <div class="survey-progress-bar">
                        <div class="survey-progress-fill" id="surveyProgressFill"></div>
                    </div>
                    <div class="survey-progress-text" id="surveyProgressText">1 / 3</div>
                </div>
            </div>
            <div class="survey-content" id="surveyContent"></div>
            <div class="survey-footer">
                <button class="survey-btn-prev" id="surveyBtnPrev" onclick="surveyPrev()" style="opacity:0;pointer-events:none;">← 이전</button>
                <button class="survey-btn-next" id="surveyBtnNext" onclick="surveyNext()" disabled>다음 →</button>
            </div>
        </div>
    `;
}

// ── 페이지 렌더 ──────────────────────────────────────
function renderSurveyPage() {
    const page    = surveyPages[surveyPage];
    const content = document.getElementById('surveyContent');
    const fill    = document.getElementById('surveyProgressFill');
    const pt      = document.getElementById('surveyProgressText');
    const btn     = document.getElementById('surveyBtnNext');
    const prevBtn = document.getElementById('surveyBtnPrev');

    if (fill) fill.style.width = ((surveyPage + 1) / surveyPages.length * 100) + '%';
    if (pt)   pt.textContent  = `${surveyPage + 1} / ${surveyPages.length}`;
    if (btn)  {
        btn.textContent = surveyPage === surveyPages.length - 1 ? '결과 보기 🚀' : '다음 →';
        btn.disabled = true;
    }
    // 이전 버튼: 1페이지면 숨김, 2페이지부터 표시
    if (prevBtn) {
        prevBtn.style.opacity       = surveyPage > 0 ? '1' : '0';
        prevBtn.style.pointerEvents = surveyPage > 0 ? 'all' : 'none';
    }

    // ── 카드 페이지 ──
    if (page.type === 'card-page') {
        content.innerHTML = page.questions.map((q, qi) => `
            <div class="survey-q-block">
                <div class="survey-question">${q.q}</div>
                <div class="survey-cards" id="surveyCards${qi}">
                    ${q.options.map((opt, oi) => `
                        <button class="survey-card" onclick="selectCardPage(${qi}, ${oi}, ${opt.value})" id="surveyCard${qi}_${oi}">
                            ${opt.label}
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // 저장된 값 복원
        page.questions.forEach((q, qi) => {
            if (surveyAnswers[q.key] !== undefined) {
                const oi = q.options.findIndex(o => o.value === surveyAnswers[q.key]);
                if (oi >= 0) document.getElementById(`surveyCard${qi}_${oi}`)?.classList.add('selected');
            }
        });
        checkCardPageDone();

    // ── 슬라이더 페이지 ──
    } else if (page.type === 'slider-page') {
        content.innerHTML = page.questions.map((q, qi) => {
            const saved = surveyAnswers[q.key] ?? q.default;
            return `
                <div class="survey-q-block">
                    <div class="survey-question">${q.q}</div>
                    <div class="survey-slider-wrap">
                        <input type="range" min="${q.min}" max="${q.max}" value="${saved}"
                               class="survey-slider" id="surveySlider${qi}"
                               oninput="onSliderPageChange(${qi}, this.value)">
                        <div class="survey-slider-labels">
                            <span>1 😌</span><span>5 😐</span><span>10 🤯</span>
                        </div>
                        <div class="survey-slider-value" id="surveySliderVal${qi}">${saved}</div>
                    </div>
                </div>
            `;
        }).join('');

        // 기본값 저장
        page.questions.forEach(q => {
            if (surveyAnswers[q.key] === undefined) surveyAnswers[q.key] = q.default;
        });
        if (btn) btn.disabled = false;

    // ── 텍스트 페이지 ──
    } else if (page.type === 'text-page') {
        content.innerHTML = page.questions.map((q, qi) => {
            const saved = surveyAnswers[q.key] ?? '';
            return `
                <div class="survey-q-block">
                    <div class="survey-question">${q.q}</div>
                    <input type="text" class="survey-text-input" id="surveyText${qi}"
                           placeholder="${q.placeholder}" value="${saved}"
                           oninput="onTextPageChange(${qi}, this.value); AudioManager.playTyping();" maxlength="30">
                </div>
            `;
        }).join('');

        checkTextPageDone();
        setTimeout(() => document.getElementById('surveyText0')?.focus(), 50);
    }
}

// ── 카드 선택 ────────────────────────────────────────
function selectCardPage(qi, oi, value) {
    const page = surveyPages[surveyPage];
    // 같은 질문 내 다른 카드 선택 해제
    page.questions[qi].options.forEach((_, i) => {
        document.getElementById(`surveyCard${qi}_${i}`)?.classList.remove('selected');
    });
    document.getElementById(`surveyCard${qi}_${oi}`)?.classList.add('selected');
    surveyAnswers[page.questions[qi].key] = value;
    checkCardPageDone();
}

function checkCardPageDone() {
    const page = surveyPages[surveyPage];
    const allAnswered = page.questions.every(q => surveyAnswers[q.key] !== undefined);
    const btn = document.getElementById('surveyBtnNext');
    if (btn) btn.disabled = !allAnswered;
}

// ── 슬라이더 변경 ────────────────────────────────────
function onSliderPageChange(qi, val) {
    const page = surveyPages[surveyPage];
    const el   = document.getElementById(`surveySliderVal${qi}`);
    if (el) el.textContent = val;
    surveyAnswers[page.questions[qi].key] = parseInt(val);
}

// ── 텍스트 변경 ──────────────────────────────────────
function onTextPageChange(qi, val) {
    const page = surveyPages[surveyPage];
    surveyAnswers[page.questions[qi].key] = val;
    checkTextPageDone();
}

function checkTextPageDone() {
    const page = surveyPages[surveyPage];
    // 텍스트는 둘 다 입력해야 다음 가능
    const allFilled = page.questions.every(q => (surveyAnswers[q.key] ?? '').trim().length > 0);
    const btn = document.getElementById('surveyBtnNext');
    if (btn) btn.disabled = !allFilled;
}

// ── 이전 버튼 ────────────────────────────────────────
function surveyPrev() {
    if (surveyPage > 0) {
        surveyPage--;
        renderSurveyPage();
    }
}

// ── 다음 버튼 ────────────────────────────────────────
function surveyNext() {
    if (surveyPage < surveyPages.length - 1) {
        // 슬라이더 페이지(index 1) 완료 후 점수 미리 계산
        if (surveyPage === 1) {
            const mood   = surveyAnswers.mood   ?? 0;
            const mind   = surveyAnswers.mind   ?? 0;
            const stress = ((surveyAnswers.stress ?? 5) - 1) / 9 * 100;
            const tired  = ((surveyAnswers.tired  ?? 5) - 1) / 9 * 100;
            const preview = Math.round(mood * 0.25 + mind * 0.25 + stress * 0.30 + tired * 0.20);
            if (preview < 40) {
                // 40 미만 → 텍스트 페이지 건너뛰고 바로 분석
                submitSurvey();
                return;
            }
        }
        surveyPage++;
        renderSurveyPage();
    } else {
        submitSurvey();
    }
}

// ── 제출 & 분석 ──────────────────────────────────────
function submitSurvey() {
    // 듣고 싶은 말 → 미니외계인 말풍선 메시지로 저장
    if (surveyAnswers.cheer && surveyAnswers.cheer.trim()) {
        window._miniAlienMessages = surveyAnswers.cheer
            .split(/[,，、\n]/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }
    // 스트레스 지수 계산
    const mood   = surveyAnswers.mood   ?? 0;
    const mind   = surveyAnswers.mind   ?? 0;
    const stress = ((surveyAnswers.stress ?? 5) - 1) / 9 * 100;
    const tired  = ((surveyAnswers.tired  ?? 5) - 1) / 9 * 100;
    stressScore  = Math.round(mood * 0.25 + mind * 0.25 + stress * 0.30 + tired * 0.20);

    stopSurveyShootingStars();

    const content = document.getElementById('surveyContent');
    const footer  = document.querySelector('.survey-footer');
    const header  = document.querySelector('.survey-header');
    if (footer) footer.style.display = 'none';
    if (header) header.style.display = 'none';

    content.innerHTML = `
        <div class="survey-analyzing">
            <div class="survey-ufo">🛸</div>
            <div class="survey-analyzing-text" id="surveyAnalyzingText">외계 연구원이 분석 중...</div>
            <div class="survey-scan-bar-wrap">
                <div class="survey-scan-bar" id="surveyScanBar"></div>
            </div>
        </div>
    `;

    const bar  = document.getElementById('surveyScanBar');
    const msgs = ['외계 연구원이 분석 중...', '뇌파 스캔 중... 🧠', '스트레스 입자 감지 중... ⚡', '데이터 집계 완료... 📡'];
    let mi = 0;
    const msgInterval = setInterval(() => {
        mi++;
        const el = document.getElementById('surveyAnalyzingText');
        if (el && msgs[mi]) el.textContent = msgs[mi];
    }, 600);

    let prog = 0;
    const barInterval = setInterval(() => {
        prog = Math.min(100, prog + Math.random() * 12 + 3);
        if (bar) bar.style.width = prog + '%';
        if (prog >= 100) {
            clearInterval(barInterval);
            clearInterval(msgInterval);
            setTimeout(() => showSurveyResult(), 400);
        }
    }, 80);
}

function showSurveyResult() {
    const content = document.getElementById('surveyContent');
    const isLow   = stressScore < 40;

    if (isLow) {
        content.innerHTML = `
            <div class="survey-result happy">
                <div class="survey-result-emoji">🌈</div>
                <div class="survey-result-score">스트레스 지수 <span>${stressScore}%</span></div>
                <div class="survey-result-title">당신은 행복한 인간!</div>
                <div class="survey-result-desc">
                    계속 행복하게 살기를 바랍니다.<br/>
                    스트레스가 쌓일 때 우주 힐링 센터를 방문해주세요.<br/>
                    당신의 스트레스를 해소시켜 드릴게요 🛸
                </div>
                <button class="survey-btn-close" onclick="closeSurvey()">돌아가기</button>
            </div>
        `;
    } else {
        // 40% 초과 → 바로 인트로로
        startIntroWithScore();
    }
}

function closeSurvey() {
    stopSurveyShootingStars();
    const overlay = document.getElementById('surveyOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 400);
}

function startIntroWithScore() {
    stopSurveyShootingStars();
    const overlay = document.getElementById('surveyOverlay');
    if (overlay) overlay.remove();   // 애니메이션 없이 즉시 제거
    navigateTo('intro');
    setTimeout(() => {
        const el = document.getElementById('introWarningLevel');
        if (el) el.textContent = `⚠ 스트레스 위험 지수 감지 ${stressScore}% ⚠`;
    }, 100);
}

/* ==========================================================================
 * 8. HUB PAGE — 라운지 (6개 게임이 배치된 우주선 내부)
 * ========================================================================== */
function renderHubPage() {
    return `
        <style>
            /* ── 이동 버튼 네온 펄스 + 바운스 ── */
            @keyframes neonPulse {
                0%   { box-shadow: 0 0 8px 2px rgba(166,243,230,0.3), 0 0 20px 4px rgba(166,243,230,0.15); }
                50%  { box-shadow: 0 0 22px 6px rgba(166,243,230,0.8), 0 0 50px 10px rgba(166,243,230,0.4); }
                100% { box-shadow: 0 0 8px 2px rgba(166,243,230,0.3), 0 0 20px 4px rgba(166,243,230,0.15); }
            }
            @keyframes btnBounce {
                0%,100% { transform: translateX(-50%) translateY(0px); }
                30%     { transform: translateX(-50%) translateY(-10px); }
                50%     { transform: translateX(-50%) translateY(-14px); }
                70%     { transform: translateX(-50%) translateY(-10px); }
            }
            .hub-nav-btn {
                position: absolute;
                font-family: 'Jua', sans-serif;
                font-size: 1rem;
                letter-spacing: 2px;
                padding: 14px 40px;
                border: none;
                border-radius: 50px;
                cursor: pointer;
                z-index: 60;
                background: linear-gradient(135deg, #a6f3e6, #b8f5ff);
                color: #0a0520;
                animation: btnBounce 1.4s ease-in-out infinite, neonPulse 2s ease-in-out infinite;
                transition: box-shadow 0.18s ease;
            }
            .hub-nav-btn:hover {
                animation: none;
                transform: translateX(-50%) scale(1.1) translateY(-3px);
                box-shadow: 0 0 42px rgba(166,243,230,0.9), 0 0 80px rgba(166,243,230,0.5) !important;
            }
        </style>
        <div id="hubWrapper" style="position:relative;width:100%;height:100%;background:#0a0a1a;overflow:hidden;">
            <canvas id="hubCanvas" style="position:absolute;inset:0;display:block;"></canvas>
            ${renderNavigation()}

            ${selectedGame ? renderGameModal() : ''}
        </div>
    `;
}

function initHubCanvas() {
    const canvas = document.getElementById('hubCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 사용자가 만든 행성 이미지 프리로드 (최대 3개)
    window._hubPlanetImgs = [];
    appState.planets.forEach((p, i) => {
        const img = new Image();
        img.src = p.canvasData;
        window._hubPlanetImgs[i] = img;
    });

    // ── 캐릭터 이미지 로딩 ──
    const charImgIdle  = new Image();
    const charImgWalk1 = new Image();
    const charImgWalk2 = new Image();
    charImgIdle.src  = 'assets/character/idle.png';
    charImgWalk1.src = 'assets/character/walk1.png';
    charImgWalk2.src = 'assets/character/walk2.png';

    // ── 곰인형 / 나무 이미지 로딩 ──
    window._bearImg = new Image();
    window._bearImg.src = 'assets/bear.png';

    // ── 캔들 이미지 로딩 ──
    window._candleImgs = [];
    for (let ci = 1; ci <= 4; ci++) {
        const img = new Image();
        img.src = `assets/candle${ci}.png`;
        window._candleImgs.push(img);
    }

    // ── 캐릭터 상태 ──
    // 옆 이미지는 "오른쪽"을 보고 있음
    //   → 오른쪽으로 이동: 그대로 그림
    //   → 왼쪽으로 이동:   좌우반전(scale(-1,1))해서 그림
    const character = {
        wx: 0, wy: 0,           // 현재 월드 좌표
        targetWx: 0,            // 클릭한 목표 월드 X
        targetWy: 0,            // 클릭한 목표 화면 Y
        speed: 5.25,             // 픽셀 / frame (기존 3.5 × 1.5배)
        moving: false,
        flipH: false,           // true면 좌우반전 (왼쪽으로 이동 중)
        walkFrame: 0,           // 0 또는 1 (옆1 / 옆2 번갈아)
        walkTimer: 0,           // 프레임 카운터
        walkInterval: 10,       // 몇 프레임마다 walkFrame 토글할지
        size: 350               // 화면에 그릴 캐릭터 키(px)
    };

    // World is 2x viewport wide
    const WORLD_W_FACTOR = 2;
    let scrollX = 0;
    let targetScrollX = 0;
    let time = 0;        // 애니메이션 프레임 카운터
    let animId = null;   // requestAnimationFrame ID


    const CLIP_LEFT  = 250;
    const CLIP_RIGHT = 300;

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        // 리사이즈 시에도 가운데 유지
        // scrollX 범위: CLIP_LEFT ~ (maxScroll - CLIP_RIGHT) 로 제한
        const maxScroll = canvas.width * (WORLD_W_FACTOR - 1);
        scrollX = targetScrollX = maxScroll / 2;

        // 캐릭터를 월드 정중앙(=처음에 보이는 화면의 중앙) 바닥에 배치
        const worldW = canvas.width * WORLD_W_FACTOR;
        if (character.wx === 0 && character.wy === 0) {
            character.wx = worldW / 2;
            character.wy = canvas.height * 0.90;   // 약간 아래쪽(바닥)
            character.targetWx = character.wx;
            character.targetWy = character.wy;
        }
    }
    resize();
    window.addEventListener('resize', resize);
    // 미니외계인 초기 위치 설정 (canvas 크기 확정 후)
    setTimeout(() => initMiniAlien(), 0);


    // Scroll input — 마우스 휠 세로 스크롤만 받아서 오른쪽으로 이동
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        targetScrollX += e.deltaY * 1.4;
        const maxScroll = canvas.width * (WORLD_W_FACTOR - 1);
        targetScrollX = Math.max(CLIP_LEFT, Math.min(maxScroll - CLIP_RIGHT, targetScrollX));
    }, { passive: false });

    let touchStartX = 0, touchScrollStart = 0;
    canvas.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchScrollStart = scrollX;
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        const dx = touchStartX - e.touches[0].clientX;
        const maxScroll = canvas.width * (WORLD_W_FACTOR - 1);
        targetScrollX = Math.max(CLIP_LEFT, Math.min(maxScroll - CLIP_RIGHT, touchScrollStart + dx * 1.5));
    }, { passive: false });

    // ── 캐릭터 드래그 상태 ──
    let charDragging = false;
    let charDragOffX = 0, charDragOffY = 0;

    function isOverCharacter(worldX, screenY) {
        const h = character.size;
        const img = charImgIdle;
        const w = (img.complete && img.naturalWidth) ? img.naturalWidth * (h / img.naturalHeight) : h * 0.6;
        const cx = character.wx, cy = character.wy;
        return worldX >= cx - w/2 && worldX <= cx + w/2 && screenY >= cy - h && screenY <= cy;
    }

    function isOverMiniAlien(worldX, screenY) {
        const s = MINI_SIZE;
        const img = miniAlienImg;
        const w = (img.complete && img.naturalWidth) ? img.naturalWidth * (s / img.naturalHeight) : s;
        return worldX >= miniAlien.wx - w/2 && worldX <= miniAlien.wx + w/2
            && screenY >= miniAlien.wy - s && screenY <= miniAlien.wy;
    }

    canvas.addEventListener('mousedown', e => {
        if (selectedGame) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const worldX = mx + scrollX;
        // 미니외계인 먼저 체크 (작아서 캐릭터보다 우선)
        if (isOverMiniAlien(worldX, my)) {
            miniAlien.dragging = true;
            miniAlien.dragOffX = worldX - miniAlien.wx;
            miniAlien.dragOffY = my - miniAlien.wy;
            canvas.style.cursor = 'grabbing';
            return;
        }
        // 캐릭터 드래그
        if (isOverCharacter(worldX, my)) {
            charDragging = true;
            charDragOffX = worldX - character.wx;
            charDragOffY = my - character.wy;
            character.moving = false;
            canvas.style.cursor = 'grabbing';
        }
    });

    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        window._hubMouseX = mx + scrollX;
        window._hubMouseY = my;
        if (miniAlien.dragging) {
            const t = Date.now();
            const wobbleX = Math.sin(t * 0.05) * 10 + Math.sin(t * 0.017) * 5;
            const wobbleY = Math.cos(t * 0.04) * 7 + Math.sin(t * 0.023) * 3;
            miniAlien.wx = mx + scrollX - miniAlien.dragOffX + wobbleX;
            miniAlien.wy = my - miniAlien.dragOffY + wobbleY;
        } else if (charDragging) {
            const t = Date.now();
            const wobbleX = Math.sin(t * 0.05) * 12 + Math.sin(t * 0.031) * 6;
            const wobbleY = Math.cos(t * 0.04) * 8 + Math.sin(t * 0.027) * 4;
            character.wx = mx + scrollX - charDragOffX + wobbleX;
            character.wy = my - charDragOffY + wobbleY;
            character.moving = false;
        } else {
            if (isOverCharacter(mx + scrollX, my) || isOverMiniAlien(mx + scrollX, my)) {
                canvas.style.cursor = 'grab';
            } else {
                canvas.style.cursor = 'default';
            }
        }
    });

    canvas.addEventListener('mouseup', e => {
        if (miniAlien.dragging) {
            miniAlien.dragging = false;
            miniAlien.targetWx = miniAlien.wx;
            miniAlien.targetWy = miniAlien.wy;
            canvas.style.cursor = 'default';
            pickNewMiniTarget();
        }
        if (charDragging) {
            charDragging = false;
            canvas.style.cursor = 'default';
        }
    });

    canvas.addEventListener('mouseleave', () => {
        charDragging = false;
        miniAlien.dragging = false;
        window._hubMouseX = undefined;
        window._hubMouseY = undefined;
    });

    // ── 미니외계인 이미지 로딩 ──
    const miniAlienImg = new Image();
    miniAlienImg.src = 'assets/character/미니외계인.png';

    // ── 미니외계인 상태 ──
    const MINI_SIZE = Math.round(350 / 3);
    const miniAlien = {
        wx: 0, wy: 0,
        vx: 0, vy: 0,
        speed: 1.8,
        moveMode: 'walk',
        targetWx: 0, targetWy: 0,
        speechText: '',
        speechVisible: false,
        speechTimer: 0,
        speechPhase: 'show',
        SHOW_FRAMES: 180,
        WAIT_FRAMES: 300,
        msgIdx: 0,
        gravity: 0.18,
        bounceVy: -7,
        onGround: false,
        rotation: 0,
        dragging: false,
        dragOffX: 0, dragOffY: 0,
        arrived: true,
        modeTimer: 0,
        WAYPOINT_FRAMES: 220,
    };

    function initMiniAlien() {
        const worldW = canvas.width * WORLD_W_FACTOR;
        const H = canvas.height;
        miniAlien.wx = worldW * 0.45;
        miniAlien.wy = H * 0.82;
        miniAlien.targetWx = worldW * 0.55;
        miniAlien.targetWy = H * 0.82;
        pickNewMiniTarget();
    }

    function pickNewMiniTarget() {
        const worldW = canvas.width * WORLD_W_FACTOR;
        const H = canvas.height;
        miniAlien.targetWx = worldW * (0.05 + Math.random() * 0.90);
        miniAlien.targetWy = H * (0.70 + Math.random() * 0.22);
        miniAlien.arrived = false;
        miniAlien.modeTimer = 0;
        const r = Math.random();
        if (r < 0.33)      miniAlien.moveMode = 'bounce';
        else if (r < 0.66) miniAlien.moveMode = 'roll';
        else               miniAlien.moveMode = 'walk';
        if (miniAlien.moveMode === 'bounce') miniAlien.vy = miniAlien.bounceVy;
    }

    function updateMiniAlien() {
        if (miniAlien.dragging) return;
        const H = canvas.height;
        const worldW = canvas.width * WORLD_W_FACTOR;
        const groundY = H * 0.88;
        const dx = miniAlien.targetWx - miniAlien.wx;
        const dy = miniAlien.targetWy - miniAlien.wy;
        const dist = Math.hypot(dx, dy);
        if (dist < 8 || miniAlien.modeTimer > miniAlien.WAYPOINT_FRAMES) {
            miniAlien.wx = Math.max(MINI_SIZE/2, Math.min(worldW - MINI_SIZE/2, miniAlien.wx));
            pickNewMiniTarget();
        }
        miniAlien.modeTimer++;
        const dirX = dx === 0 ? 0 : dx / Math.abs(dx);
        if (miniAlien.moveMode === 'bounce') {
            miniAlien.wx += dirX * miniAlien.speed * 1.4;
            miniAlien.vy += miniAlien.gravity;
            miniAlien.wy += miniAlien.vy;
            if (miniAlien.wy >= groundY) {
                miniAlien.wy = groundY;
                miniAlien.vy = miniAlien.bounceVy * (0.85 + Math.random() * 0.25);
                miniAlien.onGround = true;
            } else { miniAlien.onGround = false; }
        } else if (miniAlien.moveMode === 'roll') {
            miniAlien.wx += dirX * miniAlien.speed * 1.2;
            miniAlien.wy = groundY;
            miniAlien.rotation += dirX * 0.08;
        } else {
            if (dist > miniAlien.speed) {
                miniAlien.wx += (dx / dist) * miniAlien.speed;
                miniAlien.wy += (dy / dist) * miniAlien.speed;
            }
        }
        miniAlien.wx = Math.max(MINI_SIZE/2, Math.min(worldW - MINI_SIZE/2, miniAlien.wx));

        // ── 말풍선 타이머 ──
        const msgs = window._miniAlienMessages;
        if (msgs && msgs.length > 0) {
            miniAlien.speechTimer++;
            if (miniAlien.speechPhase === 'show') {
                miniAlien.speechVisible = true;
                miniAlien.speechText = msgs[miniAlien.msgIdx % msgs.length];
                if (miniAlien.speechTimer >= miniAlien.SHOW_FRAMES) {
                    miniAlien.speechPhase = 'wait';
                    miniAlien.speechTimer = 0;
                    miniAlien.speechVisible = false;
                }
            } else {
                miniAlien.speechVisible = false;
                if (miniAlien.speechTimer >= miniAlien.WAIT_FRAMES) {
                    miniAlien.speechPhase = 'show';
                    miniAlien.speechTimer = 0;
                    miniAlien.msgIdx = (miniAlien.msgIdx + 1) % msgs.length;
                }
            }
        }
    }

    function drawMiniAlien(scrollX) {
        if (!miniAlienImg.complete || miniAlienImg.naturalWidth === 0) return;
        const s = MINI_SIZE;
        const w = miniAlienImg.naturalWidth * (s / miniAlienImg.naturalHeight);
        const sx = miniAlien.wx - scrollX;
        const sy = miniAlien.wy;
        const facingLeft = miniAlien.targetWx < miniAlien.wx;
        ctx.save();
        ctx.translate(sx, sy);
        if (miniAlien.moveMode === 'roll') ctx.rotate(miniAlien.rotation);
        let scaleX = 1, scaleY = 1;
        if (miniAlien.moveMode === 'bounce') {
            const airRatio = Math.abs(miniAlien.vy) / Math.abs(miniAlien.bounceVy);
            scaleX = 1 + airRatio * 0.08;
            scaleY = 1 - airRatio * 0.08;
        }
        if (facingLeft) scaleX *= -1;
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(miniAlienImg, -w/2, -s, w, s);
        ctx.restore();

        // ── 말풍선 ──
        if (miniAlien.speechVisible && miniAlien.speechText) {
            const bx = sx, by = sy - s - 8;
            ctx.save();
            ctx.font = 'bold 13px "Jua", sans-serif';
            const textW = ctx.measureText(miniAlien.speechText).width;
            const padX = 10, padY = 7;
            const bw = textW + padX * 2;
            const bh = 26 + padY;
            const bLeft = bx - bw / 2;
            const bTop = by - bh;
            const r = 10;
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.strokeStyle = '#b8c8ff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bLeft + r, bTop);
            ctx.lineTo(bLeft + bw - r, bTop);
            ctx.quadraticCurveTo(bLeft + bw, bTop, bLeft + bw, bTop + r);
            ctx.lineTo(bLeft + bw, bTop + bh - r);
            ctx.quadraticCurveTo(bLeft + bw, bTop + bh, bLeft + bw - r, bTop + bh);
            ctx.lineTo(bx + 6, bTop + bh);
            ctx.lineTo(bx, bTop + bh + 8);
            ctx.lineTo(bx - 6, bTop + bh);
            ctx.lineTo(bLeft + r, bTop + bh);
            ctx.quadraticCurveTo(bLeft, bTop + bh, bLeft, bTop + bh - r);
            ctx.lineTo(bLeft, bTop + r);
            ctx.quadraticCurveTo(bLeft, bTop, bLeft + r, bTop);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#334';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(miniAlien.speechText, bx, bTop + bh / 2);
            ctx.restore();
        }
    }

    canvas.addEventListener('click', e => {
        if (selectedGame) return;
        if (charDragging) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left);
        const my = (e.clientY - rect.top);
        const worldX = mx + scrollX;
        const W = canvas.width, H = canvas.height;
        const worldW = W * WORLD_W_FACTOR;

        if (charDragging) return;
        if (isOverCharacter(worldX, my)) return;

        // 캐릭터 위 클릭 → 이동하지 않음 (드래그 전용)
        if (isOverCharacter(worldX, my)) return;

        // 🌍 지구로 귀환 버튼 클릭 (스트레스 40% 이하일 때만)
        if (window._earthReturnBtn && stressScore <= 40) {
            const b = window._earthReturnBtn;
            const bScreenX = b.x - scrollX;
            if (mx >= bScreenX && mx <= bScreenX + b.w && my >= b.y && my <= b.y + b.h) {
                cancelAnimationFrame(animId);
                window.removeEventListener('resize', resize);
                navigateTo('ending');
                return;
            }
        }

        // 0) 첫번째 사용자 행성 클릭 → 식물 페이지 (로딩 화면 경유)
        if (window._userPlanetHitBoxes) {
            for (const hp of window._userPlanetHitBoxes) {
                if (hp.idx === 0) {
                    const dx = mx - hp.cx, dy = my - hp.cy;
                    if (Math.sqrt(dx*dx + dy*dy) < hp.pr + 8) {
                        cancelAnimationFrame(animId);
                        window.removeEventListener('resize', resize);
                        startGameWithLoading('plant');
                        return;
                    }
                }
            }
        }

        // 1) 삼각 플라스크(작업대) 클릭 → 행성창조
        {
            const benchWorldX = W * 0.42 + 800; // drawLabBench의 worldX (leftPanel 이동 반영)
            // 실제 drawLabBench worldX = W * 0.42 (이동 없음)
            const benchWorldX2 = W * 0.42;
            const bscreenX = benchWorldX2 - scrollX;
            // 삼각 플라스크는 작업대 왼쪽: bx - benchW * 0.35
            const benchW = W * 0.36;
            const flaskX = bscreenX - benchW * 0.35;
            const flaskScreenX = flaskX;
            const flaskScreenY = H * 0.72 - H * 0.13 / 2;
            if (Math.abs(mx - flaskScreenX) < 40 && Math.abs(my - flaskScreenY) < 60) {
                cancelAnimationFrame(animId);
                window.removeEventListener('resize', resize);
                startGameWithLoading('paint');
                return;
            }
        }

        // 2) 작은 화분 클릭 → 격투실 (식물+화분 전체 영역)
        {
            const potWorldX = worldW * 0.25 + 400;
            const potScreenX = potWorldX - scrollX;
            const potBaseY = H * 0.78;
            const potH = H * 0.07;
            // 화분 바닥부터 잎사귀 꼭대기(baseY - potH*3.5)까지 전체 감지
            if (Math.abs(mx - potScreenX) < 60 &&
                my >= potBaseY - potH * 3.5 && my <= potBaseY + potH) {
                cancelAnimationFrame(animId);
                window.removeEventListener('resize', resize);
                startGameWithLoading('shooting');
                return;
            }
        }

        // 3) 벽거울 클릭 → 심리실
        {
            const mirWorldX = worldW * 0.75 + 265;
            const mirScreenX = mirWorldX - scrollX;
            const mirScreenY = H * 0.42 + 50;
            const mirW = W * 0.10, mirH = H * 0.32;
            if (Math.abs(mx - mirScreenX) < mirW/2 + 10 && Math.abs(my - mirScreenY) < mirH/2 + 10) {
                cancelAnimationFrame(animId);
                window.removeEventListener('resize', resize);
                startGameWithLoading('mirror');
                return;
            }
        }

        // 4) 곰인형 클릭 → 뽁뽁이
        if (window._bearHitBox) {
            const b = window._bearHitBox;
            if (Math.abs(mx - b.cx) < b.w/2 + 10 && Math.abs(my - b.cy) < b.h/2 + 10) {
                cancelAnimationFrame(animId);
                window.removeEventListener('resize', resize);
                startGameWithLoading('bubble');
                return;
            }
        }

        // 5) 홀로그램 행성 클릭 → 명상실
        {
            const hologramWorldX = worldW * 0.70;
            const hologramScreenX = hologramWorldX - scrollX;
            const r = W * 0.07;
            const baseY = H * 0.76;
            const cy = baseY - r * 1.6;
            if (Math.abs(mx - hologramScreenX) < r + 10 && Math.abs(my - cy) < r + 15) {
                cancelAnimationFrame(animId);
                window.removeEventListener('resize', resize);
                startGameWithLoading('breathing');
                return;
            }
        }

        // 5-C) 캔들2 클릭 → 불멍 페이지
        if (window._candleHitBoxes) {
            for (const cb of window._candleHitBoxes) {
                if (mx >= cb.x && mx <= cb.x + cb.w && my >= cb.y && my <= cb.y + cb.h) {
                    if (cb.idx === 1) {   // 캔들 2 (index 1)
                        cancelAnimationFrame(animId);
                        window.removeEventListener('resize', resize);
                        startGameWithLoading('bonfire');
                        return;
                    }
                }
            }
        }

        // 6) 빈 공간 클릭 → 캐릭터를 그곳으로 이동
        character.targetWx = worldX;
        // 캐릭터 높이보다 위로 올라갈 수 없음: 최소 Y = character.size - 10
        character.targetWy = Math.max(character.size - 10, my);
        character.moving = true;
        character.flipH = (worldX < character.wx);
    });

    // ── Hub buttons removed (오브젝트 클릭으로 대체) ──
    let hubButtons = [];
    function layoutButtons() {}
    window.addEventListener('resize', layoutButtons);

    // ── Drawing helpers ──
    function lerp(a, b, t) { return a + (b-a)*t; }
    function ease(t) { return t<0.5?2*t*t:-1+(4-2*t)*t; }

    // Stars (parallax layers)
    const starLayers = [
        Array.from({length:120}, () => ({ x:Math.random(), y:Math.random()*0.65, r:Math.random()*1+0.3, twinkle:Math.random()*Math.PI*2, spd:Math.random()*0.02+0.005 })),
        Array.from({length:60},  () => ({ x:Math.random(), y:Math.random()*0.6,  r:Math.random()*1.5+0.5, twinkle:Math.random()*Math.PI*2, spd:Math.random()*0.03+0.01 })),
    ];

    function drawStars(worldW, scrollX) {
        const W = canvas.width, H = canvas.height;
        // Layer 0 – slow parallax (bg stars)
        starLayers[0].forEach(s => {
            s.twinkle += s.spd;
            const op = (Math.sin(s.twinkle)*0.3+0.7)*0.6;
            const sx = (s.x * worldW - scrollX * 0.3) % worldW;
            const x = ((sx % W) + W) % W;
            ctx.beginPath();
            ctx.arc(x, s.y * H * 0.72, s.r, 0, Math.PI*2);
            ctx.fillStyle = `rgba(200,220,255,${op})`;
            ctx.fill();
        });
        // Layer 1 – medium parallax
        starLayers[1].forEach(s => {
            s.twinkle += s.spd;
            const op = (Math.sin(s.twinkle)*0.4+0.6)*0.9;
            const sx = (s.x * worldW - scrollX * 0.55) % worldW;
            const x = ((sx % W) + W) % W;
            ctx.beginPath();
            ctx.arc(x, s.y * H * 0.68, s.r, 0, Math.PI*2);
            ctx.fillStyle = `rgba(220,235,255,${op})`;
            ctx.fill();
        });
    }

    // ── DRAW: Space outside window ──
    function drawSpaceWindow(wx, W, H, scrollX, time) {
        // The big rounded window — 월드 한가운데에 고정
        // (wx = 월드 전체 폭. 가운데로 스크롤할 때만 화면 중앙에 보임)
        const winW = W * 0.70;
        const winH = H * 0.60;
        const worldCenterX = wx / 2;                        // 월드의 가로 정중앙
        const winLeft = worldCenterX - scrollX - winW / 2;  // 카메라(scrollX) 변환
        const winTop  = H * 0.04;

        // Space inside window
        ctx.save();
        ctx.beginPath();
        roundRectPath(ctx, winLeft, winTop, winW, winH, 40);
        ctx.clip();

        // Space gradient
        const spaceGrad = ctx.createLinearGradient(0, 0, 0, H*0.65);
        spaceGrad.addColorStop(0, '#06051a');
        spaceGrad.addColorStop(0.5, '#0d0a2e');
        spaceGrad.addColorStop(1, '#120c38');
        ctx.fillStyle = spaceGrad;
        ctx.fillRect(winLeft, winTop, winW, winH);

        // Stars inside window
        drawStars(wx, scrollX);

        // 사용자가 만든 행성 3개 — 창문 안 각각 다른 위치에 표시
        const _userPlanetPos = [
            { wx: 0.25, wy: 0.22 },  // 좌상단
            { wx: 0.65, wy: 0.30 },  // 우중단
            { wx: 0.42, wy: 0.62 },  // 중하단
        ];
        const _userGlow = [
            'rgba(125,255,200,', 'rgba(184,245,255,', 'rgba(212,181,255,',
        ];
        const _userPlanetImgs = window._hubPlanetImgs || [];
        if (_userPlanetImgs.length === 0) {
            // 행성 미완성 시 기본 placeholder 행성 표시
            drawPlanet(winLeft + winW*0.25, winTop + winH*0.22, W*0.055, '#8b4a6e', '#c47a9b', '#6b2a4e');
            drawAsteroid(winLeft + winW*0.65, winTop + winH*0.30, W*0.025);
            drawAsteroid(winLeft + winW*0.42, winTop + winH*0.62, W*0.03);
        } else {
            const pr = Math.min(winW * 0.10, W * 0.065);
            window._userPlanetHitBoxes = [];
            _userPlanetImgs.forEach((img, idx) => {
                if (!img || !img.complete || !img.naturalWidth) return;
                const pos = _userPlanetPos[idx];
                const cx = winLeft + winW * pos.wx;
                // 행성1(idx=0) hover 바운스
                const p1WorldX = cx + scrollX;
                const p1ScreenY = winTop + winH * pos.wy;
                const isP1Hover = idx === 0 && window._hubMouseX !== undefined &&
                    Math.abs(window._hubMouseX - p1WorldX) < pr + 20 &&
                    window._hubMouseY !== undefined &&
                    Math.abs(window._hubMouseY - p1ScreenY) < pr + 20;
                const p1Bounce = isP1Hover ? Math.sin(time * 0.18) * 9 : 0;
                const cy = winTop  + winH * pos.wy + Math.sin(time * 0.04 + idx * 1.5) * 5 + p1Bounce;
                // glow
                ctx.save();
                ctx.globalAlpha = 0.35 + Math.sin(time * 0.05 + idx) * 0.1;
                const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr * 1.8);
                gl.addColorStop(0, _userGlow[idx] + '0.55)');
                gl.addColorStop(1, _userGlow[idx] + '0)');
                ctx.fillStyle = gl;
                ctx.beginPath(); ctx.arc(cx, cy, pr * 1.8, 0, Math.PI*2); ctx.fill();
                ctx.restore();
                // 행성 이미지 (원형 클립)
                ctx.save();
                ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI*2); ctx.clip();
                ctx.drawImage(img, cx - pr, cy - pr, pr * 2, pr * 2);
                ctx.restore();
                // 테두리
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI*2); ctx.stroke();
                window._userPlanetHitBoxes.push({ idx, cx, cy, pr });
            });
        }
        // Nebula wisps
        ctx.globalAlpha = 0.08;
        const nebGrad = ctx.createRadialGradient(winLeft+winW*0.6, winTop+winH*0.4, 0, winLeft+winW*0.6, winTop+winH*0.4, winW*0.4);
        nebGrad.addColorStop(0, 'rgba(160,80,255,1)');
        nebGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = nebGrad;
        ctx.fillRect(winLeft, winTop, winW, winH);
        ctx.globalAlpha = 1;

        ctx.restore();

        // Window frame
        ctx.save();
        ctx.beginPath();
        roundRectPath(ctx, winLeft-6, winTop-6, winW+12, winH+12, 46);
        ctx.strokeStyle = '#4a4870';
        ctx.lineWidth = 12;
        ctx.stroke();
        // Inner frame highlight
        ctx.beginPath();
        roundRectPath(ctx, winLeft-2, winTop-2, winW+4, winH+4, 42);
        ctx.strokeStyle = 'rgba(130,120,200,0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // Moonscape/ground ridge at bottom of window
        ctx.save();
        ctx.beginPath();
        roundRectPath(ctx, winLeft, winTop, winW, winH, 40);
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(winLeft, winTop+winH);
        const ridgeSegs = 20;
        for (let i=0; i<=ridgeSegs; i++) {
            const rx = winLeft + (i/ridgeSegs)*winW;
            const noise = Math.sin(i*1.7)*12 + Math.sin(i*0.9+1)*8;
            ctx.lineTo(rx, winTop+winH*0.82 + noise);
        }
        ctx.lineTo(winLeft+winW, winTop+winH);
        ctx.closePath();
        ctx.fillStyle = '#1c1838';
        ctx.fill();
        ctx.restore();
    }

    function drawPlanet(x, y, r, base, highlight, shadow) {
        const grad = ctx.createRadialGradient(x-r*0.3, y-r*0.3, r*0.1, x, y, r);
        grad.addColorStop(0, highlight);
        grad.addColorStop(0.5, base);
        grad.addColorStop(1, shadow);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI*2);
        ctx.fillStyle = grad;
        ctx.fill();
        // Craters
        ctx.save();
        ctx.globalAlpha = 0.25;
        [[0.3,0.2,0.18],[-0.2,0.35,0.12],[0.1,-0.15,0.09]].forEach(([cx2,cy2,cr]) => {
            ctx.beginPath();
            ctx.arc(x+cx2*r, y+cy2*r, cr*r, 0, Math.PI*2);
            ctx.strokeStyle = shadow;
            ctx.lineWidth = 2;
            ctx.stroke();
        });
        ctx.restore();
    }

    function drawAsteroid(x, y, r) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        const verts = 7;
        for (let i=0; i<verts; i++) {
            const a = (i/verts)*Math.PI*2;
            const rr = r*(0.8 + Math.sin(i*3.3)*0.2);
            const px = Math.cos(a)*rr;
            const py = Math.sin(a)*rr;
            if (i===0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#2d2848';
        ctx.fill();
        ctx.strokeStyle = '#3d3860';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    function roundRectPath(ctx, x, y, w, h, r) {
        ctx.moveTo(x+r, y);
        ctx.lineTo(x+w-r, y);
        ctx.arcTo(x+w, y, x+w, y+r, r);
        ctx.lineTo(x+w, y+h-r);
        ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
        ctx.lineTo(x+r, y+h);
        ctx.arcTo(x, y+h, x, y+h-r, r);
        ctx.lineTo(x, y+r);
        ctx.arcTo(x, y, x+r, y, r);
    }

    // ── DRAW: Spaceship floor & walls ──
    function drawShipInterior(W, H, scrollX) {
        // Floor — 밝은 아이보리/흰색 톤 (월드 전체 폭에 그리기)
        const worldW = W * 2;                   // WORLD_W_FACTOR(=2) * W
        const left  = 0 - scrollX;              // 월드 시작점의 화면 좌표
        const right = worldW - scrollX;         // 월드 끝점의 화면 좌표
        const floorY = H * 0.72;
        const floorGrad = ctx.createLinearGradient(0, floorY, 0, H);
        floorGrad.addColorStop(0, '#e8e6f0');
        floorGrad.addColorStop(0.4, '#d8d4e8');
        floorGrad.addColorStop(1, '#c8c4dc');
        ctx.fillStyle = floorGrad;
        ctx.beginPath();
        ctx.moveTo(left, floorY);
        ctx.lineTo(right, floorY);
        ctx.lineTo(right, H);
        ctx.lineTo(left, H);
        ctx.closePath();
        ctx.fill();

        // Floor edge highlight
        ctx.beginPath();
        ctx.moveTo(left, floorY);
        ctx.lineTo(right, floorY);
        ctx.strokeStyle = 'rgba(180,170,220,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Floor circle rug — 월드 한가운데에 고정
        ctx.save();
        const rugX = worldW/2 - scrollX;        // 월드 중앙 → 카메라 변환
        const rugRX = W*0.28, rugRY = H*0.055;
        ctx.beginPath();
        ctx.ellipse(rugX, floorY + H*0.12, rugRX, rugRY, 0, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(160,150,200,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(rugX, floorY + H*0.12, rugRX*0.85, rugRY*0.85, 0, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(160,150,200,0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Left wall — 월드 시작 부분에 고정
        const lwGrad = ctx.createLinearGradient(left, 0, left + W*0.18, 0);
        lwGrad.addColorStop(0,'#dddaf0');
        lwGrad.addColorStop(1,'rgba(221,218,240,0)');
        ctx.fillStyle = lwGrad;
        ctx.fillRect(left, 0, W*0.18, H);

        // Right wall — 월드 끝 부분에 고정
        const rwGrad = ctx.createLinearGradient(right - W*0.18, 0, right, 0);
        rwGrad.addColorStop(0,'rgba(221,218,240,0)');
        rwGrad.addColorStop(1,'#dddaf0');
        ctx.fillStyle = rwGrad;
        ctx.fillRect(right - W*0.18, 0, W*0.18, H);
    }

    // ── DRAW: Left control panel ──
    function drawLeftPanel(W, H, scrollX, time) {
        const worldX = W * 0.04 + 800;
        const px = worldX - scrollX;
        const panelW = W*0.145, panelH = H*0.58;
        const panelY = H*0.18;
        const scrX = px+8, scrY = panelY+28, scrW = panelW-16, scrH = panelH*0.28;
        ctx.fillStyle = '#0a1a2e';
        ctx.strokeStyle = '#2a4870';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        roundRectPath(ctx, scrX, scrY, scrW, scrH, 4);
        ctx.fill(); ctx.stroke();
        ctx.save(); ctx.globalAlpha = 0.3;
        for (let i=0; i<scrH; i+=4) {
            ctx.fillStyle = 'rgba(0,80,160,0.4)';
            ctx.fillRect(scrX, scrY+i, scrW, 1);
        }
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.7 + Math.sin(time*0.05)*0.15;
        ctx.fillStyle = '#00ff80';
        ctx.font = `bold ${Math.max(8,W*0.008)}px 'Courier New',monospace`;
        ctx.fillText('SYSTEM OK', scrX+8, scrY+18);
        ctx.fillStyle = '#4488ff';
        ctx.font = `${Math.max(7,W*0.007)}px 'Courier New',monospace`;
        ctx.fillText('LVL : ' + stressScore + '%', scrX+8, scrY+32);
        ctx.fillText('ENERGY: CRITICAL', scrX+8, scrY+44);
        ctx.restore();

        // 🌍 지구로 귀환 버튼 — LvL 텍스트 아래
        const btnW = scrW;
        const btnH = 28;
        const btnX = scrX;
        const btnY = scrY + scrH + 10;
        const canReturn = stressScore <= 40;
        const pulse = 0.7 + Math.sin(time * 0.08) * 0.25;
        ctx.save();
        if (canReturn) {
            ctx.fillStyle = `rgba(0,200,120,${0.15 + pulse * 0.1})`;
            ctx.strokeStyle = `rgba(0,255,150,${pulse})`;
        } else {
            ctx.fillStyle = 'rgba(80,80,80,0.15)';
            ctx.strokeStyle = 'rgba(120,120,120,0.4)';
        }
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        roundRectPath(ctx, btnX, btnY, btnW, btnH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = canReturn ? `rgba(0,255,170,${pulse})` : 'rgba(140,140,140,0.6)';
        ctx.font = `bold ${Math.max(9, W*0.009)}px 'Jua',sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(canReturn ? '🌍 지구로 귀환' : '🔒 스트레스 해소 필요', btnX + btnW/2, btnY + btnH/2);
        ctx.restore();

        window._earthReturnBtn = { x: btnX + scrollX, y: btnY, w: btnW, h: btnH };
    }
    // ── DRAW: Chair ──
    function drawChair(W, H, scrollX, time) {
        // 월드 우측(약 65% 지점)에 고정 → 가운데~오른쪽 사이에 등장
        const worldW = W * 2;
        const worldX = worldW * 0.65;
        const cx = worldX - scrollX;        // 카메라 변환
        const cy = H*0.72;
        const cw = W*0.07, ch = H*0.2;

        // Seat shadow
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.ellipse(cx, cy+8, cw*0.8, 10, 0, 0, Math.PI*2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();

        // Legs
        ctx.strokeStyle = '#2a2860';
        ctx.lineWidth = 4;
        [[-0.4,-0.1],[-0.4,0.9],[0.4,-0.1],[0.4,0.9]].forEach(([lx,ly]) => {
            ctx.beginPath();
            ctx.moveTo(cx+lx*cw, cy-ch*0.05);
            ctx.lineTo(cx+lx*cw*1.1, cy+ch*ly*0.2);
            ctx.stroke();
        });

        // Seat
        const seatGrad = ctx.createLinearGradient(cx-cw, cy-ch*0.05, cx-cw, cy+ch*0.1);
        seatGrad.addColorStop(0,'#3a3870');
        seatGrad.addColorStop(1,'#2a2860');
        ctx.fillStyle = seatGrad;
        ctx.beginPath();
        roundRectPath(ctx, cx-cw, cy-ch*0.05, cw*2, ch*0.14, 6);
        ctx.fill();

        // Back rest
        const backGrad = ctx.createLinearGradient(cx-cw*0.85, cy-ch, cx+cw*0.85, cy);
        backGrad.addColorStop(0,'#3a3870');
        backGrad.addColorStop(1,'#2a2860');
        ctx.fillStyle = backGrad;
        ctx.beginPath();
        roundRectPath(ctx, cx-cw*0.85, cy-ch, cw*1.7, ch*0.85, 8);
        ctx.fill();
        ctx.strokeStyle = '#4a4890';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Armrests
        [-1,1].forEach(side => {
            ctx.fillStyle = '#2a2860';
            ctx.beginPath();
            roundRectPath(ctx, cx+side*(cw*0.75), cy-ch*0.25, cw*0.22, ch*0.22, 4);
            ctx.fill();
        });

        // Headrest
        ctx.fillStyle = '#4a4890';
        ctx.beginPath();
        roundRectPath(ctx, cx-cw*0.45, cy-ch*1.02, cw*0.9, ch*0.18, 6);
        ctx.fill();
    }


    // ── DRAW: 추가 오브젝트 #1 — 작은 식물 화분 (왼쪽 영역) ──
    function drawPlantPot(W, H, scrollX, time) {
        const worldW = W * 2;
        const worldX = worldW * 0.25 + 400;
        const px = worldX - scrollX;
        const baseY = H * 0.78;
        const potW = W * 0.045, potH = H * 0.07;

        // hover 감지
        const mx = window._hubMouseX, my = window._hubMouseY;
        const hitR = potW * 1.2;
        const isHover = mx !== undefined &&
            mx >= worldX - hitR && mx <= worldX + hitR &&
            my >= baseY - potH * 3 && my <= baseY + potH;
        const bounceY = isHover ? Math.sin(time * 0.18) * 7 : 0;

        ctx.save();
        ctx.translate(0, bounceY);

        // 화분(사다리꼴 느낌)
        ctx.fillStyle = '#7a6a8e';
        ctx.beginPath();
        ctx.moveTo(px - potW/2, baseY);
        ctx.lineTo(px + potW/2, baseY);
        ctx.lineTo(px + potW*0.42, baseY + potH);
        ctx.lineTo(px - potW*0.42, baseY + potH);
        ctx.closePath();
        ctx.fill();
        // 화분 윗면 띠
        ctx.fillStyle = '#5e4f74';
        ctx.fillRect(px - potW/2, baseY, potW, 4);

        // 잎사귀 — 부드럽게 흔들림
        const sway = Math.sin(time * 0.03) * 2;
        ctx.fillStyle = '#6fa583';
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 + sway * 0.05;
            const lx = px + Math.cos(angle) * potW * 0.5;
            const ly = baseY - potH * 0.3 + Math.sin(angle) * potH * 0.3;
            ctx.beginPath();
            ctx.ellipse(lx, ly, potW * 0.28, potH * 0.18, angle, 0, Math.PI * 2);
            ctx.fill();
        }
        // 잎사귀 하이라이트
        ctx.fillStyle = 'rgba(180,230,190,0.5)';
        ctx.beginPath();
        ctx.ellipse(px, baseY - potH * 0.45, potW * 0.18, potH * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ── DRAW: 곰인형 (작은 화분 왼쪽) ──
    function drawBear(W, H, scrollX) {
        const worldW = W * 2;
        const worldX = worldW * 0.25 + 330 + 250 - 60;   // 60px 왼쪽
        const bx = worldX - scrollX;
        const baseY = H * 0.95 - 80;                       // 80px 위
        const bw = W * 0.07, bh = H * 0.1;
        if (!window._bearImg) return;
        const img = window._bearImg;
        if (!img.complete || !img.naturalWidth) return;

        // hover 감지
        const mx = window._hubMouseX, my = window._hubMouseY;
        const isHover = mx !== undefined &&
            mx >= worldX - bw/2 && mx <= worldX + bw/2 &&
            my >= baseY - bh && my <= baseY;
        const bounceY = isHover ? Math.sin(time * 0.18) * 7 : 0;

        ctx.save();
        ctx.translate(0, bounceY);
        ctx.drawImage(img, bx - bw/2, baseY - bh, bw, bh);
        ctx.restore();
        window._bearHitBox = { cx: bx, cy: baseY - bh/2, w: bw, h: bh };
    }

    // ── DRAW: 추가 오브젝트 #2 — 바닥 위 홀로그램 행성 (받침대형) ──
    function drawHologramPlanet(W, H, scrollX, time) {
        const worldW = W * 2;
        const worldX = worldW * 0.70;
        const cx = worldX - scrollX;
        const r  = W * 0.07;
        const baseY = H * 0.76;

        // hover 감지
        const mx = window._hubMouseX, my = window._hubMouseY;
        const isHover = mx !== undefined &&
            Math.abs(mx - worldX) < r * 1.6 &&
            my >= baseY - r * 3.5 && my <= baseY + r * 0.3;
        const floatY = isHover
            ? Math.sin(time * 0.18) * 9          // hover: 빠르고 큰 바운스
            : Math.sin(time * 0.02) * 6;         // 기본: 느린 부유

        const cy = baseY - r * 1.6 + floatY;

        // 베이스(받침)
        ctx.fillStyle = 'rgba(120,140,200,0.25)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + r * 1.6, r * 0.9, r * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        // 빛 기둥 (홀로그램)
        const beam = ctx.createLinearGradient(cx, cy + r * 1.6, cx, cy);
        beam.addColorStop(0, 'rgba(140,180,255,0.35)');
        beam.addColorStop(1, 'rgba(140,180,255,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.6, cy + r * 1.6);
        ctx.lineTo(cx + r * 0.6, cy + r * 1.6);
        ctx.lineTo(cx + r * 0.2, cy);
        ctx.lineTo(cx - r * 0.2, cy);
        ctx.closePath();
        ctx.fill();

        // 행성 본체
        const grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.2, cx, cy, r);
        grad.addColorStop(0, '#a8c8ff');
        grad.addColorStop(0.6, '#5d7fc5');
        grad.addColorStop(1, '#2a3f7a');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // 고리 (회전)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.sin(time * 0.01) * 0.15);
        ctx.strokeStyle = 'rgba(200,220,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.5, r * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }



    // ── DRAW: 추가 오브젝트 #4 — 천장 매달린 램프들 (월드 곳곳) ──
    function drawHangingLamps(W, H, scrollX, time) {
        const worldW = W * 2;
        const positions = [0.18, 0.42, 0.58, 0.82];        // 4개 위치 (월드 가로 비율)
        for (let i = 0; i < positions.length; i++) {
            const worldX = worldW * positions[i];
            const lx = worldX - scrollX;
            const ly = H * 0.22;                            // 0.18 → 0.22 (램프가 커진 만큼 살짝 내림)
            const cordTop = H * 0.08;                       // 줄 시작점(천장)

            ctx.strokeStyle = 'rgba(120,110,160,0.55)';
            ctx.lineWidth = 2.5;                            // 1.5 → 2.5 (줄도 굵게)
            ctx.beginPath();
            ctx.moveTo(lx, cordTop);
            ctx.lineTo(lx, ly - 4);
            ctx.stroke();

            ctx.fillStyle = '#3a3868';
            ctx.beginPath();
            ctx.moveTo(lx - 28, ly);                        // 14 → 28 (갓 가로 2배)
            ctx.lineTo(lx + 28, ly);
            ctx.lineTo(lx + 18, ly + 28);                   // 9 → 18, 14 → 28 (갓 아래폭/세로 2배)
            ctx.lineTo(lx - 18, ly + 28);
            ctx.closePath();
            ctx.fill();

            const glow = 0.55 + Math.sin(time * 0.02 + i) * 0.15;
            const lampGrad = ctx.createRadialGradient(lx, ly + 28, 2, lx, ly + 28, 120);  // 60 → 120 (빛 반경 2배)
            lampGrad.addColorStop(0, `rgba(255,230,160,${glow})`);
            lampGrad.addColorStop(1, 'rgba(255,230,160,0)');
            ctx.fillStyle = lampGrad;
            ctx.beginPath();
            ctx.arc(lx, ly + 28, 120, 0, Math.PI * 2);      // 60 → 120 (빛 반경 2배)
            ctx.fill();

            ctx.fillStyle = `rgba(255,240,180,${0.7 + glow*0.3})`;
            ctx.beginPath();
            ctx.arc(lx, ly + 28, 8, 0, Math.PI * 2);        // 4 → 8 (전구 2배)
            ctx.fill();
        }
    }


    // ── DRAW: 추가 오브젝트 #5 — 실험실 작업대 (비커 + 플라스크 + 시험관) ──
    function drawLabBench(W, H, scrollX, time) {
        // 위치: 화분 오른쪽, 빈 공간에 배치
        const worldW = W * 2;
        const worldX = W * 0.42;                 // 좌우 위치 (숫자 키우면 오른쪽으로)
        const bx = worldX - scrollX;
        const baseY = H * 0.72;                  // 바닥 라인
        const benchW = W * 0.36;                 // 작업대 가로폭 (2배)
        const benchH = H * 0.08;                 // 작업대 두께 (2배)
        const benchTop = baseY - benchH;

        // ── 작업대(테이블) ──
        // 상판
        ctx.fillStyle = '#3a3868';
        ctx.beginPath();
        roundRectPath(ctx, bx - benchW/2, benchTop, benchW, benchH, 8);
        ctx.fill();
        // 상판 하이라이트
        ctx.fillStyle = 'rgba(180,170,220,0.3)';
        ctx.fillRect(bx - benchW/2 + 8, benchTop + 4, benchW - 16, 4);

        // 다리 2개 (2배)
        ctx.fillStyle = '#2a2752';
        ctx.fillRect(bx - benchW*0.42, baseY, 12, H*0.09);
        ctx.fillRect(bx + benchW*0.42 - 12, baseY, 12, H*0.09);

        // ── 삼각 플라스크 (왼쪽, 분홍 액체 + 거품) ──
        const beaker1X = bx - benchW * 0.35;
        const beakerY = benchTop;
        const beakerBottomW = W * 0.06;
        const beakerNeckW   = W * 0.022;
        const beakerH       = H * 0.13;
        const beakerNeckH   = H * 0.025;
        const blx = beaker1X - beakerBottomW/2;
        const brx = beaker1X + beakerBottomW/2;
        const tlx = beaker1X - beakerNeckW/2;
        const trx = beaker1X + beakerNeckW/2;
        const bottomY = beakerY;
        const shoulderY = beakerY - beakerH + beakerNeckH;
        const topY = beakerY - beakerH;

        // 삼각플라스크 hover 감지 (_hubMouseX는 월드 좌표 = clientX + scrollX)
        const flaskWorldX = beaker1X + scrollX;   // 화면X → 월드X
        const fmx = window._hubMouseX, fmy = window._hubMouseY;
        const flaskHover = fmx !== undefined &&
            fmx >= flaskWorldX - beakerBottomW && fmx <= flaskWorldX + beakerBottomW &&
            fmy >= beakerY - beakerH - 10 && fmy <= beakerY + 10;
        const flaskBounce = flaskHover ? Math.sin(time * 0.18) * 7 : 0;

        ctx.save();
        ctx.translate(0, flaskBounce);

        // 플라스크 본체(투명 유리)
        ctx.fillStyle = 'rgba(200,220,255,0.18)';
        ctx.strokeStyle = 'rgba(200,220,255,0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(blx, bottomY);
        ctx.lineTo(tlx, shoulderY);
        ctx.lineTo(tlx, topY);
        ctx.lineTo(trx, topY);
        ctx.lineTo(trx, shoulderY);
        ctx.lineTo(brx, bottomY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 액체(분홍)
        const liquidLevel = bottomY - beakerH * 0.5;
        let liquidLeftAtTop, liquidRightAtTop;
        if (liquidLevel >= shoulderY) {
            const t = (bottomY - liquidLevel) / (bottomY - shoulderY);
            const widthAtTop = beakerBottomW + (beakerNeckW - beakerBottomW) * t;
            liquidLeftAtTop  = beaker1X - widthAtTop/2;
            liquidRightAtTop = beaker1X + widthAtTop/2;
        } else {
            liquidLeftAtTop  = tlx;
            liquidRightAtTop = trx;
        }
        ctx.fillStyle = 'rgba(255,120,180,0.75)';
        ctx.beginPath();
        ctx.moveTo(blx + 2, bottomY - 1);
        ctx.lineTo(liquidLeftAtTop + 1, liquidLevel);
        ctx.lineTo(liquidRightAtTop - 1, liquidLevel);
        ctx.lineTo(brx - 2, bottomY - 1);
        ctx.closePath();
        ctx.fill();

        // 액체 표면 반짝임
        ctx.fillStyle = 'rgba(255,200,220,0.7)';
        ctx.fillRect(liquidLeftAtTop + 1, liquidLevel - 1, (liquidRightAtTop - liquidLeftAtTop) - 2, 3);

        // 보글보글 거품 (목 위로 올라감)
        for (let i = 0; i < 3; i++) {
            const phase = (time * 0.04 + i * 1.7) % 6;
            const by = liquidLevel - phase * 8;
            const bxOff = Math.sin(time*0.03 + i) * 3;
            ctx.fillStyle = `rgba(255,200,220,${0.6 - phase * 0.08})`;
            ctx.beginPath();
            ctx.arc(beaker1X + bxOff + (i-1)*4, by, 3.2, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();

        // ── 둥근 플라스크 (가운데, 하늘색 액체) ──
        const flaskX = bx;
        const flaskBase = beakerY;
        const flaskR = W * 0.044;                // 2배
        const neckH = H * 0.05;                  // 2배
        // 목
        ctx.strokeStyle = 'rgba(200,220,255,0.7)';
        ctx.fillStyle = 'rgba(200,220,255,0.18)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(flaskX - 8, flaskBase - flaskR*2 - neckH);    // 4 → 8
        ctx.lineTo(flaskX - 8, flaskBase - flaskR*2);
        ctx.lineTo(flaskX + 8, flaskBase - flaskR*2);
        ctx.lineTo(flaskX + 8, flaskBase - flaskR*2 - neckH);
        ctx.fill();
        ctx.stroke();
        // 둥근 본체
        ctx.beginPath();
        ctx.arc(flaskX, flaskBase - flaskR, flaskR, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        // 액체(하늘색) — 둥근 본체 안쪽에 잘라넣기
        ctx.save();
        ctx.beginPath();
        ctx.arc(flaskX, flaskBase - flaskR, flaskR - 3, 0, Math.PI*2);   // 1.5 → 3
        ctx.clip();
        ctx.fillStyle = 'rgba(120,200,255,0.75)';
        ctx.fillRect(flaskX - flaskR, flaskBase - flaskR*1.1, flaskR*2, flaskR*1.5);
        // 표면 라인
        ctx.fillStyle = 'rgba(180,230,255,0.7)';
        ctx.fillRect(flaskX - flaskR, flaskBase - flaskR*1.1, flaskR*2, 4);   // 2 → 4
        ctx.restore();
        // 글로우 (실험 중인 느낌)
        const glowFlask = 0.3 + Math.sin(time * 0.05) * 0.15;
        const flaskGlow = ctx.createRadialGradient(flaskX, flaskBase - flaskR, 4, flaskX, flaskBase - flaskR, flaskR*2.5);
        flaskGlow.addColorStop(0, `rgba(120,200,255,${glowFlask})`);
        flaskGlow.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.fillStyle = flaskGlow;
        ctx.beginPath();
        ctx.arc(flaskX, flaskBase - flaskR, flaskR*2.5, 0, Math.PI*2);
        ctx.fill();

        // ── 시험관 거치대 (오른쪽, 시험관 3개) ──
        const rackX = bx + benchW * 0.25;
        const rackY = beakerY;
        const rackW = W * 0.10, rackBaseH = H * 0.024;    // 2배
        // 거치대 받침
        ctx.fillStyle = '#5a5894';
        ctx.fillRect(rackX - rackW/2, rackY - rackBaseH, rackW, rackBaseH);
        // 거치대 위쪽 막대
        ctx.fillStyle = '#5a5894';
        ctx.fillRect(rackX - rackW/2, rackY - H*0.09, rackW, 6);    // H*0.045 → H*0.09, 3 → 6
        // 시험관 3개
        const tubeColors = [
            'rgba(180,255,150,0.8)',   // 형광 연두
            'rgba(255,180,100,0.8)',   // 주황
            'rgba(200,140,255,0.8)'    // 보라
        ];
        for (let i = 0; i < 3; i++) {
            const tx = rackX - rackW*0.33 + i * rackW*0.33;
            const tubeTop = rackY - H*0.10;       // 0.05 → 0.10
            const tubeH = H*0.10;                  // 2배
            const tubeW = W*0.016;                 // 2배
            // 유리관
            ctx.fillStyle = 'rgba(200,220,255,0.2)';
            ctx.strokeStyle = 'rgba(200,220,255,0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tx - tubeW/2, tubeTop);
            ctx.lineTo(tx - tubeW/2, tubeTop + tubeH - tubeW/2);
            ctx.arc(tx, tubeTop + tubeH - tubeW/2, tubeW/2, Math.PI, 0, true);
            ctx.lineTo(tx + tubeW/2, tubeTop);
            ctx.stroke();
            // 액체
            ctx.fillStyle = tubeColors[i];
            ctx.beginPath();
            ctx.moveTo(tx - tubeW/2 + 1, tubeTop + tubeH*0.4);
            ctx.lineTo(tx - tubeW/2 + 1, tubeTop + tubeH - tubeW/2);
            ctx.arc(tx, tubeTop + tubeH - tubeW/2, tubeW/2 - 1, Math.PI, 0, true);
            ctx.lineTo(tx + tubeW/2 - 1, tubeTop + tubeH*0.4);
            ctx.closePath();
            ctx.fill();
        }

        // ── 작업대 위 글로우 (실험 중 분위기) ──
        const ambientGlow = ctx.createRadialGradient(bx, benchTop, 10, bx, benchTop, benchW*0.6);
        ambientGlow.addColorStop(0, 'rgba(150,220,255,0.12)');
        ambientGlow.addColorStop(1, 'rgba(150,220,255,0)');
        ctx.fillStyle = ambientGlow;
        ctx.beginPath();
        ctx.arc(bx, benchTop, benchW*0.6, 0, Math.PI*2);
        ctx.fill();
    }


    // ── DRAW: 추가 오브젝트 #6 — 벽거울 (위가 둥근 아치형) ──
    function drawWallMirror(W, H, scrollX, time) {
        const worldW = W * 2;
        const worldX = worldW * 0.75 + 265;
        const scrX = worldX - scrollX;       // 화면 X (거울 중심)
        const scrY = H * 0.42 + 50;
        const mirW = W * 0.10;
        const mirH = H * 0.32;
        const arcR = mirW / 2;

        // hover 감지 (월드 좌표)
        const hmx = window._hubMouseX, hmy = window._hubMouseY;
        const isHover = hmx !== undefined &&
            hmx >= worldX - mirW/2 - 10 && hmx <= worldX + mirW/2 + 10 &&
            hmy >= scrY - mirH/2 - 10 && hmy <= scrY + mirH/2 + 10;
        const bounceY = isHover ? Math.sin(time * 0.18) * 7 : 0;

        // 거울 중심 좌표 (바운스 적용)
        const mx = scrX;
        const my = scrY + bounceY;
 
        // ── 1. 거울 프레임 (둥근 아치) ──
        ctx.save();
        ctx.beginPath();
        // 왼쪽 아래 → 위로 → 반원 → 아래로 → 오른쪽 아래
        ctx.moveTo(mx - mirW/2, my + mirH/2);                   // 좌하
        ctx.lineTo(mx - mirW/2, my - mirH/2 + arcR);            // 좌상(직선 끝)
        ctx.arc(mx, my - mirH/2 + arcR, arcR, Math.PI, 0);      // 위쪽 반원
        ctx.lineTo(mx + mirW/2, my + mirH/2);                   // 우하
        ctx.closePath();
        // 프레임 채우기 (장식적인 골드/브론즈 그라데이션)
        const frameGrad = ctx.createLinearGradient(mx - mirW/2, my, mx + mirW/2, my);
        frameGrad.addColorStop(0, '#5a4870');
        frameGrad.addColorStop(0.5, '#8a6ea8');
        frameGrad.addColorStop(1, '#5a4870');
        ctx.fillStyle = frameGrad;
        ctx.fill();
        // 프레임 외곽선
        ctx.strokeStyle = '#3a2d50';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
 
        // ── 2. 거울 안쪽(반사면) ──
        const innerPad = 6;          // 프레임 두께
        const innerW = mirW - innerPad * 2;
        const innerH = mirH - innerPad * 2;
        const innerArcR = arcR - innerPad;
 
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(mx - innerW/2, my + innerH/2);
        ctx.lineTo(mx - innerW/2, my - innerH/2 + innerArcR);
        ctx.arc(mx, my - innerH/2 + innerArcR, innerArcR, Math.PI, 0);
        ctx.lineTo(mx + innerW/2, my + innerH/2);
        ctx.closePath();
        // 거울 반사면 그라데이션 (푸른빛 도는 반사 효과)
        const mirrorGrad = ctx.createLinearGradient(mx - innerW/2, my - innerH/2, mx + innerW/2, my + innerH/2);
        mirrorGrad.addColorStop(0, '#c8d8f0');
        mirrorGrad.addColorStop(0.4, '#a8b8d8');
        mirrorGrad.addColorStop(0.7, '#8898c0');
        mirrorGrad.addColorStop(1, '#6878a8');
        ctx.fillStyle = mirrorGrad;
        ctx.fill();
 
        // ── 3. 거울 위 빛 반사(하이라이트) — 사선 띠 ──
        ctx.clip();              // 거울 모양 안쪽으로만 그리기
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(mx - innerW*0.3, my - innerH/2);
        ctx.lineTo(mx - innerW*0.1, my - innerH/2);
        ctx.lineTo(mx + innerW*0.4, my + innerH/2);
        ctx.lineTo(mx + innerW*0.2, my + innerH/2);
        ctx.closePath();
        ctx.fill();
 
        // 두 번째 가는 빛
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.moveTo(mx + innerW*0.05, my - innerH/2);
        ctx.lineTo(mx + innerW*0.15, my - innerH/2);
        ctx.lineTo(mx + innerW*0.45, my + innerH/2);
        ctx.lineTo(mx + innerW*0.35, my + innerH/2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
 
        // ── 4. 프레임 위 작은 장식(보석/별) ──
        const decoY = my - mirH/2 + arcR - innerArcR/2;     // 아치 정점 근처
        const blink = 0.6 + Math.sin(time * 0.05) * 0.4;
        // 외곽 글로우
        const decoGlow = ctx.createRadialGradient(mx, decoY, 1, mx, decoY, 12);
        decoGlow.addColorStop(0, `rgba(255,220,150,${blink})`);
        decoGlow.addColorStop(1, 'rgba(255,220,150,0)');
        ctx.fillStyle = decoGlow;
        ctx.beginPath();
        ctx.arc(mx, decoY, 12, 0, Math.PI*2);
        ctx.fill();
        // 보석 본체
        ctx.fillStyle = '#ffd76a';
        ctx.beginPath();
        ctx.arc(mx, decoY, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff5b8';
        ctx.beginPath();
        ctx.arc(mx - 1, decoY - 1, 1.2, 0, Math.PI*2);
        ctx.fill();
    }


    // ── DRAW: Ceiling details ──
    function drawCeiling(W, H, scrollX) {
        // 월드 전체 폭에 천장 그리기
        const worldW = W * 2;
        const left  = 0 - scrollX;
        const ceilGrad = ctx.createLinearGradient(0,0,0,H*0.08);
        ceilGrad.addColorStop(0,'#d8d4ec');
        ceilGrad.addColorStop(1,'rgba(216,212,236,0)');
        ctx.fillStyle = ceilGrad;
        ctx.fillRect(left, 0, worldW, H*0.08);

        // Ceiling struts
        const strutCount = 5;
        for (let i=0; i<strutCount; i++) {
            const sx = (i/strutCount)*W - (scrollX*0.1)%( W/strutCount);
            ctx.fillStyle = 'rgba(180,170,220,0.4)';
            ctx.fillRect(sx, 0, 14, H*0.15);
            ctx.fillStyle = 'rgba(200,190,240,0.25)';
            ctx.fillRect(sx+2, 0, 3, H*0.15);
        }

        // Ceiling glow strips
        ctx.save();
        const glowGrad = ctx.createLinearGradient(0, H*0.02, 0, H*0.2);
        glowGrad.addColorStop(0,'rgba(200,190,255,0.12)');
        glowGrad.addColorStop(1,'rgba(200,190,255,0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, W, H*0.2);
        ctx.restore();
    }

    // ── DRAW: scroll indicator ──
    function drawScrollHint(W, H, scrollX, maxScroll, time) {
        const progress = scrollX / maxScroll;
        // Progress bar bottom center
        const bw = W*0.25, bh = 3;
        const bx = W/2 - bw/2, by = H - 20;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#2a2860';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#7dffc8';
        ctx.fillRect(bx, by, bw*progress, bh);
        ctx.globalAlpha = 1;

        // Arrow hints fade at edges
        if (progress < 0.95) {
            ctx.save();
            ctx.globalAlpha = (0.3 + Math.sin(time*0.06)*0.15) * (1-progress*0.5);
            ctx.fillStyle = 'rgba(184,245,255,0.8)';
            ctx.font = `${Math.max(18,W*0.02)}px sans-serif`;
            ctx.textAlign = 'right';
            ctx.fillText('›', W - 24, H/2 + 10);
            ctx.restore();
        }
        if (progress > 0.05) {
            ctx.save();
            ctx.globalAlpha = (0.3 + Math.sin(time*0.06)*0.15) * progress;
            ctx.fillStyle = 'rgba(184,245,255,0.8)';
            ctx.font = `${Math.max(18,W*0.02)}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText('‹', 24, H/2 + 10);
            ctx.restore();
        }
    }

    // ── DRAW: 캔들 4개 (월드 좌표 기반, 스크롤과 함께 이동) ──
    // 위치: 월드 중앙(화면 중앙 기준)에서 오른쪽으로 300px
    function drawCandles(W, H, scrollX, time) {
        const worldW = W * WORLD_W_FACTOR;
        const worldCenterX = worldW / 2;
        const CANDLE_W = 80;
        const CANDLE_H = 130;
        const groupStartWorldX = worldCenterX + 300;
        const baseY = H * 0.72;

        window._candleHitBoxes = [];

        const imgs = window._candleImgs || [];
        for (let i = 0; i < 4; i++) {
            const worldX = groupStartWorldX + i * CANDLE_W;
            const sx = worldX - scrollX;

            // ── 캔들2(idx=1)만 바운스: sin 기반 상하 움직임 ──
            const bounceY = (i === 1) ? Math.sin(time * 0.06) * 8 : 0;
            const sy = baseY - CANDLE_H + bounceY + 30;  // 30px 아래로 (추가 15px)

            // hover 감지
            const mx = window._hubMouseX !== undefined ? window._hubMouseX + scrollX : -9999;
            const isHover = (mx >= worldX && mx <= worldX + CANDLE_W &&
                             window._hubMouseY >= (sy) && window._hubMouseY <= baseY);

            ctx.save();
            ctx.translate(sx + CANDLE_W / 2, sy + CANDLE_H / 2);
            if (isHover && i === 1) {
                // hover 시 살짝 확대
                ctx.scale(1.08, 1.08);
                ctx.shadowColor = 'rgba(255,180,80,0.9)';
                ctx.shadowBlur = 22;
            }
            ctx.translate(-(CANDLE_W / 2), -(CANDLE_H / 2));

            const img = imgs[i];
            if (img && img.complete && img.naturalWidth) {
                ctx.drawImage(img, 0, 0, CANDLE_W, CANDLE_H);
            } else {
                ctx.fillStyle = i === 1 ? '#ffaa44' : '#ffcc88';
                ctx.fillRect(0, 0, CANDLE_W - 4, CANDLE_H);
            }
            ctx.restore();

            // 캔들2 글로우
            if (i === 1) {
                const pulse = 0.25 + Math.sin(time * 0.06) * 0.12;
                const glow = ctx.createRadialGradient(sx + CANDLE_W/2, sy + 5, 2, sx + CANDLE_W/2, sy + 5, 40);
                glow.addColorStop(0, `rgba(255,200,80,${pulse})`);
                glow.addColorStop(1, 'rgba(255,120,20,0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(sx + CANDLE_W/2, sy + 5, 40, 0, Math.PI * 2);
                ctx.fill();
            }

            // 히트박스 저장
            window._candleHitBoxes.push({ idx: i, x: sx, y: sy, w: CANDLE_W, h: CANDLE_H });
        }
    }

    // ── DRAW: Game buttons as spaceship consoles ──
    function drawGameButtons(W, H, scrollX, time) {
        const iconDrawers = {
            paint:     (x,y,s) => drawIconPaint(x,y,s),
            shooting:  (x,y,s) => drawIconPunch(x,y,s),
            mirror:    (x,y,s) => drawIconMirror(x,y,s),
            breathing: (x,y,s) => drawIconBreathing(x,y,s),
            bubble:    (x,y,s) => drawIconBubble(x,y,s),
        };

        hubButtons.forEach((btn, i) => {
            const screenX = btn.wx - scrollX;
            if (screenX < -120 || screenX > W+120) return;

            const floorY = H*0.72;
            const btnY = btn.wy;
            const isOnFloor = btnY > floorY - 60;

            // Hover detect (mouse position) — _hubMouseX는 월드 좌표
            const hovering = window._hubMouseX !== undefined &&
                Math.abs(window._hubMouseX - btn.wx) < 55 &&
                Math.abs(window._hubMouseY - btnY) < 55;

            const scale = hovering ? 1.08 + Math.sin(time*0.1)*0.02 : 1;
            const pulse = 0.6 + Math.sin(time*0.07+i*1.1)*0.25;

            // Pedestal if near floor
            if (isOnFloor) {
                ctx.save();
                ctx.fillStyle = '#1e1c42';
                ctx.strokeStyle = '#3a3868';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                roundRectPath(ctx, screenX-30, btnY+44, 60, 20, 4);
                ctx.fill();
                ctx.stroke();
                // Pedestal glow
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.ellipse(screenX, btnY+64, 40, 8, 0, 0, Math.PI*2);
                ctx.fillStyle = btn.color;
                ctx.fill();
                ctx.restore();
            }

            // Button glow
            ctx.save();
            ctx.translate(screenX, btnY);
            ctx.scale(scale, scale);

            // Outer glow
            const glowR = 50 + Math.sin(time*0.08+i)*4;
            const glowGrad2 = ctx.createRadialGradient(0,0,0,0,0,glowR);
            glowGrad2.addColorStop(0, btn.color+'66');
            glowGrad2.addColorStop(1, btn.color+'00');
            ctx.fillStyle = glowGrad2;
            ctx.beginPath();
            ctx.arc(0, 0, glowR, 0, Math.PI*2);
            ctx.fill();

            // Button body
            const bodyGrad = ctx.createRadialGradient(-8,-8,2,0,0,28);
            bodyGrad.addColorStop(0, btn.color+'ff');
            bodyGrad.addColorStop(1, btn.color+'88');
            ctx.fillStyle = bodyGrad;
            ctx.beginPath();
            ctx.arc(0, 0, 28, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = btn.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.7;
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Icon
            iconDrawers[btn.id] && iconDrawers[btn.id](0, 0, 26);

            // Label background
            ctx.fillStyle = 'rgba(10,10,30,0.8)';
            ctx.beginPath();
            roundRectPath(ctx, -36, 32, 72, 20, 3);
            ctx.fill();
            // Label text
            ctx.fillStyle = btn.color;
            ctx.font = `bold ${Math.max(10,W*0.011)}px 'Noto Serif KR',sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(btn.desc, 0, 46);

            ctx.restore();
        });
    }

    // ── SVG-style icons drawn with canvas ──
    function drawIconPaint(x,y,s) {
        // Palette icon
        ctx.save();
        ctx.translate(x,y);
        ctx.fillStyle = '#ff8fb5';
        ctx.beginPath();
        ctx.ellipse(0,-2,s*0.72,s*0.6,0,0,Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#1a1840';
        ctx.beginPath();
        ctx.ellipse(0,2,s*0.3,s*0.28,0,0,Math.PI*2);
        ctx.fill();
        const dotColors=['#ff6688','#44aaff','#44ff88','#ffaa00','#ff44ff'];
        dotColors.forEach((c,i)=>{
            const a=(i/dotColors.length)*Math.PI*2-Math.PI/2;
            ctx.fillStyle=c;
            ctx.beginPath();
            ctx.arc(Math.cos(a)*s*0.46,Math.sin(a)*s*0.46-2,s*0.13,0,Math.PI*2);
            ctx.fill();
        });
        ctx.restore();
    }
    function drawIconShooting(x,y,s) {
        // Target crosshair
        ctx.save();
        ctx.translate(x,y);
        ctx.strokeStyle='#ffa64d';
        ctx.lineWidth=2.5;
        ctx.beginPath();ctx.arc(0,0,s*0.72,0,Math.PI*2);ctx.stroke();
        ctx.beginPath();ctx.arc(0,0,s*0.42,0,Math.PI*2);ctx.stroke();
        ctx.beginPath();ctx.arc(0,0,s*0.12,0,Math.PI*2);
        ctx.fillStyle='#ffa64d';ctx.fill();
        // crosshairs
        [[0,-s*0.95,0,-s*0.78],[0,s*0.78,0,s*0.95],[-s*0.95,0,-s*0.78,0],[s*0.78,0,s*0.95,0]].forEach(([x1,y1,x2,y2])=>{
            ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
        });
        ctx.restore();
    }
    function drawIconPunch(x,y,s) {
        // Fist icon
        ctx.save();
        ctx.translate(x,y);
        ctx.fillStyle='#ff6b6b';
        // Palm
        ctx.beginPath();
        ctx.roundRect(-s*0.5,-s*0.2,s,s*0.8,s*0.2);
        ctx.fill();
        // Fingers
        for(let i=0;i<4;i++){
            ctx.beginPath();
            ctx.roundRect(-s*0.42+i*s*0.28,-s*0.65,s*0.22,s*0.55,s*0.11);
            ctx.fill();
        }
        // Thumb
        ctx.beginPath();
        ctx.roundRect(s*0.38,-s*0.08,s*0.28,s*0.35,s*0.1);
        ctx.fill();
        // Knuckle lines
        ctx.strokeStyle='rgba(0,0,0,0.3)';
        ctx.lineWidth=1.5;
        for(let i=0;i<3;i++){
            ctx.beginPath();
            ctx.moveTo(-s*0.14+i*s*0.28,-s*0.18);
            ctx.lineTo(-s*0.14+i*s*0.28,-s*0.05);
            ctx.stroke();
        }
        ctx.restore();
    }
    function drawIconMirror(x,y,s) {
        // Mirror / star sparkle
        ctx.save();
        ctx.translate(x,y);
        ctx.strokeStyle='#b8f5ff';
        ctx.lineWidth=2;
        // Mirror frame oval
        ctx.beginPath();
        ctx.ellipse(0,-s*0.1,s*0.45,s*0.58,0,0,Math.PI*2);
        ctx.fillStyle='rgba(184,245,255,0.08)';
        ctx.fill();
        ctx.stroke();
        // Mirror handle
        ctx.beginPath();
        ctx.moveTo(0,s*0.5);ctx.lineTo(0,s*0.82);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0,s*0.88,s*0.2,s*0.09,0,0,Math.PI*2);
        ctx.stroke();
        // Sparkle
        ctx.fillStyle='#b8f5ff';
        ctx.font=`${s*0.65}px serif`;
        ctx.textAlign='center';
        ctx.fillText('✦',0,-s*0.1);
        ctx.restore();
    }
    function drawIconBreathing(x,y,s) {
        // Wind/breath waves
        ctx.save();
        ctx.translate(x,y);
        ctx.strokeStyle='#a78bfa';
        ctx.lineWidth=2.5;
        ctx.lineCap='round';
        for(let i=0;i<3;i++){
            const oy=-s*0.28+i*s*0.28;
            const amp=s*(0.32-i*0.06);
            ctx.beginPath();
            ctx.moveTo(-s*0.72,oy);
            ctx.quadraticCurveTo(-s*0.24,oy-amp,0,oy);
            ctx.quadraticCurveTo(s*0.24,oy+amp,s*0.72,oy);
            ctx.globalAlpha=1-i*0.25;
            ctx.stroke();
        }
        ctx.globalAlpha=1;
        // Star center
        ctx.fillStyle='#a78bfa';
        ctx.beginPath();ctx.arc(0,s*0.5,s*0.12,0,Math.PI*2);ctx.fill();
        ctx.restore();
    }
    function drawIconPlant(x,y,s) {
        // Plant sprout
        ctx.save();
        ctx.translate(x,y);
        // Stem
        ctx.strokeStyle='#7dffc8';
        ctx.lineWidth=3;
        ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(0,s*0.65);
        ctx.lineTo(0,-s*0.1);
        ctx.stroke();
        // Left leaf
        ctx.fillStyle='#7dffc8';
        ctx.beginPath();
        ctx.moveTo(0,-s*0.05);
        ctx.quadraticCurveTo(-s*0.65,-s*0.08,-s*0.5,-s*0.45);
        ctx.quadraticCurveTo(-s*0.2,-s*0.2,0,-s*0.05);
        ctx.fill();
        // Right leaf
        ctx.beginPath();
        ctx.moveTo(0,-s*0.05);
        ctx.quadraticCurveTo(s*0.65,-s*0.08,s*0.5,-s*0.45);
        ctx.quadraticCurveTo(s*0.2,-s*0.2,0,-s*0.05);
        ctx.fill();
        // Pot
        ctx.fillStyle='#4a4890';
        ctx.beginPath();
        ctx.moveTo(-s*0.35,s*0.65);
        ctx.lineTo(-s*0.28,s*0.95);
        ctx.lineTo(s*0.28,s*0.95);
        ctx.lineTo(s*0.35,s*0.65);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawIconBubble(x,y,s) {
        ctx.save(); ctx.translate(x,y);
        const bpos = [[-s*0.35,-s*0.35],[s*0.35,-s*0.35],[-s*0.35,s*0.35],[s*0.35,s*0.35],[0,0]];
        bpos.forEach(([px2,py2]) => {
            ctx.beginPath(); ctx.arc(px2,py2,s*0.22,0,Math.PI*2);
            ctx.fillStyle='#ffd6f5'; ctx.fill();
            ctx.strokeStyle='#ffaaee'; ctx.lineWidth=1.5; ctx.stroke();
            ctx.save(); ctx.globalAlpha=0.5; ctx.fillStyle='#fff';
            ctx.beginPath(); ctx.arc(px2-s*0.06,py2-s*0.06,s*0.07,0,Math.PI*2); ctx.fill();
            ctx.restore();
        });
        ctx.restore();
    }

    //     // ── 캐릭터 이동 로직 ──
    function updateCharacter() {
        if (!character.moving) return;
        const dx = character.targetWx - character.wx;
        const dy = character.targetWy - character.wy;
        const dist = Math.hypot(dx, dy);

        // 도착 처리
        if (dist < character.speed) {
            character.wx = character.targetWx;
            character.wy = character.targetWy;
            character.moving = false;
            character.walkFrame = 0;
            character.walkTimer = 0;
            return;
        }

        // 이동
        character.wx += (dx / dist) * character.speed;
        character.wy += (dy / dist) * character.speed;

        // 걷기 애니메이션 (옆1 ↔ 옆2 토글)
        character.walkTimer++;
        if (character.walkTimer >= character.walkInterval) {
            character.walkTimer = 0;
            character.walkFrame = 1 - character.walkFrame;
        }
    }

    // ── 캐릭터 렌더링 ──
    function drawCharacter(scrollX) {
        // 상태에 따라 이미지 선택
        let img;
        if (character.moving) {
            img = (character.walkFrame === 0) ? charImgWalk1 : charImgWalk2;
        } else {
            img = charImgIdle;
        }
        // 이미지가 아직 로딩 안 됐으면 그리지 않음
        if (!img.complete || img.naturalWidth === 0) return;

        // 비율 유지하여 크기 계산
        const h = character.size;
        const w = img.naturalWidth * (h / img.naturalHeight);

        // 월드 좌표 → 화면 좌표
        const sx = character.wx - scrollX;
        const sy = character.wy;

        ctx.save();
        ctx.translate(sx, sy);
        // 옆 이미지가 "오른쪽"을 보고 있음:
        //   character.flipH === true (왼쪽 이동) → 좌우반전
        if (character.flipH) {
            ctx.scale(-1, 1);
        }
        // 발 밑(중앙-하단)을 기준점으로 그리기
        ctx.drawImage(img, -w/2, -h, w, h);
        ctx.restore();
    }

    // ── MAIN LOOP ──
    function loop() {
        const W = canvas.width, H = canvas.height;
        const worldW = W * WORLD_W_FACTOR;
        const maxScroll = W * (WORLD_W_FACTOR - 1);

        // Smooth scroll lerp
        const diff = targetScrollX - scrollX;
        scrollX += diff * 0.1;
        // 범위 보정: CLIP_LEFT ~ (maxScroll - CLIP_RIGHT)
        scrollX = Math.max(CLIP_LEFT, Math.min(maxScroll - CLIP_RIGHT, scrollX));

        time++;

        ctx.clearRect(0, 0, W, H);

        // Background (전체 화면)
        ctx.fillStyle = '#f0eef8';
        ctx.fillRect(0, 0, W, H);

        drawCeiling(W, H, scrollX);
        drawHangingLamps(W, H, scrollX, time);
        drawSpaceWindow(worldW, W, H, scrollX, time);
        drawWallMirror(W, H, scrollX, time);
        drawShipInterior(W, H, scrollX);
        drawBear(W, H, scrollX);
        drawPlantPot(W, H, scrollX, time);
        drawLabBench(W, H, scrollX, time);
        drawHologramPlanet(W, H, scrollX, time);
        drawLeftPanel(W, H, scrollX, time);
        drawCandles(W, H, scrollX, time);
        drawScrollHint(W, H, scrollX, maxScroll, time);

        // ── 캐릭터 업데이트 & 그리기 (배경/오브젝트 위에 표시) ──
        updateCharacter();
        drawCharacter(scrollX);

        // ── 미니외계인 업데이트 & 그리기 ──
        updateMiniAlien();
        drawMiniAlien(scrollX);

        animId = requestAnimationFrame(loop);
    }
    loop();

    window._hubCleanup = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
        window.removeEventListener('resize', layoutButtons);
        window._hubMouseX = undefined;
        window._hubMouseY = undefined;
    };
}

/* ==========================================================================
 * 8-B. ENDING PAGE
 * ========================================================================== */
let _edDestroyed  = 0;
let _edTotal      = 0;
let _edAllGone    = false;
let _edScrollY    = 0;
let _edShootTimer = null;
let _edWords      = [];   // 단어 배열

function renderEndingPage() {
    _edWords     = (surveyAnswers.word || '스트레스').split(',').map(w => w.trim()).filter(Boolean);
    _edDestroyed = 0;
    _edTotal     = _edWords.length;
    _edAllGone   = false;
    _edScrollY   = 0;

    return `
        <div class="ending-wrap" id="edWrap">
            ${createStars()}
            <div id="edShoot"></div>

            <!-- 단어 레이어 -->
            <div id="edWordLayer" style="position:absolute;inset:0;z-index:10;pointer-events:none;"></div>

            <!-- S1 -->
            <div class="ed-sec" id="edS1">
                <p class="ed-txt" id="edT1">당신의 스트레스 에너지는<br>모두 안전하게 해소되었습니다.</p>
            </div>

            <!-- S2 -->
            <div class="ed-sec" id="edS2" style="pointer-events:none;"></div>

            <!-- S3 -->
            <div class="ed-sec" id="edS3">
                <p class="ed-txt" id="edT3">앞으로 당신의 앞길에<br>행복만이 가득하길 기원합니다.</p>
            </div>

            <!-- S4 -->
            <div class="ed-sec" id="edS4">
                <p class="ed-txt" id="edT4">당신의 스트레스가 모두 해소되어<br>안전하게 지구로 돌아갑니다.</p>
                <button id="edBtn" onclick="navigateTo('landing')" style="
                    opacity:0; pointer-events:none; margin-top:20px;
                    font-family:'Jua',sans-serif; font-size:1rem; letter-spacing:1px;
                    padding:14px 40px; border-radius:50px; cursor:pointer;
                    background:rgba(255,255,255,0.08);
                    color:rgba(240,230,255,0.85);
                    border:1px solid rgba(255,255,255,0.2);
                    transition:all 0.25s ease;
                " onmouseover="this.style.background='rgba(255,255,255,0.15)'"
                   onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                    🌍 지구로 돌아가기
                </button>
            </div>

            <!-- 진행 바 -->
            <div class="intro-progress">
                <div class="intro-progress-bar">
                    <div class="intro-progress-fill" id="edFill"></div>
                </div>
                <div class="intro-progress-text" id="edPTxt">스크롤하여 계속...</div>
            </div>
        </div>
    `;
}

/* ── 별똥별 ── */
function edStartShoot() {
    const ct = document.getElementById('edShoot');
    if (!ct) return;
    function spawn() {
        if (!document.getElementById('edShoot')) return;
        const n = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < n; i++) {
            const s = document.createElement('div');
            s.className = 'survey-shooting-star';
            const sx = Math.random() * 80 + 5;
            const len = Math.random() * 80 + 60;
            const ang = Math.random() * 20 + 30;
            const dur = Math.random() * 0.6 + 0.6;
            const del = i * Math.random() * 0.3;
            s.style.cssText = `left:${sx}vw;top:-10px;width:${len}px;--angle:${ang}deg;animation-duration:${dur}s;animation-delay:${del}s;transform:rotate(${ang}deg);`;
            ct.appendChild(s);
            setTimeout(() => s.remove(), (dur + del + 0.2) * 1000);
        }
        _edShootTimer = setTimeout(spawn, Math.random() * 2000 + 1000);
    }
    spawn();
}

/* ── 단어 DOM 생성 및 배치 ── */
function edBuildWords() {
    const layer = document.getElementById('edWordLayer');
    if (!layer) return;
    layer.innerHTML = '';

    const slots = [
        [10,18],[58,15],[76,22],[22,45],[68,44],
        [38,68],[8,65],[75,65],[47,28],[30,52]
    ];

    _edWords.forEach((w, i) => {
        const el  = document.createElement('div');
        el.className   = 'ed-word';
        el.id          = `edW${i}`;
        el.textContent = w;

        const s   = slots[i % slots.length];
        const jx  = (Math.random() - 0.5) * 8;
        const jy  = (Math.random() - 0.5) * 6;
        const rot = (Math.random() - 0.5) * 18;
        el.dataset.rot = rot;   // 회전값 저장
        el.style.cssText = `
            position:absolute;
            left:calc(${s[0]}vw + ${jx}vw);
            top:calc(${s[1]}vh + ${jy}vh);
            transform:rotate(${rot}deg);
            opacity:0;
        `;
        layer.appendChild(el);
    });
}

/* ── 단어 파괴 ── */
function edDestroy(idx) {
    const el = document.getElementById(`edW${idx}`);
    if (!el || el.dataset.gone) return;
    el.dataset.gone    = '1';
    el.style.pointerEvents = 'none';

    // 파티클
    const rect  = el.getBoundingClientRect();
    const cx    = rect.left + rect.width  / 2;
    const cy    = rect.top  + rect.height / 2;
    const wrap  = document.getElementById('edWrap');
    const wr    = wrap.getBoundingClientRect();
    const cols  = ['#ff8fb5','#ffb347','#fff7a0','#a6f3e6','#b8f5ff'];
    for (let i = 0; i < 14; i++) {
        const p   = document.createElement('div');
        const ang = (i / 14) * Math.PI * 2;
        const spd = 55 + Math.random() * 85;
        const col = cols[i % cols.length];
        const sz  = 4 + Math.random() * 7;
        p.style.cssText = `
            position:absolute;z-index:99;border-radius:50%;pointer-events:none;
            left:${cx - wr.left - sz/2}px;top:${cy - wr.top - sz/2}px;
            width:${sz}px;height:${sz}px;
            background:${col};box-shadow:0 0 6px ${col};
            --tx:${Math.cos(ang)*spd}px;--ty:${Math.sin(ang)*spd}px;
            animation:endingParticle 0.55s ease-out forwards;
        `;
        wrap.appendChild(p);
        setTimeout(() => p.remove(), 620);
    }

    el.style.animation = 'edBurst 0.42s ease-out forwards';

    _edDestroyed++;
    if (_edDestroyed >= _edTotal) {
        _edAllGone = true;
        const hint = document.getElementById('edHint');
        const lock = document.getElementById('edLock');
        if (hint) { hint.textContent = '✅ 모두 해소됐어요! 스크롤하여 계속하세요'; hint.style.color = 'var(--cyan)'; }
        if (lock)  lock.style.opacity = '0';
    }
}

/* ── 스크롤 엔진 ── */
function initEndingScroll() {
    edBuildWords();
    edStartShoot();

    const SPS   = window.innerHeight * 2.5;
    const TOTAL = SPS * 4;   // 섹션 4개 충분히
    const wrap  = document.getElementById('edWrap');
    if (!wrap) return;

    // UFO 없으므로 루프 불필요

    function tryScroll(delta) {
        _edScrollY = Math.max(0, Math.min(TOTAL, _edScrollY + delta));
        edUpdate(_edScrollY, TOTAL, SPS);
    }

    wrap.addEventListener('wheel', e => { e.preventDefault(); tryScroll(e.deltaY * 0.85); }, { passive: false });
    let ty = 0;
    wrap.addEventListener('touchstart', e => { ty = e.touches[0].clientY; }, { passive: true });
    wrap.addEventListener('touchmove',  e => {
        tryScroll((ty - e.touches[0].clientY) * 1.1);
        ty = e.touches[0].clientY;
    }, { passive: true });

    edUpdate(0, TOTAL, SPS);
}

function edFade(p, i0, i1, o0, o1) {
    // i0~i1: 페이드인, o0~o1: 페이드아웃
    if (p <= i0) return 0;
    if (p <  i1) return (p - i0) / (i1 - i0);
    if (p <= o0) return 1;
    if (p <  o1) return 1 - (p - o0) / (o1 - o0);
    return 0;
}

function edUpdate(sy, total, sps) {
    const p1 = Math.max(0, Math.min(1,  sy          / sps));
    const p2 = Math.max(0, Math.min(1, (sy - sps)   / sps));
    const p3 = Math.max(0, Math.min(1, (sy - sps*2) / sps));
    const p4 = Math.max(0, Math.min(1, (sy - sps*3) / sps));

    // 진행 바
    const fill = document.getElementById('edFill');
    const ptxt = document.getElementById('edPTxt');
    if (fill) fill.style.width = (sy / total * 100) + '%';
    if (ptxt) ptxt.textContent = p4 > 0.85 ? '힐링 완료 🛸' : '스크롤하여 계속...';

    // S1
    const t1 = document.getElementById('edT1');
    if (t1) t1.style.opacity = edFade(p1, 0, 0.2, 0.65, 0.9);

    // S2 — 단어 스크롤로 순서대로 파괴
    const n = _edWords.length;
    _edWords.forEach((_, i) => {
        const el = document.getElementById(`edW${i}`);
        if (!el) return;

        // 각 단어의 구간: p2를 단어 수로 균등 분할
        const segSize = 1 / n;
        const start   = i * segSize;
        const mid     = start + segSize * 0.45;   // 등장 완료
        const end     = start + segSize;           // 파괴 완료

        if (p2 < start) {
            // 아직 등장 전
            el.style.opacity = 0;
            el.style.filter  = 'none';
            el.style.transform = `rotate(${el.dataset.rot}deg) scale(1)`;
        } else if (p2 < mid) {
            // 등장 페이드인
            const t = (p2 - start) / (mid - start);
            el.style.opacity = t;
            el.style.filter  = 'none';
            el.style.transform = `rotate(${el.dataset.rot}deg) scale(1)`;
        } else if (p2 < end) {
            // 파괴: 흔들리다 폭발
            const t = (p2 - mid) / (end - mid);
            const shake = t < 0.6 ? Math.sin(t * Math.PI * 10) * (1 - t) * 12 : 0;
            const burst = Math.max(0, (t - 0.55) / 0.45);
            el.style.opacity = 1 - burst;
            el.style.filter  = burst > 0 ? `brightness(${1 + burst * 4}) blur(${burst * 14}px)` : 'none';
            el.style.transform = `rotate(${el.dataset.rot}deg) scale(${1 + burst * 1.2}) translateX(${shake}px)`;
        } else {
            // 파괴 완료
            el.style.opacity = 0;
        }
    });

    // S3
    const t3 = document.getElementById('edT3');
    if (t3) t3.style.opacity = edFade(p3, 0, 0.2, 0.7, 0.92);

    // S4
    const t4  = document.getElementById('edT4');
    const btn = document.getElementById('edBtn');
    if (t4) t4.style.opacity = edFade(p4, 0, 0.25, 1.0, 1.0);
    if (btn) {
        const bop = Math.max(0, (p4 - 0.35) / 0.35);
        btn.style.opacity      = bop;
        btn.style.pointerEvents = bop > 0.1 ? 'all' : 'none';
    }
}




function renderGameModal() {
    const game = games.find(g => g.id === selectedGame);
    return `
        <div class="modal-overlay" onclick="closeGameModal()" style="z-index:500;">
            <!-- 배경 딤 레이어 (로딩 아래 z-index) -->
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:500;"></div>
            <!-- 팝업 내용 — z-index:100001로 로딩(99999) 위에 뜸 -->
            <div onclick="event.stopPropagation()" style="
                position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
                z-index:100001;
                background:rgba(10,5,30,0.0);
                display:flex;flex-direction:column;align-items:center;gap:16px;
                text-align:center;pointer-events:auto;
            ">
                <div style="font-size:54px;filter:drop-shadow(0 0 20px ${game.color});">${game.icon}</div>
                <h2 style="color:#b8f5ff;font-family:'Noto Serif KR',serif;font-weight:400;font-size:1.6rem;margin:0;text-shadow:0 0 20px rgba(184,245,255,0.5);">${game.title}</h2>
                <p style="color:rgba(180,220,255,0.75);font-size:0.95rem;max-width:280px;line-height:1.6;margin:0;">${game.description}</p>
                <div style="display:flex;gap:12px;margin-top:4px;">
                    <button style="
                        padding:12px 36px;border:none;border-radius:50px;cursor:pointer;
                        background:linear-gradient(135deg,${game.color},${game.color}aa);
                        color:#0a0520;font-family:'Jua',sans-serif;font-size:1rem;font-weight:700;
                        box-shadow:0 0 24px ${game.color}88;
                    " onclick="startGameWithLoading('${game.id}')">시작하기</button>
                    <button style="
                        padding:12px 28px;border:none;border-radius:50px;cursor:pointer;
                        background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);
                        color:rgba(255,255,255,0.8);font-family:'Jua',sans-serif;font-size:1rem;
                    " onclick="closeGameModal()">닫기</button>
                </div>
            </div>
        </div>
    `;
}

/* ==========================================================================
 * 9. GAME PAGES — 각 게임 페이지 HTML 렌더러
 * ========================================================================== */
function renderPaintGamePage() {
    return `
        <div class="page">
            ${createStars()}
            ${renderNavigation()}
            <button class="hub-back-btn" onclick="navigateToHubWithLoading()">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                <span>라운지로 돌아가기</span>
            </button>
            <div class="game-page">
                <div class="game-header">
                    <h1 style="color:#ff8fb5;">🎨 페인트 / 행성 만들기</h1>
                    <p>자유롭게 그려보세요! 나만의 우주를 창조하세요.</p>
                </div>
                <div class="game-container" style="border-color:rgba(255,143,181,0.4); box-shadow:0 0 40px rgba(255,143,181,0.15);">
                    <canvas id="paintCanvas" width="760" height="460" style="background:rgba(255,255,255,0.04); border-radius:12px; cursor:crosshair; display:block;"></canvas>
                    <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-top:20px; flex-wrap:wrap;">
                        <div id="colorPalette" style="display:flex; gap:10px;"></div>
                        <button class="btn-primary" onclick="clearCanvas()" style="padding:10px 24px; font-size:13px; border-radius:10px;">지우기</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderShootingGamePage() {
    return `
        <div class="page">
            ${createStars()}
            ${renderNavigation()}
            <button class="hub-back-btn" onclick="navigateToHubWithLoading()">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                <span>라운지로 돌아가기</span>
            </button>
            <div class="game-page">
                <div class="game-header">
                    <h1 style="color:#ffa64d;">🎯 슈팅 게임</h1>
                    <p>침략자를 클릭해서 격추하세요!</p>
                </div>
                <div style="text-align:center; margin-bottom:16px; font-size:1.4rem; color:#7dffc8; font-family:'Share Tech Mono',monospace;">
                    점수: <span id="shootingScore">0</span>
                </div>
                <button class="btn-primary" onclick="startShootingGame()" id="shootingStart">게임 시작</button>
                <div id="shootingGameArea" class="game-container hidden" style="border-color:rgba(255,166,77,0.4); box-shadow:0 0 40px rgba(255,166,77,0.15); width:760px; height:480px; position:relative; overflow:hidden;"></div>
            </div>
        </div>
    `;
}

function renderPunchGamePage() {
    return `
        <div class="page">
            ${createStars()}
            ${renderNavigation()}
            <button class="hub-back-btn" onclick="navigateToHubWithLoading()">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                <span>라운지로 돌아가기</span>
            </button>
            <div class="game-page">
                <div class="game-header">
                    <h1 style="color:#ff6b6b;">👊 펀치 / 스매시</h1>
                    <p>화면을 클릭해서 스트레스를 날려버리세요!</p>
                </div>
                <div style="text-align:center; margin-bottom:20px; font-size:1.4rem; color:#ff6b6b; font-family:'Share Tech Mono',monospace;">
                    타격: <span id="punchCount">0</span>회
                </div>
                <div id="punchArea" class="game-container" style="border-color:rgba(255,107,107,0.4); box-shadow:0 0 40px rgba(255,107,107,0.15); width:760px; height:480px; position:relative; cursor:pointer; overflow:hidden;">
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:180px; height:180px; border-radius:50%; background:linear-gradient(135deg,#ff6b6b,#cc3333); display:flex; align-items:center; justify-content:center; border:6px solid rgba(255,136,136,0.6); font-size:3.5rem; box-shadow:0 0 40px rgba(255,107,107,0.3);">
                        🎯
                    </div>
                    <div style="position:absolute; bottom:28px; left:50%; transform:translateX(-50%); text-align:center; color:rgba(184,245,255,0.6); font-size:1rem;">
                        클릭하거나 타격해보세요! 💥
                    </div>
                </div>
                <div id="punchMessage" class="hidden" style="margin-top:20px; padding:14px 28px; background:linear-gradient(135deg,rgba(125,255,200,0.15),rgba(110,231,183,0.1)); border:1px solid rgba(125,255,200,0.4); border-radius:14px; color:#7dffc8; text-align:center; font-size:1rem;">
                    🎉 대단해요! 스트레스가 많이 해소되었을 거예요!
                </div>
            </div>
        </div>
    `;
}
/* ==========================================================================
 * 10. NAVIGATION FUNCTIONS — 모달 / 허브 게임 선택 함수
 * ========================================================================== */
function navigateTo(page) {
    // Cleanup intro if leaving
    if (currentPage === 'intro' && window._introCleanup) {
        window._introCleanup();
        window._introCleanup = null;
    }
    // Cleanup hub canvas if leaving
    if (currentPage === 'hub' && window._hubCleanup) {
        window._hubCleanup();
        window._hubCleanup = null;
    }
    // Cleanup punch canvas if leaving
    if (currentPage === 'shooting' && typeof cleanupPunch === 'function') {
        try { cleanupPunch(); } catch(e) {}
    }
    // Cleanup breathing
    if (isBreathing) {
        isBreathing = false;
        clearTimeout(breathingTimeout);
    }

    currentPage = page;
    selectedGame = null;
    isMenuOpen = false;
    renderPage();
}

/* ── 라운지로 돌아가기: 로딩 화면 경유 ── */
function navigateToHubWithLoading() {
    // 이미 로딩 중이면 중복 방지
    if (document.getElementById('hubLoadingOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'hubLoadingOverlay';
    overlay.className = 'hub-loading-overlay';
    overlay.innerHTML = `
        <div class="hub-loading-box">
            <div class="hub-loading-bar-wrap">
                <div class="hub-loading-bar" id="hubLoadingBar"></div>
                <div class="hub-loading-runner" id="hubLoadingRunner">🚀</div>
                <div class="hub-loading-goal">🛸</div>
            </div>
            <div class="hub-loading-text">L O A D I N G . . .</div>
        </div>
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('show'));

    const duration = 1500;
    const startTime = performance.now();
    const bar = document.getElementById('hubLoadingBar');
    const runner = document.getElementById('hubLoadingRunner');

    function updateBar(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        if (bar) bar.style.width = (progress * 100) + '%';
        if (runner) runner.style.left = `calc(${progress * 100}% - 16px)`;
        if (progress < 1) {
            requestAnimationFrame(updateBar);
        } else {
            navigateTo('hub');
            setTimeout(() => {
                const ov = document.getElementById('hubLoadingOverlay');
                if (ov) {
                    ov.classList.remove('show');
                    setTimeout(() => ov.remove(), 300);
                }
            }, 100);
        }
    }
    requestAnimationFrame(updateBar);
}

/* ── 게임 시작: 팝업 닫고 로딩 표시 후 게임으로 이동 ── */
function startGameWithLoading(gameId) {
    // 팝업 상태 초기화
    selectedGame = null;

    // 기존 오버레이 있으면 즉시 제거 후 새로 만들기
    const existing = document.getElementById('hubLoadingOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'hubLoadingOverlay';
    overlay.className = 'hub-loading-overlay';
    overlay.innerHTML = `
        <div class="hub-loading-box">
            <div class="hub-loading-bar-wrap">
                <div class="hub-loading-bar" id="hubLoadingBar"></div>
                <div class="hub-loading-runner" id="hubLoadingRunner">🚀</div>
                <div class="hub-loading-goal">🎮</div>
            </div>
            <div class="hub-loading-text">L O A D I N G . . .</div>
        </div>
    `;
    document.body.appendChild(overlay);

    // 다음 프레임에 show 클래스 추가 (fade-in)
    requestAnimationFrame(() => {
        overlay.classList.add('show');

        const duration = 1500;
        const startTime = performance.now();

        function updateBar(now) {
            const bar    = document.getElementById('hubLoadingBar');
            const runner = document.getElementById('hubLoadingRunner');
            if (!bar) return; // 오버레이가 이미 제거된 경우

            const elapsed  = now - startTime;
            const progress = Math.min(1, elapsed / duration);
            bar.style.width    = (progress * 100) + '%';
            runner.style.left  = `calc(${progress * 100}% - 16px)`;

            if (progress < 1) {
                requestAnimationFrame(updateBar);
            } else {
                navigateTo(gameId);
                setTimeout(() => {
                    const ov = document.getElementById('hubLoadingOverlay');
                    if (ov) {
                        ov.classList.remove('show');
                        setTimeout(() => ov.remove(), 300);
                    }
                }, 100);
            }
        }
        requestAnimationFrame(updateBar);
    });
}

function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    // 설문 오버레이가 열려있으면 오버레이 안의 네비게이션만 업데이트
    const surveyOverlay = document.getElementById('surveyOverlay');
    if (surveyOverlay) {
        const navEl = surveyOverlay.querySelector('.menu-button')?.parentElement;
        // 오버레이 내 기존 메뉴버튼/드로어 제거 후 다시 렌더
        surveyOverlay.querySelectorAll('.menu-button, .menu-overlay, .menu-drawer, .settings-overlay, .settings-panel').forEach(el => el.remove());
        surveyOverlay.insertAdjacentHTML('afterbegin', renderNavigation());
        return;
    }
    renderPage();
}

function toggleVolume() {
    isMuted = !isMuted;
    Object.values(AudioManager.sounds).forEach(function(s) { s.muted = isMuted; });
    var btn = document.querySelector('.volume-button');
    if (btn) {
        btn.innerHTML = isMuted
            ? '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>'
            : '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M9 9a3 3 0 000 6"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>';
    }
}

function showHelpPopup() {
    var existing = document.getElementById('helpPopup');
    if (existing) { existing.remove(); var d2 = document.getElementById('helpPopupDim'); if(d2) d2.remove(); return; }
    var dim = document.createElement('div');
    dim.id = 'helpPopupDim';
    dim.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9998;';
    var popup = document.createElement('div');
    popup.id = 'helpPopup';
    popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:rgba(10,5,30,0.95);border:1px solid rgba(125,255,200,0.4);border-radius:16px;padding:32px 40px;text-align:center;max-width:380px;width:90%;box-shadow:0 0 40px rgba(125,255,200,0.2);backdrop-filter:blur(10px);';
    popup.innerHTML = '<div style="font-size:2rem;margin-bottom:12px;">\uD83D\uDEF8</div><p style="font-family:\'Jua\',sans-serif;font-size:1rem;color:rgba(220,220,255,0.9);line-height:1.7;margin:0 0 20px;">아이템 버튼을 눌러 다양한 프로그램에 참여하여<br>당신의 스트레스를 해소해보세요.</p><button onclick="document.getElementById(\'helpPopup\').remove();document.getElementById(\'helpPopupDim\').remove();" style="font-family:\'Jua\',sans-serif;padding:10px 32px;border-radius:50px;border:none;background:linear-gradient(135deg,#7dffc8,#b8f5ff);color:#0a0520;cursor:pointer;font-size:0.95rem;box-shadow:0 0 20px rgba(125,255,200,0.4);">닫기</button>';
    dim.onclick = function() { popup.remove(); dim.remove(); };
    document.body.appendChild(dim);
    document.body.appendChild(popup);
}

function openSettings() {
    isSettingsOpen = true;
    renderPage();
}

function closeSettings() {
    isSettingsOpen = false;
    isMenuOpen = false;
    renderPage();
}

function openGameModal(gameId) {
    selectedGame = gameId;
    renderPage();
}

function closeGameModal() {
    selectedGame = null;
    // 혹시 남은 로딩 오버레이 제거
    const ov = document.getElementById('hubLoadingOverlay');
    if (ov) {
        ov.classList.remove('show');
        setTimeout(() => ov.remove(), 300);
    }
    renderPage();
}


/* ── STUBS for fight-file game pages ── */
function hubBackBtn() {
    return `<button class="hub-back-btn" onclick="navigateToHubWithLoading()">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
        <span>라운지로 돌아가기</span>
    </button>`;
}
function flowerCountDisplay() { return ''; }
var appState = (typeof appState !== 'undefined' && appState.planets) ? appState : { noBattleHit: false, planets: [], planetCreated: false, planetRadius: 0, planetCanvasData: null };

/* ==========================================================================
 * 11. PLANET CREATION / 행성 창조
 * ========================================================================== */
function renderPlanetCreationPage() {
    return `
    <div style="position:fixed;inset:0;background:linear-gradient(to bottom,#0d0d2b,#1a1a3e,#0d0d2b);overflow:hidden;font-family:'Jua',sans-serif;">
        ${createStars()}
        ${hubBackBtn()}
        <!-- Intro / Guide text overlay (above planet) -->
        <div id="pcTextOverlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:60;pointer-events:none;background:transparent;">
            <div id="pcOverlayTxt" style="font-size:clamp(1.4rem,3vw,2.2rem);color:#b8f5ff;text-shadow:0 0 30px rgba(184,245,255,0.6);opacity:1;transition:opacity 0.5s;text-align:center;"></div>
        </div>
        <!-- Planet canvas (always visible, starts white) -->
        <div id="pcPlanetWrap" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
            <div style="position:relative;">
                <canvas id="pcCanvas" style="border-radius:50%;display:block;cursor:crosshair;box-shadow:0 0 0 3px rgba(255,255,255,0.6),0 0 40px rgba(255,255,255,0.4);"></canvas>
            </div>
        </div>
        <!-- Paint tools (hidden until intro done) -->
        <div id="pcTools" style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;z-index:200;opacity:0;pointer-events:none;transition:opacity 0.4s;">
            <div id="pcPalette" style="display:flex;gap:8px;"></div>
            <button id="pcEraserBtn" onclick="pcSetEraser()" style="
                font-family:'Jua',sans-serif;padding:8px 16px;border-radius:50px;border:1px solid rgba(255,255,255,0.3);
                background:rgba(10,5,30,0.8);color:rgba(255,255,255,0.7);cursor:pointer;font-size:0.85rem;
            ">지우기</button>
            <button onclick="pcNextStep('pattern')" style="
                font-family:'Jua',sans-serif;padding:10px 24px;border-radius:50px;border:none;
                background:linear-gradient(135deg,#a6f3e6,#b8f5ff);color:#0a0520;cursor:pointer;font-size:0.95rem;
                box-shadow:0 0 20px rgba(166,243,230,0.4);
            ">무늬 추가 →</button>
        </div>
        <!-- Pattern tools -->
        <div id="pcPatternTools" style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:none;align-items:center;gap:12px;z-index:200;">
            <div style="font-size:0.9rem;color:rgba(184,245,255,0.7);">꾹 눌러서 던지세요 (길게=크게, 짧게=작게)</div>
            <button onclick="pcNextStep('sticker')" style="
                font-family:'Jua',sans-serif;padding:10px 24px;border-radius:50px;border:none;
                background:linear-gradient(135deg,#a6f3e6,#b8f5ff);color:#0a0520;cursor:pointer;font-size:0.95rem;
                box-shadow:0 0 20px rgba(166,243,230,0.4);
            ">스티커 →</button>
        </div>
        <!-- Sticker tools -->
        <div id="pcStickerTools" style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:10px;z-index:200;">
            <div style="font-size:0.9rem;color:rgba(184,245,255,0.7);">스티커를 선택하고 행성을 클릭하세요</div>
            <div id="pcStickerPalette" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;"></div>
            <button onclick="pcComplete()" style="
                font-family:'Jua',sans-serif;padding:10px 28px;border-radius:50px;border:none;
                background:linear-gradient(135deg,#a6f3e6,#b8f5ff);color:#0a0520;cursor:pointer;font-size:0.95rem;
                box-shadow:0 0 20px rgba(166,243,230,0.4);margin-top:4px;
            ">완료 ✓</button>
        </div>
    </div>`;
}

let _pcCtx = null, _pcCanvas = null, _pcR = 0, _pcCx = 0, _pcCy = 0;
let _pcColor = '#ff8fb5', _pcEraser = false;
let _pcPainting = false, _pcPatternMode = false, _pcStickerMode = false;
let _pcLocked = true; // locked during intro text
let _pcDragStart = null, _pcPressStart = 0;
let _pcSelectedSticker = '⭐';

const _pcColors = ['#ff8fb5','#ffa64d','#7dffc8','#b8f5ff','#a78bfa','#ff6b6b','#fff4a3','#ff99cc','#80ffcc','#c8a8ff'];
const _pcPatterns = ['circle','star','triangle','diamond','cross','wave','dot-ring','crescent','pentagon','hexagon'];
const _pcStickers = ['⭐','🌙','💎','🌸','🔥','❄️','🌈'];

function initPlanetCreation() {
    const canvas = document.getElementById('pcCanvas');
    if (!canvas) return;
    _pcCanvas = canvas;
    _pcPatternMode = false;
    _pcStickerMode = false;
    _pcLocked = true;
    _pcEraser = false;

    // size: 75% of viewport height
    _pcR = Math.floor(window.innerHeight * 0.75 / 2);
    const D = _pcR * 2;
    canvas.width = D;
    canvas.height = D;
    _pcCx = _pcR; _pcCy = _pcR;
    _pcCtx = canvas.getContext('2d');

    // Fill white (planet shows white during intro)
    _pcCtx.fillStyle = '#ffffff';
    _pcCtx.beginPath();
    _pcCtx.arc(_pcCx, _pcCy, _pcR - 2, 0, Math.PI*2);
    _pcCtx.fill();

    // Build palette
    const pal = document.getElementById('pcPalette');
    if (pal) pal.innerHTML = _pcColors.map(c => `
        <div onclick="pcSetColor('${c}')" id="pcC${c.replace('#','')}" style="
            width:32px;height:32px;border-radius:50%;background:${c};cursor:pointer;
            border:3px solid ${c==_pcColor?'#fff':'transparent'};
            box-shadow:${c==_pcColor?'0 0 12px '+c:'none'};transition:all 0.2s;
        "></div>`).join('');

    // Build sticker palette
    const sp = document.getElementById('pcStickerPalette');
    if (sp) sp.innerHTML = _pcStickers.map(s => `
        <div onclick="pcSelectSticker('${s}')" id="pcStk${s.codePointAt(0)}" style="
            width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;
            font-size:1.6rem;cursor:pointer;transition:all 0.2s;
            border:2px solid ${s===_pcSelectedSticker?'rgba(184,245,255,0.8)':'rgba(255,255,255,0.2)'};
            background:${s===_pcSelectedSticker?'rgba(184,245,255,0.15)':'rgba(255,255,255,0.05)'};
        ">${s}</div>`).join('');

    // Canvas events
    canvas.addEventListener('mousedown', pcMouseDown);
    canvas.addEventListener('mousemove', pcMouseMove);
    canvas.addEventListener('mouseup',   pcMouseUp);
    canvas.addEventListener('mouseleave',pcMouseUp);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); const t=e.touches[0]; const r=canvas.getBoundingClientRect(); pcMouseDown({clientX:t.clientX,clientY:t.clientY,rect:r}); }, {passive:false});
    canvas.addEventListener('touchmove',  e => { e.preventDefault(); const t=e.touches[0]; const r=canvas.getBoundingClientRect(); pcMouseMove({clientX:t.clientX,clientY:t.clientY,rect:r}); }, {passive:false});
    canvas.addEventListener('touchend',   e => { pcMouseUp(e); }, {passive:false});

    // Show intro text immediately (no 1s delay)
    const txt = document.getElementById('pcOverlayTxt');
    if (txt) txt.textContent = '당신만의 행성을 창조합니다';

    // After 3s fade out → show guide text → fade out → unlock
    setTimeout(() => {
        if (txt) { txt.style.opacity = '0'; }
        setTimeout(() => {
            if (txt) { txt.textContent = '당신의 행성을 꾸며주세요'; txt.style.opacity = '1'; }
            setTimeout(() => {
                if (txt) txt.style.opacity = '0';
                setTimeout(() => {
                    const overlay = document.getElementById('pcTextOverlay');
                    if (overlay) overlay.style.display = 'none';
                    // Unlock painting & show tools
                    _pcLocked = false;
                    // Fill planet with dark base now (replace white)
                    _pcCtx.fillStyle = '#ffffff';
                    _pcCtx.beginPath();
                    _pcCtx.arc(_pcCx, _pcCy, _pcR - 2, 0, Math.PI*2);
                    _pcCtx.fill();
                    const tools = document.getElementById('pcTools');
                    if (tools) { tools.style.opacity = '1'; tools.style.pointerEvents = 'auto'; }
                }, 300);
            }, 1500);
        }, 300);
    }, 1500);
}

function _pcInCircle(x, y) {
    return Math.sqrt((x-_pcCx)**2 + (y-_pcCy)**2) <= _pcR - 2;
}

function pcMouseDown(e) {
    if (_pcLocked) return;
    _pcPainting = true;
    _pcPressStart = Date.now();
    const rect = e.rect || _pcCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (_pcPatternMode) {
        _pcDragStart = {x, y};
        return;
    }
    if (_pcStickerMode) return;
    if (!_pcInCircle(x, y)) return;
    _pcCtx.beginPath();
    _pcCtx.moveTo(x, y);
}

function pcMouseMove(e) {
    if (!_pcPainting || _pcLocked) return;
    const rect = e.rect || _pcCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (_pcPatternMode || _pcStickerMode) return;
    if (!_pcInCircle(x, y)) return;
    _pcCtx.save();
    _pcCtx.beginPath();
    _pcCtx.arc(_pcCx, _pcCy, _pcR-2, 0, Math.PI*2);
    _pcCtx.clip();
    if (_pcEraser) {
        _pcCtx.strokeStyle = '#ffffff';
        _pcCtx.lineWidth = 20;
    } else {
        _pcCtx.strokeStyle = _pcColor;
        _pcCtx.lineWidth = 16;
    }
    _pcCtx.lineCap = 'round';
    _pcCtx.lineJoin = 'round';
    _pcCtx.lineTo(x, y);
    _pcCtx.stroke();
    _pcCtx.beginPath();
    _pcCtx.moveTo(x, y);
    _pcCtx.restore();
}

function pcMouseUp(e) {
    if (!_pcPainting || _pcLocked) return;
    _pcPainting = false;
    const pressDuration = Date.now() - _pcPressStart;

    if (_pcPatternMode && _pcDragStart) {
        const rect = _pcCanvas.getBoundingClientRect();
        let ex, ey;
        if (e && e.changedTouches && e.changedTouches.length) {
            ex = e.changedTouches[0].clientX - rect.left;
            ey = e.changedTouches[0].clientY - rect.top;
        } else if (e && e.clientX !== undefined) {
            ex = e.clientX - rect.left;
            ey = e.clientY - rect.top;
        } else {
            ex = _pcDragStart.x; ey = _pcDragStart.y;
        }
        // Direction of drag → pattern explodes in opposite direction
        const dx = ex - _pcDragStart.x, dy = ey - _pcDragStart.y;
        const dragLen = Math.sqrt(dx*dx+dy*dy);
        // Launch point = drag start; explode direction = opposite of drag
        const lx = _pcDragStart.x, ly = _pcDragStart.y;
        if (_pcInCircle(lx, ly)) {
            // Size based on press duration: short(<300ms)=small, long(>1000ms)=large
            const sizeScale = Math.min(Math.max(pressDuration / 400, 0.5), 3.5);
            // Burst: draw multiple patterns in opposite-drag direction
            const count = 3 + Math.floor(Math.random() * 2); // 3~4개 랜덤
            const oppAngle = Math.atan2(-dy, -dx);
            for (let i = 0; i < count; i++) {
                const spread = (Math.random() - 0.5) * 1.2;
                const dist = 20 + Math.random() * 40;
                const bx = lx + Math.cos(oppAngle + spread) * dist;
                const by = ly + Math.sin(oppAngle + spread) * dist;
               if (_pcInCircle(bx, by)) {
                  pcDrawPattern(bx, by, sizeScale);
               } else {
                 pcDrawPattern(lx, ly, sizeScale);
               }
         }
        _pcDragStart = null;
    }
}

    if (_pcStickerMode) {
        const rect = _pcCanvas.getBoundingClientRect();
        let sx, sy;
        if (e && e.changedTouches && e.changedTouches.length) {
            sx = e.changedTouches[0].clientX - rect.left;
            sy = e.changedTouches[0].clientY - rect.top;
        } else if (e && e.clientX !== undefined) {
            sx = e.clientX - rect.left;
            sy = e.clientY - rect.top;
        } else return;
        if (_pcInCircle(sx, sy)) {
            pcPlaceSticker(sx, sy, _pcSelectedSticker);
        }
    }
}

function pcSetColor(c) {
    _pcColor = c;
    _pcEraser = false;
    document.querySelectorAll('[id^="pcC"]').forEach(el => {
        const ec = '#' + el.id.replace('pcC','');
        el.style.border = ec === c ? '3px solid #fff' : '3px solid transparent';
        el.style.boxShadow = ec === c ? '0 0 12px '+c : 'none';
    });
}

function pcSetEraser() {
    _pcEraser = true;
    document.querySelectorAll('[id^="pcC"]').forEach(el => {
        el.style.border = '3px solid transparent';
        el.style.boxShadow = 'none';
    });
}

function pcSelectSticker(s) {
    _pcSelectedSticker = s;
    document.querySelectorAll('[id^="pcStk"]').forEach(el => {
        const match = el.textContent === s;
        el.style.border = match ? '2px solid rgba(184,245,255,0.8)' : '2px solid rgba(255,255,255,0.2)';
        el.style.background = match ? 'rgba(184,245,255,0.15)' : 'rgba(255,255,255,0.05)';
    });
}

function pcPlaceSticker(x, y, sticker) {
    const ctx = _pcCtx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(_pcCx, _pcCy, _pcR-2, 0, Math.PI*2);
    ctx.clip();
    ctx.font = `${_pcR * 0.15}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sticker, x, y);
    ctx.restore();
}

function pcNextStep(step) {
    if (step === 'pattern') {
        _pcPatternMode = true;
        _pcStickerMode = false;
        document.getElementById('pcTools').style.display = 'none';
        const pt = document.getElementById('pcPatternTools');
        pt.style.display = 'flex';
    } else if (step === 'sticker') {
        _pcPatternMode = false;
        _pcStickerMode = true;
        document.getElementById('pcPatternTools').style.display = 'none';
        const st = document.getElementById('pcStickerTools');
        st.style.display = 'flex';
    }
}

function pcDrawPattern(x, y, sizeScale) {
    const pattern = _pcPatterns[Math.floor(Math.random() * _pcPatterns.length)];
    const baseSize = 12 + Math.floor(Math.random()*4)*8;
    const size = baseSize * (sizeScale || 1);
    const colors = ['#ff8fb5','#ffa64d','#7dffc8','#b8f5ff','#a78bfa','#ffff99','#ff99cc','#80e5ff'];
    const col = colors[Math.floor(Math.random()*colors.length)];
    const ctx = _pcCtx;

    ctx.save();
    ctx.beginPath();
    ctx.arc(_pcCx, _pcCy, _pcR-2, 0, Math.PI*2);
    ctx.clip();
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.75 + Math.random() * 0.25;
    const angle = Math.random() * Math.PI * 2;
    ctx.translate(x, y);
    ctx.rotate(angle);

    switch(pattern) {
        case 'circle':
            ctx.beginPath(); ctx.arc(0, 0, size/2, 0, Math.PI*2); ctx.fill(); break;
        case 'star':
            ctx.beginPath();
            for (let i=0;i<10;i++) {
                const r2 = i%2===0 ? size/2 : size/4;
                const a = i/10*Math.PI*2 - Math.PI/2;
                i===0 ? ctx.moveTo(Math.cos(a)*r2,Math.sin(a)*r2) : ctx.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);
            }
            ctx.closePath(); ctx.fill(); break;
        case 'triangle':
            ctx.beginPath();
            ctx.moveTo(0,-size/2); ctx.lineTo(size/2,size/2); ctx.lineTo(-size/2,size/2);
            ctx.closePath(); ctx.fill(); break;
        case 'diamond':
            ctx.beginPath();
            ctx.moveTo(0,-size/2); ctx.lineTo(size/2,0); ctx.lineTo(0,size/2); ctx.lineTo(-size/2,0);
            ctx.closePath(); ctx.fill(); break;
        case 'cross':
            ctx.fillRect(-size/6,-size/2,size/3,size);
            ctx.fillRect(-size/2,-size/6,size,size/3); break;
        case 'wave':
            ctx.lineWidth = 3; ctx.beginPath();
            for (let i=-size/2;i<size/2;i+=2) {
                const wy = Math.sin(i/size*Math.PI*4)*size/4;
                i===(-Math.floor(size/2)) ? ctx.moveTo(i,wy) : ctx.lineTo(i,wy);
            }
            ctx.stroke(); break;
        case 'dot-ring':
            for(let i=0;i<8;i++) {
                const a=i/8*Math.PI*2;
                ctx.beginPath(); ctx.arc(Math.cos(a)*size/2,Math.sin(a)*size/2,size/8,0,Math.PI*2); ctx.fill();
            } break;
        case 'crescent':
            ctx.beginPath(); ctx.arc(0,0,size/2,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#0a0520';
            ctx.beginPath(); ctx.arc(size/4,0,size/2.5,0,Math.PI*2); ctx.fill(); break;
        case 'pentagon':
            ctx.beginPath();
            for(let i=0;i<5;i++) {
                const a=i/5*Math.PI*2-Math.PI/2;
                i===0?ctx.moveTo(Math.cos(a)*size/2,Math.sin(a)*size/2):ctx.lineTo(Math.cos(a)*size/2,Math.sin(a)*size/2);
            }
            ctx.closePath(); ctx.fill(); break;
        default:
            ctx.beginPath();
            for(let i=0;i<6;i++) {
                const a=i/6*Math.PI*2;
                i===0?ctx.moveTo(Math.cos(a)*size/2,Math.sin(a)*size/2):ctx.lineTo(Math.cos(a)*size/2,Math.sin(a)*size/2);
            }
            ctx.closePath(); ctx.fill(); break;
    }
    ctx.restore();
}

function pcComplete() {
    if (!_pcCanvas) { navigateToHubWithLoading(); return; }
    if (appState.planets.length >= 3) { navigateToHubWithLoading(); return; }
    const dataURL = _pcCanvas.toDataURL();
    appState.planets.push({ canvasData: dataURL, radius: _pcR });
    appState.planetCreated = true;
    appState.planetCanvasData = appState.planets[0].canvasData;
    appState.planetRadius = appState.planets[0].radius;
    navigateToHubWithLoading();
}

/* ==========================================================================
 * 12-13. PUNCH / 격투실 (fight file)
 * ========================================================================== */
/* ==========================================================================
 * 12-13. PUNCH / 격투실 (fight file)
 * ========================================================================== */
function renderPunchPage() {
    return `
    <div style="position:fixed;inset:0;background:#5a5a5e;overflow:hidden;font-family:'Jua',sans-serif;">
        ${hubBackBtn()}
        ${flowerCountDisplay()}

        <!-- 타이머 -->

        <!-- 캔버스 (외계인 + 배경) -->
        <canvas id="punchCanvas" style="position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;"></canvas>

        <!-- 도구 선택 바 -->
        <div id="toolBar" style="
            position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
            display:flex;gap:18px;align-items:flex-end;z-index:60;
            background:rgba(20,20,22,0.72);border:1px solid rgba(180,180,185,0.25);
            border-radius:60px;padding:14px 28px;backdrop-filter:blur(10px);
        ">
        </div>

        <!-- 투척 중인 도구 (JS로 동적 생성) -->
        <div id="throwOverlay" style="position:fixed;inset:0;pointer-events:none;z-index:55;"></div>

        <!-- Result popup -->
        <div id="punchResult" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:200;align-items:center;justify-content:center;">
            <div style="background:linear-gradient(135deg,rgba(40,38,36,0.98),rgba(28,26,24,0.98));border:1px solid rgba(180,180,160,0.25);border-radius:24px;padding:36px;text-align:center;max-width:380px;">
                <div id="punchResultIcon" style="font-size:3rem;margin-bottom:14px;"></div>
                <div id="punchResultMsg" style="font-size:1.2rem;color:#d4c8a0;margin-bottom:24px;"></div>
                <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                    <button onclick="punchRestart()" style="
                        font-family:'Jua',sans-serif;padding:10px 24px;border-radius:50px;
                        border:1px solid rgba(180,170,140,0.4);background:rgba(255,255,255,0.08);
                        color:#d4c8a0;cursor:pointer;font-size:0.95rem;transition:all 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.18)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">🔄 다시하기</button>
                    <button onclick="navigateToHubWithLoading()" style="
                        font-family:'Jua',sans-serif;padding:10px 24px;border-radius:50px;border:none;
                        background:linear-gradient(135deg,#c8b87a,#a09050);color:#1a1800;cursor:pointer;font-size:0.95rem;
                    ">← 라운지로</button>
                </div>
            </div>
        </div>
    </div>`;
}

// ── 도구 정의 ──────────────────────────────────────────────────────────────
const _punchTools = [
    {
        id: 'glove',
        label: '글로브',
        damage: 3,
        direct: true,   // 투척 없이 즉각 타격
        draw(ctx, x, y, size, angle) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle);

            // 손목 부분
            ctx.fillStyle = '#cc2200';
            ctx.beginPath();
            ctx.roundRect(-size*0.38, size*0.3, size*0.76, size*0.65, size*0.12);
            ctx.fill();

            // 글로브 주먹 몸통
            const g = ctx.createRadialGradient(-size*0.1, -size*0.1, 0, 0, 0, size*0.85);
            g.addColorStop(0, '#ff4422'); g.addColorStop(1, '#991100');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(0, -size*0.05, size*0.72, size*0.58, 0, 0, Math.PI*2);
            ctx.fill();

            // 손가락 마디 구분선
            ctx.save();
            ctx.strokeStyle = '#881100'; ctx.lineWidth = size*0.06;
            ctx.lineCap = 'round';
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.moveTo(i * size*0.28, -size*0.38);
                ctx.lineTo(i * size*0.28, size*0.08);
                ctx.stroke();
            }
            ctx.restore();

            // 엄지손가락
            ctx.fillStyle = '#dd3311';
            ctx.beginPath();
            ctx.ellipse(-size*0.62, -size*0.18, size*0.22, size*0.16, -0.5, 0, Math.PI*2);
            ctx.fill();

            // 하이라이트
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(-size*0.15, -size*0.25, size*0.32, size*0.18, -0.3, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();

            // 손목 밴드 흰 줄
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-size*0.38, size*0.3, size*0.76, size*0.1);

            ctx.restore();
        }
    },
    {
        id: 'rock',
        label: '돌',
        damage: 1,
        // 불규칙 다각형 돌
        draw(ctx, x, y, size, angle) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
            ctx.beginPath();
            const pts = [[0,-1],[0.55,-0.75],[0.85,-0.2],[0.7,0.5],[0.1,0.9],[-0.55,0.75],[-0.85,0.1],[-0.6,-0.6]];
            ctx.moveTo(pts[0][0]*size, pts[0][1]*size);
            pts.forEach(p => ctx.lineTo(p[0]*size, p[1]*size));
            ctx.closePath();
            const g = ctx.createRadialGradient(-size*0.2,-size*0.2,0,0,0,size);
            g.addColorStop(0,'#b0b0a8'); g.addColorStop(1,'#606060');
            ctx.fillStyle = g; ctx.fill();
            ctx.strokeStyle = '#3a3a38'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.restore();
        }
    },
    {
        id: 'stone2',
        label: '조약돌',
        damage: 1,
        draw(ctx, x, y, size, angle) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
            ctx.beginPath();
            const pts = [[0,-0.7],[0.45,-0.55],[0.7,0.1],[0.4,0.65],[-0.2,0.7],[-0.65,0.2],[-0.6,-0.4]];
            ctx.moveTo(pts[0][0]*size, pts[0][1]*size);
            pts.forEach(p => ctx.lineTo(p[0]*size, p[1]*size));
            ctx.closePath();
            const g = ctx.createRadialGradient(-size*0.15,-size*0.15,0,0,0,size);
            g.addColorStop(0,'#9a9890'); g.addColorStop(1,'#505048');
            ctx.fillStyle = g; ctx.fill();
            ctx.strokeStyle = '#2a2a28'; ctx.lineWidth = 1.2; ctx.stroke();
            ctx.restore();
        }
    },
    {
        id: 'shard',
        label: '파편',
        damage: 2,
        draw(ctx, x, y, size, angle) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
            ctx.beginPath();
            const pts = [[0,-1],[0.3,-0.3],[1,0],[0.2,0.4],[0.5,1],[-0.2,0.5],[-0.8,0.8],[-0.4,0],[-0.9,-0.3]];
            ctx.moveTo(pts[0][0]*size, pts[0][1]*size);
            pts.forEach(p => ctx.lineTo(p[0]*size, p[1]*size));
            ctx.closePath();
            const g = ctx.createRadialGradient(0,0,0,0,0,size);
            g.addColorStop(0,'#c8c4b8'); g.addColorStop(1,'#787060');
            ctx.fillStyle = g; ctx.fill();
            ctx.strokeStyle = '#302820'; ctx.lineWidth = 1; ctx.stroke();
            // 하이라이트
            ctx.save(); ctx.globalAlpha=0.5; ctx.strokeStyle='#fff'; ctx.lineWidth=1;
            ctx.beginPath(); ctx.moveTo(-size*0.1,-size*0.8); ctx.lineTo(size*0.2,-size*0.1); ctx.stroke();
            ctx.restore();
            ctx.restore();
        }
    },
    {
        id: 'stick',
        label: '막대기',
        damage: 2,
        draw(ctx, x, y, size, angle) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI/6);
            ctx.beginPath();
            ctx.roundRect(-size*0.15, -size, size*0.3, size*2.2, size*0.1);
            const g = ctx.createLinearGradient(-size*0.15,0,size*0.15,0);
            g.addColorStop(0,'#8B6914'); g.addColorStop(0.5,'#C49A2A'); g.addColorStop(1,'#7A5A10');
            ctx.fillStyle = g; ctx.fill();
            ctx.strokeStyle='#3a2800'; ctx.lineWidth=1.2; ctx.stroke();
            // 나뭇결
            ctx.save(); ctx.globalAlpha=0.25; ctx.strokeStyle='#2a1800'; ctx.lineWidth=1;
            for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(i*size*0.04,-size*0.8);ctx.lineTo(i*size*0.05,size*1.0);ctx.stroke();}
            ctx.restore();
            ctx.restore();
        }
    },
    {
        id: 'bandage',
        label: '붕대',
        damage: -5,   // 음수 = 회복
        draw(ctx, x, y, size, angle) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle);

            // 붕대 롤 — 원형 몸통
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.75, 0, Math.PI * 2);
            ctx.fillStyle = '#f5f0e8';
            ctx.fill();
            ctx.strokeStyle = '#d4c9a8'; ctx.lineWidth = 1.5; ctx.stroke();

            // 붕대 감긴 선들
            ctx.save();
            ctx.strokeStyle = '#e8dfc0'; ctx.lineWidth = 2;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(-size * 0.75, i * size * 0.22);
                ctx.lineTo( size * 0.75, i * size * 0.22);
                ctx.stroke();
            }
            ctx.restore();

            // 붕대 풀린 끝 (오른쪽으로 삐죽)
            ctx.save();
            ctx.fillStyle = '#f5f0e8';
            ctx.strokeStyle = '#d4c9a8'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(size * 0.7,  -size * 0.18);
            ctx.lineTo(size * 1.7,  -size * 0.18);
            ctx.lineTo(size * 1.7,   size * 0.18);
            ctx.lineTo(size * 0.7,   size * 0.18);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // 붕대 끝 세로선
            ctx.strokeStyle = '#e8dfc0'; ctx.lineWidth = 1.5;
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.moveTo(size * 0.9 + i * size * 0.28, -size * 0.18);
                ctx.lineTo(size * 0.9 + i * size * 0.28,  size * 0.18);
                ctx.stroke();
            }
            ctx.restore();

            // 빨간 십자 표시
            ctx.save();
            ctx.fillStyle = '#e83030';
            ctx.fillRect(-size * 0.12, -size * 0.38, size * 0.24, size * 0.75);
            ctx.fillRect(-size * 0.38, -size * 0.12, size * 0.75, size * 0.24);
            ctx.restore();

            ctx.restore();
        }
    },
];

let _punchCanvas, _punchCtx, _punchAnimId;
let _punchBall = null;
let _punchTimer = 50;
let _punchTimerInterval = null;
let _punchDone = false;
let _punchStartTime = 0;
let _punchHitAnim = 0;
let _punchHitSide = 'right';
let _punchShakeX = 0, _punchShakeY = 0;
let _punchHitShake = 0;
let _punchAlienImg = null;
let _punchSelectedTool = 0;   // 현재 선택된 도구 index
let _punchProjectiles = [];    // 날아가는 투척물들
let _punchHealAnim = 0;        // 회복 애니메이션 프레임
let _punchHealPhase = false;   // 현재 회복 중 여부
let _punchCycleCount = 0;      // 몇 사이클째인지
// 외계인 이미지: 기본(alien_1) + HP 변화 시 랜덤(alien_2~alien_7)
let _punchAlienImgs = { base: null, hits: [], dead: null };
let _punchLastHpChangeTime = 0;
(function() {
    const baseImg = new Image();
    baseImg.src = '%EC%9E%90%EB%A3%8C/%EA%B2%A9%ED%88%AC%EC%8B%A4/alien_1.png';
    baseImg.onload = () => {
        _punchAlienImgs.base = baseImg;
        if (!_punchAlienImg) _punchAlienImg = baseImg;
    };
    ['%EC%9E%90%EB%A3%8C/%EA%B2%A9%ED%88%AC%EC%8B%A4/alien_2.png', '%EC%9E%90%EB%A3%8C/%EA%B2%A9%ED%88%AC%EC%8B%A4/alien_3.png', '%EC%9E%90%EB%A3%8C/%EA%B2%A9%ED%88%AC%EC%8B%A4/alien_4.png', '%EC%9E%90%EB%A3%8C/%EA%B2%A9%ED%88%AC%EC%8B%A4/alien_5.png', '%EC%9E%90%EB%A3%8C/%EA%B2%A9%ED%88%AC%EC%8B%A4/alien_6.png', '%EC%9E%90%EB%A3%8C/%EA%B2%A9%ED%88%AC%EC%8B%A4/alien_7.png'].forEach(src => {
        const im = new Image();
        im.src = src;
        im.onload = () => { _punchAlienImgs.hits.push(im); };
    });
    // HP=0 전용 이미지 (alien_7)
    const deadImg = new Image();
    deadImg.src = '%EC%9E%90%EB%A3%8C/%EA%B2%A9%ED%88%AC%EC%8B%A4/alien_7.png';
    deadImg.onload = () => { _punchAlienImgs.dead = deadImg; };
})();
// HP 변화(감소/증가) 시 외계인 이미지를 alien_2~alien_7 중 랜덤으로 변경
// 단, HP가 0이면 alien_7로 고정
function _punchSwapAlienOnHit() {
    if (_punchBall && _punchBall.hp <= 0) {
        if (_punchAlienImgs.dead) {
            _punchAlienImg = _punchAlienImgs.dead;
        } else if (_punchAlienImgs.hits && _punchAlienImgs.hits.length > 0) {
            _punchAlienImg = _punchAlienImgs.hits[_punchAlienImgs.hits.length - 1];
        }
        return;
    }
    if (_punchAlienImgs.hits && _punchAlienImgs.hits.length > 0) {
        const idx = Math.floor(Math.random() * _punchAlienImgs.hits.length);
        _punchAlienImg = _punchAlienImgs.hits[idx];
    }
}
function _punchResetAlienImg() {
    if (_punchAlienImgs.base) _punchAlienImg = _punchAlienImgs.base;
}

function _isPunchAlienMode() { return appState.noBattleHit; }

function initPunch() {
    const canvas = document.getElementById('punchCanvas');
    if (!canvas) return;
    _punchCanvas = canvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    _punchCtx = canvas.getContext('2d');
    _punchDone = false;
    _punchTimer = 60;
    _punchStartTime = Date.now();
    _punchHitAnim = 0;
    _punchShakeX = 0; _punchShakeY = 0;
    _punchHitShake = 0;
    _punchProjectiles = [];
    _punchSelectedTool = 0;
    _punchHealAnim = 0;
    _punchHealPhase = false;
    _punchCycleCount = 0;
    _punchResetAlienImg();

    _punchBall = {
        x: canvas.width/2, y: canvas.height * 0.44,
        hp: 50, maxHp: 50,
        radius: 150, hitAnim: 0
    };

    // ── 도구 선택 버튼 렌더 ──
    _renderToolBar();

    // ── 클릭 → 투척 ──
    canvas.addEventListener('click', e => {
        if (_punchDone) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const tool = _punchTools[_punchSelectedTool];
        const b = _punchBall;
        const alienImgW2 = b.radius * 4.2, alienImgH2 = b.radius * 4.8;
        const hitL = b.x - alienImgW2/2, hitR = b.x + alienImgW2/2;
        const hitT = b.y - alienImgH2/2, hitBt = b.y + alienImgH2/2;

        if (tool.direct) {
            // 복싱글로브: 클릭 위치가 외계인 영역이면 즉각 타격
           if (mx >= hitL && mx <= hitR && my >= hitT && my <= hitBt) {
    if (tool.damage < 0) { AudioManager.play('heal'); setTimeout(() => AudioManager.stop('heal'), 1000); } else { AudioManager.play('hit'); }
    const _prevHp = b.hp;
    b.hp = Math.min(b.maxHp, Math.max(0, b.hp - tool.damage));
                b.hitAnim = 14;
                if (tool.damage < 0) { _punchHealAnim = 18; } else { _punchHitAnim = 18; }
                if (b.hp !== _prevHp) {
                    if (b.hp >= b.maxHp || b.hp > _prevHp) { _punchResetAlienImg(); }
                    else { _punchSwapAlienOnHit(); _punchHitShake = 14; }
                    _punchLastHpChangeTime = Date.now();
                }
                _punchShakeX = (Math.random()-0.5)*32;
                _punchShakeY = (Math.random()-0.5)*20;
                // 펀치 이펙트 파티클
                _punchProjectiles.push({
                    x: mx, y: my, tx: mx, ty: my,
                    tool: tool, progress: 0.6,  // 이미 명중 위치에서 시작
                    size: 36, angle: Math.random()*Math.PI*2,
                    spin: 0, hit: true, flash: true,
                });
                if (b.hp <= 0 && !_punchDone) _punchCycleCount++;
            }
            // 글로브 커서 애니메이션
            const cursor = document.getElementById('punchCursor');
            if (cursor) {
                cursor.style.transform = 'translate(-50%,-50%) scale(1.8) rotate(-30deg)';
                setTimeout(() => { if(cursor) cursor.style.transform = 'translate(-50%,-50%) scale(1)'; }, 120);
            }
        } else {
            // 투척 도구: 하단에서 목표로 포물선 투척
            const startX = canvas.width / 2 + (Math.random()-0.5)*80;
            const startY = canvas.height - 100;
            _punchProjectiles.push({
                x: startX, y: startY,
                tx: mx, ty: my,
                tool: tool,
                progress: 0,
                size: 22 + Math.random()*10,
                angle: Math.random() * Math.PI * 2,
                spin: (Math.random()-0.5) * 0.3,
                hit: false,
            });
        }
    });



    punchLoop();
}

function _renderToolBar() {
    const bar = document.getElementById('toolBar');
    if (!bar) return;
    // 기존 버튼 제거 (label 제외)
    Array.from(bar.querySelectorAll('.tool-btn')).forEach(el => el.remove());
    _punchTools.forEach((tool, i) => {
        // 미리보기 캔버스
        const cvs = document.createElement('canvas');
        cvs.width = 64; cvs.height = 64;
        const ctx2 = cvs.getContext('2d');
        tool.draw(ctx2, 32, 32, 20, Math.PI/8);
        const btn = document.createElement('div');
        btn.className = 'tool-btn';
        btn.style.cssText = `
            display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;
            padding:6px 10px;border-radius:14px;transition:all 0.18s;
            border: 2px solid ${i===_punchSelectedTool ? 'rgba(200,220,255,0.8)' : 'transparent'};
            background: ${i===_punchSelectedTool ? 'rgba(180,200,255,0.15)' : 'transparent'};
        `;
        btn.appendChild(cvs);
        const lbl = document.createElement('div');
        lbl.textContent = tool.label;
        lbl.style.cssText = 'font-size:0.72rem;color:rgba(210,210,220,0.85);letter-spacing:0.5px;font-family:Jua,sans-serif;';
        btn.appendChild(lbl);
        btn.addEventListener('click', () => {
            _punchSelectedTool = i;
            _renderToolBar();
            const cursor = document.getElementById('punchCursor');
            if (cursor) cursor.textContent = _punchTools[i].direct ? '🥊' : '🎯';
        });
        bar.appendChild(btn);
    });
}

function punchLoop() {
    if (_punchDone || !_punchCanvas) return;
    const canvas = _punchCanvas, ctx = _punchCtx;
    const W = canvas.width, H = canvas.height;

    // 0.5초간 HP 변화가 없으면 외계인 이미지를 기본(alien_1)으로 복귀
    // 단, HP가 0이면 alien_7 상태를 유지
    if (_punchLastHpChangeTime > 0 && Date.now() - _punchLastHpChangeTime >= 500) {
        if (_punchBall && _punchBall.hp <= 0) {
            if (_punchAlienImgs.dead && _punchAlienImg !== _punchAlienImgs.dead) {
                _punchAlienImg = _punchAlienImgs.dead;
            }
        } else if (_punchAlienImgs.base && _punchAlienImg !== _punchAlienImgs.base) {
            _punchResetAlienImg();
        }
    }

    ctx.clearRect(0, 0, W, H);

    // === 배경: 콘크리트 벽 (이미지와 통일) ===
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   '#4a4a4e');
    bg.addColorStop(0.5, '#5c5c60');
    bg.addColorStop(1,   '#3e3e42');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(30,30,32,0.55)';
    ctx.lineWidth = 2;
    const panelW = W / 3, panelH = H / 2;
    for (let x = panelW; x < W; x += panelW) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = panelH; y < H; y += panelH) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,20,22,0.5)';
    const rivets = [[panelW,panelH],[panelW*2,panelH],[panelW,0],[panelW*2,0],[panelW,H],[panelW*2,H],[0,panelH],[W,panelH]];
    rivets.forEach(([rx,ry]) => {
        ctx.beginPath(); ctx.arc(rx, ry, 6, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(80,80,85,0.6)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(rx, ry, 6, 0, Math.PI*2); ctx.stroke();
    });
    const floorY = H * 0.88;
    const floorGrad = ctx.createLinearGradient(0, floorY-2, 0, floorY+28);
    floorGrad.addColorStop(0,   'rgba(140,210,255,0.9)');
    floorGrad.addColorStop(0.3, 'rgba(100,180,255,0.5)');
    floorGrad.addColorStop(1,   'rgba(60,140,220,0)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY-2, W, 30);
    const tileGrad = ctx.createLinearGradient(0, floorY+10, 0, H);
    tileGrad.addColorStop(0, '#7a7e88'); tileGrad.addColorStop(1, '#50545c');
    ctx.fillStyle = tileGrad; ctx.fillRect(0, floorY+10, W, H-floorY-10);
    const spotlight = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, H*0.75);
    spotlight.addColorStop(0,   'rgba(200,215,230,0.18)');
    spotlight.addColorStop(0.6, 'rgba(150,170,190,0.06)');
    spotlight.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = spotlight; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const b = _punchBall;
    _punchShakeX *= 0.75; _punchShakeY *= 0.75;
    if (_punchHitShake > 0) _punchHitShake--;
    if (b.hitAnim > 0) b.hitAnim--;
    if (_punchHitAnim > 0) _punchHitAnim--;
    if (_punchHealAnim > 0) _punchHealAnim--;

    // === 외계인 그리기 ===
    {
        const isHit = _punchHitAnim > 0;
        const isHealing = _punchHealAnim > 0 || _punchHealPhase;
        const imgW = b.radius * 4.2;
        const imgH = b.radius * 4.8;
        // 타격 시 진동(데미지를 받은 직후 좌우 흔들림)
        let _hitOscX = 0, _hitOscY = 0;
        if (_punchHitShake > 0) {
            const _hs = _punchHitShake;
            const _amp = _hs * 1.4; // 진폭: 시작 ~19.6px → 0
            _hitOscX = Math.sin(_hs * 1.6) * _amp;
            _hitOscY = Math.cos(_hs * 1.9) * _amp * 0.45;
        }
        const drawX = b.x - imgW / 2 + _punchShakeX + _hitOscX;
        const drawY = b.y - imgH / 2 + _punchShakeY + _hitOscY;

        ctx.save();
        if (isHit) {
            ctx.save();
            ctx.globalAlpha = 0.4;
            const hitGlow = ctx.createRadialGradient(b.x+_punchShakeX, b.y+_punchShakeY, 0, b.x+_punchShakeX, b.y+_punchShakeY, b.radius*2.2);
            hitGlow.addColorStop(0, 'rgba(255,60,60,0.7)');
            hitGlow.addColorStop(1, 'rgba(255,60,60,0)');
            ctx.fillStyle = hitGlow;
            ctx.beginPath(); ctx.arc(b.x+_punchShakeX, b.y+_punchShakeY, b.radius*2.2, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
        if (_punchAlienImg) {
            ctx.drawImage(_punchAlienImg, drawX, drawY, imgW, imgH);
            if (isHealing) {
                // 초록 회복 글로우
                ctx.save();
                const healPulse = 0.3 + 0.25 * Math.sin(Date.now() * 0.012);
                ctx.globalAlpha = healPulse;
                const healGlow = ctx.createRadialGradient(b.x+_punchShakeX, b.y+_punchShakeY, 0, b.x+_punchShakeX, b.y+_punchShakeY, b.radius*2.8);
                healGlow.addColorStop(0, 'rgba(80,255,120,0.9)');
                healGlow.addColorStop(0.5, 'rgba(60,200,80,0.4)');
                healGlow.addColorStop(1, 'rgba(0,255,60,0)');
                ctx.fillStyle = healGlow;
                ctx.beginPath(); ctx.arc(b.x+_punchShakeX, b.y+_punchShakeY, b.radius*2.8, 0, Math.PI*2); ctx.fill();
                // ✚ 회복 텍스트
                ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() * 0.01);
                ctx.font = "bold 32px 'Jua',sans-serif";
                ctx.fillStyle = '#80ff80';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = '#00ff60';
                ctx.shadowBlur = 18;
                ctx.fillText('💉 회복 중...', W/2, 110);
                ctx.restore();
            }
        } else {
            ctx.fillStyle = isHit ? '#ff6666' : '#a0e070';
            ctx.beginPath(); ctx.arc(b.x+_punchShakeX, b.y+_punchShakeY, b.radius, 0, Math.PI*2); ctx.fill();
        }

        ctx.restore();
    }

    // === HP 바 (ctx.save 밖에서 화면 상단 고정으로 그림) ===
    {
        const isHealing = _punchHealAnim > 0 || _punchHealPhase;
        const hpRatio = b.hp / b.maxHp;
        const barW = Math.min(W * 0.55, 420);
        const barH = 22;
        const barX = W/2 - barW/2;
        const barY = 68;

        // 배경 트랙
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath(); ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 8); ctx.fill();

        // 배경 (빈 부분)
        ctx.fillStyle = 'rgba(60,60,65,0.9)';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 6); ctx.fill();

        // HP 채워진 부분
        if (hpRatio > 0) {
            const hpColor = isHealing
                ? `hsl(120,90%,${50 + 12*Math.sin(Date.now()*0.012)}%)`
                : `hsl(${Math.round(120*hpRatio)},88%,48%)`;
            ctx.fillStyle = hpColor;
            ctx.beginPath(); ctx.roundRect(barX, barY, barW * hpRatio, barH, 6); ctx.fill();

            // 반짝임 하이라이트
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.roundRect(barX, barY, barW * hpRatio, barH * 0.45, 6); ctx.fill();
            ctx.restore();
        }

        // 테두리
        ctx.strokeStyle = 'rgba(200,200,210,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 6); ctx.stroke();

        // HP 텍스트
        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 13px 'Jua',sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
        ctx.fillText(`HP  ${b.hp} / ${b.maxHp}`, W/2, barY + barH/2);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // === 투척물 업데이트 & 그리기 ===
    const alienImgW = b.radius * 4.2, alienImgH = b.radius * 4.8;
    const hitLeft  = b.x - alienImgW/2, hitRight = b.x + alienImgW/2;
    const hitTop   = b.y - alienImgH/2, hitBottom = b.y + alienImgH/2;

    _punchProjectiles = _punchProjectiles.filter(p => {
        if (p.progress >= 1) return false;  // 제거
        p.progress += 0.045;
        if (p.progress > 1) p.progress = 1;

        // 포물선 경로
        const t = p.progress;
        const px = p.x + (p.tx - p.x) * t;
        const arcH = Math.min(W, H) * 0.3;
        const py = p.y + (p.ty - p.y) * t - arcH * Math.sin(Math.PI * t);
        p.angle += p.spin;

        p.tool.draw(ctx, px, py, p.size, p.angle);

        // 명중 판정 (progress 0.85~1 구간, 한번만)
        if (!p.hit && p.progress > 0.82) {
    if (px >= hitLeft && px <= hitRight && py >= hitTop && py <= hitBottom) {
        p.hit = true;
        if (p.tool.damage < 0) { AudioManager.play('heal'); setTimeout(() => AudioManager.stop('heal'), 1000); } else { AudioManager.play('hit'); }
        const _prevHpP = b.hp;
        b.hp = Math.min(b.maxHp, Math.max(0, b.hp - p.tool.damage));
                b.hitAnim = 14;
                if (p.tool.damage < 0) { _punchHealAnim = 14; } else { _punchHitAnim = 14; }
                if (b.hp !== _prevHpP) {
                    if (b.hp >= b.maxHp || b.hp > _prevHpP) { _punchResetAlienImg(); }
                    else { _punchSwapAlienOnHit(); _punchHitShake = 14; }
                    _punchLastHpChangeTime = Date.now();
                }
                _punchShakeX = (Math.random()-0.5)*24;
                _punchShakeY = (Math.random()-0.5)*16;
                if (b.hp <= 0 && !_punchDone) {
                    _punchCycleCount++;
                }
            }
        }
        return p.progress < 1;
    });

    _punchAnimId = requestAnimationFrame(punchLoop);
}

function punchShowResult(success) {
    const pop = document.getElementById('punchResult');
    const icon = document.getElementById('punchResultIcon');
    const msg = document.getElementById('punchResultMsg');
    if (!pop) return;
    pop.style.display = 'flex';
    if (success) {
        if (icon) icon.textContent = '🏆';
        if (msg) msg.textContent = '오늘의 체력단련 성공';
    } else {
        if (icon) icon.textContent = '😓';
        if (msg) msg.textContent = '추가 체력단련 필요';
    }
}

function punchRestart() {
    const pop = document.getElementById('punchResult');
    if (pop) pop.style.display = 'none';
    cleanupPunch();
    initPunch();
}

function cleanupPunch() {
    cancelAnimationFrame(_punchAnimId);
    clearInterval(_punchTimerInterval);
    _punchDone = true;
    // Remove document-level mouse listener
    if (_punchCanvas && _punchCanvas._punchMouseMoveHandler) {
        document.removeEventListener('mousemove', _punchCanvas._punchMouseMoveHandler);
        _punchCanvas._punchMouseMoveHandler = null;
    }
}

/* ==========================================================================
 * 14. MIRROR PAGE / 심리실 (fight file)
 * ========================================================================== */
function renderMirrorGamePage() {
    return `
        <div class="page mirror-room-page">
            ${renderNavigation()}
            <button class="hub-back-btn" onclick="navigateToHubWithLoading()">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                <span>라운지로 돌아가기</span>
            </button>

            <div id="mirrorMainContent" class="game-page mirror-room-inner">
                <!-- ===== 거울 + 우주인 ===== -->
                <div class="mirror-scene">
                    <div class="mirror-stage">
                        <!-- 아치형 거울 + 타자영역 래퍼 -->
                        <div class="arch-mirror-wrap">
                            <div class="arch-mirror">
                                <div class="arch-mirror-inner">
                                    <span class="arch-light arch-light-1"></span>
                                    <span class="arch-light arch-light-2"></span>
                                    <span class="arch-light arch-light-3"></span>
                                    <span class="arch-sun"></span>
                                </div>
                            </div>
                            <!-- 타자 영역 — 화면 가운데 고정 -->
                            <div id="mirrorGame" class="mirror-popup"></div>
                            <!-- 캐릭터 — 거울 앞에 60px 겹치게 -->
                            <img src="assets/character/idle.png" class="mirror-character-overlay" alt="character" />
                        </div>
                        <div class="mirror-floor-line"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function startMirrorGame() {
    const overlay = document.getElementById('mirrorIntroOverlay');
    const main = document.getElementById('mirrorMainContent');
    if (overlay) {
        overlay.classList.add('mirror-intro-fade-out');
        setTimeout(() => {
            overlay.style.display = 'none';
            if (main) {
                main.style.display = '';
                main.classList.add('mirror-main-fade-in');
            }
        }, 600);
    }
}

/* ==========================================================================
 * 15. BREATHING / 명상실 (fight file)
 * ========================================================================== */
function renderBreathingGamePage() {
    let starsHtml = '';
    for (let i = 0; i < 80; i++) {
        const size = Math.random() * 2.5 + 0.5;
        const top  = Math.random() * 100;
        const left = Math.random() * 100;
        const dur  = Math.random() * 3 + 2;
        const del  = Math.random() * 4;
        const op   = Math.random() * 0.5 + 0.15;
        starsHtml += `<div style="position:absolute;width:${size}px;height:${size}px;top:${top}%;left:${left}%;background:#fff;border-radius:50%;opacity:${op};animation:ghTwinkle ${dur}s ${del}s ease-in-out infinite;pointer-events:none;"></div>`;
    }

    return `
    <style>
        @keyframes ipF1 { 0%,100%{transform:translateY(0px);} 50%{transform:translateY(-22px);} }
        @keyframes ipF2 { 0%,100%{transform:translateY(0px);} 50%{transform:translateY(-16px);} }
        @keyframes ipF3 { 0%,100%{transform:translateY(0px);} 50%{transform:translateY(-26px);} }
        @keyframes ipF4 { 0%,100%{transform:translateY(0px);} 50%{transform:translateY(-14px);} }
        .ip-planet {
            position:absolute;
            border-radius:50%;
            border:none; cursor:pointer;
            display:flex;flex-direction:column;
            align-items:center;justify-content:center;
            gap:6px; font-family:'Jua',sans-serif;
            color:#fff; transition:filter 0.2s;
        }
        .ip-planet:hover { filter:brightness(1.2) saturate(1.3); }
    </style>
    <div class="page" style="
        background: radial-gradient(ellipse at 20% 30%, #160a38 0%, #06021a 45%, #000208 100%);
        font-family:'Jua',sans-serif;overflow:hidden;position:relative;">

        <!-- 별 배경 -->
        <div style="position:absolute;inset:0;pointer-events:none;">${starsHtml}</div>
        <div style="position:absolute;inset:0;pointer-events:none;
            background:radial-gradient(ellipse at 70% 20%, rgba(60,10,140,0.25) 0%, transparent 50%),
                       radial-gradient(ellipse at 30% 80%, rgba(10,60,140,0.18) 0%, transparent 50%);"></div>

        ${hubBackBtn()}

        <!-- ══ 선택 화면 ══ -->
        <div id="ipSelect" style="position:absolute;inset:0;z-index:10;">

            <!-- 제목 박스 — 중앙 상단 -->
            <div style="
                position:absolute;top:50%;left:50%;
                transform:translate(-50%,-50%);
                background:rgba(20,10,60,0.65);
                border:1.5px solid rgba(140,100,255,0.35);
                border-radius:20px;backdrop-filter:blur(12px);
                padding:22px 44px;text-align:center;
                box-shadow:0 0 40px rgba(80,30,200,0.2);
                z-index:2;pointer-events:none;
            ">
                <h1 style="font-size:2rem;font-weight:400;color:#e0d0ff;letter-spacing:0.08em;margin:0 0 6px;text-shadow:0 0 20px rgba(180,140,255,0.5);">명상실 · 이너피스</h1>
                <p style="color:rgba(180,155,255,0.65);font-size:0.95rem;margin:0;">호흡법 행성을 선택하세요 🪐</p>
            </div>

            <!-- 행성 1: 긴장완화 — 보라 (왼쪽 중간) -->
            <button class="ip-planet" onclick="ipStartMethod('478')" style="
                width:clamp(160px,22vw,240px);height:clamp(160px,22vw,240px);
                top:18%; left:28%;
                transform:translateX(-50%);
                background:radial-gradient(circle at 32% 28%, #d8b4fe, #8b5cf6 50%, #5b21b6);
                box-shadow:0 0 40px rgba(139,92,246,0.7), 0 0 80px rgba(139,92,246,0.3);
                animation:ipF1 4.2s ease-in-out infinite;
                font-size:1rem;
            ">
                <span style="font-size:2rem;">🌙</span>
                <span style="font-weight:700;font-size:1.05rem;">긴장완화</span>
                <span style="font-size:0.82rem;opacity:0.85;">호흡</span>
                <span style="font-size:0.72rem;opacity:0.6;">4 · 7 · 8 초</span>
            </button>

            <!-- 행성 2: 박스 호흡 — 밝은 하늘색 (오른쪽 중상) -->
            <button class="ip-planet" onclick="ipStartMethod('box')" style="
                width:clamp(200px,28vw,310px);height:clamp(200px,28vw,310px);
                top:10%; right:12%;
                background:radial-gradient(circle at 32% 28%, #7ff4fc, #22d3ee 50%, #0891b2);
                box-shadow:0 0 50px rgba(34,211,238,0.75), 0 0 100px rgba(34,211,238,0.3);
                animation:ipF2 5.0s 0.8s ease-in-out infinite;
                font-size:1.1rem;
            ">
                <span style="font-size:2.4rem;">🎯</span>
                <span style="font-weight:700;font-size:1.15rem;">박스</span>
                <span style="font-size:0.88rem;opacity:0.85;">호흡</span>
                <span style="font-size:0.75rem;opacity:0.6;">4 · 4 · 4 · 4 초</span>
            </button>

            <!-- 행성 3: 복식 호흡 — 밝은 초록 (왼쪽 하단) -->
            <button class="ip-planet" onclick="ipStartMethod('belly')" style="
                width:clamp(170px,24vw,260px);height:clamp(170px,24vw,260px);
                bottom:8%; left:20%;
                background:radial-gradient(circle at 32% 28%, #6ee7b7, #34d399 50%, #059669);
                box-shadow:0 0 44px rgba(52,211,153,0.7), 0 0 90px rgba(52,211,153,0.3);
                animation:ipF3 3.8s 1.5s ease-in-out infinite;
                font-size:1rem;
            ">
                <span style="font-size:2rem;">🧘</span>
                <span style="font-weight:700;font-size:1.05rem;">복식</span>
                <span style="font-size:0.82rem;opacity:0.85;">호흡</span>
                <span style="font-size:0.72rem;opacity:0.6;">4 · 6 초</span>
            </button>

            <!-- 행성 4: 날숨강화 — 주황 (중앙 하단 살짝 오른쪽) -->
            <button class="ip-planet" onclick="ipStartMethod('exhale')" style="
                width:clamp(130px,17vw,200px);height:clamp(130px,17vw,200px);
                bottom:6%; left:52%;
                background:radial-gradient(circle at 32% 28%, #fdba74, #f97316 50%, #c2410c);
                box-shadow:0 0 36px rgba(249,115,22,0.7), 0 0 70px rgba(249,115,22,0.3);
                animation:ipF4 4.7s 2.2s ease-in-out infinite;
                font-size:0.9rem;
            ">
                <span style="font-size:1.7rem;">💨</span>
                <span style="font-weight:700;font-size:0.95rem;">날숨강화</span>
                <span style="font-size:0.78rem;opacity:0.85;">호흡</span>
                <span style="font-size:0.68rem;opacity:0.6;">4 · 2 · 6 초</span>
            </button>

        </div>

        <!-- ══ 세션 화면 ══ -->
        <div id="ipSession" style="display:none;position:absolute;inset:0;flex-direction:column;align-items:center;justify-content:center;gap:24px;z-index:10;">
            <div id="ipSessionName" style="font-size:2rem;font-weight:300;color:#fff;letter-spacing:0.04em;text-shadow:0 0 20px rgba(200,160,255,0.6);"></div>

            <div style="position:relative;width:340px;height:340px;display:flex;align-items:center;justify-content:center;">
                <!-- 외부 글로우 링 -->
                <div id="ipOuterRing" style="position:absolute;width:310px;height:310px;border-radius:50%;
                    background:rgba(180,140,255,0.06);
                    border:1px solid rgba(200,170,255,0.12);
                    transition:all 0.3s ease;"></div>

                <!-- 호흡 원 — 밝게 -->
                <div id="ipCircle" style="
                    position:absolute;width:210px;height:210px;border-radius:50%;
                    background:radial-gradient(circle at 30% 25%,rgba(255,255,255,0.95) 0%,rgba(230,210,255,0.8) 25%,rgba(180,120,255,0.7) 55%,rgba(120,60,220,0.5) 80%,rgba(80,20,180,0.3) 100%);
                    box-shadow:
                        inset 0 6px 24px rgba(255,255,255,0.6),
                        0 0 60px rgba(160,100,255,0.8),
                        0 0 120px rgba(120,60,220,0.4);
                    border:2px solid rgba(220,200,255,0.7);
                    will-change:transform;
                "></div>

                <!-- 내부 텍스트 -->
                <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;z-index:2;pointer-events:none;">
                    <div id="ipPhaseLabel" style="font-size:1.3rem;font-weight:500;color:#fff;letter-spacing:0.06em;opacity:0;transition:opacity 0.4s;text-align:center;text-shadow:0 1px 8px rgba(0,0,0,0.5);"></div>
                    <div id="ipCount" style="font-size:5rem;font-weight:200;color:#fff;line-height:1;opacity:0;transition:opacity 0.3s;text-shadow:0 2px 12px rgba(0,0,0,0.4);"></div>
                </div>
            </div>

            <div id="ipPhaseDesc" style="font-size:1.1rem;color:rgba(220,200,255,0.8);font-weight:300;text-align:center;min-height:1.4em;padding:0 20px;"></div>
            <div id="ipSessionBottom" style="display:flex;gap:12px;">
                <button onclick="ipFinish()" style="
                    padding:12px 44px;border-radius:50px;border:1.5px solid rgba(200,170,255,0.5);
                    background:rgba(80,40,160,0.65);cursor:pointer;font-size:1.2rem;font-weight:500;
                    color:#fff;font-family:'Jua',sans-serif;transition:all 0.2s;backdrop-filter:blur(6px);
                " onmouseover="this.style.background='rgba(110,60,200,0.85)'" onmouseout="this.style.background='rgba(80,40,160,0.65)'">완료 ✓</button>
            </div>
            <div id="ipDone" style="display:none;flex-direction:column;align-items:center;gap:14px;">
                <span style="font-size:1.6rem;font-weight:300;color:rgba(230,210,255,0.95);text-align:center;">몸과 마음이 편안해지셨나요? 🌌</span>
                <div style="display:flex;gap:10px;">
                    <button onclick="ipRestart()" style="
                        padding:12px 36px;border-radius:50px;border:1.5px solid rgba(200,170,255,0.55);
                        background:rgba(80,40,160,0.65);cursor:pointer;font-size:1.1rem;font-weight:500;
                        color:#fff;font-family:'Jua',sans-serif;transition:all 0.2s;backdrop-filter:blur(6px);
                    " onmouseover="this.style.background='rgba(110,60,200,0.85)'" onmouseout="this.style.background='rgba(80,40,160,0.65)'">🔄 다시 시작</button>
                    <button onclick="ipStop()" style="
                        padding:12px 28px;border-radius:50px;border:1.5px solid rgba(200,170,255,0.35);
                        background:rgba(40,15,100,0.5);cursor:pointer;font-size:1.1rem;font-weight:400;
                        color:#d8c0ff;font-family:'Jua',sans-serif;transition:all 0.2s;backdrop-filter:blur(6px);
                    " onmouseover="this.style.background='rgba(80,40,160,0.75)'" onmouseout="this.style.background='rgba(40,15,100,0.5)'">다른 호흡법</button>
                </div>
            </div>
        </div>

        <!-- 다른 호흡법 버튼 (세션 중) -->
        <button id="ipStopBtn" onclick="ipStop()" style="display:none;position:fixed;top:24px;right:80px;z-index:100;
            font-family:'Jua',sans-serif;padding:10px 20px;border-radius:50px;
            background:rgba(80,40,160,0.65);font-size:0.95rem;color:#d8c0ff;cursor:pointer;
            backdrop-filter:blur(6px);border:1px solid rgba(200,170,255,0.3);">← 다른 호흡법</button>
    </div>`;
}

// Breathing state
let _ipPhases = [], _ipPhaseIdx = 0, _ipCountdown = 0;
let _ipTickInterval = null, _ipAnimId = null;
let _ipCurrentScale = 1.0, _ipPhaseStartTime = 0;
let _ipIntroLines = [], _ipName = '';
let _ipStartScale = 1.0, _ipTargetScale = 1.0, _ipPhaseDuration = 1000;
const _ipMinScale = 1.0, _ipMaxScale = 1.75;

// Breathing method definitions
const _ipMethods = {
    '478': {
        name: '긴장완화 호흡',
        intro: ['긴장완화 호흡', '4초 들이쉬기, 7초 숨참기, 8초 내쉬기', '그럼 시작합니다.'],
        phases: [
            {label:'들이쉬기', desc:'코로 천천히 들이쉬세요', duration:4, type:'inhale'},
            {label:'숨 참기',  desc:'편안하게 숨을 멈추세요', duration:7, type:'hold'},
            {label:'내쉬기',  desc:'입으로 길게 내쉬세요',   duration:8, type:'exhale'}
        ]
    },
    'box': {
        name: '박스 호흡',
        intro: ['박스 호흡', '4초 들이쉬기, 4초 숨참기, 4초 내쉬기, 4초 숨참기', '그럼 시작합니다.'],
        phases: [
            {label:'들이쉬기', desc:'코로 천천히 들이쉬세요',   duration:4, type:'inhale'},
            {label:'숨 참기',  desc:'편안하게 숨을 멈추세요',   duration:4, type:'hold'},
            {label:'내쉬기',  desc:'입으로 천천히 내쉬세요',   duration:4, type:'exhale'},
            {label:'숨 참기',  desc:'편안하게 숨을 멈추세요',   duration:4, type:'hold'}
        ]
    },
    'belly': {
        name: '복식 호흡',
        intro: ['복식 호흡', '4초 들이쉬기, 6초 내쉬기', '그럼 시작합니다.'],
        phases: [
            {label:'들이쉬기', desc:'배를 부풀리며 코로 깊게 들이쉬세요', duration:4, type:'inhale'},
            {label:'내쉬기',  desc:'입으로 부드럽게 내쉬세요',            duration:6, type:'exhale'}
        ]
    },
    'exhale': {
        name: '날숨 강화 호흡',
        intro: ['날숨 강화 호흡', '4초 들이쉬기, 2초 숨참기, 6초 내쉬기', '그럼 시작합니다.'],
        phases: [
            {label:'들이쉬기', desc:'코로 천천히 들이쉬세요',     duration:4, type:'inhale'},
            {label:'숨 참기',  desc:'잠깐 숨을 멈추세요',         duration:2, type:'hold'},
            {label:'내쉬기',  desc:'입으로 길게 천천히 내쉬세요', duration:6, type:'exhale'}
        ]
    }
};

function ipStartMethod(key) {
    const m = _ipMethods[key];
    if (!m) return;
    _ipPhases = m.phases;
    _ipIntroLines = m.intro;
    _ipName = m.name;
    _ipPhaseIdx = 0;
    _ipCurrentScale = _ipMinScale;

    document.getElementById('ipSelect').style.display = 'none';
    const sess = document.getElementById('ipSession');
    sess.style.display = 'flex';
    document.getElementById('ipSessionName').textContent = m.name;
    document.getElementById('ipDone').style.display = 'none';
    document.getElementById('ipSessionBottom').style.display = 'flex';
    document.getElementById('ipStopBtn').style.display = 'block';
    const circle = document.getElementById('ipCircle');

    // 선택한 호흡법 색상으로 원 변경
    const colorMap = {
        '478':    { bg:'radial-gradient(circle at 30% 25%,rgba(255,255,255,0.95) 0%,rgba(220,190,255,0.85) 25%,rgba(167,139,250,0.75) 55%,rgba(109,40,217,0.5) 80%,rgba(76,29,149,0.3) 100%)', shadow:'rgba(139,92,246,0.9)' },
        'box':    { bg:'radial-gradient(circle at 30% 25%,rgba(255,255,255,0.95) 0%,rgba(180,240,255,0.85) 25%,rgba(34,211,238,0.75) 55%,rgba(8,145,178,0.5) 80%,rgba(7,79,107,0.3) 100%)',  shadow:'rgba(34,211,238,0.9)' },
        'belly':  { bg:'radial-gradient(circle at 30% 25%,rgba(255,255,255,0.95) 0%,rgba(180,255,215,0.85) 25%,rgba(52,211,153,0.75) 55%,rgba(5,150,105,0.5) 80%,rgba(6,78,59,0.3) 100%)',   shadow:'rgba(52,211,153,0.9)' },
        'exhale': { bg:'radial-gradient(circle at 30% 25%,rgba(255,255,255,0.95) 0%,rgba(255,220,160,0.85) 25%,rgba(249,115,22,0.75) 55%,rgba(194,65,12,0.5) 80%,rgba(124,45,18,0.3) 100%)', shadow:'rgba(249,115,22,0.9)' },
    };
    const col = colorMap[key] || colorMap['478'];
    if (circle) {
        circle.style.transform = 'scale(1)';
        circle.style.background = col.bg;
        circle.style.boxShadow = `inset 0 6px 24px rgba(255,255,255,0.6),0 0 60px ${col.shadow},0 0 120px ${col.shadow.replace('0.9','0.35')}`;
        circle.style.border = `2px solid rgba(255,255,255,0.5)`;
    }

    ipShowIntro(0);
}

function ipEaseInOut(t) { return t < 0.5 ? 2*t*t : -1 + (4-2*t)*t; }

function ipStop() {
    if (_ipTickInterval) { clearInterval(_ipTickInterval); _ipTickInterval = null; }
    if (_ipAnimId) { cancelAnimationFrame(_ipAnimId); _ipAnimId = null; }
    _ipPhases = [];
    _ipCurrentScale = _ipMinScale;
    const sel = document.getElementById('ipSelect');
    const sess = document.getElementById('ipSession');
    const stopBtn = document.getElementById('ipStopBtn');
    const done = document.getElementById('ipDone');
    const circle = document.getElementById('ipCircle');
    if (sel) sel.style.display = 'flex';
    if (sess) sess.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'none';
    if (done) done.style.display = 'none';
    if (circle) circle.style.transform = 'scale(1)';
}

function ipShowIntro(idx) {
    const label = document.getElementById('ipPhaseLabel');
    const countEl = document.getElementById('ipCount');
    if (!label) return;
    if (idx >= _ipIntroLines.length) { ipRunPhase(); return; }
    label.style.transition = 'opacity 0.4s';
    label.style.opacity = '0';
    if (countEl) { countEl.style.opacity = '0'; countEl.textContent = ''; }
    setTimeout(() => {
        if (!document.getElementById('ipPhaseLabel')) return; // page changed
        label.textContent = _ipIntroLines[idx];
        label.style.fontSize = idx === 1 ? '1rem' : '1.3rem';
        label.style.opacity = '1';
        setTimeout(() => {
            label.style.opacity = '0';
            setTimeout(() => ipShowIntro(idx + 1), 450);
        }, 1800);
    }, 200);
}

function ipRunPhase() {
    if (_ipTickInterval) { clearInterval(_ipTickInterval); _ipTickInterval = null; }
    if (_ipAnimId) { cancelAnimationFrame(_ipAnimId); _ipAnimId = null; }
    if (!_ipPhases || !_ipPhases.length) return;
    if (!document.getElementById('ipCircle')) return; // page left

    const phase = _ipPhases[_ipPhaseIdx];
    _ipCountdown = phase.duration;

    const label = document.getElementById('ipPhaseLabel');
    const countEl = document.getElementById('ipCount');
    const desc = document.getElementById('ipPhaseDesc');
    const circle = document.getElementById('ipCircle');
    const outer = document.getElementById('ipOuterRing');

    if (label) { label.style.transition = 'opacity 0.3s'; label.style.opacity = '1'; label.textContent = phase.label; label.style.fontSize = '1.3rem'; }
    if (countEl) { countEl.style.opacity = '1'; countEl.textContent = _ipCountdown; }
    if (desc) desc.textContent = phase.desc;

    // Circle background color per phase
    if (circle) {
        // 들이마시기 색상: 호흡법별로 다르게
        const inhaleColorMap = {
            '긴장완화 호흡': { bg: 'radial-gradient(circle at 32% 28%,rgba(255,255,255,0.75) 0%,transparent 50%),radial-gradient(circle at 50% 50%,rgba(220,180,255,0.5) 0%,rgba(180,130,240,0.35) 40%,rgba(140,80,210,0.15) 70%,transparent 100%)', shadow: '0 12px 48px rgba(160,80,240,0.35)', outer: 'rgba(180,120,255,0.18)' },
            '박스 호흡':    { bg: 'radial-gradient(circle at 32% 28%,rgba(255,255,255,0.75) 0%,transparent 50%),radial-gradient(circle at 50% 50%,rgba(180,235,255,0.5) 0%,rgba(130,210,240,0.35) 40%,rgba(80,170,220,0.15) 70%,transparent 100%)', shadow: '0 12px 48px rgba(34,211,238,0.35)', outer: 'rgba(34,211,238,0.18)' },
            '복식 호흡':    { bg: 'radial-gradient(circle at 32% 28%,rgba(255,255,255,0.75) 0%,transparent 50%),radial-gradient(circle at 50% 50%,rgba(200,235,180,0.5) 0%,rgba(160,210,130,0.35) 40%,rgba(120,185,90,0.15) 70%,transparent 100%)', shadow: '0 12px 48px rgba(120,185,90,0.35)', outer: 'rgba(160,220,100,0.18)' },
            '날숨 강화 호흡': { bg: 'radial-gradient(circle at 32% 28%,rgba(255,255,255,0.75) 0%,transparent 50%),radial-gradient(circle at 50% 50%,rgba(255,220,170,0.5) 0%,rgba(250,180,100,0.35) 40%,rgba(240,140,50,0.15) 70%,transparent 100%)', shadow: '0 12px 48px rgba(249,115,22,0.35)', outer: 'rgba(249,115,22,0.18)' },
        };
        const phaseColors = {
            inhale: inhaleColorMap[_ipName] || {
                bg: 'radial-gradient(circle at 32% 28%,rgba(255,255,255,0.75) 0%,transparent 50%),radial-gradient(circle at 50% 50%,rgba(200,235,180,0.5) 0%,rgba(160,210,130,0.35) 40%,rgba(120,185,90,0.15) 70%,transparent 100%)',
                shadow: '0 12px 48px rgba(120,185,90,0.35)',
                outer: 'rgba(160,220,100,0.18)'
            },
            hold: {
                bg: 'radial-gradient(circle at 32% 28%,rgba(255,255,255,0.75) 0%,transparent 50%),radial-gradient(circle at 50% 50%,rgba(255,245,200,0.5) 0%,rgba(240,215,140,0.35) 40%,rgba(220,185,80,0.15) 70%,transparent 100%)',
                shadow: '0 12px 48px rgba(220,180,80,0.3)',
                outer: 'rgba(255,220,80,0.14)'
            },
            exhale: {
                bg: 'radial-gradient(circle at 32% 28%,rgba(255,255,255,0.75) 0%,transparent 50%),radial-gradient(circle at 50% 50%,rgba(200,225,255,0.5) 0%,rgba(160,195,240,0.35) 40%,rgba(100,155,220,0.15) 70%,transparent 100%)',
                shadow: '0 12px 48px rgba(100,155,220,0.3)',
                outer: 'rgba(100,180,255,0.14)'
            }
        };
        const pc = phaseColors[phase.type] || phaseColors.inhale;
        circle.style.background = pc.bg;
        circle.style.boxShadow = `inset 0 4px 20px rgba(255,255,255,0.5),${pc.shadow}`;
        if (outer) outer.style.background = pc.outer;
    }

    // Animate circle scale using rAF
    ipAnimateCircle(phase);

    _ipTickInterval = setInterval(() => {
        _ipCountdown--;
        if (countEl) countEl.textContent = Math.max(_ipCountdown, 0);
        if (_ipCountdown <= 0) {
            clearInterval(_ipTickInterval); _ipTickInterval = null;
            if (_ipAnimId) { cancelAnimationFrame(_ipAnimId); _ipAnimId = null; }
            _ipPhaseIdx = (_ipPhaseIdx + 1) % _ipPhases.length;
            ipRunPhase();
        }
    }, 1000);
}

function ipAnimateCircle(phase) {
    const circle = document.getElementById('ipCircle');
    if (!circle) return;
    const duration = phase.duration * 1000;
    const startScale = _ipCurrentScale;
    const endScale = phase.type === 'inhale' ? _ipMaxScale : phase.type === 'exhale' ? _ipMinScale : _ipCurrentScale;
    _ipPhaseStartTime = performance.now();

    function frame(now) {
        if (!document.getElementById('ipCircle')) return; // page changed
        const t = Math.min((now - _ipPhaseStartTime) / duration, 1);
        _ipCurrentScale = startScale + (endScale - startScale) * ipEaseInOut(t);
        circle.style.transform = `scale(${_ipCurrentScale})`;
        if (t < 1) {
            _ipAnimId = requestAnimationFrame(frame);
        } else {
            _ipCurrentScale = endScale;
            _ipAnimId = null;
        }
    }
    _ipAnimId = requestAnimationFrame(frame);
}

function ipFinish() {
    if (_ipTickInterval) { clearInterval(_ipTickInterval); _ipTickInterval = null; }
    if (_ipAnimId) { cancelAnimationFrame(_ipAnimId); _ipAnimId = null; }
    const label = document.getElementById('ipPhaseLabel');
    const countEl = document.getElementById('ipCount');
    const desc = document.getElementById('ipPhaseDesc');
    const bottom = document.getElementById('ipSessionBottom');
    const done = document.getElementById('ipDone');
    const circle = document.getElementById('ipCircle');
    if (label) { label.style.opacity = '0'; label.textContent = ''; }
    if (countEl) { countEl.style.opacity = '0'; countEl.textContent = ''; }
    if (desc) desc.textContent = '';
    if (bottom) bottom.style.display = 'none';
    if (done) done.style.display = 'flex';
    if (circle) circle.style.transform = `scale(${_ipMinScale})`;
}

function ipRestart() {
    if (_ipTickInterval) { clearInterval(_ipTickInterval); _ipTickInterval = null; }
    if (_ipAnimId) { cancelAnimationFrame(_ipAnimId); _ipAnimId = null; }
    _ipPhaseIdx = 0; _ipCurrentScale = _ipMinScale;
    const done = document.getElementById('ipDone');
    const bottom = document.getElementById('ipSessionBottom');
    const circle = document.getElementById('ipCircle');
    if (done) done.style.display = 'none';
    if (bottom) bottom.style.display = 'flex';
    if (circle) circle.style.transform = 'scale(1)';
    ipShowIntro(0);
}

// Legacy ipStart removed - use ipStartMethod instead

/* ==========================================================================
 * 14-B. MIRROR INIT FUNCTIONS
 * ========================================================================== */
function initMirrorGame() {
    _mirrorInitIfNeeded();
    renderMirrorContent();
}

function renderMirrorContent() {
    const gameDiv = document.getElementById('mirrorGame');
    if (!gameDiv) return;

    const currentAffirm = _mirrorCurrentAffirmation();
    const totalInRound = 5;

    if (_mirrorQueueIdx >= totalInRound) {
        // 5개 완료
        gameDiv.innerHTML = `
            <div style="text-align:center; padding:14px 6px;">
                <div style="font-size:2.4rem; margin-bottom:8px;">❤️</div>
                <h2 class="mirror-popup-title">완료했어요! 🎉</h2>
                <p class="mirror-popup-text">
                    당신은 충분히 소중하고 가치 있는 사람입니다.<br/>
                    스스로를 사랑하는 것을 잊지 마세요.
                </p>
                <button class="mirror-confirm" onclick="resetMirrorGame()" style="margin-top:14px;">
                    다시 하기
                </button>
            </div>
        `;
    } else {
        const progress = _mirrorQueueIdx;
        gameDiv.innerHTML = `
              <p class="mirror-affirm">${currentAffirm}</p>
    <input type="text" id="mirrorInput" placeholder="위의 문장을 그대로 입력하세요..."
           class="mirror-input"
           oninput="AudioManager.playTyping()"
           onkeypress="if(event.key==='Enter') checkMirrorAnswer()">
            <div id="mirrorFeedback" style="height:18px; margin-top:6px; text-align:center; font-size:12px; font-family:'Share Tech Mono',monospace;"></div>
            <div class="mirror-progress-inline">
                <div class="mirror-progress-track-inline">
                    <div id="mirrorProgress" class="mirror-progress-bar" style="width:${progress / totalInRound * 100}%"></div>
                </div>
                <span class="mirror-progress-label"><span id="mirrorCompleted">${progress}</span> / <span id="mirrorTotal">${totalInRound}</span></span>
            </div>
            <button class="mirror-confirm" onclick="checkMirrorAnswer()">확인</button>
        `;
        setTimeout(() => {
            const inp = document.getElementById('mirrorInput');
            if (inp) inp.focus();
        }, 50);
    }
}

function checkMirrorAnswer() {
    const input = document.getElementById('mirrorInput');
    const feedback = document.getElementById('mirrorFeedback');
    if (!input) return;

    if (input.value.trim() === _mirrorCurrentAffirmation()) {
        _mirrorQueueIdx++;
        const el = document.getElementById('mirrorCompleted');
        if (el) el.textContent = _mirrorQueueIdx;
        const prog = document.getElementById('mirrorProgress');
        if (prog) prog.style.width = (_mirrorQueueIdx / 5 * 100) + '%';
        renderMirrorContent();
    } else {
        if (feedback) {
            feedback.style.color = '#ff6b6b';
            feedback.textContent = '정확하게 입력해 주세요 ✗';
            input.style.borderColor = 'rgba(255,107,107,0.5)';
        }
    }
}

function resetMirrorGame() {
    // 새 라운드 - 풀에서 새로 5개 선택
    _mirrorPickQueue();
    const el = document.getElementById('mirrorCompleted');
    if (el) el.textContent = 0;
    const prog = document.getElementById('mirrorProgress');
    if (prog) prog.style.width = '0%';
    renderMirrorContent();
}

/* ==========================================================================
 * 15. GAME #5 — BREATHING / 명상실 (호흡 훈련)
 * ========================================================================== */
/* ==========================================================================
 * 16. GAME #6 — PLANT / 온실 (식물 키우기) — legacy unused
 * ========================================================================== */

/* ==========================================================================
 * BUBBLE WRAP / 뽁뽁이
 * ========================================================================== */
function renderBubblePage() {
    return `
    <div class="bubble-page">
        <button class="hub-back-btn" onclick="navigateToHubWithLoading()">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            <span>라운지로 돌아가기</span>
        </button>
        <button class="bubble-reset" onclick="initBubblePage()">새로고침</button>
        <div id="bubbleGrid" class="bubble-grid"></div>
    </div>`;
}

function initBubblePage() {
    const grid = document.getElementById('bubbleGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!window._bubblePopCount) window._bubblePopCount = 0;
    const MAX_LEVEL = 7;
    function createBubble(level) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble-item';
        const img = document.createElement('img');
        img.src = 'assets/bubble1.png';
        img.className = 'bubble-img';
        bubble.appendChild(img);
        bubble.onclick = (e) => {
    e.stopPropagation();
    if (level >= MAX_LEVEL) return;
    AudioManager.play('popSound');   // pop.mp3 재생 (중간에 다시 누르면 처음부터)
    window._bubblePopCount = (window._bubblePopCount || 0) + 1;
    if (window._bubblePopCount % 5 === 0) {
        reduceStress(1);
    }
    bubble.innerHTML = '';
    bubble.classList.add('bubble-split');
    for (let i = 0; i < 8; i++) bubble.appendChild(createBubble(level + 1));
};
        return bubble;
    }
    for (let i = 0; i < 4; i++) grid.appendChild(createBubble(0));
}

/* ==========================================================================
 * 16. PLANT / 온실
 * ========================================================================== */
function renderPlantGamePage() {
    const userPlanetSrc = (appState.planets && appState.planets.length > 0)
        ? appState.planets[0].canvasData
        : null;

    const planetHtml = userPlanetSrc
    ? `<canvas id="ghPlanetCanvas" width="500" height="500" style="
            position:absolute;bottom:-500px;left:50%;transform:translateX(-50%);
            width:clamp(347px,70vw,693px);height:clamp(347px,70vw,693px);
            border-radius:50%;
            filter:drop-shadow(0 -4px 30px rgba(100,200,255,0.35));
       "></canvas>`
    : `<img src="assets/greenhouse/planet_greenhouse.png" style="
            position:absolute;bottom:-500px;left:50%;transform:translateX(-50%);
            width:clamp(347px,75vw,747px);
            filter:drop-shadow(0 -6px 30px rgba(100,200,120,0.3));"/>`;

    return `
    <style>
        @keyframes ghFloat1 { 0%,100%{transform:translateY(0px);}  50%{transform:translateY(-16px);} }
        @keyframes ghFloat2 { 0%,100%{transform:translateY(0px);}  50%{transform:translateY(-22px);} }
        @keyframes ghFloat3 { 0%,100%{transform:translateY(0px);}  50%{transform:translateY(-12px);} }
        .gh-float-btn {
            position:absolute;
            border-radius:50%;
            border:none; cursor:pointer;
            display:flex; flex-direction:column;
            align-items:center; justify-content:center;
            gap:3px; font-family:'Jua',sans-serif;
            font-size:0.75rem; font-weight:700;
            color:#fff; line-height:1.2;
            z-index:15;
            transition:filter 0.2s;
        }
        .gh-float-btn:hover { filter:brightness(1.25); }
    </style>

    <div style="
        position:fixed;inset:0;
        background:linear-gradient(to bottom,#05050f 0%,#0a0820 40%,#080d18 100%);
        overflow:hidden;font-family:'Jua',sans-serif;
        display:flex;flex-direction:column;align-items:center;
    ">
        <!-- 라운지 버튼 -->
        <button onclick="navigateToHubWithLoading()" style="
            position:fixed;top:18px;left:18px;z-index:200;
            background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
            color:#fff;border-radius:10px;padding:8px 16px;cursor:pointer;
            font-family:'Jua',sans-serif;font-size:0.9rem;">← 라운지</button>

        <!-- 별 / 달 -->
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;">
            <img src="assets/greenhouse/star.png" style="position:absolute;top:8%;left:3%;width:clamp(18px,2vw,30px);animation:ghTwinkle 2.2s ease-in-out infinite;"/>
            <img src="assets/greenhouse/star.png" style="position:absolute;top:15%;left:25%;width:clamp(14px,1.6vw,24px);animation:ghTwinkle 3.1s 0.4s ease-in-out infinite;"/>
            <img src="assets/greenhouse/star.png" style="position:absolute;top:5%;left:48%;width:clamp(16px,1.8vw,28px);animation:ghTwinkle 2.5s 0.8s ease-in-out infinite;"/>
            <img src="assets/greenhouse/star.png" style="position:absolute;top:12%;left:70%;width:clamp(20px,2.2vw,34px);animation:ghTwinkle 1.9s 1.2s ease-in-out infinite;"/>
            <img src="assets/greenhouse/star.png" style="position:absolute;top:6%;left:88%;width:clamp(14px,1.5vw,22px);animation:ghTwinkle 2.8s 0.2s ease-in-out infinite;"/>
            <img src="assets/greenhouse/star.png" style="position:absolute;top:28%;left:2%;width:clamp(12px,1.4vw,20px);animation:ghTwinkle 3.3s 1.0s ease-in-out infinite;"/>
            <img src="assets/greenhouse/star.png" style="position:absolute;top:32%;left:55%;width:clamp(16px,1.8vw,26px);animation:ghTwinkle 2.0s 0.6s ease-in-out infinite;"/>
            <img src="assets/greenhouse/star.png" style="position:absolute;top:22%;left:80%;width:clamp(14px,1.6vw,24px);animation:ghTwinkle 2.6s 1.4s ease-in-out infinite;"/>
            <img src="assets/greenhouse/star.png" style="position:absolute;top:40%;left:30%;width:clamp(12px,1.3vw,20px);animation:ghTwinkle 3.5s 0.3s ease-in-out infinite;"/>
            <img src="assets/greenhouse/star.png" style="position:absolute;top:45%;left:72%;width:clamp(18px,2vw,30px);animation:ghTwinkle 2.3s 1.8s ease-in-out infinite;"/>
            <img src="assets/greenhouse/star.png" style="position:absolute;top:18%;left:42%;width:clamp(14px,1.5vw,22px);animation:ghTwinkle 2.9s 0.9s ease-in-out infinite;"/>
            <img src="assets/greenhouse/star.png" style="position:absolute;top:35%;left:88%;width:clamp(12px,1.4vw,20px);animation:ghTwinkle 3.0s 1.6s ease-in-out infinite;"/>
            <img src="assets/greenhouse/star.png" style="position:absolute;top:50%;left:18%;width:clamp(14px,1.6vw,24px);animation:ghTwinkle 2.4s 0.5s ease-in-out infinite;"/>
            <img src="assets/greenhouse/moon.png" style="position:absolute;top:70px;left:20px;width:clamp(80px,10vw,140px);filter:drop-shadow(0 0 12px rgba(255,240,180,0.6));opacity:0.85;"/>
        </div>

        <!-- 버튼 3개 -->
        <div id="ghBtns" style="position:fixed;inset:0;pointer-events:none;z-index:15;">
            <button onclick="ghCare('rain')" class="gh-float-btn" style="
                width:82px;height:82px;top:38%;left:8%;
                background:radial-gradient(circle at 32% 28%,#7dd3fc,#0284c7,#075985);
                box-shadow:0 0 22px rgba(2,132,199,0.7),0 0 44px rgba(2,132,199,0.3);
                animation:ghFloat2 4.5s ease-in-out infinite;pointer-events:all;">
                <span style="font-size:1.6rem;">💧</span><span>물 주기</span>
            </button>
            <button onclick="ghCare('sun')" class="gh-float-btn" style="
                width:90px;height:90px;top:20%;right:8%;
                background:radial-gradient(circle at 32% 28%,#fde68a,#f59e0b,#b45309);
                box-shadow:0 0 24px rgba(245,158,11,0.7),0 0 48px rgba(245,158,11,0.3);
                color:#3a2800;animation:ghFloat1 3.8s 0.6s ease-in-out infinite;pointer-events:all;">
                <span style="font-size:1.7rem;">☀️</span><span>햇빛 주기</span>
            </button>
            <button onclick="ghCare('wind')" class="gh-float-btn" style="
                width:78px;height:78px;top:55%;right:10%;
                background:radial-gradient(circle at 32% 28%,#a7f3d0,#10b981,#065f46);
                box-shadow:0 0 20px rgba(16,185,129,0.7),0 0 40px rgba(16,185,129,0.3);
                animation:ghFloat3 5.2s 1.4s ease-in-out infinite;pointer-events:all;">
                <span style="font-size:1.5rem;">🌬️</span><span>바람 주기</span>
            </button>
        </div>

        <!-- ① 상단 구역: 진행도 바 -->
        <div style="width:100%;height:10vh;display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:5;">
            <div style="width:min(78vw,380px);">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                    <span style="color:rgba(160,255,200,0.55);font-size:0.78rem;">성장 진행도</span>
                    <span id="ghProgressLabel" style="color:#7dffc8;font-size:0.78rem;">0 / 30</span>
                </div>
                <div style="height:7px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden;">
                    <div id="ghProgressBar" style="height:100%;width:0%;background:linear-gradient(to right,#7dffc8,#38ef7d);border-radius:4px;transition:width 0.35s;"></div>
                </div>
            </div>
        </div>

        <!-- ③ 완성 메시지 -->
        <div id="ghComplete" style="display:none;text-align:center;padding:6px 20px;
            background:rgba(125,255,200,0.08);border:1px solid rgba(125,255,200,0.3);
            border-radius:14px;color:#7dffc8;z-index:200;width:min(78vw,380px);
            position:fixed;top:10vh;left:50%;transform:translateX(-50%);">
            <p style="font-size:1.05rem;margin:0 0 6px;">🍎 열매가 열렸어요!</p>
            <button onclick="ghReset()" style="padding:6px 18px;border:none;border-radius:10px;cursor:pointer;
                background:rgba(125,255,200,0.15);color:#7dffc8;border:1px solid rgba(125,255,200,0.3);
                font-family:'Jua',sans-serif;font-size:0.9rem;">새로 키우기</button>
        </div>

        <!-- ② 중간 구역: 식물 이미지 -->
        <div style="flex:1;display:flex;align-items:flex-start;justify-content:center;z-index:5;min-height:0;">
            <div id="ghPlantWrap" style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                <div style="position:relative;display:flex;align-items:center;justify-content:center;">
                    <img id="ghPlantImg" src="assets/greenhouse/sprout1.png" style="
                        width:26vh;
                        transition:opacity 0.4s;"/>
                    <img id="ghAppleImg" src="assets/greenhouse/apple.png" style="
                        display:none;
                        position:absolute;top:35%;left:65%;transform:translateX(-50%);
                        width:20%;
                        transition:opacity 0.4s;"/>
                </div>
            </div>
        </div>

        <!-- ④ 하단 구역: 행성 -->
        <div style="width:100%;height:clamp(200px,44vw,360px);overflow:hidden;flex-shrink:0;position:relative;">
            ${planetHtml}
            <p style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);
                color:rgba(255,255,255,0.7);font-size:0.9rem;white-space:nowrap;
                text-shadow:0 0 10px rgba(0,0,0,0.8);font-family:'Jua',sans-serif;z-index:2;">내가만든 행성</p>
        </div>
    </div>`;
}

let ghCareCount = 0;
let GH_MAX = 30;
let ghStages = [
    { img:'assets/greenhouse/sprout1.png', name:'새싹',    msg:'', threshold:0,  apple:false, width:'26vh', marginTop:'57vh' },
    { img:'assets/greenhouse/sprout2.png', name:'새싹2',   msg:'', threshold:5,  apple:false, width:'28vh', marginTop:'54vh' },
    { img:'assets/greenhouse/flower1.png', name:'꽃',      msg:'', threshold:10, apple:false, width:'32vh', marginTop:'50vh' },
    { img:'assets/greenhouse/flower2.png', name:'꽃2',     msg:'', threshold:15, apple:false, width:'40vh', marginTop:'43vh' },
    { img:'assets/greenhouse/flower3.png', name:'꽃3',     msg:'', threshold:20, apple:false, width:'52vh', marginTop:'35vh' },
    { img:'assets/greenhouse/tree.png',    name:'나무',    msg:'', threshold:25, apple:false, width:'82vh', marginTop:'12vh' },
    { img:'assets/greenhouse/tree.png',    name:'사과나무',msg:'', threshold:30, apple:true,  width:'82vh', marginTop:'12vh' },
];

function ghGetStage() {
    let s = ghStages[0];
    for (const st of ghStages) { if (ghCareCount >= st.threshold) s = st; }
    return s;
}

function ghUpdateUI() {
    const s = ghGetStage();
    const g = id => document.getElementById(id);
    if (g('ghPlantImg'))     { g('ghPlantImg').src = s.img; g('ghPlantImg').style.width = s.width; }
    if (g('ghPlantWrap'))    g('ghPlantWrap').style.marginTop = s.marginTop;
    if (g('ghAppleImg'))     g('ghAppleImg').style.display = s.apple ? 'block' : 'none';
    if (g('ghProgressBar'))  g('ghProgressBar').style.width = Math.min(100,(ghCareCount/GH_MAX)*100)+'%';
    if (g('ghProgressLabel'))g('ghProgressLabel').textContent = Math.min(ghCareCount,GH_MAX)+' / '+GH_MAX;
    const done = ghCareCount >= GH_MAX;
    if (g('ghBtns'))     g('ghBtns').style.display     = done ? 'none' : 'block';
    if (g('ghComplete')) g('ghComplete').style.display = done ? 'block' : 'none';
}

function ghCare(type) {
       if (ghCareCount >= GH_MAX) return;
    ghCareCount++;
    ghUpdateUI();
    if (type === 'rain') {
    ghAnimRain();
    AudioManager.play('water');
    setTimeout(() => AudioManager.stop('water'), 1200);  // 비 그치면 정지
}
    if (type === 'sun') {
        ghAnimSun();
        AudioManager.play('light');   // ← 햇빛 효과음
        // 햇빛 버튼 주변 밝아지는 효과
        const sunBtn = document.querySelector('.gh-float-btn[onclick="ghCare(\'sun\')"]');
        if (sunBtn) {
            sunBtn.style.transition = 'box-shadow 0.3s, filter 0.3s';
            sunBtn.style.boxShadow = '0 0 80px rgba(255,200,50,1), 0 0 200px rgba(255,150,0,0.8)';
            sunBtn.style.filter = 'brightness(1.8)';
            setTimeout(() => {
                if (sunBtn) {
                    sunBtn.style.boxShadow = '0 0 24px rgba(245,158,11,0.7), 0 0 48px rgba(245,158,11,0.3)';
                    sunBtn.style.filter = '';
                }
            }, 1000);
        }
    }
    if (type === 'wind') ghAnimWind();
    
    if (ghCareCount === GH_MAX) {
        reduceStress(5);
    }
}

function ghAnimRain() {
    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const drop = document.createElement('div');
            drop.className = 'gh-rain-drop';
            drop.style.left = Math.random() * 100 + 'vw';
            drop.style.top = '-5px';   // ← 추가 (5px 위에서 시작)
            drop.style.animationDelay = Math.random() * 0.4 + 's';
            document.body.appendChild(drop);
            setTimeout(() => drop.remove(), 1200);
        }, i * 20);
    }
}

function ghAnimSun() {
    const img = document.getElementById('ghPlantImg');
    if (!img) return;
    img.classList.remove('gh-sun-glow');
    void img.offsetWidth;
    img.classList.add('gh-sun-glow');
    setTimeout(() => img.classList.remove('gh-sun-glow'), 1200);
}

function ghAnimWind() {
    const img = document.getElementById('ghPlantImg');
    if (!img) return;
    img.classList.remove('gh-wind-shake');
    void img.offsetWidth;
    img.classList.add('gh-wind-shake');
    setTimeout(() => img.classList.remove('gh-wind-shake'), 600);
}

function ghReset() {
    ghCareCount = 0;
    const g = id => document.getElementById(id);
    if (g('ghComplete'))     g('ghComplete').style.display = 'none';
    if (g('ghBtns'))         g('ghBtns').style.display = 'block';
    if (g('ghPlantImg'))     { g('ghPlantImg').src = ghStages[0].img; g('ghPlantImg').style.width = ghStages[0].width; }
    if (g('ghPlantWrap'))    g('ghPlantWrap').style.marginTop = ghStages[0].marginTop;
    if (g('ghAppleImg'))     g('ghAppleImg').style.display = 'none';
    if (g('ghProgressBar'))  g('ghProgressBar').style.width = '0%';
    if (g('ghProgressLabel'))g('ghProgressLabel').textContent = '0 / 30';
}

function initPlantGame() {
    ghCareCount = 0;
    ghUpdateUI();
    const c = document.getElementById('ghPlanetCanvas');
    if (c && appState.planets && appState.planets.length > 0) {
        const img = new Image();
        img.onload = function() {
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.save();
            ctx.beginPath();
            ctx.arc(250, 250, 250, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, 0, 0, 500, 500);
            ctx.restore();
        };
        img.src = appState.planets[0].canvasData;
    }
}

/* ==========================================================================
 * BONFIRE PAGE — 불멍 (검은 화면 + 별 + 중앙 FIRE.MP4 영상)
 * ========================================================================== */
function renderBonfirePage() {
    // 별 HTML 생성 (200개, 다양한 크기/속도)
    let starsHtml = '';
    for (let i = 0; i < 200; i++) {
        const x    = Math.random() * 100;
        const y    = Math.random() * 100;
        const size = Math.random() * 2.5 + 0.3;
        const dur  = Math.random() * 3 + 1.5;
        const del  = Math.random() * 4;
        const op   = Math.random() * 0.6 + 0.2;
        starsHtml += `<div style="position:absolute;left:${x}%;top:${y}%;width:${size}px;height:${size}px;
            background:#fff;border-radius:50%;opacity:${op};
            animation:bonfireTwinkle ${dur}s ${del}s ease-in-out infinite;
            pointer-events:none;"></div>`;
    }

    return `
    <style>
        @keyframes bonfireTwinkle {
            0%,100% { opacity: var(--base-op, 0.3); transform: scale(1); }
            50%      { opacity: 1;                   transform: scale(1.4); }
        }
        /* 페이지 이동 버튼 네온 펄스 + 바운스 */
        @keyframes bfNeonPulse {
            0%   { box-shadow: 0 0 8px 2px rgba(255,140,50,0.3), 0 0 20px 4px rgba(255,120,30,0.15); border-color: rgba(255,140,50,0.4); }
            50%  { box-shadow: 0 0 22px 6px rgba(255,160,60,0.9), 0 0 55px 12px rgba(255,100,20,0.5); border-color: rgba(255,200,80,0.9); }
            100% { box-shadow: 0 0 8px 2px rgba(255,140,50,0.3), 0 0 20px 4px rgba(255,120,30,0.15); border-color: rgba(255,140,50,0.4); }
        }
        @keyframes bfBounce {
            0%,100% { transform: translateY(0px); }
            30%     { transform: translateY(-10px); }
            50%     { transform: translateY(-14px); }
            70%     { transform: translateY(-10px); }
        }
        .bf-nav-btn {
            font-family: 'Jua', sans-serif;
            font-size: 0.95rem;
            letter-spacing: 1.5px;
            padding: 12px 32px;
            border-radius: 50px;
            cursor: pointer;
            border: 1.5px solid rgba(255,140,50,0.5);
            background: rgba(20,10,5,0.7);
            color: rgba(255,200,120,0.9);
            animation: bfBounce 1.4s ease-in-out infinite, bfNeonPulse 2.2s ease-in-out infinite;
            backdrop-filter: blur(6px);
        }
        .bf-nav-btn:hover {
            animation: none;
            transform: scale(1.1) translateY(-4px);
            box-shadow: 0 0 50px rgba(255,170,60,1), 0 0 100px rgba(255,100,20,0.6) !important;
            color: #fff;
        }
        #bonfireVideo {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: 2;
        }
    </style>
    <div style="
        position: fixed; inset: 0;
        background: #000;
        overflow: hidden;
        font-family: 'Jua', sans-serif;
    ">
        <!-- 별 레이어 -->
        <div style="position:absolute;inset:0;pointer-events:none;z-index:1;">${starsHtml}</div>

        <!-- FIRE 영상 (fullscreen) -->
        <video id="bonfireVideo" autoplay loop muted playsinline>
            <source src="assets/FIRE.mp4" type="video/mp4">
        </video>

        <!-- 라운지로 돌아가기 버튼 (다른 페이지와 동일한 hub-back-btn 스타일) -->
        <button class="hub-back-btn" onclick="navigateToHubWithLoading()" style="position:fixed;top:18px;left:18px;z-index:100;">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            <span>라운지로 돌아가기</span>
        </button>
    </div>`;
}

function initBonfirePage() {
    // 별 opacity CSS 변수 설정
    document.querySelectorAll('[style*="bonfireTwinkle"]').forEach(el => {
        const op = parseFloat(el.style.opacity) || 0.3;
        el.style.setProperty('--base-op', op);
    });
}


/* ==========================================================================
 * 17. BOOT — 페이지 로드 시 앱 시작
 * ========================================================================== */
// DOM이 완전히 로드되면 init() 함수를 호출해 앱을 시작합니다.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
/* 랜딩 BGM 자동재생 보장 */
(function() {
    var _started = false;
    function _tryBGM() {
        if (_started) return;
        if (currentPage !== 'landing') return;
        _started = true;
        var s = AudioManager.sounds['intro'];
        if (s) { s.muted = isMuted; s.currentTime = 0; s.play().catch(function(){}); }
        document.removeEventListener('click', _tryBGM);
        document.removeEventListener('touchstart', _tryBGM);
        document.removeEventListener('keydown', _tryBGM);
    }
    setTimeout(_tryBGM, 100);
    document.addEventListener('click', _tryBGM);
    document.addEventListener('touchstart', _tryBGM);
    document.addEventListener('keydown', _tryBGM);
})();

/* 전역 버튼 클릭 효과음 */
document.addEventListener('click', function(e) {
    var btn = e.target.closest('button, .survey-card, .menu-item, .ip-planet, .gh-float-btn');
    if (!btn) return;
    if (btn.classList.contains('volume-button')) return;
    if (btn.classList.contains('menu-button')) return;
    if (btn.closest('#toolBar')) return;
    if (btn.classList.contains('bubble-item')) return;
    var snd = AudioManager.sounds['button'];
    if (snd) { snd.muted = isMuted; snd.currentTime = 0; snd.play().catch(function(){}); }
}, true);