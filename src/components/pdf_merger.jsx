import React, { useState } from "react";
import { PDFDocument } from "pdf-lib";
import "./pdf_merger.css";

export default function PDFMerger() {
  const [files, setFiles] = useState([]);

  const onFilesSelected = (e) => {
    const fileList = Array.from(e.target.files).filter(
      (f) => f.type === "application/pdf"
    );
    // Avoid duplicates by name+size
    const newFiles = fileList.filter(
      (f) =>
        !files.some(
          (existing) =>
            existing.name === f.name && existing.size === f.size
        )
    );
    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = null;
  };

  const removeAt = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const mergeAndDownload = async () => {
    if (files.length < 2) {
      alert("Please add at least two PDF files to merge.");
      return;
    }

    try {
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const src = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(
          src,
          src.getPageIndices()
        );
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      alert("Merged PDF downloaded as merged.pdf");
    } catch (err) {
      console.error(err);
      alert("An error occurred while merging PDFs.");
    }
  };

  return (
    <div className="container">
      <h1>PDF Merger</h1>

      <input
        type="file"
        accept="application/pdf"
        multiple
        onChange={onFilesSelected}
      />

      <ul className="file-list">
        {files.map((f, i) => (
          <li key={`${f.name}-${f.size}`} className="file-item">
            <span className="file-name">{f.name}</span>
            <button onClick={() => removeAt(i)} className="btn remove">
              Remove
            </button>
          </li>
        ))}
        {files.length === 0 && <li className="muted">No files added</li>}
      </ul>

      <div className="actions">
        <button onClick={mergeAndDownload} className="btn merge">
          Merge PDFs
        </button>
      </div>
    </div>
  );
}
