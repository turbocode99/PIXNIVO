
const bcType = document.getElementById('bcType');
const bcShowText = document.getElementById('bcShowText');
const bcData = document.getElementById('bcData');
const btnGenerate = document.getElementById('btnGenerate');
const bcResults = document.getElementById('bcResults');
const bcCount = document.getElementById('bcCount');
const bcGrid = document.getElementById('bcGrid');

const dropZone = document.getElementById('dropZone');
const csvFile = document.getElementById('csvFile');
const previewLimitWarning = document.getElementById('previewLimitWarning');

const btnExportPdf = document.getElementById('btnExportPdf');
const btnExportWord = document.getElementById('btnExportWord');
const btnExportExcel = document.getElementById('btnExportExcel');
const progBarContainer = document.getElementById('progBarContainer');
const progBar = document.getElementById('progBar');
const progText = document.getElementById('progText');

let activeDataLines = [];

// Drag and drop logic
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});
csvFile.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        // Parse basic CSV (take first column of each row)
        const lines = text.split(/\r?\n/).map(line => {
            let cols = line.split(',');
            return cols[0].replace(/^["']|["']$/g, '').trim(); // Remove quotes
        }).filter(l => l.length > 0);
        
        bcData.value = lines.join('\n');
    };
    reader.readAsText(file);
}

btnGenerate.addEventListener('click', () => {
    const lines = bcData.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return alert('Please enter or upload some data to generate barcodes.');
    
    activeDataLines = lines;
    bcGrid.innerHTML = '';
    bcResults.style.display = 'block';
    bcCount.textContent = lines.length;
    
    const previewLimit = 100;
    if (lines.length > previewLimit) {
        previewLimitWarning.style.display = 'block';
    } else {
        previewLimitWarning.style.display = 'none';
    }
    
    // Render only up to previewLimit
    const renderLines = lines.slice(0, previewLimit);
    
    renderLines.forEach((line, i) => {
        const container = document.createElement('div');
        container.style.background = 'white';
        container.style.padding = '15px';
        container.style.borderRadius = '8px';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        
        const canvas = document.createElement('canvas');
        canvas.id = 'bc_' + i;
        
        const title = document.createElement('div');
        title.style.color = '#333';
        title.style.fontSize = '0.75rem';
        title.style.marginTop = '8px';
        title.style.textAlign = 'center';
        title.style.wordBreak = 'break-all';
        title.style.fontWeight = '600';
        title.textContent = line;
        
        container.appendChild(canvas);
        if (!bcShowText.checked) container.appendChild(title);
        bcGrid.appendChild(container);
        
        try {
            bwipjs.toCanvas(canvas, {
                bcid: bcType.value,
                text: line,
                scale: 2,
                height: 12,
                includetext: bcShowText.checked,
                textxalign: 'center',
            });
        } catch (e) {
            console.error(e);
            canvas.style.display = 'none';
            const err = document.createElement('div');
            err.style.color = '#e53935';
            err.style.fontSize = '0.75rem';
            err.textContent = 'Invalid data for this type';
            container.appendChild(err);
        }
    });
});

async function exportBarcodes(format) {
    if (activeDataLines.length === 0) return;
    
    progBarContainer.style.display = 'block';
    progText.style.display = 'block';
    progBar.style.width = '5%';
    progText.textContent = 'Rendering all images in memory...';
    
    // Generate base64 for ALL lines, not just preview
    let payloadImages = [];
    
    // Off-DOM canvas for rendering
    const offCanvas = document.createElement('canvas');
    
    // Render them in chunks to not freeze the UI completely
    const chunkSize = 50;
    for (let i = 0; i < activeDataLines.length; i += chunkSize) {
        const chunk = activeDataLines.slice(i, i + chunkSize);
        for(let line of chunk) {
            try {
                bwipjs.toCanvas(offCanvas, {
                    bcid: bcType.value,
                    text: line,
                    scale: 2,
                    height: 12,
                    includetext: bcShowText.checked,
                    textxalign: 'center',
                });
                payloadImages.push({
                    text: line,
                    base64_data: offCanvas.toDataURL('image/png')
                });
            } catch(e) {
                // skip invalid
            }
        }
        progBar.style.width = (5 + (i / activeDataLines.length) * 35) + '%';
        // Give UI a moment to breathe
        await new Promise(r => setTimeout(r, 0));
    }
    
    if (payloadImages.length === 0) {
        alert("None of the data provided is valid for the selected barcode type.");
        progBarContainer.style.display = 'none';
        progText.style.display = 'none';
        return;
    }

    const payload = {
        format: format,
        images: payloadImages
    };
    
    progBar.style.width = '40%';
    progText.textContent = 'Uploading to server for document generation...';
    
    try {
        const res = await fetch('/api/export-barcodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.status === 413) {
            throw new Error("File too large. Nginx limits bulk exports to ~10,000 items. Try a smaller batch.");
        }
        if (!res.ok) {
            const err = await res.json().catch(()=>({detail: 'Server error'}));
            throw new Error(err.detail || 'Server error');
        }
        
        progBar.style.width = '90%';
        progText.textContent = 'Downloading ' + format.toUpperCase() + '...';
        
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = format === 'pdf' ? 'pdf' : (format === 'docx' ? 'docx' : 'xlsx');
        a.download = 'PIXNIVO_Barcodes.' + ext;
        a.click();
        URL.revokeObjectURL(url);
        
        progBar.style.width = '100%';
        progText.textContent = 'Success!';
        setTimeout(() => {
            progBarContainer.style.display = 'none';
            progText.style.display = 'none';
            progBar.style.width = '0%';
        }, 3000);
        
    } catch(e) {
        alert('Export failed: ' + e.message);
        progBarContainer.style.display = 'none';
        progText.style.display = 'none';
    }
}

btnExportPdf.addEventListener('click', () => exportBarcodes('pdf'));
btnExportWord.addEventListener('click', () => exportBarcodes('docx'));
btnExportExcel.addEventListener('click', () => exportBarcodes('xlsx'));
