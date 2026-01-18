import "./App.css";
import PDFMerger from "./components/pdf_merger";
import PdfSplitTool from "./components/pdf_split";

function App() {
  return (
    <div className="App">
      <PDFMerger />
      <PdfSplitTool />
    </div>
  );
}

export default App;
