import React from 'react';

interface CardProps {
  children?: React.ReactNode;
  // Ajouter d'autres props basiques si évident (ex: title)
}

const Card: React.FC<CardProps> = ({ children }) => {
  return <div className="card">{children}</div>;
};

export default Card;