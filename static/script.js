// =================================================================
//          VARIABLES GLOBALES
// =================================================================
let currentStream = null;
const capturedPhotos = [];
const capturedVideos = [];

// Variables para la grabación de video de la cámara
let videoMediaRecorder;
let videoChunks = [];

// Variables para la grabación de audio por campo
let audioMediaRecorder;
let audioFieldChunks = [];
let isFieldRecording = false;
let currentTargetInput = null;

// =================================================================
//          INICIALIZACIÓN DE EVENTOS
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Listener para el botón de activar cámara
    document.getElementById('activate-camera-btn').addEventListener('click', () => {
        startCamera();
        document.getElementById('activate-camera-btn').style.display = 'none';
    });

    // Listeners para los controles de la cámara
    document.getElementById('start-record-btn').addEventListener('click', startVideoRecording);
    document.getElementById('stop-record-btn').addEventListener('click', stopVideoRecording);

    // Listeners para adjuntar archivos
    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    document.getElementById('video-file-input').addEventListener('change', handleVideoUpload);

    // Listeners para grabación de audio por campo
    document.querySelectorAll('.record-btn').forEach(button => {
        button.addEventListener('click', () => startFieldRecording(button));
    });
    document.querySelectorAll('.stop-btn').forEach(button => {
        button.addEventListener('click', stopFieldRecording);
    });
});

// =================================================================
//          FUNCIONES DE CÁMARA (FOTO Y VIDEO)
// =================================================================
async function startCamera() {
    const videoElement = document.getElementById('videoElement');
    const cameraContainer = document.getElementById('camera-container');
    const actionButtons = document.querySelector('.action-buttons-wrapper');
    const stopRecordButton = document.getElementById('stop-record-btn');

    // Ocultar/mostrar botones al inicio
    document.getElementById('start-record-btn').style.display = 'flex';
    document.getElementById('take-photo').style.display = 'flex';
    stopRecordButton.style.display = 'none'; // Asegurarse que el de stop esté oculto
    stopRecordButton.style.backgroundColor = '#e74c3c'; // Restaurar color por si acaso

    try {
        const constraints = { video: { facingMode: 'environment' }, audio: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        videoElement.srcObject = stream;
        await videoElement.play();
        cameraContainer.style.display = 'block';
        actionButtons.style.display = 'flex';
    } catch (error) {
        console.error("Error al acceder a la cámara:", error);
        alert("No se pudo acceder a la cámara. Revisa los permisos.");
        document.getElementById('activate-camera-btn').style.display = 'block';
    }
}

function takePhoto() {
    if (!currentStream) { return; }
    const canvas = document.getElementById('photoCanvas');
    const videoElement = document.getElementById('videoElement');
    
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    canvas.getContext('2d').drawImage(videoElement, 0, 0);
    
    const photoBase64 = canvas.toDataURL('image/jpeg', 0.8);
    capturedPhotos.push(photoBase64);
    addPhotoThumbnail(photoBase64, capturedPhotos.length - 1);
}

function startVideoRecording() {
    if (!currentStream) { return; }
    try {
        let options = { mimeType: 'video/mp4; codecs=avc1' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: 'video/webm' };
        }
        let streamToRecord = isIOS() ? new MediaStream([currentStream.getVideoTracks()[0].clone(), ...currentStream.getAudioTracks()]) : currentStream;
        videoChunks = [];
        videoMediaRecorder = new MediaRecorder(streamToRecord, options);
        videoMediaRecorder.onstop = () => {
            if (isIOS()) streamToRecord.getTracks().forEach(track => track.stop());
            const videoBlob = new Blob(videoChunks, { type: options.mimeType });
            const reader = new FileReader();
            reader.readAsDataURL(videoBlob);
            reader.onloadend = () => {
                capturedVideos.push(reader.result);
                addVideoThumbnail(reader.result, capturedVideos.length - 1);
            };
        };
        videoMediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) videoChunks.push(event.data);
        };
        videoMediaRecorder.start();
        updateRecordingUI(true);
    } catch (error) {
        alert('ERROR al iniciar grabación: ' + error.message);
    }
}

function stopVideoRecording() {
    if (videoMediaRecorder && videoMediaRecorder.state === 'recording') {
        videoMediaRecorder.stop();
    }
    updateRecordingUI(false);
}

function updateRecordingUI(isRecordingActive) {
    document.getElementById('videoElement').classList.toggle('recording-active', isRecordingActive);
    document.getElementById('start-record-btn').style.display = isRecordingActive ? 'none' : 'flex';
    document.getElementById('stop-record-btn').style.display = isRecordingActive ? 'flex' : 'none';
    document.getElementById('take-photo').style.display = isRecordingActive ? 'none' : 'flex';
}

// =================================================================
//          FUNCIONES PARA ADJUNTAR ARCHIVOS
// =================================================================
function handleFileUpload(event) {
    Array.from(event.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            capturedPhotos.push(e.target.result);
            addPhotoThumbnail(e.target.result, capturedPhotos.length - 1);
        };
        reader.readAsDataURL(file);
    });
    event.target.value = '';
}

function handleVideoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            capturedVideos.push(e.target.result);
            addVideoThumbnail(e.target.result, capturedVideos.length - 1);
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

// =================================================================
//          GRABACIÓN DE AUDIO POR CAMPO
// =================================================================
function startFieldRecording(recordButton) {
    if (isFieldRecording) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        isFieldRecording = true;
        audioFieldChunks = [];
        const targetInputId = recordButton.dataset.targetInput;
        currentTargetInput = document.getElementById(targetInputId);
        const stopButton = document.querySelector(`.stop-btn[data-target-input='${targetInputId}']`);
        recordButton.style.display = 'none';
        stopButton.style.display = 'flex';
        currentTargetInput.classList.add('recording-active');
        currentTargetInput.placeholder = "Escuchando...";
        audioMediaRecorder = new MediaRecorder(stream);
        audioMediaRecorder.start();
        audioMediaRecorder.ondataavailable = event => audioFieldChunks.push(event.data);
        audioMediaRecorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop());
            const audioBlob = new Blob(audioFieldChunks, { type: 'audio/webm' });
            transcribeAudio(audioBlob);
        };
    }).catch(() => alert("No se pudo acceder al micrófono."));
}

function stopFieldRecording() {
    if (audioMediaRecorder && isFieldRecording) {
        audioMediaRecorder.stop();
    }
}

function transcribeAudio(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'respuesta.webm');
    currentTargetInput.placeholder = "Transcribiendo...";
    fetch('/transcribe-audio', { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.text) {
                currentTargetInput.value += (currentTargetInput.value ? ' ' : '') + data.text;
            } else {
                alert("No se pudo entender el audio.");
            }
        })
        .catch(() => alert("Error en la transcripción."))
        .finally(() => {
            const targetInputId = currentTargetInput.id;
            document.querySelector(`.record-btn[data-target-input='${targetInputId}']`).style.display = 'flex';
            document.querySelector(`.stop-btn[data-target-input='${targetInputId}']`).style.display = 'none';
            currentTargetInput.classList.remove('recording-active');
            currentTargetInput.placeholder = "";
            isFieldRecording = false;
            currentTargetInput = null;
        });
}

// =================================================================
//          FUNCIONES DE MINIATURAS Y AYUDA
// =================================================================
/*
function addPhotoThumbnail(base64String, index) {
    const container = document.getElementById('photoThumbnails');
    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'photo-thumbnail-wrapper';
    thumbWrapper.setAttribute('data-index', index);
    thumbWrapper.innerHTML = `
        <img src="${base64String}" class="thumbnail-image">
        <div class="photo-controls">
            <button class="photo-button" onclick="deletePhoto(${index})" title="Eliminar foto">❌</button>
        </div>`;
    container.appendChild(thumbWrapper);
}*/
function addPhotoThumbnail(base64String, index) {
    const container = document.getElementById('photoThumbnails');
    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'photo-thumbnail-wrapper';
    thumbWrapper.setAttribute('data-index', index);
    
    // Creamos un ID único para el nuevo campo de texto y sus botones
    const descriptionInputId = `photo_desc_${index}`;

    thumbWrapper.innerHTML = `
        <img src="${base64String}" class="thumbnail-image">
        
        <div class="thumbnail-description-box">
            <input type="text" id="${descriptionInputId}" class="thumbnail-input" placeholder="Describe la foto...">
            <button class="record-btn" data-target-input="${descriptionInputId}" title="Grabar descripción">
                <i class="fas fa-microphone"></i>
            </button>
            <button class="stop-btn" data-target-input="${descriptionInputId}" title="Detener grabación" style="display: none;">
                <i class="fas fa-stop"></i>
            </button>
        </div>

        <div class="photo-controls">
            <button class="photo-button" onclick="deletePhoto(${index})" title="Eliminar foto">❌</button>
        </div>`;
    
    container.appendChild(thumbWrapper);

    // IMPORTANTE: Le damos funcionalidad a los NUEVOS botones de micrófono que acabamos de crear
    const newRecordBtn = thumbWrapper.querySelector('.record-btn');
    const newStopBtn = thumbWrapper.querySelector('.stop-btn');
    newRecordBtn.addEventListener('click', () => startFieldRecording(newRecordBtn));
    newStopBtn.addEventListener('click', stopFieldRecording);
}

function deletePhoto(index) {
    capturedPhotos[index] = null;
    const thumbnailToRemove = document.querySelector(`.photo-thumbnail-wrapper[data-index='${index}']`);
    if (thumbnailToRemove) thumbnailToRemove.remove();
}

/*
function addVideoThumbnail(base64String, index) {
    const container = document.getElementById('videoThumbnails');
    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'photo-thumbnail-wrapper';
    thumbWrapper.setAttribute('data-video-index', index);
    thumbWrapper.innerHTML = `
        <video src="${base64String}" class="thumbnail-image" controls playsinline></video>
        <div class="photo-controls">
            <button class="photo-button" onclick="deleteVideo(${index})">❌</button>
        </div>`;
    container.appendChild(thumbWrapper);
}*/

function addVideoThumbnail(base64String, index) {
    const container = document.getElementById('videoThumbnails');
    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'photo-thumbnail-wrapper';
    thumbWrapper.setAttribute('data-video-index', index);

    // Creamos un ID único para el nuevo campo de texto y sus botones
    const descriptionInputId = `video_desc_${index}`;

    thumbWrapper.innerHTML = `
        <video src="${base64String}" class="thumbnail-image" controls playsinline></video>
        
        <div class="thumbnail-description-box">
            <input type="text" id="${descriptionInputId}" class="thumbnail-input" placeholder="Describe el video...">
            <button class="record-btn" data-target-input="${descriptionInputId}" title="Grabar descripción">
                <i class="fas fa-microphone"></i>
            </button>
            <button class="stop-btn" data-target-input="${descriptionInputId}" title="Detener grabación" style="display: none;">
                <i class="fas fa-stop"></i>
            </button>
        </div>

        <div class="photo-controls">
            <button class="photo-button" onclick="deleteVideo(${index})">❌</button>
        </div>`;

    container.appendChild(thumbWrapper);

    // IMPORTANTE: Le damos funcionalidad a los NUEVOS botones de micrófono que acabamos de crear
    const newRecordBtn = thumbWrapper.querySelector('.record-btn');
    const newStopBtn = thumbWrapper.querySelector('.stop-btn');
    newRecordBtn.addEventListener('click', () => startFieldRecording(newRecordBtn));
    newStopBtn.addEventListener('click', stopFieldRecording);
}

function deleteVideo(index) {
    capturedVideos[index] = null;
    const thumbnailToRemove = document.querySelector(`.photo-thumbnail-wrapper[data-video-index='${index}']`);
    if (thumbnailToRemove) thumbnailToRemove.remove();
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// =================================================================
//          FUNCIÓN DE GUARDADO FINAL
// =================================================================
/*
function saveRecord() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const saveButton = document.getElementById('save-record');
    loadingOverlay.style.display = 'flex';
    saveButton.disabled = true;
    saveButton.textContent = "Guardando...";

    const projectId = new URLSearchParams(window.location.search).get("project_id");
    const respuestas = {
        // Clave que Python espera  <-- Valor del campo en HTML
        zona_intervencion: document.getElementById('question_0').value, // Corresponde a "Tipo de informe"
        items:             document.getElementById('question_1').value, // Corresponde a "Sede"
        metros_lineales:   document.getElementById('question_2').value, // Corresponde a "Repuestos utilizados"
        proximas_tareas:   document.getElementById('question_3').value  // Corresponde a "Repuestos a cotizar"
    };
    const finalPhotos = capturedPhotos.filter(p => p !== null);
    const finalVideos = capturedVideos.filter(v => v !== null);

    const payload = {
        respuestas: respuestas,
        fotos: finalPhotos,
        videos: finalVideos,
        project_id: projectId
    };

    fetch('/guardar-registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) return response.json().then(err => { throw new Error(err.error || 'Error del servidor') });
        return response.json();
    })
    .then(data => {
        loadingOverlay.style.display = 'none';
        alert(data.mensaje || "¡Registro guardado exitosamente!");
        window.location.href = '/registros';
    })
    .catch(error => {
        loadingOverlay.style.display = 'none';
        saveButton.disabled = false;
        saveButton.textContent = "Guardar registro";
        alert(`Error: ${error.message}`);
    });
}*/
function saveRecord() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const saveButton = document.getElementById('save-record');
    loadingOverlay.style.display = 'flex';
    saveButton.disabled = true;
    saveButton.textContent = "Guardando...";

    const projectId = new URLSearchParams(window.location.search).get("project_id");
    const respuestas = {
        zona_intervencion: document.getElementById('question_0').value,
        items:             document.getElementById('question_1').value,
        metros_lineales:   document.getElementById('question_2').value,
        proximas_tareas:   document.getElementById('question_3').value
    };

    // ===================================================================
    //            INICIO DE LA CORRECCIÓN - RECOLECCIÓN DE DATOS
    // ===================================================================
    // En lugar de solo filtrar, ahora recorremos cada item para buscar su descripción.

    const finalPhotos = [];
    capturedPhotos.forEach((fileData, index) => {
        // Solo procesamos la foto si no ha sido eliminada (no es nula)
        if (fileData !== null) {
            // Buscamos su campo de descripción por el ID único que creamos (ej. "photo_desc_0")
            const descriptionInput = document.getElementById(`photo_desc_${index}`);
            
            finalPhotos.push({
                file_data: fileData, // El archivo en base64
                description: descriptionInput ? descriptionInput.value : "" // El texto de la descripción
            });
        }
    });

    const finalVideos = [];
    capturedVideos.forEach((fileData, index) => {
        // Hacemos lo mismo para los videos
        if (fileData !== null) {
            const descriptionInput = document.getElementById(`video_desc_${index}`);
            
            finalVideos.push({
                file_data: fileData, // El video en base64
                description: descriptionInput ? descriptionInput.value : "" // Su descripción
            });
        }
    });

    // ===================================================================
    //                         FIN DE LA CORRECCIÓN
    // ===================================================================

    const payload = {
        respuestas: respuestas,
        fotos: finalPhotos,   // Ahora es un array de objetos {file_data, description}
        videos: finalVideos,  // Ahora es un array de objetos {file_data, description}
        project_id: projectId
    };

    fetch('/guardar-registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) return response.json().then(err => { throw new Error(err.error || 'Error del servidor') });
        return response.json();
    })
    .then(data => {
        loadingOverlay.style.display = 'none';
        alert(data.mensaje || "¡Registro guardado exitosamente!");
        window.location.href = '/registros';
    })
    .catch(error => {
        loadingOverlay.style.display = 'none';
        saveButton.disabled = false;
        saveButton.textContent = "Guardar registro";
        alert(`Error: ${error.message}`);
    });
}


