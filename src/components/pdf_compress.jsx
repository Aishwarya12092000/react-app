import React, { useState } from "react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf"; // ✅ CRA-friendly

pdfjsLib.GlobalWorkerOptions.workerSrc = process.env.PUBLIC_URL + "/pdf.worker.min.js";

/**
 * Strong compression:
 * - Renders each page to canvas
 * - Converts to JPEG
 * - Rebuilds PDF
 *
 * Great for scanned PDFs (big size reduction)
 */
export default function PdfCompress() {
    const [busy, setBusy] = useState(false);
    const [quality, setQuality] = useState(0.6);
    const [scale, setScale] = useState(1.2);
    const [info, setInfo] = useState("");

    async function handleFile(e) {
        setInfo("");
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            setInfo("Please upload a PDF file.");
            return;
        }

        setBusy(true);

        try {
            const inputBytes = new Uint8Array(await file.arrayBuffer());
            const beforeKB = Math.round(inputBytes.length / 1024);

            // Load PDF using pdf.js
            const loadingTask = pdfjsLib.getDocument({ data: inputBytes });
            const pdf = await loadingTask.promise;

            // New PDF output
            const outPdf = await PDFDocument.create();

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale });

                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);

                await page.render({ canvasContext: ctx, viewport }).promise;

                // Canvas → JPEG
                const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
                const jpegBytes = dataUrlToUint8Array(jpegDataUrl);

                const img = await outPdf.embedJpg(jpegBytes);

                const outPage = outPdf.addPage([viewport.width, viewport.height]);
                outPage.drawImage(img, {
                    x: 0,
                    y: 0,
                    width: viewport.width,
                    height: viewport.height,
                });
            }

            const outBytes = await outPdf.save({ useObjectStreams: true });
            const afterKB = Math.round(outBytes.length / 1024);

            downloadBytes(outBytes, file.name.replace(/\.pdf$/i, "") + "_compressed.pdf");
            setInfo(`✅ Done! Before: ${beforeKB} KB → After: ${afterKB} KB`);
        } catch (err) {
            console.error(err);
            setInfo("❌ Compression failed. PDF might be encrypted or unsupported.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div style={{ maxWidth: 720, margin: "24px auto", fontFamily: "system-ui" }}>
            <h2>Compress PDF (Strong)</h2>

            <p style={{ opacity: 0.75 }}>
                Converts each PDF page to JPEG and rebuilds a smaller PDF (best for scanned PDFs).
            </p>

            <div style={{ display: "grid", gap: 12, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
                <label style={{ display: "grid", gap: 4 }}>
                    <span>JPEG Quality: <b>{quality}</b></span>
                    <input
                        type="range"
                        min="0.2"
                        max="1"
                        step="0.05"
                        value={quality}
                        onChange={(e) => setQuality(Number(e.target.value))}
                        disabled={busy}
                    />
                </label>

                <label style={{ display: "grid", gap: 4 }}>
                    <span>Render Scale: <b>{scale}</b></span>
                    <input
                        type="range"
                        min="0.8"
                        max="2"
                        step="0.1"
                        value={scale}
                        onChange={(e) => setScale(Number(e.target.value))}
                        disabled={busy}
                    />
                    <small style={{ opacity: 0.7 }}>
                        Lower scale = smaller file but blurrier. Try 1.0–1.4.
                    </small>
                </label>

                <input type="file" accept="application/pdf,.pdf" onChange={handleFile} disabled={busy} />
            </div>

            {busy ? <p style={{ marginTop: 12 }}>Compressing... ⏳</p> : null}
            {info ? <p style={{ marginTop: 12 }}>{info}</p> : null}
        </div>
    );
}

function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(",")[1];
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    // a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
