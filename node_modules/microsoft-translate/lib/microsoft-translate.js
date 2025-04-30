var https = require('https'),
  http = require('http'),
  request = require('request');
  querystring = require('querystring'),
  client = {},
  credentials = {},
  regx = /<string [a-zA-Z0-9=":/.]+>(.*)<\/string>/;

if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require('node-localstorage').LocalStorage;
  localStorage = new LocalStorage('/tmp/bing-translate');
}
var ACCESS_TOKEN_VALID_MILSEC	= 599*1000;

exports.init = function(clientSecret){
  client.credentials = clientSecret;
  return client;
}

client.parseXHTMLString = function(text){
  return text.replace(/\\u000a/gi,'\n')
             .replace(/\\/g,'')
             .replace(/"/g,'');
}

client.translate = function(obj, callback){
  client.getToken(client.credentials, function(err, token) {
      var text = obj.text;
      var from = obj.source;
      var to = obj.target;
      var category = 'general';
      if (obj.model === 'nmt') {
          category = 'generalnn';
      }

      var pathString = '';
      if(from) {
          pathString = '/V2/Http.svc/Translate?text='+encodeURIComponent(text)+'&from='+from+'&to='+to+'&contentType=text/plain&category=' + category;
      } else {
          pathString = '/V2/Http.svc/Translate?text='+encodeURIComponent(text)+'&to='+to+'&contentType=text/plain&category=' + category;
      }

      pathString = '/V2/Http.svc/Translate?text='+encodeURIComponent(text)+'&to='+to+'&contentType=text/plain&category=' + category;
      var req = http.request({
          host: 'api.microsofttranslator.com',
          port: 80,
          path: pathString,
          method: 'GET',
          headers: {
              'Authorization': 'Bearer ' + token
          }
      });
      req.on('response', function(response){
          var data = '';
          response.on('data', function(chunk){
              data += chunk;
          });
          response.on('end', function(){
              var error, translation;
              try {
                  translation = regx.exec(data)[1];
              } catch(e) {
                  error = 'parse-exception';
              }
              callback(obj, error, {
                  translatedText: client.parseXHTMLString(translation)
              });
          });
      });
      req.on('error', function(e){
          callback(new Error(e.message), null);
      });
      req.end();
  });
}

client.retrieveAccessToken = function(callback) {
    callback(localStorage.getItem("azure_access_token"))
}

client.saveAccessToken = function(token) {
    localStorage.setItem("azure_access_token", token);
    localStorage.setItem("azure_access_date", new Date().getTime())
}

client.checkIfAccessTokenValidTime = function(callback) {

    var date = localStorage.getItem("azure_access_date");
    if(date == null) {
        callback(false);
        return;
    }

    var duration = new Date().getTime() - date;

    if(duration > ACCESS_TOKEN_VALID_MILSEC)
    {
        callback(false);
    }
    else
    {
        callback(true);
    }
}

client.getToken = function(credentials, callback){
  client.checkIfAccessTokenValidTime(function(isValid){
    if(isValid) {
        client.retrieveAccessToken(function(access_token) {
          callback(null, access_token);
        });
    } else {
      request.post(
        {
          url: 'https://api.cognitive.microsoft.com/sts/v1.0/issueToken',
          headers: {
            'Ocp-Apim-Subscription-Key': credentials.azure_client_secret
          },
          method: 'POST'
        },	
        function (error, response, body) {
          if (!error && response.statusCode == 200) {
            client.saveAccessToken(body);
            callback(null, body);
          }
        }
      );
    }
  })
}