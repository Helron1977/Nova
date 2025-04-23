import React from 'react';
// Plus besoin de useEffect ou useRef ici
// Plus besoin d'importer mermaid ou uuid

interface MermaidDiagramProps {
  code: string;
}

// Supprimer l'initialisation d'ici
/*
mermaid.initialize({ 
  startOnLoad: false, 
  theme: 'base', 
});
*/

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ code }) => {

  // Rendre simplement un div avec la classe "mermaid"
  // et le code brut à l'intérieur.
  // mermaid.run() appelé dans App.tsx trouvera cette classe.
  return (
    <div className="mermaid">
      {code}
    </div>
  );
};

export default MermaidDiagram; 