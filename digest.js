var fs = require('fs');
var util = require('util');

var moment = require('moment');
var rsvp = require('rsvp');
var logfmt = require("logfmt");
var github = require("./github");

var sendgrid  = require('sendgrid')(
    process.env.SENDGRID_USERNAME,
    process.env.SENDGRID_PASSWORD
);

var since = moment().subtract('d', 1);

var REPOS = [
    "google/traceur-compiler",
    "bower/bower",
    "jorendorff/js-loaders",
    "ModuleLoader/es6-module-loader",
    "emberjs/ember.js"
];

REPOS.forEach(function(repo) {
    github.getDigest(repo, since).then(function(html) {
        if (html) {
            sendgrid.send({
                to: 'sedlacek.jakub@gmail.com',
                from: 'sedlacek.jakub@gmail.com',
                subject: repo + ' digest',
                html: html
            }, function(err, json) {
                if (err) { return console.error(err); }
                console.log(json);
            });
        }
    }).fail(function(error) {
        console.error(error);
    });
});
