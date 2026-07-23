import { JSDOM } from 'jsdom';
const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;

import mermaid from 'mermaid';

async function testAST() {
    const code = `flowchart TD\n    A[Hard edge] -->|Link text| B(Round edge)\n    B --> C{Decision}`;
    try {
        console.log("=== Using mermaid.parse with JSDOM ===");
        mermaid.initialize({ startOnLoad: false });
        const result = await mermaid.parse(code);
        // mermaid.parse returns { config: any, diagram: any } in v11?
        // Let's log the keys and structure
        console.log("Keys:", Object.keys(result));
        if ('diagram' in result) {
            const resultDiagram = (result as any).diagram;
            console.log("Diagram keys:", Object.keys(resultDiagram));
            console.log("Diagram type:", resultDiagram.type);
            console.log("Diagram parser:", resultDiagram.parser);
        }
        // Let's print the actual AST if available
        // Usually diagram.parser.yy gets populated, or there is an AST property.
        console.log("Result dump:", JSON.stringify(result, null, 2).substring(0, 1500));
    } catch(e) {
        console.error("parser error:", e);
    }
}

testAST();
