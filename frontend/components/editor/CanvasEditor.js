import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { FiType, FiImage, FiMusic, FiTrash2, FiCopy, FiChevronUp, FiChevronDown, FiPlay, FiRefreshCw, FiMaximize, FiSquare, FiMove, FiGrid, FiLayers, FiChevronLeft, FiSave, FiPlus, FiEye, FiEyeOff, FiChevronRight, FiBook, FiEdit, FiX } from 'react-icons/fi';
import MediaLibrary from './MediaLibrary';
import 'animate.css'; // Importar a biblioteca de animações
import TextElementControls from './TextElementControls';
import ImageElementControls from './ImageElementControls';
import ShapeElementControls from './ShapeElementControls';
import ShapeElement from './ShapeElement';
import ShapeSelector from './ShapeSelector';
import LayerManager from './LayerManager';
import { devLog } from '../../lib/devLog';

// Dimensões fixas para o canvas (resolução padrão do livro)
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

// Dimensões do viewport (área visível no app)
const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 600;

// Deep clone function to avoid reference issues
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Animation options
const ANIMATIONS = [
  { value: '', label: 'No Animation' },
  { value: 'animate__fadeIn', label: 'Fade In' },
  { value: 'animate__fadeInUp', label: 'Fade In Up' },
  { value: 'animate__fadeInDown', label: 'Fade In Down' },
  { value: 'animate__zoomIn', label: 'Zoom In' },
  { value: 'animate__slideInLeft', label: 'Slide In Left' },
  { value: 'animate__slideInRight', label: 'Slide In Right' },
  { value: 'animate__bounce', label: 'Bounce' },
  { value: 'animate__pulse', label: 'Pulse' },
  { value: 'animate__rubberBand', label: 'Rubber Band' }
];

// Text style options
const TEXT_STYLES = [
  { value: 'normal', label: 'Texto Normal' },
  { value: 'narrative', label: 'Narrativa' },
  { value: 'speech', label: 'Balão de Fala' },
  { value: 'thought', label: 'Pensamento' }
];

/** Texto vindo do PPTX com trechos formatados (negrito por run, etc.) */
function renderImportedTextContent(element) {
  const spans = element.contentSpans;
  if (Array.isArray(spans) && spans.length > 1) {
    return (
      <span style={{ whiteSpace: 'pre-wrap', display: 'block' }}>
        {spans.map((s, i) => (
          <span
            key={i}
            style={{
              fontWeight: s.fontWeight || element.fontWeight || 'normal',
              fontStyle: s.fontStyle || element.fontStyle || 'normal',
              color: s.color || element.color || '#000000',
              fontSize: s.fontSize
                ? `${s.fontSize}px`
                : element.fontSize
                  ? `${element.fontSize}px`
                  : '16px',
              fontFamily: s.fontFamily || element.fontFamily || 'Roboto',
              textDecoration: getTextDecorationValue(element),
              lineHeight: element.lineHeight || 1.35,
              letterSpacing: element.letterSpacing ? `${element.letterSpacing}px` : 'normal',
            }}
          >
            {s.text}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span
      style={{
        whiteSpace: 'pre-wrap',
        display: 'block',
        textDecoration: getTextDecorationValue(element),
        lineHeight: element.lineHeight || 1.35,
        letterSpacing: element.letterSpacing ? `${element.letterSpacing}px` : 'normal',
      }}
    >
      {element.content}
    </span>
  );
}

// Lista de fontes disponíveis com nomes exatos
export const AVAILABLE_FONTS = [
  { value: 'Century Gothic', label: 'Century Gothic' },
  { value: 'Bookman Old Style', label: 'Bookman Old Style' },
  { value: 'Calibri', label: 'Calibri' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Tahoma', label: 'Tahoma' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Garamond', label: 'Garamond' },
  { value: 'Cambria', label: 'Cambria' },
  { value: 'Segoe UI', label: 'Segoe UI' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Lucida Sans Unicode', label: 'Lucida Sans Unicode' },
  { value: 'Palatino Linotype', label: 'Palatino Linotype' },
  { value: 'Book Antiqua', label: 'Book Antiqua' },
  { value: 'Arial Black', label: 'Arial Black' },
  { value: 'Comic Sans MS', label: 'Comic Sans MS' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Merriweather', label: 'Merriweather' },
];

function getTextDecorationValue(element) {
  const isUnderline = element.textDecoration === 'underline';
  const isStrike = element.textDecoration === 'line-through';
  if (isUnderline && isStrike) return 'underline line-through';
  if (isUnderline) return 'underline';
  if (isStrike) return 'line-through';
  return 'none';
}

// Main component wrapped in memo to prevent unnecessary re-renders
const CanvasEditor = React.memo(({ 
  page, 
  onChange,
  selectedElement,
  setSelectedElement,
  onElementChange,
  onPlayAnimation,
  onImageRotate,
  onImageFlip,
  onTextStyleChange,
  onAnimationChange,
  onMoveForward,
  onMoveBackward,
  onImageStyleChange,
  onDuplicateElement,
  onRemoveElement,
  isPreviewMode,
  setIsPreviewMode,
  currentStep,
  setCurrentStep
}) => {
  devLog('CanvasEditor renderizado com página:', page);
  
  // Create a stable identifier for the page
  const pageKey = useRef(page?.id || Date.now().toString());
  // Track last page ID to prevent unnecessary resets
  const lastPageId = useRef(page?.id);
  
  // If page ID changes, update the pageKey ref
  if (page?.id && pageKey.current !== page.id) {
    pageKey.current = page.id;
  }
  
  // Escala adaptativa (fit) + zoom manual (para UX mais "pro")
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1); // 0.25 .. 3
  const [showGrid, setShowGrid] = useState(false);
  const [showRealSizePreview, setShowRealSizePreview] = useState(false);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Remove local background state, use page.background directly
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaSelectionType, setMediaSelectionType] = useState(null);
  const [audioTargetElement, setAudioTargetElement] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const textInputRef = useRef(null);
  
  const [clickCount, setClickCount] = useState({});
  const clickTimeout = useRef(null);
  
  // Adicionar novos estados
  const [showLayerManager, setShowLayerManager] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isMovingAudioButton, setIsMovingAudioButton] = useState(false);
  
  // Efeito para calcular a escala do canvas com base no tamanho do contêiner
  useEffect(() => {
    const calculateScale = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const containerWidth = rect.width;
        const containerHeight = rect.height;
        
        // Calcula a escala mantendo a proporção
        const horizontalPadding = 32;
        const verticalPadding = 32;
        const scaleX = (containerWidth - horizontalPadding) / CANVAS_WIDTH;
        const scaleY = (containerHeight - verticalPadding) / CANVAS_HEIGHT;
        
        // Usa a menor escala para garantir que o canvas caiba completamente
        const newScale = Math.min(scaleX, scaleY, 1);
        setFitScale(newScale > 0 ? newScale : 0.2);
      }
    };
    
    calculateScale();

    const ro = typeof ResizeObserver !== 'undefined' && containerRef.current
      ? new ResizeObserver(() => calculateScale())
      : null;
    if (ro && containerRef.current) {
      ro.observe(containerRef.current);
    }
    
    // Recalcula a escala quando a janela for redimensionada
    window.addEventListener('resize', calculateScale);
    return () => {
      window.removeEventListener('resize', calculateScale);
      if (ro) ro.disconnect();
    };
  }, [showLayerManager, isPreviewMode]);

  const scale = Math.max(0.1, Math.min(3, fitScale * zoom));
  
  // Effect to sync with parent component, with debounce for better performance
  const changeTimerRef = useRef(null);
  
  useEffect(() => {
    devLog('CanvasEditor: useEffect [page] acionado');
    // When page prop changes, update local state
    if (page && page.id !== lastPageId.current) {
      devLog('Página mudou! Resetando estado interno...');
      lastPageId.current = page.id;
    }
  }, [page]);
  
  // Notify parent of changes, with debounce to avoid excessive updates
  const notifyChanges = useCallback(() => {
    devLog('CanvasEditor: notifyChanges acionado');
    if (changeTimerRef.current) {
      clearTimeout(changeTimerRef.current);
    }
    
    changeTimerRef.current = setTimeout(() => {
      if (onChange) {
        const updatedPage = {
          ...page,
          id: pageKey.current
        };
        devLog('CanvasEditor: notificando alterações na página');
        onChange(updatedPage);
      }
    }, 300); // 300ms debounce
  }, [onChange, page]);
  
  // Visibility event handlers
  const handleShowMediaLibrary = useCallback((type) => {
    setMediaSelectionType(type);
    setShowMediaLibrary(true);
  }, []);
  
  const handleCloseMediaLibrary = useCallback(() => {
    setShowMediaLibrary(false);
  }, []);
  
  // Element change handler (delegates to parent)
  const handleElementChange = useCallback((id, updates) => {
    if (onElementChange) {
      onElementChange(id, updates);
    }
  }, [onElementChange]);
  
  // Position and size handlers
  const handlePositionChange = useCallback((id, position) => {
    handleElementChange(id, { position });
  }, [handleElementChange]);
  
  const handleSizeChange = useCallback((id, size) => {
    handleElementChange(id, { size });
  }, [handleElementChange]);
  
  const handleTextChange = useCallback((id, content) => {
    handleElementChange(id, { content, contentSpans: undefined });
  }, [handleElementChange]);
  
  // Element handlers now just pass through to parent
  const handleAddText = useCallback((textStyle = 'normal') => {
    const newElement = {
      id: Date.now().toString(),
      type: 'text',
      textStyle: textStyle,
      content: 'Clique para editar',
      position: { x: 50, y: 50 },
      size: { width: 200, height: 'auto' },
      animation: '',
      step: 0,
      zIndex: (page.elements?.length || 0) + 1,
      fontSize: 16,
      fontFamily: 'Roboto',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      color: '#000000',
      textDecoration: 'none',
      lineHeight: 1.35,
      letterSpacing: 0,
    };
    
    const updatedPage = {
      ...page,
      elements: [...(page.elements || []), newElement]
    };
    onChange(updatedPage);
    setSelectedElement(newElement.id);
  }, [page, onChange, setSelectedElement]);
  
  const handleMediaSelected = useCallback((file) => {
    // Use file.url instead of just url
    const url = file.url;
    
    if (mediaSelectionType === 'background') {
      onChange({ ...page, background: url });
      setShowMediaLibrary(false);
      return;
    }
    
    // If adding audio to an existing element
    if (mediaSelectionType === 'elementAudio' && audioTargetElement) {
      handleElementChange(audioTargetElement, { audio: url });
      setAudioTargetElement(null);
      setShowMediaLibrary(false);
      return;
    }
    
    if (mediaSelectionType === 'image') {
      const newElement = {
        id: Date.now().toString(),
        type: 'image',
        content: url,
        position: { x: 50, y: 50 },
        size: { width: 200, height: 200 },
        animation: '',
        step: 0,
        imageStyle: {
          objectFit: 'cover',
          borderRadius: 0
        },
        zIndex: (page.elements?.length || 0) + 1
      };
      
      // Add the new element through parent handler
      const updatedPage = {
        ...page,
        elements: [...(page.elements || []), newElement]
      };
      onChange(updatedPage);
      setSelectedElement(newElement.id);
    } else if (mediaSelectionType === 'audio') {
      const newElement = {
        id: Date.now().toString(),
        type: 'audio',
        content: url,
        position: { x: 50, y: 50 },
        size: { width: 300, height: 50 },
        animation: '',
        step: 0,
        zIndex: (page.elements?.length || 0) + 1
      };
      
      // Add the new element through parent handler
      const updatedPage = {
        ...page,
        elements: [...(page.elements || []), newElement]
      };
      onChange(updatedPage);
      setSelectedElement(newElement.id);
    }
    
    setShowMediaLibrary(false);
  }, [mediaSelectionType, page, onChange, setSelectedElement, audioTargetElement, handleElementChange]);
  
  // Handle animation preview - delegate to parent
  const handlePlayAnimation = useCallback((id, animation) => {
    if (onPlayAnimation) {
      onPlayAnimation(id, animation);
    }
  }, [onPlayAnimation]);
  
  // Handle showing media library for element audio
  const handleShowElementAudioLibrary = useCallback((elementId) => {
    setAudioTargetElement(elementId);
    setMediaSelectionType('elementAudio');
    setShowMediaLibrary(true);
  }, []);
  
  // Toggle preview mode
  const togglePreviewMode = useCallback(() => {
    if (setIsPreviewMode) {
    setIsPreviewMode(prev => !prev);
    }
    setCurrentStep(0); // Reset to first step when entering/exiting preview
    if (setSelectedElement) {
    setSelectedElement(null); // Deselect when entering/exiting preview
    }
  }, [setIsPreviewMode, setSelectedElement]);

  // Toggle grid visibility
  const toggleGrid = useCallback(() => {
    setShowGrid(prev => !prev);
  }, []);
  
  // Toggle real size preview
  const toggleRealSizePreview = useCallback(() => {
    setShowRealSizePreview(prev => !prev);
  }, []);
  
  // Step navigation
  const goToNextStep = useCallback(() => {
    // Find the maximum step in all elements
    const maxStep = Math.max(...(page.elements || []).map(el => el.step || 0), 0);
    // Only increment if not at the last step
    if (currentStep < maxStep) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, page.elements]);
  
  const goToPreviousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);
  
  // Sort elements by z-index before rendering
  const sortedElements = [...(page.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  
  // Filter elements by current step in preview mode
  const visibleElements = isPreviewMode 
    ? sortedElements.filter(el => (el.step || 0) <= currentStep)
    : sortedElements;
  
  const handleStartEditingText = useCallback((element) => {
    setEditingText(element.id);
    setEditingTextValue(element.content === 'Clique para editar' ? '' : element.content);
    
    // Focar no input após renderizar
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }, 10);
  }, []);

  const handleFinishEditingText = useCallback(() => {
    if (editingText && editingTextValue.trim() !== '') {
      handleTextChange(editingText, editingTextValue);
    }
    setEditingText(null);
    setEditingTextValue('');
  }, [editingText, editingTextValue, handleTextChange]);
  
  // Adicionar função para filtrar elementos por etapa
  const getVisibleElements = useCallback((elements, currentStep) => {
    return elements.filter(el => el.step <= currentStep);
  }, []);
  
  // Função para garantir que o nome da fonte está correto
  const getValidFontFamily = (fontFamily) => {
    if (!fontFamily) return 'Roboto';
    const font = AVAILABLE_FONTS.find(f => f.value.toLowerCase() === fontFamily.toLowerCase());
    return font ? font.value : 'Roboto';
  };
  
  const handleElementClick = useCallback((e, element) => {
    e.stopPropagation();
    
    if (!element.isLocked) {
      setSelectedElement(element.id);
      return;
    }

    // Lógica para elementos bloqueados
    const currentCount = clickCount[element.id] || 0;
    const newCount = currentCount + 1;
    
    // Limpa o timeout anterior se existir
    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current);
    }

    // Atualiza o contador de cliques
    setClickCount(prev => ({
      ...prev,
      [element.id]: newCount
    }));

    // Se atingiu 3 cliques, seleciona o elemento
    if (newCount >= 3) {
      setSelectedElement(element.id);
      setClickCount(prev => ({
        ...prev,
        [element.id]: 0
      }));
      return;
    }

    // Reset o contador após 1 segundo
    clickTimeout.current = setTimeout(() => {
      setClickCount(prev => ({
        ...prev,
        [element.id]: 0
      }));
    }, 1000);
  }, [clickCount, setSelectedElement]);
  
  // Adicionar novas funções
  const handleToggleVisibility = useCallback((id) => {
    handleElementChange(id, { isVisible: !page.elements?.find(el => el.id === id)?.isVisible });
  }, [handleElementChange, page.elements]);

  const handleLockElement = useCallback((id) => {
    handleElementChange(id, { isLocked: !page.elements?.find(el => el.id === id)?.isLocked });
  }, [handleElementChange, page.elements]);
  
  const handleMouseDown = (e, elementId) => {
    if (isPreviewMode) return;
    
    const element = page.elements.find(el => el.id === elementId);
    if (!element) return;

    // Verificar se clicou no botão de áudio
    const target = e.target;
    if (target.closest('.audio-button')) {
      e.stopPropagation();
      
      // Encontrar o elemento pai mais próximo que seja um elemento do canvas
      const elementContainer = target.closest('[id^="el-"]');
      if (!elementContainer) return;
      
      const elementRect = elementContainer.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const startPos = {
        x: element.audioButtonPosition?.x || (element.size.width - 40),
        y: element.audioButtonPosition?.y || 8
      };

      const handleMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        
        // Calcular a nova posição relativa ao elemento
        // Limitando a posição para manter o botão ao redor do elemento
        const padding = 20; // Espaçamento mínimo do botão em relação ao elemento
        const buttonSize = 40; // Tamanho do botão
        
        // Calcula os limites do elemento
        const minX = -buttonSize - padding;
        const maxX = elementRect.width + padding;
        const minY = -buttonSize - padding;
        const maxY = elementRect.height + padding;
        
        // Calcula a nova posição
        let newX = startPos.x + (deltaX / scale);
        let newY = startPos.y + (deltaY / scale);
        
        // Ajusta a posição para manter o botão ao redor do elemento
        if (newX < minX) newX = minX;
        if (newX > maxX) newX = maxX;
        if (newY < minY) newY = minY;
        if (newY > maxY) newY = maxY;

        onElementChange(elementId, {
          audioButtonPosition: {
            x: newX,
            y: newY
          }
        });
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return;
    }

    // Código para mover o elemento
    setIsDragging(true);
    setSelectedElement(elementId);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...element.position };

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      onChange({
        ...page,
        elements: page.elements.map(el =>
          el.id === elementId
            ? {
                ...el,
                position: {
                  x: startPos.x + deltaX,
                  y: startPos.y + deltaY,
                },
              }
            : el
        ),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Adicionar função para calcular a posição dos controles
  const calculateControlsPosition = useCallback((element) => {
    const elementRect = document.getElementById(`el-${element.id}`)?.getBoundingClientRect();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    
    if (!elementRect || !canvasRect) return { top: 'auto', bottom: 'auto' };
    
    // Se o elemento está muito próximo ao topo, posiciona os controles abaixo
    if (elementRect.top - canvasRect.top < 100) {
      return { top: '100%', bottom: 'auto' };
    }
    
    // Caso contrário, posiciona os controles acima
    return { top: 'auto', bottom: '100%' };
  }, []);

  // Adicionar função para criar uma nova forma
  const handleAddShape = useCallback((shapeType) => {
    const newElement = {
      id: Date.now().toString(),
      type: 'shape',
      shapeProperties: {
        type: shapeType,
        fill: '#fcfdff', // fundo quase branco
        borderColor: '#0d0d0d', // borda quase preta
        borderWidth: 2,
        borderRadius: shapeType === 'rectangle' ? 0 : undefined
      },
      position: { x: 50, y: 50 },
      size: { width: 150, height: 150 },
      animation: '',
      step: 0,
      zIndex: (page.elements?.length || 0) + 1,
      // Adicionando propriedades de texto
      text: {
        content: '',
        fontSize: 16,
        fontFamily: 'Roboto',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'center',
        color: '#000000'
      }
    };
    
    const updatedPage = {
      ...page,
      elements: [...(page.elements || []), newElement]
    };
    onChange(updatedPage);
    setSelectedElement(newElement.id);
  }, [page, onChange, setSelectedElement]);
  
  // Adicionar função para iniciar edição de texto na forma
  const handleStartShapeTextEdit = useCallback((element) => {
    if (isPreviewMode) return;
    
    setEditingText(element.id);
    setEditingTextValue(element.text?.content || '');
    setSelectedElement(element.id);
    
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }, 10);
  }, [isPreviewMode, setSelectedElement]);

  // Adicionar função para finalizar edição de texto na forma
  const handleFinishShapeTextEdit = useCallback(() => {
    if (editingText) {
      const element = page.elements.find(el => el.id === editingText);
      if (element?.type === 'shape') {
        handleElementChange(editingText, {
          text: {
            ...element.text,
            content: editingTextValue.trim()
          }
        });
      }
    }
    setEditingText(null);
    setEditingTextValue('');
  }, [editingText, editingTextValue, handleElementChange, page.elements]);
  
  const renderElement = (element) => {
    if (currentStep < (element.step || 0)) return null;

    const style = {
      position: 'absolute',
      left: `${element.position.x}px`,
      top: `${element.position.y}px`,
      width: element.size.width === 'auto' ? 'auto' : `${element.size.width}px`,
      height: element.size.height === 'auto' ? 'auto' : `${element.size.height}px`,
      cursor: isPreviewMode ? 'default' : 'move',
      userSelect: 'none',
      border: selectedElement === element.id && !isPreviewMode ? '2px solid #fcfdff' : 'none',
      padding: '2px',
    };

    let content;
    switch (element.type) {
      case 'text':
        content = (
          <div
            style={{
              ...style,
              fontSize: `${element.fontSize || 16}px`,
              fontFamily: element.fontFamily || 'Roboto',
              fontWeight: element.fontWeight || 'normal',
              fontStyle: element.fontStyle || 'normal',
              textAlign: element.textAlign || 'left',
              color: element.color || '#000000',
              textDecoration: getTextDecorationValue(element),
              lineHeight: element.lineHeight || 1.35,
              letterSpacing: element.letterSpacing ? `${element.letterSpacing}px` : 'normal',
              position: 'relative',
              userSelect: 'text',
            }}
            id={`el-${element.id}`}
            onMouseDown={(e) => handleMouseDown(e, element.id)}
            className={`element ${element.animation || ''}`}
          >
            {renderImportedTextContent(element)}
            
            {/* Botão de áudio para texto */}
            {element.audio && (
              <div
                className="audio-button"
                style={{
                  position: 'absolute',
                  left: `${element.audioButtonPosition?.x || (element.size.width - 40)}px`,
                  top: `${element.audioButtonPosition?.y || 8}px`,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '50%',
                  padding: '8px',
                  cursor: 'move',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s',
                  zIndex: 1000,
                  width: '40px',
                  height: '40px',
                  transform: 'translate(-50%, -50%)', // Centraliza o botão no ponto de clique
                }}
                onMouseDown={(e) => handleMouseDown(e, element.id)}
              >
                <FiMusic color="white" size={20} />
              </div>
            )}
          </div>
        );
        break;

      case 'image':
        content = (
          <div className="w-full h-full relative">
            {/* Drag handle overlay para mover a imagem */}
            <div className="drag-handle absolute inset-0 z-10 cursor-move"></div>
            
            <img 
              src={element.content} 
              alt="Content"
              className="w-full h-full pointer-events-none"
              style={{ 
                transform: `
                  rotate(${element.rotation || 0}deg)
                  scaleX(${element.flipH ? -1 : 1})
                  scaleY(${element.flipV ? -1 : 1})
                `,
                borderRadius: `${element.imageStyle?.borderRadius || 0}px`,
                objectFit: element.imageStyle?.objectFit || 'contain',
                backgroundColor: 'transparent'
              }}
            />
            
            {/* Botão de áudio para imagem */}
            {element.audio && (
              <div
                className="audio-button"
                style={{
                  position: 'absolute',
                  left: `${element.audioButtonPosition?.x || (element.size.width - 40)}px`,
                  top: `${element.audioButtonPosition?.y || 8}px`,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '50%',
                  padding: '8px',
                  cursor: 'move',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s',
                  zIndex: 1000,
                  width: '40px',
                  height: '40px',
                  transform: 'translate(-50%, -50%)', // Centraliza o botão no ponto de clique
                }}
                onMouseDown={(e) => handleMouseDown(e, element.id)}
              >
                <FiMusic color="white" size={20} />
              </div>
            )}
          </div>
        );
        break;
        
      case 'shape':
        content = (
          <div className="w-full h-full relative">
            {/* Forma sempre atrás */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <ShapeElement shape={element.shapeProperties} />
            </div>
            {/* Texto sobreposto */}
            {editingText === element.id ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center w-full h-full">
                <textarea
                  ref={textInputRef}
                  value={editingTextValue}
                  onChange={(e) => {
                    setEditingTextValue(e.target.value);
                  }}
                  onBlur={handleFinishShapeTextEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      handleFinishShapeTextEdit();
                    }
                  }}
                  className="w-full h-full resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent text-center p-2"
                  style={{
                    fontFamily: element.text?.fontFamily || 'Roboto',
                    fontSize: element.text?.fontSize ? `${element.text.fontSize}px` : '16px',
                    fontWeight: element.text?.fontWeight || 'normal',
                    fontStyle: element.text?.fontStyle || 'normal',
                    textAlign: element.text?.textAlign || 'center',
                    color: element.text?.color || '#000000',
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    boxSizing: 'border-box',
                    background: 'transparent'
                  }}
                  placeholder="Digite seu texto aqui"
                  autoFocus
                />
              </div>
            ) : element.text?.content ? (
              <div 
                className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none w-full h-full p-2"
                style={{
                  fontFamily: element.text?.fontFamily || 'Roboto',
                  fontSize: element.text?.fontSize ? `${element.text.fontSize}px` : '16px',
                  fontWeight: element.text?.fontWeight || 'normal',
                  fontStyle: element.text?.fontStyle || 'normal',
                  textAlign: element.text?.textAlign || 'center',
                  color: element.text?.color || '#000000',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  boxSizing: 'border-box',
                  background: 'transparent'
                }}
              >
                {element.text.content}
              </div>
            ) : null}
            {/* Botão de áudio para forma */}
            {element.text?.audio && (
              <div
                className="audio-button"
                style={{
                  position: 'absolute',
                  left: `${element.text?.audioButtonPosition?.x || (element.size.width - 40)}px`,
                  top: `${element.text?.audioButtonPosition?.y || 8}px`,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '50%',
                  padding: '8px',
                  cursor: 'move',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s',
                  zIndex: 1000,
                  width: '40px',
                  height: '40px',
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseDown={(e) => {
                  // Reutiliza a lógica de mover botão de áudio
                  if (isPreviewMode) return;
                  e.stopPropagation();
                  const elementId = element.id;
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startPos = {
                    x: element.text?.audioButtonPosition?.x || (element.size.width - 40),
                    y: element.text?.audioButtonPosition?.y || 8
                  };
                  const handleMouseMove = (moveEvent) => {
                    const deltaX = moveEvent.clientX - startX;
                    const deltaY = moveEvent.clientY - startY;
                    let newX = startPos.x + deltaX / (scale || 1);
                    let newY = startPos.y + deltaY / (scale || 1);
                    // Limites básicos
                    if (newX < 0) newX = 0;
                    if (newY < 0) newY = 0;
                    if (newX > element.size.width) newX = element.size.width;
                    if (newY > element.size.height) newY = element.size.height;
                    handleElementChange(elementId, {
                      text: {
                        ...element.text,
                        audioButtonPosition: { x: newX, y: newY }
                      }
                    });
                  };
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              >
                <FiMusic color="white" size={20} />
              </div>
            )}
          </div>
        );
        break;

      default:
        content = null;
    }

    return content;
  };

  /* scale() não reduz o box no layout: o wrapper tem o tamanho visual real */
  const scaledW = Math.max(1, CANVAS_WIDTH * scale);
  const scaledH = Math.max(1, CANVAS_HEIGHT * scale);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <div className="flex min-h-0 flex-1">
        <div
          ref={containerRef}
          className="relative flex min-h-0 flex-1 flex-grow items-center justify-center overflow-hidden bg-gray-900 p-2"
        >
          {/* Zoom HUD */}
          {!isPreviewMode && (
            <div className="absolute left-3 top-3 z-50 flex items-center gap-2 rounded border border-gray-700 bg-gray-950/70 px-3 py-2 text-xs text-gray-200 backdrop-blur">
              <button
                type="button"
                className="rounded bg-gray-800 px-2 py-1 hover:bg-gray-700"
                onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 100) / 100))}
                title="Diminuir zoom"
              >
                -
              </button>
              <div className="w-20 text-center">{Math.round(scale * 100)}%</div>
              <button
                type="button"
                className="rounded bg-gray-800 px-2 py-1 hover:bg-gray-700"
                onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 100) / 100))}
                title="Aumentar zoom"
              >
                +
              </button>
              <button
                type="button"
                className="rounded bg-gray-800 px-2 py-1 hover:bg-gray-700"
                onClick={() => setZoom(1)}
                title="Resetar zoom"
              >
                100%
              </button>
            </div>
          )}
          <div
            className="relative flex-shrink-0"
            style={{ width: scaledW, height: scaledH }}
          >
            <div
              ref={canvasRef}
              className="absolute left-0 top-0 bg-white"
              style={{
                width: `${CANVAS_WIDTH}px`,
                height: `${CANVAS_HEIGHT}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                transition: 'transform 0.2s ease',
              }}
              onClick={() => !isPreviewMode && setSelectedElement(null)}
            >
            {/* Background da página */}
            <div 
              className="absolute inset-0 w-full h-full"
              style={{
                backgroundImage: page.background 
                  ? `url(${typeof page.background === 'string' ? page.background : page.background.url})`
                  : 'none',
                // `scale` aqui representa "zoom" do background. Usar backgroundSize evita
                // distorção/zoom estranho por transform no container.
                backgroundSize: page.background?.scale
                  ? `${Math.max(100, Math.round(page.background.scale * 100))}%`
                  : 'cover',
                backgroundPosition: page.background?.position 
                  ? `${page.background.position.x * 100}% ${page.background.position.y * 100}%` 
                  : 'center',
                backgroundRepeat: 'no-repeat',
                transform: 'none',
                transformOrigin: 'center',
              }}
            />
            {/* Render all elements */}
            {getVisibleElements(page.elements, currentStep).map(element => (
              <Rnd
                key={element.id}
                default={{
                  x: element.position?.x || 0,
                  y: element.position?.y || 0,
                  width: element.size?.width || 100,
                  height: element.type === 'image' || element.type === 'shape'
                    ? element.size?.height || 100 
                    : element.size?.height === 'auto' ? 'auto' : element.size?.height || 'auto'
                }}
                position={{ x: element.position?.x || 0, y: element.position?.y || 0 }}
                size={{ 
                  width: element.size?.width || 100, 
                  height: element.type === 'image' || element.type === 'shape'
                    ? element.size?.height || 100 
                    : element.size?.height === 'auto' ? 'auto' : element.size?.height || 'auto'
                }}
                onDragStop={(e, d) => {
                  if (!element.isLocked) {
                    handlePositionChange(element.id, { x: d.x, y: d.y });
                  }
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  if (!element.isLocked) {
                    handleSizeChange(element.id, {
                      width: ref.offsetWidth,
                      height: ref.offsetHeight
                    });
                    handlePositionChange(element.id, position);
                  }
                }}
                onClick={(e) => handleElementClick(e, element)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (element.type === 'shape') {
                    devLog('Duplo clique no Rnd da forma:', element);
                    handleStartShapeTextEdit(element);
                  } else {
                    setSelectedElement && setSelectedElement(element.id);
                  }
                }}
                enableResizing={!isPreviewMode && !element.isLocked}
                disableDragging={isPreviewMode || element.isLocked}
                dragHandleClassName={element.type === 'image' || element.type === 'shape' ? 'drag-handle' : undefined}
                className={`${
                  selectedElement === element.id && !isPreviewMode 
                    ? 'ring-2 ring-blue-500 shadow-md border border-blue-300' 
                    : element.isLocked 
                      ? 'pointer-events-none' 
                      : 'hover:ring-1 hover:ring-blue-300'
                } ${
                  element.isLocked 
                    ? 'cursor-not-allowed' 
                    : 'cursor-move'
                } ${
                  element.isLocked && clickCount[element.id] > 0 
                    ? `after:content-['${3 - (clickCount[element.id] || 0)} cliques para desbloquear'] 
                       after:absolute after:top-0 after:left-1/2 after:-translate-x-1/2 after:-translate-y-full 
                       after:bg-black after:text-white after:px-2 after:py-1 after:rounded after:text-xs 
                       after:whitespace-nowrap after:opacity-75`
                    : ''
                }`}
                style={{ 
                  zIndex: element.zIndex || 1,
                  cursor: element.isLocked ? 'not-allowed' : isPreviewMode ? 'default' : 'move'
                }}
                bounds="parent"
                scale={scale}
              >
                <div 
                  id={`el-${element.id}`} 
                  className={`w-full h-full relative ${element.animation ? `animate__animated ${element.animation}` : ''}`}
                >
                  {/* Adicionar classe drag-handle para elemento de imagem e forma */}
                  {(element.type === 'image' || element.type === 'shape') && (
                    <div className="drag-handle absolute inset-0 z-10 cursor-move"></div>
                  )}
                  
                  {/* Controles inline quando o elemento está selecionado */}
                  {selectedElement === element.id && !isPreviewMode && (
                    <div 
                      className="absolute left-0 z-50 bg-white rounded shadow-lg p-2 flex space-x-1"
                      style={{
                        ...calculateControlsPosition(element),
                        transform: 'translateY(-8px)',
                        minWidth: 'max-content'
                      }}
                    >
                      {element.type === 'text' ? (
                        <TextElementControls
                          element={element}
                          onPlayAnimation={onPlayAnimation}
                          handleElementChange={handleElementChange}
                          onDuplicateElement={onDuplicateElement}
                          onMoveForward={onMoveForward}
                          onMoveBackward={onMoveBackward}
                          onRemoveElement={onRemoveElement}
                        />
                      ) : element.type === 'image' ? (
                        <ImageElementControls
                          element={element}
                          onPlayAnimation={onPlayAnimation}
                          handleElementChange={handleElementChange}
                          onDuplicateElement={onDuplicateElement}
                          onMoveForward={onMoveForward}
                          onMoveBackward={onMoveBackward}
                          onRemoveElement={onRemoveElement}
                          onImageRotate={onImageRotate}
                          onImageFlip={onImageFlip}
                        />
                      ) : element.type === 'shape' ? (
                        <ShapeElementControls
                          element={element}
                          onPlayAnimation={onPlayAnimation}
                          handleElementChange={handleElementChange}
                          onDuplicateElement={onDuplicateElement}
                          onMoveForward={onMoveForward}
                          onMoveBackward={onMoveBackward}
                          onRemoveElement={onRemoveElement}
                        />
                      ) : null}
                    </div>
                  )}

                  {/* Text element */}
                  {element.type === 'text' && (
                    <div
                      className={`w-full h-full p-1`}
                      style={{
                        position: 'relative',
                        backgroundColor: element.textStyle === 'normal' ? 'transparent' : 'white',
                        border: element.textStyle !== 'normal' ? '2px solid #ddd' : 'none',
                        borderRadius: '8px',
                        ...(element.textStyle === 'speech' && {
                          borderRadius: '8px',
                          padding: '12px',
                          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)'
                        }),
                        ...(element.textStyle === 'thought' && {
                          borderRadius: '50%',
                          padding: '12px',
                          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)'
                        })
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isPreviewMode) {
                          setSelectedElement(element.id);
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!isPreviewMode) {
                          handleStartEditingText(element);
                        }
                      }}
                    >
                      {editingText === element.id ? (
                        <textarea
                          ref={textInputRef}
                          value={editingTextValue}
                          onChange={(e) => setEditingTextValue(e.target.value)}
                          onBlur={handleFinishEditingText}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              handleFinishEditingText();
                            }
                          }}
                          className="w-full h-full resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                          style={{
                            fontFamily: element.fontFamily || 'Roboto',
                            fontSize: element.fontSize ? `${element.fontSize}px` : '16px',
                            fontWeight: element.fontWeight || 'normal',
                            fontStyle: element.fontStyle || 'normal',
                            textAlign: element.textAlign || 'left',
                            color: element.color || '#000000',
                            textDecoration: getTextDecorationValue(element),
                            lineHeight: element.lineHeight || 1.35,
                            letterSpacing: element.letterSpacing ? `${element.letterSpacing}px` : 'normal',
                            background: 'transparent',
                            border: 'none'
                          }}
                          placeholder="Digite seu texto aqui"
                          autoFocus
                        />
                      ) : (
                        <div
                          style={{
                            fontFamily: element.fontFamily || 'Roboto',
                            fontSize: element.fontSize ? `${element.fontSize}px` : '16px',
                            fontWeight: element.fontWeight || 'normal',
                            fontStyle: element.fontStyle || 'normal',
                            textAlign: element.textAlign || 'left',
                            color: element.color || '#000000',
                            textDecoration: getTextDecorationValue(element),
                            lineHeight: element.lineHeight || 1.35,
                            letterSpacing: element.letterSpacing ? `${element.letterSpacing}px` : 'normal',
                          }}
                        >
                          {renderImportedTextContent(element)}
                        </div>
                      )}
                      {element.textStyle === 'speech' && !editingText && (
                        <div className="absolute -bottom-4 -left-2 w-4 h-4 bg-white rotate-45 border-b-2 border-r-2 border-gray-300 shadow-sm"></div>
                      )}
                      {element.textStyle === 'thought' && !editingText && (
                        <div className="absolute -bottom-2 -left-2 flex">
                          <div className="w-3 h-3 bg-white rounded-full border border-gray-300 shadow-sm"></div>
                          <div className="w-2 h-2 bg-white rounded-full border border-gray-300 -ml-1 mt-1 shadow-sm"></div>
                        </div>
                      )}
                      
                      {/* Botão de áudio para texto */}
                      {element.audio && (
                        <div
                          className="audio-button"
                          style={{
                            position: 'absolute',
                            left: `${element.audioButtonPosition?.x || (element.size.width - 40)}px`,
                            top: `${element.audioButtonPosition?.y || 8}px`,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: '50%',
                            padding: '8px',
                            cursor: 'move',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s',
                            zIndex: 1000,
                            width: '40px',
                            height: '40px',
                            transform: 'translate(-50%, -50%)', // Centraliza o botão no ponto de clique
                          }}
                          onMouseDown={(e) => handleMouseDown(e, element.id)}
                        >
                          <FiMusic color="white" size={20} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Image element */}
                  {element.type === 'image' && (
                    <div className="w-full h-full relative">
                      {/* Drag handle overlay para mover a imagem */}
                      <div className="drag-handle absolute inset-0 z-10 cursor-move"></div>
                      
                      <img 
                        src={element.content} 
                        alt="Content"
                        className="w-full h-full pointer-events-none"
                        style={{ 
                          transform: `
                            rotate(${element.rotation || 0}deg)
                            scaleX(${element.flipH ? -1 : 1})
                            scaleY(${element.flipV ? -1 : 1})
                          `,
                          borderRadius: `${element.imageStyle?.borderRadius || 0}px`,
                          objectFit: element.imageStyle?.objectFit || 'contain',
                          backgroundColor: 'transparent'
                        }}
                      />
                      
                      {/* Botão de áudio para imagem */}
                      {element.audio && (
                        <div
                          className="audio-button"
                          style={{
                            position: 'absolute',
                            left: `${element.audioButtonPosition?.x || (element.size.width - 40)}px`,
                            top: `${element.audioButtonPosition?.y || 8}px`,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: '50%',
                            padding: '8px',
                            cursor: 'move',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s',
                            zIndex: 1000,
                            width: '40px',
                            height: '40px',
                            transform: 'translate(-50%, -50%)', // Centraliza o botão no ponto de clique
                          }}
                          onMouseDown={(e) => handleMouseDown(e, element.id)}
                        >
                          <FiMusic color="white" size={20} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Shape element */}
                  {element.type === 'shape' && (
                    <div className="w-full h-full relative">
                      {/* Forma sempre atrás */}
                      <div className="absolute inset-0 z-0 pointer-events-none">
                        <ShapeElement shape={element.shapeProperties} />
                      </div>
                      {/* Texto sobreposto */}
                      {editingText === element.id ? (
                        <div className="absolute inset-0 z-10 flex items-center justify-center w-full h-full">
                          <textarea
                            ref={textInputRef}
                            value={editingTextValue}
                            onChange={(e) => {
                              setEditingTextValue(e.target.value);
                            }}
                            onBlur={handleFinishShapeTextEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.ctrlKey) {
                                handleFinishShapeTextEdit();
                              }
                            }}
                            className="w-full h-full resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent text-center p-2"
                            style={{
                              fontFamily: element.text?.fontFamily || 'Roboto',
                              fontSize: element.text?.fontSize ? `${element.text.fontSize}px` : '16px',
                              fontWeight: element.text?.fontWeight || 'normal',
                              fontStyle: element.text?.fontStyle || 'normal',
                              textAlign: element.text?.textAlign || 'center',
                              color: element.text?.color || '#000000',
                              overflow: 'hidden',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              boxSizing: 'border-box',
                              background: 'transparent'
                            }}
                            placeholder="Digite seu texto aqui"
                            autoFocus
                          />
                        </div>
                      ) : element.text?.content ? (
                        <div 
                          className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none w-full h-full p-2"
                          style={{
                            fontFamily: element.text?.fontFamily || 'Roboto',
                            fontSize: element.text?.fontSize ? `${element.text.fontSize}px` : '16px',
                            fontWeight: element.text?.fontWeight || 'normal',
                            fontStyle: element.text?.fontStyle || 'normal',
                            textAlign: element.text?.textAlign || 'center',
                            color: element.text?.color || '#000000',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            boxSizing: 'border-box',
                            background: 'transparent'
                          }}
                        >
                          {element.text.content}
                        </div>
                      ) : null}
                      {/* Botão de áudio para forma */}
                      {element.text?.audio && (
                        <div
                          className="audio-button"
                          style={{
                            position: 'absolute',
                            left: `${element.text?.audioButtonPosition?.x || (element.size.width - 40)}px`,
                            top: `${element.text?.audioButtonPosition?.y || 8}px`,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: '50%',
                            padding: '8px',
                            cursor: 'move',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s',
                            zIndex: 1000,
                            width: '40px',
                            height: '40px',
                            transform: 'translate(-50%, -50%)',
                          }}
                          onMouseDown={(e) => {
                            // Reutiliza a lógica de mover botão de áudio
                            if (isPreviewMode) return;
                            e.stopPropagation();
                            const elementId = element.id;
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startPos = {
                              x: element.text?.audioButtonPosition?.x || (element.size.width - 40),
                              y: element.text?.audioButtonPosition?.y || 8
                            };
                            const handleMouseMove = (moveEvent) => {
                              const deltaX = moveEvent.clientX - startX;
                              const deltaY = moveEvent.clientY - startY;
                              let newX = startPos.x + deltaX / (scale || 1);
                              let newY = startPos.y + deltaY / (scale || 1);
                              // Limites básicos
                              if (newX < 0) newX = 0;
                              if (newY < 0) newY = 0;
                              if (newX > element.size.width) newX = element.size.width;
                              if (newY > element.size.height) newY = element.size.height;
                              handleElementChange(elementId, {
                                text: {
                                  ...element.text,
                                  audioButtonPosition: { x: newX, y: newY }
                                }
                              });
                            };
                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove);
                              document.removeEventListener('mouseup', handleMouseUp);
                            };
                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                          }}
                        >
                          <FiMusic color="white" size={20} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Rnd>
            ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de visualização em tamanho real - Aprimorado */}
      {showRealSizePreview && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-2xl overflow-hidden" style={{
            width: `${CANVAS_WIDTH}px`,
            height: `${CANVAS_HEIGHT}px`,
            maxWidth: '90vw',
            maxHeight: '90vh'
          }}>
            {/* Barra do topo com botão para fechar */}
            <div className="absolute top-0 right-0 p-2 z-10">
              <button 
                onClick={toggleRealSizePreview}
                className="bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Indicador de etapas */}
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
              Etapa {currentStep + 1} de {Math.max(...visibleElements.map(el => el.step || 0), 0) + 1}
            </div>
            
            {/* Adicionar indicador de orientação landscape */}
            <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
              Landscape: {CANVAS_WIDTH}x{CANVAS_HEIGHT}px
            </div>
            
            {/* Background da página */}
            <div 
              className="absolute inset-0 w-full h-full"
              style={{
                backgroundImage: page.background ? `url(${page.background})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {/* Renderizar somente elementos visíveis */}
              {visibleElements.map(element => (
                <div
                  key={element.id}
                  className={`absolute ${element.animation ? `animate__animated ${element.animation}` : ''}`}
                  style={{
                    left: `${element.position?.x || 0}px`,
                    top: `${element.position?.y || 0}px`,
                    width: `${element.size?.width || 100}px`,
                    height: element.type === 'image' || element.type === 'shape'
                      ? `${element.size?.height || 200}px` 
                      : (element.size?.height === 'auto' ? 'auto' : `${element.size?.height}px`),
                    zIndex: element.zIndex || 1
                  }}
                >
                  {/* Conteúdo do texto */}
                  {element.type === 'text' && (
                    <div
                      className="w-full h-full p-1"
                      style={{
                        backgroundColor: element.textStyle === 'normal' ? 'transparent' : 'white',
                        border: element.textStyle !== 'normal' ? '2px solid #ddd' : 'none',
                        borderRadius: '8px',
                        ...(element.textStyle === 'speech' && {
                          borderRadius: '8px',
                          padding: '12px',
                          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)'
                        }),
                        ...(element.textStyle === 'thought' && {
                          borderRadius: '50%',
                          padding: '12px',
                          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)'
                        })
                      }}
                    >
                      {renderImportedTextContent(element)}
                      {element.textStyle === 'speech' && (
                        <div className="absolute -bottom-4 -left-2 w-4 h-4 bg-white rotate-45 border-b-2 border-r-2 border-gray-300 shadow-sm"></div>
                      )}
                      {element.textStyle === 'thought' && (
                        <div className="absolute -bottom-2 -left-2 flex">
                          <div className="w-3 h-3 bg-white rounded-full border border-gray-300 shadow-sm"></div>
                          <div className="w-2 h-2 bg-white rounded-full border border-gray-300 -ml-1 mt-1 shadow-sm"></div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Conteúdo da imagem */}
                  {element.type === 'image' && (
                    <div className="w-full h-full">
                      <img 
                        src={element.content} 
                        alt="Content"
                        className="w-full h-full"
                        style={{ 
                          transform: `
                            rotate(${element.rotation || 0}deg)
                            scaleX(${element.flipH ? -1 : 1})
                            scaleY(${element.flipV ? -1 : 1})
                          `,
                          borderRadius: element.imageStyle?.borderRadius || 0,
                          border: element.imageStyle?.border || 'none',
                          boxShadow: element.imageStyle?.shadow || 'none',
                          objectFit: element.imageStyle?.objectFit || 'contain'
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Conteúdo da forma */}
                  {element.type === 'shape' && (
                    <div className="w-full h-full">
                      <ShapeElement shape={element.shapeProperties} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Media Library Modal */}
      {showMediaLibrary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[min(90vh,900px)] overflow-hidden flex flex-col shadow-xl">
            <div className="flex-shrink-0 p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                {mediaSelectionType === 'background' ? 'Selecionar Background' : 
                 mediaSelectionType === 'image' ? 'Selecionar Imagem' : 
                 mediaSelectionType === 'audio' ? 'Selecionar Áudio' : 'Biblioteca de Mídia'}
              </h2>
              <button
                type="button"
                onClick={handleCloseMediaLibrary}
                className="text-gray-500 hover:text-gray-700"
              >
                Fechar
              </button>
            </div>
            
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <MediaLibrary 
                onSelect={handleMediaSelected}
                mediaType={mediaSelectionType}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

CanvasEditor.displayName = 'CanvasEditor';

export default CanvasEditor; 