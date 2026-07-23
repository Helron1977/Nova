import { parse } from '@mermaid-js/parser';

async function testAST() {
    const code = `flowchart TD\n    A[Hard edge] -->|Link text| B(Round edge)\n    B --> C{Decision}`;
    try {
        console.log("=== Using @mermaid-js/parser ===");
        const result = parse(code);
        console.log("AST result:", JSON.stringify(result, null, 2));
    } catch(e) {
        console.error("parser error:", e);
    }
}

testAST();
