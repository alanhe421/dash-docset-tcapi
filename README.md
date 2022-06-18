# dash-docset-tcapi
腾讯云API文档，云API文档地址：https://cloud.tencent.com/document/api

API例子：https://cloud.tencent.com/document/api/213/15749

## 制作流程

```shell
# 爬取HTML源文件
./crawl-site.sh

# 初始化docset
mkdir -p tcapi.docset/Contents/Resources/Documents/

# 配置info.plist，参考例子https://kapeli.com/resources/Info.plist
vi Info.plist

# 创建索引
cd tcapi.docset/Contents/Resources
sqlite3 docSet.dsidx

# 
```


