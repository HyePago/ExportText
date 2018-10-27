var express = require('express');
var app = express();

var http = require('http');
var fs = require('fs');
var url = require('url');
var qs = require('querystring');

var pdfjsLib = require('pdfjs-dist');
var mammoth = require('mammoth');
var hwp = require("./node-hwp");

var options = {
  styleMap: [
      "u => em",
      "p[style-name='Section Title'] => h1:fresh",
      "p[style-name='Subsection Title'] => h2:fresh"
  ],
  includeDefaultStyleMap: false
};

function templateHTML(title, body){
  return `
  <!doctype html>
  <html>
  <head>
    <title>WEB1 - ${title}</title>
    <meta charset="utf-8">
  </head>
  <body>
    ${body}
  </body>
  </html>
  `;
}
 
var server = http.createServer(function(request,response){
    var _url = request.url;
    var queryData = url.parse(_url, true).query;
    var pathname = url.parse(_url, true).pathname;
    if(pathname === '/'){
      if(queryData.id === undefined){
        fs.readdir('./data', function(error, filelist){
          var title = 'Welcome';
          var template = templateHTML(title, `
          <form action="http://localhost:3000/readfile" method="post">
            <p><input type="file" name="file"></p>
            <p>
              <input type="submit" value="추출">
            </p>
          </form>
        `);
          response.writeHead(200);
          response.end(template);
        });
      } else {
        fs.readdir('./data', function(error, filelist){
          fs.readFile(`data/${queryData.id}`, 'utf8', function(err, description){
            var title = queryData.id;
            var template = templateHTML(title, `
            <form action="http://localhost:3000/readfile" method="post">
              <p><input type="file" name="file"></p>
              <p>
                <input type="submit" value="추출">
              </p>
            </form>
          `);
            response.writeHead(200);
            response.end(template);
          });
        });
      }
    } else if(pathname === '/create'){
      fs.readdir('./data', function(error, filelist){
        var title = 'WEB - create';
        var template = templateHTML(title, `
          <form action="http://localhost:3000/readfile" method="post">
            <p><input type="text" name="title" placeholder="title"></p>
            <p>
              <textarea name="description" placeholder="description"></textarea>
            </p>
            <p>
              <input type="submit">
            </p>
          </form>
        `);
        response.writeHead(200);
        response.end(template);
      });
    } else if(pathname === '/readfile'){
        var body = '';
        var filePath = '';
        var extension = '';

        request.on('data', function(data){
            body = body + data;
            filePath = filePath + data.toString().substring(5, data.length);
            extension = extension + data.toString().substring(data.toString().lastIndexOf("."), data.length);
        });
        fs.readdir('./data', function(error, filelist){
          if(extension == '.pdf') {
            pdfjsLib.getDocument(__dirname + '/' + filePath).then(function (doc) {
              var numPages = doc.numPages;
              console.log('Total Number of Pages : ' + numPages);
              console.log();
            
              var lastPromise; // will be used to chain promises
              lastPromise = doc.getMetadata().then(function (data) {
              });

              var loadPage = function (pageNum) {
                return doc.getPage(pageNum).then(function (page) {
                  console.log('* page number : ' + pageNum);
                  var viewport = page.getViewport(1.0 /* scale */);
                  return page.getTextContent().then(function (content) {
                    // Content contains lots of information about the text layout and
                    // styles, but we need only strings at the moment
                    var strings = content.items.map(function (item) {
                      return item.str;
                    });
                    console.log(strings.join(' '));
                  }).then(function () {
                    console.log();
                  });
                })
              };

              // Loading of the first page will wait on metadata and subsequent loadings
              // will wait on the previous pages.
              for (var i = 1; i <= numPages; i++) {
                lastPromise = lastPromise.then(loadPage.bind(null, i));
              }
              return lastPromise;
            }).then(function () {
              console.log('-- End --');
            }, function (err) {
              console.error('Error: ' + err);
            });
          } else if(extension == '.docx') {
            mammoth.convertToHtml({path: __dirname + '/' + filePath}, options).then(result => {
              let text = result.value.replace(/(<([^>]+)>)/ig,"\n");

              console.log(text);
            }).done();
          } else if(extension == '.hwp') {
            hwp.open(__dirname + '/' + filePath, function(err, doc) {
              var str = doc.toHML().toString().substring(doc.toHML().indexOf("<CHAR>"), doc.toHML().lastIndexOf("</BODY>"));
              var arr = str.toString().split("<CHAR>");

              for(var i=0; i<arr.length; i++) {
                console.log(arr[i].substring(0, arr[i].indexOf("</CHAR>")));
              }
            });
            
          }

          var title = 'read - File';
            var template = templateHTML(title, `
              <form>
                ${body}
                <br>
                ${filePath}
                <br>
                ${extension}
              </form>
            `);
            response.writeHead(200);
            response.end(template);
          });
    } else {
      response.writeHead(404);
      response.end('Not found');
    }
 
 
 
});
server.listen(3000);