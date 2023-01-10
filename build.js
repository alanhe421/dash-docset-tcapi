#!/usr/bin/env node


/**
 * 根据爬取的景HTML文件生成docset
 */
const yargs = require('yargs/yargs')
const {hideBin} = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv;

const sqlite3 = require('sqlite3')
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const childProcess = require('child_process');
const {XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");

const options = {
  sourceDir: path.join(__dirname, 'source-html', 'cloud.tencent.com', 'document'), // HTML源文件
  docsetDir: path.join(__dirname, 'tcapi.docset'), // docset目标文件夹
  contentsDir: null, resourceDir: null,
};
const homePage = 'https://cloud.tencent.com/document';
options.contentsDir = path.join(options.docsetDir, 'Contents');
options.ResourcesDir = path.join(options.contentsDir, 'Resources');
options.DocumentsDir = path.join(options.ResourcesDir, 'Documents');
let sqlFile = path.join(options.ResourcesDir, 'docSet.dsidx');
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

  // 初始化项目
  if (argv.init) {
    initDocsetFile();
    copyConfigFiles();
    if (fs.existsSync(sqlFile)) {
      fs.unlinkSync(sqlFile);
    }
    connectDB();
    await createDB();
  }
  // 拉取新站点
  if (argv.crawl) {
    crawlSite(argv.crawl);
  }
  // 添加新索引
  if (argv.addIndex) {
    connectDB();
    await parseDocumentationAndFillSearchIndex();
  }
  if (argv.clearIndex) {
    connectDB();
    await clearSearchIndex();
  }
  if (argv.syncConfig) {
    copyConfigFiles();
  }

  if (argv.create) {
    createDocSet();
  }
  if (argv.updateVersion) {
    updateVersion();
  }

  console.timeEnd('Docset making');
  console.log('Generate Docset Successfully! ')
})();

function copyConfigFiles() {
  fs.copyFileSync('Info.plist', path.join(options.contentsDir, 'Info.plist'));
  fs.copyFileSync('icon.png', path.join(options.docsetDir, 'icon.png'));
}

function createInterfaceItems($, onlineUrl) {
  const interfaceEls = $('#docArticleContent h2');
  const items = [];
  for (const interfaceEl of interfaceEls) {
    let interfaceDesc = interfaceEl.next.children[0].data;
    interfaceDesc = interfaceDesc || '';
    // 考虑到美观，做些数据处理
    interfaceDesc = interfaceDesc.replace(/。$/, '');
    const interfaceName = interfaceEl.attribs.id;
    items.push({
      name: formatName(interfaceName, interfaceDesc), type: 'Interface', path: `${onlineUrl}#${interfaceName}`
    })
  }
  return items;
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
  const jquery = cheerio.load(content);
  let relativeFilepath = file.replace(options.sourceDir + '/', '');
  /**
   * 函数名称
   */
  let functionNameRegex = /(?<=Action=)[A-Za-z\d]+/;
  let functionName = content.match(functionNameRegex)
  let functionNameCN = jquery('.rno-title-module-title').text();
  const items = [];
  let onlineUrl = `${homePage}/${relativeFilepath.replace(/.html$/, '')}`;
  const crumbs = jquery('.rno-header-crumbs-link-2'); // 文档中心 > API 中心 > 自动化助手 >
  if (crumbs[2]) {
    onlineUrl = `${onlineUrl}?product=${crumbs[2].attribs.title}`;
    if (functionNameCN === 'API 概览') {
      items.push({
        name: `${formatName(crumbs[2].attribs.title, functionNameCN)}`, type: 'Module', path: onlineUrl
      });
    } else if (functionNameCN === '简介') {
      items.push({
        name: `${formatName(crumbs[2].attribs.title, functionNameCN)}`, type: 'Guide', path: onlineUrl
      });
    } else if (functionNameCN === '数据结构') {
      items.push(...createInterfaceItems(jquery, onlineUrl));
    } else if (functionName) {
      items.push({
        name: `${formatName(functionName[0], functionNameCN)}`, type: 'Method', path: onlineUrl
      })
    }
  }

  items.length > 0 && await fillSearchIndex(items);
  return
}

function connectDB() {
  db = new sqlite3.Database(sqlFile);
}

async function createDB() {
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
      try {
        const stmt = db.prepare('INSERT INTO searchIndex(name, type, path) VALUES (?, ?, ?)');
        stmt.all(item.name, item.type, item.path);
        console.log(`${item.name}-${item.type} write to index success`);
      } catch (e) {
        console.error(e);
      }
      if (index === items.length - 1) {
        resolve();
      }
    });
  })
}

function initDocsetFile() {
  childProcess.execSync('mkdir -p tcapi.docset/Contents/Resources/Documents/');
}

/**
 * 抓取目标网页数据
 * @param site
 */
function crawlSite(site) {
  childProcess.execSync('WGET_CMD=$(which wget)\n' + '\n' + 'if [[ ! -z $WGET_CMD ]]; then\n' + '    brew install wget\n' + 'fi', {stdio: 'inherit'});
  childProcess.execSync(`wget -nc -np --compression=gzip --domains=cloud.tencent.com -e robots=off -P ./source-html --adjust-extension -r '${site}'`, {stdio: 'inherit'});
}

/**
 * 清除搜索索引数据
 * @returns {Promise<unknown>}
 */
function clearSearchIndex() {
  return new Promise(resolve => {
    const stmt = db.prepare('DELETE FROM searchIndex;');
    stmt.all();
    resolve();
  })
}

function formatName(value1, value2) {
  return `${value1} > ${value2}`;
}

/**
 * 参考大小是347KB
 */
function tarDocset() {
  let size = fs.statSync(path.join(__dirname, 'tcapi.tgz')).size;
  console.log('tar docset，之前大小是', size);
  childProcess.execSync(`tar --exclude='.DS_Store' -cvzf tcapi.tgz tcapi.docset`);
  // 获取文件大小
  size = fs.statSync(path.join(__dirname, 'tcapi.tgz')).size;
  console.log('tar docset 最新大小是', size);
}

/**
 * 完整的docset创建流程
 */
async function createDocSet() {
  childProcess.execSync(`rm -rf source-html`);
  childProcess.execSync(`mkdir -p source-html`);
  const productNums = fs.readFileSync(path.join(__dirname, 'products.txt'), {encoding: 'utf-8'}).split('\n').filter(item => item);

  // 初始化DB
  initDocsetFile();
  copyConfigFiles();
  if (fs.existsSync(sqlFile)) {
    fs.unlinkSync(sqlFile);
  }
  connectDB();
  await createDB();

  // 拉取目标产品HTML源文件
  for (const productNumsKey of productNums) {
    try {
      crawlSite(`https://cloud.tencent.com/document/api/${productNumsKey}`);
    } catch (e) {
      console.error(e);
    }
  }

  // 处理非目标产品HTML源文件
  const htmlPath = path.join(options.sourceDir, 'api');
  for (const file of fs.readdirSync(htmlPath)) {
    const b = productNums.some(productNumsKey => productNumsKey === file || productNumsKey === file.replace(/.html$/, ''));
    console.log(b);
    if (!b) {
      childProcess.execSync(`rm -rf ${htmlPath}/${file}`);
    }
  }

  // 生成搜索索引
  await parseDocumentationAndFillSearchIndex();

  // 打包
  tarDocset();

  // updateVersion
  updateVersion();
}


function updateVersion() {
  let xmlPath = path.join(__dirname, 'feed.xml');
  const xmldata = fs.readFileSync(xmlPath, {encoding: 'utf-8'});
  const parser = new XMLParser();
  let jObj = parser.parse(xmldata);

  console.log('updateVersion,之前版本是', jObj);
  const builder = new XMLBuilder();
  let now = new Date();
  jObj.entry.version = [now.getFullYear(), now.getMonth() + 1, now.getTime(),].join('.');

  console.log('updateVersion,新版本是', jObj);
  const xmlContent = builder.build(jObj);
  fs.writeFileSync(xmlPath, xmlContent, {encoding: 'utf-8'});
}
