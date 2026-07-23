import { markdownToBlocks } from './src/application/logic/markdownParser';

const md = `| Colonne 1 | Colonne 2 |
|---|---|
| Ligne 1 | Valeur 1 |
| Ligne 2 | Valeur 2 |`;

console.log(JSON.stringify(markdownToBlocks(md), null, 2));
