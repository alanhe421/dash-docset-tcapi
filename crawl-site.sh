WGET_CMD=$(which wget)

if [[ ! -z $WGET_CMD ]]; then
    brew install wget
fi
wget -nc -np --compression=gzip --domains=cloud.tencent.com -e robots=off -P ./source-html --adjust-extension -r 'https://cloud.tencent.com/document/api'
