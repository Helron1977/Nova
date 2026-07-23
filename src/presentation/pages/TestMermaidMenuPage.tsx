import React, { useState } from 'react';
import MermaidContextMenu from '../components/menus/MermaidContextMenu';

export const TestMermaidMenuPage: React.FC = () => {
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [currentColor, setCurrentColor] = useState('#FF6347');

    const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        setMenuPosition({ x: event.clientX, y: event.clientY });
        setMenuVisible(true);
    };

    const closeMenu = () => setMenuVisible(false);

    return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-700 p-10">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">Page de Test — Mermaid Context Menu</h1>
            <p className="mb-4 text-center text-gray-600 dark:text-gray-400">
                Faites un clic droit dans la zone ci-dessous pour afficher le menu contextuel.
            </p>
            <div
                className="w-3/4 h-64 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 cursor-default select-none"
                onContextMenu={handleContextMenu}
            >
                Zone de Clic Droit
            </div>

            {menuVisible && (
                <MermaidContextMenu
                    x={menuPosition.x}
                    y={menuPosition.y}
                    targetInfo={{ type: 'node', id: 'TestNode', style: { fill: currentColor } } as any}
                    onClose={closeMenu}
                    onAction={(action, _info, val) => {
                        if (action === 'changeColor' && val) setCurrentColor(val);
                    }}
                />
            )}
        </div>
    );
};