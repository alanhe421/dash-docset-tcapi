/**
 * 根据爬取的景HTML文件生成docset
 */
const sqlite3 = require('sqlite3')
const _ = require('underscore');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const childProcess = require('child_process');

const options = {
  sourceDir: path.join(__dirname, 'source-html', 'cloud.tencent.com', 'document'), // HTML源文件
  docsetDir: path.join(__dirname, 'tcapi.docset'), // docset目标文件夹
  contentsDir: null, resourceDir: null,
};
const homePage = 'https://cloud.tencent.com/document';
options.contentsDir = path.join(options.docsetDir, 'Contents');
options.ResourcesDir = path.join(options.contentsDir, 'Resources');
options.DocumentsDir = path.join(options.ResourcesDir, 'Documents');

sqlite3.verbose();
let db;

async function parseDocumentationAndFillSearchIndex() {
  const files = fs.readdirSync(options.sourceDir);
  for (const file of files) {
    await processDocumentationFile(path.join(options.sourceDir, file))
  }
}

(async function main() {
  console.log('Generate Docset start');
  console.time('Docset making');

  initDocsetFile();
  copyConfigFiles();
  await createDB();
  await parseDocumentationAndFillSearchIndex();

  console.timeEnd('Docset making');
  console.log('Generate Docset Successfully! ')
})();

function copyConfigFiles() {
  fs.createReadStream('Info.plist').pipe(fs.createWriteStream(path.join(options.contentsDir, 'Info.plist')));
  fs.createReadStream('icon.png').pipe(fs.createWriteStream(path.join(options.docsetDir, 'icon.png')));
}

/**
 * 只处理HTML文件
 */
async function processDocumentationFile(file) {
  if (fs.lstatSync(file).isDirectory()) {
    for (const f of fs.readdirSync(file)) {
      await processDocumentationFile(path.join(file, f));
    }
    return;
  }
  if (!file.match(/.html$/)) {
    return;
  }
  let content = fs.readFileSync(file, 'utf-8');
  const $ = cheerio.load(content);
  let relativeFilepath = file.replace(options.sourceDir + '/', '');
  /**
   * 函数名称
   */
  let functionNameRegex = /(?<=Action=)[A-Za-z\d]+/;
  let functionName = content.match(functionNameRegex)
  let functionNameCN = $('.rno-title-module-title').text();
  const items = [];

  let onlineUrl = `${homePage}/${relativeFilepath.replace(/.html$/, '')}`;
  if (functionNameCN === 'API 概览' && $('.rno-header-crumbs-link-2')[2]) {
    items.push({
      name: `${$('.rno-header-crumbs-link-2')[2].attribs.title} > ${functionNameCN}`, type: 'Module', path: onlineUrl
    });
  } else if (functionNameCN === '简介' && $('.rno-header-crumbs-link-2')[2]) {
    items.push({
      name: `${$('.rno-header-crumbs-link-2')[2].attribs.title} > ${functionNameCN}`, type: 'Guide', path: onlineUrl
    });
  } else if (functionName) {
    items.push({
      name: `${functionName[0]}(${functionNameCN})`, type: 'Method', path: onlineUrl
    })
  }
  items.length > 0 && await fillSearchIndex(items);
  return
}

async function createDB() {
  let sqlFile = path.join(options.ResourcesDir, 'docSet.dsidx');
  if (fs.existsSync(sqlFile)) {
    fs.unlinkSync(sqlFile);
  }
  db = new sqlite3.Database(sqlFile);
  let query = ['CREATE TABLE searchIndex(id INTEGER PRIMARY KEY, name TEXT, type TEXT, path TEXT);', 'CREATE UNIQUE INDEX anchor ON searchIndex (name, type, path);'].join(' ');
  await db.exec(query);
}

/**
 * 入口名称比如查询一个类，这就是类名称
 * Dash可以识别的类型，见
 * @see https://kapeli.com/docsets#supportedentrytypes
 * @param items
 * @returns {Promise<void>}
 */
function fillSearchIndex(items) {
  return new Promise(resolve => {
    items.forEach(function (item, index) {
      const stmt = db.prepare('INSERT INTO searchIndex(name, type, path) VALUES (?, ?, ?)');
      stmt.all(item.name, item.type, item.path);
      console.log(`${item.name}-${item.type} write to index success`);
      if (index === items.length - 1) {
        resolve();
      }
    });
  })
}

function initDocsetFile() {
  childProcess.execSync('mkdir -p tcapi.docset/Contents/Resources/Documents/');
}
