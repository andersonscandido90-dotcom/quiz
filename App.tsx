
import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import ExamView from './components/ExamView';
import { generateExamFromPDF } from './services/geminiService';
import { Exam, AppStatus } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [exam, setExam] = useState<Exam | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numQuestions, setNumQuestions] = useState<number>(10);

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
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
      const generatedExam = await generateExamFromPDF(base64, numQuestions);
      
      setExam(generatedExam);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      console.error(err);
      setError('Ocorreu um erro ao processar o seu documento. Certifique-se de que o PDF não está protegido por senha.');
      setStatus(AppStatus.ERROR);
    }
  };

  const resetApp = () => {
    setExam(null);
    setStatus(AppStatus.IDLE);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        {status === AppStatus.IDLE || status === AppStatus.ERROR ? (
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-10">
              <h2 className="text-4xl font-extrabold navy-text mb-4 uppercase tracking-tighter">
                Transforme Conhecimento em Aprovação
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Envie o PDF do seu edital, manuais ou notas de aula e gere simulados automáticos 
                no padrão rigoroso da <span className="font-bold navy-text">Marinha do Brasil (QOAM)</span>.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantidade de Questões
                </label>
                <div className="flex justify-center space-x-4">
                  {[5, 10, 20].map((num) => (
                    <button
                      key={num}
                      onClick={() => setNumQuestions(num)}
                      className={`px-4 py-2 rounded-lg border-2 transition ${
                        numQuestions === num 
                          ? 'border-blue-700 navy-bg text-white' 
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {num} Questões
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative group cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-3 border-dashed border-gray-300 group-hover:border-blue-500 rounded-xl p-12 transition-all flex flex-col items-center">
                  <div className="bg-blue-50 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <i className="fa-solid fa-file-pdf text-4xl text-red-500"></i>
                  </div>
                  <p className="text-lg font-bold text-gray-700">Clique para selecionar seu PDF</p>
                  <p className="text-sm text-gray-400 mt-1">ou arraste e solte o arquivo aqui</p>
                </div>
              </div>

              {error && (
                <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm flex items-center">
                  <i className="fa-solid fa-circle-exclamation mr-3 text-lg"></i>
                  {error}
                </div>
              )}
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="bg-white p-5 rounded-lg shadow-sm">
                <i className="fa-solid fa-brain text-blue-600 mb-3 text-xl"></i>
                <h4 className="font-bold text-gray-800">IA Especialista</h4>
                <p className="text-xs text-gray-500">Treinada nos padrões da Marinha para gerar questões complexas e técnicas.</p>
              </div>
              <div className="bg-white p-5 rounded-lg shadow-sm">
                <i className="fa-solid fa-list-check text-blue-600 mb-3 text-xl"></i>
                <h4 className="font-bold text-gray-800">Gabarito Comentado</h4>
                <p className="text-xs text-gray-500">Não apenas a resposta, mas o porquê dela baseada diretamente no seu texto.</p>
              </div>
              <div className="bg-white p-5 rounded-lg shadow-sm">
                <i className="fa-solid fa-print text-blue-600 mb-3 text-xl"></i>
                <h4 className="font-bold text-gray-800">Pronto para Imprimir</h4>
                <p className="text-xs text-gray-500">Formatação otimizada para estudo digital ou impressão física.</p>
              </div>
            </div>
          </div>
        ) : status === AppStatus.UPLOADING || status === AppStatus.GENERATING ? (
          <div className="max-w-md mx-auto text-center py-20">
            <div className="relative inline-block mb-8">
              <div className="w-24 h-24 border-8 border-gray-200 border-t-blue-700 rounded-full animate-spin"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                 <i className="fa-solid fa-anchor text-2xl navy-text opacity-50"></i>
              </div>
            </div>
            <h3 className="text-2xl font-bold navy-text mb-2">
              {status === AppStatus.UPLOADING ? 'Preparando Documento...' : 'Gerando Questões QOAM...'}
            </h3>
            <p className="text-gray-500 animate-pulse">
              {status === AppStatus.UPLOADING 
                ? 'Lendo bytes e validando PDF.' 
                : 'Nossa IA está analisando o conteúdo e formatando as questões conforme o padrão da MB.'}
            </p>
          </div>
        ) : exam ? (
          <ExamView exam={exam} onReset={resetApp} />
        ) : null}
      </main>

      <footer className="bg-gray-800 text-gray-400 py-6 text-center text-sm no-print">
        <div className="container mx-auto px-4">
          <p>© {new Date().getFullYear()} Simulador QOAM - Desenvolvido para Excelência Militar.</p>
          <p className="mt-1 opacity-50">Este sistema não possui vínculo oficial com a Marinha do Brasil.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
