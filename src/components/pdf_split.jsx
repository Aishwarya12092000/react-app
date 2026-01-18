import React, { useMemo, useState } from "react";
import { PDFDocument } from "pdf-lib";

/**
 * PDF Splitter (client-side)
 * - Upload a PDF
 * - Add one or more page ranges (1-based, inclusive)
 * - Generate split PDFs and download them
 *
 * Notes:
 * - Large PDFs can be memory heavy in the browser.
 * - No server required.
 */
export default function PdfSplitTool() {
    const [file, setFile] = useState(null);
    const [fileBytes, setFileBytes] = useState(null);
    const [pageCount, setPageCount] = useState(null);

    const [ranges, setRanges] = useState([{ from: 1, to: 1 }]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const validRanges = useMemo(() => {
        if (!pageCount) return [];
        return ranges.map((r) => ({
            from: clampInt(r.from, 1, pageCount),
            to: clampInt(r.to, 1, pageCount),
        }));
    }, [ranges, pageCount]);

    async function onPickFile(e) {
        setError("");
        const f = e.target.files?.[0];
        if (!f) return;

        if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
            setError("Please choose a PDF file.");
            return;
        }

        setFile(f);
        setPageCount(null);
        setFileBytes(null);

        try {
            const bytes = new Uint8Array(await f.arrayBuffer());
            const pdf = await PDFDocument.load(bytes);
            setFileBytes(bytes);
            setPageCount(pdf.getPageCount());
            // reset ranges to something sensible
            setRanges([{ from: 1, to: Math.min(1, pdf.getPageCount()) }]);
        } catch (err) {
            setError("Could not read that PDF. It may be corrupted or password-protected.");
        }
    }

    function updateRange(idx, patch) {
        setRanges((prev) =>
            prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
        );
    }

    function addRange() {
        const nextFrom = pageCount ? Math.min(pageCount, (validRanges.at(-1)?.to ?? 0) + 1) : 1;
        setRanges((prev) => [...prev, { from: nextFrom, to: nextFrom }]);
    }

    function removeRange(idx) {
        setRanges((prev) => prev.filter((_, i) => i !== idx));
    }

    function normalizeRanges() {
        if (!pageCount) return;
        setRanges((prev) =>
            prev.map((r) => {
                const from = clampInt(r.from, 1, pageCount);
                const to = clampInt(r.to, 1, pageCount);
                return from <= to ? { from, to } : { from: to, to: from };
            })
        );
    }

    async function splitAndDownload() {
        setError("");
        if (!fileBytes || !pageCount) {
            setError("Please upload a PDF first.");
            return;
        }

        const cleaned = validRanges.map((r) => {
            const from = r.from;
            const to = r.to;
            if (from > to) return { from: to, to: from };
            return r;
        });

        // Basic validation: ranges must be within bounds and non-empty
        for (const r of cleaned) {
            if (r.from < 1 || r.to > pageCount || r.from > r.to) {
                setError("One or more ranges are invalid.");
                return;
            }
        }

        setBusy(true);
        try {
            const src = await PDFDocument.load(fileBytes);
            const baseName = (file?.name ?? "document.pdf").replace(/\.pdf$/i, "");

            for (let i = 0; i < cleaned.length; i++) {
                const { from, to } = cleaned[i];

                const out = await PDFDocument.create();
                // pdf-lib uses 0-based indexes
                const pageIndexes = Array.from({ length: to - from + 1 }, (_, k) => (from - 1) + k);

                const copied = await out.copyPages(src, pageIndexes);
                copied.forEach((p) => out.addPage(p));

                const outBytes = await out.save();
                const filename = `${baseName}_pages_${from}-${to}.pdf`;
                downloadBytes(outBytes, filename);
            }
        } catch (err) {
            setError("Splitting failed. If the PDF is encrypted/password-protected, it may not work in-browser.");
        } finally {
            setBusy(false);
        }
    }

    function parseRangeText(text) {
        // Accept formats: "1-3", "5", "10-12"
        // Returns {from,to} or null
        const t = String(text).trim();
        if (!t) return null;

        const m = t.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
        if (!m) return null;

        const a = parseInt(m[1], 10);
        const b = m[2] ? parseInt(m[2], 10) : a;
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

        return { from: a, to: b };
    }

    function applyBulkRanges(text) {
        setError("");
        const lines = String(text)
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean);

        const next = [];
        for (const token of lines) {
            const r = parseRangeText(token);
            if (!r) {
                setError(`Could not parse: "${token}". Use formats like 1-3 or 5.`);
                return;
            }
            next.push(r);
        }

        if (next.length === 0) {
            setError("No ranges found.");
            return;
        }
        setRanges(next);
        // normalize later when pageCount exists
    }

    return (
        <div style={{ maxWidth: 760, margin: "24px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
            <h2 style={{ margin: 0 }}>PDF Splitter</h2>
            <p style={{ marginTop: 8, opacity: 0.8 }}>
                Upload a PDF, define page ranges, then download split files. (Runs entirely in your browser.)
            </p>

            <div style={{ display: "grid", gap: 12, padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>PDF file</span>
                    <input type="file" accept="application/pdf,.pdf" onChange={onPickFile} />
                </label>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div><strong>Pages:</strong> {pageCount ?? "—"}</div>
                    {file?.name ? <div title={file.name} style={{ opacity: 0.8 }}>📄 {file.name}</div> : null}
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <strong>Split ranges</strong>
                        <button type="button" onClick={addRange} disabled={!pageCount || busy}>
                            + Add range
                        </button>
                    </div>

                    {ranges.map((r, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr auto",
                                gap: 10,
                                alignItems: "center",
                            }}
                        >
                            <label style={{ display: "grid", gap: 4 }}>
                                <span style={{ fontSize: 12, opacity: 0.75 }}>From (1-based)</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={pageCount ?? undefined}
                                    value={r.from}
                                    onChange={(e) => updateRange(idx, { from: e.target.value === "" ? "" : Number(e.target.value) })}
                                    onBlur={normalizeRanges}
                                    disabled={!pageCount || busy}
                                />
                            </label>

                            <label style={{ display: "grid", gap: 4 }}>
                                <span style={{ fontSize: 12, opacity: 0.75 }}>To</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={pageCount ?? undefined}
                                    value={r.to}
                                    onChange={(e) => updateRange(idx, { to: e.target.value === "" ? "" : Number(e.target.value) })}
                                    onBlur={normalizeRanges}
                                    disabled={!pageCount || busy}
                                />
                            </label>

                            <button
                                type="button"
                                onClick={() => removeRange(idx)}
                                disabled={ranges.length <= 1 || busy}
                                title="Remove range"
                            >
                                ✕
                            </button>
                        </div>
                    ))}

                    <details style={{ marginTop: 6 }}>
                        <summary style={{ cursor: "pointer" }}>Paste ranges (optional)</summary>
                        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                            <textarea
                                rows={3}
                                placeholder={`Example:\n1-3\n4-4\n5-10\n(or: 1-3, 4, 5-10)`}
                                onBlur={(e) => applyBulkRanges(e.target.value)}
                                disabled={!pageCount || busy}
                                style={{ width: "100%" }}
                            />
                            <small style={{ opacity: 0.75 }}>
                                Tip: paste ranges separated by new lines, commas, or semicolons.
                            </small>
                        </div>
                    </details>
                </div>

                {error ? (
                    <div style={{ padding: 10, border: "1px solid #f3b2b2", background: "#fff5f5", borderRadius: 10 }}>
                        {error}
                    </div>
                ) : null}

                <button
                    type="button"
                    onClick={splitAndDownload}
                    disabled={!pageCount || !fileBytes || busy}
                    style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #ccc",
                        cursor: !pageCount || busy ? "not-allowed" : "pointer",
                        fontWeight: 700,
                    }}
                >
                    {busy ? "Splitting..." : "Split & Download"}
                </button>
            </div>
        </div>
    );
}

function clampInt(v, min, max) {
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}

function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // allow time for download to start, then revoke
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
