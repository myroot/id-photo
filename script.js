// script.js - Core Logic for ID Photo Editor

// Physical Size Specifications (at 300 DPI)
const DPI = 300;
const INCH = 25.4; // mm
const sizes = {
    // Print Sheet Sizes (Inches converted to px at 300dpi)
    // Using Landscape orientation for maximum packing density
    print: {
        '4x6': { width: 6 * DPI, height: 4 * DPI }, // 1800 x 1200 px
        '3x5': { width: 5 * DPI, height: 3 * DPI }  // 1500 x 900 px
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
        },
        '5x5': {
            width: Math.round((5.0 / 2.54) * DPI), // ~591 px
            height: Math.round((5.0 / 2.54) * DPI) // ~591 px
        },
        '5x7': {
            width: Math.round((5.0 / 2.54) * DPI), // ~591 px
            height: Math.round((7.0 / 2.54) * DPI) // ~827 px
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

    // Check if the file is HEIC/HEIF
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

    if (!file.type.match('image.*') && !isHeic) {
        alert("이미지 파일만 업로드 가능합니다.");
        return;
    }

    if (isHeic) {
        // Show temporary loading style on button label to indicate work
        const uploadBtn = document.querySelector('label[for="image-upload"]');
        const uploadBtnOriginHTML = uploadBtn.innerHTML;
        uploadBtn.innerHTML = '<i class="material-icons">hourglass_empty</i> 변환 중...';
        uploadBtn.style.pointerEvents = 'none';

        // Some environments provide a File object without a proper MIME type
        // Fetching it as a blob explicitly helps heic2any parse the magic bytes reliably.
        fetch(URL.createObjectURL(file))
            .then(function (res) { return res.blob(); })
            .then(function (blob) {
                return heic2any({
                    blob: blob,
                    toType: "image/jpeg",
                    quality: 0.95
                });
            })
            .then(function (resultBlob) {
                // resultBlob can be an array if analyzing animation, usually it's single
                const finalBlob = Array.isArray(resultBlob) ? resultBlob[0] : resultBlob;
                readFile(finalBlob);
            }).catch(function (e) {
                alert("HEIC 변환 중 오류가 발생했습니다: " + e.message);
                console.error(e);
            }).finally(function () {
                uploadBtn.innerHTML = uploadBtnOriginHTML;
                uploadBtn.style.pointerEvents = 'auto';
            });
    } else {
        readFile(file);
    }
}

function readFile(blobOrFile) {
    const reader = new FileReader();
    reader.onload = (event) => {
        currentImageSrc = event.target.result;
        startEditing();
    };
    reader.readAsDataURL(blobOrFile);
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
    // To fit e.g. 4x2 layout of 3.5x4.5 on a 4x6 print:
    // 4x6 width = 1800px. 4 cols of 413px = 1652px. Max gap/margin is small.
    // Use minimal margins to tightly pack photos.
    const marginPx = Math.round((2 / 25.4) * DPI); // 2mm margin ~ 24px
    const gapPx = Math.round((2 / 25.4) * DPI); // 2mm gap ~ 24px

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

    // Replace dots in the size keys so it doesn't mess up the extension, 
    // and explicitly append .jpg
    const safeIdKey = idKey.replace('.', '_');
    const filename = `id_photo_${safeIdKey}_on_${printKey}.jpg`;

    // Output as high quality JPEG
    const dataURL = outputCanvas.toDataURL('image/jpeg', 0.95);

    // Use Blob URL for reliable downloading of large files
    const blob = dataURLtoBlob(dataURL);
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = filename;
    link.href = blobUrl;

    // Some browsers need the link in the DOM to click it properly
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
