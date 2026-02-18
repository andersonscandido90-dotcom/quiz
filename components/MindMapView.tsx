
import React from 'react';
import { MindMap, MindMapNode } from '../types';

interface MindMapViewProps {
  mindMap: MindMap;
  onReset: () => void;
}

const Node: React.FC<{ node: MindMapNode; level: number }> = ({ node, level }) => {
  const isRoot = level === 0;
  const isBranch = level === 1;
  
  return (
    <div className={`flex flex-col items-center ${isRoot ? 'w-full' : 'mt-4'}`}>
      <div 
        className={`
          p-4 rounded-xl shadow-md border-2 transition-all hover:scale-105
          ${isRoot ? 'bg-blue-900 text-white border-yellow-500 min-w-[250px] text-center' : 
            isBranch ? 'bg-white border-blue-900 navy-text font-bold min-w-[200px]' : 
            'bg-gray-50 border-gray-200 text-sm text-gray-700 max-w-[180px]'}
        `}
      >
        <p className={isRoot ? 'text-xl font-bold uppercase tracking-widest' : ''}>{node.text}</p>
        {node.description && <p className="text-xs mt-1 opacity-75 font-normal italic">{node.description}</p>}
      </div>

      {node.children && node.children.length > 0 && (
        <div className="flex flex-wrap justify-center gap-6 mt-6 relative">
          {/* Vertical line connecting to children */}
          <div className="absolute top-[-24px] left-1/2 w-0.5 h-6 bg-gray-300 no-print"></div>
          
          {node.children.map((child) => (
            <Node key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const MindMapView: React.FC<MindMapViewProps> = ({ mindMap, onReset }) => {
  const handlePrintPDF = () => {
    window.print();
  };

  const generateHierarchyHTML = (node: MindMapNode, level: number): string => {
    const headingLevel = Math.min(level + 1, 6);
    let html = `<h${headingLevel}>${node.text}</h${headingLevel}>`;
    if (node.description) {
      html += `<p><i>${node.description}</i></p>`;
    }
    if (node.children && node.children.length > 0) {
      html += '<ul>';
      node.children.forEach(child => {
        html += `<li>${generateHierarchyHTML(child, level + 1)}</li>`;
      });
      html += '</ul>';
    }
    return html;
  };

  const handleExportLibreOffice = () => {
    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${mindMap.title}</title>
      <style>
        body { font-family: 'Arial', sans-serif; }
        h1 { color: #002147; text-transform: uppercase; border-bottom: 2px solid #D4AF37; }
        h2 { color: #002147; margin-top: 20px; }
        p { color: #666; }
        ul { list-style-type: square; }
      </style>
      </head>
      <body>
        <h1>${mindMap.title}</h1>
        <p>Gerado pelo Simulador QOAM em ${new Date(mindMap.createdAt).toLocaleDateString()}</p>
        <hr>
        ${generateHierarchyHTML(mindMap.root, 0)}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', content], {
      type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mapa_Mental_${mindMap.title.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full py-8 px-4">
      <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row gap-4 justify-between items-center no-print">
        <h2 className="text-2xl font-bold navy-text uppercase tracking-tighter">
          <i className="fa-solid fa-diagram-project mr-3"></i>
          Mapa Mental Estratégico
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          <button 
            onClick={handlePrintPDF} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition flex items-center shadow-sm"
            title="Salvar como PDF via sistema de impressão"
          >
            <i className="fa-solid fa-file-pdf mr-2"></i> Exportar PDF
          </button>
          <button 
            onClick={handleExportLibreOffice} 
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition flex items-center shadow-sm"
            title="Exportar estrutura para LibreOffice Writer ou Word"
          >
            <i className="fa-solid fa-file-word mr-2"></i> Exportar LibreOffice
          </button>
          <button 
            onClick={onReset} 
            className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-md transition border border-red-100"
          >
            Voltar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-12 shadow-inner border border-gray-100 overflow-x-auto min-h-[600px] flex items-start justify-center">
        <div className="min-w-max">
          <Node node={mindMap.root} level={0} />
        </div>
      </div>
      
      <div className="mt-8 text-center text-gray-400 text-xs no-print italic flex flex-col gap-1">
        <p>* Este mapa foi gerado automaticamente analisando os pontos-chave do seu documento.</p>
        <p>** Dica: Ao exportar para LibreOffice, o arquivo virá formatado com Títulos e Listas para facilitar sua edição.</p>
      </div>

      {/* Estilos específicos para impressão do Mapa Mental */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .min-h-[600px] { border: none !important; box-shadow: none !important; padding: 0 !important; }
          .min-w-max { width: 100% !important; transform: scale(0.8); transform-origin: top center; }
          @page { size: landscape; margin: 1cm; }
        }
      `}} />
    </div>
  );
};

export default MindMapView;
