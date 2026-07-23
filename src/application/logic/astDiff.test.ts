import { describe, it, expect } from 'vitest';
import { calculateAstDiff, formatDiffAsXML } from './astDiff';
import type { Block } from './markdownParser';

describe('calculateAstDiff', () => {
  it('should detect no changes if blocks are identical', () => {
    const block1: Block = { id: 'b1', type: 'paragraph', rawMarkdown: 'Hello', content: { children: [] }, metadata: { indentationLevel: 0 } };
    const diff = calculateAstDiff([block1], [block1]);
    
    expect(diff.hasChanges).toBe(false);
    expect(diff.totalChanges).toBe(0);
    expect(diff.added.length).toBe(0);
    expect(diff.modified.length).toBe(0);
    expect(diff.deleted.length).toBe(0);
  });

  it('should detect added blocks', () => {
    const block1: Block = { id: 'b1', type: 'paragraph', rawMarkdown: 'Hello', content: { children: [] }, metadata: { indentationLevel: 0 } };
    const block2: Block = { id: 'b2', type: 'paragraph', rawMarkdown: 'World', content: { children: [] }, metadata: { indentationLevel: 0 } };
    
    const diff = calculateAstDiff([block1], [block1, block2]);
    
    expect(diff.hasChanges).toBe(true);
    expect(diff.totalChanges).toBe(1);
    expect(diff.added).toEqual([block2]);
    expect(diff.modified.length).toBe(0);
    expect(diff.deleted.length).toBe(0);
  });

  it('should detect modified blocks', () => {
    const block1: Block = { id: 'b1', type: 'paragraph', rawMarkdown: 'Hello', content: { children: [] }, metadata: { indentationLevel: 0 } };
    const block1Modified: Block = { id: 'b1', type: 'paragraph', rawMarkdown: 'Hello World', content: { children: [] }, metadata: { indentationLevel: 0 } };
    
    const diff = calculateAstDiff([block1], [block1Modified]);
    
    expect(diff.hasChanges).toBe(true);
    expect(diff.totalChanges).toBe(1);
    expect(diff.added.length).toBe(0);
    expect(diff.modified).toEqual([block1Modified]);
    expect(diff.deleted.length).toBe(0);
  });

  it('should detect deleted blocks', () => {
    const block1: Block = { id: 'b1', type: 'paragraph', rawMarkdown: 'Hello', content: { children: [] }, metadata: { indentationLevel: 0 } };
    const block2: Block = { id: 'b2', type: 'paragraph', rawMarkdown: 'World', content: { children: [] }, metadata: { indentationLevel: 0 } };
    
    const diff = calculateAstDiff([block1, block2], [block1]);
    
    expect(diff.hasChanges).toBe(true);
    expect(diff.totalChanges).toBe(1);
    expect(diff.added.length).toBe(0);
    expect(diff.modified.length).toBe(0);
    expect(diff.deleted).toEqual(['b2']);
  });
});

describe('formatDiffAsXML', () => {
  it('should format unchanged diff', () => {
    const diff = { added: [], modified: [], deleted: [], hasChanges: false, totalChanges: 0 };
    expect(formatDiffAsXML(diff)).toBe('<diff status="unchanged" />');
  });

  it('should format added blocks with CDATA rawMarkdown', () => {
    const diff = {
      added: [{ id: 'b1', type: 'paragraph', rawMarkdown: 'Hello World', content: { children: [] }, metadata: { indentationLevel: 0 } } as Block],
      modified: [],
      deleted: [],
      hasChanges: true,
      totalChanges: 1
    };
    const xml = formatDiffAsXML(diff);
    expect(xml).toContain('<added>');
    expect(xml).toContain('<block id="b1" type="paragraph">');
    expect(xml).toContain('<![CDATA[Hello World]]>');
  });

  it('should format modified blocks with CDATA rawMarkdown', () => {
    const diff = {
      added: [],
      modified: [{ id: 'b1', type: 'paragraph', rawMarkdown: 'Updated Text', content: { children: [] }, metadata: { indentationLevel: 0 } } as Block],
      deleted: [],
      hasChanges: true,
      totalChanges: 1
    };
    const xml = formatDiffAsXML(diff);
    expect(xml).toContain('<modified>');
    expect(xml).toContain('<block id="b1" type="paragraph">');
    expect(xml).toContain('<![CDATA[Updated Text]]>');
  });

  it('should format deleted blocks', () => {
    const diff = {
      added: [],
      modified: [],
      deleted: ['b1', 'b2'],
      hasChanges: true,
      totalChanges: 2
    };
    const xml = formatDiffAsXML(diff);
    expect(xml).toContain('<deleted>');
    expect(xml).toContain('<block id="b1" />');
    expect(xml).toContain('<block id="b2" />');
  });
});
