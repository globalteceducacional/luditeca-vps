import React, { useState } from 'react';
import { 
  FiPlay, 
  FiCopy, 
  FiChevronUp, 
  FiChevronDown, 
  FiTrash2, 
  FiRotateCw, 
  FiRefreshCw,
  FiMaximize2,
  FiMoreVertical,
  FiLock,
  FiUnlock
} from 'react-icons/fi';

const ImageElementControls = ({
  element,
  onPlayAnimation,
  handleElementChange,
  onDuplicateElement,
  onMoveForward,
  onMoveBackward,
  onRemoveElement,
  onImageRotate,
  onImageFlip
}) => {
  const [showSecondaryMenu, setShowSecondaryMenu] = useState(false);

  return (
    <>
      {/* Menu Principal - Controles de Imagem */}
      <div className="absolute -top-12 left-0 flex space-x-1 z-50 bg-white/90 rounded-full p-1 shadow-sm">
        {/* Lock/Unlock */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleElementChange(element.id, { 
              isLocked: !element.isLocked 
            });
          }}
          className={`p-1 rounded-full transition-all duration-200 ${
            element.isLocked 
              ? 'bg-red-100 hover:bg-red-200 text-red-600' 
              : 'hover:bg-blue-100 text-blue-600'
          }`}
          title={element.isLocked ? "Desbloquear elemento" : "Bloquear elemento"}
        >
          {element.isLocked ? (
            <FiLock size={14} />
          ) : (
            <FiUnlock size={14} />
          )}
        </button>

        {/* Play Animation */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onPlayAnimation(element.id, element.animation);
          }} 
          title="Testar animação"
          className="p-1 rounded-full hover:bg-green-100"
        >
          <FiPlay className="text-green-600 hover:text-green-800" size={14} />
        </button>

        {/* Rotate */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onImageRotate(element.id);
          }}
          className="p-1 rounded-full hover:bg-blue-100"
          title="Rotacionar"
        >
          <FiRotateCw className="text-blue-600 hover:text-blue-800" size={14} />
        </button>

        {/* Flip Horizontal */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onImageFlip(element.id, 'horizontal');
          }}
          className="p-1 rounded-full hover:bg-blue-100"
          title="Espelhar horizontalmente"
        >
          <FiMaximize2 className="text-blue-600 hover:text-blue-800 transform rotate-90" size={14} />
        </button>

        {/* Object Fit */}
        <select
          value={element.imageStyle?.objectFit || 'contain'}
          onChange={(e) => {
            e.stopPropagation();
            handleElementChange(element.id, {
              imageStyle: {
                ...element.imageStyle,
                objectFit: e.target.value
              }
            });
          }}
          className="p-1 rounded-full hover:bg-blue-100 text-sm"
        >
          <option value="contain">Conter</option>
          <option value="cover">Cobrir</option>
          <option value="fill">Preencher</option>
        </select>

        {/* Border Radius */}
        <input
          type="number"
          value={element.imageStyle?.borderRadius || 0}
          onChange={(e) => {
            e.stopPropagation();
            handleElementChange(element.id, {
              imageStyle: {
                ...element.imageStyle,
                borderRadius: parseInt(e.target.value)
              }
            });
          }}
          className="w-16 p-1 rounded-full text-sm"
          placeholder="Raio"
          title="Raio da borda"
          min="0"
          max="50"
        />

        {/* Botão do Menu Secundário */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSecondaryMenu(!showSecondaryMenu);
            }}
            className="p-1 rounded-full hover:bg-gray-100"
            title="Mais opções"
          >
            <FiMoreVertical className="text-gray-600 hover:text-gray-800" size={14} />
          </button>

          {/* Menu Secundário Vertical */}
          {showSecondaryMenu && (
            <div 
              className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg py-1 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateElement(element.id);
                  setShowSecondaryMenu(false);
                }} 
                className="w-full px-3 py-1 text-left hover:bg-blue-50 flex items-center space-x-2"
              >
                <FiCopy size={14} />
                <span>Duplicar</span>
              </button>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveForward(element.id);
                  setShowSecondaryMenu(false);
                }} 
                className="w-full px-3 py-1 text-left hover:bg-blue-50 flex items-center space-x-2"
              >
                <FiChevronUp size={14} />
              </button>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveBackward(element.id);
                  setShowSecondaryMenu(false);
                }} 
                className="w-full px-3 py-1 text-left hover:bg-blue-50 flex items-center space-x-2"
              >
                <FiChevronDown size={14} />
              </button>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveElement(element.id);
                  setShowSecondaryMenu(false);
                }} 
                className="w-full px-3 py-1 text-left hover:bg-red-50 flex items-center space-x-2 text-red-600"
              >
                <FiTrash2 size={14} />
                <span>Remover</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ImageElementControls; 