import React, { ReactNode } from 'react';
// Supprimer les imports non utilisés si ReactMarkdown et mermaid ne sont plus gérés ici
// import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm';
// import mermaid from 'mermaid'; 

// Définir les types pour les props, notamment 'children'
interface MainContentProps {
  children: ReactNode; // Rendre children requis car c'est le seul contenu maintenant
}

// Supprimer le contenu Markdown statique
/*
const initialMarkdownContent = ` ... `;
*/

const MainContent: React.FC<MainContentProps> = ({ children }) => {

  // Supprimer le useEffect lié au rendu Mermaid statique d'ici
  /*
  useEffect(() => {
    try {
      mermaid.run({ nodes: document.querySelectorAll('.language-mermaid') });
    } catch (e) {
      console.error("Erreur lors du rendu Mermaid après montage:", e);
    }
  }, []); 
  */

  return (
    <main className="flex-grow container mx-auto p-4">
      {/* Supprimer le rendu ReactMarkdown statique */}
      {/* 
      <div className="prose dark:prose-invert lg:prose-xl max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
        >
          {staticContentForNow}
        </ReactMarkdown>
      </div>
      */}

      {/* Rend seulement les composants enfants passés à MainContent */}
      {children}
    </main>
  );
};

export default MainContent;
