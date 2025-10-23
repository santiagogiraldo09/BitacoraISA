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

let contadorFinalizadas = 0;
let contadorPendientes = 0;
let contadorFacturar = 0;
let contadorSeguridad = 0;
let contadorAmbiental = 0;
let contadorCalidad = 0;

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

function agregarActividadFinalizada() {
    const container = document.getElementById('container-act-finalizadas');
    const id = contadorFinalizadas++;
    
    const html = `
        <div class="actividad-item" data-id="${id}" data-tipo="finalizada">
            <div class="form-group">
                <label>Ítem</label>
                <div class="input-with-mic">
                    <input type="number" class="act-item" placeholder="Número de ítem">
                    <button type="button" class="mic-button" onclick="iniciarReconocimientoVoz(this)">
                        🎤
                    </button>
                </div>
            </div>
            <div class="form-group">
                <label>Descripción *</label>
                <div class="input-with-mic">
                    <input type="text" class="act-descripcion" required placeholder="Descripción de la actividad">
                    <button type="button" class="mic-button" onclick="iniciarReconocimientoVoz(this)">
                        🎤
                    </button>
                </div>
            </div>
            <div class="form-group">
                <label>Observaciones</label>
                <div class="input-with-mic textarea-wrapper">
                    <textarea class="act-observaciones" rows="2" placeholder="Observaciones"></textarea>
                    <button type="button" class="mic-button" onclick="iniciarReconocimientoVoz(this)">
                        🎤
                    </button>
                </div>
            </div>
            <button type="button" class="remove-button" onclick="eliminarElemento(this)">
                <i class="fas fa-trash"></i> Eliminar
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
}

function recopilarActividadesFinalizadas() {
    const items = document.querySelectorAll('#container-act-finalizadas .actividad-item');
    const actividades = [];
    
    items.forEach((item, index) => {
        const itemNum = item.querySelector('.act-item').value || (index + 1);
        const descripcion = item.querySelector('.act-descripcion').value.trim();
        const observaciones = item.querySelector('.act-observaciones').value.trim();
        
        if (descripcion) {
            actividades.push({
                item: parseInt(itemNum),
                descripcion: descripcion,
                observaciones: observaciones
            });
        }
    });
    
    return actividades;
}

function agregarActividadPendiente() {
    const container = document.getElementById('container-act-pendientes');
    const id = contadorPendientes++;
    
    const html = `
        <div class="actividad-item" data-id="${id}" data-tipo="pendiente">
            <div class="form-group">
                <label>Ítem</label>
                <input type="number" class="act-item" placeholder="Número de ítem">
            </div>
            <div class="form-group">
                <label>Descripción *</label>
                <input type="text" class="act-descripcion" required placeholder="Descripción de la actividad">
            </div>
            <div class="form-group">
                <label>Pendiente generado</label>
                <input type="text" class="act-pendiente-generado" placeholder="Tipo de pendiente">
            </div>
            <div class="form-group">
                <label>Observaciones</label>
                <textarea class="act-observaciones" rows="2" placeholder="Observaciones"></textarea>
            </div>
            <button type="button" class="remove-button" onclick="eliminarElemento(this)">
                <i class="fas fa-trash"></i> Eliminar
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
}

function recopilarActividadesPendientes() {
    const items = document.querySelectorAll('#container-act-pendientes .actividad-item');
    const actividades = [];
    
    items.forEach((item, index) => {
        const itemNum = item.querySelector('.act-item').value || (index + 1);
        const descripcion = item.querySelector('.act-descripcion').value.trim();
        const pendienteGenerado = item.querySelector('.act-pendiente-generado').value.trim();
        const observaciones = item.querySelector('.act-observaciones').value.trim();
        
        if (descripcion) {
            actividades.push({
                item: parseInt(itemNum),
                descripcion: descripcion,
                pendiente_generado: pendienteGenerado,
                observaciones: observaciones
            });
        }
    });
    
    return actividades;
}

function agregarActividadFacturar() {
    const container = document.getElementById('container-act-facturar');
    const id = contadorFacturar++;
    
    const html = `
        <div class="actividad-item" data-id="${id}" data-tipo="facturar">
            <div class="form-group">
                <label>Ítem</label>
                <input type="number" class="act-item" placeholder="Número de ítem">
            </div>
            <div class="form-group">
                <label>Descripción *</label>
                <input type="text" class="act-descripcion" required placeholder="Descripción">
            </div>
            <div class="form-group">
                <label>Cantidad contractual</label>
                <input type="number" step="0.01" class="act-cant-contractual" placeholder="0.00">
            </div>
            <div class="form-group">
                <label>Cantidad facturada</label>
                <input type="number" step="0.01" class="act-cant-facturada" placeholder="0.00">
            </div>
            <div class="form-group">
                <label>Cantidad pendiente por facturar</label>
                <input type="number" step="0.01" class="act-cant-pendiente" placeholder="0.00">
            </div>
            <div class="form-group">
                <label>Observación</label>
                <textarea class="act-observaciones" rows="2" placeholder="Observaciones"></textarea>
            </div>
            <button type="button" class="remove-button" onclick="eliminarElemento(this)">
                <i class="fas fa-trash"></i> Eliminar
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
}

function recopilarActividadesFacturar() {
    const items = document.querySelectorAll('#container-act-facturar .actividad-item');
    const actividades = [];
    
    items.forEach((item, index) => {
        const itemNum = item.querySelector('.act-item').value || (index + 1);
        const descripcion = item.querySelector('.act-descripcion').value.trim();
        const cantContractual = item.querySelector('.act-cant-contractual').value;
        const cantFacturada = item.querySelector('.act-cant-facturada').value;
        const cantPendiente = item.querySelector('.act-cant-pendiente').value;
        const observaciones = item.querySelector('.act-observaciones').value.trim();
        
        if (descripcion) {
            actividades.push({
                item: parseInt(itemNum),
                descripcion: descripcion,
                cantidad_contractual: parseFloat(cantContractual) || 0,
                cantidad_facturada: parseFloat(cantFacturada) || 0,
                cantidad_pendiente: parseFloat(cantPendiente) || 0,
                observacion: observaciones
            });
        }
    });
    
    return actividades;
}

function agregarDocSeguridad() {
    const container = document.getElementById('container-doc-seguridad');
    const id = contadorSeguridad++;
    
    const html = `
        <div class="actividad-item" data-id="${id}" data-tipo="doc-seguridad">
            <div class="form-group">
                <label>Documento *</label>
                <input type="text" class="doc-nombre" required placeholder="Nombre del documento">
            </div>
            <div class="form-group">
                <label>Pendiente generado</label>
                <input type="text" class="doc-pendiente" placeholder="Pendiente">
            </div>
            <div class="form-group">
                <label>Fecha de entrega</label>
                <input type="date" class="doc-fecha">
            </div>
            <div class="form-group">
                <label>Responsable</label>
                <input type="text" class="doc-responsable" placeholder="Responsable">
            </div>
            <div class="form-group">
                <label>Observaciones</label>
                <textarea class="doc-observaciones" rows="2" placeholder="Observaciones"></textarea>
            </div>
            <button type="button" class="remove-button" onclick="eliminarElemento(this)">
                <i class="fas fa-trash"></i> Eliminar
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
}

function recopilarDocSeguridad() {
    const items = document.querySelectorAll('#container-doc-seguridad .actividad-item');
    const documentos = [];
    
    items.forEach(item => {
        const documento = item.querySelector('.doc-nombre').value.trim();
        const pendiente = item.querySelector('.doc-pendiente').value.trim();
        const fecha = item.querySelector('.doc-fecha').value;
        const responsable = item.querySelector('.doc-responsable').value.trim();
        const observaciones = item.querySelector('.doc-observaciones').value.trim();
        
        if (documento) {
            documentos.push({
                documento: documento,
                pendiente_generado: pendiente,
                fecha_entrega: fecha,
                responsable: responsable,
                observaciones: observaciones
            });
        }
    });
    
    return documentos;
}

function agregarDocAmbiental() {
    const container = document.getElementById('container-doc-ambiental');
    const id = contadorAmbiental++;
    
    const html = `
        <div class="actividad-item" data-id="${id}" data-tipo="doc-ambiental">
            <div class="form-group">
                <label>Documento *</label>
                <input type="text" class="doc-nombre" required placeholder="Nombre del documento">
            </div>
            <div class="form-group">
                <label>Pendiente generado</label>
                <input type="text" class="doc-pendiente" placeholder="Pendiente">
            </div>
            <div class="form-group">
                <label>Fecha de entrega</label>
                <input type="date" class="doc-fecha">
            </div>
            <div class="form-group">
                <label>Responsable</label>
                <input type="text" class="doc-responsable" placeholder="Responsable">
            </div>
            <div class="form-group">
                <label>Observaciones</label>
                <textarea class="doc-observaciones" rows="2" placeholder="Observaciones"></textarea>
            </div>
            <button type="button" class="remove-button" onclick="eliminarElemento(this)">
                <i class="fas fa-trash"></i> Eliminar
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
}

function recopilarDocAmbiental() {
    const items = document.querySelectorAll('#container-doc-ambiental .actividad-item');
    const documentos = [];
    
    items.forEach(item => {
        const documento = item.querySelector('.doc-nombre').value.trim();
        const pendiente = item.querySelector('.doc-pendiente').value.trim();
        const fecha = item.querySelector('.doc-fecha').value;
        const responsable = item.querySelector('.doc-responsable').value.trim();
        const observaciones = item.querySelector('.doc-observaciones').value.trim();
        
        if (documento) {
            documentos.push({
                documento: documento,
                pendiente_generado: pendiente,
                fecha_entrega: fecha,
                responsable: responsable,
                observaciones: observaciones
            });
        }
    });
    
    return documentos;
}

function agregarDocCalidad() {
    const container = document.getElementById('container-doc-calidad');
    const id = contadorCalidad++;
    
    const html = `
        <div class="actividad-item" data-id="${id}" data-tipo="doc-calidad">
            <div class="form-group">
                <label>Documento *</label>
                <input type="text" class="doc-nombre" required placeholder="Nombre del documento">
            </div>
            <div class="form-group">
                <label>Pendiente generado</label>
                <input type="text" class="doc-pendiente" placeholder="Pendiente">
            </div>
            <div class="form-group">
                <label>Fecha de entrega</label>
                <input type="date" class="doc-fecha">
            </div>
            <div class="form-group">
                <label>Responsable</label>
                <input type="text" class="doc-responsable" placeholder="Responsable">
            </div>
            <div class="form-group">
                <label>Observaciones</label>
                <textarea class="doc-observaciones" rows="2" placeholder="Observaciones"></textarea>
            </div>
            <button type="button" class="remove-button" onclick="eliminarElemento(this)">
                <i class="fas fa-trash"></i> Eliminar
            </button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
}

function recopilarDocCalidad() {
    const items = document.querySelectorAll('#container-doc-calidad .actividad-item');
    const documentos = [];
    
    items.forEach(item => {
        const documento = item.querySelector('.doc-nombre').value.trim();
        const pendiente = item.querySelector('.doc-pendiente').value.trim();
        const fecha = item.querySelector('.doc-fecha').value;
        const responsable = item.querySelector('.doc-responsable').value.trim();
        const observaciones = item.querySelector('.doc-observaciones').value.trim();
        
        if (documento) {
            documentos.push({
                documento: documento,
                pendiente_generado: pendiente,
                fecha_entrega: fecha,
                responsable: responsable,
                observaciones: observaciones
            });
        }
    });
    
    return documentos;
}


// ========================================
// FUNCIÓN PARA ELIMINAR ELEMENTOS
// ========================================
function eliminarElemento(button) {
    const item = button.closest('.actividad-item');
    item.remove();
}

// ========================================
// VALIDACIÓN DEL FORMULARIO
// ========================================
function validarFormulario() {
    const actFinalizadas = recopilarActividadesFinalizadas();
    
    if (actFinalizadas.length === 0) {
        alert('⚠️ Debes agregar al menos una actividad finalizada');
        return false;
    }
    
    return true;
}

// ========================================
// GUARDAR REGISTRO (ENVIAR A SYNCHRO)
// ========================================
async function saveRecord() {
    console.log('💾 Iniciando guardado...');
    
    // Validar
    if (!validarFormulario()) {
        return;
    }
    
    try {
        // Mostrar loader
        const button = document.getElementById('save-record');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        // Recopilar todos los datos
        const datos = {
            // Datos básicos (readonly)
            codigo_proyecto: document.getElementById('codigo_proyecto').value,
            contratista: document.getElementById('contratista').value,
            contrato: document.getElementById('contrato').value,
            
            // Sección 1
            actividades_finalizadas: recopilarActividadesFinalizadas(),
            
            // Sección 2
            actividades_pendientes: recopilarActividadesPendientes(),
            
            // Sección 3
            actividades_facturar: recopilarActividadesFacturar(),
            
            // Sección 4
            documentacion_seguridad: recopilarDocSeguridad(),
            
            // Sección 5
            documentacion_ambiental: recopilarDocAmbiental(),
            
            // Sección 6
            documentacion_calidad: recopilarDocCalidad(),
            
            // Multimedia
            fotos: capturedPhotos.filter(f => f !== null),
            videos: capturedVideos.filter(v => v !== null),
            
            // Metadata
            fecha_registro: new Date().toISOString()
        };
        
        console.log('📦 Datos a enviar:', datos);
        
        // Enviar al backend
        const response = await fetch('/guardar-registro', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(datos)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Éxito
            mostrarMensajeExito(result);
            
            // Limpiar formulario después de 2 segundos
            setTimeout(() => {
                limpiarFormulario();
            }, 2000);
        } else {
            throw new Error(result.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert(`Error al guardar: ${error.message}`);
    } finally {
        // Restaurar botón
        const button = document.getElementById('save-record');
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-save"></i> Guardar registro';
    }
}

function mostrarMensajeExito(result) {
    const div = document.getElementById('successMessage');
    
    let mensaje = '✅ Registro guardado exitosamente en Synchro Control!';
    
    if (result.form_id) {
        mensaje += `<br>📝 Formulario ID: ${result.form_id}`;
    }
    
    if (result.attachments_subidos > 0) {
        mensaje += `<br>📎 ${result.attachments_subidos} archivos adjuntos`;
    }
    
    div.innerHTML = `<p style="color: green; font-weight: bold; padding: 15px; background: #d4edda; border-radius: 5px;">${mensaje}</p>`;
    div.style.display = 'block';
    
    setTimeout(() => {
        div.style.display = 'none';
    }, 5000);
}

function limpiarFormulario() {
    // Limpiar todos los contenedores
    document.getElementById('container-act-finalizadas').innerHTML = '';
    document.getElementById('container-act-pendientes').innerHTML = '';
    document.getElementById('container-act-facturar').innerHTML = '';
    document.getElementById('container-doc-seguridad').innerHTML = '';
    document.getElementById('container-doc-ambiental').innerHTML = '';
    document.getElementById('container-doc-calidad').innerHTML = '';
    
    // Reiniciar contadores
    contadorFinalizadas = 0;
    contadorPendientes = 0;
    contadorFacturar = 0;
    contadorSeguridad = 0;
    contadorAmbiental = 0;
    contadorCalidad = 0;
    
    // Limpiar fotos y videos
    capturedPhotos.length = 0;
    capturedVideos.length = 0;
    document.getElementById('photoThumbnails').innerHTML = '';
    document.getElementById('videoThumbnails').innerHTML = '';
    
    // Agregar una actividad finalizada por defecto
    agregarActividadFinalizada();
    
    // Ocultar cámara
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    document.getElementById('camera-container').style.display = 'none';
    document.getElementById('take-photo').style.display = 'none';
    
    console.log('🧹 Formulario limpiado');
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


