import React, { useState } from "react";

const PdfMerger = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleMerge = async () => {
    if (!files.length) {
      alert("Please select at least one PDF");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const res = await fetch("http://localhost:5000/merge", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Merge failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      // Trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Error merging PDFs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>PDF Merger</h2>
      <input type="file" accept="application/pdf" multiple onChange={handleFileChange} />
      <button onClick={handleMerge} disabled={loading}>
        {loading ? "Merging..." : "Merge PDFs"}
      </button>
    </div>
  );
};

export default PdfMerger;
