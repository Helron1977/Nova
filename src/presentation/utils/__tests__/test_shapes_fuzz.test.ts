import { describe, it, expect } from 'vitest';
import { changeMermaidNodeShape } from '../mermaidUtils';

describe('Mermaid Shapes Transitions Fuzzing', () => {
    it('should not create triple brackets', async () => {
        let code = "flowchart TD\n  B[Décision] --> C";
        const shapes = ['()', '(())', '([])', '{{}}', '[]'];
        
        // Fuzzing all transitions
        for (const shape1 of shapes) {
            let code1 = await changeMermaidNodeShape(code, "B", shape1);
            for (const shape2 of shapes) {
                let code2 = await changeMermaidNodeShape(code1, "B", shape2);
                if (code2.includes('(((') || code2.includes(')))')) {
                    console.log(`Failed transition: ${shape1} -> ${shape2}`);
                    console.log(`Result: ${code2}`);
                    throw new Error("Created triple brackets!");
                }
            }
        }
        
        // What if implicit?
        let codeImplicit = "flowchart TD\n  B --> C";
        for (const shape1 of shapes) {
            let code1 = await changeMermaidNodeShape(codeImplicit, "B", shape1);
            for (const shape2 of shapes) {
                let code2 = await changeMermaidNodeShape(code1, "B", shape2);
                if (code2.includes('(((') || code2.includes(')))')) {
                    console.log(`Implicit Failed transition: ${shape1} -> ${shape2}`);
                    console.log(`Result: ${code2}`);
                    throw new Error("Created triple brackets!");
                }
            }
        }

        // What if code has A(Hello) and we change B?
        let codeOther = "flowchart TD\n  A(Hello) --> B\n  B(Décision)";
        let codeOther1 = await changeMermaidNodeShape(codeOther, "B", "(())");
        console.log("Other 1:", codeOther1);
        let codeOther2 = await changeMermaidNodeShape(codeOther1, "B", "(())");
        console.log("Other 2:", codeOther2);
        
        expect(codeOther2).not.toContain('(((');
    });
});
