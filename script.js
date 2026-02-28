// script.js - Core Logic for ID Photo Editor

// Physical Size Specifications (at 300 DPI)
const DPI = 300;
const INCH = 25.4; // mm
const sizes = {
    // Print Sheet Sizes (Inches converted to px at 300dpi)
    print: {
        '4x6': { width: 4 * DPI, height: 6 * DPI }, // 1200 x 1800 px
        '3x5': { width: 3 * DPI, height: 5 * DPI }  //  900 x 1500 px
    },
    // ID Photo Sizes (cm converted to px at 300dpi)
    idPhoto: {
        '3.5x4.5': {
            width: Math.round((3.5 / 2.54) * DPI), // ~413 px
            height: Math.round((4.5 / 2.54) * DPI) // ~531 px
        },
        '3x4': {
            width: Math.round((3.0 / 2.54) * DPI), // ~354 px
            height: Math.round((4.0 / 2.54) * DPI) // ~472 px
        }
    }
};

// State
let cropper = null;
let currentImageSrc = null;

// DOM Elements
const uploadInput = document.getElementById('image-upload');
const uploadView = document.getElementById('upload-view');
const editView = document.getElementById('edit-view');
const cropperImage = document.getElementById('cropper-image');
const rotationSlider = document.getElementById('rotation-slider');
const rotationValue = document.getElementById('rotation-value');

const printSizeSelect = document.getElementById('print-size');
const idPhotoSizeSelect = document.getElementById('id-photo-size');
const btnPreview = document.getElementById('btn-preview');
const btnDownload = document.getElementById('btn-download');
const btnReset = document.getElementById('btn-reset');
const outputCanvas = document.getElementById('output-canvas');

// --- Initialization ---

function init() {
    uploadInput.addEventListener('change', handleImageUpload);
    rotationSlider.addEventListener('input', handleRotation);

    btnPreview.addEventListener('click', updatePreviewCanvas);
    btnDownload.addEventListener('click', handleDownload);
    btnReset.addEventListener('click', resetApp);

    // Re-render preview if sizes change
    printSizeSelect.addEventListener('change', updatePreviewCanvas);
    idPhotoSizeSelect.addEventListener('change', () => {
        updateCropperAspectRatio();
        updatePreviewCanvas();
    });
}

// --- Image Handling ---

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
        alert("이미지 파일만 업로드 가능합니다.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        currentImageSrc = event.target.result;
        startEditing();
    };
    reader.readAsDataURL(file);
}

function startEditing() {
    // Hide upload, show editor
    uploadView.classList.add('hidden');
    editView.classList.remove('hidden');

    cropperImage.src = currentImageSrc;

    // Initialize Cropper.js
    if (cropper) {
        cropper.destroy();
    }

    const idSizeKey = idPhotoSizeSelect.value;
    const targetIdSize = sizes.idPhoto[idSizeKey];
    const targetAspectRatio = targetIdSize.width / targetIdSize.height;

    cropper = new Cropper(cropperImage, {
        aspectRatio: targetAspectRatio,
        viewMode: 1, // Restrict crop box to not exceed the size of the canvas
        dragMode: 'move',
        autoCropArea: 0.8,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        ready: function () {
            // Generate initial preview once ready
            setTimeout(updatePreviewCanvas, 100);
        }
    });

    // Reset rotation
    rotationSlider.value = 0;
    rotationValue.textContent = '0°';
}

function updateCropperAspectRatio() {
    if (!cropper) return;
    const idSizeKey = idPhotoSizeSelect.value;
    const targetIdSize = sizes.idPhoto[idSizeKey];
    cropper.setAspectRatio(targetIdSize.width / targetIdSize.height);
}

function handleRotation(e) {
    if (!cropper) return;
    const val = e.target.value;
    rotationValue.textContent = `${val}°`;
    cropper.rotateTo(Number(val));
}

// --- Canvas Logic ---

function drawCuttingLines(ctx, x, y, width, height) {
    ctx.save();
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1; // 1px line at 300dpi is very thin, good for cutting guides
    ctx.setLineDash([10, 10]); // Dashed line
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
}

function updatePreviewCanvas() {
    if (!cropper) return;

    const printKey = printSizeSelect.value;
    const idKey = idPhotoSizeSelect.value;

    const printDim = sizes.print[printKey];
    const idDim = sizes.idPhoto[idKey];

    // Configure Canvas
    outputCanvas.width = printDim.width;
    outputCanvas.height = printDim.height;

    const ctx = outputCanvas.getContext('2d');

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, printDim.width, printDim.height);

    // Get cropped image data at destination resolution
    // We use the aspect ratio configured, but get it at the exact pixel size needed for 300DPI
    const croppedCanvas = cropper.getCroppedCanvas({
        width: idDim.width,
        height: idDim.height,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });

    if (!croppedCanvas) return;

    // Layout calculation
    // Find how many fit in columns and rows
    // Add some margin (e.g., 5mm, and 1mm gap)
    const marginPx = Math.round((5 / 25.4) * DPI);
    const gapPx = Math.round((1 / 25.4) * DPI); // 1mm gap

    const cols = Math.floor((printDim.width - marginPx * 2) / (idDim.width + gapPx));
    const rows = Math.floor((printDim.height - marginPx * 2) / (idDim.height + gapPx));

    const totalWidth = cols * idDim.width + (cols - 1) * gapPx;
    const totalHeight = rows * idDim.height + (rows - 1) * gapPx;

    // Center the grid on the page
    const startX = (printDim.width - totalWidth) / 2;
    const startY = (printDim.height - totalHeight) / 2;

    // Draw grid
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = startX + c * (idDim.width + gapPx);
            const y = startY + r * (idDim.height + gapPx);

            // Draw image
            ctx.drawImage(croppedCanvas, x, y, idDim.width, idDim.height);

            // Optional: Draw faint cutting lines
            drawCuttingLines(ctx, x, y, idDim.width, idDim.height);
        }
    }

    // Enable download button
    btnDownload.disabled = false;
}

// --- Download & Reset ---

function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

function handleDownload() {
    const printKey = printSizeSelect.value;
    const idKey = idPhotoSizeSelect.value;
    const filename = `id_photo_${idKey}_on_${printKey}.jpg`;

    // Output as high quality JPEG
    const dataURL = outputCanvas.toDataURL('image/jpeg', 0.95);

    // Use Blob URL for reliable downloading of large files
    const blob = dataURLtoBlob(dataURL);
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = filename;
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
    }, 100);
}

function resetApp() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    currentImageSrc = null;
    uploadInput.value = '';

    // Clear canvas
    const ctx = outputCanvas.getContext('2d');
    ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    outputCanvas.width = 0;
    outputCanvas.height = 0;

    btnDownload.disabled = true;

    // Swap views
    editView.classList.add('hidden');
    uploadView.classList.remove('hidden');
}

// Start app
document.addEventListener('DOMContentLoaded', init);
