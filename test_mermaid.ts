import mermaid from 'mermaid';
// ou import { parse } from '@mermaid-js/parser'; // si installé

async function testAST() {
    const code = `graph TD\n    A[Hard edge] -->|Link text| B(Round edge)\n    B --> C{Decision}`;
    try {
        console.log("=== Using mermaid.parse ===");
        // Initialiser si nécessaire
        mermaid.initialize({ startOnLoad: false });
        const result = await mermaid.parse(code);
        console.log("mermaid.parse result:", JSON.stringify(result, null, 2));
    } catch(e) {
        console.error("mermaid.parse error:", e);
    }
}

testAST();
