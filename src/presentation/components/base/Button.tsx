import React from 'react';

interface ButtonProps {
  children?: React.ReactNode;
  // Ajouter d'autres props basiques si évident (ex: onClick)
}

const Button: React.FC<ButtonProps> = ({ children }) => {
  return <button>{children ?? 'Button'}</button>;
};

export default Button;