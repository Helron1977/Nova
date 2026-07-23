import mermaid from 'mermaid';

// Mock for DOMPurify to avoid the error in Node.js
(global as any).window = {
    DOMPurify: {
        addHook: () => {},
        sanitize: (txt: string) => txt
    }
};

async function extractAST() {
    const code = `flowchart TD
  A[Node A] -->|Link Text| B(Node B)
  style A fill:#f9f`;
  
    try {
        mermaid.initialize({ startOnLoad: false });
        const diagram = await mermaid.mermaidAPI.getDiagramFromText(code);
        
        // getVertices and getEdges usually return Maps or Arrays
        let vertices = diagram.db.getVertices();
        if (vertices instanceof Map) {
            vertices = Object.fromEntries(vertices);
        }
        
        let edges = diagram.db.getEdges();
        
        const astSample = {
            code,
            vertices,
            edges
        };
        
        console.log(JSON.stringify(astSample, null, 2));
    } catch(e) {
        console.error("Error extracting AST:", e);
    }
}

extractAST();
