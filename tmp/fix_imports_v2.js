import fs from 'fs';
import path from 'path';

const baseDir = 'p:/Time pass/New folder/AI-SAAS-APP/backend/src';

const mappings = [
    { dir: 'routes/script-writer', depth: 2 },
    { dir: 'services/script-writer', depth: 2 },
    { dir: 'models/script-writer', depth: 2 },
    { dir: 'prompts', depth: 1 }
];

function fixImports(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Correct model imports in services/routes
    // original: ../models/Script
    // new: ../../models/script-writer/Script.js
    content = content.replace(/from '\.\.\/models\/([^']+)'/g, (match, model) => {
        // if file is in routes/script-writer or services/script-writer, they are depth 2.
        // ../models moves up 1.
        return `from '../../models/script-writer/${model}.js'`;
    });

    // 2. Correct service imports in routes
    content = content.replace(/from '\.\.\/services\/([^']+)'/g, (match, service) => {
        return `from '../../services/script-writer/${service}.js'`;
    });

    // 3. Correct prompt imports
    content = content.replace(/from '\.\.\/prompts\/([^']+)'/g, (match, prompt) => {
        return `from '../../prompts/${prompt}.js'`;
    });

    // 4. Correct util imports
    content = content.replace(/from '\.\.\/utils\/([^']+)'/g, (match, util) => {
        return `from '../../utils/script-writer/${util}.js'`;
    });

    // 5. Correct middleware imports
    content = content.replace(/from '\.\.\/middleware\/auth.js'/g, "from '../../middleware/auth.middleware.js'");

    // 6. Fix local sibling imports (add .js and ensure they stay local)
    content = content.replace(/from '\.\/([^'.\/]+)'/g, (match, sib) => {
        if (sib.endsWith('.js')) return match;
        return `from './${sib}.js'`;
    });

    // 7. Fix User model to SaaS User model
    content = content.replace(/from '\.\.\/\.\.\/models\/script-writer\/User\.js'/g, "from '../../models/user.model.js'");
    content = content.replace(/from '\.\.\/models\/User\.js'/g, "from '../../models/user.model.js'");

    fs.writeFileSync(filePath, content);
}

mappings.forEach(m => {
    const fullPath = path.join(baseDir, m.dir);
    if (!fs.existsSync(fullPath)) return;
    const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    files.forEach(f => fixImports(path.join(fullPath, f)));
});

console.log('Imports fixed thoroughly.');
