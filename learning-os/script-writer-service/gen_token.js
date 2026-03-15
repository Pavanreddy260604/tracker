
const jwt = require('jsonwebtoken');
const secret = 'your-super-secret-key-change-this-in-production-minimum-32-chars';
const token = jwt.sign({ userId: '696da2938ca947fda22fc8d8' }, secret);
console.log(token);
