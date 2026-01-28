(() => {
    // --- State Management ---
    let steps = [];
    let resources = []; // { id, name, type, url, file }
    let currentStepId = null;
    const MAX_FRAMES = 10;
    const CHANNEL_NAME = 'multimedia_presentation_channel';
    const broadcastChannel = new BroadcastChannel(CHANNEL_NAME);

    // --- DOM Elements ---
    const el = {
        stepList: document.getElementById('step-list'),
        addStepBtn: document.getElementById('add-step-btn'),
        presentBtn: document.getElementById('present-btn'),
        backHomeBtn: document.getElementById('back-home-btn'),
        exportBtn: document.getElementById('export-btn'),
        importBtn: document.getElementById('import-btn'),
        importFileInput: document.getElementById('import-file-input'),
        manageResourcesBtn: document.getElementById('manage-resources-btn'),
        
        editorArea: document.getElementById('editor-area'),
        stepNameInput: document.getElementById('step-name-input'),
        stepAudioName: document.getElementById('step-audio-name'),
        selectStepAudioBtn: document.getElementById('select-step-audio-btn'),
        audioPreview: document.getElementById('audio-preview'),
        removeAudioBtn: document.getElementById('remove-audio-btn'),
        deleteStepBtn: document.getElementById('delete-step-btn'),
        copyStepBtn: document.getElementById('copy-step-btn'),
        
        framesCanvas: document.getElementById('frames-canvas'),
        addFrameBtn: document.getElementById('add-frame-btn'),
        fullscreenFrameBtn: document.getElementById('fullscreen-frame-btn'),
        
        // Modals
        resourceModal: document.getElementById('resource-modal'),
        resourcePickerModal: document.getElementById('resource-picker-modal'),
        importModal: document.getElementById('import-modal'),
        
        // Resource Manager
        addResourceInput: document.getElementById('add-resource-input'),
        addResourceBtn: document.getElementById('add-resource-btn'),
        addWebResourceBtn: document.getElementById('add-web-resource-btn'),
        resourceList: document.getElementById('resource-list'),
        
        // Picker
        pickerList: document.getElementById('picker-list'),
        
        // Import
        missingResourceList: document.getElementById('missing-resource-list'),
        finishImportBtn: document.getElementById('finish-import-btn'),
        autoMatchBtn: document.getElementById('auto-match-btn'),
        autoMatchInput: document.getElementById('auto-match-input'),
        
        frameTemplate: document.getElementById('frame-template'),
    };

    // --- Initialization ---
    function init() {
        addStep("Step 1");
        renderStepList();
        selectStep(steps[0].id);

        new Sortable(el.stepList, {
            handle: '.step-handle',
            animation: 150,
            onEnd: (evt) => {
                const item = steps.splice(evt.oldIndex, 1)[0];
                steps.splice(evt.newIndex, 0, item);
            }
        });

        bindEvents();
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        window.addEventListener('message', (event) => {
            if (event.data === 'PRESENTER_READY') {
                sendDataToPresenter(event.source);
            }
        });
    }

    // --- Data Helpers ---
    function generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    function getResource(id) {
        return resources.find(r => r.id === id);
    }

    function addResource(fileOrUrl, type = null, name = null) {
        let newRes;
        if (fileOrUrl instanceof File) {
            const file = fileOrUrl;
            const url = URL.createObjectURL(file);
            const fileType = file.type.startsWith('video') ? 'video' : (file.type.startsWith('audio') ? 'audio' : 'image');
            newRes = {
                id: generateId(),
                name: file.name,
                type: fileType,
                url: url,
                file: file
            };
        } else {
            // Web Link
            newRes = {
                id: generateId(),
                name: name || fileOrUrl,
                type: 'web',
                url: fileOrUrl,
                file: null
            };
        }
        resources.push(newRes);
        return newRes;
    }

    function addStep(name) {
        const newStep = {
            id: generateId(),
            name: name || `Step ${steps.length + 1}`,
            audioResourceId: null,
            frames: []
        };
        steps.push(newStep);
        return newStep;
    }

    function copyStep() {
        const currentStep = steps.find(s => s.id === currentStepId);
        if (!currentStep) return;

        const newStep = {
            id: generateId(),
            name: `${currentStep.name} (Copy)`,
            audioResourceId: currentStep.audioResourceId,
            frames: currentStep.frames.map(frame => ({
                ...frame,
                id: generateId()
            }))
        };

        const currentIndex = steps.findIndex(s => s.id === currentStepId);
        steps.splice(currentIndex + 1, 0, newStep);

        renderStepList();
        selectStep(newStep.id);
    }

    function addFrame(stepId, isFullscreen = false) {
        const step = steps.find(s => s.id === stepId);
        if (!step) return;
        if (step.frames.length >= MAX_FRAMES) {
            alert(`Tối đa ${MAX_FRAMES} khung hình.`);
            return;
        }

        let frameConfig;
        if (isFullscreen) {
            frameConfig = { x: 0, y: 0, width: 100, height: 100 };
        } else {
            const offset = step.frames.length * 5;
            frameConfig = { x: 10 + offset, y: 10 + offset, width: 30, height: 40 };
        }

        step.frames.push({
            id: generateId(),
            resourceId: null,
            loop: false,
            autoplay: true,
            fitCover: false,
            x: frameConfig.x,
            y: frameConfig.y,
            width: frameConfig.width,
            height: frameConfig.height,
            zIndex: step.frames.length + 1
        });
        renderFrames(step);
    }

    // --- Resource Manager Logic ---
    function renderResourceList(container, mode = 'manage', callback = null) {
        container.innerHTML = '';
        if (resources.length === 0) {
            container.innerHTML = '<p class="hint" style="text-align:center;">Chưa có tài nguyên nào.</p>';
            return;
        }

        resources.forEach(res => {
            const item = document.createElement('div');
            item.className = 'resource-item';
            
            let icon = '📄';
            if (res.type === 'image') icon = `<img src="${res.url}">`;
            else if (res.type === 'video') icon = '🎬';
            else if (res.type === 'audio') icon = '🎵';
            else if (res.type === 'web') icon = '🌐';

            item.innerHTML = `
                <div class="res-thumb">${icon}</div>
                <div class="res-info">
                    <div class="res-name" title="${res.name}">${res.name}</div>
                    <div class="res-type">${res.type}</div>
                </div>
                <div class="res-actions">
                    ${mode === 'manage' 
                        ? `<button class="btn-danger btn-sm delete-res-btn">Xóa</button>` 
                        : `<button class="btn-primary btn-sm select-res-btn">Chọn</button>`
                    }
                </div>
            `;

            if (mode === 'manage') {
                item.querySelector('.delete-res-btn').addEventListener('click', () => {
                    if (confirm('Xóa tài nguyên này? Các frame sử dụng nó sẽ bị lỗi.')) {
                        resources = resources.filter(r => r.id !== res.id);
                        renderResourceList(container, mode);
                        if (currentStepId) selectStep(currentStepId);
                    }
                });
            } else {
                item.querySelector('.select-res-btn').addEventListener('click', () => {
                    if (callback) callback(res.id);
                    el.resourcePickerModal.classList.add('hidden');
                });
            }

            container.appendChild(item);
        });
    }

    function openResourcePicker(filterType, callback) {
        renderResourceList(el.pickerList, 'pick', callback);
        el.resourcePickerModal.classList.remove('hidden');
    }

    // --- Export / Import ---
    function exportData() {
        const exportData = {
            steps: steps,
            resources: resources.map(r => ({
                id: r.id,
                name: r.name,
                type: r.type,
                // Export URL only if it's a web link
                url: r.type === 'web' ? r.url : null
            }))
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `presentation_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.steps || !data.resources) throw new Error("Invalid format");
                
                steps = data.steps;
                // Restore resources, keeping web URLs
                resources = data.resources.map(r => ({ 
                    ...r, 
                    url: r.type === 'web' ? r.url : null, 
                    file: null 
                }));

                renderMissingResources();
                el.importModal.classList.remove('hidden');

            } catch (err) {
                console.error(err);
                alert("Lỗi khi đọc file JSON.");
            }
        };
        reader.readAsText(file);
    }

    function renderMissingResources() {
        el.missingResourceList.innerHTML = '';
        
        // Filter out web resources as they don't need file upload
        const missingFiles = resources.filter(r => r.type !== 'web');
        
        if (missingFiles.length === 0) {
            el.missingResourceList.innerHTML = '<p class="hint">Tất cả tài nguyên web đã được khôi phục. Nếu có file ảnh/video, vui lòng kiểm tra lại.</p>';
        }

        missingFiles.forEach(res => {
            const item = document.createElement('div');
            item.className = `missing-item ${res.url ? 'resolved' : ''}`;
            
            let statusHtml = '';
            if (res.url) {
                statusHtml = `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="color:green;">✅ Đã có</span>
                        <button class="btn-secondary btn-sm change-file-btn">Thay đổi</button>
                    </div>
                `;
            } else {
                statusHtml = `<button class="btn-primary btn-sm select-file-btn">Chọn File</button>`;
            }

            item.innerHTML = `
                <div style="flex:1;">
                    <strong>${res.name}</strong> <span style="color:#666; font-size:0.85em;">(${res.type})</span>
                </div>
                ${statusHtml}
                <input type="file" class="resolve-file-input" style="display:none;">
            `;

            const input = item.querySelector('.resolve-file-input');
            
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    res.url = URL.createObjectURL(file);
                    res.file = file;
                    renderMissingResources();
                }
            });

            const selectBtn = item.querySelector('.select-file-btn');
            if (selectBtn) selectBtn.addEventListener('click', () => input.click());

            const changeBtn = item.querySelector('.change-file-btn');
            if (changeBtn) changeBtn.addEventListener('click', () => input.click());

            el.missingResourceList.appendChild(item);
        });
    }

    function autoMatchFiles(fileList) {
        let matchCount = 0;
        Array.from(fileList).forEach(file => {
            const targetRes = resources.find(r => r.name === file.name && !r.url && r.type !== 'web');
            
            if (targetRes) {
                targetRes.url = URL.createObjectURL(file);
                targetRes.file = file;
                matchCount++;
            }
        });

        if (matchCount > 0) {
            renderMissingResources();
            alert(`Đã tự động khớp ${matchCount} file.`);
        } else {
            alert("Không tìm thấy file nào trùng tên với danh sách thiếu.");
        }
    }

    // --- Rendering ---
    function renderStepList() {
        el.stepList.innerHTML = '';
        steps.forEach((step) => {
            const div = document.createElement('div');
            div.className = `step-item ${step.id === currentStepId ? 'active' : ''}`;
            div.dataset.id = step.id;
            div.innerHTML = `
                <span class="step-handle">☰</span>
                <span class="step-name">${step.name}</span>
            `;
            div.addEventListener('click', () => selectStep(step.id));
            el.stepList.appendChild(div);
        });
    }

    function selectStep(id) {
        currentStepId = id;
        const step = steps.find(s => s.id === id);
        if (!step) return;

        document.querySelectorAll('.step-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === id);
        });

        el.stepNameInput.value = step.name;
        
        const audioRes = getResource(step.audioResourceId);
        if (audioRes && audioRes.url) {
            el.stepAudioName.textContent = audioRes.name;
            el.audioPreview.src = audioRes.url;
            el.audioPreview.style.display = 'block';
            el.removeAudioBtn.classList.remove('hidden');
        } else {
            el.stepAudioName.textContent = "Chưa có";
            el.audioPreview.src = '';
            el.audioPreview.style.display = 'none';
            el.removeAudioBtn.classList.add('hidden');
        }

        renderFrames(step);
    }

    function renderFrames(step) {
        el.framesCanvas.innerHTML = '';
        const sortedFrames = [...step.frames].sort((a, b) => a.zIndex - b.zIndex);

        sortedFrames.forEach((frame, index) => {
            const clone = el.frameTemplate.content.cloneNode(true);
            const card = clone.querySelector('.frame-card');
            
            card.style.left = `${frame.x}%`;
            card.style.top = `${frame.y}%`;
            card.style.width = `${frame.width}%`;
            card.style.height = `${frame.height}%`;
            card.style.zIndex = frame.zIndex;
            card.dataset.id = frame.id;

            card.querySelector('.frame-title').textContent = `Khung ${index + 1}`;
            
            const header = card.querySelector('.frame-header');
            header.addEventListener('mousedown', (e) => startDrag(e, frame));

            const handle = card.querySelector('.resize-handle');
            handle.addEventListener('mousedown', (e) => startResize(e, frame));

            card.addEventListener('mousedown', () => {
                document.querySelectorAll('.frame-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });

            card.querySelector('.frame-delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Xóa khung hình này?')) {
                    step.frames = step.frames.filter(f => f.id !== frame.id);
                    renderFrames(step);
                }
            });

            card.querySelector('.z-up').addEventListener('click', (e) => { e.stopPropagation(); changeZIndex(frame, 1); });
            card.querySelector('.z-down').addEventListener('click', (e) => { e.stopPropagation(); changeZIndex(frame, -1); });
            card.querySelector('.z-top').addEventListener('click', (e) => { e.stopPropagation(); changeZIndex(frame, 'top'); });
            card.querySelector('.z-bottom').addEventListener('click', (e) => { e.stopPropagation(); changeZIndex(frame, 'bottom'); });

            const uploadPlaceholder = card.querySelector('.upload-placeholder');
            const mediaPreview = card.querySelector('.media-preview');
            const res = getResource(frame.resourceId);

            if (res && res.url) {
                uploadPlaceholder.classList.add('hidden');
                mediaPreview.classList.remove('hidden');
                mediaPreview.innerHTML = '';

                if (res.type === 'image') {
                    const img = document.createElement('img');
                    img.src = res.url;
                    mediaPreview.appendChild(img);
                } else if (res.type === 'video') {
                    const video = document.createElement('video');
                    video.src = res.url;
                    video.controls = true;
                    mediaPreview.appendChild(video);
                } else if (res.type === 'web') {
                    const iframe = document.createElement('iframe');
                    iframe.src = res.url;
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = 'none';
                    iframe.style.pointerEvents = 'none'; // Disable interaction in editor
                    mediaPreview.appendChild(iframe);
                }
            } else {
                uploadPlaceholder.classList.remove('hidden');
                mediaPreview.classList.add('hidden');
            }

            if (frame.fitCover) card.classList.add('fit-cover');

            card.querySelector('.select-resource-btn').addEventListener('click', () => {
                openResourcePicker(null, (resId) => {
                    frame.resourceId = resId;
                    renderFrames(step);
                });
            });

            const loopCb = card.querySelector('.frame-loop-checkbox');
            const autoplayCb = card.querySelector('.frame-autoplay-checkbox');
            const coverCb = card.querySelector('.frame-cover-checkbox');
            
            loopCb.checked = frame.loop;
            autoplayCb.checked = frame.autoplay;
            coverCb.checked = frame.fitCover;

            loopCb.addEventListener('change', (e) => frame.loop = e.target.checked);
            autoplayCb.addEventListener('change', (e) => frame.autoplay = e.target.checked);
            coverCb.addEventListener('change', (e) => {
                frame.fitCover = e.target.checked;
                if (frame.fitCover) card.classList.add('fit-cover');
                else card.classList.remove('fit-cover');
            });

            el.framesCanvas.appendChild(card);
        });
    }

    // --- Drag & Resize Logic ---
    let isDragging = false;
    let isResizing = false;
    let activeFrame = null;
    let startX, startY;
    let startLeft, startTop, startWidth, startHeight;
    let canvasRect;

    function startDrag(e, frame) {
        e.preventDefault();
        isDragging = true;
        activeFrame = frame;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = frame.x;
        startTop = frame.y;
        canvasRect = el.framesCanvas.getBoundingClientRect();
    }

    function startResize(e, frame) {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        activeFrame = frame;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = frame.width;
        startHeight = frame.height;
        canvasRect = el.framesCanvas.getBoundingClientRect();
    }

    function handleMouseMove(e) {
        if (!activeFrame || (!isDragging && !isResizing)) return;

        const dxPx = e.clientX - startX;
        const dyPx = e.clientY - startY;
        const dxPct = (dxPx / canvasRect.width) * 100;
        const dyPct = (dyPx / canvasRect.height) * 100;

        if (isDragging) {
            activeFrame.x = startLeft + dxPct;
            activeFrame.y = startTop + dyPct;
            updateActiveFrameDOM();
        } else if (isResizing) {
            activeFrame.width = Math.max(5, startWidth + dxPct);
            activeFrame.height = Math.max(5, startHeight + dyPct);
            updateActiveFrameDOM();
        }
    }

    function handleMouseUp() {
        if (isDragging || isResizing) {
            isDragging = false;
            isResizing = false;
            activeFrame = null;
        }
    }

    function updateActiveFrameDOM() {
        if (!activeFrame) return;
        const card = document.querySelector(`.frame-card[data-id="${activeFrame.id}"]`);
        if (card) {
            card.style.left = `${activeFrame.x}%`;
            card.style.top = `${activeFrame.y}%`;
            card.style.width = `${activeFrame.width}%`;
            card.style.height = `${activeFrame.height}%`;
        }
    }

    function changeZIndex(frame, action) {
        const step = steps.find(s => s.id === currentStepId);
        if (!step) return;

        step.frames.sort((a, b) => a.zIndex - b.zIndex);
        step.frames.forEach((f, i) => f.zIndex = i + 1);

        const currentZ = frame.zIndex;
        const maxZ = step.frames.length;

        if (action === 'top') frame.zIndex = maxZ + 1;
        else if (action === 'bottom') frame.zIndex = 0;
        else if (action === 1) {
            const upper = step.frames.find(f => f.zIndex === currentZ + 1);
            if (upper) { upper.zIndex = currentZ; frame.zIndex = currentZ + 1; }
        } else if (action === -1) {
            const lower = step.frames.find(f => f.zIndex === currentZ - 1);
            if (lower) { lower.zIndex = currentZ; frame.zIndex = currentZ - 1; }
        }

        step.frames.sort((a, b) => a.zIndex - b.zIndex);
        step.frames.forEach((f, i) => f.zIndex = i + 1);

        renderFrames(step);
    }

    // --- Event Listeners ---
    function bindEvents() {
        el.addStepBtn.addEventListener('click', () => {
            const newStep = addStep();
            renderStepList();
            selectStep(newStep.id);
        });

        el.copyStepBtn.addEventListener('click', copyStep);
        el.exportBtn.addEventListener('click', exportData);
        el.importBtn.addEventListener('click', () => el.importFileInput.click());
        el.importFileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                importData(e.target.files[0]);
                e.target.value = '';
            }
        });

        el.manageResourcesBtn.addEventListener('click', () => {
            renderResourceList(el.resourceList, 'manage');
            el.resourceModal.classList.remove('hidden');
        });

        el.addResourceBtn.addEventListener('click', () => el.addResourceInput.click());
        el.addResourceInput.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(file => addResource(file));
            renderResourceList(el.resourceList, 'manage');
            e.target.value = '';
        });

        el.addWebResourceBtn.addEventListener('click', () => {
            const url = prompt("Nhập URL trang web (ví dụ: https://example.com):");
            if (url) {
                addResource(url, 'web', url);
                renderResourceList(el.resourceList, 'manage');
            }
        });

        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => el.resourceModal.classList.add('hidden'));
        });
        document.querySelectorAll('.close-picker-btn').forEach(btn => {
            btn.addEventListener('click', () => el.resourcePickerModal.classList.add('hidden'));
        });

        el.finishImportBtn.addEventListener('click', () => {
            el.importModal.classList.add('hidden');
            renderStepList();
            selectStep(steps[0].id);
        });

        el.autoMatchBtn.addEventListener('click', () => el.autoMatchInput.click());
        el.autoMatchInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                autoMatchFiles(e.target.files);
                e.target.value = '';
            }
        });

        el.stepNameInput.addEventListener('input', (e) => {
            const step = steps.find(s => s.id === currentStepId);
            if (step) {
                step.name = e.target.value;
                const listItem = document.querySelector(`.step-item[data-id="${step.id}"] .step-name`);
                if (listItem) listItem.textContent = step.name;
            }
        });

        el.selectStepAudioBtn.addEventListener('click', () => {
            openResourcePicker('audio', (resId) => {
                const step = steps.find(s => s.id === currentStepId);
                if (step) {
                    step.audioResourceId = resId;
                    selectStep(step.id);
                }
            });
        });

        el.removeAudioBtn.addEventListener('click', () => {
            const step = steps.find(s => s.id === currentStepId);
            if (step) {
                step.audioResourceId = null;
                selectStep(step.id);
            }
        });

        el.deleteStepBtn.addEventListener('click', () => {
            if (steps.length <= 1) return alert("Phải giữ lại ít nhất 1 step.");
            if (confirm("Bạn có chắc muốn xóa step này?")) {
                const idx = steps.findIndex(s => s.id === currentStepId);
                steps.splice(idx, 1);
                renderStepList();
                selectStep(steps[Math.max(0, idx - 1)].id);
            }
        });

        el.addFrameBtn.addEventListener('click', () => addFrame(currentStepId, false));
        el.fullscreenFrameBtn.addEventListener('click', () => addFrame(currentStepId, true));
        el.backHomeBtn.addEventListener('click', () => window.location.href = '../index.html');
        el.presentBtn.addEventListener('click', startPresentation);
    }

    // --- Presentation Logic ---
    function startPresentation() {
        const presentationSteps = steps.map(step => ({
            ...step,
            audioFile: step.audioResourceId ? (getResource(step.audioResourceId)?.file || null) : null,
            frames: step.frames.map(frame => ({
                ...frame,
                file: frame.resourceId ? (getResource(frame.resourceId)?.file || null) : null,
                type: frame.resourceId ? (getResource(frame.resourceId)?.type || null) : null,
                // Pass URL directly for web resources
                url: (frame.resourceId && getResource(frame.resourceId)?.type === 'web') 
                     ? getResource(frame.resourceId)?.url 
                     : null
            }))
        }));

        try {
            localStorage.setItem('presentation_data', JSON.stringify(presentationSteps));
        } catch (e) {
            console.error(e);
            alert("Không thể lưu dữ liệu trình chiếu.");
            return;
        }

        const width = 1200;
        const height = 800;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        const presenterWindow = window.open(
            'presenter.html', 
            'PresenterWindow', 
            `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
        );

        if (!presenterWindow) alert("Vui lòng cho phép mở popup để trình chiếu.");
    }

    function sendDataToPresenter(targetWindow) {
        const presentationSteps = steps.map(step => ({
            ...step,
            audioFile: step.audioResourceId ? (getResource(step.audioResourceId)?.file || null) : null,
            frames: step.frames.map(frame => ({
                ...frame,
                file: frame.resourceId ? (getResource(frame.resourceId)?.file || null) : null,
                type: frame.resourceId ? (getResource(frame.resourceId)?.type || null) : null,
                url: (frame.resourceId && getResource(frame.resourceId)?.type === 'web') 
                     ? getResource(frame.resourceId)?.url 
                     : null
            }))
        }));

        targetWindow.postMessage({
            type: 'INIT_DATA',
            data: presentationSteps
        }, '*');
    }

    const originalSelectStep = selectStep;
    selectStep = function(id) {
        originalSelectStep(id);
        broadcastStep(id);
    };

    function broadcastStep(id) {
        const step = steps.find(s => s.id === id);
        if (step) {
            const resolvedStep = {
                ...step,
                audioUrl: step.audioResourceId ? (getResource(step.audioResourceId)?.url || null) : null,
                frames: step.frames.map(frame => ({
                    ...frame,
                    url: frame.resourceId ? (getResource(frame.resourceId)?.url || null) : null,
                    type: frame.resourceId ? (getResource(frame.resourceId)?.type || null) : null
                }))
            };

            broadcastChannel.postMessage({
                type: 'SHOW_STEP',
                data: resolvedStep
            });
        }
    }

    init();
})();
