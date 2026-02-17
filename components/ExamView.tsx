
import React, { useState } from 'react';
import { Exam, Question } from '../types';

interface ExamViewProps {
  exam: Exam;
  onReset: () => void;
}

const ExamView: React.FC<ExamViewProps> = ({ exam, onReset }) => {
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);

  const handleOptionChange = (questionId: number, label: string) => {
    if (showResults) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: label }));
  };

  const calculateScore = () => {
    let score = 0;
    exam.questions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswer) score++;
    });
    return score;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Print Header */}
      <div className="print-only mb-8 text-center border-b-2 border-black pb-4">
        <h1 className="text-2xl font-bold uppercase">Marinha do Brasil</h1>
        <h2 className="text-xl">Simulado de Concurso - QOAM</h2>
        <p className="text-sm mt-2">Assunto: {exam.category || 'Conhecimentos Militares'}</p>
        <p className="text-sm italic">Data: {new Date(exam.createdAt).toLocaleDateString()}</p>
      </div>

      <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200 no-print">
        <div className="p-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold navy-text uppercase">{exam.title}</h2>
            <p className="text-gray-500">{exam.category} • {exam.questions.length} Questões</p>
          </div>
          <div className="flex space-x-2">
             <button 
              onClick={handlePrint}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md transition flex items-center"
            >
              <i className="fa-solid fa-print mr-2"></i> Imprimir
            </button>
            <button 
              onClick={onReset}
              className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-md transition"
            >
              Novo Simulado
            </button>
          </div>
        </div>

        {showResults && (
          <div className="p-6 bg-blue-50 border-b border-blue-200 text-center">
            <h3 className="text-xl font-bold navy-text">Resultado do Simulado</h3>
            <div className="mt-2 text-4xl font-extrabold text-blue-700">
              {calculateScore()} / {exam.questions.length}
            </div>
            <p className="mt-1 text-blue-600 font-medium">
              Aproveitamento: {((calculateScore() / exam.questions.length) * 100).toFixed(1)}%
            </p>
          </div>
        )}

        <div className="p-6 space-y-8">
          {exam.questions.map((q, index) => (
            <div key={q.id} className="border-b border-gray-100 pb-8 last:border-0">
              <div className="flex items-start mb-4">
                <span className="bg-navy-700 navy-bg text-white font-bold rounded-md px-3 py-1 mr-4">
                  {index + 1}
                </span>
                <p className="text-lg text-gray-800 font-medium leading-relaxed">
                  {q.statement}
                </p>
              </div>

              <div className="ml-12 space-y-3">
                {q.options.map((opt) => {
                  const isSelected = userAnswers[q.id] === opt.label;
                  const isCorrect = opt.label === q.correctAnswer;
                  const showCorrectStatus = showResults && isCorrect;
                  const showWrongStatus = showResults && isSelected && !isCorrect;

                  return (
                    <label 
                      key={opt.label}
                      className={`
                        flex items-start p-3 rounded-lg border-2 cursor-pointer transition
                        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}
                        ${showCorrectStatus ? 'border-green-500 bg-green-50' : ''}
                        ${showWrongStatus ? 'border-red-500 bg-red-50' : ''}
                      `}
                    >
                      <input 
                        type="radio" 
                        name={`question-${q.id}`} 
                        className="mt-1 h-4 w-4 text-blue-600"
                        checked={isSelected}
                        onChange={() => handleOptionChange(q.id, opt.label)}
                        disabled={showResults}
                      />
                      <span className="ml-3 font-bold mr-2">{opt.label})</span>
                      <span className="text-gray-700">{opt.text}</span>
                      {showCorrectStatus && <i className="fa-solid fa-check text-green-600 ml-auto mt-1"></i>}
                      {showWrongStatus && <i className="fa-solid fa-xmark text-red-600 ml-auto mt-1"></i>}
                    </label>
                  );
                })}
              </div>

              {showResults && (
                <div className="mt-4 ml-12 p-4 bg-gray-50 rounded-lg border-l-4 border-yellow-500">
                  <p className="text-sm font-bold navy-text mb-1 uppercase tracking-tight">Gabarito Comentado:</p>
                  <p className="text-sm text-gray-600 italic leading-relaxed">
                    {q.explanation}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-center">
          {!showResults ? (
            <button 
              onClick={() => setShowResults(true)}
              className="bg-blue-700 navy-bg hover:bg-blue-800 text-white font-bold py-3 px-10 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 uppercase tracking-widest"
              disabled={Object.keys(userAnswers).length === 0}
            >
              Corrigir Simulado
            </button>
          ) : (
            <button 
              onClick={() => {
                setShowResults(false);
                setUserAnswers({});
              }}
              className="text-blue-700 font-bold hover:underline"
            >
              Refazer este simulado
            </button>
          )}
        </div>
      </div>

      {/* Print View Questions */}
      <div className="print-only">
        {exam.questions.map((q, index) => (
          <div key={q.id} className="mb-6 avoid-break">
            <p className="font-bold mb-2">{index + 1}. {q.statement}</p>
            <div className="ml-4 space-y-1">
              {q.options.map(opt => (
                <p key={opt.label}>({opt.label}) {opt.text}</p>
              ))}
            </div>
          </div>
        ))}
        
        <div className="print-break"></div>
        <div className="mt-10 border-t-2 border-black pt-4">
          <h3 className="font-bold uppercase text-center mb-4">Gabarito</h3>
          <div className="grid grid-cols-5 gap-2">
            {exam.questions.map((q, index) => (
              <p key={q.id} className="text-sm">{index + 1}: ({q.correctAnswer})</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamView;
