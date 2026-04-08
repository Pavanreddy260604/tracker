const fs = require('fs');
const path = require('path');

const services = [
  { name: 'api-gateway', port: 3000 },
  { name: 'auth-service', port: 3001 },
  { name: 'workout-service', port: 3002 },
  { name: 'nutrition-service', port: 3003 },
  { name: 'coach-service', port: 3004 }
];

const tsconfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "rootDir": "./src",
    "outDir": "./dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  }
}`;

for (const svc of services) {
  const dir = path.join(__dirname, svc.name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const src = path.join(dir, 'src');
  if (!fs.existsSync(src)) fs.mkdirSync(src);

  fs.writeFileSync(path.join(dir, 'tsconfig.json'), tsconfig);
  
  let indexContent = `import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
`;
  
  if (svc.name === 'api-gateway') {
    indexContent += `import morgan from 'morgan';\n`;
  }

  indexContent += `
dotenv.config();

const app = express();
const PORT = process.env.PORT || ${svc.port};

app.use(helmet());
app.use(cors());
app.use(express.json());
`;

  if (svc.name === 'api-gateway') {
    indexContent += `app.use(morgan('dev'));\n`;
  }

  indexContent += `
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: '${svc.name}' });
});

app.listen(PORT, () => {
  console.log(\`${svc.name} running on port \${PORT}\`);
});
`;

  fs.writeFileSync(path.join(src, 'index.ts'), indexContent);
}

console.log('Setup complete');
