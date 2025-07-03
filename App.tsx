
import React, { useState, useCallback } from 'react';
import { usePdfExtractor } from './hooks/usePdfExtractor';
import { convertTextToHtml } from './services/geminiService';
import { FileUpload } from './components/FileUpload';
import { ResultDisplay } from './components/ResultDisplay';
import { LoaderIcon } from './components/icons/LoaderIcon';
import { FileIcon } from './components/icons/FileIcon';
import { TrashIcon } from './components/icons/TrashIcon';

type Result = {
  fileName: string;
  htmlContent: string;
};

const App: React.FC = () => {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string>('');
  const [combineOutput, setCombineOutput] = useState<boolean>(true);
  const [conversionStatus, setConversionStatus] = useState('');

  const { extractPdfText, isLoading: isExtracting, error: extractionError } = usePdfExtractor();

  const handleFilesAdded = (newFiles: File[]) => {
    setPdfFiles(prevFiles => {
      const existingFileNames = new Set(prevFiles.map(f => f.name));
      const uniqueNewFiles = newFiles.filter(f => !existingFileNames.has(f.name));
      return [...prevFiles, ...uniqueNewFiles];
    });
    setResults([]);
    setError('');
  };

  const handleRemoveFile = (fileName: string) => {
    setPdfFiles(prevFiles => prevFiles.filter(f => f.name !== fileName));
  };
  
  const handleClearAll = () => {
    setPdfFiles([]);
    setResults([]);
    setError('');
  };

  const handleConvert = useCallback(async () => {
    if (pdfFiles.length === 0) {
      setError('Please select one or more PDF files first.');
      return;
    }

    setIsConverting(true);
    setError('');
    setResults([]);

    try {
      if (combineOutput) {
        setConversionStatus(`Extracting text from ${pdfFiles.length} files...`);
        const allTexts = await Promise.all(
          pdfFiles.map(file => extractPdfText(file))
        );
        
        // Filter out any nulls from failed extractions
        const validTexts = allTexts.filter((text): text is string => text !== null);
        if(validTexts.length === 0) throw new Error("Could not extract text from any of the provided files.");
        
        const combinedText = validTexts.join('\n\n<hr />\n\n');
        
        setConversionStatus('AI is converting combined text...');
        const generatedHtml = await convertTextToHtml(combinedText);
        setResults([{ fileName: 'Combined Output', htmlContent: generatedHtml }]);

      } else {
        const individualResults: Result[] = [];
        for (let i = 0; i < pdfFiles.length; i++) {
          const file = pdfFiles[i];
          setConversionStatus(`Converting ${file.name} (${i + 1}/${pdfFiles.length})...`);
          const text = await extractPdfText(file);
          if (text) {
            const generatedHtml = await convertTextToHtml(text);
            individualResults.push({ fileName: file.name, htmlContent: generatedHtml });
          } else {
             // Log error for this specific file, but continue with others
            console.error(`Failed to extract text from ${file.name}`);
          }
        }
        setResults(individualResults);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'An unknown error occurred during conversion.');
    } finally {
      setIsConverting(false);
      setConversionStatus('');
    }
  }, [pdfFiles, extractPdfText, combineOutput]);

  const isLoading = isConverting || isExtracting;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
            AI PDF to HTML Converter
          </h1>
          <p className="mt-2 text-lg text-slate-400">
            Upload multiple PDFs and let AI transform them into clean, structured HTML.
          </p>
        </header>

        <main className="space-y-6">
          <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg border border-slate-700">
            <FileUpload onFilesAdded={handleFilesAdded} disabled={isLoading} />
          </div>

          {pdfFiles.length > 0 && (
             <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg border border-slate-700 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-200">Selected Files ({pdfFiles.length})</h2>
                <button 
                  onClick={handleClearAll} 
                  className="text-sm font-medium text-sky-400 hover:text-sky-300 disabled:opacity-50"
                  disabled={isLoading}
                >
                  Clear All
                </button>
              </div>
              <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {pdfFiles.map(file => (
                  <li key={file.name} className="flex items-center justify-between bg-slate-800 p-2 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileIcon />
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-300 text-sm">{file.name}</span>
                        <span className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveFile(file.name)} disabled={isLoading} className="p-1 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50">
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <label htmlFor="combine-toggle" className="text-sm font-medium text-slate-300 cursor-pointer">
                  Combine into single HTML file
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" id="combine-toggle" className="sr-only peer" checked={combineOutput} onChange={e => setCombineOutput(e.target.checked)} disabled={isLoading} />
                  <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-sky-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>
              
              <div className="pt-4 flex justify-center">
                <button
                  onClick={handleConvert}
                  disabled={isLoading || pdfFiles.length === 0}
                  className="w-full flex items-center justify-center gap-3 px-8 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  {isLoading ? (
                    <>
                      <LoaderIcon />
                      <span>{conversionStatus || (isExtracting ? 'Extracting Text...' : 'Converting...')}</span>
                    </>
                  ) : (
                    `Convert ${pdfFiles.length} File(s)`
                  )}
                </button>
              </div>
            </div>
          )}
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {results.length > 0 && !isLoading && (
            <ResultDisplay results={results} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
