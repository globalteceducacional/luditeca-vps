# LudiTeca CMS

O LudiTeca CMS é um sistema de gerenciamento de conteúdo especializado para criação de livros interativos digitais.

## 🎨 Editor Visual

O editor visual do LudiTeca foi projetado para oferecer uma experiência intuitiva na criação de conteúdo interativo.

### Área de Trabalho

O editor possui duas áreas principais:

- **Área Total do Canvas**: 1024x768 pixels
- **Área Visível no App**: 800x600 pixels (demarcada em vermelho)

A área maior permite flexibilidade na edição, enquanto a demarcação vermelha indica o que será visível no app final.

### Funcionalidades Principais

#### 📝 Elementos de Texto
- Diferentes estilos de texto:
  - Texto Normal
  - Narrativa
  - Balão de Fala
  - Pensamento
- Edição direta no canvas
- Animações personalizáveis

#### 🖼️ Elementos de Imagem
- Upload e gerenciamento de imagens
- Redimensionamento e rotação
- Ajustes de escala e posição
- Efeitos de borda e sombra

#### 🎵 Elementos de Áudio
- Suporte para narração e efeitos sonoros
- Biblioteca de áudio integrada
- Controles de reprodução

#### 🎬 Animações
- Biblioteca de animações pré-definidas:
  - Fade In/Out
  - Slide
  - Zoom
  - Bounce
  - E muito mais

#### 📋 Gerenciamento de Camadas
- Controle de Z-index
- Mover para frente/trás
- Duplicação de elementos
- Exclusão de elementos

### 🛠️ Ferramentas de Edição

#### Grade de Alinhamento
- Grade 3x3 para composição
- Linhas guia centrais
- Margem de segurança (10%)

#### Background
- Suporte para imagens de fundo
- Controles de escala e posição
- Ajuste de opacidade

#### Modo de Visualização
- Preview em tempo real
- Visualização em tamanho real
- Indicador de área visível

### 📱 Responsividade

O editor adapta-se automaticamente ao tamanho da tela, mantendo as proporções corretas e a área de trabalho visível.

### ⚡ Atalhos de Teclado

- `Ctrl + Z`: Desfazer
- `Ctrl + Y`: Refazer
- `Ctrl + C`: Copiar elemento
- `Ctrl + V`: Colar elemento
- `Ctrl + X`: Recortar elemento
- `Delete`: Excluir elemento

### 🎯 Linha do Tempo

- Controle de etapas de animação
- Sequenciamento de elementos
- Controles de reprodução
- Preview de animações

## 🔧 Configuração Técnica

### Requisitos do Sistema

- Node.js (versão recomendada: 14+)
- Next.js 14.2.28
- React 18+

### Instalação

```bash
# Instalar dependências
npm install

# Iniciar em modo desenvolvimento
npm run dev

# Construir para produção
npm run build
```

### Estrutura de Arquivos

```
luditeca-front/
├── components/
│   └── editor/
│       ├── CanvasStageKonva.jsx   # Editor principal (Konva)
│       ├── ProTimeline.js
│       ├── v2/                    # panels/, media/, hooks/, lib/ — ver editor/v2/README.md
│       └── canvas/                # Utilitários de snap/viewport
├── pages/
│   └── books/
│       └── [id]/
│           ├── edit.js            # Reexporta edit-v2
│           └── edit-v2.jsx        # Página de edição do livro
└── README.md
```

## 📚 Guia de Uso

1. **Criar Novo Livro**
   - Acesse a página de livros
   - Clique em "Novo Livro"
   - Configure os detalhes básicos

2. **Editar Páginas**
   - Use a barra de ferramentas superior
   - Adicione elementos arrastando para o canvas
   - Configure propriedades no painel lateral

3. **Gerenciar Mídia**
   - Acesse a biblioteca de mídia
   - Faça upload de arquivos
   - Organize em categorias

4. **Publicar**
   - Revise o conteúdo
   - Verifique animações
   - Publique para visualização

## 🤝 Contribuição

Para contribuir com o projeto:

1. Faça um Fork
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE). 