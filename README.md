# dash-docset-tcapi


[![Docset Recreate](https://github.com/alanhg/dash-docset-tcapi/actions/workflows/docset.yml/badge.svg?branch=main)](https://github.com/alanhg/dash-docset-tcapi/actions/workflows/docset.yml)

腾讯云API文档，云API文档地址：https://cloud.tencent.com/document/api

API例子：https://cloud.tencent.com/document/api/213/15749

![](./docs/screenshot.gif)

## 制作流程

```shell

# 完整docset制作
./build.js --create=true


# 初始化docset,索引DB重新创建
./build.js --init=true

# 爬取HTML源文件，不推荐抓取腾讯云API完整文档，数据量太大
./build.js --crawl=https://cloud.tencent.com/document/api/1207

# 配置info.plist，参考例子https://kapeli.com/resources/Info.plist
vi Info.plist

# 根据source-html，更新索引数据
./build.js --addIndex=true

# 清除索引数据
./build.js --clearIndex=true

# 打包
tar --exclude='.DS_Store' -cvzf tcapi.tgz tcapi.docset

# 同步配置文件Info.plist、icon.png
./build.js --syncConfig=true


./build.js --updateVersion=true
```

## Dash中订阅文档🔔

已接入CI，每周自动更新。浏览器地址栏输入以下地址回车。

```
dash-feed://https%3A%2F%2Fraw.githubusercontent.com%2Falanhg%2Fdash-docset-tcapi%2Fmain%2Ffeed.xml
```

## 说明

文档全量数据太多，这里按需只爬取了云服务器/轻量云服务器/自动化助手等部分文档，如需其它部分，可以fork repo手动修改products.txt。

API文档地址：https://cloud.tencent.com/document/api

1. 云服务器：https://cloud.tencent.com/document/api/213
2. 访问管理：https://cloud.tencent.com/document/api/598
3. 轻量云服务器： https://cloud.tencent.com/document/api/1207
4. 自动化助手：https://cloud.tencent.com/document/api/1340
5. 私有网络：https://cloud.tencent.com/document/api/215

