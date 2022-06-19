# dash-docset-tcapi

腾讯云API文档，云API文档地址：https://cloud.tencent.com/document/api

API例子：https://cloud.tencent.com/document/api/213/15749

## 制作流程

```shell
# 初始化docset,索引DB重新创建
./build.js --init=true

# 爬取HTML源文件，不推荐抓取腾讯云API完整文档，数据量太大
./build.js --crawl=https://cloud.tencent.com/document/api/1207

# 配置info.plist，参考例子https://kapeli.com/resources/Info.plist
vi Info.plist

# 根据source-html，更新索引数据
./build.js --addIndex=true

# 打包
tar --exclude='.DS_Store' -cvzf tcapi.tgz tcapi.docset

# 同步配置文件Info.plist、icon.png
./build.js --syncConfig=true
```

## Dash中订阅文档🔔

浏览器地址栏输入以下地址回车

```
dash-feed://https%3A%2F%2Fraw.githubusercontent.com%2Falanhg%2Fdash-docset-tcapi%2Fmain%2Ffeed.xml
```



