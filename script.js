// =========================================================
// Raster Normalizer - Main JavaScript
// =========================================================

const BACKEND_URL = "http://127.0.0.1:8000";


// ---------------------------------------------------------
// Global state
// ---------------------------------------------------------

let latestRasterBlob = null;
let latestJpgBlob = null;

let latestFileName = "normalized_raster.tif";
let latestSource = "raster";


// ---------------------------------------------------------
// Elements
// ---------------------------------------------------------

const rasterInput = document.getElementById("rasterInput");
const browseButton = document.getElementById("browseButton");

const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const removeButton = document.getElementById("removeButton");

const normalizeButton = document.getElementById(
    "normalizeButton"
);

const resultCard = document.getElementById(
    "resultCard"
);

const downloadButton = document.getElementById(
    "downloadButton"
);

const downloadJpgButton = document.getElementById(
    "downloadJpgButton"
);

const downloadPdfButton = document.getElementById(
    "downloadPdfButton"
);

const previewImage = document.getElementById(
    "previewImage"
);

const previewLoading = document.getElementById(
    "previewLoading"
);


// Grid elements

const rowsInput = document.getElementById(
    "gridRows"
);

const colsInput = document.getElementById(
    "gridCols"
);

const cellSizeInput = document.getElementById(
    "cellSize"
);

const xOriginInput = document.getElementById(
    "xOrigin"
);

const yOriginInput = document.getElementById(
    "yOrigin"
);

const crsInput = document.getElementById(
    "gridCRS"
);

const gridContainer = document.getElementById(
    "gridContainer"
);

const fillExampleButton = document.getElementById(
    "fillExample"
);

const clearGridButton = document.getElementById(
    "clearGrid"
);

const normalizeGridButton = document.getElementById(
    "normalizeGridButton"
);


// ---------------------------------------------------------
// File upload
// ---------------------------------------------------------

browseButton.addEventListener(
    "click",
    function (event) {

        event.preventDefault();

        rasterInput.click();
    }
);


rasterInput.addEventListener(
    "change",
    function () {

        const file = rasterInput.files[0];

        if (!file) {
            return;
        }

        const name = file.name.toLowerCase();

        const allowed = [
            ".tif",
            ".tiff",
            ".jpg",
            ".jpeg",
            ".png"
        ];

        const valid = allowed.some(
            extension => name.endsWith(extension)
        );

        if (!valid) {

            alert(
                "Please select a TIF, TIFF, JPG, JPEG or PNG file."
            );

            rasterInput.value = "";

            return;
        }

        fileName.textContent = file.name;

        const sizeMB = (
            file.size /
            (1024 * 1024)
        ).toFixed(2);

        fileSize.textContent =
            sizeMB + " MB";

        fileInfo.style.display = "flex";

        hideResult();
    }
);


// ---------------------------------------------------------
// Remove selected file
// ---------------------------------------------------------

removeButton.addEventListener(
    "click",
    function (event) {

        event.preventDefault();

        rasterInput.value = "";

        fileInfo.style.display = "none";

        hideResult();
    }
);


// ---------------------------------------------------------
// Error reader
// ---------------------------------------------------------

async function getErrorMessage(response) {

    try {

        const data = await response.json();

        if (data.detail) {
            return data.detail;
        }

    } catch (error) {
        // Ignore JSON parsing error
    }

    try {

        const text = await response.text();

        if (text) {
            return text;
        }

    } catch (error) {
        // Ignore
    }

    return "An unknown error occurred.";
}


// ---------------------------------------------------------
// Hide result
// ---------------------------------------------------------

function hideResult() {

    resultCard.style.display = "none";

    latestRasterBlob = null;
    latestJpgBlob = null;

    if (previewImage) {

        previewImage.removeAttribute(
            "src"
        );
    }

    if (previewLoading) {

        previewLoading.style.display =
            "none";
    }
}


// ---------------------------------------------------------
// Show result
// ---------------------------------------------------------

function showResult(
    source = "raster"
) {

    latestSource = source;

    resultCard.style.display = "block";

    resultCard.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

    createPreview();
}


// ---------------------------------------------------------
// Normalize uploaded raster
// ---------------------------------------------------------

normalizeButton.addEventListener(
    "click",
    async function (event) {

        event.preventDefault();

        const file = rasterInput.files[0];

        if (!file) {

            alert(
                "Please upload a raster file first."
            );

            return;
        }

        normalizeButton.disabled = true;

        normalizeButton.innerHTML =
            "Normalizing raster...";

        hideResult();

        try {

            const formData =
                new FormData();

            formData.append(
                "file",
                file
            );

            const response = await fetch(
                BACKEND_URL + "/normalize",
                {
                    method: "POST",
                    body: formData
                }
            );

            if (!response.ok) {

                throw new Error(
                    await getErrorMessage(
                        response
                    )
                );
            }

            latestRasterBlob =
                await response.blob();

            latestFileName =
                "normalized_raster.tif";

            showResult("raster");

        } catch (error) {

            console.error(
                "Normalization error:",
                error
            );

            alert(
                "Normalization failed.\n\n" +
                error.message
            );

        } finally {

            normalizeButton.disabled = false;

            normalizeButton.innerHTML =
                `<span>Normalize Raster</span>
                 <span class="button-arrow">→</span>`;
        }
    }
);


// ---------------------------------------------------------
// Create dynamic grid
// ---------------------------------------------------------

function createGrid() {

    const rows = Math.max(
        1,
        Math.min(
            500,
            parseInt(rowsInput.value) || 5
        )
    );

    const cols = Math.max(
        1,
        Math.min(
            500,
            parseInt(colsInput.value) || 5
        )
    );

    rowsInput.value = rows;
    colsInput.value = cols;

    gridContainer.innerHTML = "";

    gridContainer.style.setProperty(
        "--grid-columns",
        cols
    );

    for (
        let row = 0;
        row < rows;
        row++
    ) {

        for (
            let col = 0;
            col < cols;
            col++
        ) {

            const input =
                document.createElement(
                    "input"
                );

            input.type = "number";

            input.step = "any";

            input.className =
                "grid-cell";

            input.dataset.row = row;
            input.dataset.col = col;

            input.placeholder = "";

            gridContainer.appendChild(
                input
            );
        }
    }
}


rowsInput.addEventListener(
    "change",
    createGrid
);

colsInput.addEventListener(
    "change",
    createGrid
);


// ---------------------------------------------------------
// Fill example
// ---------------------------------------------------------

fillExampleButton.addEventListener(
    "click",
    function () {

        const cells =
            document.querySelectorAll(
                ".grid-cell"
            );

        cells.forEach(
            (cell, index) => {

                cell.value =
                    index + 1;
            }
        );
    }
);


// ---------------------------------------------------------
// Clear grid
// ---------------------------------------------------------

clearGridButton.addEventListener(
    "click",
    function () {

        const cells =
            document.querySelectorAll(
                ".grid-cell"
            );

        cells.forEach(
            cell => {
                cell.value = "";
            }
        );
    }
);


// ---------------------------------------------------------
// Read grid values
// ---------------------------------------------------------

function getGridValues() {

    const rows = parseInt(
        rowsInput.value
    );

    const cols = parseInt(
        colsInput.value
    );

    const cells =
        document.querySelectorAll(
            ".grid-cell"
        );

    const values = [];

    for (
        let row = 0;
        row < rows;
        row++
    ) {

        const currentRow = [];

        for (
            let col = 0;
            col < cols;
            col++
        ) {

            const index =
                row * cols + col;

            const value =
                cells[index].value.trim();

            if (value === "") {

                currentRow.push(null);

            } else {

                const number =
                    Number(value);

                if (!Number.isFinite(number)) {

                    throw new Error(
                        `Invalid value at row ${
                            row + 1
                        }, column ${
                            col + 1
                        }.`
                    );
                }

                currentRow.push(number);
            }
        }

        values.push(currentRow);
    }

    return values;
}


// ---------------------------------------------------------
// Normalize custom grid
// ---------------------------------------------------------

normalizeGridButton.addEventListener(
    "click",
    async function (event) {

        event.preventDefault();

        normalizeGridButton.disabled =
            true;

        normalizeGridButton.innerHTML =
            "Normalizing grid...";

        hideResult();

        try {

            const values =
                getGridValues();

            const requestData = {

                rows: parseInt(
                    rowsInput.value
                ),

                cols: parseInt(
                    colsInput.value
                ),

                values: values,

                cell_size: Number(
                    cellSizeInput.value
                ),

                x_origin: Number(
                    xOriginInput.value
                ),

                y_origin: Number(
                    yOriginInput.value
                ),

                crs:
                    crsInput.value.trim() ||
                    "EPSG:4326"
            };


            if (
                !Number.isFinite(
                    requestData.cell_size
                ) ||
                requestData.cell_size <= 0
            ) {

                throw new Error(
                    "Cell size must be greater than 0."
                );
            }


            const response =
                await fetch(
                    BACKEND_URL +
                    "/normalize-grid",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                requestData
                            )
                    }
                );


            if (!response.ok) {

                throw new Error(
                    await getErrorMessage(
                        response
                    )
                );
            }


            latestRasterBlob =
                await response.blob();

            latestFileName =
                "normalized_grid.tif";

            showResult("grid");

        } catch (error) {

            console.error(
                "Grid normalization error:",
                error
            );

            alert(
                "Grid normalization failed.\n\n" +
                error.message
            );

        } finally {

            normalizeGridButton.disabled =
                false;

            normalizeGridButton.innerHTML =
                `<span>Normalize Grid</span>
                 <span class="button-arrow">→</span>`;
        }
    }
);


// ---------------------------------------------------------
// Save file with folder / filename picker
// ---------------------------------------------------------

async function saveBlobWithPicker(
    blob,
    suggestedName,
    mimeType,
    description,
    extensions
) {

    if (
        "showSaveFilePicker" in window
    ) {

        const handle =
            await window.showSaveFilePicker({

                suggestedName:
                    suggestedName,

                types: [
                    {
                        description:
                            description,

                        accept: {
                            [mimeType]:
                                extensions
                        }
                    }
                ]
            });


        const writable =
            await handle.createWritable();

        await writable.write(blob);

        await writable.close();

        return;
    }


    // Browser fallback

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        suggestedName;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    setTimeout(
        () => URL.revokeObjectURL(url),
        1000
    );
}


// ---------------------------------------------------------
// Download GeoTIFF
// ---------------------------------------------------------

downloadButton.addEventListener(
    "click",
    async function (event) {

        event.preventDefault();

        if (!latestRasterBlob) {

            alert(
                "Normalized raster is not available."
            );

            return;
        }

        try {

            await saveBlobWithPicker(
                latestRasterBlob,
                latestFileName,
                "image/tiff",
                "GeoTIFF raster",
                [".tif", ".tiff"]
            );

        } catch (error) {

            if (
                error.name !==
                "AbortError"
            ) {

                console.error(error);

                alert(
                    "Download failed.\n\n" +
                    error.message
                );
            }
        }
    }
);


// ---------------------------------------------------------
// Create JPG / Preview
// ---------------------------------------------------------

async function createPreview() {

    if (!latestRasterBlob) {
        return;
    }

    try {

        if (previewLoading) {

            previewLoading.style.display =
                "block";
        }


        const formData =
            new FormData();

        formData.append(
            "file",
            latestRasterBlob,
            "normalized_raster.tif"
        );


        const response =
            await fetch(
                BACKEND_URL +
                "/export/jpg",
                {
                    method: "POST",
                    body: formData
                }
            );


        if (!response.ok) {

            throw new Error(
                await getErrorMessage(
                    response
                )
            );
        }


        latestJpgBlob =
            await response.blob();


        const imageURL =
            URL.createObjectURL(
                latestJpgBlob
            );


        previewImage.src =
            imageURL;


        previewImage.onload =
            function () {

                URL.revokeObjectURL(
                    imageURL
                );
            };


    } catch (error) {

        console.error(
            "Preview error:",
            error
        );

    } finally {

        if (previewLoading) {

            previewLoading.style.display =
                "none";
        }
    }
}


// ---------------------------------------------------------
// Download JPG
// ---------------------------------------------------------

downloadJpgButton.addEventListener(
    "click",
    async function (event) {

        event.preventDefault();

        if (!latestRasterBlob) {

            alert(
                "Normalized raster is not available."
            );

            return;
        }


        downloadJpgButton.disabled =
            true;

        downloadJpgButton.textContent =
            "Preparing JPG...";


        try {

            const formData =
                new FormData();

            formData.append(
                "file",
                latestRasterBlob,
                "normalized_raster.tif"
            );


            const response =
                await fetch(
                    BACKEND_URL +
                    "/export/jpg",
                    {
                        method: "POST",
                        body: formData
                    }
                );


            if (!response.ok) {

                throw new Error(
                    await getErrorMessage(
                        response
                    )
                );
            }


            const jpgBlob =
                await response.blob();


            await saveBlobWithPicker(
                jpgBlob,
                "normalized_raster.jpg",
                "image/jpeg",
                "JPEG image",
                [".jpg", ".jpeg"]
            );


        } catch (error) {

            if (
                error.name !==
                "AbortError"
            ) {

                console.error(
                    "JPG download error:",
                    error
                );

                alert(
                    "JPG export failed.\n\n" +
                    error.message
                );
            }

        } finally {

            downloadJpgButton.disabled =
                false;

            downloadJpgButton.textContent =
                "Download JPG";
        }
    }
);


// ---------------------------------------------------------
// Download PDF
// ---------------------------------------------------------

downloadPdfButton.addEventListener(
    "click",
    async function (event) {

        event.preventDefault();

        if (!latestRasterBlob) {

            alert(
                "Normalized raster is not available."
            );

            return;
        }


        downloadPdfButton.disabled =
            true;

        downloadPdfButton.textContent =
            "Preparing PDF...";


        try {

            const formData =
                new FormData();

            formData.append(
                "file",
                latestRasterBlob,
                "normalized_raster.tif"
            );


            const response =
                await fetch(
                    BACKEND_URL +
                    "/export/pdf",
                    {
                        method: "POST",
                        body: formData
                    }
                );


            if (!response.ok) {

                throw new Error(
                    await getErrorMessage(
                        response
                    )
                );
            }


            const pdfBlob =
                await response.blob();


            await saveBlobWithPicker(
                pdfBlob,
                "normalized_raster.pdf",
                "application/pdf",
                "PDF document",
                [".pdf"]
            );


        } catch (error) {

            if (
                error.name !==
                "AbortError"
            ) {

                console.error(
                    "PDF download error:",
                    error
                );

                alert(
                    "PDF export failed.\n\n" +
                    error.message
                );
            }

        } finally {

            downloadPdfButton.disabled =
                false;

            downloadPdfButton.textContent =
                "Download PDF";
        }
    }
);


// ---------------------------------------------------------
// Initial grid
// ---------------------------------------------------------

createGrid();