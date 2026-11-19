const fs = require('fs');
const content = fs.readFileSync('C:/Users/gelso/OneDrive/Desktop/AdNexis-Biziva novo/AdNexis-v4-preview.html', 'utf8');
const scriptStart = content.indexOf('(function () {');
const scriptEnd = content.lastIndexOf('})();');
const jsCode = content.substring(scriptStart, scriptEnd + 5);
let openBraces = 0;
let inString = false;
let stringChar = '';
let escaped = false;
for (let i = 0; i < jsCode.length; i++) {
  const ch = jsCode[i];
  if (inString) {
    if (escaped) {
      escaped = false;
    } else if (ch === '\\') {
      escaped = true;
    } else if (ch === stringChar) {
      inString = false;
    }
  } else {
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
    } else if (ch === '{') openBraces++;
    else if (ch === '}') openBraces--;
  }
  if (openBraces < 0) {
    console.log('Negative braces at position', i, 'context:', jsCode.substring(Math.max(0, i-50), i+50));
    break;
  }
}
console.log('Final brace count:', openBraces);