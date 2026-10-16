import React, { useState } from 'react';
import Header from './components/Header';
import ExamView from './components/ExamView';
import MindMapView from './components/MindMapView';
import {
  streamGenerateExamFromText,
  streamGenerateExamFromPDF,
  streamGenerateMindMapFromText,
  streamGenerateMindMapFromPDF,
} from './services/geminiService';
import { extractTextFromPdfInBrowser, PdfExtractResult } from './services/pdfExtractService';
import { Exam, MindMap, AppStatus, GenerationMode, ProgressState } from './types';

type InputSource = 'PDF' | 'TEXT';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [inputSource, setInputSource] = useState<InputSource>('PDF');
  const [exam, setExam] = useState<Exam | null>(null);
  const [mindMap, setMindMap] = useState<MindMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numQuestions, setNumQuestions] = useState<number>(100);
  const [customNumQuestions, setCustomNumQuestions] = useState<string>('100');
  const [mode, setMode] = useState<GenerationMode>('EXAM');

  // File & Client extraction state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<PdfExtractResult | null>(null);
  const [isExtractingLocal, setIsExtractingLocal] = useState<boolean>(false);
  const [localExtractProgress, setLocalExtractProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // Page range filter
  const [usePageRange, setUsePageRange] = useState<boolean>(false);
  const [startPageInput, setStartPageInput] = useState<string>('1');
  const [endPageInput, setEndPageInput] = useState<string>('');

  // Direct text input
  const [pastedText, setPastedText] = useState<string>('');
  const [pastedTitle, setPastedTitle] = useState<string>('Legislação Naval QOAM');

  // Drag & drop
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Generation progress
  const [progress, setProgress] = useState<ProgressState>({
    percent: 0,
    message: '',
  });

  // Helper advice modal
  const [showTipsModal, setShowTipsModal] = useState<boolean>(false);

  const formatBytes = (bytes: number): string => {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB (${kb.toFixed(0)} KB)`;
  };

  const processLocalPdf = async (file: File, start?: number, end?: number) => {
    setError(null);
    setIsExtractingLocal(true);
    setLocalExtractProgress({ current: 0, total: 1 });

    try {
      const result = await extractTextFromPdfInBrowser(file, start, end, (current, total) => {
        setLocalExtractProgress({ current, total });
      });

      setExtractedData(result);
      if (!endPageInput && result.totalPages) {
        setEndPageInput(result.totalPages.toString());
      }
      setIsExtractingLocal(false);
    } catch (err: any) {
      console.warn('Falha na extração local de texto pelo navegador:', err);
      setIsExtractingLocal(false);
      // Fallback: file is still selected and can be uploaded directly
    }
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor, selecione um arquivo no formato PDF.');
      setSelectedFile(null);
      setExtractedData(null);
      return;
    }

    setError(null);
    setSelectedFile(file);
    processLocalPdf(file);
  };

  const handleApplyPageRange = () => {
    if (!selectedFile) return;
    const start = parseInt(startPageInput, 10) || 1;
    const end = parseInt(endPageInput, 10) || (extractedData?.totalPages || 100);
    processLocalPdf(selectedFile, start, end);
  };

  const handleStartProcess = async () => {
    let contentText = '';
    let docTitle = 'Documento de Estudo';
    let docPages = 1;

    if (inputSource === 'TEXT') {
      if (!pastedText.trim() || pastedText.trim().length < 50) {
        setError('Por favor, cole um texto com pelo menos 50 caracteres para formular o simulado.');
        return;
      }
      contentText = pastedText.trim();
      docTitle = pastedTitle || 'Texto Inserido';
    } else {
      if (!selectedFile) {
        setError('Selecione um arquivo PDF antes de iniciar a análise.');
        return;
      }
      docTitle = selectedFile.name;
      docPages = extractedData?.totalPages || 1;
      if (extractedData?.text && extractedData.text.length > 80) {
        contentText = extractedData.text;
      }
    }

    try {
      setError(null);
      setStatus(AppStatus.GENERATING);
      setProgress({
        percent: 5,
        message: 'Iniciando elaboração militar inteligente...',
        fileName: docTitle,
      });

      const finalNumQuestions = Math.min(100, Math.max(5, numQuestions));

      if (mode === 'EXAM') {
        let result: Exam;
        if (contentText.length > 80) {
          result = await streamGenerateExamFromText(
            contentText,
            docTitle,
            docPages,
            finalNumQuestions,
            (state) => setProgress(state)
          );
        } else if (selectedFile) {
          result = await streamGenerateExamFromPDF(
            selectedFile,
            finalNumQuestions,
            (state) => setProgress(state)
          );
        } else {
          throw new Error('Nenhum conteúdo válido encontrado para análise.');
        }

        setExam(result);
        setStatus(AppStatus.SUCCESS_EXAM);
      } else {
        let result: MindMap;
        if (contentText.length > 80) {
          result = await streamGenerateMindMapFromText(
            contentText,
            docTitle,
            docPages,
            (state) => setProgress(state)
          );
        } else if (selectedFile) {
          result = await streamGenerateMindMapFromPDF(
            selectedFile,
            (state) => setProgress(state)
          );
        } else {
          throw new Error('Nenhum conteúdo válido encontrado para análise.');
        }

        setMindMap(result);
        setStatus(AppStatus.SUCCESS_MINDMAP);
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      let friendlyMsg = err?.message || 'Ocorreu um erro ao processar o seu documento. Tente novamente.';
      if (
        typeof friendlyMsg === 'string' &&
        (friendlyMsg.includes('429') ||
          friendlyMsg.includes('Quota exceeded') ||
          friendlyMsg.includes('RESOURCE_EXHAUSTED'))
      ) {
        friendlyMsg =
          'O limite temporário de requisições por minuto da API foi atingido. Aguarde cerca de 20 segundos e tente novamente com este documento.';
      }
      setError(friendlyMsg);
      setStatus(AppStatus.ERROR);
    }
  };

  const resetApp = () => {
    setExam(null);
    setMindMap(null);
    setSelectedFile(null);
    setExtractedData(null);
    setPastedText('');
    setStatus(AppStatus.IDLE);
    setError(null);
    setProgress({ percent: 0, message: '' });
  };

  const handleNumQuestionsChange = (num: number) => {
    setNumQuestions(num);
    setCustomNumQuestions(num.toString());
  };

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomNumQuestions(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 5 && parsed <= 100) {
      setNumQuestions(parsed);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-8">
        {(status === AppStatus.IDLE || status === AppStatus.ERROR) && (
          <div className="max-w-4xl mx-auto">
            {/* Hero Title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-900 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-blue-200">
                <i className="fa-solid fa-anchor text-yellow-600"></i> Simulação Oficial QOAM • Marinha do Brasil
              </div>
              <h2 className="text-3xl sm:text-5xl font-black navy-text tracking-tight uppercase">
                Estudo Estratégico QOAM
              </h2>
              <p className="text-base sm:text-lg text-slate-600 mt-2 max-w-2xl mx-auto">
                Transforme manuais navais, apostilas e editais em simulados com até <strong>100 questões</strong> ou mapas mentais hierárquicos.
              </p>
            </div>

            {/* Practical Advice Banner */}
            <div className="mb-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black text-lg shrink-0">
                  <i className="fa-solid fa-lightbulb"></i>
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wide">
                    Dúvida frequente: O PDF não carrega ou é muito grande (+5.000 KB)?
                  </h4>
                  <p className="text-xs text-blue-100 mt-0.5">
                    O sistema agora faz a <strong>leitura instantânea no navegador</strong> e permite <strong>selecionar apenas as páginas do edital</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTipsModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/30 text-xs font-bold px-3.5 py-2 rounded-xl transition whitespace-nowrap"
              >
                <i className="fa-solid fa-circle-info mr-1.5"></i> Dicas para Carregar Melhor
              </button>
            </div>

            {/* Main Configuration Card */}
            <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-xl border border-slate-200">
              {/* Objective Mode Toggle: Exam vs Mind Map */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => setMode('EXAM')}
                  className={`flex-1 py-3.5 px-4 rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm sm:text-base ${
                    mode === 'EXAM'
                      ? 'bg-blue-900 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-file-lines"></i>
                  <span>Simulado de Prova</span>
                  <span className="text-xs bg-yellow-400 text-slate-950 font-black px-2 py-0.5 rounded-full ml-1">
                    Até 100Q
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('MINDMAP')}
                  className={`flex-1 py-3.5 px-4 rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm sm:text-base ${
                    mode === 'MINDMAP'
                      ? 'bg-blue-900 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <i className="fa-solid fa-diagram-project"></i>
                  <span>Mapa Mental Estratégico</span>
                </button>
              </div>

              {/* Number of Questions Selector (When Exam Mode) */}
              {mode === 'EXAM' && (
                <div className="mb-6 p-5 sm:p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <label className="block text-sm font-black text-slate-900 uppercase tracking-tight">
                        Quantidade de Questões do Simulado
                      </label>
                      <p className="text-xs text-slate-500">
                        Padrão oficial do concurso QOAM com 5 alternativas (A a E) e gabarito comentado.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-blue-100 text-blue-900 px-3 py-1 rounded-lg self-start sm:self-auto">
                      Selecionado: <strong>{numQuestions} questões</strong>
                    </span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {[10, 25, 50, 75, 100].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleNumQuestionsChange(num)}
                        className={`py-2.5 px-3 rounded-xl border-2 transition font-bold text-sm flex flex-col items-center justify-center relative ${
                          numQuestions === num
                            ? 'navy-bg text-white border-blue-900 shadow-md ring-2 ring-blue-400'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                        }`}
                      >
                        {num === 100 && (
                          <span className="absolute -top-2.5 bg-yellow-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                            Oficial QOAM
                          </span>
                        )}
                        <span className="text-lg font-black">{num}</span>
                        <span className="text-[11px] opacity-80">Questões</span>
                      </button>
                    ))}
                  </div>

                  {/* Custom Number Input */}
                  <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">
                      Personalizar quantidade (5 a 100):
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="5"
                        max="100"
                        value={customNumQuestions}
                        onChange={handleCustomInput}
                        className="w-24 px-3 py-1 border-2 border-slate-300 rounded-lg text-center font-bold text-sm focus:border-blue-700 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-500">perguntas</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Source Tab Toggle: Upload PDF vs Paste Text */}
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Forma de Envio do Conteúdo:
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInputSource('PDF')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                      inputSource === 'PDF'
                        ? 'bg-blue-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <i className="fa-solid fa-file-pdf"></i> Arquivo PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputSource('TEXT')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                      inputSource === 'TEXT'
                        ? 'bg-blue-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <i className="fa-solid fa-align-left"></i> Colar Texto / Norma
                  </button>
                </div>
              </div>

              {/* PDF Input Mode */}
              {inputSource === 'PDF' && (
                <div>
                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      handleFileChange(file);
                    }}
                    className={`relative border-3 border-dashed rounded-2xl p-6 sm:p-10 text-center transition-all cursor-pointer ${
                      isDragging
                        ? 'border-blue-600 bg-blue-50/80 scale-[1.01]'
                        : selectedFile
                        ? 'border-green-500 bg-green-50/30'
                        : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => handleFileChange(e.target.files?.[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />

                    {!selectedFile ? (
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-2xl mb-3 shadow-inner">
                          <i className="fa-solid fa-cloud-arrow-up"></i>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">
                          Clique ou arraste seu arquivo PDF aqui
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-md">
                          Compatível com editais, apostilas e manuais <strong>maiores que 5.000 KB</strong>.
                        </p>
                        <div className="flex items-center gap-2 mt-3 text-xs font-semibold text-slate-500">
                          <span className="bg-slate-200/80 px-2 py-0.5 rounded">Leitura instantânea local</span>
                          <span>•</span>
                          <span className="bg-slate-200/80 px-2 py-0.5 rounded">Zero espera de upload</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center text-xl mb-2 shadow-sm">
                          <i className="fa-solid fa-file-circle-check"></i>
                        </div>
                        <h4 className="text-base font-black text-slate-900 break-all max-w-xl">
                          {selectedFile.name}
                        </h4>
                        <p className="text-xs font-mono font-semibold text-slate-600 mt-0.5">
                          Tamanho original: <strong>{formatBytes(selectedFile.size)}</strong>
                        </p>

                        {/* Local extraction feedback */}
                        {isExtractingLocal ? (
                          <div className="mt-3 w-full max-w-xs">
                            <div className="flex justify-between text-xs text-blue-900 font-bold mb-1">
                              <span>Lendo PDF no navegador...</span>
                              <span>Pág {localExtractProgress.current} de {localExtractProgress.total}</span>
                            </div>
                            <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-800 h-full rounded-full transition-all duration-150"
                                style={{
                                  width: `${Math.round(
                                    (localExtractProgress.current / Math.max(1, localExtractProgress.total)) * 100
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        ) : extractedData ? (
                          <div className="mt-3 bg-white border border-green-300 rounded-xl p-3 shadow-sm text-xs text-slate-700 max-w-md w-full">
                            <div className="flex items-center justify-between text-green-800 font-bold mb-1">
                              <span className="flex items-center gap-1.5">
                                <i className="fa-solid fa-check-circle"></i> Leitura concluída instantaneamente!
                              </span>
                              <span>{extractedData.totalPages} páginas</span>
                            </div>
                            <p className="text-slate-600 text-[11px]">
                              Conteúdo pronto para envio: <strong>{extractedData.wordCount.toLocaleString('pt-BR')} palavras</strong> extraídas.
                            </p>
                            {extractedData.isScanned && (
                              <p className="text-amber-700 mt-1 font-semibold text-[11px] bg-amber-50 p-1.5 rounded">
                                <i className="fa-solid fa-triangle-exclamation mr-1"></i> Atenção: Este PDF parece ser escaneado (imagem). Para máxima qualidade, use um PDF com texto selecionável.
                              </p>
                            )}
                          </div>
                        ) : null}

                        <p className="text-[11px] text-slate-400 mt-2">
                          Clique para trocar o arquivo PDF
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Page Range Filter Box (Solves large PDFs!) */}
                  {selectedFile && extractedData && extractedData.totalPages > 1 && (
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                          <input
                            type="checkbox"
                            checked={usePageRange}
                            onChange={(e) => setUsePageRange(e.target.checked)}
                            className="rounded text-blue-800 focus:ring-blue-700 w-4 h-4"
                          />
                          <span>
                            Deseja selecionar apenas páginas específicas deste manual? (Ex: Capítulos do edital)
                          </span>
                        </label>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Total do documento: <strong>{extractedData.totalPages} páginas</strong>
                        </span>
                      </div>

                      {usePageRange && (
                        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-600 font-semibold">Da página:</span>
                            <input
                              type="number"
                              min="1"
                              max={extractedData.totalPages}
                              value={startPageInput}
                              onChange={(e) => setStartPageInput(e.target.value)}
                              className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-center font-bold text-xs"
                            />
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-600 font-semibold">até a página:</span>
                            <input
                              type="number"
                              min="1"
                              max={extractedData.totalPages}
                              value={endPageInput}
                              onChange={(e) => setEndPageInput(e.target.value)}
                              className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-center font-bold text-xs"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleApplyPageRange}
                            className="bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                          >
                            Filtrar Páginas
                          </button>

                          {extractedData.pageRangeApplied && (
                            <span className="text-xs text-blue-900 font-bold bg-blue-100 px-2 py-0.5 rounded">
                              Intervalo ativo: páginas {extractedData.pageRangeApplied}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Direct Text Input Mode */}
              {inputSource === 'TEXT' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Título ou Assunto da Norma/Edital:
                    </label>
                    <input
                      type="text"
                      value={pastedTitle}
                      onChange={(e) => setPastedTitle(e.target.value)}
                      placeholder="Ex: Regulamento Disciplinar para a Marinha (RDM) ou DGMM-01"
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-medium text-sm focus:border-blue-700 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-700 uppercase">
                        Cole o conteúdo dos artigos, capítulos ou edital:
                      </label>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {pastedText.split(/\s+/).filter(Boolean).length} palavras
                      </span>
                    </div>
                    <textarea
                      rows={8}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Cole aqui o texto copiado de apostilas, leis, portarias ou decretos cobrados no concurso QOAM..."
                      className="w-full p-3.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-sans leading-relaxed focus:border-blue-700 focus:outline-none"
                    ></textarea>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-5 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs sm:text-sm flex items-start gap-3">
                  <i className="fa-solid fa-circle-exclamation text-red-600 text-base mt-0.5 shrink-0"></i>
                  <div>
                    <strong className="block font-bold">Aviso no Processamento:</strong>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Start Button */}
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={handleStartProcess}
                  disabled={
                    isExtractingLocal ||
                    (inputSource === 'PDF' && !selectedFile) ||
                    (inputSource === 'TEXT' && pastedText.trim().length < 50)
                  }
                  className={`w-full sm:w-auto min-w-[280px] py-4 px-10 rounded-2xl font-black text-sm sm:text-base uppercase tracking-wider transition-all transform shadow-xl flex items-center justify-center gap-3 ${
                    (inputSource === 'PDF' && selectedFile && !isExtractingLocal) ||
                    (inputSource === 'TEXT' && pastedText.trim().length >= 50)
                      ? 'bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white hover:scale-105 active:scale-95 cursor-pointer'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  }`}
                >
                  <i className={`fa-solid ${mode === 'EXAM' ? 'fa-wand-magic-sparkles' : 'fa-brain'}`}></i>
                  <span>
                    {isExtractingLocal
                      ? 'Lendo documento...'
                      : mode === 'EXAM'
                      ? `Gerar Simulado (${numQuestions} Questões)`
                      : 'Gerar Mapa Mental'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Uploading / Generating Screen with Live SSE Progress */}
        {(status === AppStatus.UPLOADING || status === AppStatus.GENERATING) && (
          <div className="max-w-2xl mx-auto text-center py-16 px-4">
            <div className="relative inline-block mb-8">
              <div className="w-24 h-24 border-6 border-blue-200 border-t-blue-900 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className={`fa-solid ${mode === 'EXAM' ? 'fa-anchor' : 'fa-brain'} text-blue-900 text-3xl`}></i>
              </div>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black navy-text uppercase tracking-tight">
              {mode === 'EXAM' ? `Elaborando Simulado de ${numQuestions} Questões` : 'Construindo Mapa Mental'}
            </h3>

            <p className="text-slate-600 mt-2 text-sm sm:text-base max-w-md mx-auto">
              {progress.message || 'Processando conteúdo com rigor técnico naval...'}
            </p>

            {/* Progress Bar Container */}
            <div className="mt-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
                <span>Progresso da Elaboração</span>
                <span className="text-blue-900 font-mono text-sm">{progress.percent}%</span>
              </div>
              <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-700 via-indigo-700 to-yellow-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, progress.percent)}%` }}
                ></div>
              </div>

              {/* Progress Detail Stats */}
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {progress.fileName && (
                  <div className="text-left col-span-2 sm:col-span-1">
                    <span className="text-slate-400 block">Documento:</span>
                    <strong className="text-slate-700 truncate block">{progress.fileName}</strong>
                  </div>
                )}
                {mode === 'EXAM' && progress.totalBatches && (
                  <div>
                    <span className="text-slate-400 block">Lote de Execução:</span>
                    <strong className="text-blue-800">
                      {progress.batch || 1} de {progress.totalBatches}
                    </strong>
                  </div>
                )}
                {mode === 'EXAM' && (
                  <div>
                    <span className="text-slate-400 block">Questões Prontas:</span>
                    <strong className="text-green-700">
                      {progress.currentQuestions || 0} / {numQuestions}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-6 italic">
              * A IA processa em lotes com tolerância automática a sobrecargas momentâneas para garantir gabarito comentado fundamentado em cada questão.
            </p>
          </div>
        )}

        {/* Success States */}
        {status === AppStatus.SUCCESS_EXAM && exam && (
          <ExamView exam={exam} onReset={resetApp} />
        )}

        {status === AppStatus.SUCCESS_MINDMAP && mindMap && (
          <MindMapView mindMap={mindMap} onReset={resetApp} />
        )}
      </main>

      {/* Helpful Tips Modal */}
      {showTipsModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-black navy-text uppercase flex items-center gap-2">
                <i className="fa-solid fa-lightbulb text-yellow-500"></i> Dicas para Carregar PDFs Grandes
              </h3>
              <button
                type="button"
                onClick={() => setShowTipsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs sm:text-sm text-slate-600">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <strong className="text-blue-900 block font-bold mb-1">
                  1. Diminuir o PDF ajuda?
                </strong>
                <p>
                  <strong>Sim, com certeza!</strong> Manuais militares de 300 ou 500 páginas contêm muitas páginas desnecessárias (capas, fotos pesadas, anexos técnicos). Ao focar nas páginas solicitadas pelo edital, o simulado fica muito mais específico e assertivo.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong className="text-slate-900 block font-bold mb-1">
                  2. Use o Filtro de Páginas do próprio App:
                </strong>
                <p>
                  Ao selecionar o PDF, ative o seletor <em>"Deseja selecionar apenas páginas específicas?"</em> e defina, por exemplo, <strong>da página 15 até 60</strong>. O aplicativo lê apenas essas páginas instantaneamente, sem que você precise editar o arquivo fora daqui.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong className="text-slate-900 block font-bold mb-1">
                  3. Como diminuir um PDF externamente (em segundos):
                </strong>
                <ul className="list-disc pl-4 space-y-1 mt-1">
                  <li>
                    No seu computador, abra o PDF no navegador (Chrome/Edge), clique em <strong>Imprimir</strong>, escolha a impressora <strong>Salvar como PDF</strong> e digite o intervalo de páginas (ex: 20-50).
                  </li>
                  <li>
                    Ou use ferramentas gratuitas como <em>iLovePDF</em> ou <em>Smallpdf</em> selecionando a opção <strong>Dividir PDF</strong>.
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                <strong className="text-green-900 block font-bold mb-1">
                  4. Alternativa direta: Aba "Colar Texto":
                </strong>
                <p>
                  Se preferir, você pode copiar o texto da portaria ou edital e colar diretamente na aba <strong>Colar Texto / Norma</strong> para gerar as questões imediatamente!
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTipsModal(false)}
                className="bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-wider"
              >
                Entendi, continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-slate-900 text-slate-400 py-6 text-center text-xs border-t border-slate-800 no-print">
        <p className="font-bold tracking-widest text-slate-300 uppercase">
          ADSUMUS • Preparação Avançada para Oficiais da Marinha do Brasil (QOAM)
        </p>
        <p className="text-slate-500 mt-1">
          Leitura instantânea de PDFs densos no navegador e geração de simulados oficiais completos de até 100 questões.
        </p>
      </footer>
    </div>
  );
};

export default App;
