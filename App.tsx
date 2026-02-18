
import React, { useState } from 'react';
import Header from './components/Header';
import ExamView from './components/ExamView';
import MindMapView from './components/MindMapView';
import { generateExamFromPDF, generateMindMapFromPDF } from './services/geminiService';
import { Exam, MindMap, AppStatus, GenerationMode } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [exam, setExam] = useState<Exam | null>(null);
  const [mindMap, setMindMap] = useState<MindMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [mode, setMode] = useState<GenerationMode>('EXAM');

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Por favor, envie um arquivo PDF válido.');
      return;
    }

    try {
      setStatus(AppStatus.UPLOADING);
      setError(null);
      const base64 = await convertToBase64(file);
      setStatus(AppStatus.GENERATING);

      if (mode === 'EXAM') {
        const result = await generateExamFromPDF(base64, numQuestions);
        setExam(result);
        setStatus(AppStatus.SUCCESS_EXAM);
      } else {
        const result = await generateMindMapFromPDF(base64);
        setMindMap(result);
        setStatus(AppStatus.SUCCESS_MINDMAP);
      }
    } catch (err: any) {
      setError('Ocorreu um erro ao processar o seu documento. Tente novamente.');
      setStatus(AppStatus.ERROR);
    }
  };

  const resetApp = () => {
    setExam(null);
    setMindMap(null);
    setStatus(AppStatus.IDLE);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        {(status === AppStatus.IDLE || status === AppStatus.ERROR) && (
          <div className="max-w-3xl mx-auto text-center">
            <div className="mb-8">
              <h2 className="text-4xl font-extrabold navy-text mb-4 uppercase tracking-tighter">
                Estudo Inteligente QOAM
              </h2>
              <p className="text-lg text-gray-600">
                Transforme manuais e editais em ferramentas de aprovação instantâneas.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
              <div className="flex bg-gray-100 p-1 rounded-xl mb-8">
                <button 
                  onClick={() => setMode('EXAM')}
                  className={`flex-1 py-3 px-4 rounded-lg font-bold transition flex items-center justify-center ${mode === 'EXAM' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <i className="fa-solid fa-file-lines mr-2"></i> Simulado
                </button>
                <button 
                  onClick={() => setMode('MINDMAP')}
                  className={`flex-1 py-3 px-4 rounded-lg font-bold transition flex items-center justify-center ${mode === 'MINDMAP' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <i className="fa-solid fa-diagram-project mr-2"></i> Mapa Mental
                </button>
              </div>

              {mode === 'EXAM' && (
                <div className="mb-6 animate-fadeIn">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Quantidade de Questões</label>
                  <div className="flex justify-center space-x-2">
                    {[5, 10, 15].map(num => (
                      <button 
                        key={num} onClick={() => setNumQuestions(num)}
                        className={`w-20 py-2 rounded-lg border-2 transition ${numQuestions === num ? 'navy-bg text-white border-blue-900' : 'bg-white text-gray-600 border-gray-200'}`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative group">
                <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="border-3 border-dashed border-gray-200 group-hover:border-blue-500 group-hover:bg-blue-50 rounded-2xl p-16 transition-all flex flex-col items-center">
                  <div className={`p-5 rounded-full mb-4 transition-all group-hover:scale-110 ${mode === 'EXAM' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                    <i className={`fa-solid ${mode === 'EXAM' ? 'fa-upload' : 'fa-wand-magic-sparkles'} text-4xl`}></i>
                  </div>
                  <p className="text-xl font-bold text-gray-700">Clique para iniciar a análise</p>
                  <p className="text-sm text-gray-400 mt-2">Formatos aceitos: PDF</p>
                </div>
              </div>

              {error && <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium">{error}</div>}
            </div>
          </div>
        )}

        {(status === AppStatus.UPLOADING || status === AppStatus.GENERATING) && (
          <div className="max-w-md mx-auto text-center py-24">
            <div className="relative inline-block mb-8">
              <div className="w-20 h-20 border-6 border-blue-100 border-t-blue-800 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <i className={`fa-solid ${mode === 'EXAM' ? 'fa-anchor' : 'fa-brain'} text-blue-800 opacity-20 text-2xl`}></i>
              </div>
            </div>
            <h3 className="text-2xl font-bold navy-text">{status === AppStatus.UPLOADING ? 'Preparando arquivo...' : 'Processando IA...'}</h3>
            <p className="text-gray-500 mt-2">
              {mode === 'EXAM' ? 'Estamos elaborando questões de alto nível.' : 'Estamos estruturando a hierarquia do mapa mental.'}
            </p>
          </div>
        )}

        {status === AppStatus.SUCCESS_EXAM && exam && <ExamView exam={exam} onReset={resetApp} />}
        {status === AppStatus.SUCCESS_MINDMAP && mindMap && <MindMapView mindMap={mindMap} onReset={resetApp} />}
      </main>

      <footer className="bg-gray-800 text-gray-500 py-6 text-center text-xs no-print">
        ADSUMUS - Preparação Avançada Marinha do Brasil
      </footer>
    </div>
  );
};

export default App;
