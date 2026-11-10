import assert from 'node:assert';
import { isNewer } from './update.js';

assert(isNewer('v2.3.5', '2.3.4'));
assert(isNewer('2.10.0', '2.9.9')); // numbers, not text
assert(isNewer('3.0', '2.9.9'));
assert(!isNewer('v2.3.4', '2.3.4'));
assert(!isNewer('v2.3.3', '2.3.4'));
assert(!isNewer('garbage', '2.3.4'));
console.log('update: ok');
