import { redis, Keys } from '../src/infrastructure/redis.js';

async function inspectPool() {
  console.log('--- Redis Question Pool Inspection ---');
  
  try {
    const keys = await redis.keys('questionSet:*');
    console.log(`Found ${keys.length} pools`);
    
    for (const key of keys) {
      const size = await redis.scard(key);
      console.log(`Pool: ${key} | Size: ${size}`);
      
      if (size > 0) {
        const sampleIds = await redis.srandmember(key, 3);
        for (const sampleId of sampleIds) {
          const questionJson = await redis.get(Keys.question(sampleId));
          if (!questionJson) {
            console.log(`  !! Missing data for question: ${sampleId}`);
          } else {
            const q = JSON.parse(questionJson);
            console.log(`  Sample: ${q.title} (${q.slug}) | Diff: ${q.difficulty} | Topics: ${q.topics.join(',')}`);
            if (!q.signatures || !q.testCases || q.testCases.length === 0) {
               console.log(`  !! DATA CORRUPTION in ${q.slug}: missing signatures or test cases`);
            }
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
