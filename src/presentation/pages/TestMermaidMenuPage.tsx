import React, { useState } from 'react';
import { MermaidContextMenu } from '../components/menus/MermaidContextMenu'; // Ajuster le chemin si nécessaire

// Données de formes factices pour le test
const mockShapes = [
    { name: 'Rectangle', brackets: '[]', iconClass: '' },
    { name: 'Circle', brackets: '(())', iconClass: '' },
    { name: 'Round Edges', brackets: '()', iconClass: '' },
    { name: 'Stadium', brackets: '([])', iconClass: '' },
    { name: 'Cylinder', brackets: '[()]', iconClass: '' },
    { name: 'Rhombus', brackets: '{}', iconClass: '' },
    { name: 'Hexagon', brackets: '{{}}', iconClass: '' },
    // Ajouter d'autres formes si besoin pour tester le scroll/rendu
];

export const TestMermaidMenuPage: React.FC = () => {
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [currentColor, setCurrentColor] = useState('#FF6347'); // Commencer avec une couleur visible

    const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault(); // Empêcher le menu contextuel natif
        setMenuPosition({ x: event.clientX, y: event.clientY });
        setMenuVisible(true);
        console.log('Context menu requested at:', {x: event.clientX, y: event.clientY});
    };

    const closeMenu = () => {
        setMenuVisible(false);
        console.log('Closing context menu');
    };

    const handleShapeSelected = (brackets: string) => {
        console.log(`Shape selected: ${brackets}`);
        // Mettre à jour la couleur juste pour voir un changement visuel lors du test
        const randomColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
        setCurrentColor(randomColor);
    };
    
    // Placeholder pour la gestion du changement de couleur (non implémenté dans ce focus visuel)
    const handleColorChange = (color: string) => {
        console.log(`Color change requested: ${color}`);
        // setCurrentColor(color); // Activer ceci quand la logique de sélection sera implémentée
    }

    return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-700 p-10">
             <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">Page de Test pour Mermaid Context Menu</h1>
            <p className="mb-4 text-center text-gray-600 dark:text-gray-400">
                Faites un clic droit dans la zone ci-dessous pour afficher le menu contextuel personnalisé.
            </p>
            <div 
                className="w-3/4 h-64 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 cursor-default select-none"
                onContextMenu={handleContextMenu} // Détecter le clic droit ici
            >
                Zone de Clic Droit
            </div>

            {/* Rendu conditionnel du menu contextuel */}
            <MermaidContextMenu 
                isVisible={menuVisible}
                position={menuPosition}
                shapes={mockShapes}
                selectedColor={currentColor}
                onClose={closeMenu}
                onShapeSelect={handleShapeSelected}
                onColorChange={handleColorChange}
            />
        </div>
    );
}; 