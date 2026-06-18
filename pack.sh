#!/bin/sh
# Zip the extension for distribution / Chrome Web Store upload.
rm -f hackernewscomments.zip
zip -r -FS hackernewscomments.zip \
  manifest.json content.js markdown.js styles.css \
  popup.html popup.js popup.css vendor icons README.md
