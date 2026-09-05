from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional

import rasterio
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import io
import re


app = FastAPI(
    title="Raster Normalizer",
    description="Raster normalization and export API"
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ---------------------------------------------------------
# Basic route
# ---------------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Raster Normalizer Backend is running!"
    }


# ---------------------------------------------------------
# Supported input formats
# ---------------------------------------------------------

SUPPORTED_EXTENSIONS = (
    ".tif",
    ".tiff",
    ".jpg",
    ".jpeg",
    ".png"
)


# ---------------------------------------------------------
# Helper: normalize array
# ---------------------------------------------------------

def normalize_array(data):
    """
    Min-Max normalization:
        (X - Xmin) / (Xmax - Xmin)

    Invalid / NoData / NaN values become -9999.
    """

    arr = np.asarray(data, dtype="float32")

    invalid_mask = ~np.isfinite(arr)

    valid_values = arr[~invalid_mask]

    output = np.full(
        arr.shape,
        -9999.0,
        dtype="float32"
    )

    if valid_values.size == 0:
        return output

    minimum = float(valid_values.min())
    maximum = float(valid_values.max())

    if maximum == minimum:
        output[~invalid_mask] = 0.0
    else:
        output[~invalid_mask] = (
            (arr[~invalid_mask] - minimum)
            / (maximum - minimum)
        )

    return output


# ---------------------------------------------------------
# Helper: safe filename
# ---------------------------------------------------------

def safe_filename(filename):
    filename = re.sub(
        r"[^a-zA-Z0-9._-]",
        "_",
        filename
    )

    if not filename:
        filename = "normalized_raster.tif"

    return filename


# ---------------------------------------------------------
# Normalize uploaded raster
# ---------------------------------------------------------

@app.post("/normalize")
async def normalize_raster(file: UploadFile = File(...)):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected."
        )

    filename = file.filename.lower()

    if not filename.endswith(SUPPORTED_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file format. "
                "Please use TIF, TIFF, JPG, JPEG or PNG."
            )
        )

    try:

        input_bytes = await file.read()

        if not input_bytes:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty."
            )

        with MemoryFile(input_bytes) as input_memory:

            with input_memory.open() as src:

                profile = {
                    "driver": "GTiff",
                    "height": src.height,
                    "width": src.width,
                    "count": src.count,
                    "dtype": "float32",
                    "nodata": -9999.0,
                    "crs": src.crs,
                    "transform": src.transform,
                    "compress": "deflate",
                    "predictor": 3
                }

                with MemoryFile() as output_memory:

                    with output_memory.open(**profile) as dst:

                        for band_number in range(
                            1,
                            src.count + 1
                        ):

                            masked_data = src.read(
                                band_number,
                                masked=True
                            ).astype("float32")

                            data = masked_data.filled(
                                np.nan
                            )

                            normalized = normalize_array(
                                data
                            )

                            dst.write(
                                normalized,
                                band_number
                            )

                    output_bytes = output_memory.read()

        return Response(
            content=output_bytes,
            media_type="image/tiff",
            headers={
                "Content-Disposition": (
                    'attachment; '
                    'filename="normalized_raster.tif"'
                )
            }
        )

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Raster processing failed: {str(e)}"
        )


# ---------------------------------------------------------
# Custom Grid model
# ---------------------------------------------------------

class GridRequest(BaseModel):

    rows: int = Field(
        ...,
        ge=1,
        le=500
    )

    cols: int = Field(
        ...,
        ge=1,
        le=500
    )

    values: List[List[Optional[float]]]

    cell_size: float = Field(
        ...,
        gt=0
    )

    x_origin: float

    y_origin: float

    crs: str = "EPSG:4326"


# ---------------------------------------------------------
# Normalize custom grid
# ---------------------------------------------------------

@app.post("/normalize-grid")
async def normalize_grid(request: GridRequest):

    try:

        if len(request.values) != request.rows:
            raise HTTPException(
                status_code=400,
                detail="Number of grid rows does not match."
            )

        for row in request.values:

            if len(row) != request.cols:
                raise HTTPException(
                    status_code=400,
                    detail="Number of grid columns does not match."
                )

        array = np.full(
            (request.rows, request.cols),
            np.nan,
            dtype="float32"
        )

        for r in range(request.rows):

            for c in range(request.cols):

                value = request.values[r][c]

                if value is not None:

                    if not np.isfinite(value):
                        raise HTTPException(
                            status_code=400,
                            detail="Grid contains an invalid number."
                        )

                    array[r, c] = float(value)

        normalized = normalize_array(array)

        transform = from_origin(
            request.x_origin,
            request.y_origin,
            request.cell_size,
            request.cell_size
        )

        profile = {
            "driver": "GTiff",
            "height": request.rows,
            "width": request.cols,
            "count": 1,
            "dtype": "float32",
            "nodata": -9999.0,
            "crs": request.crs,
            "transform": transform,
            "compress": "deflate",
            "predictor": 3
        }

        with MemoryFile() as output_memory:

            with output_memory.open(**profile) as dst:

                dst.write(
                    normalized,
                    1
                )

            output_bytes = output_memory.read()

        return Response(
            content=output_bytes,
            media_type="image/tiff",
            headers={
                "Content-Disposition": (
                    'attachment; '
                    'filename="normalized_grid.tif"'
                )
            }
        )

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Grid normalization failed: {str(e)}"
        )


# ---------------------------------------------------------
# Convert normalized TIFF to JPG
# ---------------------------------------------------------

@app.post("/export/jpg")
async def export_jpg(file: UploadFile = File(...)):

    try:

        input_bytes = await file.read()

        if not input_bytes:
            raise HTTPException(
                status_code=400,
                detail="No normalized raster received."
            )

        with MemoryFile(input_bytes) as memory:

            with memory.open() as src:

                # Single-band raster
                if src.count == 1:

                    data = src.read(
                        1,
                        masked=True
                    )

                    array = data.filled(np.nan)

                    fig, ax = plt.subplots(
                        figsize=(8, 8),
                        dpi=150
                    )

                    ax.imshow(
                        array,
                        cmap="gray",
                        vmin=0,
                        vmax=1
                    )

                else:

                    bands = []

                    for band_number in range(1, 4):

                        if band_number <= src.count:

                            band = src.read(
                                band_number,
                                masked=True
                            ).filled(np.nan)

                            band = np.clip(
                                band,
                                0,
                                1
                            )

                            bands.append(band)

                    while len(bands) < 3:

                        bands.append(
                            bands[-1]
                        )

                    rgb = np.stack(
                        bands[:3],
                        axis=2
                    )

                    fig, ax = plt.subplots(
                        figsize=(8, 8),
                        dpi=150
                    )

                    ax.imshow(
                        rgb
                    )

                ax.axis("off")

                plt.tight_layout(
                    pad=0
                )

                output = io.BytesIO()

                fig.savefig(
                    output,
                    format="jpg",
                    dpi=150,
                    bbox_inches="tight",
                    pad_inches=0
                )

                plt.close(fig)

                output.seek(0)

                return Response(
                    content=output.read(),
                    media_type="image/jpeg",
                    headers={
                        "Content-Disposition": (
                            'attachment; '
                            'filename="normalized_raster.jpg"'
                        )
                    }
                )

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"JPG export failed: {str(e)}"
        )


# ---------------------------------------------------------
# Convert normalized TIFF to PDF
# ---------------------------------------------------------

@app.post("/export/pdf")
async def export_pdf(file: UploadFile = File(...)):

    try:

        input_bytes = await file.read()

        if not input_bytes:
            raise HTTPException(
                status_code=400,
                detail="No normalized raster received."
            )

        with MemoryFile(input_bytes) as memory:

            with memory.open() as src:

                fig, ax = plt.subplots(
                    figsize=(8.27, 11.69)
                )

                if src.count == 1:

                    data = src.read(
                        1,
                        masked=True
                    )

                    array = data.filled(np.nan)

                    ax.imshow(
                        array,
                        cmap="gray",
                        vmin=0,
                        vmax=1
                    )

                else:

                    bands = []

                    for band_number in range(1, 4):

                        if band_number <= src.count:

                            band = src.read(
                                band_number,
                                masked=True
                            ).filled(np.nan)

                            band = np.clip(
                                band,
                                0,
                                1
                            )

                            bands.append(band)

                    while len(bands) < 3:

                        bands.append(
                            bands[-1]
                        )

                    rgb = np.stack(
                        bands[:3],
                        axis=2
                    )

                    ax.imshow(rgb)

                ax.axis("off")

                plt.tight_layout(
                    pad=0
                )

                output = io.BytesIO()

                fig.savefig(
                    output,
                    format="pdf",
                    bbox_inches="tight",
                    pad_inches=0
                )

                plt.close(fig)

                output.seek(0)

                return Response(
                    content=output.read(),
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": (
                            'attachment; '
                            'filename="normalized_raster.pdf"'
                        )
                    }
                )

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"PDF export failed: {str(e)}"
        )