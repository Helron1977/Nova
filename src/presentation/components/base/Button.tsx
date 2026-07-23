import React from 'react';

// Définition des variants et tailles possibles
const variants = {
  default: "bg-blue-500 hover:bg-blue-600 text-white",
  outline: "border border-gray-300 hover:bg-gray-100 text-gray-700 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-700",
  ghost: "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200",
  destructive: "bg-red-500 hover:bg-red-600 text-white",
};

const sizes = {
  sm: "px-3 py-1 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  // onClick est déjà inclus dans React.ButtonHTMLAttributes<HTMLButtonElement>
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className, // Permet de surcharger ou d'ajouter des classes
  ...props // Récupère onClick, disabled, type, etc.
}) => {
  const variantClasses = variants[variant] || variants.default;
  const sizeClasses = sizes[size] || sizes.md;

  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none ${variantClasses} ${sizeClasses} ${className || ''}`}
      {...props} // Applique onClick, disabled, etc.
    >
      {children ?? 'Button'}
    </button>
  );
};

export default Button;