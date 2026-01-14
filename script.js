(() => {
  const MAX_IMAGES = 50;
  const MAX_TEAMS = 10;

  // Ảnh mặc định khi ảnh lỗi hoặc chưa có ảnh (SVG placeholder)
  const DEFAULT_IMAGE_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect fill='%23f0f0f0' width='800' height='600'/%3E%3Ctext fill='%23999' font-family='Arial, sans-serif' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3EẢnh không tải được%3C/text%3E%3C/svg%3E";
  const PLACEHOLDER_IMAGE_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect fill='%23f0f0f0' width='800' height='600'/%3E%3Ctext fill='%23999' font-family='Arial, sans-serif' font-size='48' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3EChưa có ảnh%3C/text%3E%3C/svg%3E";

  /** @type {{ id: string; url: string; name: string; blobUrl?: string }[]} */
  let images = [];
  /** @type {{ id: string; name: string; score: number }[]} */
  let teams = [];

  /** @type {{ type: 'idle' | 'random' | 'display' | 'scoring'; remainingImages: number }} */
  let gameState = {
    type: "idle",
    remainingImages: 0,
  };

  let randomPhaseTimeoutId = null;
  let randomImageIntervalId = null;
  let displayPhaseTimeoutId = null;
  let countdownIntervalId = null;
  let currentCountdownSeconds = 0;

  /** @type {HTMLAudioElement | null} */
  let audioElement = null;

  const el = {
    imageFileInput: document.getElementById("image-file-input"),
    imageUrlInput: document.getElementById("image-url-input"),
    addImageUrlBtn: document.getElementById("add-image-url-btn"),
    imageList: document.getElementById("image-list"),
    imageCount: document.getElementById("image-count"),

    teamNameInput: document.getElementById("team-name-input"),
    addTeamBtn: document.getElementById("add-team-btn"),
    teamList: document.getElementById("team-list"),
    teamCount: document.getElementById("team-count"),

    audioFileInput: document.getElementById("audio-file-input"),
    audioUrlInput: document.getElementById("audio-url-input"),

    bgColorInput: document.getElementById("bg-color-input"),
    bgFileInput: document.getElementById("bg-file-input"),
    bgUrlInput: document.getElementById("bg-url-input"),
    applyBgBtn: document.getElementById("apply-bg-btn"),
    clearBgBtn: document.getElementById("clear-bg-btn"),

    displayDurationInput: document.getElementById("display-duration-input"),
    randomMinInput: document.getElementById("random-min-input"),
    randomMaxInput: document.getElementById("random-max-input"),

    resetGameBtn: document.getElementById("reset-game-btn"),

    startRoundBtn: document.getElementById("start-round-btn"),
    confirmScoreBtn: document.getElementById("confirm-score-btn"),

    scoreboardBody: document.getElementById("scoreboard-body"),

    toggleConfigBtn: document.getElementById("toggle-config-btn"),
    appMain: document.querySelector(".app-main"),
    configPanel: document.getElementById("config-panel"),

    fullscreenDisplay: document.getElementById("fullscreen-display"),
    fullscreenImage: document.getElementById("fullscreen-image"),
    fullscreenTimer: document.getElementById("fullscreen-timer"),
    fullscreenStopBtn: document.getElementById("fullscreen-stop-btn"),
    fullscreenStateLabel: document.getElementById("fullscreen-state-label"),
    fullscreenRemainingImages: document.getElementById("fullscreen-remaining-images"),

    fullscreenScore: document.getElementById("fullscreen-score"),
    fullscreenScoreTeamList: document.getElementById("fullscreen-score-team-list"),
    fullscreenConfirmScoreBtn: document.getElementById("fullscreen-confirm-score-btn"),

    fullscreenScoreboard: document.getElementById("fullscreen-scoreboard"),
    fullscreenScoreboardBody: document.getElementById("fullscreen-scoreboard-body"),
    closeFullscreenScoreboardBtn: document.getElementById("close-fullscreen-scoreboard-btn"),
    resetAfterFinishBtn: document.getElementById("reset-after-finish-btn"),

    nextRoundChoice: document.getElementById("next-round-choice"),
    remainingImagesChoice: document.getElementById("remaining-images-choice"),
    continueNextRoundBtn: document.getElementById("continue-next-round-btn"),
    endGameNowBtn: document.getElementById("end-game-now-btn"),
  };

  function safeNumberInput(input, fallback) {
    const v = Number(input.value);
    if (Number.isFinite(v) && v > 0) return v;
    return fallback;
  }

  function setupImageErrorHandler(imgElement) {
    imgElement.addEventListener("error", () => {
      imgElement.src = DEFAULT_IMAGE_URL;
    });
  }

  function updateImageListUI() {
    el.imageCount.textContent = String(images.length);
    if (el.fullscreenRemainingImages) {
      el.fullscreenRemainingImages.textContent = String(images.length);
    }

    el.imageList.innerHTML = "";
    images.forEach((img, index) => {
      const pill = document.createElement("div");
      pill.className = "pill";

      const thumb = document.createElement("img");
      thumb.src = img.url;
      thumb.alt = img.name || `Ảnh ${index + 1}`;
      setupImageErrorHandler(thumb);

      const label = document.createElement("span");
      label.textContent = img.name || `Ảnh ${index + 1}`;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "pill-remove";
      remove.textContent = "✕";
      remove.addEventListener("click", () => {
        removeImage(img.id);
      });

      pill.appendChild(thumb);
      pill.appendChild(label);
      pill.appendChild(remove);
      el.imageList.appendChild(pill);
    });
  }

  function updateTeamListUI() {
    el.teamCount.textContent = String(teams.length);
    el.teamList.innerHTML = "";

    teams.forEach((team) => {
      const pill = document.createElement("div");
      pill.className = "pill";
      pill.textContent = `${team.name} (${team.score})`;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "pill-remove";
      remove.textContent = "✕";
      remove.addEventListener("click", () => {
        removeTeam(team.id);
      });

      pill.appendChild(remove);
      el.teamList.appendChild(pill);
    });

    updateScoreboardUI();
  }

  function updateScoreboardUI() {
    const sorted = [...teams].sort((a, b) => b.score - a.score);
    el.scoreboardBody.innerHTML = "";
    sorted.forEach((team) => {
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      nameTd.textContent = team.name;
      const scoreTd = document.createElement("td");
      scoreTd.textContent = String(team.score);
      tr.appendChild(nameTd);
      tr.appendChild(scoreTd);
      el.scoreboardBody.appendChild(tr);
    });
  }

  function updateFullscreenScoreboardUI() {
    if (!el.fullscreenScoreboardBody) return;
    const sorted = [...teams].sort((a, b) => b.score - a.score);
    el.fullscreenScoreboardBody.innerHTML = "";
    sorted.forEach((team) => {
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      nameTd.textContent = team.name;
      const scoreTd = document.createElement("td");
      scoreTd.textContent = String(team.score);
      tr.appendChild(nameTd);
      tr.appendChild(scoreTd);
      el.fullscreenScoreboardBody.appendChild(tr);
    });
  }

  function showFullscreenScoreboard() {
    updateFullscreenScoreboardUI();
    if (el.fullscreenScoreboard) {
      el.fullscreenScoreboard.classList.remove("hidden");
    }
  }

  function hideFullscreenScoreboard() {
    if (el.fullscreenScoreboard) {
      el.fullscreenScoreboard.classList.add("hidden");
    }
  }

  function toggleConfigPanel() {
    if (!el.appMain || !el.toggleConfigBtn) return;
    const collapsed = el.appMain.classList.toggle("config-collapsed");
    el.toggleConfigBtn.textContent = collapsed ? "Hiện cài đặt" : "Ẩn cài đặt";
  }

  function removeImage(id) {
    const idx = images.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const [removed] = images.splice(idx, 1);
    if (removed.blobUrl) {
      URL.revokeObjectURL(removed.blobUrl);
    }
    gameState.remainingImages = images.length;
    updateImageListUI();
  }

  function removeTeam(id) {
    teams = teams.filter((t) => t.id !== id);
    updateTeamListUI();
  }

  function setGameState(type) {
    gameState.type = type;
    if (!el.fullscreenStateLabel) return;
    switch (type) {
      case "idle":
        el.fullscreenStateLabel.textContent = "Sẵn sàng";
        break;
      case "random":
        el.fullscreenStateLabel.textContent = "Đang random ảnh...";
        break;
      case "display":
        el.fullscreenStateLabel.textContent = "Đang tạo dáng";
        break;
      case "scoring":
        el.fullscreenStateLabel.textContent = "Chấm điểm";
        break;
    }
  }

  function clearAllTimers() {
    [randomPhaseTimeoutId, randomImageIntervalId, displayPhaseTimeoutId, countdownIntervalId].forEach(
      (id) => {
        if (id != null) clearTimeout(id);
      }
    );
    randomPhaseTimeoutId = null;
    randomImageIntervalId = null;
    displayPhaseTimeoutId = null;
    countdownIntervalId = null;
  }

  function stopAudio() {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
  }

  function setupAudioFromInputs() {
    if (audioElement) {
      audioElement.pause();
      audioElement = null;
    }

    const file = el.audioFileInput.files && el.audioFileInput.files[0];
    const urlValue = el.audioUrlInput.value.trim();

    let src = null;
    if (file) {
      src = URL.createObjectURL(file);
    } else if (urlValue) {
      src = urlValue;
    }

    if (src) {
      audioElement = new Audio(src);
      audioElement.loop = true;
    }
  }

  const BG_STORAGE_KEY = "mini_game_bg_v1";
  /** @type {{ type: 'default' | 'color' | 'image'; color?: string; imageUrl?: string }} */
  let bgState = { type: "default" };

  function applyBackground(state) {
    bgState = state;
    const body = document.body;

    body.classList.remove("has-custom-bg");
    body.style.backgroundImage = "";
    body.style.backgroundColor = "";

    if (state.type === "color" && state.color) {
      body.classList.add("has-custom-bg");
      body.style.backgroundImage = "none";
      body.style.backgroundColor = state.color;
    } else if (state.type === "image" && state.imageUrl) {
      body.classList.add("has-custom-bg");
      // layer màu tối lên trên để chữ dễ đọc
      body.style.backgroundImage = `linear-gradient(rgba(2,6,23,0.55), rgba(2,6,23,0.85)), url('${state.imageUrl}')`;
      body.style.backgroundColor = "#0b1220";
    } else {
      // default: để CSS gốc quyết định
      body.style.backgroundImage = "";
      body.style.backgroundColor = "";
    }
  }

  function saveBackground(state) {
    try {
      localStorage.setItem(BG_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }

  function loadBackground() {
    try {
      const raw = localStorage.getItem(BG_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      applyBackground(parsed);

      // sync UI (nếu có)
      if (el.bgColorInput && parsed.type === "color" && parsed.color) {
        el.bgColorInput.value = parsed.color;
      }
      if (el.bgUrlInput && parsed.type === "image" && parsed.imageUrl) {
        el.bgUrlInput.value = parsed.imageUrl;
      }
    } catch {
      // ignore
    }
  }

  function setBackgroundFromInputs() {
    const color = el.bgColorInput ? el.bgColorInput.value : "";
    const file = el.bgFileInput && el.bgFileInput.files && el.bgFileInput.files[0];
    const urlValue = el.bgUrlInput ? el.bgUrlInput.value.trim() : "";

    if (file) {
      const blobUrl = URL.createObjectURL(file);
      const state = { type: "image", imageUrl: blobUrl };
      applyBackground(state);
      saveBackground(state);
      return;
    }

    if (urlValue) {
      const state = { type: "image", imageUrl: urlValue };
      applyBackground(state);
      saveBackground(state);
      return;
    }

    if (color) {
      const state = { type: "color", color };
      applyBackground(state);
      saveBackground(state);
      return;
    }

    const state = { type: "default" };
    applyBackground(state);
    saveBackground(state);
  }

  function clearBackground() {
    const state = { type: "default" };
    applyBackground(state);
    saveBackground(state);
    if (el.bgUrlInput) el.bgUrlInput.value = "";
    if (el.bgFileInput) el.bgFileInput.value = "";
  }

  async function startRound() {
    if (images.length === 0) {
      alert("Vui lòng thêm ít nhất 1 ảnh trước khi bắt đầu.");
      return;
    }
    if (teams.length === 0) {
      if (!confirm("Chưa có đội nào. Bạn vẫn muốn chơi không?")) {
        return;
      }
    }
    if (gameState.type !== "idle" && gameState.type !== "scoring") {
      return;
    }

    setupAudioFromInputs();

    const minRandom = safeNumberInput(el.randomMinInput, 15);
    const maxRandom = safeNumberInput(el.randomMaxInput, 50);
    const min = Math.min(minRandom, maxRandom);
    const max = Math.max(minRandom, maxRandom);

    const randomSeconds = Math.floor(Math.random() * (max - min + 1)) + min;
    currentCountdownSeconds = randomSeconds;
    if (el.fullscreenTimer) el.fullscreenTimer.textContent = String(currentCountdownSeconds);

    setGameState("random");
    el.startRoundBtn.disabled = true;
    if (el.fullscreenStopBtn) el.fullscreenStopBtn.disabled = false;

    if (el.fullscreenDisplay) el.fullscreenDisplay.classList.remove("hidden");
    if (el.fullscreenRemainingImages) {
      el.fullscreenRemainingImages.textContent = String(images.length);
    }
    if (el.fullscreenScore) el.fullscreenScore.classList.add("hidden");

    if (audioElement) {
      try {
        await audioElement.play();
      } catch (err) {
        console.warn("Không thể phát âm thanh tự động:", err);
      }
    }

    randomImageIntervalId = setInterval(() => {
      const img = images[Math.floor(Math.random() * images.length)];
      if (!img) return;
      if (el.fullscreenImage) {
        el.fullscreenImage.src = img.url;
        el.fullscreenImage.alt = img.name || "Ảnh random";
        setupImageErrorHandler(el.fullscreenImage);
      }
    }, 120);

    countdownIntervalId = setInterval(() => {
      currentCountdownSeconds -= 1;
      if (currentCountdownSeconds < 0) currentCountdownSeconds = 0;
      if (el.fullscreenTimer) el.fullscreenTimer.textContent = String(currentCountdownSeconds);
    }, 1000);

    randomPhaseTimeoutId = setTimeout(() => {
      stopRandomPhaseAndShowFinalImage();
    }, randomSeconds * 1000);
  }

  function stopRandomPhaseAndShowFinalImage() {
    if (gameState.type !== "random") return;

    if (randomImageIntervalId != null) {
      clearInterval(randomImageIntervalId);
      randomImageIntervalId = null;
    }
    if (randomPhaseTimeoutId != null) {
      clearTimeout(randomPhaseTimeoutId);
      randomPhaseTimeoutId = null;
    }
    if (countdownIntervalId != null) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }

    stopAudio();

    const idx = Math.floor(Math.random() * images.length);
    const selected = images[idx];
    if (!selected) {
      alert("Không còn ảnh nào để hiển thị.");
      resetGameVisuals();
      return;
    }

    if (el.fullscreenImage) {
      el.fullscreenImage.src = selected.url;
      el.fullscreenImage.alt = selected.name || "Ảnh được chọn toàn màn hình";
      setupImageErrorHandler(el.fullscreenImage);
    }
    if (el.fullscreenDisplay) {
      el.fullscreenDisplay.classList.remove("hidden");
    }

    const displaySeconds = safeNumberInput(el.displayDurationInput, 10);
    currentCountdownSeconds = displaySeconds;
    if (el.fullscreenTimer) {
      el.fullscreenTimer.textContent = String(currentCountdownSeconds);
    }
    setGameState("display");
    el.startRoundBtn.disabled = true;
    if (el.fullscreenStopBtn) el.fullscreenStopBtn.disabled = true;

    countdownIntervalId = setInterval(() => {
      currentCountdownSeconds -= 1;
      if (currentCountdownSeconds < 0) currentCountdownSeconds = 0;
      if (el.fullscreenTimer) {
        el.fullscreenTimer.textContent = String(currentCountdownSeconds);
      }
    }, 1000);

    displayPhaseTimeoutId = setTimeout(() => {
      if (countdownIntervalId != null) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
      }
      if (el.fullscreenTimer) {
        el.fullscreenTimer.textContent = "0";
      }
      beginScoringForImage(selected.id);
    }, displaySeconds * 1000);
  }

  function beginScoringForImage(imageId) {
    setGameState("scoring");
    el.startRoundBtn.disabled = true;
    if (el.fullscreenStopBtn) el.fullscreenStopBtn.disabled = true;

    // Ẩn màn hình hiển thị ảnh fullscreen
    if (el.fullscreenDisplay) {
      el.fullscreenDisplay.classList.add("hidden");
    }

    gameState.remainingImages = images.length - 1;
    if (el.fullscreenRemainingImages) {
      el.fullscreenRemainingImages.textContent = String(gameState.remainingImages);
    }

    images = images.filter((img) => img.id !== imageId);
    updateImageListUI();

    // Tạo danh sách đội cho màn chấm điểm fullscreen
    if (el.fullscreenScoreTeamList) {
      el.fullscreenScoreTeamList.innerHTML = "";
      teams.forEach((team) => {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "score-team";
        pill.dataset.teamId = team.id;
        pill.textContent = team.name;
        pill.addEventListener("click", () => {
          pill.classList.toggle("selected");
        });
        el.fullscreenScoreTeamList.appendChild(pill);
      });
    }

    // Hiển thị màn chấm điểm fullscreen
    if (el.fullscreenScore) {
      el.fullscreenScore.classList.remove("hidden");
    }
  }

  function confirmScoreAndNextRound() {
    if (gameState.type !== "scoring") return;

    // Lấy danh sách đội được chọn từ màn fullscreen hoặc panel
    const fullscreenSelected = el.fullscreenScoreTeamList
      ? Array.from(el.fullscreenScoreTeamList.querySelectorAll(".score-team.selected"))
      : [];

    const selectedTeamIds = fullscreenSelected.length > 0
      ? fullscreenSelected.map((btn) => btn.dataset.teamId)
      : [];

    if (selectedTeamIds.length === 0) {
      if (!confirm("Chưa chọn đội nào. Bạn muốn tiếp tục mà không cộng điểm?")) {
        return;
      }
    }

    selectedTeamIds.forEach((id) => {
      const team = teams.find((t) => t.id === id);
      if (team) team.score += 1;
    });

    updateTeamListUI();

    // Ẩn màn chấm điểm fullscreen và về lại giao diện chơi game
    if (el.fullscreenScore) {
      el.fullscreenScore.classList.add("hidden");
    }

    if (images.length === 0) {
      // Kết thúc game: hiển thị bảng điểm full màn hình
      setGameState("idle");
      el.startRoundBtn.disabled = true;
      if (el.fullscreenStopBtn) el.fullscreenStopBtn.disabled = true;
      showFullscreenScoreboard();
      return;
    }

    // Nếu còn ảnh: hiển thị màn hình chọn hành động tiếp theo
    if (el.nextRoundChoice) {
      el.nextRoundChoice.classList.remove("hidden");
    }
    if (el.remainingImagesChoice) {
      el.remainingImagesChoice.textContent = String(images.length);
    }
    setGameState("idle");
  }

  function stopRoundEarly() {
    if (gameState.type !== "random") return;
    stopRandomPhaseAndShowFinalImage();
  }

  function resetGameVisuals() {
    clearAllTimers();
    stopAudio();
    setGameState("idle");
    el.startRoundBtn.disabled = false;
    if (el.fullscreenStopBtn) el.fullscreenStopBtn.disabled = true;
    gameState.remainingImages = images.length;
    if (el.fullscreenDisplay) {
      el.fullscreenDisplay.classList.add("hidden");
    }
    if (el.fullscreenScore) {
      el.fullscreenScore.classList.add("hidden");
    }
    if (el.nextRoundChoice) {
      el.nextRoundChoice.classList.add("hidden");
    }
    hideFullscreenScoreboard();
    if (el.fullscreenTimer) el.fullscreenTimer.textContent = "0";
    if (el.fullscreenRemainingImages) el.fullscreenRemainingImages.textContent = String(images.length);
  }

  function fullResetGame() {
    if (!confirm("Reset sẽ xóa trạng thái vòng chơi hiện tại (không xóa ảnh/đội). Tiếp tục?")) {
      return;
    }
    resetGameVisuals();
  }

  function generateId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }

  function addImageFromFileList(fileList) {
    if (!fileList || fileList.length === 0) return;
    const remainingSlots = MAX_IMAGES - images.length;
    const files = Array.from(fileList).slice(0, remainingSlots);
    if (files.length < fileList.length) {
      alert(`Chỉ thêm được tối đa ${remainingSlots} ảnh nữa (tổng 50 ảnh).`);
    }

    files.forEach((file) => {
      const blobUrl = URL.createObjectURL(file);
      images.push({
        id: generateId("img"),
        url: blobUrl,
        name: file.name,
        blobUrl,
      });
    });
    gameState.remainingImages = images.length;
    updateImageListUI();
  }

  function addImageFromUrl(url) {
    if (!url) return;
    if (images.length >= MAX_IMAGES) {
      alert("Đã đạt tối đa 50 ảnh.");
      return;
    }

    images.push({
      id: generateId("img"),
      url,
      name: `Link ${images.length + 1}`,
    });
    gameState.remainingImages = images.length;
    updateImageListUI();
  }

  function addTeam(nameRaw) {
    const name = nameRaw.trim();
    if (!name) return;
    if (teams.length >= MAX_TEAMS) {
      alert("Đã đạt tối đa 10 đội.");
      return;
    }
    if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      alert("Tên đội đã tồn tại.");
      return;
    }
    teams.push({
      id: generateId("team"),
      name,
      score: 0,
    });
    updateTeamListUI();
  }

  function bindEvents() {
    el.imageFileInput.addEventListener("change", (e) => {
      const input = e.target;
      addImageFromFileList(input.files);
      input.value = "";
    });

    el.addImageUrlBtn.addEventListener("click", () => {
      const url = el.imageUrlInput.value.trim();
      if (!url) return;
      addImageFromUrl(url);
      el.imageUrlInput.value = "";
    });

    el.imageUrlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.addImageUrlBtn.click();
      }
    });

    el.addTeamBtn.addEventListener("click", () => {
      addTeam(el.teamNameInput.value);
      el.teamNameInput.value = "";
    });

    el.teamNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.addTeamBtn.click();
      }
    });

    el.audioFileInput.addEventListener("change", () => {
      if (el.audioFileInput.files && el.audioFileInput.files[0]) {
        el.audioUrlInput.value = "";
      }
    });

    el.audioUrlInput.addEventListener("input", () => {
      if (el.audioUrlInput.value.trim()) {
        el.audioFileInput.value = "";
      }
    });

    if (el.bgFileInput) {
      el.bgFileInput.addEventListener("change", () => {
        if (el.bgFileInput.files && el.bgFileInput.files[0] && el.bgUrlInput) {
          el.bgUrlInput.value = "";
        }
      });
    }
    if (el.bgUrlInput) {
      el.bgUrlInput.addEventListener("input", () => {
        if (el.bgUrlInput.value.trim() && el.bgFileInput) {
          el.bgFileInput.value = "";
        }
      });
    }
    if (el.applyBgBtn) {
      el.applyBgBtn.addEventListener("click", () => {
        setBackgroundFromInputs();
      });
    }
    if (el.clearBgBtn) {
      el.clearBgBtn.addEventListener("click", () => {
        clearBackground();
      });
    }

    el.startRoundBtn.addEventListener("click", () => {
      startRound();
    });

    if (el.fullscreenStopBtn) {
      el.fullscreenStopBtn.addEventListener("click", () => {
        stopRoundEarly();
      });
    }

    // confirmScoreBtn không còn dùng (chấm điểm fullscreen), giữ lại nếu tồn tại
    if (el.confirmScoreBtn) {
      el.confirmScoreBtn.addEventListener("click", () => {
        confirmScoreAndNextRound();
      });
    }

    if (el.fullscreenConfirmScoreBtn) {
      el.fullscreenConfirmScoreBtn.addEventListener("click", () => {
        confirmScoreAndNextRound();
      });
    }

    el.resetGameBtn.addEventListener("click", () => {
      fullResetGame();
    });

    if (el.toggleConfigBtn) {
      el.toggleConfigBtn.addEventListener("click", () => {
        toggleConfigPanel();
      });
    }

    if (el.closeFullscreenScoreboardBtn) {
      el.closeFullscreenScoreboardBtn.addEventListener("click", () => {
        hideFullscreenScoreboard();
        // quay về giao diện chơi game (nếu còn ảnh)
        setGameState("idle");
        el.startRoundBtn.disabled = images.length === 0;
        if (el.fullscreenStopBtn) el.fullscreenStopBtn.disabled = true;
      });
    }

    if (el.resetAfterFinishBtn) {
      el.resetAfterFinishBtn.addEventListener("click", () => {
        hideFullscreenScoreboard();
        resetGameVisuals();
      });
    }

    if (el.continueNextRoundBtn) {
      el.continueNextRoundBtn.addEventListener("click", () => {
        // Ẩn màn hình chọn và start round tiếp theo
        if (el.nextRoundChoice) {
          el.nextRoundChoice.classList.add("hidden");
        }
        startRound();
      });
    }

    if (el.endGameNowBtn) {
      el.endGameNowBtn.addEventListener("click", () => {
        // Ẩn màn hình chọn và hiển thị bảng điểm fullscreen
        if (el.nextRoundChoice) {
          el.nextRoundChoice.classList.add("hidden");
        }
        setGameState("idle");
        el.startRoundBtn.disabled = true;
        if (el.fullscreenStopBtn) el.fullscreenStopBtn.disabled = true;
        showFullscreenScoreboard();
      });
    }
  }

  function init() {
    bindEvents();
    gameState.remainingImages = images.length;
    setGameState("idle");
    if (el.fullscreenRemainingImages) el.fullscreenRemainingImages.textContent = String(images.length);
    if (el.fullscreenTimer) el.fullscreenTimer.textContent = "0";

    loadBackground();
    
    if (el.fullscreenImage) {
      setupImageErrorHandler(el.fullscreenImage);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

