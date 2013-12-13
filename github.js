var fs = require('fs');
var util = require('util');

var request = require('request');
var handlebars = require('handlebars');
var moment = require('moment');
var marked = require('marked');
var rsvp = require('rsvp');
var hljs = require('highlight.js');
var Styliner = require('styliner');

var template = handlebars.compile(fs.readFileSync("issues.hbs", {encoding: 'utf8'}));
var styliner = new Styliner(__dirname);

handlebars.registerHelper('fromNow', function(context, block) {
    return moment(context).fromNow();
});

handlebars.registerHelper('marked', function(context, block) {
    if (!context) {
        return "";
    }
    return new handlebars.SafeString(marked(context));
});

handlebars.registerHelper('diff', function(code, length) {
    var array = code.split("\n");
    array = array.splice(array.length - length);
    return new handlebars.SafeString(hljs.highlight("diff", array.join("\n")).value);
});


function getFromGithub(url) {
    return new rsvp.Promise(function(resolve, reject) {
        request(
            {
                url: url,
                headers: {
                    'User-Agent': 'Github Digest',
                    'Accept': 'application/vnd.github.html+json',
                    'Authorization': 'token ' + process.env.GITHUB_TOKEN
                }
            }, function (error, response, body) {
                if (error) {
                    reject(error);
                    return;
                }
                if (response.statusCode >= 400) {
                    reject(body);
                    return;
                }
                resolve(JSON.parse(body));
            }
        );
    });
}

function getIssues(repo, since, state) {
    state = state || "open";
    return getFromGithub(
        util.format('https://api.github.com/repos/%s/issues?since=%s&state=%s',
            repo,
            since.toISOString(),
            state
        )
    );
}

function getIssueComments(issue, since) {
    var promises = [];
    promises.push(getFromGithub(util.format('%s?since=%s',
        issue.comments_url,
        since.toISOString()
    )));
    if (issue.pull_request.html_url) {
        promises.push(getFromGithub(util.format('%s?since=%s',
            issue.comments_url.replace("/issues/", "/pulls/"),
            since.toISOString()
        )));
    }
    return rsvp.all(promises).then(function(results) {
        return {issue: issue, comments: results[0], pullComments: results[1]};
    });
}

function getAllIssues(repo, since) {
    return rsvp.all(
        [getIssues(repo, since, "open"), getIssues(repo, since, "closed")]
    ).then(function(issues) {
        var openIssues = issues[0];
        var closedIssues = issues[1];
        return openIssues.concat(closedIssues);
    });
}


function getDigest(repo, since) {
	return getAllIssues(repo, since).then(function(issues) {
	    return rsvp.all(issues.map(function(issue) {
	        return getIssueComments(issue, since);
	    }));
	}).then(function(issues) {
        issues.forEach(function(issue) {
            if (issue.issue.pull_request.html_url && issue.issue.state === "closed") {
                issue.merged = true;
            }
            else if (issue.issue.state === "closed") {
                issue.closed = true;
            }
	        else if (+moment(issue.issue.created_at) > +since) {
	            issue.new = true;
	        }
	        else if (+moment(issue.issue.updated_at) > +since) {
	            issue.active = true;
	        }
	    });
        return styliner.processHTML(template({issues: issues}))
	});
}

exports.getDigest = getDigest;