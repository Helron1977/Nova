import React from 'react';

interface ListProps {
  items: string[];
  // Ajouter d'autres props basiques si évident (ex: renderItem)
}

const List: React.FC<ListProps> = ({ items }) => {
  return <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
};

export default List;