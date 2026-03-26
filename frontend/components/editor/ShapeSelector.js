import React, { useState } from 'react';
import { FiSquare, FiCircle, FiTriangle, FiStar, FiArrowRight, FiMinus, FiMessageCircle } from 'react-icons/fi';

// Ícones personalizados para os balões de fala
const ThoughtBubbleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="16" cy="16" r="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="18" cy="19" r="1" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const ShoutBubbleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 8L4 4L6 8L8 4L10 8L12 4L14 8L16 4L18 8L20 4L22 8V16L20 20L18 16L16 20L14 16L12 20L10 16L8 20L6 16L4 20L2 16V8Z" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const SpeechBubbleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 18">
    <path d="M2,2 L22,2 Q24,2 24,4 L24,14 Q24,16 22,16 L10,16 L6,20 L6,16 L2,16 Q0,16 0,14 L0,4 Q0,2 2,2" 
      fill="currentColor" />
  </svg>
);

const SHAPE_TYPES = [
  { id: 'rectangle', icon: <FiSquare size={18} />, label: 'Retângulo' },
  { id: 'circle', icon: <FiCircle size={18} />, label: 'Círculo' },
  { id: 'triangle', icon: <FiTriangle size={18} />, label: 'Triângulo' },
  { id: 'star', icon: <FiStar size={18} />, label: 'Estrela' },
  { id: 'arrow', icon: <FiArrowRight size={18} />, label: 'Seta' },
  { id: 'line', icon: <FiMinus size={18} />, label: 'Linha' },
  { id: 'speechBubbleLeft', icon: <SpeechBubbleIcon />, label: 'Balão de Fala' },
  { id: 'thoughtBubble', icon: <ThoughtBubbleIcon />, label: 'Pensamento' },
  { id: 'shoutBubble', icon: <ShoutBubbleIcon />, label: 'Grito' },
  { id: 'ovalBubble', icon: <FiMessageCircle size={18} />, label: 'Balão Oval' }
];

const ShapeSelector = ({ onAddShape }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState('all'); // 'all', 'basic', 'speech'

  const handleAddShape = (shapeType) => {
    onAddShape(shapeType);
    setIsOpen(false);
  };

  // Filtrar formas com base na categoria
  const filteredShapes = category === 'all' 
    ? SHAPE_TYPES 
    : category === 'basic'
      ? SHAPE_TYPES.slice(0, 6) // Formas básicas
      : SHAPE_TYPES.slice(6); // Balões de fala

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded flex items-center"
        title="Adicionar forma"
      >
        <FiSquare size={20} />
        <span className="text-xs ml-1">Formas</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded shadow-lg z-50 p-2 w-56">
          {/* Abas de categoria */}
          <div className="flex mb-2 border-b border-gray-700">
            <button
              className={`flex-1 py-1 text-xs ${category === 'all' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-300'}`}
              onClick={() => setCategory('all')}
            >
              Todas
            </button>
            <button
              className={`flex-1 py-1 text-xs ${category === 'basic' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-300'}`}
              onClick={() => setCategory('basic')}
            >
              Básicas
            </button>
            <button
              className={`flex-1 py-1 text-xs ${category === 'speech' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-300'}`}
              onClick={() => setCategory('speech')}
            >
              Balões
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-1">
            {filteredShapes.map((shape) => (
              <button
                key={shape.id}
                onClick={() => handleAddShape(shape.id)}
                className="flex flex-col items-center justify-center p-2 hover:bg-gray-700 rounded text-gray-300 hover:text-white"
                title={shape.label}
              >
                {shape.icon}
                <span className="text-xs mt-1">{shape.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShapeSelector; 