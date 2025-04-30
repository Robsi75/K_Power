microsoft-translate
==============

Microsoft Translator module for node.js

## Installation

```js
$ npm install microsoft-translate
```

## API

```js
var translator = require('microsoft-translate.js').init({
    client_id: 'your_client_id', 
    client_secret: 'your_client_secret',
    azure_client_secret: 'your_azure_client_secret'
});

var obj = {
	text: 'M277dw에 종이 문서를 올려놓고, 스마트폰으로 스캔 명령을 내린 뒤 해당 파일을 스마트폰에 즉시 저장할 수 있다.'
	target: 'en',
	model: 'nmt' // enum nmt|smt
};
translator.translate(obj, function(err, res) {
  console.log(err, res);
});
```

## Reference

Please refer to [this link](https://msdn.microsoft.com/en-us/library/hh456380.aspx) for the
complete list of the languages supported by BING.