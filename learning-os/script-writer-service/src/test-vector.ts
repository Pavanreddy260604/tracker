import { vectorService } from './services/vector.service';

console.log('✅ Vector Service imported successfully');

// Optional: Try to instantiate or check properties
try {
    const isService = vectorService instanceof Object;
    console.log(`✅ Vector Service instance check: ${isService}`);
} catch (error) {
    console.error('❌ Error checking service:', error);
}

process.exit(0);
