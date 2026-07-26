import type { BlockModule } from '../../interfaces/blockModule';
// Remarquez que CsvModuleRenderer est importé AVANT sa création, c'est OK pour TS.
import { CsvModuleRenderer } from './CsvModuleRenderer'; 
import { PinoLogger } from '../../../infrastructure/logging/PinoLogger';
import { TableProperties } from 'lucide-react';

const logger = new PinoLogger();

export interface CsvTableData {
  headers: string[];
  rows: string[][];
  rawCsv: string; 
  // Des champs comme alignements, thème pourraient être ajoutés ici plus tard
}

// Logique de parsing CSV (adaptée de CsvTableRenderer.tsx)
// Cette fonction prend le contenu CSV brut et le transforme en structure de données.
const parseCsvToData = (csvContent: string): { headers: string[], rows: string[][] } => {
    if (!csvContent || typeof csvContent !== 'string') { // Ajout d'une vérification pour csvContent
        logger.warn("[CsvTableModule] csvContent est vide ou n'est pas une chaîne. Retourne une structure vide.");
        return { headers: [], rows: [] };
    }
    try {
        const lines = csvContent.trim().split(/\r?\n/);
        if (lines.length === 0) return { headers: [], rows: [] };

        // Regex pour parser une ligne CSV, gérant les cellules entre guillemets.
        const parseCsvLine = (line: string): string[] => {
            const regex = /(?:"([^"]*(?:""[^"]*)*)"|([^,]+)|(?=,)|(?=$))/g;
            const cells: string[] = [];
            let match;
    
            // Protection contre les lignes excessivement longues ou les boucles infinies potentielles
            let safetyCounter = 0;
            const MAX_CELLS_PER_LINE = 1000; // Limite arbitraire pour la sécurité
    
            while ((match = regex.exec(line)) !== null && safetyCounter < MAX_CELLS_PER_LINE) {
                safetyCounter++;
                if (match[1] !== undefined) {
                    cells.push(match[1].replace(/""/g, '"'));
                } else if (match[2] !== undefined) {
                    cells.push(match[2].trim());
                } else {
                    cells.push('');
                }
    
                // Si la correspondance était de longueur nulle (par exemple, une assertion comme (?=,) ou (?=$))
                // et que lastIndex n'a pas progressé, nous devons le forcer à progresser pour éviter une boucle infinie.
                if (match.index === regex.lastIndex && match[0] === '') {
                    regex.lastIndex++;
                }
                
                // Si nous avons terminé la ligne ou si le prochain caractère n'est pas une virgule,
                // cela signifie que nous avons traité la dernière cellule ou une cellule avant la fin.
                // La logique principale de la regex devrait gérer la plupart des cas, 
                // mais on s'assure de ne pas sauter une virgule inutilement si on est déjà à la fin.
                if (regex.lastIndex < line.length && line[regex.lastIndex] === ',') {
                   regex.lastIndex++; // Sauter la virgule pour la prochaine itération
                }
            }
            if (safetyCounter >= MAX_CELLS_PER_LINE) {
                logger.warn(`[CsvTableModule] parseCsvLine a atteint la limite de ${MAX_CELLS_PER_LINE} cellules pour la ligne: "${line.substring(0,100)}..."`);
            }
            return cells;
        };
        
        const headersRaw = parseCsvLine(lines[0]);
        let headers = headersRaw;
        // AJOUT: Vérifier et supprimer un dernier header vide
        if (headers.length > 1 && headers[headers.length - 1] === '') {
            logger.debug("[CsvTableModule] parseCsvToData: Dernier header est vide, suppression.");
            headers = headers.slice(0, -1);
        }
        
        const parsedRows = lines.slice(1).map(line => parseCsvLine(line));

        const numHeaders = headers.length;
        const consistentRows = parsedRows.map(row => {
            if (row.length < numHeaders) {
                return [...row, ...Array(numHeaders - row.length).fill('')];
            } else if (row.length > numHeaders) {
                return row.slice(0, numHeaders);
            }
            return row;
        });
        return { headers, rows: consistentRows };
    } catch (error) {
        logger.error("[CsvTableModule] Erreur lors du parsing du CSV:", error, {csvContentPreview: csvContent.substring(0, 200)});
        return { headers: [], rows: [] }; 
    }
};

const CsvTableModule: BlockModule<CsvTableData> = {
  type: 'csvTableBlock', // Le type de bloc unique que ce module gère
  displayName: 'Tableau CSV', // Ajout pour la créabilité potentielle
  menuIcon: TableProperties,
  codeBlockLanguage: 'csv', // MODIFIÉ: de codeLanguage à codeBlockLanguage
  // paletteLabel et paletteKeyword retirés car le tableau est déjà présent en dur dans les baseOptions du menu (+)


  parseContent: (rawContent: string, blockId: string): CsvTableData => {
    logger.debug(`[CsvTableModule] Parsing CSV pour le bloc ${blockId}. Contenu brut (début): "${rawContent.substring(0, 100)}..."`);
    const parsedData = parseCsvToData(rawContent);
    return {
      headers: parsedData.headers,
      rows: parsedData.rows,
      rawCsv: rawContent, // On stocke le CSV brut pour l'édition et la resérialisation
    };
  },

  // Le composant React qui rendra ce bloc.
  // Il sera créé dans src/application/modules/csvTable/CsvModuleRenderer.tsx
  RendererComponent: CsvModuleRenderer,

  // Convertit les données custom du bloc en une chaîne (pour la sauvegarde Markdown par exemple)
  serializeContent: (customData: CsvTableData): string => {
    // Pour le moment, on retourne simplement le CSV brut qui a été stocké.
    // Si on permettait la modification des `headers` et `rows` via une UI plus riche,
    // il faudrait reconstruire la chaîne CSV ici.
    logger.debug('[CsvTableModule] serializeContent appelé. Retourne rawCsv.');
    return customData.rawCsv;
  },

  // NOUVELLE FONCTION pour sérialiser en HTML
  serializeToHTML: (customData: CsvTableData): string => {
    const escapeHtml = (unsafe: string): string => {
      if (typeof unsafe !== 'string') {
        // Gérer les cas où unsafe n'est pas une chaîne (par exemple, si une cellule est undefined ou null)
        return ''; 
      }
      return unsafe
           .replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")
           .replace(/>/g, "&gt;")
           .replace(/"/g, "&quot;")
           .replace(/'/g, "&#039;");
    };

    let html = '<div class="nova-csv-table-container" style="overflow-x: auto; border: 1px solid #ccc; padding: 10px; margin-bottom: 1em;">';
    html += '<table class="nova-csv-table" style="border-collapse: collapse; width: 100%;">';
    
    // En-têtes
    if (customData.headers && customData.headers.length > 0) {
      html += '<thead><tr>';
      customData.headers.forEach(header => {
        html += `<th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2;">${escapeHtml(header)}</th>`;
      });
      html += '</tr></thead>';
    }

    // Lignes du corps
    if (customData.rows && customData.rows.length > 0) {
      html += '<tbody>';
      customData.rows.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
          html += `<td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(cell)}</td>`;
        });
        // S'assurer que chaque ligne a le même nombre de cellules que d'en-têtes pour la validité HTML
        const headerCount = customData.headers ? customData.headers.length : 0;
        if (row.length < headerCount) {
          for (let i = row.length; i < headerCount; i++) {
            html += '<td style="border: 1px solid #ddd; padding: 8px;"></td>'; // Cellules vides
          }
        }
        html += '</tr>';
      });
      html += '</tbody>';
    }
    
    html += '</table>';
    html += '</div>';
    logger.debug('[CsvTableModule] serializeToHTML appelé. HTML généré.');
    return html;
  },
  
  // getBlockActions: (block, { onUpdateBlockContent }) => {
  //   return [
  //     {
  //       label: 'Editer CSV (Texte)',
  //       action: () => { /* Logique pour ouvrir un éditeur de texte brut si nécessaire */ },
  //     }
  //   ];
  // }

  getAIASTNode: (block: any): Record<string, any> => {
    const data = block.content?.customBlockData as CsvTableData | undefined;
    return {
      type: 'csvTableBlock',
      columns: data?.headers || [],
      rowCount: data?.rows?.length || 0,
      contentSummary: "[CSV_DATA_OMITTED_FOR_TOKENS]",
    };
  },
  getAIPrompt: () => `[csv] Tableau de données CSV éditable. Syntaxe: \`\`\`csv\ncol1,col2,col3\nval1,val2,val3\n\`\`\` Utilise CE FORMAT (et non la syntaxe Markdown \`| col |\`) quand les données sont nombreuses ou nécessitent une édition cellule par cellule.`.trim(),
  
  helpDescription: `
Ce bloc affiche un **tableau de données** avec des fonctionnalités avancées (tri, édition cellule par cellule) basé sur le format CSV.

### Syntaxe
Le bloc attend des données séparées par des virgules (CSV standard). La première ligne est toujours considérée comme la ligne d'en-tête (colonnes).

\`\`\`csv
Nom,Âge,Ville
Alice,30,Paris
Bob,25,Lyon
Charlie,35,Marseille
\`\`\`

**Note :**
Ce format est préféré aux tableaux Markdown (\`| Colonne |\`) lorsque les données sont volumineuses ou qu'elles nécessitent d'être éditées facilement avec l'interface type tableur incluse dans le bloc.
`
};

export default CsvTableModule;