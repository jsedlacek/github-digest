var express = require("express");
var logfmt = require("logfmt");
var moment = require('moment');

var github = require("./github");

var app = express();
var repo = "google/traceur-compiler";

app.use(logfmt.requestLogger());

app.get('/', function(req, res) {
	var since = moment().subtract('d', 1);
	github.getDigest("google/traceur-compiler", since).then(function(html) {
		res.send(html);
	}).fail(function(error) {
		res.send(error);
	});
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});