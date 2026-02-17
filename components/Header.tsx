
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="navy-bg text-white py-6 px-4 shadow-lg border-b-4 border-yellow-500 no-print">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="bg-white p-2 rounded-full">
            <i className="fa-solid fa-anchor text-3xl navy-text"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider uppercase">Marinha do Brasil</h1>
            <p className="text-sm font-light text-blue-200">Simulador de Provas QOAM Inteligente</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 text-right hidden md:block">
          <p className="text-xs font-mono uppercase opacity-75">Sistema de Preparação de Oficiais</p>
          <p className="text-lg font-bold gold-text">ADSUMUS</p>
        </div>
      </div>
    </header>
  );
};

export default Header;
