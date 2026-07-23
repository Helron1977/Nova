import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNovaSystemContext } from './useNovaSystemContext';
import type { Block } from '../logic/markdownParser';

// Mock dependancies
vi.mock('../logic/astGenerator', () => ({
  buildAST: vi.fn((blocks) => ({ type: 'root', children: blocks })),
  serializeASTToLLMContext: vi.fn(() => '<ast>FULL AST</ast>'),
  generateLLMSystemInstructions: vi.fn(() => 'SYSTEM_INSTRUCTIONS'),
  getOmittedBlockIds: vi.fn(() => ['omitted-1']),
}));

vi.mock('../logic/novaProtocolParser', () => ({
  generateNovaMutationProtocolInstructions: vi.fn(() => 'PROTOCOL_INSTRUCTIONS'),
}));

describe('useNovaSystemContext', () => {
  const block1: Block = { id: 'b1', type: 'paragraph', rawMarkdown: 'Hello', content: { children: [] }, metadata: { indentationLevel: 0 } };
  const block2: Block = { id: 'b2', type: 'paragraph', rawMarkdown: 'World', content: { children: [] }, metadata: { indentationLevel: 0 } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return full AST on first call', () => {
    const { result } = renderHook((props) => useNovaSystemContext(props.blocks, []), {
      initialProps: { blocks: [block1] }
    });

    const { contextString, omittedBlockIds } = result.current();
    expect(contextString).toContain('<ast>FULL AST</ast>');
    expect(contextString).toContain('PROTOCOL_INSTRUCTIONS');
    expect(contextString).toContain('SYSTEM_INSTRUCTIONS');
    expect(contextString).not.toContain('<diff');
    expect(omittedBlockIds).toEqual(['omitted-1']);
  });

  it('should return unchanged diff if blocks are identical on subsequent calls', () => {
    const { result, rerender } = renderHook((props) => useNovaSystemContext(props.blocks, []), {
      initialProps: { blocks: [block1] }
    });

    // First call
    result.current();

    // Rerender with same blocks
    rerender({ blocks: [block1] });
    const { contextString } = result.current();
    
    expect(contextString).toContain('<diff status="unchanged">Le document est inchangé depuis le dernier échange.</diff>');
    expect(contextString).not.toContain('<ast>FULL AST</ast>');
  });

  it('should return xml diff if changes are below threshold', () => {
    const { result, rerender } = renderHook((props) => useNovaSystemContext(props.blocks, []), {
      initialProps: { blocks: [block1] }
    });

    result.current(); // Sync 1

    // Rerender with one addition (threshold is 8)
    rerender({ blocks: [block1, block2] });
    const { contextString } = result.current();
    
    expect(contextString).toContain('<added>');
    expect(contextString).toContain('<![CDATA[World]]>');
    expect(contextString).not.toContain('<ast>FULL AST</ast>');
  });

  it('should fallback to full AST if changes exceed threshold', () => {
    const { result, rerender } = renderHook((props) => useNovaSystemContext(props.blocks, []), {
      initialProps: { blocks: [block1] }
    });

    result.current(); // Sync 1

    // Create 10 new blocks to exceed threshold (8)
    const manyBlocks = Array.from({ length: 10 }).map((_, i) => ({
      id: `new-b${i}`,
      type: 'paragraph' as const,
      rawMarkdown: `New Block ${i}`,
      content: { children: [] },
      metadata: { indentationLevel: 0 }
    }));

    rerender({ blocks: [...manyBlocks] });
    const { contextString } = result.current();
    
    expect(contextString).toContain('<ast>FULL AST</ast>');
    expect(contextString).not.toContain('<added>');
  });
});
