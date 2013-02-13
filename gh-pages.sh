#!/usr/bin/env bash
set -e

rm -fR ./docs
cat ./bin.js | sed 1d > ./bin.js
./../../jsdoc3/jsdoc/jsdoc ./lib ./bin.js ./package.json ./LICENSE ./README.md -d ./docs
git checkout ./bin.js

for file in ./docs/samson/*
do
    VERSION="${file##*/}"
done
echo ${VERSION}

mv ./docs/samson/${VERSION} ./docs/${VERSION}
rm -fR ./docs/samson
ln -sf ${VERSION} ./docs/latest

git checkout gh-pages
git add .
git commit -m "Generated ${VERSION} documentation -> latest"
git checkout master
