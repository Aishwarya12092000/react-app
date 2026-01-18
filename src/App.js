import "./App.css";
import PDFMerger from "./components/pdf_merger";
import PdfSplitTool from "./components/pdf_split";
import PdfCompress from "./components/pdf_compress";

function App() {
  return (
    <div className="App">
      <PDFMerger />
      <PdfSplitTool />
      <PdfCompress />
    </div>
  );
}

export default App;
