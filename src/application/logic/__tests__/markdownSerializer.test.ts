import { markdownToBlocks } from '../markdownParser';
import { blocksToMarkdown } from '../markdownSerializer';

describe('Markdown Serialization (blocksToMarkdown)', () => {

    it('should correctly serialize basic blocks back to Markdown', () => {
        const originalMarkdown = `# Heading 1\\n\\nThis is a paragraph.\\n\\n- List item 1\\n- List item 2\\n\\n\\\`\\\`\\\`js\\nconsole.log(\"test\");\\n\\\`\\\`\\\`\\n\\n> A quote.\\n\\n***`;

        const blocks = markdownToBlocks(originalMarkdown);
        const serializedMarkdown = blocksToMarkdown(blocks);

        // Comparaison ligne par ligne après nettoyage (trimming)
        const originalLines = originalMarkdown.trim().split('\\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
        const serializedLines = serializedMarkdown.trim().split('\\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

        // Log pour débogage
        // console.log(\"--- Original ---\");
        // console.log(originalMarkdown);
        // console.log(\"--- Serialized ---\");
        // console.log(serializedMarkdown);
        // console.log(\"--- Original Lines ---\");
        // console.log(originalLines);
        // console.log(\"--- Serialized Lines ---\");
        // console.log(serializedLines);

        // La comparaison exacte peut être délicate à cause des variations (ex: nb espaces, sauts de ligne finaux)
        // Pour un test simple, vérifions la longueur et quelques éléments clés.
        // Idéalement, il faudrait parser à nouveau serializedMarkdown et comparer les ASTs.
        expect(serializedLines.length).toBe(originalLines.length);
        expect(serializedLines[0]).toBe('# Heading 1');
        expect(serializedLines[1]).toBe('This is a paragraph.');
        expect(serializedLines[2]).toBe('- List item 1');
        expect(serializedLines[5]).toContain('console.log(\"test\")');
        expect(serializedLines[4]).toBe('```js');
        expect(serializedLines[6]).toBe('```');
        expect(serializedLines[7]).toBe('> A quote.');
        expect(serializedLines[8]).toBe('***');
    });
    
    // TODO: Ajouter des tests plus spécifiques pour :
    // - Listes imbriquées (ordonnées/non ordonnées/tâches)
    // - Numérotation des listes ordonnées
    // - Tables (une fois implémenté)
    // - Blocs HTML
    // - Images
    // - Mermaid
    // - Inline formatting complexe
    // - Échappement des caractères

}); 