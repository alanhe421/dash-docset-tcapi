/**
 * 根据爬取的景HTML文件生成docset
 */
const Sequelize = require('sequelize');
const _ = require('underscore');
const fs = require('fs');
const path = require('path');
const options = {
  docsetDir: path.join(__dirname + '/tcapi.docset'), contentsDir: null, resourceDir: null,
};
options.contentsDir = path.join(options.docsetDir, 'Contents');
options.DocumentsDir = path.join(options.contentsDir, 'Resources', 'Documents');

function processDocumentation() {
  let items = [];
  const files = fs.readdirSync(options.DocumentsDir);
  _.each(files, function (file) {
    items = _.union(items, processDocumentationFile(path.join(options.DocumentsDir, file)));
  });

  createSearchIndex(items);
}

(function main() {
  copyFiles();
  processDocumentation();
})();


function copyFiles() {
  // fs.createReadStream('github.css').pipe(fs.createWriteStream(path.join(options.workDir, options.docSetName, options.documentPath, 'css', 'github.css')));
  fs.createReadStream('Info.plist').pipe(fs.createWriteStream(path.join(options.contentsDir, 'Info.plist')));
  fs.createReadStream('icon.png').pipe(fs.createWriteStream(path.join(options.docsetDir, 'icon.png')));
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

  let relativeFilepath = file.replace(options.DocumentsDir + '/', '');
  /**
   * 函数名称
   */
  let functionNameRegex = /(?<=Action=)[A-Za-z\d]+/;
  let functionSampleRegex = /(?<=<h2 id=".+">)示例/;
  let functionName = content.match(functionNameRegex)
  if (functionName) {
    items.push({
      name: functionName[0], type: 'Guide', path: relativeFilepath
    })
    if (functionSampleRegex) {
      items.push({
        name: functionName[0], type: 'Sample', path: relativeFilepath
      })
    }
  }
  return items
}


function createSearchIndex(items) {
  const sqlitePath = path.join(options.contentsDir, 'docSet.dsidx');

  const seq = new Sequelize('database', 'username', 'password', {
    dialect: 'sqlite', storage: sqlitePath
  });

  const SearchIndex = seq.define('searchIndex', {
    id: {
      type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true
    }, name: { // 入口名称比如查询一个类，这就是类名称
      type: Sequelize.STRING //Dash可以识别的类型，见https://kapeli.com/docsets#supportedentrytypes
    }, type: {
      type: Sequelize.STRING
    }, path: { // 相对路径
      type: Sequelize.STRING
    }
  }, {
    freezeTableName: true, timestamps: false
  });

  SearchIndex.sync().then(function () {
    console.log('success');
    _.each(items, function (item) {
      const searchItem = SearchIndex.build({
        name: item.name, type: item.type, path: item.path
      });
      searchItem.save();
    });
  });
}
