(() => {
    const CHANNEL_NAME = 'multimedia_presentation_channel';
    const broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    let steps = [];
    let currentIndex = 0;
    let audienceWindow = null;
    let isPaused = false;
    
    let pauseConfig = {
        mode: 'black',
        audio: 'mute'
    };

    // DOM Elements
    const el = {
        currentViewport: document.getElementById('current-viewport'),
        nextViewport: document.getElementById('next-viewport'),
        slideList: document.getElementById('slide-list'),
        currentStepName: document.getElementById('current-step-name'),
        nextStepName: document.getElementById('next-step-name'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        pauseBtn: document.getElementById('pause-btn'),
        pauseSettingsBtn: document.getElementById('pause-settings-btn'),
        pauseSettingsPopover: document.getElementById('pause-settings-popover'),
        endBtn: document.getElementById('end-btn'),
        clock: document.getElementById('clock')
    };

    function init() {
        // Request data from opener (Editor)
        if (window.opener) {
            window.opener.postMessage('PRESENTER_READY', '*');
        } else {
            alert("Không tìm thấy cửa sổ chính. Vui lòng mở lại từ Editor.");
        }

        // Listen for data
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'INIT_DATA') {
                loadData(event.data.data);
            }
        });

        // Clock
        setInterval(() => {
            const now = new Date();
            el.clock.textContent = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }, 1000);

        // Events
        el.prevBtn.addEventListener('click', goPrev);
        el.nextBtn.addEventListener('click', goNext);
        el.pauseBtn.addEventListener('click', togglePause);
        
        el.pauseSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            el.pauseSettingsPopover.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!el.pauseSettingsPopover.contains(e.target) && e.target !== el.pauseSettingsBtn) {
                el.pauseSettingsPopover.classList.remove('active');
            }
        });

        document.querySelectorAll('input[name="pause-mode"]').forEach(input => {
            input.addEventListener('change', (e) => {
                pauseConfig.mode = e.target.value;
                if (isPaused) sendPauseCommand();
            });
        });

        document.querySelectorAll('input[name="pause-audio"]').forEach(input => {
            input.addEventListener('change', (e) => {
                pauseConfig.audio = e.target.value;
                if (isPaused) sendPauseCommand();
            });
        });

        el.endBtn.addEventListener('click', () => {
            if (audienceWindow) audienceWindow.close();
            window.close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'Space' || e.key === 'Enter') {
                goNext();
            } else if (e.key === 'ArrowLeft') {
                goPrev();
            } else if (e.key === 'b' || e.key === 'B') {
                togglePause();
            }
        });
    }

    function loadData(rawSteps) {
        // Recreate Blob URLs from File objects, keep Web URLs as is
        steps = rawSteps.map(step => ({
            ...step,
            audioUrl: step.audioFile ? URL.createObjectURL(step.audioFile) : step.audioUrl,
            frames: step.frames.map(frame => ({
                ...frame,
                url: frame.file ? URL.createObjectURL(frame.file) : frame.url
            }))
        }));

        console.log("Presenter loaded steps:", steps);

        if (!steps || steps.length === 0) {
            alert("Không có dữ liệu trình chiếu.");
            return;
        }

        openAudienceWindow();
        renderSlideList();
        updateView();
    }

    function openAudienceWindow() {
        const width = 1024;
        const height = 768;
        const left = window.screenX + window.outerWidth; 
        const top = window.screenY;

        audienceWindow = window.open(
            '', 
            'AudienceWindow', 
            `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
        );

        if (!audienceWindow) {
            alert("Vui lòng cho phép popup để mở màn hình khán giả.");
            return;
        }

        audienceWindow.document.write(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <title>Màn hình trình chiếu</title>
                <style>
                    body { margin: 0; background: #000; overflow: hidden; height: 100vh; width: 100vw; cursor: none; display: flex; flex-direction: column; }
                    
                    /* Top Bar for Step Name */
                    #top-bar {
                        height: 60px;
                        background-color: #000;
                        color: #fff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-family: system-ui, -apple-system, sans-serif;
                        font-size: 24px;
                        font-weight: bold;
                        z-index: 2147483647;
                        border-bottom: 1px solid #333;
                        flex-shrink: 0;
                        transition: opacity 0.5s;
                        opacity: 0;
                    }
                    #top-bar.visible {
                        opacity: 1;
                    }

                    .canvas { 
                        position: relative; 
                        flex: 1; 
                        width: 100%; 
                        transition: opacity 0.3s; 
                        overflow: hidden;
                    }
                    
                    .frame { 
                        position: absolute; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        overflow: hidden;
                        transform: translateZ(0);
                        backface-visibility: hidden;
                    }
                    .frame img, .frame video { width: 100%; height: 100%; object-fit: contain; }
                    .frame.fit-cover img, .frame.fit-cover video { object-fit: cover; }
                    .frame iframe { width: 100%; height: 100%; border: none; pointer-events: auto; background: #fff; }
                    
                    #black-overlay {
                        position: fixed;
                        inset: 0;
                        background: #000;
                        z-index: 9998;
                        opacity: 0;
                        pointer-events: none;
                        transition: opacity 0.3s;
                    }
                    #black-overlay.active {
                        opacity: 1;
                        pointer-events: auto;
                    }

                    #start-overlay {
                        position: fixed;
                        inset: 0;
                        background: rgba(0,0,0,0.8);
                        z-index: 9999;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                    }
                    #start-btn {
                        padding: 20px 40px;
                        font-size: 24px;
                        background: #0d6efd;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <div id="top-bar"></div>
                <div id="canvas" class="canvas"></div>
                <div id="black-overlay"></div>
                
                <div id="start-overlay">
                    <button id="start-btn">CLICK ĐỂ BẮT ĐẦU</button>
                </div>

                <audio id="bg-audio"></audio>
                <script>
                    const canvas = document.getElementById('canvas');
                    const overlay = document.getElementById('black-overlay');
                    const startOverlay = document.getElementById('start-overlay');
                    const topBar = document.getElementById('top-bar');
                    const bgAudio = document.getElementById('bg-audio');
                    const channel = new BroadcastChannel('${CHANNEL_NAME}');
                    
                    let isReady = false;
                    let pendingStep = null;
                    let stepNameTimeout = null;

                    // Unlock Audio Context
                    startOverlay.addEventListener('click', () => {
                        startOverlay.style.display = 'none';
                        isReady = true;
                        
                        // Play silent sound to unlock
                        bgAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
                        bgAudio.play().then(() => {
                            if (pendingStep) renderStep(pendingStep);
                        }).catch(e => console.log("Unlock failed", e));
                    });

                    channel.onmessage = (event) => {
                        const { type, data, config } = event.data;
                        if (type === 'SHOW_STEP') {
                            if (isReady) {
                                renderStep(data);
                            } else {
                                pendingStep = data;
                            }
                        } else if (type === 'PAUSE') {
                            handlePause(config);
                        } else if (type === 'RESUME') {
                            handleResume();
                        }
                    };

                    function handlePause(config) {
                        if (config.mode === 'black') {
                            overlay.classList.add('active');
                        } else {
                            overlay.classList.remove('active');
                        }

                        if (config.audio === 'mute') {
                            if (!bgAudio.paused) bgAudio.pause();
                        }
                        
                        document.querySelectorAll('video').forEach(v => v.pause());
                    }

                    function handleResume() {
                        overlay.classList.remove('active');
                        if (bgAudio.src && bgAudio.paused) bgAudio.play().catch(() => {});
                        document.querySelectorAll('video').forEach(v => {
                            if (v.dataset.autoplay === 'true') v.play().catch(() => {});
                        });
                    }

                    function showStepName(name) {
                        topBar.textContent = name;
                        topBar.classList.add('visible');
                        
                        if (stepNameTimeout) clearTimeout(stepNameTimeout);
                        stepNameTimeout = setTimeout(() => {
                            topBar.classList.remove('visible');
                        }, 5000); // Hide after 5 seconds
                    }

                    function renderStep(step) {
                        overlay.classList.remove('active');
                        showStepName(step.name);

                        if (step.audioUrl) {
                            if (bgAudio.src !== step.audioUrl) {
                                bgAudio.src = step.audioUrl;
                                bgAudio.loop = step.audioLoop || false;
                                bgAudio.play().catch(e => console.log("Audio play failed", e));
                            } else if (bgAudio.paused) {
                                bgAudio.play();
                            }
                        } else {
                            bgAudio.pause();
                            bgAudio.src = "";
                        }

                        canvas.innerHTML = '';
                        const sortedFrames = (step.frames || []).sort((a, b) => a.zIndex - b.zIndex);

                        sortedFrames.forEach(frame => {
                            const div = document.createElement('div');
                            div.className = 'frame';
                            if (frame.fitCover) div.classList.add('fit-cover');
                            
                            div.style.left = frame.x + '%';
                            div.style.top = frame.y + '%';
                            div.style.width = frame.width + '%';
                            div.style.height = frame.height + '%';
                            div.style.zIndex = frame.zIndex;

                            if (frame.url) {
                                if (frame.type === 'image') {
                                    const img = document.createElement('img');
                                    img.src = frame.url;
                                    div.appendChild(img);
                                } else if (frame.type === 'video') {
                                    const video = document.createElement('video');
                                    video.src = frame.url;
                                    if (frame.loop) video.loop = true;
                                    if (frame.autoplay) {
                                        video.autoplay = true;
                                        video.muted = false;
                                        video.dataset.autoplay = 'true';
                                    }
                                    div.appendChild(video);
                                    if (frame.autoplay) {
                                        video.play().catch(e => console.log("Video autoplay failed", e));
                                    }
                                } else if (frame.type === 'web' || frame.type === 'app') {
                                    const iframe = document.createElement('iframe');
                                    iframe.src = frame.url;
                                    iframe.allow = "autoplay; fullscreen";
                                    iframe.style.backgroundColor = '#fff';
                                    div.appendChild(iframe);
                                }
                            }
                            canvas.appendChild(div);
                        });
                    }
                </script>
            </body>
            </html>
        `);
        audienceWindow.document.close();
    }

    function renderMiniCanvas(container, step) {
        container.innerHTML = '';
        const canvas = document.createElement('div');
        canvas.className = 'mini-canvas';
        
        const sortedFrames = (step.frames || []).sort((a, b) => a.zIndex - b.zIndex);
        sortedFrames.forEach(frame => {
            const div = document.createElement('div');
            div.className = 'mini-frame';
            if (frame.fitCover) div.classList.add('fit-cover');
            
            div.style.left = frame.x + '%';
            div.style.top = frame.y + '%';
            div.style.width = frame.width + '%';
            div.style.height = frame.height + '%';
            div.style.zIndex = frame.zIndex;

            if (frame.url) {
                if (frame.type === 'image') {
                    const img = document.createElement('img');
                    img.src = frame.url;
                    div.appendChild(img);
                } else if (frame.type === 'video') {
                    const video = document.createElement('video');
                    video.src = frame.url;
                    video.muted = true;
                    div.appendChild(video);
                } else if (frame.type === 'web' || frame.type === 'app') {
                    const iframe = document.createElement('iframe');
                    iframe.src = frame.url;
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = 'none';
                    iframe.style.pointerEvents = 'none'; // Disable interaction in preview
                    iframe.style.backgroundColor = '#fff';
                    div.appendChild(iframe);
                }
            } else {
                div.style.border = '1px dashed #555';
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.justifyContent = 'center';
                div.textContent = 'Empty';
                div.style.fontSize = '10px';
                div.style.color = '#555';
            }

            canvas.appendChild(div);
        });
        container.appendChild(canvas);
    }

    function updateView() {
        isPaused = false;
        updatePauseButton();

        const currentStep = steps[currentIndex];
        const nextStep = steps[currentIndex + 1];

        el.currentStepName.textContent = `${currentIndex + 1}. ${currentStep.name}`;
        el.nextStepName.textContent = nextStep ? `${currentIndex + 2}. ${nextStep.name}` : "(Hết)";

        renderMiniCanvas(el.currentViewport, currentStep);
        if (nextStep) {
            renderMiniCanvas(el.nextViewport, nextStep);
        } else {
            el.nextViewport.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;">Hết slide</div>';
        }

        document.querySelectorAll('.slide-thumbnail').forEach((thumb, idx) => {
            thumb.classList.toggle('active', idx === currentIndex);
            if (idx === currentIndex) {
                thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        });

        console.log("Broadcasting step:", currentStep);
        broadcastChannel.postMessage({
            type: 'SHOW_STEP',
            data: currentStep
        });
    }

    function togglePause() {
        isPaused = !isPaused;
        updatePauseButton();
        
        if (isPaused) {
            sendPauseCommand();
        } else {
            broadcastChannel.postMessage({ type: 'RESUME' });
        }
    }

    function sendPauseCommand() {
        broadcastChannel.postMessage({
            type: 'PAUSE',
            config: pauseConfig
        });
    }

    function updatePauseButton() {
        if (isPaused) {
            el.pauseBtn.textContent = "▶ Tiếp tục";
            el.pauseBtn.classList.remove('warning');
            el.pauseBtn.classList.add('success');
            el.pauseBtn.style.borderColor = '#198754';
            el.pauseBtn.style.background = '#198754';
        } else {
            el.pauseBtn.textContent = "⏸ Tạm dừng";
            el.pauseBtn.classList.remove('success');
            el.pauseBtn.classList.add('warning');
            el.pauseBtn.style.borderColor = '#ffc107';
            el.pauseBtn.style.background = '#ffc107';
        }
    }

    function renderSlideList() {
        el.slideList.innerHTML = '';
        steps.forEach((step, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'slide-thumbnail';
            thumb.innerHTML = `
                <div class="thumb-content"></div>
                <div class="thumb-label">${index + 1}. ${step.name}</div>
            `;
            
            renderMiniCanvas(thumb.querySelector('.thumb-content'), step);

            thumb.addEventListener('click', () => {
                currentIndex = index;
                updateView();
            });
            el.slideList.appendChild(thumb);
        });
    }

    function goNext() {
        if (currentIndex < steps.length - 1) {
            currentIndex++;
            updateView();
        }
    }

    function goPrev() {
        if (currentIndex > 0) {
            currentIndex--;
            updateView();
        }
    }

    init();
})();
