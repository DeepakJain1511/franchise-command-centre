import { describe, expect, it } from 'vitest';
import { inrLakh, num } from './format';

describe('formatters', () => {
  it('formats lakh and crore', () => {
    expect(inrLakh(25)).toBe('₹25 L');
    expect(inrLakh(120)).toBe('₹1.2 Cr');
    expect(inrLakh(200)).toBe('₹2 Cr');
  });
  it('uses Indian grouping', () => {
    expect(num(120000)).toBe('1,20,000');
  });
});
