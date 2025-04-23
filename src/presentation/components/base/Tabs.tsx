import React from 'react';

interface TabsProps {
  children?: React.ReactNode;
  // Ajouter d'autres props basiques si évident (ex: onChange)
}

const Tabs: React.FC<TabsProps> = ({ children }) => {
  return <div className="tabs">{children}</div>;
};

export default Tabs;