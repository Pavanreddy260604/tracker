import { redis, Keys } from '../backend/src/infrastructure/redis.js';

async function inspectPool() {
  console.log('--- Redis Question Pool Inspection ---');
  
  try {
    const keys = await redis.keys('questionSet:*');
    console.log(`Found ${keys.length} pools`);
    
    for (const key of keys) {
      const size = await redis.scard(key);
      console.log(`Pool: ${key} | Size: ${size}`);
      
      if (size > 0) {
        const sampleId = await redis.srandmember(key);
        if (sampleId) {
          const questionJson = await redis.get(Keys.question(sampleId));
          if (!questionJson) {
            console.log(`  !! Missing data for question: ${sampleId}`);
          } else {
            const q = JSON.parse(questionJson);
            console.log(`  Sample: ${q.title} (${q.slug}) | Difficulty: ${q.difficulty}`);
          }
        }
      }
    }
    
    const allQuestions = await redis.keys('question:data:*');
    console.log(`Total unique questions in Redis: ${allQuestions.length}`);
  } catch (err) {
    console.error('Inspection failed:', err);
  } finally {
    process.exit(0);
  }
}

inspectPool();
