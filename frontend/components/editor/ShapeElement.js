import React from 'react';

const ShapeElement = ({ shape, style = {} }) => {
  const renderShape = () => {
    switch (shape.type) {
      case 'rectangle':
        return (
          <div 
            className="w-full h-full"
            style={{
              backgroundColor: shape.fill || '#fcfdff',
              border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`,
              borderRadius: `${shape.borderRadius || 0}px`,
              ...style
            }}
          />
        );
        
      case 'circle':
        return (
          <div 
            className="w-full h-full rounded-full"
            style={{
              backgroundColor: shape.fill || '#fcfdff',
              border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`,
              ...style
            }}
          />
        );
        
      case 'triangle':
        return (
          <div className="w-full h-full relative">
            <div 
              className="absolute w-full h-full"
              style={{
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                backgroundColor: shape.fill || '#fcfdff',
                border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`,
                ...style
              }}
            />
          </div>
        );
        
      case 'star':
        return (
          <div className="w-full h-full relative">
            <div 
              className="absolute w-full h-full"
              style={{
                clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                backgroundColor: shape.fill || '#fcfdff',
                border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`,
                ...style
              }}
            />
          </div>
        );
        
      case 'arrow':
        return (
          <div className="w-full h-full relative">
            <div 
              className="absolute w-full h-full"
              style={{
                clipPath: 'polygon(0% 30%, 70% 30%, 70% 0%, 100% 50%, 70% 100%, 70% 70%, 0% 70%)',
                backgroundColor: shape.fill || '#fcfdff',
                border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`,
                ...style
              }}
            />
          </div>
        );
        
      case 'line':
        return (
          <div className="w-full h-full flex items-center">
            <div 
              className="w-full"
              style={{
                height: `${shape.borderWidth || 2}px`,
                backgroundColor: shape.borderColor || '#0d0d0d',
                ...style
              }}
            />
          </div>
        );
        
      // Balão de fala com rotação e inversão
      case 'speechBubbleLeft':
        // Determinar o path do balão com base na inversão
        const bubblePath = shape.flipX 
          ? `
            M 190,10 
            L 10,10 
            Q 0,10 0,20 
            L 0,130 
            Q 0,140 10,140 
            L 150,140
            L 170,150
            L 170,140
            L 190,140 
            Q 200,140 200,130 
            L 200,20 
            Q 200,10 190,10
          `
          : `
            M 10,10 
            L 190,10 
            Q 200,10 200,20 
            L 200,130 
            Q 200,140 190,140 
            L 50,140
            L 30,150
            L 30,140
            L 10,140 
            Q 0,140 0,130 
            L 0,20 
            Q 0,10 10,10
          `;
        
        return (
          <div className="w-full h-full relative">
            <svg 
              viewBox="0 0 200 150" 
              preserveAspectRatio="none"
              className="w-full h-full"
              style={{
                transform: `rotate(${shape.rotation || 0}deg)`,
                transformOrigin: 'center'
              }}
            >
              {/* Balão de fala como um único path */}
              <path
                d={bubblePath}
                fill={shape.fill || '#fcfdff'}
                stroke={shape.borderColor || '#0d0d0d'}
                strokeWidth={shape.borderWidth || 2}
                strokeLinejoin="round"
              />
            </svg>
          </div>
        );
         
      case 'thoughtBubble':
        // Definir a posição da ponta do balão de pensamento
        const pointPosition = shape.pointPosition || 'bottom';
        
        return (
          <div className="w-full h-full relative">
            {/* Corpo principal do balão */}
            <div 
              className="absolute w-full h-full rounded-full"
              style={{
                backgroundColor: shape.fill || '#fcfdff',
                border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`,
                ...style
              }}
            />
            
            {/* Bolhas de pensamento - posição esquerda */}
            {pointPosition === 'left' && (
              <>
                <div 
                  className="absolute w-5 h-5 rounded-full left-0 top-1/2 transform -translate-x-8 -translate-y-1/2"
                  style={{
                    backgroundColor: shape.fill || '#fcfdff',
                    border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`
                  }}
                />
                <div 
                  className="absolute w-3 h-3 rounded-full left-0 top-1/2 transform -translate-x-12 -translate-y-1/2"
                  style={{
                    backgroundColor: shape.fill || '#fcfdff',
                    border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`
                  }}
                />
              </>
            )}
            
            {/* Bolhas de pensamento - posição direita */}
            {pointPosition === 'right' && (
              <>
                <div 
                  className="absolute w-5 h-5 rounded-full right-0 top-1/2 transform translate-x-8 -translate-y-1/2"
                  style={{
                    backgroundColor: shape.fill || '#fcfdff',
                    border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`
                  }}
                />
                <div 
                  className="absolute w-3 h-3 rounded-full right-0 top-1/2 transform translate-x-12 -translate-y-1/2"
                  style={{
                    backgroundColor: shape.fill || '#fcfdff',
                    border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`
                  }}
                />
              </>
            )}
            
            {/* Bolhas de pensamento - posição inferior (padrão) */}
            {pointPosition === 'bottom' && (
              <>
                <div 
                  className="absolute w-5 h-5 rounded-full right-6 -bottom-6"
                  style={{
                    backgroundColor: shape.fill || '#fcfdff',
                    border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`
                  }}
                />
                <div 
                  className="absolute w-3 h-3 rounded-full right-2 -bottom-8"
                  style={{
                    backgroundColor: shape.fill || '#fcfdff',
                    border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`
                  }}
                />
              </>
            )}
          </div>
        );
        
      // Balão de grito (com pontas)
      case 'shoutBubble':
        return (
          <div className="w-full h-full relative">
            <div 
              className="absolute w-full h-full"
              style={{
                clipPath: 'polygon(0% 25%, 15% 0%, 30% 25%, 45% 0%, 60% 25%, 75% 0%, 90% 25%, 100% 10%, 100% 90%, 90% 75%, 75% 100%, 60% 75%, 45% 100%, 30% 75%, 15% 100%, 0% 75%)',
                backgroundColor: shape.fill || '#fcfdff',
                border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`,
                ...style
              }}
            />
          </div>
        );
        
      // Balão oval com path único e ponta lateral
      case 'ovalBubble':
        const isFlip = shape.flipX;
        const centerY = 80;
        const pontaAltura = 12;
        const pontaLargura = 30;
      
        const pontaBaseY1 = centerY - pontaAltura;
        const pontaBaseY2 = centerY + pontaAltura;
        const pontaBaseX = isFlip ? 50 : 150;
        const pontaVx = isFlip ? pontaBaseX - pontaLargura : pontaBaseX + pontaLargura;
        const pontaVy = centerY;
      
        return (
          <div className="w-full h-full relative">
            <svg
              viewBox="0 0 200 160"
              preserveAspectRatio="none"
              className="w-full h-full"
              style={{
                transform: `rotate(${shape.rotation || 0}deg)`,
                transformOrigin: 'center'
              }}
            >
              {/* Oval principal */}
              <ellipse
                cx="100"
                cy="80"
                rx="65"
                ry="60"
                fill={shape.fill || '#fcfdff'}
                stroke={shape.borderColor || '#0d0d0d'}
                strokeWidth={shape.borderWidth || 2}
              />
      
              {/* Ponta - preenchimento sem stroke para não gerar linha preta */}
              <polygon
                points={`${pontaBaseX},${pontaBaseY1} ${pontaVx},${pontaVy} ${pontaBaseX},${pontaBaseY2}`}
                fill={shape.fill || '#fcfdff'}
                stroke="none"
              />
      
              {/* Ponta - borda externa */}
              <polyline
                points={`${pontaBaseX},${pontaBaseY1} ${pontaVx},${pontaVy} ${pontaBaseX},${pontaBaseY2}`}
                fill="none"
                stroke={shape.borderColor || '#0d0d0d'}
                strokeWidth={shape.borderWidth || 2}
              />
            </svg>
          </div>
        );
      
        
      default:
        return (
          <div 
            className="w-full h-full"
            style={{
              backgroundColor: shape.fill || '#fcfdff',
              border: `${shape.borderWidth || 2}px solid ${shape.borderColor || '#0d0d0d'}`,
              ...style
            }}
          />
        );
    }
  };

  return renderShape();
};

export default ShapeElement; 