import React from 'react';

interface CustomListWrapperProps {
  ordered: boolean;
  children: React.ReactNode;
}

const CustomListWrapper: React.FC<CustomListWrapperProps> = ({ ordered, children }) => {
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag>{children}</Tag>;
};

export default CustomListWrapper; 