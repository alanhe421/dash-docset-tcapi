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
options.contentsDir = path.join(options.docsetDir, 'Contents');
options.DocumentsDir = path.join(options.contentsDir, 'Resources', 'Documents');

sqlite3.verbose();

function processDocumentation() {
  let items = [];
  const files = fs.readdirSync(options.sourceDir);
  _.each(files, function (file) {
    items = _.union(items, processDocumentationFile(path.join(options.sourceDir, file)));
  });
  createDB(items);
}

(function main() {
  copyFiles();
  processDocumentation();
})();


function copyFiles() {
  fs.createReadStream('Info.plist').pipe(fs.createWriteStream(path.join(options.contentsDir, 'Info.plist')));
  fs.createReadStream('icon.png').pipe(fs.createWriteStream(path.join(options.docsetDir, 'icon.png')));
  if (!fs.existsSync(path.join(options.DocumentsDir, '_static'))) {
    fs.mkdirSync(path.join(options.DocumentsDir, '_static'));
  }
  fs.createReadStream('_static/documents-202205161915.css').pipe(fs.createWriteStream(path.join(options.DocumentsDir, '_static', '/documents-202205161915.css')));
}


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
  let relativeFilepath = file.replace(options.sourceDir + '/', '');
  /**
   * 函数名称
   */
  let functionNameRegex = /(?<=Action=)[A-Za-z\d]+/;
  let functionName = content.match(functionNameRegex)
  if (functionName) {
    items.push({
      name: functionName[0], type: 'Section', path: relativeFilepath
    })
  }
  let relativePath = file.replace(options.sourceDir, '');
  if (relativePath.includes('/')) {
    fs.mkdirSync(path.join(options.DocumentsDir, relativePath.replace(/\/[^/]+$/, '')), {recursive: true});
  }
  fs.writeFileSync(path.join(options.DocumentsDir, relativePath), htmlProcess(content))
  return items
}

/**
 * HTML处理
 * 删除部分DOM元素
 * 样式调整为本地资源路径
 */
function htmlProcess(htmlCnt) {
  htmlCnt = htmlCnt.replace(/\/\/cloudcache.tencent-cloud.com\/open_proj\/proj_qcloud_v2\/platform\/documents\/css/g, '_static');
  let $ = cheerio.load(htmlCnt);
  // $('#qcportal-kit-topnav').remove();
  $('.qc-scrollbar').remove();
  $('script').remove();
  $('a').each((_, link) => {
    if (link.attribs.href && link.attribs.href.includes('/api')) {
      link.attribs.href = link.attribs.href.replace(/\/document\/api/, 'api') + '.html';
    }
  });
  return $.html();
}

/**
 * 入口名称比如查询一个类，这就是类名称
 * Dash可以识别的类型，见
 * @see https://kapeli.com/docsets#supportedentrytypes
 * @param items
 * @returns {Promise<void>}
 */
async function createDB(items) {
  let sqlFile = path.join(options.contentsDir, 'docSet.dsidx');
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
