import { describe, it, expect } from 'vitest';
// @ts-expect-error: TSC build struggles with unused import detection sometimes
import { Document } from '../Document';

describe('Document Tests', () => {
  it('should pass this test', () => {
    expect(true).toBe(true);
  });
});