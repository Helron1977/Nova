import React from 'react';

interface InputProps {
  placeholder?: string;
  // Ajouter d'autres props basiques si évident (ex: onChange)
}

const Input: React.FC<InputProps> = ({ placeholder }) => {
  return <input placeholder={placeholder ?? 'Input'} />;
};

export default Input;