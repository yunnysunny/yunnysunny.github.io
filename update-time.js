const fs = require('fs');
const path = require('path');
const readline = require('readline');
const simpleGit = require('simple-git');
const git = simpleGit();
const FRONT_STATUS = {
	INIT: 0,
	START: 1,
	END: 2,
};
const FRONT_LINE= '---';
const UPDATE_HEAD = 'updated'
async function updateTimeInFile(inputFile, updatedTime, overwrite=false) {
	const rl = readline.createInterface({
		input: fs.createReadStream(inputFile),
		output: process.stdout,
		terminal: false
	});
	const updatedFile = inputFile + '.tmp'
	const writeStream = fs.createWriteStream(updatedFile, { encoding: 'utf8', autoClose: true });

	let frontStatus = FRONT_STATUS.INIT;
	let timeUpdated = false
	return new Promise((resolve, reject) => {
		rl.on('line', (line) => {
			if (line === FRONT_LINE) {
				frontStatus++
				if (frontStatus === FRONT_STATUS.END && !timeUpdated) {
					writeStream.write(`${UPDATE_HEAD}: ${updatedTime}\n`);
				}
			}		
			if (frontStatus === FRONT_STATUS.START) {
				const reg = /^\s*(\w+):\s*(\w+)\s*$/;
				const result = reg.exec(line);
				if (result && result[1] === UPDATE_HEAD) {
					writeStream.write(`${UPDATE_HEAD}: ${updateTime}\n`);
					timeUpdated = true
				} else {
					writeStream.write(line + '\n');
				}
			} else {
				writeStream.write(line + '\n');
			}
			
		});

		rl.on('close', () => {
			writeStream.end();// emits 'finish' event, executes below statement
		});
		// Replace the original file with the updated file
		writeStream.on('finish', async () => {
			if (!overwrite) {
				resolve();
				return;
			}
			try {
				await _renameFile(updatedFile, inputFile);
				resolve();
			} catch (error) {
				reject(`Error: Error renaming ${updatedFile}  to ${inputFile} => ${error.message}`);
			}
		});
		rl.on('error', (error) => reject(`Error: Error reading ${inputFile} => ${error.message}`));
		writeStream.on('error', (error) => reject(`Error: Error writing to ${updatedFile} => ${error.message}`));
	})
	
}


async function _renameFile(oldPath, newPath) {
  return new Promise((resolve, reject) => {
    fs.rename(oldPath, newPath, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// Testing it...
(async () => {
	const files = await git.raw([ 'ls-files', './source/_posts/*.md']);
	const fileArray = files.split('\n').filter((file) => !!file);
	const promises = fileArray.map(async (file) => {
		const info = await git.log({
			file,
			format: '%ct',
			maxCount : 1,
		});
		console.log(file, info.latest.date)
		await updateTimeInFile(
		  path.join(__dirname, file),
		  info.latest.date,
		  true,
		);
	});
	await Promise.all(promises);

})()