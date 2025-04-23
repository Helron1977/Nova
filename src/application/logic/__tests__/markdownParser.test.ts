import { markdownToBlocks, Block, InlineElement } from '../markdownParser';
// Helper pour simplifier les assertions sur les blocks
// (Vous pourriez vouloir le mettre dans un fichier d'aide séparé si vous en avez beaucoup)
const expectBlock = (block: Block | undefined, type: string, content: any, metadata?: any) => {
expect(block).toBeDefined();
if (!block) return; // Pour la vérification de type de TypeScript
expect(block.type).toBe(type);
expect(block.content).toEqual(content);
if (metadata) {
// Vérifie seulement les clés de metadata spécifiées
Object.keys(metadata).forEach(key => {
expect((block.metadata as any)?.[key]).toEqual(metadata[key]);
});
}
expect(block.id).toBeDefined();
expect(typeof block.id).toBe('string');
};
describe('markdownToBlocks - Basic Elements', () => {
it('should parse an empty string', () => {
const blocks = markdownToBlocks('');
expect(blocks).toEqual([]);
});
it('should parse a simple paragraph', () => {
const markdown = 'Just a paragraph.';
const blocks = markdownToBlocks(markdown);
expect(blocks.length).toBe(1);
expectBlock(blocks[0], 'paragraph', { children: [{ type: 'text', value: 'Just a paragraph.' }] });
});
it('should parse a level 1 heading', () => {
const markdown = '# Title';
const blocks = markdownToBlocks(markdown);
expect(blocks.length).toBe(1);
expectBlock(blocks[0], 'heading', { level: 1, children: [{ type: 'text', value: 'Title' }] });
});
it('should parse a code block', () => {
const markdown = '```js\nconsole.log("hello");\n```';
const blocks = markdownToBlocks(markdown);
expect(blocks.length).toBe(1);
// Note: La valeur peut inclure ou non le \n final selon le parseur exact
expectBlock(blocks[0], 'code', { language: 'js', code: 'console.log("hello");' });
});
it('should parse a paragraph with inline formatting', () => {
const markdown = 'Just a *little* bit of **bold** text.';
const blocks = markdownToBlocks(markdown);
expect(blocks.length).toBe(1);
expectBlock(blocks[0], 'paragraph', { 
  children: [
    { type: 'text', value: 'Just a ' },
    { type: 'emphasis', children: [{ type: 'text', value: 'little' }] },
    { type: 'text', value: ' bit of ' },
    { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
    { type: 'text', value: ' text.' },
  ]
});
});
it('should parse a heading with inline formatting', () => {
const markdown = '## A *Styled* Heading';
const blocks = markdownToBlocks(markdown);
expect(blocks.length).toBe(1);
expectBlock(blocks[0], 'heading', { 
    level: 2, 
    children: [
        { type: 'text', value: 'A ' },
        { type: 'emphasis', children: [{ type: 'text', value: 'Styled' }] },
        { type: 'text', value: ' Heading' },
    ]
});
});
});
describe('markdownToBlocks - Lists', () => {
it('should parse a simple unordered list', () => {
const markdown = `- Item 1\n- Item 2`;
const blocks = markdownToBlocks(markdown);
expect(blocks.length).toBe(2); // Attend 2 listItem blocks
expectBlock(blocks[0], 'listItem', { children: [{ type: 'text', value: 'Item 1' }] }, { depth: 0, ordered: false, checked: null });
expectBlock(blocks[1], 'listItem', { children: [{ type: 'text', value: 'Item 2' }] }, { depth: 0, ordered: false, checked: null });
});
it('should parse a simple ordered list', () => {
const markdown = `1. First\n2. Second`;
const blocks = markdownToBlocks(markdown);
expect(blocks.length).toBe(2);
expectBlock(blocks[0], 'listItem', { children: [{ type: 'text', value: 'First' }] }, { depth: 0, ordered: true, checked: null });
expectBlock(blocks[1], 'listItem', { children: [{ type: 'text', value: 'Second' }] }, { depth: 0, ordered: true, checked: null });
});
it('should parse a nested list', () => {
const markdown = `- Level 1\n  - Level 2a\n  - Level 2b\n- Level 1 again`;
const blocks = markdownToBlocks(markdown);
expect(blocks.length).toBe(4);
expectBlock(blocks[0], 'listItem', { children: [{ type: 'text', value: 'Level 1' }] },        { depth: 0, ordered: false, checked: null });
expectBlock(blocks[1], 'listItem', { children: [{ type: 'text', value: 'Level 2a' }] },       { depth: 1, ordered: false, checked: null });
expectBlock(blocks[2], 'listItem', { children: [{ type: 'text', value: 'Level 2b' }] },       { depth: 1, ordered: false, checked: null });
expectBlock(blocks[3], 'listItem', { children: [{ type: 'text', value: 'Level 1 again' }] },  { depth: 0, ordered: false, checked: null });
});
it('should parse a mixed nested list', () => {
const markdown = `1. Ordered 1\n   - Unordered 2a\n   - Unordered 2b\n2. Ordered 1 again\n   1. Ordered 2c`;
const blocks = markdownToBlocks(markdown);
expect(blocks.length).toBe(5);
expectBlock(blocks[0], 'listItem', { children: [{ type: 'text', value: 'Ordered 1' }] },        { depth: 0, ordered: true, checked: null });
expectBlock(blocks[1], 'listItem', { children: [{ type: 'text', value: 'Unordered 2a' }] },     { depth: 1, ordered: false, checked: null });
expectBlock(blocks[2], 'listItem', { children: [{ type: 'text', value: 'Unordered 2b' }] },     { depth: 1, ordered: false, checked: null });
expectBlock(blocks[3], 'listItem', { children: [{ type: 'text', value: 'Ordered 1 again' }] },  { depth: 0, ordered: true, checked: null });
expectBlock(blocks[4], 'listItem', { children: [{ type: 'text', value: 'Ordered 2c' }] },       { depth: 1, ordered: true, checked: null });
});
it('should parse a task list (GFM)', () => {
const markdown = `- [ ] Todo 1\n- [x] Done 1\n  - [ ] Todo 2\n  - [x] Done 2`;
const blocks = markdownToBlocks(markdown);
expect(blocks.length).toBe(4);
expectBlock(blocks[0], 'listItem', { children: [{ type: 'text', value: 'Todo 1' }] }, { depth: 0, ordered: false, checked: false });
expectBlock(blocks[1], 'listItem', { children: [{ type: 'text', value: 'Done 1' }] }, { depth: 0, ordered: false, checked: true });
expectBlock(blocks[2], 'listItem', { children: [{ type: 'text', value: 'Todo 2' }] }, { depth: 1, ordered: false, checked: false });
expectBlock(blocks[3], 'listItem', { children: [{ type: 'text', value: 'Done 2' }] }, { depth: 1, ordered: false, checked: true });
});
it('should parse a list item with inline formatting', () => {
const markdown = `- Item with **bold** content`;
const blocks = markdownToBlocks(markdown);
expect(blocks.length).toBe(1);
expectBlock(blocks[0], 'listItem', { 
    children: [
        { type: 'text', value: 'Item with ' },
        { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
        { type: 'text', value: ' content' },
    ]
 }, 
// Les métadonnées restent les mêmes
{ depth: 0, ordered: false, checked: null }); 
});
});
describe('markdownToBlocks - Mixed Content', () => {
it('should parse various block types together', () => {
const markdown = `# Title\n\nThis is text.\n\n- List item 1\n- List item 2\n  1. Nested ordered\n\n\`\`\`js\nconsole.log('hello');\n\`\`\`\n\nAnother paragraph.`;
const blocks = markdownToBlocks(markdown);
expect(blocks.length).toBe(7);
expectBlock(blocks[0], 'heading', { level: 1, children: [{ type: 'text', value: 'Title' }] });
expectBlock(blocks[1], 'paragraph', { children: [{ type: 'text', value: 'This is text.' }] });
expectBlock(blocks[2], 'listItem', { children: [{ type: 'text', value: 'List item 1' }] }, { depth: 0, ordered: false, checked: null });
expectBlock(blocks[3], 'listItem', { children: [{ type: 'text', value: 'List item 2' }] }, { depth: 0, ordered: false, checked: null });
expectBlock(blocks[4], 'listItem', { children: [{ type: 'text', value: 'Nested ordered' }] }, { depth: 1, ordered: true, checked: null });
expectBlock(blocks[5], 'code', { language: 'js', code: "console.log('hello');" });
expectBlock(blocks[6], 'paragraph', { children: [{ type: 'text', value: 'Another paragraph.' }] });
});

// TODO: Add tests for other block types (blockquote, thematic break, table, html, image, mermaid)
});

// Ajouter une nouvelle suite pour les autres types de blocs
describe('markdownToBlocks - Other Block Types', () => {

  it('should parse a blockquote', () => {
    const markdown = '> This is a quote.\n> It spans multiple lines.';
    const blocks = markdownToBlocks(markdown);
    expect(blocks.length).toBe(1);
    // Remarque: extractTextContent simpliste joindra les lignes.
    expectBlock(blocks[0], 'blockquote', { children: [{ type: 'text', value: 'This is a quote.\nIt spans multiple lines.' }] });
  });

  it('should parse a thematic break (horizontal rule)', () => {
    const markdown = '***';
    const blocks = markdownToBlocks(markdown);
    expect(blocks.length).toBe(1);
    expectBlock(blocks[0], 'thematicBreak', {});
  });

  it('should parse a table with alignment', () => {
    const markdown = `
| Header 1 | Header 2 | Header 3 |
| :------- | :------: | -------: |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
`;
    const blocks = markdownToBlocks(markdown);
    expect(blocks.length).toBe(1);
    expectBlock(blocks[0], 'table', {
      align: ['left', 'center', 'right'],
      rows: [
        [
          [{ type: 'text', value: 'Header 1' }],
          [{ type: 'text', value: 'Header 2' }],
          [{ type: 'text', value: 'Header 3' }]
        ],
        [
          [{ type: 'text', value: 'Cell 1' }],
          [{ type: 'text', value: 'Cell 2' }],
          [{ type: 'text', value: 'Cell 3' }]
        ],
        [
          [{ type: 'text', value: 'Cell 4' }],
          [{ type: 'text', value: 'Cell 5' }],
          [{ type: 'text', value: 'Cell 6' }]
        ]
      ]
    });
  });

  it('should parse an HTML block', () => {
    const markdown = '<div>Some inline HTML</div>';
    const blocks = markdownToBlocks(markdown);
    expect(blocks.length).toBe(1);
    expectBlock(blocks[0], 'html', { html: '<div>Some inline HTML</div>' });
  });

  it('should parse an image with alt and title', () => {
    const markdown = '![Alt text](https://example.com/image.jpg "Image title")';
    const blocks = markdownToBlocks(markdown);
    expect(blocks.length).toBe(1);
    expectBlock(blocks[0], 'image', {
      src: 'https://example.com/image.jpg',
      alt: 'Alt text',
      title: 'Image title'
    });
  });

   it('should parse a Mermaid block', () => {
    const markdown = '```mermaid\ngraph TD;\n    A-->B;\n```';
    const blocks = markdownToBlocks(markdown);
    expect(blocks.length).toBe(1);
    expectBlock(blocks[0], 'mermaid', { code: 'graph TD;\n    A-->B;' });
  });

  it('should parse a blockquote with inline formatting', () => {
    const markdown = '> Quote with *emphasis*';
    const blocks = markdownToBlocks(markdown);
    expect(blocks.length).toBe(1);
    expectBlock(blocks[0], 'blockquote', {
        children: [
            { type: 'text', value: 'Quote with ' },
            { type: 'emphasis', children: [{ type: 'text', value: 'emphasis' }] },
        ]
    });
  });

  it('should parse inline HTML within a paragraph', () => {
    const markdown = 'Text before <span>My Span</span> text after.';
    const blocks = markdownToBlocks(markdown);
    expect(blocks.length).toBe(1);
    expectBlock(blocks[0], 'paragraph', {
        children: [
            { type: 'text', value: 'Text before ' },
            { type: 'html', value: '<span>' },
            { type: 'text', value: 'My Span' },
            { type: 'html', value: '</span>' },
            { type: 'text', value: ' text after.' },
        ]
    });
  });

  it('should parse a table with inline formatting (simplified check)', () => {
    const markdown = `
| Format   | Example                     |
| :------- | :-------------------------- |
| Bold     | Cell with **bold** text     |
| Italic   | Cell with *italic* content  |
| Code     | Cell with \`inline code\`   |
| Link     | Cell with [a link](url)     |
`;
    const blocks = markdownToBlocks(markdown);
    expect(blocks.length).toBe(1);
    const tableBlock = blocks[0];
    expect(tableBlock.type).toBe('table');
    const rows = (tableBlock as any).content.rows as InlineElement[][][];

    // Vérifier la cellule avec Bold (Ligne 1, Cellule 1)
    const boldCellContent = rows[1][1];
    expect(boldCellContent.some(el => el.type === 'strong')).toBe(true); // Vérifie qu'il y a un élément strong
    expect(boldCellContent.some(el => el.type === 'text' && el.value.includes('Cell with'))).toBe(true); // Vérifie présence texte avant
    expect(boldCellContent.some(el => el.type === 'text' && el.value.includes('text'))).toBe(true); // Vérifie présence texte après (moins strict)

    // Vérifier la cellule avec Italic (Ligne 2, Cellule 1)
    const italicCellContent = rows[2][1];
    expect(italicCellContent.some(el => el.type === 'emphasis')).toBe(true);
    expect(italicCellContent.some(el => el.type === 'text' && el.value.includes('Cell with'))).toBe(true);
    expect(italicCellContent.some(el => el.type === 'text' && el.value.includes('content'))).toBe(true);

    // Vérifier la cellule avec Code (Ligne 3, Cellule 1)
    const codeCellContent = rows[3][1];
    expect(codeCellContent.some(el => el.type === 'inlineCode' && el.value === 'inline code')).toBe(true);
    expect(codeCellContent.some(el => el.type === 'text' && el.value.includes('Cell with'))).toBe(true);

    // Vérifier la cellule avec Link (Ligne 4, Cellule 1)
    const linkCellContent = rows[4][1];
    expect(linkCellContent.some(el => el.type === 'link' && (el as any).url === 'url')).toBe(true);
    expect(linkCellContent.some(el => el.type === 'text' && el.value.includes('Cell with'))).toBe(true);
  });

});

describe('markdownToBlocks - Inline Elements Specifics', () => {

    it('should parse a paragraph with a simple link', () => {
        const markdown = 'Visit [Google](https://google.com).';
        const blocks = markdownToBlocks(markdown);
        expect(blocks.length).toBe(1);
        expectBlock(blocks[0], 'paragraph', {
            children: [
                { type: 'text', value: 'Visit ' },
                {
                    type: 'link',
                    url: 'https://google.com',
                    title: null, // Pas de titre
                    children: [{ type: 'text', value: 'Google' }]
                },
                { type: 'text', value: '.' },
            ]
        });
    });

    it('should parse a paragraph with a link with a title', () => {
        const markdown = 'Check [this link](http://example.com "Tooltip Here").';
        const blocks = markdownToBlocks(markdown);
        expect(blocks.length).toBe(1);
        expectBlock(blocks[0], 'paragraph', {
            children: [
                { type: 'text', value: 'Check ' },
                {
                    type: 'link',
                    url: 'http://example.com',
                    title: 'Tooltip Here', 
                    children: [{ type: 'text', value: 'this link' }]
                },
                { type: 'text', value: '.' },
            ]
        });
    });

    it('should parse a paragraph with a link containing emphasis', () => {
        const markdown = 'A link with [*emphasis*](http://example.com).';
        const blocks = markdownToBlocks(markdown);
        expect(blocks.length).toBe(1);
        expectBlock(blocks[0], 'paragraph', {
            children: [
                { type: 'text', value: 'A link with ' },
                {
                    type: 'link',
                    url: 'http://example.com',
                    title: null,
                    children: [
                        { type: 'emphasis', children: [{ type: 'text', value: 'emphasis' }] }
                    ]
                },
                { type: 'text', value: '.' },
            ]
        });
    });
    
     it('should parse a list item with a link', () => {
        const markdown = '- Item with [a link](url)';
        const blocks = markdownToBlocks(markdown);
        expect(blocks.length).toBe(1);
        expectBlock(blocks[0], 'listItem', { 
            children: [
                { type: 'text', value: 'Item with ' },
                {
                    type: 'link',
                    url: 'url',
                    title: null,
                    children: [{ type: 'text', value: 'a link' }]
                },
            ]
         }, { depth: 0, ordered: false, checked: null }); 
    });

    it('should parse a paragraph with inline code', () => {
        const markdown = 'Use the `console.log()` function.';
        const blocks = markdownToBlocks(markdown);
        expect(blocks.length).toBe(1);
        expectBlock(blocks[0], 'paragraph', {
            children: [
                { type: 'text', value: 'Use the ' },
                { type: 'inlineCode', value: 'console.log()' },
                { type: 'text', value: ' function.' },
            ]
        });
    });

    it('should parse emphasis containing inline code', () => {
        const markdown = 'An *important `variable`* here.';
        const blocks = markdownToBlocks(markdown);
        expect(blocks.length).toBe(1);
        expectBlock(blocks[0], 'paragraph', {
            children: [
                { type: 'text', value: 'An ' },
                {
                    type: 'emphasis',
                    children: [
                        { type: 'text', value: 'important ' },
                        { type: 'inlineCode', value: 'variable' },
                    ]
                },
                { type: 'text', value: ' here.' },
            ]
        });
    });

    it('should parse a list item with inline code', () => {
        const markdown = '- Use `map()` for this.';
        const blocks = markdownToBlocks(markdown);
        expect(blocks.length).toBe(1);
        expectBlock(blocks[0], 'listItem', { 
            children: [
                { type: 'text', value: 'Use ' },
                { type: 'inlineCode', value: 'map()' },
                { type: 'text', value: ' for this.' },
            ]
         }, { depth: 0, ordered: false, checked: null }); 
    });

    it('should parse strikethrough text', () => {
        const markdown = 'This is ~~deleted~~ text.';
        const blocks = markdownToBlocks(markdown);
        expect(blocks.length).toBe(1);
        expectBlock(blocks[0], 'paragraph', {
            children: [
                { type: 'text', value: 'This is ' },
                { type: 'delete', children: [{ type: 'text', value: 'deleted' }] },
                { type: 'text', value: ' text.' },
            ]
        });
    });

    it('should parse strikethrough containing other inline elements', () => {
        const markdown = '~~*Important* deleted part~~.';
        const blocks = markdownToBlocks(markdown);
        expect(blocks.length).toBe(1);
        expectBlock(blocks[0], 'paragraph', {
            children: [
                {
                    type: 'delete',
                    children: [
                        { type: 'emphasis', children: [{ type: 'text', value: 'Important' }] },
                        { type: 'text', value: ' deleted part' },
                    ]
                },
                { type: 'text', value: '.' },
            ]
        });
    });

});