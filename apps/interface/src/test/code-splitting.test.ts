import * as fs from 'fs';
import * as path from 'path';

describe('Code Splitting', () => {
  it('should have lazy component exports', () => {
    const lazyComponentsPath = path.join(process.cwd(), 'src/lib/lazy-components.ts');
    const content = fs.readFileSync(lazyComponentsPath, 'utf-8');
    
    expect(content).toContain('LazyDashboard');
    expect(content).toContain('LazyCampaignCreate');
    expect(content).toContain('LazyPledgeModal');
    expect(content).toContain('dynamic');
  });

  it('should use dynamic imports for route-based splitting', () => {
    const lazyComponentsPath = path.join(process.cwd(), 'src/lib/lazy-components.ts');
    const content = fs.readFileSync(lazyComponentsPath, 'utf-8');
    
    expect(content).toContain("import('@/app/[locale]/dashboard/page')");
    expect(content).toContain("import('@/app/[locale]/create/page')");
  });

  it('should configure loading states for lazy components', () => {
    const lazyComponentsPath = path.join(process.cwd(), 'src/lib/lazy-components.ts');
    const content = fs.readFileSync(lazyComponentsPath, 'utf-8');
    
    expect(content).toContain('loading:');
    expect(content).toContain('ssr:');
  });
});
