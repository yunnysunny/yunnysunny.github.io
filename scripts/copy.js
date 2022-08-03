const fs = require('fs');
const path = require('path');

// fs.readdirSync(path.join(__dirname, '../'))
fs.cp(
    path.join(__dirname, '../source/_posts/images'), 
    path.join(__dirname, '../docs/images'), 
    { recursive: true }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
});
