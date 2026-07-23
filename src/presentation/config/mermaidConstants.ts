/**
 * Defines the standard supported Mermaid edge styles for flowchart diagrams.
 * Used for context menu options and parsing/manipulating edge definitions.
 */
export const MERMAID_EDGE_STYLES: ReadonlyArray<string> = [
    '---',  // Solid line
    '-->',  // Solid line with arrow
    '-.-',  // Dotted line
    '-.->', // Dotted line with arrow
    '===',  // Thick line
    '==>'   // Thick line with arrow
] as const;

/**
 * Defines the standard supported Mermaid node shapes for flowchart diagrams.
 * Includes display name and bracket syntax for parsing and context menu options.
 * The order can influence parsing if multiple shapes share start/end characters.
 * Place longer/more specific brackets first.
 */
export const nodeShapes: ReadonlyArray<{ brackets: string; name: string; parseInfo?: { start: string; end: string; depth: number } }> = [
    // Longest/most specific first
    { brackets: '(())', name: 'Circle', parseInfo: { start: '((', end: '))', depth: 2 } },
    { brackets: '[()]', name: 'Cylinder', parseInfo: { start: '[(', end: ')]', depth: 2 } },
    { brackets: '([])', name: 'Stadium', parseInfo: { start: '([', end: '])', depth: 2 } },
    { brackets: '{{}}', name: 'Hexagon', parseInfo: { start: '{{', end: '}}', depth: 2 } },
    // Note: Regex for parallelograms/trapezoids in mermaidUtils might need adjustment if these specific bracket types are critical
    { brackets: '[\\\\]', name: 'Parallelogram Alt', parseInfo: { start: '[/', end: '/]', depth: 2 } }, // Check legacy code if important
    { brackets: '[//]', name: 'Parallelogram', parseInfo: { start: '[\\', end: '\\]', depth: 2 } }, // Check legacy code if important
    { brackets: '[/\\]', name: 'Trapezoid', parseInfo: { start: '[\\', end: '/]', depth: 2 } },
    { brackets: '[\\/]', name: 'Trapezoid Alt', parseInfo: { start: '[/', end: '\\]', depth: 2 } },
    // Shorter/more general next
    { brackets: '[]', name: 'Rectangle', parseInfo: { start: '[', end: ']', depth: 1 } },
    { brackets: '()', name: 'Round Edges', parseInfo: { start: '(', end: ')', depth: 1 } },
    { brackets: '{}', name: 'Rhombus', parseInfo: { start: '{', end: '}', depth: 1 } },
    { brackets: '>]', name: 'Message Right', parseInfo: { start: '>', end: ']', depth: 1 } },
] as const;

// --- Configuration Values --- (Placeholder for future additions)

export const MERMAID_HIGHLIGHT_COLOR = 'blue';
export const MERMAID_HIGHLIGHT_WIDTH = '3px';
export const MERMAID_HITBOX_WIDTH = '25px';
export const MERMAID_COLOR_DEBOUNCE = 300; // ms 