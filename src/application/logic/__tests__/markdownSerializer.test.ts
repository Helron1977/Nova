import { markdownToBlocks } from '../markdownParser';
import { blocksToMarkdown } from '../markdownSerializer';
import { Block } from '../markdownParser';

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
    
    it('should perform a round trip with sampleMarkdown', () => {
        // Input Markdown (copié depuis App.tsx)
        const sampleMarkdown = `# Titre Principal\\nCeci est un paragraphe avec du **gras**, de l\'*italique*, du \\\`code inline\\\` et du ~~texte barré~~.\\nVoici aussi un [lien vers Google](https://google.com \\\"Tooltip Google\\\") !\\n\\n## Sous-titre\\n\\n- Liste non ordonnée\\n- Item 2 avec \\\`code\\\`\\n  - Sous-item\\n  - Autre sous-item avec [lien](url)\\n    1. Numéroté\\n    2. Encore un\\n- Item 3\\n\\n1. Liste ordonnée\\n2. Deuxième\\n\\n\\\`\\\`\\\`javascript\\nconsole.log(\\\"Hello, world!\\\");\\n\\\`\\\`\\\`\\n\\n> Ceci est une citation.\\n> Elle peut contenir du *style* et du \\\`code inline\\\`.\\n\\n***\\n\\n| Header 1 | Header 2         |\\n| :------- | :--------------- |\\n| Gauche   | **Centre** gras  |\\n| Test     | *Ici* [lien](url) |\\n| Et \\\`code\\\`| Normal           |\\n\\n![Une image](https://picsum.photos/150 \\\"Titre image\\\")\\n\\n\\\`\\\`\\\`mermaid\\ngraph TD;\\n    A-->B;\\n    A-->C;\\n    B-->D;\\n    C-->D;\\n\\\`\\\`\\\`\\n\\n- [ ] Tâche à faire : utiliser \\\`useEffect\\\`\\n- [x] Tâche faite : ajouter les liens\\n\\nDu <div>HTML</div> brut.\\n`;

        // 1. Parser en blocs
        const blocks: Block[] = markdownToBlocks(sampleMarkdown);

        // 2. Resérialiser en Markdown
        const serializedMarkdown = blocksToMarkdown(blocks);

        // 3. Comparer (POUR L\'INSTANT : échouer pour voir la sortie)
        // Remplacer \"EXPECTED_MARKDOWN_OUTPUT\" par la sortie réelle observée
        // une fois que le sérialiseur est corrigé.
        console.log("--- Serialized Output for sampleMarkdown ---");
        console.log(serializedMarkdown);
        // expect(serializedMarkdown.trim()).toBe("EXPECTED_MARKDOWN_OUTPUT"); // Test échouera
        expect(serializedMarkdown.trim()).toBe(""); // Forcer l\'échec pour voir la sortie
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