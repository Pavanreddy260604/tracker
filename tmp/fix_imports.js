import fs from 'fs';
import path from 'path';

const baseDir = 'p:/Time pass/New folder/AI-SAAS-APP/backend/src';

const mappings = [
    { dir: 'routes/script-writer', depth: 2 },
    { dir: 'services/script-writer', depth: 2 },
    { dir: 'models/script-writer', depth: 2 }
];

function fixImports(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Fix models imports
    content = content.replace(/from '\.\.\/models\/([^']+)'/g, (match, model) => {
        return `from '../../models/script-writer/${model}.js'`;
    });

    // 2. Fix services imports (for routes)
    content = content.replace(/from '\.\.\/services\/([^']+)'/g, (match, service) => {
        return `from '../../services/script-writer/${service}.js'`;
    });

    // 3. Fix prompts imports
    content = content.replace(/from '\.\.\/prompts\/([^']+)'/g, (match, prompt) => {
        return `from '../../prompts/${prompt}.js'`;
    });

    // 4. Fix utils imports
    content = content.replace(/from '\.\.\/utils\/([^']+)'/g, (match, util) => {
        return `from '../../utils/script-writer/${util}.js'`;
    });

    // 5. Fix middleware imports
    content = content.replace(/from '\.\.\/middleware\/([^']+)'/g, (match, mw) => {
        if (mw === 'auth.js') return `from '../../middleware/auth.middleware.js'`;
        return `from '../../middleware/script-writer/${mw}.js'`;
    });

    // 6. Fix local sibling imports (add .js if missing)
    content = content.replace(/from '\.\/([^'.\/]+)'/g, "from './$1.js'");
    
    // 7. Fix User model import to point to the SaaS one if needed, 
    // but the script-writer might have its own User extensions? 
    // SaaS uses models/user.model.js
    content = content.replace(/from '\.\.\/\.\.\/models\/script-writer\/User\.js'/g, "from '../../models/user.model.js'");

    fs.writeFileSync(filePath, content);
}

mappings.forEach(m => {
    const fullPath = path.join(baseDir, m.dir);
    if (!fs.existsSync(fullPath)) return;
    const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.ts'));
    files.forEach(f => fixImports(path.join(fullPath, f)));
});

console.log('Imports updated.');
