import { describe, it, expect } from 'vitest';
import { changeMermaidNodeShape } from '../mermaidUtils';

describe('Mermaid Shapes Transitions', () => {
    it('should transition correctly', async () => {
        let code = "flowchart TD\n  A[Hello] --> B";
        
        // 1. Change to Round Edges
        code = await changeMermaidNodeShape(code, "A", "()");
        expect(code).toContain("A(Hello)");
        
        // 2. Change to Round Edges AGAIN
        code = await changeMermaidNodeShape(code, "A", "()");
        expect(code).toContain("A(Hello)");
        
        // 3. Change to Circle (())
        code = await changeMermaidNodeShape(code, "A", "(())");
        expect(code).toContain("A((Hello))");
        
        // 4. Change to Rectangle []
        code = await changeMermaidNodeShape(code, "A", "[]");
        expect(code).toContain("A[Hello]");
        
        // Test implicitly defined node with explicit declaration later
        let code2 = "flowchart TD\n  NodeA --> B\n  NodeA[Node A Text]";
        code2 = await changeMermaidNodeShape(code2, "NodeA", "()");
        expect(code2).toContain("NodeA(Node A Text)");
        expect(code2).not.toContain("NodeA(NodeA)");
        
        // Test implicitly defined node with NO explicit declaration
        let code3 = "flowchart TD\n  NodeA --> B";
        code3 = await changeMermaidNodeShape(code3, "NodeA", "()");
        expect(code3).toContain("NodeA(NodeA)");
    });
});
