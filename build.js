/**
 * 根据爬取的景HTML文件生成docset
 */
const sqlite3 = require('sqlite3')
const _ = require('underscore');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const options = {
  sourceDir: path.join(__dirname + '/test', 'cloud.tencent.com', 'document'), // HTML源文件
  docsetDir: path.join(__dirname + '/tcapi.docset'), // docset目标文件夹
  contentsDir: null, resourceDir: null,
};
const homePage = 'https://cloud.tencent.com/document';
options.contentsDir = path.join(options.docsetDir, 'Contents');
options.ResourcesDir = path.join(options.contentsDir, 'Resources');
options.DocumentsDir = path.join(options.ResourcesDir, 'Documents');

sqlite3.verbose();

function copyDocumentation() {
  let items = [];
  const files = fs.readdirSync(options.sourceDir);
  _.each(files, function (file) {
    items = _.union(items, processDocumentationFile(path.join(options.sourceDir, file)));
  });
  return items;
}

(async function main() {
  const items = copyDocumentation();
  copyConfigFiles();
  await createSqlLiteDB(items);
  console.log('Generate Docset Successfully! ')
})();

function copyConfigFiles() {
  fs.createReadStream('Info.plist').pipe(fs.createWriteStream(path.join(options.contentsDir, 'Info.plist')));
  fs.createReadStream('icon.png').pipe(fs.createWriteStream(path.join(options.docsetDir, 'icon.png')));
}

/**
 * 只处理HTML文件
 */
function processDocumentationFile(file) {
  const items = [];
  if (fs.lstatSync(file).isDirectory()) {
    fs.readdirSync(file).forEach(f => items.push(...processDocumentationFile(path.join(file, f))))
    return items;
  }
  if (!file.match(/.html$/)) {
    return items;
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

  let onlineUrl = `${homePage}/${relativeFilepath.replace(/.html$/, '')}`;
  if (functionNameCN === 'API 概览') {
    items.push({
      name: `${$('.rno-header-crumbs-link-2')[2].attribs.title} > ${functionNameCN}`, type: 'Module', path: onlineUrl
    });
    return items;
  }
  if (functionName) {
    items.push({
      name: `${functionNameCN}(${functionName[0]})`, type: 'Method', path: onlineUrl
    })
  }
  return items
}

/**
 * 入口名称比如查询一个类，这就是类名称
 * Dash可以识别的类型，见
 * @see https://kapeli.com/docsets#supportedentrytypes
 * @param items
 * @returns {Promise<void>}
 */
async function createSqlLiteDB(items) {
  let sqlFile = path.join(options.ResourcesDir, 'docSet.dsidx');
  if (fs.existsSync(sqlFile)) {
    fs.unlinkSync(sqlFile);
  }
  const db = new sqlite3.Database(sqlFile);
  let query = ['CREATE TABLE searchIndex(id INTEGER PRIMARY KEY, name TEXT, type TEXT, path TEXT);', 'CREATE UNIQUE INDEX anchor ON searchIndex (name, type, path);'].join(' ');

  await db.exec(query);

  _.each(items, function (item) {
    const stmt = db.prepare('INSERT INTO searchIndex(name, type, path) VALUES (?, ?, ?)');
    stmt.all(item.name, item.type, item.path)
  });
}
