// Modules
import { customAlphabet } from 'nanoid';
import config from './config.js';

// Default hardcoded values
let alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
let customlength = 10;

// Gets from config if defined
if (config.cid && config.cid.alphabet) alphabet = config.cid.alphabet;
if (config.cid && config.cid.length) customlength = config.cid.length;

// Create custom nanoid
const customnanoid = customAlphabet(alphabet, customlength);

const re = new RegExp('[' + alphabet + ']{' + customlength + '}');

// Implements the public methods of shortid module with nanoid and export them
function generate() {
  return customnanoid();
}

function isValid(id) {
  return re.test(id);
}

export { generate, isValid };

export default {
  generate,
  isValid
};
