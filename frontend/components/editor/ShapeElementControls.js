import React from 'react';
import { FiPlay, FiCopy, FiChevronUp, FiChevronDown, FiTrash2, FiRotateCw, FiRotateCcw, FiRefreshCw } from 'react-icons/fi';

const ShapeElementControls = ({
  element,
  onPlayAnimation,
  handleElementChange,
  onDuplicateElement,
  onMoveForward,
  onMoveBackward,
  onRemoveElement
}) => {
  const handleFillColorChange = (color) => {
    handleElementChange(element.id, { 
      shapeProperties: { 
        ...element.shapeProperties,
        fill: color 
      } 
    });
  };

  const handleBorderColorChange = (color) => {
    handleElementChange(element.id, { 
      shapeProperties: { 
        ...element.shapeProperties,
        borderColor: color 
      } 
    });
  };

  const handleBorderWidthChange = (width) => {
    handleElementChange(element.id, { 
      shapeProperties: { 
        ...element.shapeProperties,
        borderWidth: parseInt(width) 
      } 
    });
  };
  
  const handleRotate = (direction) => {
    const currentRotation = element.shapeProperties?.rotation || 0;
    const step = 45; // Rotação em incrementos de 45 graus
    
    let newRotation;
    if (direction === 'clockwise') {
      newRotation = (currentRotation + step) % 360;
    } else {
      newRotation = (currentRotation - step + 360) % 360;
    }
    
    handleElementChange(element.id, { 
      shapeProperties: { 
        ...element.shapeProperties,
        rotation: newRotation 
      } 
    });
  };
  
  const handleFlip = () => {
    const currentFlipX = element.shapeProperties?.flipX || false;
    
    handleElementChange(element.id, { 
      shapeProperties: { 
        ...element.shapeProperties,
        flipX: !currentFlipX 
      } 
    });
  };
  
  // Verificar se é um balão que pode ser rotacionado e invertido
  const isRotatableShape = 
    element.shapeProperties?.type === 'speechBubbleLeft' || 
    element.shapeProperties?.type === 'ovalBubble';

  return (
    <div className="flex flex-col space-y-1 p-2 bg-white rounded shadow-lg absolute -top-36 left-0 z-50">
      <div className="flex space-x-1">
        <button
          onClick={() => onPlayAnimation(element.id, element.animation)}
          className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          title="Reproduzir animação"
        >
          <FiPlay size={12} />
        </button>
        
        <button
          onClick={() => onMoveForward(element.id)}
          className="p-1 bg-gray-600 text-white rounded hover:bg-gray-700"
          title="Mover para frente"
        >
          <FiChevronUp size={12} />
        </button>
        
        <button
          onClick={() => onMoveBackward(element.id)}
          className="p-1 bg-gray-600 text-white rounded hover:bg-gray-700"
          title="Mover para trás"
        >
          <FiChevronDown size={12} />
        </button>
        
        <button
          onClick={() => onDuplicateElement(element.id)}
          className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          title="Duplicar"
        >
          <FiCopy size={12} />
        </button>
        
        <button
          onClick={() => onRemoveElement(element.id)}
          className="p-1 bg-red-600 text-white rounded hover:bg-red-700"
          title="Remover"
        >
          <FiTrash2 size={12} />
        </button>
      </div>
      
      <div className="flex space-x-1 items-center">
        <label className="text-xs text-gray-700">Cor:</label>
        <input
          type="color"
          value={element.shapeProperties?.fill || '#fcfdff'}
          onChange={(e) => handleFillColorChange(e.target.value)}
          className="w-6 h-6 p-0 border-0"
        />
      </div>
      
      <div className="flex space-x-1 items-center">
        <label className="text-xs text-gray-700">Borda:</label>
        <input
          type="color"
          value={element.shapeProperties?.borderColor || '#0d0d0d'}
          onChange={(e) => handleBorderColorChange(e.target.value)}
          className="w-6 h-6 p-0 border-0"
        />
        <input
          type="number"
          min="0"
          max="10"
          value={element.shapeProperties?.borderWidth || 2}
          onChange={(e) => handleBorderWidthChange(e.target.value)}
          className="w-10 h-6 p-0 text-xs border border-gray-300 rounded"
        />
      </div>
      
      {/* Botões de rotação e inversão para balões */}
      {isRotatableShape && (
        <div className="flex flex-col space-y-1 pt-1 border-t border-gray-200">
          <div className="flex space-x-1 items-center">
            <label className="text-xs text-gray-700 flex items-center mr-2">Rotação:</label>
            <div className="flex space-x-1">
              <button
                onClick={() => handleRotate('counterclockwise')}
                className="p-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                title="Girar no sentido anti-horário"
              >
                <FiRotateCcw size={12} />
              </button>
              <button
                onClick={() => handleRotate('clockwise')}
                className="p-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                title="Girar no sentido horário"
              >
                <FiRotateCw size={12} />
              </button>
              <span className="text-xs text-gray-700 flex items-center ml-1">
                {element.shapeProperties?.rotation || 0}°
              </span>
            </div>
          </div>
          
          <div className="flex space-x-1 items-center">
            <label className="text-xs text-gray-700 flex items-center mr-2">Inverter:</label>
            <button
              onClick={handleFlip}
              className={`p-1 ${element.shapeProperties?.flipX ? 'bg-blue-200 text-blue-700' : 'bg-gray-200 text-gray-700'} rounded hover:bg-gray-300`}
              title="Inverter horizontalmente"
            >
              <FiRefreshCw size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShapeElementControls; 