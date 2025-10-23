// ==================================================================
// VARIABLES GLOBALES Y CONFIGURACIÓN
// ==================================================================
let currentStream = null;
const capturedPhotos = []; // Array para fotos en base64
const capturedVideos = []; // Array para videos en base64
let videoMediaRecorder;
let videoChunks = [];

// Variable para rastrear qué campo de texto está grabando
let activeMicButton = null;
let activeInputId = null;

// IDs únicos para campos dinámicos
let dynamicFieldCounter = 0;


// ==================================================================
// INICIALIZACIÓN DEL FORMULARIO
// ==================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar datos iniciales del proyecto (Código, Contratista, etc.)
    loadProjectData();

    // 2. Configurar listeners para botones "+ Agregar"
    document.querySelectorAll('.add-item-btn').forEach(button => {
        button.addEventListener('click', () => {
            const templateId = button.dataset.template;
            const containerId = button.parentElement.id;
            addDynamicField(templateId, containerId);
        });
    });

    // 3. Configurar listener para el botón "Guardar"
    document.getElementById('save-form-button').addEventListener('click', saveFormToSynchro);
});

/**
 * Carga los datos iniciales del formulario (Código, Contratista, Contrato)
 * Esto debe llamar a un nuevo endpoint en tu app.py que use la API de Synchro.
 */
async function loadProjectData() {
    console.log("Cargando datos del proyecto desde Synchro...");
    
    // NÚMERO DE FORMULARIO: Debes obtenerlo de alguna parte
    // (Ej. de la URL, o hardcodeado si es para un formulario específico)
    const formNumber = "1.09-00001"; // <--- EJEMPLO

    try {
        // **NECESITARÁS CREAR ESTE ENDPOINT EN APP.PY**
        const response = await fetch(`/get-synchro-form-data?form_number=${formNumber}`);
        
        if (!response.ok) {
            throw new Error('No se pudo cargar la información del formulario desde el backend.');
        }

        const data = await response.json();

        // Asumiendo que el backend devuelve un JSON con 'properties'
        // Los nombres de campo (ej. 'Código') deben coincidir con lo que devuelve tu API
        document.getElementById('form-codigo').value = data.number || formNumber;
        document.getElementById('form-contratista').value = data.properties.Contratista || 'N/A';
        document.getElementById('form-contrato').value = data.properties.Contrato || 'N/A';

    } catch (error) {
        console.error("Error al cargar datos del proyecto:", error);
        alert("Error al cargar datos del proyecto. Usando valores de ejemplo.");
        // Valores de fallback por si falla la API
        document.getElementById('form-codigo').value = formNumber;
        document.getElementById('form-contratista').value = "Contratista Ejemplo";
        document.getElementById('form-contrato').value = "Contrato Ejemplo";
    }
}


// ==================================================================
// LÓGICA DE CAMPOS DINÁMICOS
// ==================================================================

/**
 * Clona una plantilla y la agrega a un contenedor
 * @param {string} templateId - ID de la etiqueta <template>
 * @param {string} containerId - ID del div contenedor donde se agregará
 */
function addDynamicField(templateId, containerId) {
    const template = document.getElementById(templateId);
    const container = document.getElementById(containerId);
    
    if (!template || !container) {
        console.error("No se encontró la plantilla o el contenedor", templateId, containerId);
        return;
    }

    const clone = template.content.firstElementChild.cloneNode(true);

    // Asignar IDs únicos a los inputs y textareas para el reconocimiento de voz
    clone.querySelectorAll('.form-input').forEach(input => {
        const newId = `dynamic-input-${dynamicFieldCounter++}`;
        input.id = newId;
    });

    // Asignar listeners a los nuevos botones de micrófono
    clone.querySelectorAll('.mic-button').forEach(button => {
        button.addEventListener('click', ()=> {
            const input = button.closest('.input-with-icon').querySelector('.form-input');
            startVoiceInput(input.id, button);
        });
    });

    // Asignar listener al botón de eliminar
    clone.querySelector('.delete-item-btn').addEventListener('click', () => {
        clone.remove();
    });

    container.appendChild(clone);
}


// ==================================================================
// LÓGICA DE VOZ A TEXTO (REFACTORIZADA)
// ==================================================================

/**
 * Función principal que decide qué método de reconocimiento de voz usar.
 * @param {string} inputId - El ID del input/textarea a rellenar
 * @param {HTMLElement} micButton - El botón de micrófono que se presionó
 */
function startVoiceInput(inputId, micButton) {
    if (activeMicButton) {
        console.log("Ya hay una grabación en curso.");
        return;
    }

    activeInputId = inputId;
    activeMicButton = micButton;
    activeMicButton.classList.add('recording');

    if (isIOS()) {
        console.log("Usando grabación de audio (iOS)");
        startVoiceInput_iOS();
    } else {
        console.log("Usando webkitSpeechRecognition (Android/PC)");
        startVoiceInput_Android();
    }
}

/**
 * Detiene la interfaz de grabación (común para ambos métodos)
 */
function stopVoiceInput() {
    if (activeMicButton) {
        activeMicButton.classList.remove('recording');
        activeMicButton = null;
    }
    activeInputId = null;
}

/**
 * Lógica para Android/PC (API nativa)
 */
function startVoiceInput_Android() {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Este navegador no soporta reconocimiento de voz.");
        stopVoiceInput();
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const targetInput = document.getElementById(activeInputId);
        if (targetInput) {
            targetInput.value = transcript;
        }
    };

    recognition.onerror = (event) => {
        console.error('Error de reconocimiento de voz:', event.error);
        alert('Error en el reconocimiento. Intente de nuevo.');
    };

    recognition.onend = () => {
        stopVoiceInput();
    };

    recognition.start();
}

/**
 * Lógica para iOS (Grabar y enviar al backend)
 */
function startVoiceInput_iOS() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            console.log("Grabación terminada. Enviando audio...");
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('audio', audioBlob, 'respuesta.webm');

            // Enviar al mismo endpoint de transcripción de tu app.py
            fetch('/transcribe-audio', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.text) {
                    const targetInput = document.getElementById(activeInputId);
                    if (targetInput) targetInput.value = data.text;
                } else {
                    console.error("Transcripción fallida:", data.error);
                    alert("No se pudo transcribir el audio.");
                }
            })
            .catch(err => {
                console.error("Error al enviar audio:", err);
                alert("Error al enviar el audio al servidor.");
            })
            .finally(() => {
                stopVoiceInput();
                // Detener los tracks de audio para que se apague el ícono de grabación del navegador
                stream.getTracks().forEach(track => track.stop());
            });
        };

        mediaRecorder.start();
        // Detener grabación después de 5 segundos (o usa un botón de stop)
        setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        }, 5000); // 5 segundos de grabación
    }).catch(err => {
        console.error("Error al acceder al micrófono:", err);
        alert("No se pudo acceder al micrófono.");
        stopVoiceInput();
    });
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}


// ==================================================================
// LÓGICA DE CÁMARA Y ARCHIVOS (Copiada de script.js)
// ==================================================================

document.getElementById('start-camera').addEventListener('click', () => {
    startCamera("environment");
    document.getElementById('start-camera').style.display = 'none';
    document.getElementById('camera-controls').style.display = 'block';
});

function startCamera(facingMode = "environment") {
    const video = document.getElementById('videoElement');
    const cameraContainer = document.getElementById('camera-container');

    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: facingMode } }
    }).then(stream => {
        currentStream = stream;
        video.srcObject = stream;
        video.play();
        cameraContainer.style.display = 'block';
    }).catch(error => {
        console.warn(`Falló modo ${facingMode}, intentando default`, error);
        navigator.mediaDevices.getUserMedia({ video: true }).then(fallbackStream => {
            currentStream = fallbackStream;
            video.srcObject = fallbackStream;
            video.play();
            cameraContainer.style.display = 'block';
        }).catch(fallbackError => {
            console.error("No se pudo acceder a ninguna cámara.", fallbackError);
            alert("No se pudo acceder a la cámara.");
        });
    });
}

// Tomar foto
document.getElementById('take-photo').addEventListener('click', () => {
    const canvas = document.getElementById('photoCanvas');
    const video = document.getElementById('videoElement');
    if (video.readyState !== 4) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const fotoBase64 = canvas.toDataURL('image/jpeg', 0.7);
    capturedPhotos.push(fotoBase64);
    addPhotoThumbnail(fotoBase64, capturedPhotos.length - 1);
});

// Grabar video
document.getElementById('start-record-btn').addEventListener('click', () => {
    if (!currentStream) {
        alert("La cámara no está activa.");
        return;
    }
    videoChunks = [];
    videoMediaRecorder = new MediaRecorder(currentStream, { mimeType: 'video/webm' });

    videoMediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) videoChunks.push(event.data);
    };

    videoMediaRecorder.onstop = () => {
        const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(videoBlob);
        reader.onloadend = () => {
            const videoBase64 = reader.result;
            capturedVideos.push(videoBase64);
            addVideoThumbnail(videoBase64, capturedVideos.length - 1);
        };
    };

    videoMediaRecorder.start();
    document.getElementById('start-record-btn').style.display = 'none';
    document.getElementById('stop-record-btn').style.display = 'inline-block';
});

// Detener video
document.getElementById('stop-record-btn').addEventListener('click', () => {
    if (videoMediaRecorder && videoMediaRecorder.state === 'recording') {
        videoMediaRecorder.stop();
    }
    document.getElementById('start-record-btn').style.display = 'inline-block';
    document.getElementById('stop-record-btn').style.display = 'none';
});

// Adjuntar foto
document.getElementById('file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            capturedPhotos.push(base64);
            addPhotoThumbnail(base64, capturedPhotos.length - 1);
        };
        reader.readAsDataURL(file);
    }
    event.target.value = ''; // Reset
});

// Adjuntar video
document.getElementById('video-file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const videoBase64 = e.target.result;
            capturedVideos.push(videoBase64);
            addVideoThumbnail(videoBase64, capturedVideos.length - 1);
        };
        reader.readAsDataURL(file);
    }
    event.target.value = ''; // Reset
});

// Funciones de miniaturas (thumbnails)
function addPhotoThumbnail(base64String, index) {
    const container = document.getElementById('photoThumbnails');
    const wrapper = document.createElement('div');
    wrapper.className = 'photo-thumbnail-wrapper';
    wrapper.setAttribute('data-index', index);
    wrapper.innerHTML = `
        <img src="${base64String}" class="thumbnail-image">
        <button class="delete-media-btn" onclick="deletePhoto(${index})">&times;</button>
    `;
    container.appendChild(wrapper);
}

function addVideoThumbnail(base64String, index) {
    const container = document.getElementById('videoThumbnails');
    const wrapper = document.createElement('div');
    wrapper.className = 'photo-thumbnail-wrapper';
    wrapper.setAttribute('data-index', index);
    wrapper.innerHTML = `
        <video src="${base64String}" class="thumbnail-image" controls></video>
        <button class="delete-media-btn" onclick="deleteVideo(${index})">&times;</button>
    `;
    container.appendChild(wrapper);
}

function deletePhoto(index) {
    capturedPhotos[index] = null; // Marcar como nulo
    const thumbnail = document.querySelector(`#photoThumbnails .photo-thumbnail-wrapper[data-index='${index}']`);
    if (thumbnail) thumbnail.remove();
}

function deleteVideo(index) {
    capturedVideos[index] = null; // Marcar como nulo
    const thumbnail = document.querySelector(`#videoThumbnails .photo-thumbnail-wrapper[data-index='${index}']`);
    if (thumbnail) thumbnail.remove();
}

// ==================================================================
// LÓGICA DE GUARDADO EN SYNCHRO
// ==================================================================

/**
 * Recolecta TODOS los datos del formulario y los envía al backend
 * para actualizar Synchro Control.
 */
async function saveFormToSynchro() {
    console.log("Iniciando guardado en Synchro...");
    const properties = {};
    const sections = document.querySelectorAll('.accordion-content[data-api-section]');

    sections.forEach(section => {
        const sectionName = section.dataset.apiSection;
        const items = [];
        
        section.querySelectorAll('.dynamic-item-box').forEach(itemBox => {
            const itemData = {
                // Generar un UUID en el frontend (o el backend puede hacerlo)
                'id': crypto.randomUUID() 
            };
            
            itemBox.querySelectorAll('.form-input').forEach(input => {
                const apiName = input.dataset.apiName;
                if (apiName) {
                    itemData[apiName] = input.value;
                }
            });
            items.push(itemData);
        });

        properties[sectionName] = items;
    });

    // Recolectar fotos y videos (filtrando los nulos si se eliminaron)
    const finalPhotos = capturedPhotos.filter(p => p !== null);
    const finalVideos = capturedVideos.filter(v => v !== null);

    const payload = {
        form_number: document.getElementById('form-codigo').value,
        properties: properties,
        // NOTA: La API de Synchro debe soportar guardar fotos/videos.
        // Esto es un EJEMPLO de cómo podrías enviarlos.
        // Quizás deban ir dentro de 'properties' en un campo específico.
        media: {
            photos: finalPhotos,
            videos: finalVideos
        }
    };

    console.log("Payload a enviar al backend:", JSON.stringify(payload, null, 2));

    try {
        // **NECESITARÁS CREAR ESTE ENDPOINT EN APP.PY**
        const response = await fetch('/update-synchro-form', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Error desconocido al guardar en Synchro.");
        }

        alert("¡Formulario guardado en Synchro exitosamente!");
        console.log("Respuesta de Synchro:", result);
        // Opcional: recargar o limpiar el formulario
        window.location.reload(); 

    } catch (error) {
        console.error("Error al guardar en Synchro:", error);
        alert(`Error al guardar: ${error.message}`);
    }
}