import { describe, it, expect } from 'vitest';
import { extractFirstCompleteMutation } from '../novaProtocolParser';

describe('extractFirstCompleteMutation', () => {
  it('should extract a complete INSERT tag in one chunk', () => {
    const buffer = '<nova:insert after="123">Hello World</nova:insert>';
    const result = extractFirstCompleteMutation(buffer);
    
    expect(result).not.toBeNull();
    expect(result?.mutation.type).toBe('INSERT');
    expect((result?.mutation as any).afterId).toBe('123');
    expect((result?.mutation as any).markdownContent).toBe('Hello World');
    expect(result?.endIndex).toBe(buffer.length);
  });

  it('should extract a self-closing DELETE tag', () => {
    const buffer = '<nova:delete id="123" />';
    const result = extractFirstCompleteMutation(buffer);
    
    expect(result).not.toBeNull();
    expect(result?.mutation.type).toBe('DELETE');
    expect((result?.mutation as any).blockId).toBe('123');
    expect(result?.endIndex).toBe(buffer.length);
  });

  it('should return null if the tag is incomplete', () => {
    const buffer = '<nova:update id="123">Hello ';
    const result = extractFirstCompleteMutation(buffer);
    expect(result).toBeNull();
  });

  it('should extract the first complete tag and return correct endIndex if there is more content', () => {
    const buffer = 'some text before <nova:say>Hi</nova:say> some text after <nova:insert';
    const result = extractFirstCompleteMutation(buffer);
    
    expect(result).not.toBeNull();
    expect(result?.mutation.type).toBe('AI_MESSAGE');
    expect((result?.mutation as any).content).toBe('Hi');
    
    // The endIndex should point to exactly after </nova:say>
    const expectedSub = buffer.substring(0, result!.endIndex);
    expect(expectedSub).toBe('some text before <nova:say>Hi</nova:say>');
  });

  it('should return null and wait if the first opened tag is not yet closed', () => {
    const buffer = '<nova:update id="123">Content without closing tag. <nova:delete id="456"/>';
    const result = extractFirstCompleteMutation(buffer);
    
    // Since <nova:update> is the first tag found, and it has no closing tag,
    // the parser returns null, waiting for the rest of the stream.
    expect(result).toBeNull(); 
  });
});
