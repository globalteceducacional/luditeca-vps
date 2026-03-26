import React from 'react';
import { FiEye, FiEyeOff, FiLock, FiUnlock, FiChevronUp, FiChevronDown, FiType, FiImage, FiMusic } from 'react-icons/fi';

const LayerManager = ({
  elements,
  selectedElement,
  onElementSelect,
  onMoveForward,
  onMoveBackward,
  onToggleVisibility,
  onLockElement
}) => {
  // Ordenar elementos por zIndex
  const sortedElements = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

  // Função para renderizar o ícone do elemento
  const renderElementIcon = (type) => {
    switch (type) {
      case 'text':
        return <FiType className="w-4 h-4" />;
      case 'image':
        return <FiImage className="w-4 h-4" />;
      case 'audio':
        return <FiMusic className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full bg-gray-800 text-white flex flex-col">
      {/* Cabeçalho */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold">Camadas ({elements.length})</h3>
      </div>

      {/* Lista de camadas */}
      <div className="flex-1 overflow-y-auto">
        {sortedElements.map((element) => (
          <div
            key={element.id}
            className={`p-3 border-b border-gray-700 hover:bg-gray-700 cursor-pointer ${
              selectedElement === element.id ? 'bg-blue-600' : ''
            }`}
            onClick={() => onElementSelect(element.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {renderElementIcon(element.type)}
                <span className="text-sm truncate">
                  {element.type === 'text' 
                    ? element.content?.substring(0, 20) + (element.content?.length > 20 ? '...' : '')
                    : element.type === 'image'
                    ? 'Imagem'
                    : 'Áudio'}
                </span>
              </div>
              
              <div className="flex items-center space-x-1">
                {/* Botão de visibilidade */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(element.id);
                  }}
                  className="p-1 hover:bg-gray-600 rounded"
                  title={element.isVisible ? 'Ocultar' : 'Mostrar'}
                >
                  {element.isVisible ? <FiEye className="w-4 h-4" /> : <FiEyeOff className="w-4 h-4" />}
                </button>

                {/* Botão de bloqueio */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLockElement(element.id);
                  }}
                  className="p-1 hover:bg-gray-600 rounded"
                  title={element.isLocked ? 'Desbloquear' : 'Bloquear'}
                >
                  {element.isLocked ? <FiLock className="w-4 h-4" /> : <FiUnlock className="w-4 h-4" />}
                </button>

                {/* Botões de ordem */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveForward(element.id);
                  }}
                  className="p-1 hover:bg-gray-600 rounded"
                  title="Mover para frente"
                >
                  <FiChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveBackward(element.id);
                  }}
                  className="p-1 hover:bg-gray-600 rounded"
                  title="Mover para trás"
                >
                  <FiChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LayerManager; 