// ---------- ELEMENTOS ----------
const video = document.getElementById('video');
const flash = document.getElementById('flash');
const shutter = document.getElementById('shutter');
const canvas = document.getElementById('canvas');
const galleryPreview = document.querySelector('.gallery-preview');
const galleryOverlay = document.getElementById('galleryOverlay');
const currentPhotoDiv = document.getElementById('currentPhoto');
const photoCounterSpan = document.getElementById('photoCounter');
const expiryInfoDiv = document.getElementById('expiryInfo');
const toastMsg = document.getElementById('toastMsg');
const closeGalleryBtn = document.getElementById('closeGalleryBtn');
const prevPhotoBtn = document.getElementById('prevPhotoBtn');
const nextPhotoBtn = document.getElementById('nextPhotoBtn');
const deletePhotoBtn = document.getElementById('deletePhotoBtn');
const flipBtn = document.getElementById('flipBtn');
const tempTimeSelect = document.getElementById('tempTime');

// ---------- ESTADO GLOBAL ----------
let photos = [];           // { data, expiresAt? }
let currentIndex = 0;
let timerInterval = null;   // intervalo do contador regressivo
let globalCleanInterval = null;
let useFront = false;       // controle da câmera frontal/traseira

// ---------- FUNÇÕES DE UTILIDADE ----------

// Mostrar toast rápido
function showToast(message, duration = 2200) {
    toastMsg.innerText = message;
    toastMsg.style.opacity = '1';
    setTimeout(() => {
        toastMsg.style.opacity = '0';
    }, duration);
}

// Formatar tempo humano (ms) de maneira legível
function formatExpiryTime(msLeft) {
    if (msLeft <= 0) return "EXPIRADA";
    
    // Para valores muito pequenos, mostrar segundos mesmo se for < 1 minuto
    if (msLeft < 60000) {
        const seconds = Math.floor(msLeft / 1000);
        return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
    }
    
    const hours = Math.floor(msLeft / 3600000);
    const minutes = Math.floor((msLeft % 3600000) / 60000);
    const seconds = Math.floor((msLeft % 60000) / 1000);
    
    if (hours > 48) {
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
        if (minutes > 0) return `${hours}h ${minutes}m`;
        return `${hours}h`;
    }
    if (minutes > 0) {
        if (seconds > 0) return `${minutes}m ${seconds}s`;
        return `${minutes}m`;
    }
    return `${seconds}s`;
}

// Parar contador regressivo atual
function stopExpiryTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// ---------- GERENCIAMENTO DE FOTOS ----------

// Carregar dados do localStorage
function loadPhotosFromStorage() {
    const stored = localStorage.getItem('myPhotos');
    if (stored) {
        photos = JSON.parse(stored);
    } else {
        photos = [];
    }
    cleanExpiredPhotos();
    updateThumbnail();
}

// Remover fotos expiradas (temp)
function cleanExpiredPhotos() {
    const now = Date.now();
    const beforeCount = photos.length;
    photos = photos.filter(p => !p.expiresAt || p.expiresAt > now);
    if (beforeCount !== photos.length) {
        localStorage.setItem('myPhotos', JSON.stringify(photos));
        updateThumbnail();
        // Se a galeria estiver aberta e a foto atual foi removida, recarregar
        if (galleryOverlay.style.display === 'flex') {
            if (photos.length === 0) {
                closeGallery();
            } else {
                if (currentIndex >= photos.length) currentIndex = photos.length - 1;
                if (currentIndex < 0 && photos.length) currentIndex = 0;
                if (photos.length) showPhoto();
                else closeGallery();
            }
        }
    }
}

// Atualizar miniatura da galeria (última foto não expirada)
function updateThumbnail() {
    if (photos.length === 0) {
        galleryPreview.style.backgroundImage = 'none';
        galleryPreview.style.backgroundColor = '#1e1e1e';
    } else {
        const lastPhoto = photos[photos.length - 1];
        if (lastPhoto && lastPhoto.data) {
            galleryPreview.style.backgroundImage = `url(${lastPhoto.data})`;
            galleryPreview.style.backgroundSize = 'cover';
        }
    }
}

// Atualiza o display de expiração da foto atual e inicia contagem
function startExpiryTimerForCurrent() {
    stopExpiryTimer();
    if (photos.length === 0 || !photos[currentIndex]) {
        if (expiryInfoDiv) expiryInfoDiv.innerText = "📸 Nenhuma foto";
        return;
    }
    const photo = photos[currentIndex];
    const expiresAt = photo.expiresAt;
    
    if (!expiresAt) {
        expiryInfoDiv.innerHTML = "♾️ Foto permanente · sem expiração";
        return;
    }
    
    function updateTimerDisplay() {
        const now = Date.now();
        const diff = expiresAt - now;
        if (diff <= 0) {
            expiryInfoDiv.innerHTML = "⛔ EXPIRADA · será removida";
            handleExpiredCurrentPhoto();
            return;
        }
        const timeStr = formatExpiryTime(diff);
        expiryInfoDiv.innerHTML = `⏳ EXPIRA EM:  ${timeStr}`;
    }
    
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        if (photos.length === 0 || !photos[currentIndex]) {
            stopExpiryTimer();
            return;
        }
        const currentPhoto = photos[currentIndex];
        if (!currentPhoto.expiresAt) {
            expiryInfoDiv.innerHTML = "♾️ Foto permanente · guardada";
            return;
        }
        const diff = currentPhoto.expiresAt - Date.now();
        if (diff <= 0) {
            handleExpiredCurrentPhoto();
        } else {
            expiryInfoDiv.innerHTML = `⏳ EXPIRA EM:  ${formatExpiryTime(diff)}`;
        }
    }, 1000);
}

// Lida com expiração da foto atual: remove da lista, atualiza storage e UI
function handleExpiredCurrentPhoto() {
    if (photos.length === 0) return;
    const expiredId = currentIndex;
    if (expiredId >= photos.length) return;
    const photoToCheck = photos[expiredId];
    if (photoToCheck && photoToCheck.expiresAt && photoToCheck.expiresAt <= Date.now()) {
        photos.splice(expiredId, 1);
        localStorage.setItem('myPhotos', JSON.stringify(photos));
        updateThumbnail();
        
        if (photos.length === 0) {
            closeGallery();
            showToast("📭 Foto expirou e foi excluída", 1500);
            return;
        }
        if (currentIndex >= photos.length) currentIndex = photos.length - 1;
        if (currentIndex < 0 && photos.length) currentIndex = 0;
        showPhoto();
        showToast("⏰ Uma foto temporária expirou e foi removida", 1800);
    } else {
        cleanExpiredPhotos();
        if (photos.length === 0) closeGallery();
        else showPhoto();
    }
}

// Exibir foto atual na galeria
function showPhoto() {
    if (photos.length === 0) {
        closeGallery();
        return;
    }
    const photo = photos[currentIndex];
    if (photo && photo.data) {
        currentPhotoDiv.style.backgroundImage = `url(${photo.data})`;
        photoCounterSpan.innerText = `${currentIndex + 1} / ${photos.length}`;
        startExpiryTimerForCurrent();
    } else {
        photos.splice(currentIndex, 1);
        localStorage.setItem('myPhotos', JSON.stringify(photos));
        updateThumbnail();
        if (photos.length === 0) closeGallery();
        else showPhoto();
    }
}

function openGallery() {
    if (photos.length === 0) {
        showToast("📭 Nenhuma foto na galeria", 1200);
        return;
    }
    currentIndex = photos.length - 1;
    galleryOverlay.style.display = 'flex';
    showPhoto();
}

function closeGallery() {
    galleryOverlay.style.display = 'none';
    stopExpiryTimer();
    cleanExpiredPhotos();
}

function nextPhoto() {
    if (photos.length === 0) return;
    if (currentIndex < photos.length - 1) {
        currentIndex++;
        showPhoto();
    } else {
        showToast("📸 Última foto", 800);
    }
}

function prevPhoto() {
    if (photos.length === 0) return;
    if (currentIndex > 0) {
        currentIndex--;
        showPhoto();
    } else {
        showToast("📸 Primeira foto", 800);
    }
}

function deletePhoto() {
    if (photos.length === 0) {
        closeGallery();
        return;
    }
    const wasTemp = photos[currentIndex]?.expiresAt ? true : false;
    photos.splice(currentIndex, 1);
    localStorage.setItem('myPhotos', JSON.stringify(photos));
    updateThumbnail();
    
    if (photos.length === 0) {
        closeGallery();
        showToast("🗑️ Todas as fotos foram removidas", 1200);
        return;
    }
    if (currentIndex >= photos.length) currentIndex = photos.length - 1;
    if (currentIndex < 0) currentIndex = 0;
    showPhoto();
    showToast(wasTemp ? "✅ Foto temporária removida manualmente" : "❌ Foto excluída", 1300);
}

// ---------- CÂMERA + CAPTURA ----------

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
    } catch (err) {
        alert("Permita o acesso à câmera para usar todas as funções.");
        console.error(err);
    }
}

function flipCamera() {
    useFront = !useFront;
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
    }
    const constraints = { video: { facingMode: useFront ? "user" : "environment" } };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            video.srcObject = stream;
            video.style.transform = "scaleX(1)";
        })
        .catch(err => alert("Erro ao alternar câmera"));
}

// capturar foto (shutter)
function takePhoto() {
    flash.style.opacity = "1";
    setTimeout(() => flash.style.opacity = "0", 100);
    
    if (!video.videoWidth || !video.videoHeight) {
        showToast("⚠️ Aguarde a câmera iniciar", 1000);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const isMirrored = video.style.transform === "scaleX(-1)";
    if (isMirrored) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (isMirrored) ctx.restore();
    
    const imageData = canvas.toDataURL('image/jpeg', 0.85);
    
    const selectedMode = document.querySelector('.mode.selected').getAttribute('data-mode');
    let photoObj = { data: imageData };
    
    if (selectedMode === "TEMP") {
        const durationMs = parseInt(tempTimeSelect.value, 10);
        photoObj.expiresAt = Date.now() + durationMs;
        const selectedOptionText = tempTimeSelect.options[tempTimeSelect.selectedIndex]?.text || "tempo";
        let tempoDesc = selectedOptionText.toLowerCase();
        if (durationMs === 60000) tempoDesc = "1 minuto";
        showToast(`⏱️ Foto TEMPORÁRIA · expira em ${tempoDesc}`, 2800);
    } else {
        showToast("📸 Foto salva na galeria!", 1000);
    }
    
    photos.push(photoObj);
    localStorage.setItem('myPhotos', JSON.stringify(photos));
    updateThumbnail();
    
    if (galleryOverlay.style.display === 'flex') {
        currentIndex = photos.length - 1;
        showPhoto();
    }
}

// ---------- MODOS E CONFIGURAÇÕES ----------

function selectMode(el) {
    document.querySelectorAll('.mode').forEach(m => m.classList.remove('selected'));
    el.classList.add('selected');
    const tempOptionsDiv = document.getElementById('tempOptions');
    const modeText = el.getAttribute('data-mode');
    
    if (modeText === "TEMP") {
        tempOptionsDiv.style.display = "block";
        shutter.style.backgroundColor = "#ffcc00";
        shutter.style.outline = "3px solid #ffdd55";
    } else if (modeText === "VIDEO") {
        tempOptionsDiv.style.display = "none";
        shutter.style.backgroundColor = "#ff3b30";
        shutter.style.outline = "3px solid #ff6b60";
        showToast("🎥 Modo Vídeo (captura imagem estática)", 1200);
    } else {
        tempOptionsDiv.style.display = "none";
        shutter.style.backgroundColor = "white";
        shutter.style.outline = "3px solid white";
    }
}

function toggleSetting(el) {
    const parent = el.parentElement;
    [...parent.children].forEach(s => s.classList.remove('active-yellow'));
    el.classList.add('active-yellow');
}

// ---------- LIMPEZA PERIÓDICA ----------

function startGlobalCleanup() {
    if (globalCleanInterval) clearInterval(globalCleanInterval);
    globalCleanInterval = setInterval(() => {
        cleanExpiredPhotos();
        if (galleryOverlay.style.display === 'flex' && photos.length > 0 && currentIndex < photos.length) {
            const stillValid = photos[currentIndex];
            if (!stillValid) {
                if (photos.length) showPhoto();
                else closeGallery();
            } else if (stillValid.expiresAt && stillValid.expiresAt <= Date.now()) {
                handleExpiredCurrentPhoto();
            } else {
                if (stillValid.expiresAt) startExpiryTimerForCurrent();
            }
        } else if (galleryOverlay.style.display === 'flex' && photos.length === 0) {
            closeGallery();
        }
    }, 15000);
}

// ---------- EVENT LISTENERS ----------

// Configurar todos os event listeners
function setupEventListeners() {
    shutter.addEventListener('click', takePhoto);
    flipBtn.addEventListener('click', flipCamera);
    galleryPreview.addEventListener('click', openGallery);
    closeGalleryBtn.addEventListener('click', closeGallery);
    prevPhotoBtn.addEventListener('click', prevPhoto);
    nextPhotoBtn.addEventListener('click', nextPhoto);
    deletePhotoBtn.addEventListener('click', deletePhoto);
    
    // Modos
    document.querySelectorAll('.mode').forEach(mode => {
        mode.addEventListener('click', () => selectMode(mode));
    });
    
    // Configurações do top-nav
    document.querySelectorAll('.top-nav span').forEach(setting => {
        setting.addEventListener('click', () => toggleSetting(setting));
    });
}

// ---------- INICIALIZAÇÃO ----------

function init() {
    loadPhotosFromStorage();
    startCamera();
    startGlobalCleanup();
    setupEventListeners();
    
    window.addEventListener('focus', () => {
        cleanExpiredPhotos();
        if (galleryOverlay.style.display === 'flex') showPhoto();
    });
}

// Iniciar aplicação
init();