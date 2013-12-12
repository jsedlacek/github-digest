var fs = require('fs');
var util = require('util');

var request = require('request');
var handlebars = require('handlebars');
var moment = require('moment');
var marked = require('marked');
var rsvp = require('rsvp');

var template = handlebars.compile(fs.readFileSync("issues.hbs", {encoding: 'utf8'}));

handlebars.registerHelper('fromNow', function(context, block) {
    return moment(context).fromNow();
});

handlebars.registerHelper('marked', function(context, block) {
    return new handlebars.SafeString(marked(context));
});

handlebars.registerHelper('issue-number', function(context, block) {
    var index = context.issue_url.lastIndexOf("/");
    return "#" + context.issue_url.substring(index + 1);
});

function getFromGithub(url) {
    return new rsvp.Promise(function(resolve, reject) {
        request(
            {
                url: url,
                headers: {
                    'User-Agent': 'Github Digest',
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

function getIssues(repo, since) {
    return getFromGithub(
        util.format('https://api.github.com/repos/%s/issues?since=%s',
            repo,
            since.toISOString()
        )
    );
}

function getIssueComment(issue, since) {
    return getFromGithub(util.format('%s?since=%s',
        issue.comments_url,
        since.toISOString()
    )).then(function(comments) {
        return {issue: issue, comments: comments};
    });
}


function getDigest(repo, since) {
	return getIssues(repo, since).then(function(issues) {
	    return rsvp.all(issues.map(function(issue) {
	        return getIssueComment(issue, since);
	    }));
	}).then(function(issues) {
	    issues.forEach(function(issue) {
	        if (+moment(issue.issue.created_at) > +since) {
	            issue.new = true;
	        }
	        else if (+moment(issue.issue.updated_at) > +since) {
	            issue.active = true;
	        }
	    });
	    // fs.writeFileSync("issues.html", template({issues: issues}));
	    return template({issues: issues});
	});
}

exports.getDigest = getDigest;